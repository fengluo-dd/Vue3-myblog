<script setup>
import { computed, onMounted, ref } from 'vue'
import { deleteComment, deleteComments, fetchAdminComments } from '../../api'
import { formatDateTime } from '../../utils/format'

// 审核已经停用：留言发出来就直接显示，所以这里没有「通过 / 打回」，
// 这个页面只剩下两件事 —— 看全部留言、删掉不该留的（单条或一批）。
const comments = ref([])
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
  }, 2600)
}

/**
 * @param {boolean} silent 静默刷新：不显示「读取中」，删完一条后刷新列表用。
 *   不加这个的话，每删一次整页都会闪一下「读取中」，很难受。
 */
async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  errorMsg.value = ''
  try {
    comments.value = await fetchAdminComments()
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------- 勾选 ---------- */

const selectedIds = ref([])
// 批量删除的二次确认状态。放在这里而不是下面，是因为 toggleAll 要重置它
const confirming = ref(false)

const allSelected = computed(
  () => comments.value.length > 0 && selectedIds.value.length === comments.value.length
)

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : comments.value.map((c) => c.id)
  confirming.value = false
}

function toggleOne(id) {
  const i = selectedIds.value.indexOf(id)
  if (i > -1) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
  // 勾选变了，之前点开的「确认删除」就不作数了，避免删错
  confirming.value = false
}

/* ---------- 单条删除 ---------- */

const pendingDeleteId = ref(null)
const deleting = ref(false)

async function remove(comment) {
  deleting.value = true
  try {
    await deleteComment(comment.id)
    pendingDeleteId.value = null
    // 从勾选里摘掉，否则批量删除时还会带上一个已经不存在的 id
    selectedIds.value = selectedIds.value.filter((id) => id !== comment.id)
    showNotice('已删除')
    // 删父留言会级联删掉回复，本地过滤算不干净，重新拉一遍最稳
    await load({ silent: true })
  } catch (err) {
    showNotice(err.message, true)
  } finally {
    deleting.value = false
  }
}

/* ---------- 批量删除 ---------- */

const bulkDeleting = ref(false)

async function removeSelected() {
  if (selectedIds.value.length === 0) return

  bulkDeleting.value = true
  try {
    const result = await deleteComments(selectedIds.value)
    confirming.value = false
    selectedIds.value = []
    showNotice(`已删除 ${result.deleted} 条`)
    await load({ silent: true })
  } catch (err) {
    showNotice(err.message, true)
  } finally {
    bulkDeleting.value = false
  }
}

// 昵称首字做头像，和前台讨论区保持一致的视觉
function initial(name) {
  return name ? name.slice(0, 1).toUpperCase() : '?'
}
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">comments</p>
        <h1 class="page-title">留言管理</h1>
      </div>
      <span class="head-hint">共 {{ comments.length }} 条</span>
    </header>

    <!-- 批量操作条：列表空的时候整条不出现，不占地方 -->
    <div v-if="comments.length" class="bulk">
      <label class="bulk-all">
        <input type="checkbox" :checked="allSelected" @change="toggleAll" />
        <span>全选</span>
      </label>

      <span class="bulk-count">
        {{ selectedIds.length ? `已选 ${selectedIds.length} 条` : '勾选后可以一次删掉多条' }}
      </span>

      <div class="bulk-actions">
        <!-- 两步确认：批量删是不可逆的，不能一点就没了 -->
        <template v-if="confirming">
          <span class="bulk-warn">连带删掉它们下面的回复</span>
          <button class="act is-danger" :disabled="bulkDeleting" @click="removeSelected">
            {{ bulkDeleting ? '删除中…' : `确认删除 ${selectedIds.length} 条` }}
          </button>
          <button class="act is-ghost" @click="confirming = false">取消</button>
        </template>
        <button
          v-else
          class="act is-danger"
          :disabled="selectedIds.length === 0"
          @click="confirming = true"
        >
          批量删除
        </button>
      </div>
    </div>

    <div class="notice-slot">
      <span v-if="notice" class="notice" :class="{ 'is-error': noticeIsError }">{{ notice }}</span>
    </div>

    <p v-if="loading" class="state-tip">读取中…</p>
    <p v-else-if="errorMsg" class="state-tip is-error">{{ errorMsg }}</p>
    <p v-else-if="comments.length === 0" class="state-tip">还没有留言。</p>

    <div v-else class="clist">
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="citem"
        :class="{
          'is-reply': comment.parentId,
          'is-picked': selectedIds.includes(comment.id)
        }"
      >
        <div class="citem-head">
          <label class="pick">
            <input
              type="checkbox"
              :checked="selectedIds.includes(comment.id)"
              @change="toggleOne(comment.id)"
            />
          </label>
          <span class="cavatar">{{ initial(comment.nickname) }}</span>
          <span class="cname">{{ comment.nickname }}</span>
          <span class="ctime">{{ formatDateTime(comment.createdAt) }}</span>
        </div>

        <!-- 来源：得知道这条是发在留言板还是某篇博文下面 -->
        <div class="corigin">
          <span class="corigin-src">
            {{ comment.postId ? `博文 · ${comment.postTitle || '已删除的文章'}` : '留言板' }}
          </span>
          <span v-if="comment.parentId" class="corigin-reply">
            回复 @{{ comment.replyToName || '已注销用户' }}
          </span>
        </div>

        <p class="ccontent">{{ comment.content }}</p>

        <div class="cactions">
          <!-- 两步删除：点第一次变成「确认删除」，点第二次才真删 -->
          <template v-if="pendingDeleteId === comment.id">
            <button class="act is-danger" :disabled="deleting" @click="remove(comment)">
              {{ deleting ? '删除中…' : '确认删除' }}
            </button>
            <button class="act is-ghost" @click="pendingDeleteId = null">取消</button>
          </template>
          <button v-else class="act is-ghost" @click="pendingDeleteId = comment.id">删除</button>
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
  margin-bottom: 14px;
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

