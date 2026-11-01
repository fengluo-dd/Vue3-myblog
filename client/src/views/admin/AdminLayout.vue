<script setup>
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 左侧导航。code 是纯装饰的序号，让侧栏有终端面板的秩序感
const navs = [
  { to: '/admin', label: '概览', code: '01' },
  { to: '/admin/posts', label: '文章', code: '02' },
  { to: '/admin/comments', label: '留言', code: '03' },
  { to: '/admin/albums', label: '相册', code: '04' },
  { to: '/admin/users', label: '账号', code: '05' }
]

// 概览是 /admin，它是其他页面的前缀，
// 所以不能简单用 startsWith 判断，否则停在文章页时「概览」也会亮
function isActive(to) {
  return to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)
}

function logout() {
  userStore.clearAuth()
  router.replace('/')
}
</script>

<template>
  <div class="admin">
    <aside class="side">
      <div class="side-top">
        <RouterLink to="/admin" class="brand">
          <span class="brand-name">枫落</span>
          <span class="brand-tag">admin</span>
        </RouterLink>
      </div>

      <nav class="side-nav">
        <RouterLink
          v-for="item in navs"
          :key="item.to"
          :to="item.to"
          class="side-link"
          :class="{ 'is-active': isActive(item.to) }"
        >
          <span class="side-code">{{ item.code }}</span>
          <span class="side-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="side-foot">
        <RouterLink to="/" class="foot-link">← 回到前台</RouterLink>
        <button class="foot-link" @click="logout">退出登录</button>
      </div>
    </aside>

    <div class="admin-main">
      <!-- 子页面渲染在这里。切子路由时侧栏不重建，只有这块换 -->
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
/* ==========================================================
   后台外壳：左侧固定侧栏 + 右侧内容区
   桌面用两列 grid，手机降级成「顶部横条 + 单列内容」
   ========================================================== */

.admin {
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  min-height: 100vh;
  background-color: var(--bg-deep);
}

/* minmax(0, 1fr) 而不是 1fr：
   1fr 的最小值是 auto，遇到长代码块/长单词会把整列撑宽，页面横向溢出。
   写成 minmax(0, 1fr) 才能让列真正可以被压缩。 */

/* ---------- 侧栏 ---------- */
.side {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 22px 14px 18px;
  background-color: rgba(8, 12, 29, 0.7);
  border-right: 1px solid var(--line);
}

.side-top {
  padding: 0 10px 22px;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.brand-name {
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.16em;
}

.brand-tag {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-faint);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 1px 5px;
}

/* ---------- 导航 ---------- */
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.side-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-dim);
  transition: color 0.16s ease, background-color 0.16s ease;
}

.side-link:hover {
  color: var(--text);
  background-color: rgba(167, 155, 255, 0.06);
}

.side-link.is-active {
  color: var(--accent);
  background-color: var(--accent-dim);
}

/* 当前页左侧那条橙色竖线：比整块高亮更克制 */
.side-link.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 11px;
  bottom: 11px;
  width: 2px;
  border-radius: 2px;
  background-color: var(--accent);
}

.side-code {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.side-link.is-active .side-code {
  color: rgba(240, 168, 104, 0.6);
}

.side-label {
  flex: 1;
}

/* ---------- 侧栏底部 ---------- */
.side-foot {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.foot-link {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: none;
  font-size: 12.5px;
  color: var(--text-faint);
  cursor: pointer;
  text-align: left;
  transition: color 0.16s ease;
}

.foot-link:hover {
  color: var(--text-dim);
}

/* ---------- 内容区 ---------- */
.admin-main {
  min-width: 0;
  padding: 30px 34px 56px;
}

/* ---------- 手机 ---------- */
@media (max-width: 768px) {
  /* 手机上从 grid 退回普通文档流。
     原因：grid 的 align-content 默认会拉伸行高，把 min-height:100vh 多出来的空间
     分配进第一行，结果顶部导航条下方凭空多出上百像素空白。
     内容多的页面看不出来（内容本来就超过一屏），留言只有一条时特别明显。 */
  .admin {
    display: block;
  }

  /* 手机上侧栏变成顶部横条，跟着页面滚动时吸顶 */
  .side {
    position: sticky;
    top: 0;
    z-index: 20;
    height: auto;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'brand back'
      'nav   out';
    align-items: center;
    gap: 6px 10px;
    padding: 10px 14px;
    border-right: none;
    border-bottom: 1px solid var(--line);
    background-color: rgba(8, 12, 29, 0.92);
    backdrop-filter: blur(12px);
  }

  .side-top {
    grid-area: brand;
    padding: 0;
  }

  .side-nav {
    grid-area: nav;
    flex-direction: row;
    gap: 4px;
    /* 5 个入口 + 右侧退出按钮挤在一行，不给最小宽度的话
       flex 会把每个压到比汉字还窄，中文就变成竖排单字 */
    overflow-x: auto;
    scrollbar-width: none;
  }

  .side-nav::-webkit-scrollbar {
    display: none;
  }

  .side-link {
    min-height: 40px;
    padding: 0 10px;
    font-size: 13px;
    /* nowrap + 不收缩：宁可让整行横向滚动，也别把「概览」折成两行 */
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* 手机上不要那条竖线，横排里它会挂在左边很怪 */
  .side-link.is-active::before {
    display: none;
  }

  .side-code {
    display: none;
  }

  .side-foot {
    grid-area: out;
    margin: 0;
    padding: 0;
    border: none;
    flex-direction: row;
  }

  /* 手机上「回到前台」挪到第一行右侧，「退出」留在标签行右侧，
     两个都在，只是分开放，不然一行塞不下 */
  .side-foot .foot-link:first-child {
    position: absolute;
    top: 10px;
    right: 14px;
    min-height: 36px;
    font-size: 12px;
  }

  .foot-link {
    min-height: 40px;
    padding: 0 10px;
    font-size: 12.5px;
  }

  .admin-main {
    padding: 20px 16px 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .side-link {
    transition: none;
  }
}
</style>
