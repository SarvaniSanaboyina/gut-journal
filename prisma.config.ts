import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Prisma CLI requires a URL. Runtime uses the PGlite adapter instead.
    url: 'postgresql://127.0.0.1:5432/ashrit_journal',
  },
})
