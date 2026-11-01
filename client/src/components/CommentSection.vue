<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { createComment, fetchComments } from '../api'
import { formatDateTime } from '../utils/format'
import { useUserStore } from '../stores/user'

/**
 * 评论区：留言板和文章详情共用一套。
 *
 * 唯一区别是这个 prop：
 *   postId = null  -> 公共留言板（后端的 post_id IS NULL）
 *   postId = 12    -> 第 12 篇文章下面的评论
 *
 * 抽成一个组件而不是写两遍，是因为「发言、楼中楼、审核提示、未登录引导」
 * 这一整套逻辑一模一样。复制两份的话，改个文案要改两个地方。
 */
const props = defineProps({
  postId: { type: [Number, String], default: null }
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const threads = ref([])
const loading = ref(true)
const errorMsg = ref('')

const notice = ref('')
const noticeIsError = ref(false)
let noticeTimer = null

function showNotice(text, isError = false) {
  notice.value = text
  noticeIsError.value = isError
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 3600)
}

// 顶层输入
const draft = ref('')
const submitting = ref(false)

// 展开中的回复框。同一时刻只允许开一个，否则页面上会同时冒出好几个输入框
// { commentId, parentId, toName }
const replyTarget = ref(null)
const replyDraft = ref('')
const replySubmitting = ref(false)

const total = computed(() =>
  threads.value.reduce((sum, t) => sum + 1 + t.replies.length, 0)
)

// 登录后回到当前页面（文章详情会回到那篇文章，留言板回到留言板）
const loginTarget = computed(() => ({
  name: 'login',
  query: { redirect: route.fullPath }
}))

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    threads.value = await fetchComments(props.postId)
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 在文章之间跳转时组件会被复用，必须重新拉：不能把 A 的评论留在 B 下面
watch(() => props.postId, load)

function gotoLogin() {
  router.push(loginTarget.value)
}

/* ---------- 发表顶层留言 ---------- */

async function submitTop() {
  if (!userStore.isLoggedIn) {
    gotoLogin()
    return
  }

  const text = draft.value.trim()
  if (!text) {
    showNotice('写点什么再发吧。', true)
    return
  }

  submitting.value = true
  try {
    await createComment(text, props.postId)
    draft.value = ''
    showNotice('已发表。')
    // 不再有审核环节，重新拉一次就能看到自己刚发的那条
    load()
  } catch (err) {
    // 401 说明登录态失效了（不是「没登录」，那种情况按钮已经换成登录入口了）
    if (err.status === 401) {
      gotoLogin()
      return
    }
    showNotice(err.message, true)
  } finally {
    submitting.value = false
  }
}

/* ---------- 楼中楼 ---------- */

function openReply(commentId, parentId, toName) {
  if (!userStore.isLoggedIn) {
    gotoLogin()
    return
  }

  // 再点一次同一条就收起，省得再去找取消按钮
  if (replyTarget.value?.commentId === commentId) {
    replyTarget.value = null
    return
  }

  replyTarget.value = { commentId, parentId, toName }
  replyDraft.value = ''
}

function closeReply() {
  replyTarget.value = null
  replyDraft.value = ''
}

async function submitReply() {
  const target = replyTarget.value
  if (!target) return

  const text = replyDraft.value.trim()
  if (!text) {
    showNotice('回复内容不能为空。', true)
    return
  }

  replySubmitting.value = true
  try {
    // parentId 传的是「楼层 id」：回复别人的回复时，也被后端归到同一层
    await createComment(text, props.postId, target.parentId)
    closeReply()
    showNotice(`已回复 ${target.toName}。`)
    load()
  } catch (err) {
    if (err.status === 401) {
      gotoLogin()
      return
    }
    showNotice(err.message, true)
  } finally {
    replySubmitting.value = false
  }
}
</script>

<template>
  <div class="comments">
    <!-- ---------- 发表区 ---------- -->
    <div v-if="userStore.isLoggedIn" class="compose">
      <textarea
        v-model="draft"
        maxlength="500"
        :placeholder="postId ? '说点什么……（最多 500 字）' : '写下你的留言……（最多 500 字）'"
      ></textarea>

      <div class="compose-foot">
        <span class="compose-hint" :class="{ 'is-error': noticeIsError }">
          {{ notice || `${draft.length} / 500` }}
        </span>
        <button class="btn" :disabled="submitting" @click="submitTop">
          {{ submitting ? '提交中…' : postId ? '发表评论' : '留言' }}
        </button>
      </div>
    </div>

    <div v-else class="compose-login">
      <p class="compose-login-text">登录之后就能留言，也能回复别人的话。</p>
      <RouterLink :to="loginTarget" class="btn">去登录</RouterLink>
    </div>

    <!-- ---------- 列表 ---------- -->
    <p v-if="loading" class="state-tip">正在读取…</p>

    <div v-else-if="errorMsg" class="state-tip state-error">
      <p>{{ errorMsg }}</p>
      <button class="btn btn-ghost" @click="load">重试</button>
    </div>

    <template v-else>
      <p class="cm-count">{{ total }} 条讨论</p>

      <div class="thread-list">
        <article v-for="thread in threads" :key="thread.id" class="thread">
          <!-- 顶层留言 -->
          <div class="cm-item">
            <div class="avatar">{{ thread.nickname.slice(0, 1) }}</div>
            <div class="cm-body">
              <div class="cm-meta">
                <span class="cm-name">{{ thread.nickname }}</span>
                <span class="cm-time">{{ formatDateTime(thread.createdAt) }}</span>
              </div>
              <p class="cm-text">{{ thread.content }}</p>
              <button class="cm-reply-btn" @click="openReply(thread.id, thread.id, thread.nickname)">
                {{ replyTarget?.commentId === thread.id ? '取消回复' : '回复' }}
              </button>
            </div>
          </div>

          <!-- 回复顶层留言的输入框 -->
          <div v-if="replyTarget?.commentId === thread.id" class="reply-box">
            <textarea
              v-model="replyDraft"
              maxlength="500"
              :placeholder="`回复 ${replyTarget.toName}……`"
            ></textarea>
            <div class="reply-foot">
              <span class="reply-hint">{{ replyDraft.length }} / 500</span>
              <button class="act-btn" @click="closeReply">取消</button>
              <button class="btn reply-submit" :disabled="replySubmitting" @click="submitReply">
                {{ replySubmitting ? '提交中…' : '回复' }}
              </button>
            </div>
          </div>

          <!-- 楼内回复 -->
          <div v-if="thread.replies.length" class="reply-list">
            <div v-for="reply in thread.replies" :key="reply.id" class="reply">
              <div class="cm-item">
                <div class="avatar is-small">{{ reply.nickname.slice(0, 1) }}</div>
                <div class="cm-body">
                  <div class="cm-meta">
                    <span class="cm-name">{{ reply.nickname }}</span>
                    <!-- 回复的是别人时才显示 @，自己回自己不啰嗦 -->
                    <span
                      v-if="reply.replyToName && reply.replyToName !== reply.nickname"
                      class="cm-at"
                    >
                      回复 @{{ reply.replyToName }}
                    </span>
                    <span class="cm-time">{{ formatDateTime(reply.createdAt) }}</span>
                  </div>
                  <p class="cm-text">{{ reply.content }}</p>
                  <button
                    class="cm-reply-btn"
                    @click="openReply(reply.id, thread.id, reply.nickname)"
                  >
                    {{ replyTarget?.commentId === reply.id ? '取消回复' : '回复' }}
                  </button>
                </div>
              </div>

              <!-- 回复某条回复的输入框：挂在楼内，但提交时归属还是这个楼层 -->
              <div v-if="replyTarget?.commentId === reply.id" class="reply-box is-nested">
                <textarea
                  v-model="replyDraft"
                  maxlength="500"
                  :placeholder="`回复 ${replyTarget.toName}……`"
                ></textarea>
                <div class="reply-foot">
                  <span class="reply-hint">{{ replyDraft.length }} / 500</span>
                  <button class="act-btn" @click="closeReply">取消</button>
                  <button
                    class="btn reply-submit"
                    :disabled="replySubmitting"
                    @click="submitReply"
                  >
                    {{ replySubmitting ? '提交中…' : '回复' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <p v-if="threads.length === 0" class="cm-empty">
        {{ postId ? '还没有评论，来说第一句。' : '还没有人留言，来做第一个。' }}
      </p>

      <!-- 提示条放在底部，手机上不会被键盘顶掉 -->
      <p v-if="notice && !userStore.isLoggedIn" class="cm-notice">{{ notice }}</p>
    </template>
  </div>
</template>

<style scoped>
/* ==========================================================
   评论区（留言板 / 文章详情共用）
   ========================================================== */

/* ---------- 发表区 ---------- */
.compose {
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 30px;
}

.compose textarea {
  width: 100%;
  min-height: 104px;
  border: 1px solid var(--line);
  border-radius: 8px;
  /* 比卡片深一点就够，纯黑会像在深蓝上挖了个洞 */
  background-color: rgba(11, 16, 38, 0.55);
  padding: 13px 15px;
  resize: vertical;
  outline: none;
  line-height: 1.75;
  font-size: 14.5px;
  transition: border-color 0.18s ease;
}

.compose textarea::placeholder {
  color: var(--text-faint);
}

.compose textarea:focus {
  border-color: rgba(240, 168, 104, 0.5);
}

.compose-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
}

.compose-hint {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-faint);
}

.compose-hint.is-error {
  color: var(--danger);
}

/* 未登录时的替代块：不摆一个点了没反应的输入框 */
.compose-login {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  padding: 18px 20px;
  margin-bottom: 30px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background-color: rgba(18, 26, 58, 0.4);
}

.compose-login-text {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-dim);
}

