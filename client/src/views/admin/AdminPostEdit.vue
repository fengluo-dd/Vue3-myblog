<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { createPost, fetchAdminPost, updatePost } from '../../api'
import { renderMarkdown } from '../../utils/markdown'

const route = useRoute()

// 有 id 就是编辑，没有就是新建。同一个页面干两件事，
// 因为两者除了「初始数据」和「保存时调哪个接口」之外完全一样。
const postId = computed(() => route.params.id)
const isEdit = computed(() => Boolean(postId.value))

const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const errorMsg = ref('')
const notice = ref('')
let noticeTimer = null

function showNotice(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 2200)
}

const form = reactive({
  title: '',
  summary: '',
  category: '',
  type: 'post',
  visibility: 'public',
  content: ''
})

// 常用分类，点一下填进去，省得每次手打
const categoryPresets = ['随想', '前端', '后端', '生活']

// 手机上「编辑 / 预览」两个面板靠这个切；桌面是左右并排，用不到它
const mobileTab = ref('edit')

/* ---------- 实时预览 ---------- */

const previewHtml = ref('')
let previewTimer = null

// 输入防抖 200ms：每敲一个字都全量渲染一遍 Markdown，
// 文章长了会卡，等手停下来再算
watch(
  () => form.content,
  (val) => {
    clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      previewHtml.value = val.trim() ? renderMarkdown(val) : ''
    }, 200)
  },
  { immediate: true }
)

/* ---------- 加载已有文章 ---------- */

async function load() {
  // 新建时允许从列表页带类型过来（/admin/posts/new?type=note），
  // 这样在「随笔」标签下点写文章，不用再手动切一下类型
  if (!isEdit.value) {
    const preset = route.query.type
    if (preset === 'note' || preset === 'post') form.type = preset
    return
  }

  loading.value = true
  loadError.value = ''
  try {
    const data = await fetchAdminPost(postId.value)
    form.title = data.title
    form.summary = data.summary
    form.category = data.category
    form.type = data.type || 'post'
    form.visibility = data.visibility
    form.content = data.content
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------- 保存 ---------- */

// 发完一篇就把表单清空，接着写下一篇。
// type 和 visibility 故意不清：从「随笔」标签点进来时，往往要连着写好几条，
// 每次都把手动切好的类型重置回去很烦。
function resetForm() {
  form.title = ''
  form.summary = ''
  form.category = ''
  form.content = ''
  errorMsg.value = ''
  // 预览有 200ms 防抖，这里先直接抹掉，免得清空瞬间还挂着上一篇的渲染结果
  previewHtml.value = ''
  mobileTab.value = 'edit'
  clearTimeout(previewTimer)
}

async function save() {
  // 连点两下会发两次请求，第二次就是一篇重复的空文章
  if (saving.value) return

  // 上一轮的成功提示要让位：不然新报的错会被它白白遮住两秒
  notice.value = ''
  clearTimeout(noticeTimer)
  errorMsg.value = ''

  if (!form.title.trim()) {
    errorMsg.value = '标题不能为空'
    return
  }
  if (!form.category.trim()) {
    errorMsg.value = '分类不能为空'
    return
  }
  if (!form.content.trim()) {
    errorMsg.value = '正文不能为空'
    return
  }

  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      category: form.category.trim(),
      type: form.type,
      visibility: form.visibility,
      content: form.content
    }

    if (isEdit.value) {
      // 编辑已发布的文章不清空：改完还想回头看一眼是常态，
      // 手一抖点保存就把内容抹了会很难受
      await updatePost(postId.value, payload)
      showNotice('已保存')
    } else {
      await createPost(payload)
      // 清空并留在新建页（不再跳去编辑页），写完一篇能直接接着写；
      // 表单空了以后就算再点保存，也只会提示「标题不能为空」，不会发出重复文章
      resetForm()
      showNotice('已发布，可以接着写下一篇')
      window.scrollTo({ top: 0 })
    }
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    saving.value = false
  }
}