.head-hint {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-faint);
  padding-bottom: 4px;
}

/* ---------- 批量操作条 ---------- */
.bulk {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.bulk-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-dim);
  cursor: pointer;
}

.bulk-count {
  font-size: 12px;
  color: var(--text-faint);
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.bulk-warn {
  font-size: 11.5px;
  color: var(--danger);
}

/* 原生复选框，只改强调色，不自绘——自绘的在不同浏览器上坑太多 */
.pick input,
.bulk-all input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

.pick {
  display: inline-flex;
  align-items: center;
  /* 触控区放大，但视觉上只是个框 */
  padding: 6px 2px;
  cursor: pointer;
}

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

/* ---------- 留言卡片 ---------- */
.clist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.citem {
  padding: 14px 18px 12px;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  transition: border-color 0.16s ease;
}

/* 选中的卡片描个橙边，扫一眼知道哪几条会被删掉 */
.citem.is-picked {
  border-color: rgba(240, 168, 104, 0.75);
}

/* 回复类留言整体右缩一点，一眼能看出它挂在别人下面 */
.citem.is-reply {
  margin-left: 26px;
  border-left: 2px solid var(--line-strong);
}

.citem.is-reply.is-picked {
  border-left-color: rgba(240, 168, 104, 0.75);
}

.citem-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.cavatar {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(167, 155, 255, 0.12);
  border: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.cname {
  font-size: 13.5px;
  color: var(--text);
}

.ctime {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

/* 来源行 */
.corigin {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 11.5px;
}

.corigin-src {
  padding: 1px 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--text-faint);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.corigin-reply {
  color: var(--accent);
}

.ccontent {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-dim);
  /* 长留言不截断，后台要能看全 */
  word-break: break-word;
}

.cactions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
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
  opacity: 0.45;
  cursor: not-allowed;
}

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

  .citem {
    padding: 13px 14px 11px;
  }

  /* 手机上缩进收一半，不然卡片本身就没多少宽度了 */
  .citem.is-reply {
    margin-left: 14px;
  }

  /* 时间换行到第二行，否则昵称和时间挤成一坨 */
  .citem-head {
    flex-wrap: wrap;
    gap: 6px 8px;
  }

  /* 批量操作条：按钮撑到 40px，手指点得准 */
  .bulk {
    gap: 10px;
  }

  .bulk-count {
    flex: 1;
  }

  .bulk-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }

  .bulk-actions .act {
    min-height: 40px;
  }

  .cactions .act {
    min-height: 40px;
  }
}
</style>
