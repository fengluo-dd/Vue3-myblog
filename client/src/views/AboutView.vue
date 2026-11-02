<script setup>
// 这一页都是静态内容，想改成你自己的信息，直接改下面模板里的文字就行
const skills = [
  'HTML / CSS',
  'JavaScript',
  'Vue 2',
  'Vue 3',
  'TypeScript',
  'Node.js',
  'Express',
  'MySQL'
]
</script>

<template>
  <div class="container page">
    <h1 class="section-title">关于我</h1>
    <p class="section-desc">一个还在学习路上的人，和一些不想忘掉的事。</p>

    <section class="about-block">
      <p class="about-lead">
        我在学前端，也写一点后端。<br />
        喜欢把复杂的东西拆成能讲清楚的小块。
      </p>
      <p class="about-text">
        这个博客是我自己从零做的：前端 Vue 3 + Vite，后端 Express + MySQL，
        没有用现成的模板，也没有用 UI 组件库。写它的过程比写它的结果更有意思。
      </p>
      <p class="about-text">
        如果哪天你在这里看到某篇文章写得还行，那大概是因为我在这件事上踩过足够的坑。
      </p>
    </section>

    <section class="about-block">
      <h2 class="section-subtitle">在用的东西</h2>
      <div class="tag-group">
        <span v-for="item in skills" :key="item" class="tag">{{ item }}</span>
      </div>
    </section>

    <section class="about-block">
      <h2 class="section-subtitle">这个站点</h2>
      <ul class="info-list">
        <li>
          <span class="info-key">前端</span>
          <span>Vue 3 · Vue Router · Vite</span>
        </li>
        <li>
          <span class="info-key">后端</span>
          <span>Express · mysql2</span>
        </li>
        <li>
          <span class="info-key">数据</span>
          <span>MySQL 8 · 4 张表</span>
        </li>
        <li>
          <span class="info-key">文章格式</span>
          <span>Markdown 原文，前端渲染</span>
        </li>
        <li>
          <span class="info-key">设计</span>
          <span>手写 CSS，无组件库</span>
        </li>
      </ul>
    </section>

    <section class="about-block">
      <h2 class="section-subtitle">找我</h2>
      <ul class="info-list">
        <li>
          <span class="info-key">邮箱</span>
          <span>3404098011@qq.com</span>
        </li>
        <li>
          <span class="info-key">GitHub</span>
          <span>github.com/fengluo-dd</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
/* ==========================================================
   关于我
   ========================================================== */
.about-block {
  margin-bottom: 40px;
}

.about-lead {
  font-size: 19px;
  line-height: 1.8;
  font-weight: 500;
  margin: 0 0 20px;
  color: var(--text);
}

.about-text {
  color: var(--text-dim);
  font-size: 14.5px;
  margin: 0 0 14px;
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.tag {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.02em;
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text-dim);
  background-color: var(--surface);
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--line);
}

.info-list li {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
  color: var(--text);
}

.info-key {
  color: var(--text-faint);
  font-size: 13px;
  flex-shrink: 0;
}
</style>
