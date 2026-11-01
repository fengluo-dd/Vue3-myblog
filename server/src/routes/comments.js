import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

/**
 * 一次查出目标下的全部留言，在内存里拼成两层树。
 *
 * 为什么不写成「先查父留言，再逐条查回复」：
 * 那样是典型的 N+1 查询，10 条留言就是 11 次数据库往返。
 * 这里一次全捞出来，用 Map 分组，成本是 O(n)。
 *
 * 注意：已经不按 status 过滤了。审核停用后新留言直接是 1，
 * 但字段还在库里，将来要恢复审核就在 WHERE 里补一句 c.status = 1。
 *
 * @param {string} whereSql 目标过滤条件（留言板 / 某篇文章）
 * @param {any[]} params
 */
async function loadThread(whereSql, params) {
  const [rows] = await pool.query(
    `SELECT c.id,
            c.parent_id AS parentId,
            c.reply_to_user_id AS replyToId,
            u.username AS nickname,
            ru.username AS replyToName,
            c.content,
            c.created_at AS createdAt
     FROM comments c
     JOIN users u ON c.user_id = u.id
     LEFT JOIN users ru ON c.reply_to_user_id = ru.id
     WHERE ${whereSql}
     ORDER BY c.created_at ASC`,
    params
  )

  const tops = []
  const repliesByParent = new Map()

  for (const row of rows) {
    if (row.parentId === null) {
      tops.push({ ...row, replies: [] })
      continue
    }
    const list = repliesByParent.get(row.parentId)
    if (list) list.push(row)
    else repliesByParent.set(row.parentId, [row])
  }

  // 只有「父留言本身查得到」的回复才会被挂上去。
  // 父留言不存在（理论上被 CASCADE 删干净了）时，它下面的回复直接丢弃 ——
  // 不会出现一条孤零零的回复浮在半空。
  const threads = tops.map((top) => ({
    ...top,
    replies: repliesByParent.get(top.id) || []
  }))

  // 顶层新的在上（留言板习惯）；楼内保持时间正序（对话顺序）
  threads.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return threads
}

/**
 * GET /api/comments
 * GET /api/comments?postId=3
 *
 * 不传 postId = 公共留言板（post_id IS NULL）；
 * 传 postId   = 某篇文章下面的评论。
 *
 * 审核已停用：发出来就能看到，这里不再按 status 过滤。
 */
router.get('/', async (req, res, next) => {
  try {
    const { postId } = req.query

    // 留言板：所有没挂在文章下的留言
    if (postId === undefined || postId === '') {
      const data = await loadThread('c.post_id IS NULL', [])
      return res.json({ code: 0, data })
    }

    const id = Number(postId)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '文章 id 不合法' })
    }

    const data = await loadThread('c.post_id = ?', [id])
    res.json({ code: 0, data })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/comments
 * body: { content, postId?, parentId? }
 *
 * postId   不传 = 发到留言板；传了 = 发到那篇文章下面
 * parentId 不传 = 顶层留言；传了 = 回复某条留言（楼中楼）
 *
 * 回复只做两层：就算前端传的是一条「回复」的 id，
 * 后端也会把它提升到那个楼层，不会长出第三层。
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {}
    const text = String(body.content || '').trim()

    if (!text) {
      return res.status(400).json({ code: 400, message: '留言内容不能为空' })
    }
    if (text.length > 500) {
      return res.status(400).json({ code: 400, message: '留言最多 500 字' })
    }

    /* ---------- 目标：留言板还是某篇文章 ---------- */

    let postId = null
    if (body.postId !== undefined && body.postId !== null && body.postId !== '') {
      postId = Number(body.postId)
      if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ code: 400, message: '文章 id 不合法' })
      }

      const [posts] = await pool.query('SELECT id FROM posts WHERE id = ?', [postId])
      if (posts.length === 0) {
        return res.status(404).json({ code: 404, message: '文章不存在' })
      }
    }

    /* ---------- 楼中楼 ---------- */

    let parentId = null
    let replyToUserId = null

    if (body.parentId !== undefined && body.parentId !== null && body.parentId !== '') {
      parentId = Number(body.parentId)
      if (!Number.isInteger(parentId) || parentId <= 0) {
        return res.status(400).json({ code: 400, message: '要回复的留言 id 不合法' })
      }

      const [rows] = await pool.query(
        `SELECT id, post_id AS postId, parent_id AS parentId, user_id AS userId
         FROM comments WHERE id = ?`,
        [parentId]
      )
      if (rows.length === 0) {
        return res.status(404).json({ code: 404, message: '要回复的留言不存在' })
      }

      const target = rows[0]

      // 归属校验：不能拿 A 文章下的留言 id，去回复 B 文章或留言板。
      // 少了这一步，别人可以构造请求把回复挂到别处去。
      const targetPostId = target.postId === null ? null : Number(target.postId)
      if (targetPostId !== postId) {
        return res.status(400).json({ code: 400, message: '要回复的留言不属于这里' })
      }

      // 回复的是一条「回复」时，把楼层提升到它的顶层 —— 永远只有两层
      parentId = target.parentId === null ? target.id : target.parentId
      // @谁由后端从被回复的那条留言推出来，不接受前端传，防止伪造
      replyToUserId = target.userId
    }

    // status 直接写 1（可见）。字段还留着，是为了哪天要恢复审核时
    // 只要把这里的 1 改回 0、再在查询里补一句过滤就完事
    const [result] = await pool.query(
      `INSERT INTO comments (post_id, parent_id, reply_to_user_id, user_id, content, status)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [postId, parentId, replyToUserId, req.user.id, text]
    )

    res.json({ code: 0, data: { id: result.insertId } })
  } catch (err) {
    next(err)
  }
})

export default router
