import { defineConfig } from 'drizzle-kit'

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/sqlite/schema.ts',
  out: './migrations/sqlite',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'sqlite://./data/bot.db',
  },
})
