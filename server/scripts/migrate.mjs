// 迁移执行器：把 db/migrations 下的 .sql 按文件名顺序跑一遍，已跑过的跳过。
// 用一个 migrations 表记录跑过哪些，保证幂等 —— 重复执行不会重复 ALTER。
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from '../src/db.js'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '..', '..', 'db', 'migrations')

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(120) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  const [doneRows] = await pool.query('SELECT name FROM schema_migrations')
  const done = new Set(doneRows.map((r) => r.name))

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (done.has(file)) {
      console.log(`跳过（已执行）：${file}`)
      continue
    }

    // 一个 .sql 文件里可能有多条语句，按分号切开逐条执行
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const statements = sql
      .split(';')
      .map((s) =>
        s
          // 去掉纯注释行，避免切出空语句
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      )
      .filter(Boolean)

    for (const statement of statements) {
      await pool.query(statement)
    }

    await pool.query('INSERT INTO schema_migrations (name) VALUES (?)', [file])
    console.log(`已执行：${file}（${statements.length} 条语句）`)
  }

  await pool.end()
  console.log('迁移完成')
}

main().catch(async (err) => {
  console.error('迁移失败：', err.message)
  await pool.end()
  process.exit(1)
})
