import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// 整个后台的所有接口都必须管理员身份。
// 写在最前面而不是每个路由单独写，是为了防止将来加接口时漏掉一行 requireAdmin，
// 那样就等于把后台敞开了。
router.use(requireAdmin)

/* ==========================================================
   一、概览数据
   ========================================================== */

/**
 * GET /api/admin/stats
 * 后台首页那四个数字块。
 * 注意 SUM() 在没有数据时返回 NULL 而不是 0，所以要 COALESCE 兜一下，
 * 否则前端拿到 null 会显示成 "null"。
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [[postRow]] = await pool.query(`
      SELECT COUNT(*) AS postCount,
             COALESCE(SUM(views), 0) AS viewSum,
             COALESCE(SUM(like_count), 0) AS likeSum
      FROM posts
    `)

    const [[commentRow]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM comments
    `)

    res.json({
      code: 0,
      data: {
        postCount: Number(postRow.postCount),
        viewSum: Number(postRow.viewSum),
        likeSum: Number(postRow.likeSum),
        commentCount: Number(commentRow.total)
      }
    })
  } catch (err) {
    next(err)
  }
})

/* ==========================================================
   二、文章管理
   ========================================================== */

/**
 * GET /api/admin/posts
 * 管理视角的文章列表。
 * 和前台 /api/posts 的区别：这里要看到全部字段（包括 visibility），
 * 前台那个只看得到公开的展示信息。
 * 依然不查 content——列表不需要正文，编辑正文是另一个页面的事。
 */
