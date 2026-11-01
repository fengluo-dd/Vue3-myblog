import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { createCaptcha, verifyCaptcha } from '../utils/captcha.js'

const router = Router()

// 密钥和有效期统一从 config.js 拿。
// config.js 会在缺失时直接终止进程，不会退回任何默认字符串。
const SECRET = JWT_SECRET
const EXPIRES_IN = JWT_EXPIRES_IN

/* ---------- 限流规则 ---------- */

// 注册：10 分钟内同一 IP 最多 5 次。正常人不会连着注册 5 个号。
const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: '注册太频繁了'
})

// 登录：5 分钟内同一 IP 最多 10 次。防暴力猜密码，同时不误伤手滑的正常人。
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: '登录尝试太频繁了'
})

// 验证码：1 分钟最多 30 张。生成 SVG 要算字符和路径，不限流会被人刷 CPU。
const captchaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: '刷新太频繁了'
})

// 签发 token。payload 只放身份标识，绝不放密码。
// 注意 JWT 的 payload 只是 base64 编码，不是加密，谁拿到都能解开看。
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: EXPIRES_IN }
  )
}

/**
 * GET /api/auth/captcha
 * 返回一张图形验证码：{ id, svg }
 * 前端把 svg 直接塞进页面，提交注册时把 id 和用户输入的字符一起带上。
 */
router.get('/captcha', captchaLimiter, (req, res) => {
  const { id, svg } = createCaptcha()
  res.json({ code: 0, data: { id, svg } })
})

/**
 * POST /api/auth/register
 * 注册。新用户一律 reader，管理员只能手动在数据库里改。
 *
 * 验证码放在最前面校验，是为了让所有注册请求都必须先过这一关。
 * 代价是：如果用户名已被占用，验证码也被消耗掉了，用户改名后必须刷新一张。
 * 前端在注册失败时会自动换一张，所以体验上感觉不到。
 */
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { username, password, captchaId, captchaCode } = req.body || {}
    const name = String(username || '').trim()
    const pwd = String(password || '')

    if (name.length < 3 || name.length > 20) {
      return res.status(400).json({ code: 400, message: '用户名需要 3 到 20 个字符' })
    }
    if (pwd.length < 6) {
      return res.status(400).json({ code: 400, message: '密码至少 6 位' })
    }

    if (!verifyCaptcha(captchaId, captchaCode)) {
      return res.status(400).json({
        code: 400,
        message: '验证码不对或已过期，换一张再试'
      })
    }

    const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [name])
    if (exists.length > 0) {
      return res.status(409).json({ code: 409, message: '这个用户名已经有人用了' })
    }

    // bcrypt.hash 会自动生成随机盐，同一个密码每次算出来的哈希都不一样
    const hash = await bcrypt.hash(pwd, 10)

    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [name, hash, 'reader']
    )

    const user = { id: result.insertId, username: name, role: 'reader' }

    res.json({ code: 0, data: { token: signToken(user), user } })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/auth/login
 * 登录。
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {}
    const name = String(username || '').trim()
    const pwd = String(password || '')

    if (!name || !pwd) {
      return res.status(400).json({ code: 400, message: '请输入用户名和密码' })
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [name])

    // 用户不存在和密码错误返回同一句话，
    // 否则别人能靠提示语判断出「哪些用户名是注册过的」
    if (rows.length === 0) {
      return res.status(401).json({ code: 401, message: '用户名或密码不对' })
    }

    const record = rows[0]
    const ok = await bcrypt.compare(pwd, record.password_hash)
    if (!ok) {
      return res.status(401).json({ code: 401, message: '用户名或密码不对' })
    }

    const user = { id: record.id, username: record.username, role: record.role }

    res.json({ code: 0, data: { token: signToken(user), user } })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/auth/me
 * 拿当前登录用户。前端刷新页面时用它验证本地 token 还有没有效。
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ code: 0, data: req.user })
})

export default router
