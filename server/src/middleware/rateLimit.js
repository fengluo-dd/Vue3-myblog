/**
 * 极简限流中间件（固定窗口算法）
 *
 * 为什么需要：验证码只能挡住「不会看图识别」的脚本，挡不住直接对着
 * /api/auth/login 灌密码的暴力破解，也挡不住有人反复拉验证码把 CPU 打满。
 * 限流是比验证码更基础的一道防线，两样都要有。
 *
 * 算法：给每个 IP 记一个「窗口开始时间 + 已用次数」。
 * 窗口内超过上限就返回 429，窗口过期就重置。
 *
 * 这个算法的已知缺陷（面试可能会问）：
 *   固定窗口在窗口交界处会「突刺」——第 59 秒打满 10 次，第 61 秒又能打满 10 次，
 *   实际两秒内就过了 20 次。想更精确要用「滑动窗口」或「令牌桶」，实现复杂不少。
 *   对个人博客来说，固定窗口足够。
 *
 * 内存存储的局限，和验证码一样：
 *   - 进程重启计数清零（攻击者重新打满）
 *   - 多进程不共享，每个进程各算各的
 *   真上线且被针对时，应该换成 Redis + 反向代理层限流。
 */
export function rateLimit({
  windowMs = 60 * 1000,
  max = 10,
  message = '操作太频繁，请稍后再试'
} = {}) {
  // ip -> { count, resetAt }
  const hits = new Map()

  // 定期清过期记录，否则每个来过的 IP 都会永久占一条
  const cleaner = setInterval(() => {
    const now = Date.now()
    for (const [ip, rec] of hits) {
      if (rec.resetAt <= now) hits.delete(ip)
    }
  }, Math.max(windowMs, 30 * 1000))
  cleaner.unref?.()

  return function rateLimitMiddleware(req, res, next) {
    // req.ip 在没配 trust proxy 时是 TCP 直连地址。
    // 部署到 Nginx / 云托管后面，要在 Express 里 app.set('trust proxy', 1)，
    // 否则所有请求的 ip 都是反向代理那一台，等于全站共用一个计数器。
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const now = Date.now()

    let rec = hits.get(ip)
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs }
      hits.set(ip, rec)
    }

    rec.count += 1

    if (rec.count > max) {
      const retryAfter = Math.max(1, Math.ceil((rec.resetAt - now) / 1000))
      // Retry-After 是 HTTP 标准头，客户端和爬虫都认
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({
        code: 429,
        message: `${message}（${retryAfter} 秒后再试）`
      })
    }

    next()
  }
}
