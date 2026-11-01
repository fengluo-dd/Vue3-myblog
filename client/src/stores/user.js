import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

// 存 localStorage 的键名。集中放这里，改的时候只改一处
const TOKEN_KEY = 'blog_token'
const USER_KEY = 'blog_user'

// localStorage 里的内容可能是坏的（手动改过、旧版本格式），
// JSON.parse 遇到坏数据会直接抛错，所以兜一层
function readUserFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

/**
 * 判断 token 是否已过期。
 *
 * 为什么要专门做这件事：localStorage 里有 token，不等于 token 还有效。
 * 守卫如果只看「有没有值」，一个过期 token 也能把人放进后台，
 * 然后页面上每个请求都 401，满屏「登录已过期」——比直接拦下来更糟。
 *
 * JWT 的第二段是 payload，base64url 编码（不是加密，谁都能解）。
 * 这里只取 exp 做时间比较，不验签名——验签名是服务端的事，
 * 前端验了也没意义，因为整段 token 都能被伪造。
 */
export function isTokenExpired(token) {
  if (!token) return true

  const parts = token.split('.')
  if (parts.length !== 3) return true

  try {
    // base64url 用的是 - 和 _，atob 只认 + 和 /，还得补上 = 填充
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = (4 - (base64.length % 4)) % 4
    base64 += '='.repeat(pad)

    const raw = atob(base64)

    // 不用 JSON.parse：payload 里如果有中文（比如用户名），
    // atob 得到的是二进制字符串，直接 parse 会乱码甚至抛错。
    // 正则只在 ASCII 结构里找 exp，不受中文影响。
    const match = /"exp"\s*:\s*(\d+)/.exec(raw)
    if (!match) return false // 没有 exp 字段，判断不了，交给服务端

    return Number(match[1]) * 1000 <= Date.now()
  } catch {
    // 解不开说明是个畸形 token，当成无效处理
    return true
  }
}

export const useUserStore = defineStore('user', () => {
  // 初始值直接从 localStorage 读，刷新页面不会掉登录状态
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref(readUserFromStorage())

  const isLoggedIn = computed(() => Boolean(token.value && user.value))
  const isAdmin = computed(() => Boolean(user.value && user.value.role === 'admin'))

  // 登录/注册成功后调它：内存和 localStorage 一起写
  function setAuth(payload) {
    token.value = payload.token
    user.value = payload.user
    localStorage.setItem(TOKEN_KEY, payload.token)
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
  }

  // 退出登录，或 token 失效时清理
  function clearAuth() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isLoggedIn, isAdmin, setAuth, clearAuth }
})
