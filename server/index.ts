import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp } from './app.ts'
import { openDatabase } from './db.ts'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'
const DATA_DIR = resolve(process.env.JOURNAL_DATA ?? 'data/pglite')
const DIST_DIR = resolve(process.env.JOURNAL_STATIC ?? 'dist')

mkdirSync(DATA_DIR, { recursive: true })
const { prisma, pglite } = await openDatabase(DATA_DIR)
const app = createApp(prisma, { distDir: DIST_DIR })

const server = app.listen(PORT, HOST, () => {
  console.log(`PGlite database: ${DATA_DIR}`)
  console.log(`Prisma + Express API: http://${HOST}:${PORT}`)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
  await pglite.close()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown()
})
process.on('SIGTERM', () => {
  void shutdown()
})
