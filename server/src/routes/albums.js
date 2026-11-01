import { Router } from 'express'
import multer from 'multer'
import { mkdirSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pool } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// 上传目录：server/uploads。不放 public，因为它和前端构建产物是分开的两件事，
// 部署时这个目录要单独挂持久化盘
export const UPLOAD_DIR = join(process.cwd(), 'uploads')
mkdirSync(UPLOAD_DIR, { recursive: true })

/**
 * 只认这四种图。
 *
 * 两个坑：
 *   1. 不能只看文件后缀。攻击者可以把 .php 改名成 .jpg 传上来。
 *      这里看的是 mimetype（浏览器给的 Content-Type），比后缀可靠。
 *      更严格的做法是读文件头（magic number）确认真是图片，个人博客不做那么重。
 *   2. 保存时的文件名必须自己生成，绝不能用 originalname。
 *      原文件名可能带 ../ 或奇怪字符，直接拼路径就是目录穿越。
 */
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // 扩展名从 mimetype 推，不从原文件名取
    const ext = EXT_BY_MIME[file.mimetype] || '.jpg'
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) {
      return cb(new Error('只支持 JPG / PNG / WebP / GIF 图片'))
    }
    cb(null, true)
  }
})

/* ==========================================================
   前台：相册列表（公开）
   ========================================================== */

/**
 * 这个 router 挂在 /api 上（不是 /api/albums），
 * 因为它同时提供了前台的 /albums 和后台的 /admin/albums，
 * 挂载点只能取公共前缀。
 */

router.get('/albums', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, description, file_name AS fileName, created_at AS createdAt
      FROM albums
      ORDER BY created_at DESC
    `)

    // 前端只需要拼 /uploads/xxx，所以这里给出 url 字段省得每处都拼
    res.json({
      code: 0,
      data: rows.map((r) => ({ ...r, url: `/uploads/${r.fileName}` }))
    })
  } catch (err) {
    next(err)
  }
})

/* ==========================================================
   后台：上传 / 删除
   ========================================================== */

/**
 * POST /api/admin/albums
 * multipart/form-data：image（文件）+ title + description
 *
 * multer 的错误（文件过大、类型不对）会以普通 Error 抛出来，
 * 统一错误处理中间件会把它变成 500，对用户来说太难懂。
 * 这里单独兜一层，转成 400 并给明确信息。
 */
router.post('/admin/albums', requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? '图片太大了，最多 5MB' : err.message
      return res.status(400).json({ code: 400, message })
    }
    next()
  })
}, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择一张图片' })
    }

    const title = String((req.body && req.body.title) || '').trim().slice(0, 120)
    const description = String((req.body && req.body.description) || '').trim().slice(0, 300)

    const [result] = await pool.query(
      'INSERT INTO albums (title, description, file_name) VALUES (?, ?, ?)',
      [title, description, req.file.filename]
    )

    res.json({
      code: 0,
      data: {
        id: result.insertId,
        title,
        description,
        fileName: req.file.filename,
        url: `/uploads/${req.file.filename}`
      }
    })
  } catch (err) {
    // 数据库写失败的话，磁盘上的文件就成了垃圾，顺手删掉
    if (req.file) {
      await unlink(join(UPLOAD_DIR, req.file.filename)).catch(() => {})
    }
    next(err)
  }
})

/**
 * DELETE /api/admin/albums/:id
 * 删记录的同时把磁盘上的图片也删掉，否则 uploads 目录只增不减。
 */
router.delete('/admin/albums/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: '照片 id 不合法' })
    }

    const [rows] = await pool.query('SELECT file_name FROM albums WHERE id = ?', [id])
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '照片不存在' })
    }

    await pool.query('DELETE FROM albums WHERE id = ?', [id])

    // 再删文件。万一文件已经被人手动删了，unlink 会报错，
    // 但记录已经删掉了，这里不该让整个请求失败
    const name = rows[0].file_name
    if (name && !name.includes('..') && !name.includes('/')) {
      await unlink(join(UPLOAD_DIR, name)).catch(() => {})
    }

    res.json({ code: 0, data: { id } })
  } catch (err) {
    next(err)
  }
})

export default router
