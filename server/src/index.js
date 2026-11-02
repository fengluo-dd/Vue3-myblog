import express from 'express'
import cors from 'cors'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import 'dotenv/config'
import postsRouter from './routes/posts.js'
import commentsRouter from './routes/comments.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import albumsRouter, { UPLOAD_DIR } from './routes/albums.js'

const app = express()
const PORT = Number(process.env.PORT || 3000)

// 当前文件所在目录（server/src），用它推算项目根。
// 为什么不用 process.cwd()：cwd 取决于你在哪个目录敲的启动命令，
// 从项目根启动和从 server/ 启动算出来的路径不一样，线上很容易踩这个坑。
// 用 import.meta.url 算出来的路径永远固定，在哪儿启动都对。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(HERE, '..', '..')
const DIST_DIR = join(ROOT_DIR, 'client', 'dist')
const INDEX_HTML = join(DIST_DIR, 'index.html')

// 前端有没有构建过。有就顺便托管，没有就只提供 API。
// 这样开发阶段用 vite dev server 时完全不受影响。
const HAS_DIST = existsSync(INDEX_HTML)

// 开发阶段前端可能直接连 3000，先把跨域放开。
// 部署后前后端同域，其实用不到；留着是为了你本地还能开 5173 调试。
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

// ================= 下面这几段的顺序是设计过的，别随手调换 =================

// 1) API 的 404：只拦 /api 开头
//    必须放在前端托管之前。否则 /api/xxx 这种写错的路径会被下面的前端兜底接住，
//    返回 200 + HTML，调用方拿不到 404，排查接口问题时会被彻底误导。
app.use('/api', (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
})

// 2) 生产环境：托管前端构建产物，让这个进程同时当网站服务器
if (HAS_DIST) {
  app.use(
    express.static(DIST_DIR, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          // index.html 不能缓存：它里面引用的 js/css 文件名带哈希，
          // 一旦发版换了文件名，用户手里缓存的旧 index.html 会去请求不存在的旧文件，页面白屏
          res.setHeader('Cache-Control', 'no-cache')
        } else {
          // 其余静态资源（Vite 打包出来都带内容哈希）可以放心长期缓存
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      }
    })
  )

  // 3) 前端路由兜底：任何没匹配上的请求都返回 index.html
  //    本项目用的是 hash 路由（地址带 #），严格说用不到这段；
  //    但以后若改成 history 路由，少了它刷新页面就会 404。先留着。
  //
  //    必须同时处理 GET 和 HEAD 两种方法：
  //    curl -I、微信抓链接预览、云监控的健康检查发的都是 HEAD，
  //    只写 app.get() 的话这些请求会穿透到最后的 404，看起来像"网站挂了"。
  const sendIndex = (req, res) => res.sendFile(INDEX_HTML)
  app.get('*', sendIndex)
  app.head('*', sendIndex)
} else {
  console.log('[提示] 未找到 client/dist，当前只提供 API 接口')
  console.log('       要预览完整网站，先在 client 目录执行 npm run build')
}

// 4) 最后的兜底 404
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
})

// 统一错误处理：任何路由里 next(err) 都会落到这里
// 注意四个参数一个都不能少，Express 靠参数个数识别错误处理中间件
app.use((err, req, res, next) => {
  console.error('[API ERROR]', err)
  res.status(500).json({ code: 500, message: '服务器内部错误' })
})

// 监听 0.0.0.0 才能被外部访问。只写端口号时 Node 默认也是全监听，
// 但显式写出来更保险，避免某些环境下只绑了 127.0.0.1 导致"本机能开、外面打不开"
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务已启动: http://localhost:${PORT}`)
  console.log(`健康检查:   http://localhost:${PORT}/api/health`)
  if (HAS_DIST) {
    console.log(`已托管前端: ${DIST_DIR}`)
  }
})
