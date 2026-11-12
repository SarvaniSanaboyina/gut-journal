import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Prisma CLI requires a URL. Runtime uses PGlite locally, or DATABASE_URL in production.
    url: process.env.DATABASE_URL ?? 'postgresql://127.0.0.1:5432/gut_journal',
  },
})
