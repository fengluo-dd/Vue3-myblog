import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'

// 初始化演示数据：一个管理员账号 + 4 条留言
// 这个脚本可以重复跑，不会插入重复数据

// 账号和密码从 .env 读，不写死在这里。
// 原因：写死的明文密码会跟着代码进 git，一旦仓库公开或被别人看到就等于泄露。
// .env 被 .gitignore 排除，所以只有本机（或服务器）上有这份明文。
// 显式 import 'dotenv/config' 是为了不依赖 db.js 顺带加载，本文件自己负责读配置。
const USERNAME = process.env.ADMIN_USERNAME || 'admin'
const PLAIN_PASSWORD = process.env.ADMIN_PASSWORD

// 没配就立刻停下。绝不能给它一个默认值兜底，
// 否则会静默地把管理员密码设成一个大家都知道的值。
if (!PLAIN_PASSWORD) {
  console.error('缺少 ADMIN_PASSWORD。请在 server/.env 里加一行：ADMIN_PASSWORD=你的密码')
  process.exit(1)
}

async function main() {
  // 1. 建账号。密码只存 bcrypt 哈希，数据库里看不到明文
  const hash = await bcrypt.hash(PLAIN_PASSWORD, 10)
  await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, 'admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [USERNAME, hash]
  )

  const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [USERNAME])
  const userId = users[0].id
  console.log(`用户 ${USERNAME} 就绪 (id=${userId})，密码 ${PLAIN_PASSWORD}`)

  // 2. 留言。已经有数据就跳过
  const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM comments')
  if (countRows[0].n > 0) {
    console.log(`comments 已有 ${countRows[0].n} 条，跳过`)
  } else {
    // 审核已经停用，新留言直接可见（status = 1）
    const messages = [
      '深蓝配一点橙，看着挺舒服的，不像套的模板。',
      '组合式 API 那篇说到点子上了，选项式写多了确实会乱。',
      '路过留个脚印，期待更新。'
    ]

    for (const content of messages) {
      await pool.query(
        'INSERT INTO comments (post_id, user_id, content, status) VALUES (NULL, ?, ?, 1)',
        [userId, content]
      )
    }
    console.log(`插入 ${messages.length} 条留言`)
  }

  // 3. 补上演示用的阅读数/点赞数（只在还没设置过时执行）
  const [zeroRows] = await pool.query('SELECT COUNT(*) AS n FROM posts WHERE views = 0')
  if (zeroRows[0].n > 0) {
    const stats = [
      [82, 7, 1],
      [156, 12, 2],
      [41, 5, 3]
    ]
    for (const [views, likes, id] of stats) {
      await pool.query('UPDATE posts SET views = ?, like_count = ? WHERE id = ?', [views, likes, id])
    }
    console.log('已补上演示用的阅读数/点赞数')
  }

  // 4. 清掉正文开头重复的一级标题
  //    标题已经单独存在 title 字段里，正文再写一遍，详情页会出现两个大标题
  const [postRows] = await pool.query('SELECT id, content FROM posts')
  let cleanedCount = 0
  for (const row of postRows) {
    if (row.content && row.content.startsWith('# ')) {
      // 去掉第一行 "# xxx" 以及后面紧跟的空行
      const cleaned = row.content.replace(/^#\s[^\n]*\n+/, '')
      await pool.query('UPDATE posts SET content = ? WHERE id = ?', [cleaned, row.id])
      cleanedCount += 1
    }
  }
  if (cleanedCount > 0) {
    console.log(`已清理 ${cleanedCount} 篇文章正文里重复的标题`)
  }

  await pool.end()
  console.log('完成')
}

main().catch(async (err) => {
  console.error('初始化失败：', err.message)
  await pool.end()
  process.exit(1)
})
