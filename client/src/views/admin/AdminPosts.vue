<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { deletePost, fetchAdminPosts, updatePost } from '../../api'
import { formatDate } from '../../utils/format'

const posts = ref([])
const loading = ref(true)
const errorMsg = ref('')

// 顶部飘一句操作结果，2.4 秒后自动消失
const notice = ref('')
const noticeIsError = ref(false)
let noticeTimer = null

function showNotice(text, isError = false) {
  notice.value = text
  noticeIsError.value = isError
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 2400)
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    posts.value = await fetchAdminPosts()
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------- 长文 / 随笔分类 ---------- */

// 'all' 全部 / 'post' 长文 / 'note' 随笔
const tab = ref('all')

// 一次把列表拉全，切标签在前端过滤。
// 后台文章是几十篇的量级，为了切标签再请求一次不值得。
const counts = computed(() => ({
  all: posts.value.length,
  post: posts.value.filter((p) => p.type !== 'note').length,
  note: posts.value.filter((p) => p.type === 'note').length
}))

const visiblePosts = computed(() => {
  if (tab.value === 'note') return posts.value.filter((p) => p.type === 'note')
  if (tab.value === 'post') return posts.value.filter((p) => p.type !== 'note')
  return posts.value
})

// 在「随笔」标签下点写文章，新建页直接是随笔类型，不用再手动切
const newPostLink = computed(() => ({
  path: '/admin/posts/new',
  query: tab.value === 'all' ? {} : { type: tab.value }
}))

/* ---------- 切换 公开 / 登录可见 ---------- */

// 正在请求中的文章 id，用来把按钮置灰，防止连点发出两次请求
const togglingId = ref(null)

async function toggleVisibility(post) {
  const next = post.visibility === 'public' ? 'member' : 'public'
  togglingId.value = post.id
  try {
    await updatePost(post.id, { visibility: next })
    // 局部更新而不是重新拉列表：省一次请求，页面也不会闪
    post.visibility = next
    showNotice(next === 'member' ? '已改为登录可见' : '已改为所有人可见')
  } catch (err) {
    showNotice(err.message, true)
  } finally {
    togglingId.value = null
  }
}

/* ---------- 编辑 ---------- */

// 编辑改成了独立页面（AdminPostEdit.vue），因为正文要 Markdown 预览，
// 弹窗装不下。这里只保留「跳过去」的链接，不再维护一套表单。

/* ---------- 删除 ---------- */

// 存 id 而不是布尔值：这样同一时刻只有一张卡片处于「确认中」状态
const pendingDeleteId = ref(null)
const deleting = ref(false)

async function removePost(post) {
  deleting.value = true
  try {
    await deletePost(post.id)
    posts.value = posts.value.filter((p) => p.id !== post.id)
    pendingDeleteId.value = null
    // 删文章会级联删掉它下面的全部留言，这一点要说清楚，
    // 否则用户会以为只是删了篇文章
    showNotice('已删除，关联的留言和点赞一并清掉')
  } catch (err) {
    showNotice(err.message, true)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">articles</p>
        <h1 class="page-title">文章管理</h1>
      </div>
      <div class="head-actions">
        <span class="head-count">{{ visiblePosts.length }} 篇</span>
        <RouterLink :to="newPostLink" class="btn new-btn">写文章</RouterLink>
      </div>
    </header>

    <div class="tabs">
      <button class="tab" :class="{ 'is-active': tab === 'all' }" @click="tab = 'all'">
        全部
        <span class="tab-num">{{ counts.all }}</span>
      </button>
      <button class="tab" :class="{ 'is-active': tab === 'post' }" @click="tab = 'post'">
        长文
        <span class="tab-num">{{ counts.post }}</span>
      </button>
      <button class="tab" :class="{ 'is-active': tab === 'note' }" @click="tab = 'note'">
        随笔
        <span class="tab-num">{{ counts.note }}</span>
      </button>
    </div>

    <p v-if="loading" class="state-tip">读取中…</p>
    <p v-else-if="errorMsg" class="state-tip is-error">{{ errorMsg }}</p>

    <!-- 提示条固定在这一行，不占位，出现时不把下面的卡片挤下去 -->
    <div class="notice-slot">
      <span v-if="notice" class="notice" :class="{ 'is-error': noticeIsError }">{{ notice }}</span>
    </div>

    <p v-if="!loading && !errorMsg && visiblePosts.length === 0" class="state-tip">
      {{ tab === 'note' ? '还没有随笔。' : tab === 'post' ? '还没有长文。' : '还没有文章。' }}
    </p>

    <div class="card-list">
      <article v-for="post in visiblePosts" :key="post.id" class="pcard">
        <div class="pcard-body">
          <div class="pcard-head">
            <span class="vis" :class="{ 'is-member': post.visibility === 'member' }">
              {{ post.visibility === 'member' ? '登录可见' : '公开' }}
            </span>
            <!-- 随笔和长文混在一起时（全部标签下）才需要标一下，
                 切到具体标签后整屏都是同一类，标记就是噪音了 -->
            <span v-if="post.type === 'note' && tab === 'all'" class="type-note">随笔</span>
            <RouterLink :to="`/post/${post.id}`" class="pcard-title">
              {{ post.title }}
            </RouterLink>
          </div>

          <p class="pcard-summary">{{ post.summary }}</p>

          <div class="pcard-meta">
            <span>{{ post.category }}</span>
            <span>{{ formatDate(post.createdAt) }}</span>
            <span>{{ post.views }} 阅读</span>
            <span>{{ post.likeCount }} 赞</span>
          </div>
        </div>

        <div class="pcard-actions">
          <button
            class="act"
            :disabled="togglingId === post.id"
            @click="toggleVisibility(post)"
          >
            {{ post.visibility === 'public' ? '设为登录可见' : '设为公开' }}
          </button>
          <RouterLink :to="`/admin/posts/${post.id}/edit`" class="act">编辑</RouterLink>

          <!-- 两步删除：点第一次变成「确认删除」，点第二次才真删 -->
          <template v-if="pendingDeleteId === post.id">
            <button class="act is-danger" :disabled="deleting" @click="removePost(post)">
              {{ deleting ? '删除中…' : '确认删除' }}
            </button>
            <button class="act is-ghost" @click="pendingDeleteId = null">取消</button>
          </template>
          <button v-else class="act is-ghost" @click="pendingDeleteId = post.id">删除</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
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

.head-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.head-count {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-faint);
}

.new-btn {
  min-height: 36px;
  padding: 0 18px;
  font-size: 12.5px;
}

/* ---------- 长文 / 随笔切换 ---------- */
/* 和留言管理的标签栏保持同一套视觉，后台里同类控件不该长两副样子 */
.tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 10px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 14px;
  border: none;
  border-bottom: 1.5px solid transparent;
  background: none;
  font-size: 13.5px;
  color: var(--text-dim);
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease;
}

