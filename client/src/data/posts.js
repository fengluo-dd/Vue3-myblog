// 【已停用】阶段三起，文章和留言都从后端接口（/api/posts、/api/comments）读取，
// 页面组件已经不再 import 这个文件。
// 保留它是为了：后端没启动时，想快速切回纯前端调试，改回 import 即可。
// 内容与数据库里的 3 篇测试文章保持一致。

// 阶段一使用本地假数据，字段名与数据库 posts 表一一对应
// 阶段三接上 Express 接口后，这个文件会被 axios 请求替换掉，页面组件不需要改
// 注意：content 里存的是 Markdown 原文，不是 HTML

export const posts = [
  {
    id: 1,
    title: '开始写第一行代码之前',
    summary: '为什么我决定先定表结构，而不是先搭页面。',
    category: '随想',
    cover: '',
    views: 82,
    likeCount: 7,
    visibility: 'public',
    createdAt: '2026-10-28 21:00:00',
    content: `很多人做项目是从 \`npm create vite\` 开始的，我不是。

## 先想清楚数据长什么样

页面上看到的每一块内容，背后都是一个字段。字段没想清楚就写页面，等于闭着眼睛装修。

## 我的四个结论

1. 标签先用单字段分类，不做多对多
2. 文章存 Markdown 原文，渲染交给前端
3. 点赞要有明细表，不能只有一个数字
4. 权限判断永远放后端
`
  },
  {
    id: 2,
    title: 'Vue3 组合式 API 到底解决了什么问题',
    summary: '从「选项式」到「组合式」，不只是写法变了。',
    category: '前端',
    cover: '',
    views: 156,
    likeCount: 12,
    visibility: 'public',
    createdAt: '2026-10-29 20:30:00',
    content: `## 选项式的痛点

一个功能的代码被拆到 \`data\`、\`methods\`、\`computed\`、\`mounted\` 四个地方，功能一多就互相打架。

## 组合式的答案

按功能组织代码，一个功能一块，用 \`ref\` / \`computed\` / \`watch\` 自己拼。

    const count = ref(0)
    const double = computed(() => count.value * 2)

## 代价

心智负担转移到了你自己身上——你要自己决定怎么拆。
`
  },
  {
    id: 3,
    title: '北京下雪那天我拍到的三张照片',
    summary: '只有登录的人能看到这篇——用来测试登录可见逻辑。',
    category: '生活',
    cover: '',
    views: 41,
    likeCount: 5,
    visibility: 'member',
    createdAt: '2026-10-30 09:15:00',
    content: `## 第一张

清晨六点的胡同，雪还没被人踩过。

## 第二张

路灯下的雪是橙色的，因为灯是暖光。

## 第三张

一只猫蹲在车顶上，一脸不高兴。

---

这篇是 \`visibility = member\` 的样例文章，用来验证未登录访客只能看到摘要。
`
  }
]

// 留言板假数据，status: 0 = 待审核，1 = 已通过
export const guestbookMessages = [
  {
    id: 1,
    nickname: '阿吉',
    content: '深蓝配一点橙，看着挺舒服的，不像套的模板。',
    status: 1,
    createdAt: '2026-10-29 14:22:00'
  },
  {
    id: 2,
    nickname: 'Lin',
    content: '组合式 API 那篇说到点子上了，选项式写多了确实会乱。',
    status: 1,
    createdAt: '2026-10-29 22:08:00'
  },
  {
    id: 3,
    nickname: '匿名',
    content: '路过留个脚印，期待更新。',
    status: 1,
    createdAt: '2026-10-30 08:41:00'
  },
  {
    id: 4,
    nickname: '测试账号',
    content: '这条是待审核状态的留言，前台不应该显示出来。',
    status: 0,
    createdAt: '2026-10-30 11:05:00'
  }
]
