<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchPosts } from '../api'
import PostCard from '../components/PostCard.vue'

const posts = ref([])
const loading = ref(true)
const errorMsg = ref('')
const activeCategory = ref('全部')

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    // 只拉长文。随笔在 /notes，两边各管各的，互不串场
    posts.value = await fetchPosts(null, 'post')
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 分类从数据里自动去重，以后加文章不用回来改代码
const categories = computed(() => {
  const set = new Set(posts.value.map((p) => p.category))
  return ['全部', ...set]
})

const visiblePosts = computed(() => {
  if (activeCategory.value === '全部') return posts.value
  return posts.value.filter((p) => p.category === activeCategory.value)
})

const lastUpdated = computed(() => {
  const newest = posts.value[0]
  return newest ? newest.createdAt.slice(0, 10).replace(/-/g, '.') : '—'
})
</script>

<template>
  <div class="container page">
    <header class="blog-head">
      <p class="blog-eyebrow">articles</p>
      <h1 class="blog-title">博文</h1>
      <p class="blog-desc">写长一点的那些。想到什么随手记的，在「随笔」里。</p>
    </header>

    <div class="bar">
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

      <p class="bar-count">
        <span v-if="loading">读取中…</span>
        <span v-else-if="errorMsg">读取失败</span>
        <span v-else>共 {{ visiblePosts.length }} 篇 · 最近更新 {{ lastUpdated }}</span>
      </p>
    </div>

    <p v-if="loading" class="state-tip">正在从数据库读取…</p>

    <div v-else-if="errorMsg" class="state-tip state-error">
      <p>{{ errorMsg }}</p>
      <button class="btn btn-ghost" @click="load">重试</button>
    </div>

    <template v-else>
      <div class="post-list">
        <PostCard v-for="post in visiblePosts" :key="post.id" :post="post" />
      </div>

      <p v-if="visiblePosts.length === 0" class="message-empty">
        这个分类下还没有文章。
      </p>
    </template>
  </div>
</template>

<style scoped>
.blog-head {
  margin-bottom: 30px;
}

.blog-eyebrow {
  margin: 0 0 10px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.blog-title {
  margin: 0 0 12px;
  font-size: 30px;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.blog-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-dim);
}

/* 筛选和计数同一行：左筛选右统计，窄屏自动换行 */
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding-bottom: 18px;
  margin-bottom: 26px;
  border-bottom: 1px solid var(--line);
}

.filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.filter-btn:hover {
  color: var(--text);
  border-color: var(--line-strong);
}

.filter-btn.is-active {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.4);
  background-color: var(--accent-dim);
}

.bar-count {
  margin: 0;
  font-family: var(--font-cn);
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .blog-title {
    font-size: 24px;
  }

  .filter-btn {
    min-height: 42px;
    padding: 0 14px;
    font-size: 12.5px;
  }

  .bar {
    gap: 10px;
  }
}
</style>
