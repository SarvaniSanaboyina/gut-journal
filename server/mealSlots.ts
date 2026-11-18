import type { MealSlot, PrismaClient } from '@prisma/client'
import { bad, type Db, isRecord, MAX_TEXT, oneOf, parseDate, parseText, recordRevision } from './validate.ts'

/**
 * The five scheduled meal slots for every day. Slots are computed, not stored: a meal entry of
 * that type on that date makes the slot "eaten"; a `meal_slots` row records an explicit
 * "not eaten"; anything else is "not logged". Nothing is ever filled in automatically.
 */
export const SLOT_TYPES = ['breakfast', 'morning-snack', 'lunch', 'evening-snack', 'dinner'] as const
export type SlotType = (typeof SLOT_TYPES)[number]

export type MealSlotEntry = {
  date: string
  mealType: SlotType
  status: 'not-eaten'
  note: string
}

export function slotFromRow(row: MealSlot): MealSlotEntry {
  return { date: row.date, mealType: row.mealType as SlotType, status: 'not-eaten', note: row.note }
}

export function parseSlot(value: unknown, date?: unknown, mealType?: unknown): MealSlotEntry {
  if (!isRecord(value)) return bad('Invalid meal status')
  return {
    date: parseDate(date ?? value.date),
    mealType: oneOf(String(mealType ?? value.mealType ?? ''), SLOT_TYPES, 'meal slot'),
    status: oneOf(String(value.status ?? ''), ['not-eaten'] as const, 'meal status'),
    note: parseText(value.note, MAX_TEXT),
  }
}

export async function readSlots(db: Db) {
  const rows = await db.mealSlot.findMany({ orderBy: [{ date: 'asc' }, { mealType: 'asc' }] })
  return rows.map(slotFromRow)
}

export async function insertSlot(db: Db, entry: MealSlotEntry) {
  const data = { status: entry.status, note: entry.note }
  await db.mealSlot.upsert({
    where: { date_mealType: { date: entry.date, mealType: entry.mealType } },
    create: { date: entry.date, mealType: entry.mealType, ...data },
    update: data,
  })
}

/** Called inside the meal save transaction: logging food for a slot replaces a "not eaten". */
export async function clearSkipForMeal(db: Db, date: string, mealType: string) {
  if (!(SLOT_TYPES as readonly string[]).includes(mealType)) return
  const existing = await db.mealSlot.findUnique({ where: { date_mealType: { date, mealType } } })
  if (!existing) return
  await recordRevision(db, 'meal-slot', `${date}|${mealType}`, 'delete', slotFromRow(existing))
  await db.mealSlot.delete({ where: { date_mealType: { date, mealType } } })
}

/**
 * Set a slot's explicit status. `status: 'not-logged'` removes the explicit record.
 * Marking "not eaten" while food is logged for the slot is refused unless `replaceMeals` is true,
 * in which case those meal entries are deleted (each keeps a revision).
 */
export async function setSlotStatus(db: PrismaClient, dateValue: string, typeValue: string, body: unknown) {
  if (!isRecord(body)) return bad('Invalid meal status')
  const date = parseDate(dateValue)
  const mealType = oneOf(typeValue, SLOT_TYPES, 'meal slot')
  return db.$transaction(async (tx) => {
    const existing = await tx.mealSlot.findUnique({ where: { date_mealType: { date, mealType } } })
    if (body.status === 'not-logged') {
      if (existing) {
        await recordRevision(tx, 'meal-slot', `${date}|${mealType}`, 'delete', slotFromRow(existing))
        await tx.mealSlot.delete({ where: { date_mealType: { date, mealType } } })
      }
      return { date, mealType, status: 'not-logged' as const, removedMeals: [] as string[] }
    }
    const entry = parseSlot(body, date, mealType)
    const meals = await tx.meal.findMany({ where: { date, type: mealType }, include: { items: true } })
    if (meals.length && body.replaceMeals !== true) {
      return bad('Food is already logged for this meal. Confirm to replace it with “Not eaten”.')
    }
    for (const meal of meals) {
      await recordRevision(tx, 'meal', meal.id, 'delete', meal)
      await tx.mealPhoto.deleteMany({ where: { mealId: meal.id } })
      await tx.meal.delete({ where: { id: meal.id } })
    }
    if (existing) await recordRevision(tx, 'meal-slot', `${date}|${mealType}`, 'update', slotFromRow(existing))
    await insertSlot(tx, entry)
    return { ...entry, removedMeals: meals.map((meal) => meal.id) }
  })
}