.tab:hover {
  color: var(--text);
}

.tab.is-active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-num {
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 0 5px;
  min-width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background-color: rgba(167, 155, 255, 0.1);
  color: var(--text-faint);
  line-height: 1;
}

/* 提示条：高度写死，出现时不引起布局跳动 */
.notice-slot {
  height: 30px;
  display: flex;
  align-items: center;
}

.notice {
  font-size: 12.5px;
  color: var(--accent);
}

.notice.is-error {
  color: var(--danger);
}

/* 后台里状态提示只是个小条，不需要前台那种整屏留白 */
.state-tip {
  padding: 26px 0;
}

/* ---------- 卡片列表 ---------- */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pcard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 16px 18px;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  transition: border-color 0.16s ease;
}

.pcard:hover {
  border-color: var(--line-strong);
}

.pcard-body {
  min-width: 0;
  flex: 1;
}

.pcard-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.vis {
  flex-shrink: 0;
  padding: 1px 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  font-size: 10.5px;
  color: var(--text-dim);
}

.vis.is-member {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.3);
  background-color: var(--accent-dim);
}

.type-note {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 3px;
  border: 1px dashed var(--line-strong);
  font-size: 10.5px;
  color: var(--text-faint);
}

.pcard-title {
  font-size: 15px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.16s ease;
}

.pcard-title:hover {
  color: var(--accent);
}

.pcard-summary {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-dim);
  /* 摘要最多两行，卡片高度才整齐 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pcard-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

/* ---------- 操作按钮 ---------- */
.pcard-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background-color: transparent;
  font-size: 12.5px;
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.16s ease, border-color 0.16s ease;
}

.act:hover:not(:disabled) {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.35);
}

.act:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 无边框的次要操作，比如「取消」和「删除」的第一步 */
.act.is-ghost {
  border-color: transparent;
  color: var(--text-dim);
}

.act.is-danger {
  color: var(--danger);
  border-color: rgba(232, 135, 154, 0.4);
}

.act.is-danger:hover:not(:disabled) {
  color: #f2a3b2;
  border-color: rgba(232, 135, 154, 0.6);
}

/* ---------- 手机 ---------- */
@media (max-width: 768px) {
  .page-title {
    font-size: 21px;
  }

  .head-actions {
    gap: 8px;
  }

  .new-btn {
    min-height: 36px;
    padding: 0 14px;
    font-size: 12.5px;
  }

  /* 手机上三个标签平分一行，手指点得准 */
  .tabs {
    gap: 0;
  }

  .tab {
    padding: 0 10px;
    font-size: 13px;
    flex: 1;
    justify-content: center;
  }

  /* 手机上卡片竖排：正文一股，按钮一行横排到底部 */
  .pcard {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 14px;
  }

  .pcard-actions {
    flex-wrap: wrap;
    border-top: 1px solid var(--line);
    padding-top: 12px;
  }

  /* 按钮撑到 40px，手指点得准 */
  .act {
    min-height: 40px;
    flex: 1;
    min-width: 78px;
  }
}
</style>
