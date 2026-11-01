<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchAdminPosts, fetchAdminStats } from '../../api'
import { formatDate } from '../../utils/format'

const stats = ref(null)
const posts = ref([])
const loading = ref(true)
const errorMsg = ref('')

// 数字块集中定义，模板里循环，改一个地方就行
const cards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { key: 'posts', label: '文章', value: s.postCount, unit: '篇' },
    { key: 'views', label: '总阅读', value: s.viewSum, unit: '次' },
    { key: 'likes', label: '总点赞', value: s.likeSum, unit: '个' },
    { key: 'comments', label: '留言', value: s.commentCount, unit: '条' }
  ]
})

// 最近三篇，列表接口已经按时间倒序了
const recentPosts = computed(() => posts.value.slice(0, 3))

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    // 两个请求互不依赖，用 Promise.all 并发，比一个个 await 快一半
    const [s, p] = await Promise.all([fetchAdminStats(), fetchAdminPosts()])
    stats.value = s
    posts.value = p
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">overview</p>
        <h1 class="page-title">概览</h1>
      </div>
      <RouterLink to="/" class="head-link">去前台看看 ↗</RouterLink>
    </header>

    <p v-if="loading" class="state-tip">读取中…</p>
    <p v-else-if="errorMsg" class="state-tip is-error">{{ errorMsg }}</p>

    <template v-else>
      <!-- 四个数字 -->
      <div class="stat-grid">
        <div
          v-for="card in cards"
          :key="card.key"
          class="stat-card"
          :class="{ 'is-alert': card.alert }"
        >
          <span class="stat-label">{{ card.label }}</span>
          <span class="stat-value">
            {{ card.value }}
            <span class="stat-unit">{{ card.unit }}</span>
          </span>
        </div>
      </div>

      <!-- 最近文章 -->
      <section class="block">
        <h2 class="block-title">最近发布</h2>

        <ul class="recent">
          <li v-for="post in recentPosts" :key="post.id" class="recent-item">
            <RouterLink :to="`/post/${post.id}`" class="recent-title">{{ post.title }}</RouterLink>
            <span class="recent-meta">
              <span>{{ formatDate(post.createdAt) }}</span>
              <span>{{ post.views }} 次阅读</span>
              <span class="recent-vis" :class="{ 'is-member': post.visibility === 'member' }">
                {{ post.visibility === 'member' ? '登录可见' : '公开' }}
              </span>
            </span>
          </li>
        </ul>

        <p v-if="recentPosts.length === 0" class="state-tip">还没有文章。</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 26px;
}

.page-eyebrow {
  margin: 0 0 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.head-link {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-faint);
  transition: color 0.16s ease;
  white-space: nowrap;
  padding-bottom: 3px;
}

.head-link:hover {
  color: var(--accent);
}

.state-tip {
  padding: 26px 0;
}

/* ---------- 数字块 ---------- */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 18px;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

/* 有积压的那块用橙色描边提示，但底色不变，不抢眼 */
.stat-card.is-alert {
  border-color: rgba(240, 168, 104, 0.34);
}

.stat-label {
  font-size: 12.5px;
  color: var(--text-dim);
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 26px;
  line-height: 1;
  color: var(--text);
}

.stat-card.is-alert .stat-value {
  color: var(--accent);
}

.stat-unit {
  font-family: var(--font-cn);
  font-size: 11.5px;
  color: var(--text-faint);
  margin-left: 4px;
}

/* ---------- 最近文章 ---------- */
.block {
  margin-top: 34px;
}

.block-title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-dim);
  letter-spacing: 0.06em;
}

.recent {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 2px;
  border-bottom: 1px solid var(--line);
}

.recent-title {
  font-size: 14.5px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.16s ease;
}

.recent-title:hover {
  color: var(--accent);
}

.recent-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

.recent-vis {
  padding: 1px 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  font-family: var(--font-cn);
  font-size: 10.5px;
}

.recent-vis.is-member {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.3);
}

@media (max-width: 768px) {
  .page-head {
    margin-bottom: 20px;
  }

  .page-title {
    font-size: 21px;
  }

  /* 手机上两列，不再是一行四个小方块 */
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stat-value {
    font-size: 22px;
  }

  /* 手机上标题和元信息分行，否则标题被挤成几个字 */
  .recent-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .recent-meta {
    gap: 10px;
  }
}
</style>
