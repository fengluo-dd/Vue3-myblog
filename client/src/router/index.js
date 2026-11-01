import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { isTokenExpired, useUserStore } from '../stores/user'

// 路由表：路径 -> 组件
// 用 hash 模式（地址栏里会带 #），好处是部署到任何静态服务器都不用额外配置
const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: '首页' }
  },
  {
    // 博文板块：全部长文的归档列表。
    // 和 /post/:id 不是一回事，静态路径优先匹配，不会被详情路由抢走
    path: '/posts',
    name: 'posts',
    component: () => import('../views/PostsView.vue'),
    meta: { title: '博文' }
  },
  {
    path: '/post/:id',
    name: 'post',
    // 详情页用懒加载：只有真正点进去才下载这份代码，首屏更快
    component: () => import('../views/PostDetailView.vue'),
    meta: { title: '文章' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '登录' }
  },
  {
    // 和 /login 用同一个组件，靠 meta.mode 决定初始显示哪个表单。
    // 做成两个路由是为了地址能直接分享：发给别人 /register 就落在注册页。
    path: '/register',
    name: 'register',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '注册', mode: 'register' }
  },
  {
    path: '/guestbook',
    name: 'guestbook',
    component: () => import('../views/GuestbookView.vue'),
    meta: { title: '留言板' }
  },
  {
    path: '/notes',
    name: 'notes',
    component: () => import('../views/NotesView.vue'),
    meta: { title: '随笔' }
  },
  {
    path: '/albums',
    name: 'albums',
    component: () => import('../views/AlbumsView.vue'),
    meta: { title: '相册' }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
    meta: { title: '关于我' }
  },
  {
    // 后台用嵌套路由：父路由只负责「布局 + 权限」，子路由才是具体页面。
    // 好处是切子页面时侧边栏不会重新渲染，只有右边内容区换。
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'admin-home',
        component: () => import('../views/admin/AdminHome.vue'),
        meta: { title: '后台概览' }
      },
      {
        path: 'posts',
        name: 'admin-posts',
        component: () => import('../views/admin/AdminPosts.vue'),
        meta: { title: '文章管理' }
      },
      {
        // 新建和编辑共用一个页面，靠有没有 id 区分。
        // 放在 :id/edit 前面，避免 'new' 被当成 id 去匹配
        path: 'posts/new',
        name: 'admin-post-new',
        component: () => import('../views/admin/AdminPostEdit.vue'),
        meta: { title: '写文章' }
      },
      {
        path: 'posts/:id/edit',
        name: 'admin-post-edit',
        component: () => import('../views/admin/AdminPostEdit.vue'),
        meta: { title: '编辑文章' }
      },
      {
        path: 'comments',
        name: 'admin-comments',
        component: () => import('../views/admin/AdminComments.vue'),
        meta: { title: '留言管理' }
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('../views/admin/AdminUsers.vue'),
        meta: { title: '账号管理' }
      },
      {
        path: 'albums',
        name: 'admin-albums',
        component: () => import('../views/admin/AdminAlbums.vue'),
        meta: { title: '相册管理' }
      }
    ]
  },
  {
    // 兜底路由：上面都没匹配上就走这里
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // 每次切页面都回到顶部，否则从长文章点进另一页会停在半中间
  scrollBehavior() {
    return { top: 0 }
  }
})

/**
 * 全局前置守卫：进后台之前先验身份。
 *
 * 三层判断：
 *   1. 这趟本来就不去后台 -> 直接放行
 *   2. 没登录            -> 送去登录页，并把原地址记在 query 里
 *   3. 登录了但不是管理员 -> 送回首页
 *
 * 注意 useUserStore() 必须写在函数内部，不能提到文件顶部。
 * 因为模块加载时 app.use(pinia) 还没执行，那时调用会报「pinia 未安装」。
 * 守卫是导航时才跑，那时 pinia 早就装好了。
 */
router.beforeEach((to) => {
  const needAdmin = to.matched.some((record) => record.meta.requiresAdmin)
  if (!needAdmin) return true

  const userStore = useUserStore()

  // 本地有 token 不代表还有效。过期的先就地清掉，
  // 否则会放人进后台、然后每个接口都 401，比直接拦下来更难懂
  if (userStore.token && isTokenExpired(userStore.token)) {
    userStore.clearAuth()
  }

  if (!userStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (!userStore.isAdmin) {
    return { name: 'home' }
  }

  return true
})

// 切换路由后顺便改浏览器标签页的标题
router.afterEach((to) => {
  const base = '枫落'
  document.title = to.meta.title ? `${to.meta.title} · ${base}` : base
})

export default router
