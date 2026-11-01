<script setup>
import { RouterLink } from 'vue-router'
import { formatDate } from '../utils/format'

// 父组件传进来的单篇文章
const props = defineProps({
  post: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <RouterLink :to="`/post/${post.id}`" class="post-card">
    <div class="post-meta">
      <span class="post-category">{{ post.category }}</span>
      <span>{{ formatDate(post.createdAt) }}</span>
    </div>

    <h2 class="post-title">{{ post.title }}</h2>

    <p class="post-summary">{{ post.summary }}</p>

    <div class="post-foot">
      <div class="post-stats">
        <span>{{ post.views }} 次阅读</span>
        <span>{{ post.likeCount }} 赞</span>
      </div>
      <span class="read-more">阅读全文 →</span>
    </div>
  </RouterLink>
</template>

<style scoped>
/* ==========================================================
   文章卡片
   ========================================================== */
.post-card {
  display: block;
  position: relative;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 24px 26px;
  transition: border-color 0.2s ease, background-color 0.2s ease,
    transform 0.2s ease;
}

.post-card:hover {
  border-color: var(--line-strong);
  background-color: var(--surface-2);
  transform: translateY(-1px);
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin-bottom: 12px;
}

/* 分类标签：橙色，但体积小不抢焦点 */
.post-category {
  color: var(--accent);
  letter-spacing: 0.12em;
}

.post-title {
  font-family: var(--font-cn);
  font-size: 21px;
  line-height: 1.55;
  font-weight: 500;
  margin: 0 0 10px;
  color: var(--text);
}

.post-card:hover .post-title {
  color: var(--accent);
}

.post-summary {
  margin: 0;
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1.75;
  /* 手机上不截断的话，一屏放不下两张卡 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  color: var(--text-faint);
}

.post-stats {
  display: flex;
  gap: 18px;
}

.read-more {
  color: var(--accent);
}

@media (max-width: 768px) {
  .post-card {
    padding: 20px 18px;
  }

  .post-title {
    font-size: 18.5px;
  }

  .post-summary {
    font-size: 14px;
  }

  .post-foot {
    margin-top: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .post-card {
    transition: none;
  }
}
</style>
