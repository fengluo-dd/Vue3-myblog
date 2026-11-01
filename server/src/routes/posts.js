import { Router } from 'express'
import { pool } from '../db.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'

const router = Router()

/**
 * GET /api/posts
 * 文章列表。可选 ?category=前端 按分类过滤，?type=post|note 按类型过滤。
 * 注意：列表不查 content 字段，正文只有详情页才需要，列表页查出来纯属浪费流量。
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, type } = req.query

    // 字段起别名，直接对齐前端的驼峰命名，省掉一层转换
    let sql = `
      SELECT id, title, summary, category, type, cover, views,
             like_count AS likeCount, visibility, created_at AS createdAt
      FROM posts
    `

    // 条件是拼出来的，所以用数组收集，最后用 AND 连起来。
    // 每个值依然走 ? 占位符，不拼字符串，避免 SQL 注入
    const where = []
    const params = []

    if (category) {
      where.push('category = ?')
      params.push(category)
    }

    // 只认这两个值，别的当没传 —— 否则会被拼进一个查不到东西的 SQL
    if (type === 'post' || type === 'note') {
      where.push('type = ?')
      params.push(type)
    }

    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ')
    }

    sql += ' ORDER BY created_at DESC'

    // 用 ? 占位符让 mysql2 帮你转义，绝不要用字符串拼接拼进 SQL
    const [rows] = await pool.query(sql, params)

    res.json({ code: 0, data: rows })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/posts/:id
 * 文章详情。
 * 权限规则：public 谁都能看全文；member 必须登录。
 * 关键：没权限时 content 直接返回 null，正文根本不出数据库、不进网络包。
 *
 * 另外这里顺手做两件事：浏览数 +1、查出当前用户有没有点过赞。
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '文章 id 不合法' })
    }

    const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [id])

    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '文章不存在' })
    }

    const post = rows[0]
    // req.user 由 optionalAuth 中间件塞进来：带合法 token 才有值
    const canRead = post.visibility === 'public' || Boolean(req.user)

    /**
     * 浏览数 +1。
     *
     * 用的是「每次详情请求都加一」，刷新一次算一次，没有做去重。
     * 真实的统计要按 IP / 用户 + 时间窗去重，那得单独建一张浏览记录表，
     * 每次请求查一次「这人今天看过没」，对个人博客是不划算的复杂度。
     *
     * 放在 SELECT 之后执行，所以返回给前端的数字要手动 +1，
     * 否则用户会看到「进来之前」的旧数字。
     */
    await pool.query('UPDATE posts SET views = views + 1 WHERE id = ?', [id])

    // 只有登录的人才有「点没点过赞」这回事
    let liked = false
    if (req.user) {
      const [likeRows] = await pool.query(
        'SELECT id FROM likes WHERE post_id = ? AND user_id = ?',
        [id, req.user.id]
      )
      liked = likeRows.length > 0
    }

    res.json({
      code: 0,
      data: {
        id: post.id,
        title: post.title,
        summary: post.summary,
        category: post.category,
        type: post.type,
        cover: post.cover,
        views: post.views + 1,
        likeCount: post.like_count,
        visibility: post.visibility,
        createdAt: post.created_at,
        locked: !canRead,
        liked,
        content: canRead ? post.content : null
      }
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/posts/:id/like
 * 点赞。必须登录，每人每篇只能点一次。
 *
 * 靠 likes 表上的唯一索引 (post_id, user_id) 保证，
 * 用 INSERT IGNORE：重复点赞不会报错，只是 affectedRows 变成 0，
 * 这时就不加计数，天然做到幂等。
 * 这比「先查有没有，没有再插入」少一次查询，也没有并发漏洞。
 */
router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '文章 id 不合法' })
    }

    const [posts] = await pool.query('SELECT id, like_count FROM posts WHERE id = ?', [id])
    if (posts.length === 0) {
      return res.status(404).json({ code: 404, message: '文章不存在' })
    }

    const [result] = await pool.query(
      'INSERT IGNORE INTO likes (post_id, user_id) VALUES (?, ?)',
      [id, req.user.id]
    )

    let likeCount = posts[0].like_count
    if (result.affectedRows > 0) {
      await pool.query('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [id])
      likeCount += 1
    }

    res.json({ code: 0, data: { liked: true, likeCount } })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/posts/:id/like
 * 取消点赞。没点过也不会报错，返回当前真实状态。
 */
router.delete('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '文章 id 不合法' })
    }

    const [posts] = await pool.query('SELECT id, like_count FROM posts WHERE id = ?', [id])
    if (posts.length === 0) {
      return res.status(404).json({ code: 404, message: '文章不存在' })
    }

    const [result] = await pool.query(
      'DELETE FROM likes WHERE post_id = ? AND user_id = ?',
      [id, req.user.id]
    )

    let likeCount = posts[0].like_count
    if (result.affectedRows > 0) {
      // GREATEST 兜一下底：万一计数被别处改乱了，也不会出现负数
      await pool.query(
        'UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?',
        [id]
      )
      likeCount = Math.max(likeCount - 1, 0)
    }

    res.json({ code: 0, data: { liked: false, likeCount } })
  } catch (err) {
    next(err)
  }
})

export default router
