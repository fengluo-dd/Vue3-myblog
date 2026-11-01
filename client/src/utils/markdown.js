import MarkdownIt from 'markdown-it'

// html: false 表示不解析原文里的 HTML 标签（防止 XSS，别人在留言或文章里塞 <script> 不会被执行）
// linkify: true 让纯文本里的网址自动变成链接
// breaks: true 让单个换行也渲染成 <br>，更符合中文写作习惯
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

export function renderMarkdown(source) {
  if (!source) return ''
  return md.render(source)
}
