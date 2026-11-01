<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { deleteAlbum, fetchAlbums, uploadAlbum } from '../../api'
import { formatDate } from '../../utils/format'

const photos = ref([])
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

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    photos.value = await fetchAlbums()
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------- 选择文件 ---------- */

const fileInput = ref(null)
const file = ref(null)
const previewUrl = ref('')
const title = ref('')
const description = ref('')
const uploading = ref(false)

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(e) {
  const picked = e.target.files && e.target.files[0]
  if (!picked) return

  // 前端先挡一道：后端也会挡，但让用户等上传完才被告知「格式不对」很烦
  if (!picked.type.startsWith('image/')) {
    showNotice('只能选图片文件', true)
    return
  }
  if (picked.size > 5 * 1024 * 1024) {
    showNotice('图片不能超过 5MB', true)
    return
  }

  file.value = picked
  // 上一张的预览地址要回收，否则一直占内存
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(picked)
}

function resetForm() {
  file.value = null
  title.value = ''
  description.value = ''
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  if (fileInput.value) fileInput.value.value = ''
}

// 组件卸载时回收预览 URL
onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

async function submit() {
  if (!file.value) {
    showNotice('先选一张图片', true)
    return
  }

  uploading.value = true
  try {
    await uploadAlbum(file.value, title.value.trim(), description.value.trim())
    resetForm()
    showNotice('上传成功')
    // 重新拉列表：上传接口不返回 createdAt，本地拼不如直接问后端准
    await load()
  } catch (err) {
    showNotice(err.message, true)
  } finally {
    uploading.value = false
  }
}

/* ---------- 删除 ---------- */

const pendingDeleteId = ref(null)
const deleting = ref(false)

async function remove(photo) {
  deleting.value = true
  try {
    await deleteAlbum(photo.id)
    photos.value = photos.value.filter((p) => p.id !== photo.id)
    pendingDeleteId.value = null
    showNotice('已删除，服务器上的图片文件也一起清掉了')
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
        <p class="page-eyebrow">album</p>
        <h1 class="page-title">相册</h1>
      </div>
      <span class="head-count">{{ photos.length }} 张</span>
    </header>

    <div class="notice-slot">
      <span v-if="notice" class="notice" :class="{ 'is-error': noticeIsError }">{{ notice }}</span>
    </div>

    <!-- ---------- 上传 ---------- -->
    <section class="uploader">
      <div class="drop" :class="{ 'has-file': previewUrl }" @click="pickFile">
        <img v-if="previewUrl" :src="previewUrl" alt="待上传预览" />
        <div v-else class="drop-hint">
          <span class="drop-plus">+</span>
          <span>点击选择图片</span>
          <span class="drop-sub">JPG / PNG / WebP / GIF，最大 5MB</span>
        </div>
      </div>

      <div class="upload-fields">
        <label class="field">
          <span class="field-label">标题</span>
          <input v-model="title" type="text" maxlength="120" placeholder="给这张照片起个名字" />
        </label>

        <label class="field">
          <span class="field-label">说明</span>
          <textarea
            v-model="description"
            rows="2"
            maxlength="300"
            placeholder="一句话，可以留空"
          ></textarea>
        </label>

        <div class="upload-actions">
          <button v-if="file" class="act is-ghost" @click="resetForm">清空</button>
          <button class="btn upload-btn" :disabled="uploading || !file" @click="submit">
            {{ uploading ? '上传中…' : '上传' }}
          </button>
        </div>
      </div>

      <!-- 真正的文件输入藏起来，点上面的方框触发它 -->
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
    </section>

    <!-- ---------- 已有照片 ---------- -->
    <p v-if="loading" class="state-tip">读取中…</p>
    <p v-else-if="errorMsg" class="state-tip is-error">{{ errorMsg }}</p>
    <p v-else-if="photos.length === 0" class="state-tip">还没有照片。</p>

    <div v-else class="alist">
      <article v-for="photo in photos" :key="photo.id" class="acard">
        <div class="acard-img">
          <img :src="photo.url" :alt="photo.title || '照片'" loading="lazy" />
        </div>

        <div class="acard-body">
          <h2 class="acard-title">{{ photo.title || '（无标题）' }}</h2>
          <p v-if="photo.description" class="acard-desc">{{ photo.description }}</p>
          <span class="acard-date">{{ formatDate(photo.createdAt) }}</span>

          <div class="acard-actions">
            <template v-if="pendingDeleteId === photo.id">
              <button class="act is-danger" :disabled="deleting" @click="remove(photo)">
                {{ deleting ? '删除中…' : '确认删除' }}
              </button>
              <button class="act is-ghost" @click="pendingDeleteId = null">取消</button>
            </template>
            <button v-else class="act is-ghost" @click="pendingDeleteId = photo.id">删除</button>
          </div>
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

.head-count {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-faint);
  padding-bottom: 4px;
}

.notice-slot {
  height: 28px;
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

.state-tip {
  padding: 26px 0;
}

/* ---------- 上传区 ---------- */
.uploader {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 18px;
  padding: 16px;
  margin-bottom: 28px;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.drop {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  background-color: rgba(11, 16, 38, 0.45);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.16s ease;
}

.drop:hover {
  border-color: rgba(240, 168, 104, 0.5);
}

.drop.has-file {
  border-style: solid;
  border-color: var(--line);
}

.drop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.drop-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-dim);
}

.drop-plus {
  font-size: 24px;
  line-height: 1;
  color: var(--text-faint);
}

.drop-sub {
  font-size: 10.5px;
  color: var(--text-faint);
}

.upload-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--text-dim);
}

.field input,
.field textarea {
  width: 100%;
  min-height: 38px;
  padding: 8px 11px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background-color: rgba(11, 16, 38, 0.55);
  font-size: 13.5px;
  color: var(--text);
  outline: none;
  resize: vertical;
  transition: border-color 0.16s ease;
}

.field input:focus,
.field textarea:focus {
  border-color: rgba(240, 168, 104, 0.5);
}

.field input::placeholder,
.field textarea::placeholder {
  color: var(--text-faint);
}

.upload-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
}

.upload-btn {
  min-height: 38px;
  padding: 0 22px;
  font-size: 13px;
}

/* ---------- 已有照片 ---------- */
.alist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
}

.acard {
  display: flex;
  flex-direction: column;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.acard-img {
  aspect-ratio: 4 / 3;
  background-color: var(--surface-2);
  overflow: hidden;
}

.acard-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.acard-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 14px 10px;
  flex: 1;
}

.acard-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 400;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acard-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-dim);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.acard-date {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-faint);
}

.acard-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background-color: transparent;
  font-size: 12px;
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
}

/* ---------- 手机 ---------- */
@media (max-width: 768px) {
  .page-title {
    font-size: 21px;
  }

  /* 手机上上传区竖排 */
  .uploader {
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 14px;
  }

  .drop {
    aspect-ratio: 16 / 9;
  }

  .upload-btn {
    flex: 1;
    min-height: 42px;
  }

  .alist {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .acard-body {
    padding: 10px 11px 8px;
  }

  .acard-title {
    font-size: 12.5px;
  }

  /* 手机上说明和删除按钮都占地方，收一收 */
  .acard-desc {
    display: none;
  }

  .act {
    min-height: 34px;
    flex: 1;
  }
}
</style>
