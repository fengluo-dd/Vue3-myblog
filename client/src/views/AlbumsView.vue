<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { fetchAlbums } from '../api'
import { formatDate } from '../utils/format'

const photos = ref([])
const loading = ref(true)
const errorMsg = ref('')

// 点开的那张。null 表示大图关着
const active = ref(null)

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

function open(photo) {
  active.value = photo
}

function close() {
  active.value = null
}

// 看大图时按 ESC 关掉，这是看图组件的基本礼貌
function onKeydown(e) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="container page">
    <header class="albums-head">
      <p class="albums-eyebrow">photos</p>
      <h1 class="albums-title">相册</h1>
      <p class="albums-desc">随手拍下的，没什么章法。</p>
    </header>

    <p v-if="loading" class="state-tip">读取中…</p>
    <p v-else-if="errorMsg" class="state-tip is-error">{{ errorMsg }}</p>
    <p v-else-if="photos.length === 0" class="state-tip">
      还没有照片。管理员可以在后台「相册」里上传。
    </p>

    <div v-else class="grid">
      <button
        v-for="photo in photos"
        :key="photo.id"
        type="button"
        class="ph"
        @click="open(photo)"
      >
        <img :src="photo.url" :alt="photo.title || '照片'" loading="lazy" />
        <span v-if="photo.title" class="ph-cap">{{ photo.title }}</span>
      </button>
    </div>

    <!-- 大图遮罩。点击图片外面的区域关闭 -->
    <div v-if="active" class="lightbox" @click.self="close">
      <button type="button" class="lb-close" aria-label="关闭" @click="close">×</button>
      <figure class="lb-figure">
        <img :src="active.url" :alt="active.title || '照片'" />
        <figcaption class="lb-caption">
          <span v-if="active.title" class="lb-title">{{ active.title }}</span>
          <span v-if="active.description" class="lb-desc">{{ active.description }}</span>
          <span class="lb-date">{{ formatDate(active.createdAt) }}</span>
        </figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.albums-head {
  margin-bottom: 34px;
}

.albums-eyebrow {
  margin: 0 0 10px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.albums-title {
  margin: 0 0 12px;
  font-size: 30px;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.albums-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-dim);
}

/* ---------- 网格 ---------- */
.grid {
  display: grid;
  /* auto-fill + minmax：屏幕宽就多排几张，窄了就少排，不用写断点 */
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}

.ph {
  position: relative;
  display: block;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background-color: var(--surface-2);
  cursor: pointer;
  overflow: hidden;
  /* 固定比例，图片加载前就已经占好位置，不会把下面的内容顶来顶去 */
  aspect-ratio: 4 / 3;
}

.ph img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease, opacity 0.3s ease;
  opacity: 0.92;
}

.ph:hover img {
  transform: scale(1.04);
  opacity: 1;
}

/* 标题平时藏在底部，hover 才浮出来 */
.ph-cap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 22px 12px 10px;
  font-size: 12.5px;
  color: #ece9f5;
  text-align: left;
  background: linear-gradient(to top, rgba(6, 9, 22, 0.88), rgba(6, 9, 22, 0));
  opacity: 0;
  transition: opacity 0.22s ease;
}

.ph:hover .ph-cap {
  opacity: 1;
}

/* ---------- 大图 ---------- */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background-color: rgba(4, 7, 20, 0.92);
  backdrop-filter: blur(6px);
}

.lb-close {
  position: absolute;
  top: 18px;
  right: 20px;
  width: 44px;
  height: 44px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background-color: transparent;
  color: var(--text-dim);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease;
}

.lb-close:hover {
  color: var(--accent);
  border-color: rgba(240, 168, 104, 0.4);
}

.lb-figure {
  margin: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.lb-figure img {
  max-width: min(1100px, 92vw);
  max-height: 76vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 6px;
}

.lb-caption {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  text-align: center;
}

.lb-title {
  font-size: 14.5px;
  color: var(--text);
}

.lb-desc {
  font-size: 13px;
  color: var(--text-dim);
}

.lb-date {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

/* ---------- 手机 ---------- */
@media (max-width: 768px) {
  .albums-head {
    margin-bottom: 26px;
  }

  .albums-title {
    font-size: 24px;
  }

  /* 手机上固定两列，比 auto-fill 更稳（不然窄屏可能只剩一列，一屏看不了几张） */
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  /* 手机没有 hover，标题一直显示 */
  .ph-cap {
    opacity: 1;
    font-size: 11.5px;
    padding: 18px 10px 8px;
  }

  .lightbox {
    padding: 56px 12px 32px;
  }

  .lb-figure img {
    max-height: 70vh;
  }
}
</style>
