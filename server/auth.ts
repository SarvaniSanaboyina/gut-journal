import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { HttpError } from './journal.ts'

const COOKIE = 'journal_session'
const SESSION_MS = 1000 * 60 * 60 * 24 * 30
const SCRYPT_KEYLEN = 32
const MIN_PASSWORD = 6
const MAX_PASSWORD = 200
const MAX_NAME = 80

export type AuthUser = { id: string; name: string }

const failedLogins = new Map<string, { count: number; blockedUntil: number }>()

function bad(status: number, message: string): never {
  throw new HttpError(status, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cookieValue(req: Request, name: string): string {
  const header = req.headers.cookie
  if (!header) return ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return { salt, hash }
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const next = scryptSync(password, salt, SCRYPT_KEYLEN)
  const previous = Buffer.from(hash, 'hex')
  if (next.length !== previous.length) return false
  return timingSafeEqual(next, previous)
}

function parseName(value: unknown): string {
  if (typeof value !== 'string') return bad(400, 'Enter a name')
  const name = value.trim()
  if (!name) return bad(400, 'Enter a name')
  if (name.length > MAX_NAME) return bad(400, 'That name is too long')
  return name
}

function parsePassword(value: unknown): string {
  if (typeof value !== 'string') return bad(400, 'Enter a password')
  if (value.length < MIN_PASSWORD) return bad(400, `Use at least ${MIN_PASSWORD} characters`)
  if (value.length > MAX_PASSWORD) return bad(400, 'That password is too long')
  return value
}

function setSessionCookie(res: Response, token: string) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  ]
  if (process.env.COOKIE_SECURE === '1') parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

async function createSession(prisma: PrismaClient, accountId: string, res: Response) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_MS)
  await prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      tokenHash: hashToken(token),
      accountId,
      expiresAt,
    },
  })
  setSessionCookie(res, token)
}

async function readSession(prisma: PrismaClient, req: Request) {
  const token = cookieValue(req, COOKIE)
  if (!token) return null
  const row = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: true },
  })
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) await prisma.session.deleteMany({ where: { id: row.id } })
    return null
  }
  return {
    id: row.id,
    user: { id: row.account.id, name: row.account.name },
    account: row.account,
  }
}

async function readUser(prisma: PrismaClient, req: Request): Promise<AuthUser | null> {
  return (await readSession(prisma, req))?.user ?? null
}

function throttleLogin(req: Request) {
  const key = req.ip || 'local'
  const now = Date.now()
  const current = failedLogins.get(key)
  if (current && current.blockedUntil > now) {
    return bad(429, 'Too many tries. Wait a moment and try again.')
  }
}

function recordLoginFailure(req: Request) {
  const key = req.ip || 'local'
  const current = failedLogins.get(key) ?? { count: 0, blockedUntil: 0 }
  current.count += 1
  if (current.count >= 5) {
    current.blockedUntil = Date.now() + 30_000
    current.count = 0
  }
  failedLogins.set(key, current)
}

function clearLoginFailures(req: Request) {
  failedLogins.delete(req.ip || 'local')
}

export async function authStatus(prisma: PrismaClient, req: Request) {
  const account = await prisma.account.findFirst({ select: { name: true } })
  const user = await readUser(prisma, req)
  return { needsSetup: !account, user, name: account?.name ?? null }
}

export async function setupAccount(prisma: PrismaClient, req: Request, res: Response) {
  if (await prisma.account.count()) return bad(409, 'The journal already has a password')
  if (!isRecord(req.body)) return bad(400, 'Invalid request')
  const name = parseName(req.body.name)
  const password = parsePassword(req.body.password)
  const confirm = typeof req.body.confirm === 'string' ? req.body.confirm : ''
  if (confirm !== password) return bad(400, 'Passwords do not match')
  const { salt, hash } = hashPassword(password)
  const account = await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      name,
      passwordHash: hash,
      passwordSalt: salt,
    },
  })
  await createSession(prisma, account.id, res)
  return { user: { id: account.id, name: account.name } }
}

export async function login(prisma: PrismaClient, req: Request, res: Response) {
  throttleLogin(req)
  if (!isRecord(req.body)) return bad(400, 'Invalid request')
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  const account = await prisma.account.findFirst()
  if (!account) return bad(400, 'Set up a password first')
  if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    recordLoginFailure(req)
    return bad(401, 'Wrong password')
  }
  clearLoginFailures(req)
  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  await createSession(prisma, account.id, res)
  return { user: { id: account.id, name: account.name } }
}

export async function logout(prisma: PrismaClient, req: Request, res: Response) {
  const token = cookieValue(req, COOKIE)
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  clearSessionCookie(res)
}

export async function changePassword(prisma: PrismaClient, req: Request) {
  throttleLogin(req)
  const session = await readSession(prisma, req)
  if (!session) return bad(401, 'Please sign in')
  if (!isRecord(req.body)) return bad(400, 'Invalid request')
  const current = typeof req.body.current === 'string' ? req.body.current : ''
  const password = parsePassword(req.body.password)
  const confirm = typeof req.body.confirm === 'string' ? req.body.confirm : ''
  if (confirm !== password) return bad(400, 'Passwords do not match')
  if (!verifyPassword(current, session.account.passwordSalt, session.account.passwordHash)) {
    recordLoginFailure(req)
    return bad(400, 'Wrong current password')
  }
  if (verifyPassword(password, session.account.passwordSalt, session.account.passwordHash)) {
    return bad(400, 'Pick a different password')
  }
  clearLoginFailures(req)
  const { salt, hash } = hashPassword(password)
  await prisma.account.update({
    where: { id: session.account.id },
    data: { passwordHash: hash, passwordSalt: salt },
  })
  await prisma.session.deleteMany({
    where: { accountId: session.account.id, id: { not: session.id } },
  })
}

export function requireAuth(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await readUser(prisma, req)
      if (!user) {
        res.status(401).json({ error: 'Please sign in' })
        return
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function isPublicApi(req: Request) {
  if (req.path === '/api/health') return true
  if (req.method === 'GET' && req.path === '/api/auth/status') return true
  if (req.method === 'POST' && req.path === '/api/auth/setup') return true
  if (req.method === 'POST' && req.path === '/api/auth/login') return true
  if (req.method === 'POST' && req.path === '/api/auth/logout') return true
  return false
}
