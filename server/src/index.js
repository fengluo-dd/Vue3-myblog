import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import postsRouter from './routes/posts.js'
import commentsRouter from './routes/comments.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import albumsRouter, { UPLOAD_DIR } from './routes/albums.js'

const app = express()
const PORT = Number(process.env.PORT || 3000)

// 开发阶段前端可能直接连 3000，先把跨域放开。
// 正式部署时前端和接口同域，这行可以删掉。
app.use(cors())

// 让 express 能解析 JSON 请求体，没有这行 req.body 永远是 undefined
app.use(express.json())

// 路由挂载：/api/posts 交给 postsRouter，/api/comments 交给 commentsRouter
app.use('/api/auth', authRouter)
app.use('/api/posts', postsRouter)
app.use('/api/comments', commentsRouter)
// 后台接口：admin.js 内部第一行就挂了 requireAdmin，整个 /api/admin 都要管理员身份
app.use('/api/admin', adminRouter)
// 相册的 router 同时有前台的 /albums 和后台的 /admin/albums，所以挂在 /api 上
app.use('/api', albumsRouter)

// 上传的图片走静态托管。分开挂 /uploads 而不是塞进 /api，
// 是因为它是静态资源，不该走 JSON 错误处理那一套
app.use('/uploads', express.static(UPLOAD_DIR))

// 健康检查：浏览器打开这个地址能通，说明服务和数据库都活着
app.get('/api/health', async (req, res) => {
  const { pool } = await import('./db.js')
  try {
    await pool.query('SELECT 1')
    res.json({ code: 0, data: { ok: true, db: 'connected', time: new Date().toISOString() } })
  } catch (err) {
    res.status(500).json({ code: 500, message: '数据库连不上：' + err.message })
  }
})

// 兜底 404：上面所有路由都没匹配上
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
})

// 统一错误处理：任何路由里 next(err) 都会落到这里
// 注意四个参数一个都不能少，Express 靠参数个数识别错误处理中间件
app.use((err, req, res, next) => {
  console.error('[API ERROR]', err)
  res.status(500).json({ code: 500, message: '服务器内部错误' })
})

app.listen(PORT, () => {
  console.log(`API server running: http://localhost:${PORT}`)
  console.log(`试一下: http://localhost:${PORT}/api/health`)
})