router.get('/posts', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, summary, category, type, visibility, views,
             like_count AS likeCount, created_at AS createdAt
      FROM posts
      ORDER BY created_at DESC
    `)

    res.json({ code: 0, data: rows })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/admin/posts/:id
 * 后台取单篇全文，给编辑页用。
 * 和前台的详情接口不同：这里不做 visibility 判断（管理员本来就能看全文），
 * 也不会给浏览数 +1 —— 编辑时预览一次就涨一次阅读量，那数字就没意义了。
 */
router.get('/posts/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '文章 id 不合法' })
    }

    const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [id])
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '文章不存在' })
    }

    const p = rows[0]
    res.json({
      code: 0,
      data: {
        id: p.id,
        title: p.title,
        summary: p.summary,
        category: p.category,
        type: p.type,
        content: p.content,
        visibility: p.visibility,
        views: p.views,
        likeCount: p.like_count,
        createdAt: p.created_at
      }
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/posts
 * 新建文章。
 *
 * 摘要允许留空：留空时自动从正文里截一段（去掉 Markdown 符号），
 * 省得作者每次都要手写一遍摘要。
 */
router.post('/posts', async (req, res, next) => {
  try {
    const body = req.body || {}

    const title = String(body.title || '').trim()
    if (!title || title.length > 120) {
      return res.status(400).json({ code: 400, message: '标题不能为空且不超过 120 字' })
    }

    const category = String(body.category || '').trim()
    if (!category || category.length > 20) {
      return res.status(400).json({ code: 400, message: '分类不能为空且不超过 20 字' })
    }

    const content = String(body.content || '')
    if (!content.trim()) {
      return res.status(400).json({ code: 400, message: '正文不能为空' })
    }
    if (content.length > 50000) {
      return res.status(400).json({ code: 400, message: '正文太长了，最多 5 万字符' })
    }

    const visibility = body.visibility === 'member' ? 'member' : 'public'
    const type = body.type === 'note' ? 'note' : 'post'

    // 摘要留空就从正文自动截一段
    let summary = String(body.summary || '').trim()
    if (!summary) {
      summary = content
        .replace(/^#{1,6}\s+/gm, '') // 去掉标题符号
        .replace(/[*_`>~\-]/g, '') // 去掉常见 Markdown 标记
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100)
    }
    if (summary.length > 300) {
      summary = summary.slice(0, 300)
    }

    const [result] = await pool.query(
      `INSERT INTO posts (title, summary, category, type, content, visibility)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, summary, category, type, content, visibility]
    )

    res.json({ code: 0, data: { id: result.insertId } })
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /api/admin/posts/:id
 * 修改文章，包括正文。
 *
 * 白名单是关键：只允许改 title / summary / category / visibility / content / type。
 * 如果直接把 req.body 拼进 UPDATE，别人传个 { views: 999999 } 就能刷阅读数，
 * 这叫「批量赋值漏洞」，是最常见的接口安全问题之一。
 */
router.put('/posts/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '文章 id 不合法' })
    }

    const body = req.body || {}
    const fields = []
    const params = []

    // 逐个检查，只有真正传了的字段才更新。
    // 这样前端可以只发一个 { visibility: 'member' }，不用把整篇文章回传。
    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (!title || title.length > 120) {
        return res.status(400).json({ code: 400, message: '标题不能为空且不超过 120 字' })
      }
      fields.push('title = ?')
      params.push(title)
    }

    if (body.summary !== undefined) {
      const summary = String(body.summary).trim()
      if (summary.length > 300) {
        return res.status(400).json({ code: 400, message: '摘要最多 300 字' })
      }
      fields.push('summary = ?')
      params.push(summary)
    }

    if (body.category !== undefined) {
      const category = String(body.category).trim()
      if (!category || category.length > 20) {
        return res.status(400).json({ code: 400, message: '分类不能为空且不超过 20 字' })
      }
      fields.push('category = ?')
      params.push(category)
    }

    if (body.visibility !== undefined) {
      const visibility = String(body.visibility)
      // 数据库这一列是 ENUM('public','member')，传别的值 MySQL 会报错，
      // 但提前拦住能给出更友好的提示
      if (visibility !== 'public' && visibility !== 'member') {
        return res.status(400).json({ code: 400, message: 'visibility 只能是 public 或 member' })
      }
      fields.push('visibility = ?')
      params.push(visibility)
    }

    if (body.type !== undefined) {
      const type = String(body.type)
      if (type !== 'post' && type !== 'note') {
        return res.status(400).json({ code: 400, message: 'type 只能是 post 或 note' })
      }
      fields.push('type = ?')
      params.push(type)
    }

    if (body.content !== undefined) {
      const content = String(body.content)
      if (!content.trim()) {
        return res.status(400).json({ code: 400, message: '正文不能为空' })
      }
      if (content.length > 50000) {
        return res.status(400).json({ code: 400, message: '正文太长了，最多 5 万字符' })
      }
      fields.push('content = ?')
      params.push(content)
    }

    if (fields.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }

    params.push(id)
    const [result] = await pool.query(
      `UPDATE posts SET ${fields.join(', ')} WHERE id = ?`,
      params
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '文章不存在' })
    }

    res.json({ code: 0, data: { id } })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/admin/posts/:id
 * 删文章。
 * comments 和 likes 建表时写了 ON DELETE CASCADE，
 * 所以这里删一条，关联的留言和点赞会被 MySQL 自动清掉，不用手动删三张表。
 */
router.delete('/posts/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '文章 id 不合法' })
    }

    const [result] = await pool.query('DELETE FROM posts WHERE id = ?', [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '文章不存在' })
    }

    res.json({ code: 0, data: { id } })
  } catch (err) {
    next(err)
  }
})

/* ==========================================================
   三、留言管理
   ========================================================== */

/**
 * GET /api/admin/comments
 * 留言列表，按时间倒序。
 *
 * 审核已经停用，所以这里不再有 status 筛选项，
 * 后台就干两件事：看全量、删掉不该留的。
 */
router.get('/comments', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id,
             c.content,
             c.status,
             c.post_id AS postId,
             c.parent_id AS parentId,
             c.reply_to_user_id AS replyToId,
             c.created_at AS createdAt,
             u.id AS userId,
             u.username AS nickname,
             p.title AS postTitle,
             pu.username AS replyToName
      FROM comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN posts p ON c.post_id = p.id
      LEFT JOIN users pu ON c.reply_to_user_id = pu.id
      ORDER BY c.created_at DESC
    `)

    res.json({ code: 0, data: rows })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/comments/batch-delete
 * 批量删除留言。body: { ids: [3, 7, 12] }
 *
 * 为什么用 POST 而不是 DELETE：
 * DELETE 带 body 在部分代理/网关下会被丢掉，兼容性不稳。
 * 这里用 POST + 明确的动作名，语义清楚也不会踩坑。
 *
 * 注意 affectedRows 只统计**直接删掉的行**。
 * 如果选中的是父留言，它下面的回复会被外键 CASCADE 一起删，
 * 但不计入这个数字 —— 前端提示要说清楚这一点。
 */
