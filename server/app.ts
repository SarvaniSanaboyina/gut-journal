import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import express, { type NextFunction, type Request, type Response } from 'express'
import {
  HttpError,
  checkPhotoMime,
  exportJournal,
  importJournal,
  parsePhotoSlot,
  readJournal,
  readPhoto,
  removeMeal,
  removeMood,
  removePhoto,
  removePoop,
  saveDayNote,
  saveMeal,
  saveMood,
  savePhoto,
  savePoop,
} from './journal.ts'

const JSON_LIMIT = '32mb'
const PHOTO_LIMIT = '8mb'

function param(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

function sendError(res: Response, error: unknown) {
  if (res.headersSent) return
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ error: 'Journal database error' })
}

export function createApp(prisma: PrismaClient, options: { distDir?: string } = {}) {
  const app = express()
  app.disable('x-powered-by')

  app.get('/api/health', async (_req, res) => {
    res.set('cache-control', 'no-store')
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, orm: 'prisma' })
  })

  app.get('/api/photos/:mealId/:slot', async (req, res) => {
    try {
      const stored = await readPhoto(prisma, param(req.params.mealId), parsePhotoSlot(param(req.params.slot)))
      if (!stored) {
        res.status(404).json({ error: 'Photo not found' })
        return
      }
      res.set({
        'content-type': stored.mime,
        'content-length': String(stored.bytes.byteLength),
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      res.end(Buffer.from(stored.bytes))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.put(
    '/api/photos/:mealId/:slot',
    express.raw({ type: () => true, limit: PHOTO_LIMIT }),
    async (req, res) => {
      try {
        const header = req.headers['content-type']?.split(';')[0]?.trim() || 'image/jpeg'
        const body = req.body
        const bytes = Buffer.isBuffer(body) ? new Uint8Array(body) : new Uint8Array()
        await savePhoto(prisma, param(req.params.mealId), parsePhotoSlot(param(req.params.slot)), checkPhotoMime(header), bytes)
        res.status(204).end()
      } catch (error) {
        sendError(res, error)
      }
    },
  )

  app.delete('/api/photos/:mealId/:slot', async (req, res) => {
    try {
      await removePhoto(prisma, param(req.params.mealId), parsePhotoSlot(param(req.params.slot)))
      res.status(204).end()
    } catch (error) {
      sendError(res, error)
    }
  })

  app.use(express.json({ limit: JSON_LIMIT }))

  app.get('/api/journal', async (_req, res) => {
    res.set('cache-control', 'no-store')
    res.json(await readJournal(prisma))
  })

  app.get('/api/export', async (_req, res) => {
    res.set('cache-control', 'no-store')
    res.json(await exportJournal(prisma))
  })

  app.post('/api/import', async (req, res) => {
    res.json(await importJournal(prisma, req.body))
  })

  app.put('/api/meals', async (req, res) => {
    res.json(await saveMeal(prisma, req.body))
  })

  app.put('/api/poops', async (req, res) => {
    res.json(await savePoop(prisma, req.body))
  })

  app.put('/api/moods', async (req, res) => {
    res.json(await saveMood(prisma, req.body))
  })

  app.delete('/api/meals/:id', async (req, res) => {
    await removeMeal(prisma, param(req.params.id))
    res.status(204).end()
  })

  app.delete('/api/poops/:id', async (req, res) => {
    await removePoop(prisma, param(req.params.id))
    res.status(204).end()
  })

  app.delete('/api/moods/:id', async (req, res) => {
    await removeMood(prisma, param(req.params.id))
    res.status(204).end()
  })

  app.put('/api/notes/:date', async (req, res) => {
    await saveDayNote(prisma, param(req.params.date), req.body)
    res.status(204).end()
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  const indexFile = options.distDir ? join(options.distDir, 'index.html') : ''
  if (options.distDir && existsSync(indexFile)) {
    const distDir = options.distDir
    app.use(express.static(distDir, { cacheControl: false, etag: false, lastModified: false }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      res.sendFile(indexFile, (error) => {
        if (error) next(error)
      })
    })
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    sendError(res, error)
  })

  return app
}
