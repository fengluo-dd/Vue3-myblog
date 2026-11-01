<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPosts } from '../api'
import BlogMark from '../components/BlogMark.vue'
import PostCard from '../components/PostCard.vue'

// ---------- 首屏引言（纯静态，不走接口） ----------
const quotes = [
  { text: '我们所经历的每个平凡的日常，也许就是连续发生的奇迹。', author: '《日常》' },
  { text: '重要的东西，用眼睛是看不见的。', author: '《小王子》' },
  { text: '星光不问赶路人，时光不负有心人。', author: '佚名' },
  { text: '把每一件小事做到底，本身就是一种天赋。', author: '佚名' }
]

const quoteIndex = ref(0)
const currentQuote = computed(() => quotes[quoteIndex.value])

function nextQuote() {
  // 取模循环，到最后一句再点就回到第一句
  quoteIndex.value = (quoteIndex.value + 1) % quotes.length
}

// 首屏占满一屏，点击才滚到文章区
// 注意不能用 <a href="#posts">：hash 路由下 # 会被当成路由地址，页面会跳走
function scrollToPosts() {
  document.getElementById('posts')?.scrollIntoView({ behavior: 'smooth' })
}

// ---------- 文章列表：从后端接口读 ----------
const posts = ref([])
const loading = ref(true)
const error = ref('')
const activeCategory = ref('全部')

async function loadPosts() {
  loading.value = true
  error.value = ''
  try {
    // 首页只拉长文，随笔在 /notes 单独一页
    posts.value = await fetchPosts(null, 'post')
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// 组件挂载后立刻请求一次
onMounted(loadPosts)

// 分类从返回的数据里自动去重，以后加文章不用改这里
const categories = computed(() => {
  const set = new Set(posts.value.map((p) => p.category))
  return ['全部', ...set]
})

// 排序在后端做完了（ORDER BY created_at DESC），前端只管过滤
const visiblePosts = computed(() => {
  if (activeCategory.value === '全部') return posts.value
  return posts.value.filter((p) => p.category === activeCategory.value)
})

// 首页只是门面，放几篇让人有得点就行。
// 全部归档在 /posts（博文），两个页面才不会长得一模一样。
const HOME_LIMIT = 4
const homePosts = computed(() => visiblePosts.value.slice(0, HOME_LIMIT))

const lastUpdated = computed(() => {
  const newest = posts.value[0]
  return newest ? newest.createdAt.slice(0, 10).replace(/-/g, '.') : '—'
})
</script>

<template>
  <!-- ========== 首屏：一整屏的夜空 ========== -->
  <section class="hero-full">
    <div class="hero-inner">
      <!-- 站标替换原来的「余」字圆头像：圆环本身就是边框，
           所以外面那层 border + 背景色一起去掉，否则会套两个圈 -->
      <BlogMark class="hero-mark" />

      <p class="hero-eyebrow">Welcome to my blog</p>

      <div class="quote-card">
        <span class="quote-mark">“</span>
        <p class="quote-text">{{ currentQuote.text }}</p>
        <p class="quote-author">—— {{ currentQuote.author }}</p>
        <button class="quote-refresh" aria-label="换一句" @click="nextQuote">↻</button>
      </div>

      <button class="scroll-hint" @click="scrollToPosts">
        <span>向下滚动</span>
        <span class="scroll-arrow">↓</span>
      </button>
    </div>

    <!-- 山脊剪影：两层不同明度制造景深，最前面一层和页面底色同色，自然过渡到内容区 -->
    <div class="ridge-wrap" aria-hidden="true">
      <svg class="ridge ridge-back" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          d="M0 320 L0 208 L250 132 L520 210 L790 122 L1050 204 L1290 142 L1440 198 L1440 320 Z"
          fill="#141d45"
        />
      </svg>
      <svg class="ridge ridge-front" viewBox="0 0 1440 260" preserveAspectRatio="none">
        <path
          d="M0 260 L0 210 L310 162 L640 212 L920 164 L1190 208 L1440 176 L1440 260 Z"
          fill="#0b1026"
        />
      </svg>
    </div>
  </section>

  <!-- ========== 文章区 ========== -->
  <section id="posts" class="container posts-section">
    <div class="posts-head">
      <p class="posts-cmd"><span class="prompt"></span>时光碎</p>
      <p class="posts-count">
        <span v-if="loading">读取中…</span>
        <span v-else-if="error">读取失败</span>
        <span v-else>共 {{ posts.length }} 篇 · 最近更新 {{ lastUpdated }}</span>
      </p>
    </div>

    <div class="filter">
      <button
        v-for="category in categories"
        :key="category"
        class="filter-btn"
        :class="{ 'is-active': activeCategory === category }"
        @click="activeCategory = category"
      >
        {{ category }}
      </button>
    </div>

    <!-- 三种状态：加载中 / 出错 / 正常 -->
    <div v-if="loading" class="state-tip">正在从数据库读取…</div>

    <div v-else-if="error" class="state-tip state-error">
      <p>{{ error }}</p>
      <button class="btn btn-ghost" @click="loadPosts">重试</button>
    </div>

    <template v-else>
      <div class="post-list">
        <PostCard v-for="post in homePosts" :key="post.id" :post="post" />
      </div>

      <p v-if="visiblePosts.length === 0" class="message-empty">
        这个分类下还没有文章。
      </p>

      <!-- 首页只有最新几篇，剩下的都收在博文归档里 -->
      <RouterLink v-else to="/posts" class="more-link">
        查看全部 {{ posts.length }} 篇博文 →
      </RouterLink>
    </template>
  </section>
</template>

<style scoped>
/* ==========================================================
   首页：全屏首屏 + 文章列表
   ========================================================== */
.hero-full {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  /* dvh 解决手机浏览器地址栏收放导致的 100vh 抖动 */
  min-height: 100dvh;
  padding: 96px 24px 210px;
  text-align: center;
  overflow: hidden;
}

.hero-inner {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 760px;
}

/* 站标。78px 的老尺寸是给一个汉字准备的，换成带三条细尾迹的图形后
   线会挤成一团，所以放大到 132px，让环里的轨迹看得清 */
.hero-mark {
  width: 148px;
  height: 148px;
  margin: 0 auto 26px;
}

/* 超宽字距的英文小字，英文才吃得消这种处理 */
/* 回到原来「Welcome to my little universe」的处理：次文字色 + 小字号，
   它是一句落款式的招呼，不是标题。用主文字色（近白）会从夜色里跳出来，
   把下面那张引言卡片的风头抢掉 */
.hero-eyebrow {
  font-family: var(--font-mono);
  font-size: clamp(14px, 1.5vw, 16px);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--text-dim);
  /* 首屏 100vh 里它单独占一行，加一点点透明度让它更像"沉在背景里" */
  opacity: 0.9;
  margin: 0;
}

/* 引言卡片 */
.quote-card {
  position: relative;
  max-width: 470px;
  margin: 38px auto 0;
  padding: 22px 62px 20px 26px;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 12px;
  background-color: rgba(18, 26, 58, 0.55);
  backdrop-filter: blur(10px);
}

.quote-mark {
  position: absolute;
  left: 9px;
  top: 4px;
  font-family: var(--font-mono);
  font-size: 30px;
  line-height: 1;
  color: rgba(240, 168, 104, 0.35);
}

.quote-text {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text);
}

