<script setup>
import CommentSection from '../components/CommentSection.vue'
</script>

<template>
  <div class="container page">
    <header class="gb-head">
      <h1 class="section-title">留言板</h1>
      <p class="section-desc">
        一个开放的讨论区。说点什么，或者接着别人的话往下聊——点每句话下面的「回复」就能挂在那一条下面。
      </p>
    </header>

    <!-- 不传 postId 就是公共留言板。整个发言、回复、加载的逻辑都在组件里，
         文章详情页用的是同一个组件，只是传了 postId -->
    <CommentSection />
  </div>
</template>

<style scoped>
.gb-head {
  margin-bottom: 30px;
}

/* 原来这里的输入框、留言列表样式全部搬进了 CommentSection.vue，
   因为这个页面现在只负责标题，剩下的两处共用 */
</style>
