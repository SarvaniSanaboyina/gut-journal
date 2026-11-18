import type { Prisma, PrismaClient } from '@prisma/client'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'HttpError'
  }
}

export type Db = PrismaClient | Prisma.TransactionClient

export const MAX_TEXT = 4000
export const MAX_NOTE = 8000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function bad(message: string): never {
  throw new HttpError(400, message)
}

export function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  return bad(`Invalid ${label}`)
}

export function parseId(value: unknown, fallbackNew = false): string {
  if (typeof value !== 'string' || value.trim() === '') {
    if (fallbackNew) return crypto.randomUUID()
    return bad('Invalid id')
  }
  if (!/^[0-9a-zA-Z-]{1,80}$/.test(value)) return bad('Invalid id')
  return value
}

export function parseDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return bad('Invalid date')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return bad('Invalid date')
  }
  return value
}

export function parseTime(value: unknown, optional = false): string {
  if (optional && (value === '' || value == null)) return ''
  if (typeof value !== 'string') return bad('Invalid time')
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return bad('Invalid time')
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = match[3] == null ? null : Number(match[3])
  if (hour > 23 || minute > 59 || (second != null && second > 59)) return bad('Invalid time')
  const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return second == null ? clock : `${clock}:${String(second).padStart(2, '0')}`
}

export function parseText(value: unknown, max: number): string {
  if (value == null) return ''
  if (typeof value !== 'string') return bad('Invalid text')
  const text = value.trim()
  if (text.length > max) return bad('Text is too long')
  return text
}

export function parseFlag(value: unknown): boolean {
  return value === true
}

export function parseQuantity(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(number) || number < 0 || number > 100000) return bad('Invalid quantity')
  return number
}


export function parseOptionalNumber(value: unknown, label: string, max = 100000): number | null {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(number) || number < 0 || number > max) return bad(`Invalid ${label}`)
  return number
}

/** Keep the previous version of a record before it is changed or deleted. */
export async function recordRevision(db: Db, entity: string, entityId: string, action: 'update' | 'delete', data: unknown) {
  await db.recordRevision.create({
    data: {
      id: crypto.randomUUID(),
      entity,
      entityId,
      action,
      data: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
    },
  })
}
