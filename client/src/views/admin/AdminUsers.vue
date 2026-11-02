<script setup>
import { computed, onMounted, ref } from 'vue'
import { deleteUser, fetchAdminUsers, updateUserRole } from '../../api'
import { formatDate } from '../../utils/format'
import { useUserStore } from '../../stores/user'

const userStore = useUserStore()

// 当前登录的人。用来标记「当前登录」，也用来隐藏自己的操作按钮
const myId = computed(() => userStore.user?.id)

const users = ref([])
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

/* ---------- 汇总 ---------- */

const counts = computed(() => ({
  all: users.value.length,
  admin: users.value.filter((u) => u.role === 'admin').length,
  reader: users.value.filter((u) => u.role === 'reader').length
}))

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    users.value = await fetchAdminUsers()
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------- 改角色 ---------- */

// 正在请求的用户 id，用来把这一行的按钮置灰，避免连点
const workingId = ref(null)

async function toggleRole(user) {
  const next = user.role === 'admin' ? 'reader' : 'admin'
  workingId.value = user.id
  try {
    await updateUserRole(user.id, next)
    user.role = next
    showNotice(next === 'admin' ? `${user.username} 已升为管理员` : `${user.username} 已降为读者`)
  } catch (err) {
    showNotice(err.message, true)
  } finally {
    workingId.value = null
  }
}

/* ---------- 删除 ---------- */

const pendingDeleteId = ref(null)
const deleting = ref(false)

async function remove(user) {
  deleting.value = true
  try {
    const result = await deleteUser(user.id)
    users.value = users.value.filter((u) => u.id !== user.id)
    pendingDeleteId.value = null

    const extra = result.deletedComments > 0 ? `，连带删除 ${result.deletedComments} 条留言` : ''
    showNotice(`已删除 ${user.username}${extra}`)
  } catch (err) {
    showNotice(err.message, true)
  } finally {
    deleting.value = false
  }
}

function initial(name) {
  return name ? name.slice(0, 1).toUpperCase() : '?'
}
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">accounts</p>
        <h1 class="page-title">账号管理</h1>
      </div>
      <span class="head-count">
        共 {{ counts.all }} 个 · 管理员 {{ counts.admin }} · 读者 {{ counts.reader }}
      </span>
    </header>

    <p v-if="loading" class="state-tip">读取中…</p>
    <p v-else-if="errorMsg" class="state-tip is-error">{{ errorMsg }}</p>

    <div class="notice-slot">
      <span v-if="notice" class="notice" :class="{ 'is-error': noticeIsError }">{{ notice }}</span>
    </div>

    <div class="ulist">
      <article
        v-for="user in users"
        :key="user.id"
        class="ucard"
        :class="{ 'is-admin': user.role === 'admin' }"
      >
        <div class="ucard-main">
          <span class="uavatar">{{ initial(user.username) }}</span>

          <div class="uinfo">
            <div class="uname-row">
              <span class="uname">{{ user.username }}</span>
              <span class="urole" :class="{ 'is-admin': user.role === 'admin' }">
                {{ user.role === 'admin' ? '管理员' : '读者' }}
              </span>
              <!-- 主管理员徽章。这个身份来自数据库的 is_owner 字段，
                   不是靠「名字叫 admin」猜的 —— 用户名随时能改，身份不能。 -->
              <span v-if="user.isOwner" class="uowner">主管理员</span>
              <span v-if="user.id === myId" class="uself">当前登录</span>
            </div>
            <div class="umeta">
              <span>注册于 {{ formatDate(user.createdAt) }}</span>
              <span>{{ user.commentCount }} 条留言</span>
            </div>
          </div>
        </div>

        <div class="uactions">
          <!-- 自己的那一行不给操作按钮。
               后端也会拒（400），但界面先不给，省得用户白点一次 -->
          <template v-if="user.id === myId">
            <span class="uhint">不能修改或删除自己</span>
          </template>

          <!-- 主管理员是根账号：别人改了它，后台就等于易主了。
               后端会返回 403 兜住，这里同样先不给按钮。 -->
          <template v-else-if="user.isOwner">
            <span class="uhint">主管理员账号受保护</span>
          </template>

          <template v-else>
            <button class="act" :disabled="workingId === user.id" @click="toggleRole(user)">
              {{ workingId === user.id ? '处理中…' : user.role === 'admin' ? '降为读者' : '设为管理员' }}
            </button>

            <template v-if="pendingDeleteId === user.id">
              <button class="act is-danger" :disabled="deleting" @click="remove(user)">
                {{ deleting ? '删除中…' : user.commentCount > 0 ? `确认删除，连带 ${user.commentCount} 条留言` : '确认删除' }}
              </button>
              <button class="act is-ghost" @click="pendingDeleteId = null">取消</button>
            </template>
            <button v-else class="act is-ghost" @click="pendingDeleteId = user.id">删除</button>
          </template>
        </div>
      </article>
    </div>

    <p class="tips">
      说明：删除账号会连带删掉这个人发过的全部留言（数据库外键级联）。<br />
      不能修改或删除自己，也不能把最后一个管理员降级 —— 否则后台就再没人进得来了。<br />
      标了「主管理员」的账号是根账号，任何人都不能改它的角色或删除它。
    </p>
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

.head-count {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-faint);
  padding-bottom: 4px;
}

.state-tip {
  padding: 26px 0;
}

/* 提示条高度写死，出现时不把下面的卡片挤下去 */
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

/* ---------- 卡片 ---------- */
.ulist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ucard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 18px;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  transition: border-color 0.16s ease;
}

.ucard:hover {
  border-color: var(--line-strong);
}

/* 管理员左边加一道橙边，一眼分出谁是管理者 */
.ucard.is-admin {
  border-left: 2px solid rgba(240, 168, 104, 0.5);
}

.ucard-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.uavatar {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(167, 155, 255, 0.12);
  border: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-dim);
}

.uinfo {
  min-width: 0;
}

.uname-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.uname {
  font-size: 14.5px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.urole {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 3px;
  border: 1px solid var(--line);
  font-size: 10.5px;
  color: var(--text-dim);
}

.urole.is-admin {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.3);
  background-color: var(--accent-dim);
}

/* 主管理员用实心橙色，和普通管理员的「描边徽章」区分开，
   一眼就能看出哪个账号是不能动的那个 */
.uowner {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 3px;
  font-size: 10.5px;
  letter-spacing: 0.02em;
  color: var(--bg-deep);
  background-color: var(--accent);
}

.uself {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-faint);
}

.umeta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

/* ---------- 操作 ---------- */
.uactions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.uhint {
  font-size: 11.5px;
  color: var(--text-faint);
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

/* ---------- 底部说明 ---------- */
.tips {
  margin: 26px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  line-height: 1.9;
  color: var(--text-faint);
}

/* ---------- 手机 ---------- */
@media (max-width: 768px) {
  .page-title {
    font-size: 21px;
  }

  /* 手机上那行统计太长，只留总数 */
  .head-count {
    font-size: 11px;
  }

  .ucard {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 14px;
  }

  .uactions {
    flex-wrap: wrap;
    border-top: 1px solid var(--line);
    padding-top: 12px;
  }

  .act {
    min-height: 40px;
    flex: 1;
    min-width: 90px;
  }

  .uhint {
    padding: 4px 0;
  }

  .tips {
    font-size: 11.5px;
  }
}
</style>