/* ---------- 统计 ---------- */
.cm-count {
  margin: 0 0 4px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

/* ---------- 一条顶层讨论 ---------- */
.thread-list {
  display: flex;
  flex-direction: column;
}

.thread {
  padding: 22px 0;
  border-bottom: 1px solid var(--line);
}

.thread:last-child {
  border-bottom: none;
}

.cm-item {
  display: flex;
  gap: 14px;
}

.avatar {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background-color: var(--accent-dim);
  border: 1px solid rgba(240, 168, 104, 0.25);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}

.avatar.is-small {
  width: 28px;
  height: 28px;
  font-size: 12px;
}

.cm-body {
  flex: 1;
  min-width: 0;
}

.cm-meta {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.cm-name {
  font-size: 14px;
  font-weight: 500;
}

/* 「回复 @某人」：用强调色的唯一新增落点，一眼看出这句话是回给谁的 */
.cm-at {
  font-size: 11.5px;
  color: var(--accent);
}

.cm-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

.cm-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.8;
  word-break: break-word;
}

/* 文字型的「回复」按钮，不抢视觉，但点击区仍然够大 */
.cm-reply-btn {
  min-height: 32px;
  margin-top: 6px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12.5px;
  color: var(--text-faint);
  cursor: pointer;
  transition: color 0.16s ease;
}

.cm-reply-btn:hover {
  color: var(--accent);
}

/* ---------- 楼内回复 ---------- */
.reply-list {
  margin: 12px 0 0 52px;
  padding-left: 16px;
  border-left: 1px solid var(--line);
}

.reply {
  padding: 12px 0;
}

.reply:first-child {
  padding-top: 2px;
}

.reply .cm-text {
  font-size: 13.5px;
  color: var(--text-dim);
}

/* ---------- 回复输入框 ---------- */
.reply-box {
  margin: 12px 0 0 52px;
}

/* 挂在楼内的输入框已经缩进过了，不要再叠一层 */
.reply-box.is-nested {
  margin-left: 42px;
}

.reply-box textarea {
  width: 100%;
  min-height: 76px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background-color: rgba(11, 16, 38, 0.55);
  padding: 10px 13px;
  resize: vertical;
  outline: none;
  line-height: 1.7;
  font-size: 13.5px;
  transition: border-color 0.18s ease;
}

.reply-box textarea::placeholder {
  color: var(--text-faint);
}

.reply-box textarea:focus {
  border-color: rgba(240, 168, 104, 0.5);
}

.reply-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.reply-hint {
  margin-right: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

.act-btn {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  font-size: 12.5px;
  color: var(--text-dim);
  cursor: pointer;
}

.act-btn:hover {
  color: var(--text);
}

.reply-submit {
  min-height: 34px;
  padding: 0 18px;
  font-size: 13px;
}

/* ---------- 空状态 ---------- */
.cm-empty {
  padding: 34px 0;
  text-align: center;
  font-size: 13.5px;
  color: var(--text-faint);
}

.cm-notice {
  margin: 10px 0 0;
  font-size: 12.5px;
  color: var(--accent);
}

/* ---------- 手机 ---------- */
@media (max-width: 768px) {
  .compose {
    padding: 16px;
  }

  /* 缩进少一点，390px 下才留得住正文宽度 */
  .reply-list {
    margin-left: 26px;
    padding-left: 12px;
  }

  .reply-box {
    margin-left: 0;
  }

  .reply-box.is-nested {
    margin-left: 0;
  }

  .avatar {
    width: 34px;
    height: 34px;
    font-size: 14px;
  }

  .avatar.is-small {
    width: 26px;
    height: 26px;
    font-size: 11px;
  }

  .cm-item {
    gap: 11px;
  }

  /* 触控区补到 40px */
  .cm-reply-btn {
    min-height: 40px;
  }

  .act-btn,
  .reply-submit {
    min-height: 40px;
  }
}
</style>
