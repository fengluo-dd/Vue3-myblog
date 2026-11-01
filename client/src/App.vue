<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import { fetchMe } from './api'
import { useUserStore } from './stores/user'

const userStore = useUserStore()
const route = useRoute()

// 后台是一套独立布局：自己的侧边栏、自己的内容区。
// 前台的导航、页脚、夜空、回到顶部按钮在这里都不该出现，
// 否则一个页面里会有两套导航，用户不知道该看哪个。
const isAdminArea = computed(() => route.path.startsWith('/admin'))

// 滚过一屏之后才显示「回到顶部」
const showTop = ref(false)

function handleScroll() {
  showTop.value = window.scrollY > window.innerHeight * 0.8
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 接口返回 401 时，api 层会派发这个事件。
// 它已经清过 localStorage 了，这里负责把内存里的登录状态也清掉，
// 否则导航栏还会显示「用户名 退出」，看起来像没登录成功。
function handleAuthExpired() {
  userStore.clearAuth()
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('auth:expired', handleAuthExpired)

  // 本地存了 token 就先验一次：可能已经过期，也可能是伪造的。
  // 验不过就清掉，避免界面显示「已登录」但接口处处 401。
  if (userStore.token) {
    try {
      const me = await fetchMe()
      userStore.setAuth({ token: userStore.token, user: me })
    } catch {
      userStore.clearAuth()
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('auth:expired', handleAuthExpired)
})
</script>

<template>
  <!-- 夜空背景层：纯 CSS 绘制，不含任何图片，所以没有版权和加载问题 -->
  <div v-if="!isAdminArea" class="sky" aria-hidden="true">
    <div class="stars"></div>
    <!-- 流星单独关一层，高度锁在一屏内，滚下去就看不到，不会划过正文 -->
    <div class="meteors">
      <span class="meteor meteor-1"></span>
      <span class="meteor meteor-2"></span>
      <span class="meteor meteor-3"></span>
    </div>
  </div>

  <AppHeader v-if="!isAdminArea" />

  <main>
    <!-- 路由匹配到的页面会渲染在这里 -->
    <RouterView />
  </main>

  <template v-if="!isAdminArea">
    <footer class="site-footer">
      <div class="container footer-inner">
        <span>枫落 · margin notes</span>
        <span>Vue 3 + Vite</span>
      </div>
    </footer>

    <button
      class="to-top"
      :class="{ 'is-visible': showTop }"
      aria-label="回到顶部"
      @click="scrollToTop"
    >
      ↑
    </button>
  </template>
</template>

<style scoped>
/* ==========================================================
   夜空背景 + 页脚 + 回到顶部
   ========================================================== */

/* 夜空只铺首屏这一屏。
   不用 fixed（会钉在视口上，滚到文章区就露出一片亮色），
   也不用 100%（渐变会被拉伸到整页高度）。
   高度写死 100vh，往下交给 body 的底色 + 淡星点接住，两者同为 #0b1026，衔接无缝。 */
.sky {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100vh;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(120% 70vh at 50% 0%, #1b2450 0%, rgba(11, 16, 38, 0) 100%),
    radial-gradient(90% 55vh at 82% 0%, #232a58 0%, rgba(11, 16, 38, 0) 100%),
    var(--bg);
}

/* 四层径向渐变平铺成星点，靠 background-size 制造疏密不一的错觉 */
.stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 24px 32px, rgba(236, 233, 245, 0.8) 50%, transparent 50%),
    radial-gradient(1px 1px at 128px 96px, rgba(236, 233, 245, 0.5) 50%, transparent 50%),
    radial-gradient(1.4px 1.4px at 212px 44px, rgba(236, 233, 245, 0.68) 50%, transparent 50%),
    radial-gradient(1px 1px at 64px 188px, rgba(236, 233, 245, 0.42) 50%, transparent 50%);
  background-size:
    260px 260px,
    340px 340px,
    420px 420px,
    300px 300px;
  animation: twinkle 9s ease-in-out infinite;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

/* 流星只在首屏这一屏里活动，超出就裁掉 */
.meteors {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100vh;
  overflow: hidden;
}

/* 流星：一条细长渐变线 + 旋转 + 位移动画 */
.meteor {
  position: absolute;
  width: 1px;
  height: 160px;
  background: linear-gradient(
    to bottom,
    rgba(240, 168, 104, 0) 0%,
    rgba(240, 168, 104, 0.28) 55%,
    rgba(255, 255, 255, 0.6) 100%
  );
  opacity: 0;
  transform-origin: top center;
}

.meteor-1 {
  top: 5%;
  left: 70%;
  animation: meteor-fall 18s linear infinite;
  animation-delay: 1.5s;
}

.meteor-2 {
  top: 1%;
  left: 86%;
  height: 120px;
  animation: meteor-fall 22s linear infinite;
  animation-delay: 7s;
}

.meteor-3 {
  top: 12%;
  left: 13%;
  height: 185px;
  animation: meteor-fall 26s linear infinite;
  animation-delay: 12s;
}

@keyframes meteor-fall {
  0% {
    transform: rotate(38deg) translate3d(0, -140px, 0);
    opacity: 0;
  }
  4% {
    opacity: 1;
  }
  18% {
    opacity: 1;
  }
  30% {
    opacity: 0;
  }
  100% {
    transform: rotate(38deg) translate3d(0, 920px, 0);
    opacity: 0;
  }
}

main {
  position: relative;
  z-index: 1;
}

/* 页脚 */
.site-footer {
  border-top: 1px solid var(--line);
  padding: 28px 0;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-faint);
  letter-spacing: 0.04em;
}

/* 回到顶部 */
.to-top {
  position: fixed;
  right: 22px;
  bottom: 26px;
  z-index: 20;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--line);
  background-color: rgba(18, 26, 58, 0.82);
  backdrop-filter: blur(8px);
  color: var(--text-dim);
  font-size: 15px;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition: opacity 0.22s ease, transform 0.22s ease, color 0.18s ease,
    border-color 0.18s ease;
}

.to-top.is-visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.to-top:hover {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.35);
}

/* 手机：流星只留 1 颗，星点不闪，页脚居中 */
@media (max-width: 768px) {
  .meteor-2,
  .meteor-3 {
    display: none;
  }

  .stars {
    animation: none;
    opacity: 0.8;
  }

  .footer-inner {
    justify-content: center;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .meteor,
  .stars {
    animation: none;
  }

  .meteor {
    opacity: 0;
  }
}
</style>