router.post('/comments/batch-delete', async (req, res, next) => {
  try {
    const raw = req.body && req.body.ids

    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ code: 400, message: '请选择要删除的留言' })
    }
    if (raw.length > 100) {
      return res.status(400).json({ code: 400, message: '一次最多删除 100 条' })
    }

    // 逐个校验并去重：不能相信前端传来的数组里都是合法 id
    const ids = [...new Set(raw.map(Number))]
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({ code: 400, message: '留言 id 不合法' })
    }

    // mysql2 遇到数组会自动展开成 ?, ?, ?，不用手拼字符串
    const [result] = await pool.query('DELETE FROM comments WHERE id IN (?)', [ids])

    res.json({ code: 0, data: { requested: ids.length, deleted: result.affectedRows } })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/admin/comments/:id
 * 删除留言。这个是真删，不是把 status 改成某个「已删除」状态。
 * 个人博客的留言量小，不需要软删除。
 */
router.delete('/comments/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '留言 id 不合法' })
    }

    const [result] = await pool.query('DELETE FROM comments WHERE id = ?', [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '留言不存在' })
    }

    res.json({ code: 0, data: { id } })
  } catch (err) {
    next(err)
  }
})

/* ==========================================================
   四、账号管理
   ========================================================== */

/**
 * GET /api/admin/users
 * 用户列表，带每个人的留言数。
 *
 * LEFT JOIN 而不是 INNER JOIN：一条留言都没发过的用户也必须列出来。
 * 用 INNER JOIN 会把刚注册、还没说话的人直接过滤掉，等于看不见新用户。
 * COUNT(c.id) 配 LEFT JOIN，没留言时算出来是 0（COUNT(*) 会是 1）。
 */
