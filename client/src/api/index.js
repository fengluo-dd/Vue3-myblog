// 所有接口调用都收在这个文件里，页面组件不再直接写 fetch
// 好处：要加 token、要换地址、要统一处理错误，只改这一处

const TOKEN_KEY = 'blog_token'
const USER_KEY = 'blog_user'

// 每次请求都现读 localStorage，而不是从 store 拿，
// 否则 api 和 store 会互相 import 形成循环依赖
function authHeader() {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * token 被服务端拒绝时的处理：清本地登录态 + 通知界面 + 送回登录页。
 *
 * 什么情况会走到这里：
 *   - token 过期了
 *   - token 是伪造的（前端守卫只看 exp，签名是服务端才验的）
 *   - 数据库里这个用户被删了
 *
 * 为什么要清：不清的话界面还显示「已登录」，但每个请求都 401，
 * 用户会一直卡在后台空壳里，不知道发生了什么。
 */
function handleAuthExpired() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)

  // 派个事件让 App.vue 把 Pinia 里的内存状态也清掉。
  // 不在这里直接 import store，是为了避免 api 和 store 互相引用。
  window.dispatchEvent(new Event('auth:expired'))

  // 已经在登录页就别重复跳，免得把用户刚输了一半的表单刷掉
  if (!window.location.hash.startsWith('#/login')) {
    window.location.hash = '#/login'
  }
}

/**
 * 统一处理响应：解析 JSON、判错、401 时清理登录态。
 * 抽出来是因为上传图片那条路径不能用 request()（它写死了 JSON 的 Content-Type），
 * 但错误处理逻辑必须一致。
 */
async function handleResponse(res, path) {
  // 后端出错时也会返回 JSON，但可能是空响应，所以这里兜底成 {}
  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    // 401 且不是登录接口本身：说明手里的 token 不作数了。
    // 登录接口的 401 是「密码错了」，不能当成登录过期处理，否则会清掉刚存的表单状态。
    if (res.status === 401 && !path.startsWith('/auth/')) {
      handleAuthExpired()
    }

    const error = new Error(body.message || `请求失败（${res.status}）`)
    // 把状态码挂在错误对象上，页面就能区分 401（没登录）和 404（找不到）
    error.status = res.status
    throw error
  }

  return body.data
}

/**
 * 统一请求方法
 * 后端返回格式固定是 { code: 0, data: ... } 或 { code: 400, message: '...' }
 */
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(options.headers || {})
    }
  })

  return handleResponse(res, path)
}

/* ---------- 文章 ---------- */

/**
 * 文章列表。
 * @param {string} [category] 分类，传「全部」或不传表示不过滤
 * @param {'post'|'note'} [type] 内容类型：长文 / 随笔，不传表示都要
 */
export function fetchPosts(category, type) {
  const query = new URLSearchParams()
  if (category && category !== '全部') query.set('category', category)
  if (type) query.set('type', type)

  const qs = query.toString()
  return request(`/posts${qs ? `?${qs}` : ''}`)
}

// 详情。带 token 时后端才返回「登录可见」文章的正文
export function fetchPost(id) {
  return request(`/posts/${id}`)
}

// 点赞 / 取消点赞。都要登录，token 由 authHeader 自动带上。
// 后端用 likes 表的唯一索引保证一人一篇只能点一次，重复点不会出错。
export function likePost(id) {
  return request(`/posts/${id}/like`, { method: 'POST' })
}

export function unlikePost(id) {
  return request(`/posts/${id}/like`, { method: 'DELETE' })
}

/* ---------- 留言 / 评论 ---------- */

/**
 * 读取讨论列表。
 * @param {number|string|null} [postId] 不传 = 公共留言板；传了 = 那篇文章下面的评论
 * @returns 顶层留言数组，每条带 replies
 */
export function fetchComments(postId) {
  const qs = postId != null && postId !== '' ? `?postId=${encodeURIComponent(postId)}` : ''
  return request(`/comments${qs}`)
}

/**
 * 发表留言或回复。
 * @param {string} content
 * @param {number|string|null} [postId] 不传 = 发到留言板
 * @param {number|null} [parentId] 传了 = 回复这个楼层
 */
export function createComment(content, postId, parentId) {
  const payload = { content }
  if (postId != null && postId !== '') payload.postId = postId
  if (parentId != null) payload.parentId = parentId

  return request('/comments', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

/* ---------- 登录相关 ---------- */

export function login(username, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
}

// 注册必须带验证码：captchaId 是后端发的那张图的编号，captchaCode 是用户看图输入的字符
export function register(username, password, captchaId, captchaCode) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, captchaId, captchaCode })
  })
}

// 拉一张图形验证码，返回 { id, svg }
export function fetchCaptcha() {
  return request('/auth/captcha')
}

// 验证本地 token 是否还有效，顺便拿到最新用户信息
export function fetchMe() {
  return request('/auth/me')
}

/* ---------- 后台（全部要求管理员身份，token 由 authHeader 自动带上）---------- */

// 概览那四个数字
export function fetchAdminStats() {
  return request('/admin/stats')
}

// 管理视角的文章列表
export function fetchAdminPosts() {
  return request('/admin/posts')
}

// 后台取单篇全文，给编辑页用（不做可见性判断，也不加浏览数）
export function fetchAdminPost(id) {
  return request(`/admin/posts/${id}`)
}

export function createPost(payload) {
  return request('/admin/posts', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

// 改文章。payload 只传要改的字段，比如 { visibility: 'member' }
export function updatePost(id, payload) {
  return request(`/admin/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}

export function deletePost(id) {
  return request(`/admin/posts/${id}`, { method: 'DELETE' })
}

// 后台留言列表（审核已停用，直接全量按时间倒序返回）
export function fetchAdminComments() {
  return request('/admin/comments')
}

export function deleteComment(id) {
  return request(`/admin/comments/${id}`, { method: 'DELETE' })
}

// 批量删除。传 id 数组，后端一次 DELETE ... WHERE id IN (...)
export function deleteComments(ids) {
  return request('/admin/comments/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ ids })
  })
}

/* ---------- 后台：账号管理 ---------- */

export function fetchAdminUsers() {
  return request('/admin/users')
}

// 改角色：role 传 'admin' 或 'reader'
export function updateUserRole(id, role) {
  return request(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  })
}

export function deleteUser(id) {
  return request(`/admin/users/${id}`, { method: 'DELETE' })
}

/* ---------- 相册 ---------- */

export function fetchAlbums() {
  return request('/albums')
}

/**
 * 上传照片。
 * 关键：**不要手动设 Content-Type**。
 * 浏览器要在 header 里自己补 `multipart/form-data; boundary=----xxxx`，
 * 手动写成 "multipart/form-data" 反而会丢掉 boundary，后端解析不出文件。
 */
export function uploadAlbum(file, title, description) {
  const form = new FormData()
  form.append('image', file)
  form.append('title', title)
  form.append('description', description)

  return fetch('/api/admin/albums', {
    method: 'POST',
    headers: authHeader(),
    body: form
  }).then((res) => handleResponse(res, '/admin/albums'))
}

export function deleteAlbum(id) {
  return request(`/admin/albums/${id}`, { method: 'DELETE' })
}
