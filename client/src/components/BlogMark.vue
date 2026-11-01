<script setup>
// 站标：圆环里一弯月牙。
//
// 形状是一条闭合路径：外弧沿大圆走左侧，内弧沿另一个等大的圆走回来，
// 两个圆只错开 10px，剩下的就是月牙的厚度。
// 错开量再大就变成香蕉，再小就成了两根重叠的线。
//
// 仍然是 SVG 手绘：没有水印，retina 不糊，颜色跟着 --accent 走。
</script>

<template>
  <svg class="blog-mark" viewBox="0 0 200 200" role="img" aria-label="枫落站标">
    <defs>
      <filter id="mark-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- 圆环 -->
    <circle
      cx="100"
      cy="100"
      r="78"
      fill="none"
      stroke="var(--accent)"
      stroke-width="1.4"
      opacity="0.9"
      filter="url(#mark-glow)"
    />

    <!-- 月牙：先绕中心逆时针转 14°，开口朝右上，比正着放更有"夜"的姿态；
         再整体往右上挪一点——月牙的实体天生偏左下，不挪的话整个圆环看着往左倒。
         最后那个 1.12 是整组等比放大：连厚度一起放大，
         只加半径的话月牙会越放越细，变成两道弧 -->
    <g
      transform="translate(12 -2) rotate(-14 100 100) translate(100 100) scale(1.12) translate(-100 -100)"
      filter="url(#mark-glow)"
    >
      <path
        d="M88.03 55.58
           A46 46 0 1 0 121.97 140.43
           A46 46 0 0 1 88.03 55.58 Z"
        fill="var(--accent)"
        fill-opacity="0.16"
        stroke="var(--accent)"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </g>

    <!-- 月牙让出了右上角一大片，补一颗伴星把重心吊住。
         这里是「远星」不是「第二主角」：尺寸压到 1.1、颜色改用同色系的暗橙、
         透明度 0.4——纯白小圆点在这片深蓝里太跳，会跟月牙抢视线 -->
    <circle cx="140" cy="72" r="1.3" fill="var(--accent)" opacity="0.5" />
  </svg>
</template>

<style scoped>
.blog-mark {
  display: block;
  width: 100%;
  height: 100%;
  /* 光晕会溢出 viewBox，别裁掉 */
  overflow: visible;
}
</style>
