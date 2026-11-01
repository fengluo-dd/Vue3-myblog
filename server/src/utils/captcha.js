import svgCaptcha from 'svg-captcha'
import { randomUUID } from 'node:crypto'

/**
 * 图形验证码
 *
 * 为什么不用纯前端画：前端生成的验证码，答案就在 JS 里，机器人抓一次就破了，
 * 纯粹是给真人添麻烦。验证码的答案必须只存在服务端。
 *
 * 为什么答案存内存而不是数据库：
 *   1. 验证码 5 分钟就过期，是临时数据，写数据库要频繁读写 + 清理
 *   2. 这个项目是单进程，内存够用
 * 代价（要记住）：
 *   - 进程重启，正在填的验证码全部失效（用户刷新一张就行，可接受）
 *   - 将来开多进程/多台机器，A 机器发的码 B 机器认不了，那时要换 Redis
 */

const CHAR_COLOR = '#ece9f5'
const NOISE_COLOR = 'rgba(167, 155, 255, 0.32)'

// id -> { text, expireAt }
const store = new Map()

const TTL = 5 * 60 * 1000 // 5 分钟
const MAX_ENTRIES = 5000 // 上限，防止被刷爆内存

// 定期清过期条目。unref() 让这个定时器不阻止进程退出
const cleaner = setInterval(() => {
  const now = Date.now()
  for (const [id, item] of store) {
    if (item.expireAt <= now) store.delete(id)
  }
}, 60 * 1000)
cleaner.unref?.()

/**
 * 统一字符颜色。
 * svg-captcha 默认给每个字符随机颜色，在深色背景上会出现对比度极低的字符，
 * 真人看着费劲。这里把字符统一改成主文字色、干扰线改成半透明紫，
 * 顺便让验证码和站点配色一致。
 */
function unifyColors(svg) {
  return svg
    .replace(/(<path[^>]*?)fill="#[0-9a-fA-F]{3,6}"/g, `$1fill="${CHAR_COLOR}"`)
    .replace(/stroke="#[0-9a-fA-F]{3,6}"/g, `stroke="${NOISE_COLOR}"`)
}

/**
 * 生成一张验证码
 * @returns {{ id: string, svg: string }}
 */
export function createCaptcha() {
  // 字符集避开 0/o、1/l/I 这些长得像的，减少「我明明输对了」的争吵
  const cap = svgCaptcha.create({
    size: 4,
    ignoreChars: '0oO1lLiI',
    noise: 2,
    width: 132,
    height: 44,
    fontSize: 46,
    background: '#121a3a'
  })

  // 容量保护：满了就从最早的开始删
  if (store.size >= MAX_ENTRIES) {
    let overflow = store.size - MAX_ENTRIES + 1
    for (const key of store.keys()) {
      store.delete(key)
      if (--overflow <= 0) break
    }
  }

  const id = randomUUID()
  store.set(id, {
    text: cap.text.toLowerCase(),
    expireAt: Date.now() + TTL
  })

  return { id, svg: unifyColors(cap.data) }
}

/**
 * 校验验证码
 *
 * 关键设计：**不管对错，校验一次就作废**。
 * 如果错了还能再试，攻击者就能拿同一个 id 暴力枚举 4 位字符（一百多万次总能中）。
 * 作废之后想再试必须重新拉一张图，成本立刻上去了。
 *
 * @returns {boolean}
 */
export function verifyCaptcha(id, code) {
  if (!id || !code) return false

  const item = store.get(String(id))
  if (!item) return false

  // 先删再判，保证一次性
  store.delete(String(id))

  if (item.expireAt <= Date.now()) return false

  return item.text === String(code).trim().toLowerCase()
}
