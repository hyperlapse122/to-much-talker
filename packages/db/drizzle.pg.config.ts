import { defineConfig } from 'drizzle-kit'

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/pg/schema.ts',
  out: './migrations/pg',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/botdb',
  },
})
