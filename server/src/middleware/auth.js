import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config.js'
import { pool } from '../db.js'

// 校验用的密钥必须和签发时完全一致，所以和 routes/auth.js 共用 config.js 里的同一个值
const SECRET = JWT_SECRET

/**
 * 可选认证：带了合法 token 就解析出用户，没带或 token 过期也放行。
 * 用在「登录与否都能看，但登录后能多看一点」的接口上，比如文章详情。
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  req.user = null

  if (token) {
    try {
      // verify 会同时校验签名和过期时间，过期了会抛错
      req.user = jwt.verify(token, SECRET)
    } catch {
      // token 伪造或过期，当成未登录处理，不报错打断请求
      req.user = null
    }
  }

  next()
}

/**
 * 强制认证：没登录直接 401。
 * 用在留言、后台这类必须有身份的接口上。
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ code: 401, message: '请先登录' })
  }

  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ code: 401, message: '登录已过期，请重新登录' })
  }
}

/**
 * 管理员认证：先过 requireAuth，再看 role。
 *
 * 为什么不写成 requireAuth 里加个参数？
 * 因为「没登录」(401) 和「登录了但不是管理员」(403) 是两种完全不同的情况：
 * 前者应该引导去登录，后者应该直接拦住。前端要靠状态码区分。
 *
 * 这里把 requireAuth 当函数直接调用，传一个「认证通过后」的回调进去，
 * 是 Express 中间件之间互相复用的常见写法。
 *
 * 为什么要拿 role 再查一次库，而不是直接信 token 里的 role？
 *   token 里的 role 是**签发那一刻的快照**，签发之后角色变了它不会跟着变。
 *   于是会出现这种情况：某人被降成 reader 了，他手里那张还没过期的 token
 *   依然能进后台、依然能调管理接口 —— 最长能撑 7 天。
 *   这就是权限系统里典型的「陈旧凭证」问题，解决办法只有一条：
 *   权限判断永远以数据库当前状态为准，token 只用来证明「你是谁」，不用来证明「你能干什么」。
 *
 * 代价是后台每个请求多一次主键查询。个人博客的量级完全可以接受。
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const [rows] = await pool.query(
        'SELECT id, username, role, is_owner AS isOwner FROM users WHERE id = ?',
        [req.user.id]
      )

      // 人已经被删了，token 还没过期
      if (rows.length === 0) {
        return res.status(401).json({ code: 401, message: '账号不存在，请重新登录' })
      }

      const current = rows[0]
      if (current.role !== 'admin') {
        return res.status(403).json({ code: 403, message: '需要管理员权限' })
      }

      // 用库里的最新状态覆盖 req.user，后面的接口拿到的就是实时角色
      req.user = {
        id: current.id,
        username: current.username,
        role: current.role,
        // mysql2 取 TINYINT 得到的是数字，统一转成布尔，前端判断更好写
        isOwner: Number(current.isOwner) === 1
      }

      next()
    } catch (err) {
      next(err)
    }
  })
}
