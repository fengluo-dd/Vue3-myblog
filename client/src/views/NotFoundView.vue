<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="container page">
    <div class="notfound">
      <p class="notfound-code">404</p>
      <p class="locked-desc">这个地址没有对应的页面。</p>
      <RouterLink to="/" class="btn">回到首页</RouterLink>
    </div>
  </div>
</template>
