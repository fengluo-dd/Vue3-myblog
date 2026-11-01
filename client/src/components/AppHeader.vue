<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'

const route = useRoute()
const userStore = useUserStore()

// 移动端抽屉开关
const drawerOpen = ref(false)

// 退出登录：只清本地状态。
// token 是无状态的，服务端没有会话可销毁，过期时间到了自然失效。
function logout() {
  userStore.clearAuth()
  drawerOpen.value = false
}

// 导航项集中在一处维护，模板里循环渲染，改动只改这里
const navs = [
  { key: 'home', label: '首页', to: '/' },
  { key: 'posts', label: '博文', to: '/posts' },
  { key: 'notes', label: '随笔', to: '/notes' },
  { key: 'albums', label: '相册', to: '/albums' },
  { key: 'guestbook', label: '留言板', to: '/guestbook' },
  { key: 'about', label: '关于我', to: '/about' }
]

// 进到文章详情（/post/1）时高亮「博文」而不是首页：
// 读者是从博文列表点进去的，亮在博文那边更符合他脑子里的位置
const isActive = (key) => {
  const path = route.path
  if (key === 'home') return path === '/'
  if (key === 'posts') return path === '/posts' || path.startsWith('/post/')
  if (key === 'notes') return path.startsWith('/notes')
  if (key === 'albums') return path.startsWith('/albums')
  if (key === 'guestbook') return path.startsWith('/guestbook')
  if (key === 'about') return path.startsWith('/about')
  return false
}

// 路由一变就收起抽屉，否则点完链接菜单还挂在那儿
watch(() => route.path, () => {
  drawerOpen.value = false
})
</script>

<template>
  <!-- 两个根节点：header 需要 sticky 自己的定位，
       抽屉必须放外面，否则会被 backdrop-filter 拽成相对 header 定位 -->
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-name">枫落</span>
        <span class="brand-sub">margin notes</span>
      </RouterLink>

      <div class="header-right">
        <nav class="nav">
          <RouterLink
            v-for="item in navs"
            :key="item.key"
            :to="item.to"
            class="nav-link"
            :class="{ 'is-active': isActive(item.key) }"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="account">
          <template v-if="userStore.isLoggedIn">
            <!-- 后台入口只给管理员看，普通读者连这个按钮都见不到 -->
            <RouterLink v-if="userStore.isAdmin" to="/admin" class="account-btn is-admin">
              后台
            </RouterLink>
            <span class="account-name">{{ userStore.user.username }}</span>
            <button class="account-btn" @click="logout">退出</button>
          </template>
          <!-- 未登录：登录旁边给一个注册入口。
               注册是新访客的第一个动作，只留「登录」会让人以为没有注册通道 -->
          <template v-else>
            <RouterLink to="/login" class="account-btn">登录</RouterLink>
            <RouterLink to="/register" class="account-btn is-register">注册</RouterLink>
          </template>
        </div>

        <button
          class="menu-btn"
          :class="{ 'is-open': drawerOpen }"
          :aria-expanded="drawerOpen"
          aria-label="导航菜单"
          @click="drawerOpen = !drawerOpen"
        >
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  </header>

  <nav class="drawer" :class="{ 'is-open': drawerOpen }">
    <RouterLink
      v-for="item in navs"
      :key="item.key"
      :to="item.to"
      class="drawer-link"
      :class="{ 'is-active': isActive(item.key) }"
    >
      {{ item.label }}
    </RouterLink>

    <div class="drawer-divider"></div>

    <template v-if="userStore.isLoggedIn">
      <div class="drawer-user">
        <span class="drawer-user-name">{{ userStore.user.username }}</span>
        <span class="drawer-user-role">
          {{ userStore.user.role === 'admin' ? '管理员' : '读者' }}
        </span>
      </div>
      <RouterLink v-if="userStore.isAdmin" to="/admin" class="drawer-link is-admin">
        后台管理
      </RouterLink>
      <button class="drawer-link drawer-logout" @click="logout">退出登录</button>
    </template>
    <template v-else>
      <RouterLink to="/login" class="drawer-link">登录</RouterLink>
      <RouterLink to="/register" class="drawer-link is-register">注册</RouterLink>
    </template>
  </nav>
