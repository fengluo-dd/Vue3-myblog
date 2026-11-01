import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config.js'

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
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '需要管理员权限' })
    }
    next()
  })
}