.quote-author {
  margin: 0;
  font-size: 12px;
  color: var(--text-faint);
}

.quote-refresh {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background-color: transparent;
  color: var(--text-dim);
  font-size: 15px;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, transform 0.35s ease;
}

.quote-refresh:hover {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.4);
  transform: translateY(-50%) rotate(180deg);
}

/* 向下滚动提示 */
.scroll-hint {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 46px;
  padding: 8px 14px;
  border: none;
  background: none;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.24em;
  color: rgba(236, 233, 245, 0.45);
  cursor: pointer;
  transition: color 0.18s ease;
}

.scroll-hint:hover {
  color: rgba(236, 233, 245, 0.75);
}

.scroll-arrow {
  font-size: 14px;
  animation: arrow-bob 2.2s ease-in-out infinite;
}

@keyframes arrow-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(5px);
  }
}

/* 山脊剪影：两层不同明度做景深，最前一层与页面同色，无缝接到内容区 */
.ridge-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  height: 310px;
  pointer-events: none;
}

.ridge {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  display: block;
}

.ridge-back {
  height: 320px;
}

.ridge-front {
  height: 250px;
}

/* ---------- 文章区 ---------- */
.posts-section {
  padding-top: 24px;
  padding-bottom: 96px;
}

.posts-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 18px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--line);
}

/* 左右两行用同一套排版：13px / 400 / 次文字色，只靠内容区分主次 */
.posts-cmd,
.posts-count {
  margin: 0;
  font-family: var(--font-cn);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

/* 日期数字等宽，右对齐时不跳动 */
.posts-count {
  font-variant-numeric: tabular-nums;
}

/* $ 这类符号仍然用等宽，终端味就靠它；空标签不占位 */
.prompt {
  font-family: var(--font-mono);
  color: var(--accent);
}

.prompt:not(:empty) {
  margin-right: 8px;
}

/* ---------- 分类筛选 ---------- */
.filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 28px;
}

.filter-btn {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid var(--line);
  background-color: transparent;
  border-radius: 999px;
  font-size: 13px;
  font-family: var(--font-cn);
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.18s ease;
}

.filter-btn:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.filter-btn.is-active {
  border-color: var(--accent);
  color: var(--accent);
  background-color: var(--accent-dim);
}

/* ---------- 列表容器 ---------- */
.post-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 「查看全部博文」：放在列表末尾，居中，像一个收尾的句号 */
.more-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  margin-top: 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  font-size: 13.5px;
  color: var(--text-dim);
  transition: color 0.18s ease, border-color 0.18s ease;
}

.more-link:hover {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.35);
}

@media (max-width: 768px) {
  .hero-full {
    padding: 78px 20px 150px;
  }

  .hero-mark {
    width: 104px;
    height: 104px;
    margin-bottom: 20px;
  }

  .hero-eyebrow {
    /* 手机上字距收窄，否则 WELCOME TO MY BLOG 一行放不下会折成两行 */
    font-size: 12.5px;
    letter-spacing: 0.22em;
  }

  .quote-card {
    margin-top: 30px;
    padding: 18px 58px 16px 22px;
  }

  .quote-text {
    font-size: 14px;
  }

  .scroll-hint {
    margin-top: 32px;
  }

  .ridge-wrap {
    height: 240px;
  }

  .ridge-back {
    height: 240px;
  }

  .ridge-front {
    height: 180px;
  }

  .posts-section {
    padding-top: 12px;
    padding-bottom: 64px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .filter-btn {
    transition: none;
  }

  .scroll-arrow {
    animation: none;
  }
}
</style>