</template>

<style scoped>
/* ==========================================================
   顶部导航 + 移动端抽屉
   ========================================================== */
.site-header {
  position: sticky;
  top: 0;
  z-index: 30;
  background-color: rgba(11, 16, 38, 0.78);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: 64px;
}

/* 右侧整组：导航 + 账号 + 汉堡，手机上导航和账号都会藏起来 */
.header-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.account {
  display: flex;
  align-items: center;
  gap: 10px;
}

.account-name {
  font-size: 13px;
  color: var(--text-dim);
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-btn {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--line);
  background-color: transparent;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-dim);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease;
}

.account-btn:hover {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.35);
}

/* 后台入口：管理员专属，给一点橙色让它显眼但不刺眼 */
.account-btn.is-admin {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.32);
  background-color: var(--accent-dim);
}

/* 注册：比「登录」更主动一点，但不用实心橙，免得抢走页面焦点 */
.account-btn.is-register {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.35);
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.brand-name {
  font-family: var(--font-cn);
  font-size: 19px;
  font-weight: 500;
  letter-spacing: 0.16em;
}

/* 站名的英文副标题用等宽，终端味的第一个落点 */
.brand-sub {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.nav {
  display: flex;
  gap: 4px;
}

.nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--text-dim);
  border-radius: 6px;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.nav-link:hover {
  color: var(--text);
  background-color: rgba(167, 155, 255, 0.06);
}

/* 当前页：唯一允许使用强调色的地方之一 */
.nav-link.is-active {
  color: var(--accent);
}

.nav-link.is-active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 8px;
  height: 1.5px;
  background-color: var(--accent);
}

/* 汉堡按钮：默认隐藏，手机上才出现 */
.menu-btn {
  display: none;
  width: 44px;
  height: 44px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background-color: transparent;
  cursor: pointer;
  padding: 0;
  position: relative;
}

.menu-btn span {
  position: absolute;
  left: 13px;
  width: 16px;
  height: 1.5px;
  background-color: var(--text);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.menu-btn span:nth-child(1) {
  top: 17px;
}

.menu-btn span:nth-child(2) {
  top: 23px;
}

.menu-btn.is-open span:nth-child(1) {
  transform: translateY(3px) rotate(45deg);
}

.menu-btn.is-open span:nth-child(2) {
  transform: translateY(-3px) rotate(-45deg);
}

/* 抽屉：放在 header 外面，否则 backdrop-filter 会让 fixed 相对 header 定位 */
.drawer {
  display: none;
  position: fixed;
  top: 72px;
  right: 16px;
  z-index: 40;
  min-width: 176px;
  padding: 8px;
  background-color: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 16px 40px rgba(4, 7, 20, 0.6);
}

.drawer-link {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 14.5px;
  color: var(--text-dim);
}

.drawer-link.is-active {
  color: var(--accent);
  background-color: var(--accent-dim);
}

.drawer-link.is-admin {
  color: var(--accent);
}

.drawer-link.is-register {
  color: var(--accent);
}

.drawer-divider {
  height: 1px;
  background-color: var(--line);
  margin: 6px 6px;
}

.drawer-user {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 14px 6px;
}

.drawer-user-name {
  font-size: 14px;
  color: var(--text);
}

.drawer-user-role {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

.drawer-logout {
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14.5px;
}

@media (max-width: 768px) {
  .nav {
    display: none;
  }

  /* 账号信息收进抽屉，header 只留品牌 + 汉堡 */
  .account {
    display: none;
  }

  .menu-btn {
    display: block;
  }

  .drawer {
    display: flex;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-8px);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }

  .drawer.is-open {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .header-inner {
    height: 58px;
  }

  .brand-name {
    font-size: 17px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-link {
    transition: none;
  }
}
</style>
