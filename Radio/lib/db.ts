import { neon } from '@neondatabase/serverless'

let cachedSql: ReturnType<typeof neon> | null = null

export function getRadioSql() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL saknas')
  }

  if (!cachedSql) {
    cachedSql = neon(databaseUrl)
  }

  return cachedSql
}
