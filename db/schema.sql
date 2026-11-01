-- ============================================================
-- 个人博客 数据库初始化脚本
-- MySQL 8.0.46 / InnoDB / utf8mb4
-- 执行方式见项目说明：mysql -u root -p -e "source schema.sql"
-- 注意：脚本开头会 DROP DATABASE，第一次执行是安全的；
--       如果库里已经有你不想丢的数据，请先注释掉下面两行。
-- ============================================================

DROP DATABASE IF EXISTS blog_db;
CREATE DATABASE blog_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE blog_db;

-- ------------------------------------------------------------
-- 1. users 用户表
--    role 只有两种：admin（我，能进后台）/ reader（注册访客）
--    password_hash 存 bcrypt 哈希（60 字符），长度留到 100 方便将来换算法
-- ------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '用户 id',
  username      VARCHAR(50)  NOT NULL COMMENT '登录名',
  password_hash VARCHAR(100) NOT NULL COMMENT 'bcrypt 哈希，绝不存明文',
  role          ENUM('admin','reader') NOT NULL DEFAULT 'reader' COMMENT '角色',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ------------------------------------------------------------
-- 2. posts 文章表
--    content 存 Markdown 原文（不是 HTML）
--    visibility 决定访客能不能看全文，这个判断必须放在后端做
--    like_count 是冗余计数（明细在 likes 表），为了列表页不用 COUNT
-- ------------------------------------------------------------
CREATE TABLE posts (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '文章 id',
  title      VARCHAR(200) NOT NULL COMMENT '标题',
  summary    VARCHAR(500) NOT NULL DEFAULT '' COMMENT '摘要，列表页用',
  content    MEDIUMTEXT   NOT NULL COMMENT 'Markdown 原文',
  category   VARCHAR(50)  NOT NULL DEFAULT '随笔' COMMENT '分类（单字段，不做多对多）',
  cover      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '封面图 URL，走图床',
  views      INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '阅读数',
  like_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '点赞数（冗余计数）',
  visibility ENUM('public','member') NOT NULL DEFAULT 'public' COMMENT 'public=公开 member=需登录',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_created (created_at),
  KEY idx_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章表';

-- ------------------------------------------------------------
-- 3. comments 留言表
--    status 字段已停用：不再走「先审核再显示」，新留言默认直接可见（1）。
--    字段保留是为了哪天要恢复审核时，把默认值改回 0 即可。
--    user_id 外键，用户被删时留言一起删（CASCADE）
-- ------------------------------------------------------------
CREATE TABLE comments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '留言 id',
  post_id    INT UNSIGNED NULL COMMENT '关联文章，NULL 表示留在留言板',
  user_id    INT UNSIGNED NOT NULL COMMENT '留言人',
  content    VARCHAR(1000) NOT NULL COMMENT '留言内容（纯文本，不解析 Markdown）',
  status     TINYINT NOT NULL DEFAULT 1 COMMENT '0待审 1通过（审核已停用，恒为 1）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '留言时间',
  KEY idx_post_status (post_id, status),
  KEY idx_user (user_id),
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='留言表';

-- ------------------------------------------------------------
-- 4. likes 点赞明细表
--    唯一索引 (post_id, user_id) 是核心：数据库层面挡住重复点赞
--    不要只靠前端按钮置灰，刷新一下就能再点一次
-- ------------------------------------------------------------
CREATE TABLE likes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '点赞记录 id',
  post_id    INT UNSIGNED NOT NULL COMMENT '被点赞的文章',
  user_id    INT UNSIGNED NOT NULL COMMENT '点赞的人',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  UNIQUE KEY uk_post_user (post_id, user_id),
  KEY idx_user (user_id),
  CONSTRAINT fk_like_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='点赞明细表';

-- ------------------------------------------------------------
-- 测试数据：3 篇文章
-- 其中第 3 篇 visibility='member'，用来验证「没登录看不到全文」这条策略
-- 用户表暂时不插数据——bcrypt 哈希必须由后端程序生成，
-- 手敲一串假的是登不上的，等阶段 4 写好注册接口再建账号。
-- ------------------------------------------------------------
INSERT INTO posts (title, summary, content, category, visibility, created_at) VALUES
(
  '开始写第一行代码之前',
  '为什么我决定先定表结构，而不是先搭页面。',
  '很多人做项目是从 `npm create vite` 开始的，我不是。\n\n## 先想清楚数据长什么样\n\n页面上看到的每一块内容，背后都是一个字段。字段没想清楚就写页面，等于闭着眼睛装修。\n\n## 我的四个结论\n\n1. 标签先用单字段分类，不做多对多\n2. 文章存 Markdown 原文，渲染交给前端\n3. 点赞要有明细表，不能只有一个数字\n4. 权限判断永远放后端\n',
  '随想', 'public', '2026-10-28 21:00:00'
),
(
  'Vue3 组合式 API 到底解决了什么问题',
  '从「选项式」到「组合式」，不只是写法变了。',
  '## 选项式的痛点\n\n一个功能的代码被拆到 `data`、`methods`、`computed`、`mounted` 四个地方，功能一多就互相打架。\n\n## 组合式的答案\n\n按功能组织代码，一个功能一块，用 `ref` / `computed` / `watch` 自己拼。\n\n```js\nconst count = ref(0)\nconst double = computed(() => count.value * 2)\n```\n\n## 代价\n\n心智负担转移到了你自己身上——你要自己决定怎么拆。\n',
  '前端', 'public', '2026-10-29 20:30:00'
),
(
  '北京下雪那天我拍到的三张照片',
  '只有登录的人能看到这篇——用来测试登录可见逻辑。',
  '## 第一张\n\n清晨六点的胡同，雪还没被人踩过。\n\n## 第二张\n\n路灯下的雪是橙色的，因为灯是暖光。\n\n## 第三张\n\n一只猫蹲在车顶上，一脸不高兴。\n\n---\n\n这篇是 `visibility = member` 的样例文章，用来验证未登录访客只能看到摘要。\n',
  '生活', 'member', '2026-10-30 09:15:00'
);
