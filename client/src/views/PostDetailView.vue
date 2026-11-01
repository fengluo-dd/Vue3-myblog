<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fetchPost, likePost, unlikePost } from '../api'
import { renderMarkdown } from '../utils/markdown'
import { formatDate } from '../utils/format'
import { useUserStore } from '../stores/user'
import CommentSection from '../components/CommentSection.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const post = ref(null)
const loading = ref(true)
const error = ref('')

async function loadPost() {
  loading.value = true
  error.value = ''
  post.value = null

  try {
    post.value = await fetchPost(route.params.id)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(loadPost)

// 从一篇文章直接跳到另一篇时，组件会被复用，必须监听 id 变化重新请求
watch(() => route.params.id, loadPost)

// 登录或退出之后，登录可见文章的锁要跟着变，所以也要重新请求
watch(() => userStore.isLoggedIn, loadPost)

// 能不能看全文由后端说了算：locked 是接口给的，前端不算这个账
const canReadFull = computed(() => Boolean(post.value) && !post.value.locked)

const contentHtml = computed(() => {
  if (!canReadFull.value || !post.value?.content) return ''
  return renderMarkdown(post.value.content)
})

/* ---------- 点赞 ---------- */

const liking = ref(false)
const likeError = ref('')

async function toggleLike() {
  // 没登录就别装了，直接送去登录页，登录完回到这篇
  if (!userStore.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  if (liking.value) return
  liking.value = true
  likeError.value = ''

  try {
    // 已赞就取消，未赞就点上。后端是幂等的，
    // 就算这里状态判断错了也不会重复计数
    const data = post.value.liked
      ? await unlikePost(post.value.id)
      : await likePost(post.value.id)

    post.value.liked = data.liked
    post.value.likeCount = data.likeCount
  } catch (err) {
    likeError.value = err.message
  } finally {
    liking.value = false
  }
}
</script>

<template>
  <div class="container page">
    <!-- 加载中 -->
    <div v-if="loading" class="state-tip">正在读取文章…</div>

    <!-- 出错：404 或网络问题 -->
    <div v-else-if="error" class="notfound">
      <p class="notfound-code">404</p>
      <p class="locked-desc">{{ error }}</p>
      <RouterLink to="/" class="btn">回到首页</RouterLink>
    </div>

    <!-- 正常 -->
    <article v-else-if="post">
      <div class="detail-head">
        <RouterLink to="/" class="back-link">← 返回列表</RouterLink>

        <h1 class="detail-title">{{ post.title }}</h1>

        <div class="detail-meta">
          <span>{{ formatDate(post.createdAt) }}</span>
          <span>{{ post.category }}</span>
          <span>{{ post.views }} 次阅读</span>
          <span>{{ post.likeCount }} 人点赞</span>
        </div>
      </div>

      <!-- 有权阅读：把 Markdown 渲染成 HTML 塞进来 -->
      <div v-if="canReadFull" class="prose" v-html="contentHtml"></div>

      <!-- 无权阅读：正文压根没从数据库出来，这里只有摘要 -->
      <div v-else class="locked">
        <h2 class="locked-title">这篇需要登录才能读</h2>
        <p class="locked-desc">摘要：{{ post.summary }}</p>
        <RouterLink
          :to="{ name: 'login', query: { redirect: route.fullPath } }"
          class="btn"
        >
          登录后阅读
        </RouterLink>
      </div>

      <!-- 点赞：看完之后的手势，放在正文末尾最自然 -->
      <div v-if="canReadFull" class="like-bar">
        <button
          class="like-btn"
          :class="{ 'is-liked': post.liked }"
          :disabled="liking"
          @click="toggleLike"
        >
          <span class="like-icon">{{ post.liked ? '♥' : '♡' }}</span>
          <span>{{ post.liked ? '已赞' : '点赞' }}</span>
          <span class="like-num">{{ post.likeCount }}</span>
        </button>
        <p v-if="likeError" class="like-error">{{ likeError }}</p>
        <p v-else-if="!userStore.isLoggedIn" class="like-hint">登录后可以点赞</p>
      </div>

      <!-- 评论区：正文读得到才给看评论。
           锁着的文章连评论一起藏起来——没读正文就来讨论没有意义 -->
      <section v-if="canReadFull" class="detail-comments">
        <h2 class="comments-title">评论</h2>
        <CommentSection :post-id="post.id" />
      </section>
    </article>
  </div>
</template>

<style scoped>
/* ==========================================================
   文章详情页（.prose 正文样式在全局 main.css，因为 v-html 渲染的节点选不中 scoped）
   ========================================================== */
.detail-head {
  border-bottom: 1px solid var(--line);
  padding-bottom: 26px;
  margin-bottom: 34px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 18px;
  transition: color 0.18s ease;
}

.back-link:hover {
  color: var(--accent);
}

.detail-title {
  font-family: var(--font-cn);
  font-size: 33px;
  line-height: 1.48;
  font-weight: 500;
  margin: 0 0 18px;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-faint);
  letter-spacing: 0.05em;
}

/* 登录可见文章的遮罩 */
.locked {
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 44px 32px;
  text-align: center;
}

.locked-title {
  font-family: var(--font-cn);
  font-size: 19px;
  font-weight: 500;
  margin: 0 0 12px;
  color: var(--text);
}

.locked-desc {
  margin: 0 0 24px;
  color: var(--text-dim);
  font-size: 14px;
}

/* ---------- 点赞 ---------- */
.like-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 46px;
  padding-top: 30px;
  border-top: 1px solid var(--line);
}

/* ---------- 评论区 ---------- */
.detail-comments {
  margin-top: 42px;
  padding-top: 32px;
  border-top: 1px solid var(--line);
}

.comments-title {
  margin: 0 0 22px;
  font-family: var(--font-cn);
  font-size: 19px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.like-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 22px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background-color: transparent;
  font-size: 13.5px;
  color: var(--text-dim);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.like-btn:hover:not(:disabled) {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.35);
}

/* 已赞：填成淡橙底，和「已通过」的审核按钮同一套语言 */
.like-btn.is-liked {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.45);
  background-color: var(--accent-dim);
}

.like-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.like-icon {
  font-size: 15px;
  line-height: 1;
}

/* 数字用等宽，点赞时不跳字宽 */
.like-num {
  padding-left: 9px;
  margin-left: 2px;
  border-left: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 12px;
}

.like-hint,
.like-error {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-faint);
}

.like-error {
  color: var(--danger);
}

@media (max-width: 768px) {
  .detail-title {
    font-size: 24px;
  }

  .like-bar {
    margin-top: 34px;
    padding-top: 24px;
  }
}
</style>
