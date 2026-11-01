<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fetchCaptcha, login, register } from '../api'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 显示哪个表单完全由路由决定：/login 和 /register 是同一个组件的两个入口。
// 用 computed 而不是本地 ref，URL 和界面就永远不会打架（比如刷新后还停在注册页）。
const isRegister = computed(() => route.meta.mode === 'register')

const username = ref('')
const password = ref('')
const captchaCode = ref('')
const captchaId = ref('')
const captchaSvg = ref('')
const captchaLoading = ref(false)

const submitting = ref(false)
const errorMsg = ref('')

const MIN_PWD = 6

/* ---------- 密码实时提示 ---------- */

/**
 * 用户一边打字一边看到还差几位，不用等点提交才知道不合格。
 * 三个状态：空 / 不够 / 达标。
 *
 * 为什么不用「绿色表示通过」：全站只有橙色一个强调色，
 * 再引入绿色就破坏了配色规则。这里用橙色表示"还没好"，
 * 达标后颜色退回灰色 —— 不需要提醒的时候，就该安静。
 */
const pwdHint = computed(() => {
  const len = password.value.length
  if (len === 0) return { text: `至少 ${MIN_PWD} 位`, state: 'idle' }
  if (len < MIN_PWD) return { text: `还差 ${MIN_PWD - len} 位`, state: 'warn' }
  return { text: '长度达标', state: 'ok' }
})

/* ---------- 验证码 ---------- */

async function loadCaptcha() {
  captchaLoading.value = true
  try {
    const data = await fetchCaptcha()
    captchaId.value = data.id
    captchaSvg.value = data.svg
    captchaCode.value = ''
  } catch {
    captchaSvg.value = ''
    errorMsg.value = '验证码加载失败，点图片重试'
  } finally {
    captchaLoading.value = false
  }
}

