<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPosts } from '../api'
import { formatDate } from '../utils/format'

const notes = ref([])
const loading = ref(true)
const errorMsg = ref('')

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    // 只拉 type=note，长文在首页
    notes.value = await fetchPosts(null, 'note')
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="container page">
    <header class="notes-head">
      <p class="notes-eyebrow">notes</p>
      <h1 class="notes-title">随笔</h1>
      <p class="notes-desc">没写完的、突然想到的、不值得单独成篇的。</p>
    </header>

    <p v-if="loading" class="state-tip">读取中…</p>
    <p v-else-if="errorMsg" class="state-tip is-error">{{ errorMsg }}</p>
    <p v-else-if="notes.length === 0" class="state-tip">
      还没有随笔。后台写文章时把类型选成「随笔」就会出现在这里。
    </p>

    <div v-else class="timeline">
      <RouterLink
        v-for="note in notes"
        :key="note.id"
        :to="`/post/${note.id}`"
        class="tl-item"
      >
        <span class="tl-date">{{ formatDate(note.createdAt) }}</span>
        <h2 class="tl-title">{{ note.title }}</h2>
        <p class="tl-summary">{{ note.summary }}</p>
        <div class="tl-meta">
          <span>{{ note.category }}</span>
          <span>{{ note.views }} 次查看</span>
          <span>{{ note.likeCount }} 赞</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
/* ==========================================================
   随笔页：一条竖向时间线，左侧是线和圆点
   ========================================================== */

.notes-head {
  margin-bottom: 40px;
}

.notes-eyebrow {
  margin: 0 0 10px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.notes-title {
  margin: 0 0 12px;
  font-size: 30px;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.notes-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-dim);
}

/* ---------- 时间线 ---------- */
.timeline {
  position: relative;
  padding-left: 28px;
}

/* 整条竖线画在容器上，只画一次，比每个 item 各画一段更省事也不会断 */
.timeline::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 10px;
  bottom: 10px;
  width: 1px;
  background-color: var(--line);
}

.tl-item {
  display: block;
  position: relative;
  padding: 4px 0 26px;
}

/* 圆点：中心要和竖线对齐。
   竖线在 left:4px（宽 1px，中心 4.5），
   圆点 7px + 1px 边框 = 9px 宽，放在 left:-28px 处正好从 0 开始，中心 4.5 */
.tl-item::before {
  content: '';
  position: absolute;
  left: -28px;
  top: 9px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--bg);
  border: 1px solid var(--line-strong);
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.tl-item:hover::before {
  background-color: var(--accent);
  border-color: var(--accent);
}

.tl-date {
  display: block;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  margin-bottom: 6px;
}

.tl-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 500;
  line-height: 1.6;
  color: var(--text);
  transition: color 0.18s ease;
}

.tl-item:hover .tl-title {
  color: var(--accent);
}

.tl-summary {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-dim);
  /* 随笔本来就短，摘要最多三行，再多就不是「随手记」了 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tl-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

/* ---------- 手机 ---------- */
@media (max-width: 768px) {
  .notes-head {
    margin-bottom: 30px;
  }

  .notes-title {
    font-size: 24px;
  }

  .timeline {
    padding-left: 20px;
  }

  .timeline::before {
    left: 2px;
  }

  .tl-item::before {
    left: -20px;
    top: 8px;
    width: 6px;
    height: 6px;
  }

  .tl-item {
    padding-bottom: 22px;
  }

  .tl-title {
    font-size: 16px;
  }

  .tl-summary {
    font-size: 13.5px;
    -webkit-line-clamp: 2;
  }
}
</style>
