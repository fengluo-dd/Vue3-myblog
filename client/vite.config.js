import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置文件：整个构建工具只需要这一个文件
export default defineConfig({
  // 让 Vite 能编译 .vue 单文件组件
  plugins: [vue()],
  server: {
    port: 5173,
    // 启动时不自动弹浏览器，你想看的时候自己点终端里打印的地址
    open: false,
    // 代理：浏览器请求 /api/xxx 时，Vite 帮你转发到 3000 端口的 Express
    // 好处是浏览器眼里前后端同源，不存在跨域问题，也不用配 CORS
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // 上传的图片存在 Express 那边，也要一起转发，
      // 否则页面上的 <img src="/uploads/xxx.jpg"> 会打到 Vite 自己身上变 404
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