router.get('/users', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id,
             u.username,
             u.role,
             u.is_owner AS isOwner,
             u.created_at AS createdAt,
             COUNT(c.id) AS commentCount
      FROM users u
      LEFT JOIN comments c ON c.user_id = u.id
      GROUP BY u.id, u.username, u.role, u.is_owner, u.created_at
      ORDER BY u.role ASC, u.id ASC
    `)

    res.json({
      code: 0,
      data: rows.map((u) => ({
        ...u,
        commentCount: Number(u.commentCount),
        // 统一成布尔，前端 v-if 直接写 user.isOwner 就行
        isOwner: Number(u.isOwner) === 1
      }))
    })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/admin/users/:id
 * 改角色。body: { role: 'admin' | 'reader' }
 *
 * 四条保护，都是为了不让人把后台的钥匙弄丢：
 *   1. 不能改自己的角色 —— 手滑把自己降成 reader，就再也进不来后台了
 *   2. 不能改主管理员的角色 —— 这是修复过的漏洞：以前只要「还剩一个管理员」就放行，
 *      于是 A 被设为管理员之后，反手就能把主管理员降成读者，后台直接易主
 *   3. 不能把最后一个管理员降级 —— 那样全站再没有能管后台的人
 *   4. 角色只能是这两个固定值
 *
 * 第 2 条为什么这么严格（连主管理员自己都改不了自己）：
 *   根账号的角色是这套系统的最后一道保险，它应该是「不可变」的，
 *   而不是「只有某个人能改」。真要换人，走数据库/运维操作，
 *   那种操作会留下记录，也不会被一次误点触发。
 */
router.patch('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '用户 id 不合法' })
    }

    const role = String((req.body && req.body.role) || '')
    if (role !== 'admin' && role !== 'reader') {
      return res.status(400).json({ code: 400, message: 'role 只能是 admin 或 reader' })
    }

    // req.user 来自 token，就是当前操作者
    if (id === req.user.id) {
      return res.status(400).json({ code: 400, message: '不能修改自己的角色' })
    }

    // 注意这里要查 is_owner：判断「能不能动这个人」靠的是数据库里的身份，
    // 不是前端传上来的任何东西。前端隐藏按钮只是体验，真正的门在这里。
    const [rows] = await pool.query(
      'SELECT id, role, is_owner AS isOwner FROM users WHERE id = ?',
      [id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    const target = rows[0]

    // 主管理员是根账号，任何人都不能改它的角色（包括同样是管理员的人）
    if (Number(target.isOwner) === 1) {
      return res.status(403).json({
        code: 403,
        message: '主管理员账号受保护，不能修改其角色'
      })
    }

    // 要降级的是个管理员，就得先确认降完之后还剩不剩别的管理员
    if (target.role === 'admin' && role === 'reader') {
      const [[{ otherAdmins }]] = await pool.query(
        'SELECT COUNT(*) AS otherAdmins FROM users WHERE role = ? AND id <> ?',
        ['admin', id]
      )
      if (Number(otherAdmins) === 0) {
        return res.status(400).json({
          code: 400,
          message: '这是最后一个管理员，不能降级'
        })
      }
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id])

    res.json({ code: 0, data: { id, role } })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/admin/users/:id
 * 删用户。保护三条：不能删自己、不能删主管理员、不能删最后一个管理员。
 *
 * 主管理员这一条和第 3 条不是重复的：
 *   主管理员被降级还能救回来（改库或者用另一个管理员升回去），
 *   但主管理员被删掉就彻底没有了 —— 账号连同他发过的留言一起消失，
 *   这个后果比降级更重，所以单独拦一次。
 *
 * 注意：comments 的外键是 ON DELETE CASCADE，
 * 删掉用户会连带删掉他发过的全部留言，所以返回值里带上被删的留言条数，
 * 前端可以明确告诉用户「顺带删了几条留言」。
 */
router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '用户 id 不合法' })
    }

    if (id === req.user.id) {
      return res.status(400).json({ code: 400, message: '不能删除自己的账号' })
    }

    const [rows] = await pool.query(
      'SELECT id, role, is_owner AS isOwner FROM users WHERE id = ?',
      [id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    if (Number(rows[0].isOwner) === 1) {
      return res.status(403).json({
        code: 403,
        message: '主管理员账号受保护，不能删除'
      })
    }

    if (rows[0].role === 'admin') {
      const [[{ otherAdmins }]] = await pool.query(
        'SELECT COUNT(*) AS otherAdmins FROM users WHERE role = ? AND id <> ?',
        ['admin', id]
      )
      if (Number(otherAdmins) === 0) {
        return res.status(400).json({
          code: 400,
          message: '这是最后一个管理员，不能删除'
        })
      }
    }

    // 先数一下会连带删掉多少条留言，删完就数不到了
    const [[{ commentCount }]] = await pool.query(
      'SELECT COUNT(*) AS commentCount FROM comments WHERE user_id = ?',
      [id]
    )

    await pool.query('DELETE FROM users WHERE id = ?', [id])

    res.json({ code: 0, data: { id, deletedComments: Number(commentCount) } })
  } catch (err) {
    next(err)
  }
})

export default router
