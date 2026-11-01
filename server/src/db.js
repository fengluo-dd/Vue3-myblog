import mysql from 'mysql2/promise'
import 'dotenv/config'

// 连接池：应用里所有查询共用这一组连接，用完自动归还。
// 如果每次请求都新建连接，并发一高数据库就会被连接数打满，而且每次都要握手，慢。
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blog_db',
  waitForConnections: true,
  connectionLimit: 10,
  // 不写 utf8mb4 的话，中文取出来会变问号
  charset: 'utf8mb4',
  // 关键：让 DATETIME 原样返回 '2026-10-28 21:00:00' 字符串。
  // 不设的话 mysql2 会转成 JS Date，再序列化成 UTC 的 '2026-10-28T13:00:00.000Z'，
  // 前端拿到的日期会平白少 8 小时，格式也变了。
  dateStrings: true
})