// 把 SVG 转成 data URI 交给 <img> 渲染。
// 不用 v-html：img 里的 SVG 只是张静态图，不会执行任何脚本，
// 万一将来后端生成的 SVG 混进奇怪的东西也伤不到页面。
const captchaSrc = computed(() =>
  captchaSvg.value
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg.value)}`
    : ''
)

// 切到注册模式时拉一张；登录模式不用验证码，不浪费请求
watch(
  isRegister,
  (val) => {
    if (val && !captchaSvg.value) loadCaptcha()
  },
  { immediate: true }
)

/* ---------- 提交 ---------- */

async function submit() {
  errorMsg.value = ''

  const name = username.value.trim()
  const pwd = password.value

  if (!name || !pwd) {
    errorMsg.value = '用户名和密码都要填'
    return
  }

  // 注册的两道前置检查。放在这里只为省一次网络往返，
  // 真正的把关在后端 —— 前端校验永远只是体验优化。
  if (isRegister.value && pwd.length < MIN_PWD) {
    errorMsg.value = `密码至少 ${MIN_PWD} 位`
    return
  }
  if (isRegister.value && !captchaCode.value.trim()) {
    errorMsg.value = '请输入验证码'
    return
  }

  submitting.value = true
  try {
    // 注册成功后后端也直接返回 token，所以不用再登录一次
    const data = isRegister.value
      ? await register(name, pwd, captchaId.value, captchaCode.value.trim())
      : await login(name, pwd)

    userStore.setAuth(data)

    // 登录前想去哪就回哪（比如点了需要登录的文章被拦下来），没指定就回首页
    router.replace(route.query.redirect || '/')
  } catch (err) {
    errorMsg.value = err.message
    // 验证码一次性作废：这次不管成没成功，后端都已经把它删了。
    // 不换一张的话，用户改完用户名再提交必然报"验证码不对"。
    if (isRegister.value) loadCaptcha()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="container page">
    <div class="auth-wrap">
      <p class="auth-eyebrow">account</p>
      <h1 class="auth-title">{{ isRegister ? '注册一个账号' : '登录' }}</h1>
      <p class="auth-desc">
        {{ isRegister ? '注册后可以读全部文章、在留言板留言。' : '登录后可以读全部文章、在留言板留言。' }}
      </p>

      <!-- 登录 / 注册两个入口。用 RouterLink 而不是按钮，
           这样地址栏会跟着变，/register 可以直接分享给别人 -->
      <div class="auth-tabs">
        <RouterLink
          :to="{ name: 'login', query: route.query }"
          class="auth-tab"
          :class="{ 'is-active': !isRegister }"
        >
          登录
        </RouterLink>
        <RouterLink
          :to="{ name: 'register', query: route.query }"
          class="auth-tab"
          :class="{ 'is-active': isRegister }"
        >
          注册
        </RouterLink>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">用户名</span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="3 到 20 个字符"
          />
        </label>

        <label class="field">
          <span class="field-label">
            密码
            <!-- 实时提示：边打字边告诉你还差点什么 -->
            <span class="pwd-hint" :class="`is-${pwdHint.state}`">{{ pwdHint.text }}</span>
          </span>
          <input
            v-model="password"
            type="password"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            :placeholder="`至少 ${MIN_PWD} 位`"
          />
        </label>

        <!-- 验证码只在注册时出现。登录没有它的意义：
             已有账号的人不需要证明自己是真人，密码本身就是凭证 -->
        <div v-if="isRegister" class="field">
          <span class="field-label">验证码</span>
          <div class="captcha-row">
            <input
              v-model="captchaCode"
              type="text"
              maxlength="4"
              autocomplete="off"
              placeholder="输入图中 4 个字符"
            />
            <button
              type="button"
              class="captcha-box"
              :disabled="captchaLoading"
              aria-label="换一张验证码"
              @click="loadCaptcha"
            >
              <img v-if="captchaSrc" :src="captchaSrc" alt="验证码图片" />
              <span v-else class="captcha-ph">{{ captchaLoading ? '生成中' : '点我加载' }}</span>
            </button>
          </div>
          <p class="captcha-tip">看不清？点图片换一张</p>
        </div>

        <p v-if="errorMsg" class="auth-error">{{ errorMsg }}</p>

        <button class="btn auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? '处理中…' : isRegister ? '注册并登录' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap {
  max-width: 380px;
  margin: 0 auto;
  padding-top: 36px;
}

.auth-eyebrow {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin: 0 0 14px;
}

.auth-title {
  font-size: 28px;
  font-weight: 500;
  margin: 0 0 10px;
}

.auth-desc {
  color: var(--text-dim);
  font-size: 14px;
  margin: 0 0 24px;
}

/* ---------- 登录 / 注册 tab ---------- */
.auth-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 26px;
}

.auth-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-dim);
  transition: color 0.16s ease;
}

.auth-tab:hover {
  color: var(--text);
}

.auth-tab.is-active {
  color: var(--accent);
}

.auth-tab.is-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1.5px;
  background-color: var(--accent);
}

/* ---------- 表单 ---------- */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  color: var(--text-dim);
  letter-spacing: 0.04em;
}

/* 密码长度提示：默认安静，不达标时变橙，达标后退回灰 */
.pwd-hint {
  font-size: 11.5px;
  letter-spacing: 0.02em;
  transition: color 0.16s ease;
}

.pwd-hint.is-idle {
  color: var(--text-faint);
}

.pwd-hint.is-warn {
  color: var(--accent);
}

.pwd-hint.is-ok {
  color: var(--text-faint);
}

.field input {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background-color: rgba(11, 16, 38, 0.55);
  outline: none;
  font-size: 14.5px;
  transition: border-color 0.18s ease;
}

.field input::placeholder {
  color: var(--text-faint);
}

.field input:focus {
  border-color: rgba(240, 168, 104, 0.5);
}

/* ---------- 验证码 ---------- */
.captcha-row {
  display: flex;
  gap: 10px;
}

.captcha-row input {
  flex: 1;
  min-width: 0;
  /* 验证码是大小写字母混合，用等宽字看着更清楚 */
  font-family: var(--font-mono);
  letter-spacing: 0.18em;
}

.captcha-box {
  flex-shrink: 0;
  width: 132px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background-color: var(--surface);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.16s ease;
}

.captcha-box:hover:not(:disabled) {
  border-color: rgba(240, 168, 104, 0.4);
}

.captcha-box:disabled {
  cursor: wait;
}

.captcha-box img {
  width: 100%;
  height: 100%;
  display: block;
}

.captcha-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 12px;
  color: var(--text-faint);
}

.captcha-tip {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-faint);
}

/* ---------- 其他 ---------- */
.auth-error {
  margin: 0;
  font-size: 13px;
  color: var(--accent);
}

.auth-submit {
  width: 100%;
  margin-top: 6px;
}

@media (max-width: 768px) {
  .auth-wrap {
    padding-top: 24px;
  }

  .auth-title {
    font-size: 24px;
  }

  /* 手机上验证码图片缩窄一点，免得输入框只剩一小条 */
  .captcha-box {
    width: 112px;
  }
}
</style>