/* ---------- Ctrl+S 保存 ---------- */

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    if (!saving.value) save()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(previewTimer)
  clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="editor-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ isEdit ? 'edit' : 'new' }}</p>
        <h1 class="page-title">{{ isEdit ? '编辑文章' : '写点什么' }}</h1>
      </div>

      <div class="head-actions">
        <RouterLink to="/admin/posts" class="act is-ghost">返回列表</RouterLink>
        <RouterLink
          v-if="isEdit"
          :to="`/post/${postId}`"
          target="_blank"
          class="act"
        >
          前台查看 ↗
        </RouterLink>
        <button class="btn save-btn" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </header>

    <div class="notice-slot">
      <span v-if="notice" class="notice">{{ notice }}</span>
      <span v-else-if="errorMsg" class="notice is-error">{{ errorMsg }}</span>
      <span v-else class="notice is-dim">Ctrl + S 可以保存</span>
    </div>

    <p v-if="loading" class="state-tip">读取中…</p>
    <p v-else-if="loadError" class="state-tip is-error">{{ loadError }}</p>

    <template v-else>
      <!-- 元信息 -->
      <div class="meta-grid">
        <label class="field span-2">
          <span class="field-label">标题</span>
          <input v-model="form.title" type="text" maxlength="120" placeholder="一句话说清这篇讲什么" />
        </label>

        <label class="field">
          <span class="field-label">分类</span>
          <div class="category-row">
            <input v-model="form.category" type="text" maxlength="20" placeholder="如：随想" />
            <div class="presets">
              <button
                v-for="c in categoryPresets"
                :key="c"
                type="button"
                class="preset"
                :class="{ 'is-on': form.category === c }"
                @click="form.category = c"
              >
                {{ c }}
              </button>
            </div>
          </div>
        </label>

        <div class="field">
          <span class="field-label">类型 / 可见性</span>
          <div class="select-row">
            <select v-model="form.type">
              <option value="post">长文</option>
              <option value="note">随笔</option>
            </select>
            <select v-model="form.visibility">
              <option value="public">公开</option>
              <option value="member">登录可见</option>
            </select>
          </div>
        </div>

        <label class="field span-2">
          <span class="field-label">
            摘要
            <span class="label-hint">留空会自动从正文截一段</span>
          </span>
          <textarea v-model="form.summary" rows="2" maxlength="300" placeholder="列表页显示的那句话"></textarea>
        </label>
      </div>

      <!-- 正文 -->
      <div class="editor-head">
        <span class="editor-label">正文 · Markdown</span>

        <div class="mobile-tabs">
          <button
            type="button"
            :class="{ 'is-on': mobileTab === 'edit' }"
            @click="mobileTab = 'edit'"
          >
            编辑
          </button>
          <button
            type="button"
            :class="{ 'is-on': mobileTab === 'preview' }"
            @click="mobileTab = 'preview'"
          >
            预览
          </button>
        </div>

        <span class="editor-stat">{{ form.content.length }} 字符</span>
      </div>

      <div class="editor" :class="`mode-${mobileTab}`">
        <!-- 左边：Markdown 原文 -->
        <div class="pane pane-edit">
          <textarea
            v-model="form.content"
            class="md-input"
            spellcheck="false"
            placeholder="## 小标题&#10;&#10;正文随便写，Markdown 语法都支持。&#10;&#10;- 列表&#10;- **加粗**&#10;- `行内代码`"
          ></textarea>
        </div>

        <!-- 右边：实时渲染。用的 .prose 是全局样式（v-html 生成的节点选不中 scoped） -->
        <div class="pane pane-preview">
          <div v-if="previewHtml" class="prose preview-body" v-html="previewHtml"></div>
          <p v-else class="preview-empty">左边写点什么，这里会实时渲染。</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
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
  gap: 8px;
}

.act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background-color: transparent;
  font-size: 12.5px;
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.16s ease, border-color 0.16s ease;
}

.act:hover {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.35);
}

.act.is-ghost {
  border-color: transparent;
  color: var(--text-dim);
}

.save-btn {
  min-height: 36px;
  padding: 0 20px;
  font-size: 13px;
}

/* 提示条固定高度，出现时不推下面的内容 */
.notice-slot {
  height: 28px;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.notice {
  font-size: 12.5px;
  color: var(--accent);
}

.notice.is-error {
  color: var(--danger);
}

.notice.is-dim {
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 11px;
}

.state-tip {
  padding: 40px 0;
}

/* ---------- 元信息表单 ---------- */
.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 18px;
  margin-bottom: 22px;
}

.span-2 {
  grid-column: span 2;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.field-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-dim);
}

.label-hint {
  font-size: 11px;
  color: var(--text-faint);
}

.field input,
.field textarea,
.field select {
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background-color: rgba(11, 16, 38, 0.55);
  font-size: 14px;
  color: var(--text);
  outline: none;
  resize: vertical;
  transition: border-color 0.16s ease;
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  border-color: rgba(240, 168, 104, 0.5);
}

.field input::placeholder,
.field textarea::placeholder {
  color: var(--text-faint);
}

.select-row {
  display: flex;
  gap: 8px;
}

.select-row select {
  flex: 1;
  min-width: 0;
}

/* 常用分类小按钮 */
.category-row {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background-color: transparent;
  font-size: 11.5px;
  color: var(--text-faint);
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease;
}

.preset:hover {
  color: var(--text-dim);
}

.preset.is-on {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.35);
  background-color: var(--accent-dim);
}

/* ---------- 编辑器 ---------- */
.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.editor-label {
  font-size: 12.5px;
  color: var(--text-dim);
}

.editor-stat {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

/* 手机上的编辑/预览切换，桌面隐藏 */
.mobile-tabs {
  display: none;
}

.editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  height: 60vh;
  min-height: 400px;
  background-color: var(--line);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.pane {
  background-color: var(--surface);
  overflow-y: auto;
  min-width: 0;
}

.md-input {
  width: 100%;
  height: 100%;
  padding: 18px;
  border: 0;
  outline: none;
  resize: none;
  background-color: transparent;
  /* 写 Markdown 用等宽字，符号对齐看着舒服 */
  font-family: var(--font-mono);
  font-size: 13.5px;
  line-height: 1.95;
  color: var(--text);
}

.md-input::placeholder {
  color: var(--text-faint);
}

.preview-body {
  padding: 20px 24px;
}

.preview-empty {
  margin: 0;
  padding: 40px 24px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-faint);
}

/* ---------- 手机 ---------- */
@media (max-width: 768px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .head-actions {
    flex-wrap: wrap;
  }

  .save-btn {
    flex: 1;
    min-height: 42px;
  }

  .act {
    min-height: 42px;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }

  /* 手机上只显示一个面板，靠 tab 切 */
  .mobile-tabs {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: 6px;
  }

  .mobile-tabs button {
    min-height: 30px;
    padding: 0 14px;
    border: none;
    border-radius: 4px;
    background: none;
    font-size: 12px;
    color: var(--text-faint);
    cursor: pointer;
  }

  .mobile-tabs button.is-on {
    color: var(--accent);
    background-color: var(--accent-dim);
  }

  .editor {
    grid-template-columns: 1fr;
    height: 56vh;
  }

  .editor.mode-edit .pane-preview {
    display: none;
  }

  .editor.mode-preview .pane-edit {
    display: none;
  }
}
</style>
