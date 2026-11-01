-- ============================================================
-- 迁移 001：给 posts 加 type 字段，区分「长文」和「随笔」
--
-- 为什么用同一张表而不是新建 notes 表：
--   随笔和长文除了展示形态不同，字段完全一样（标题、正文、分类、可见性、点赞、浏览）。
--   拆成两张表意味着列表查询、点赞、权限判断、后台编辑全都要写两遍。
--   加一个 type 列，一套逻辑按类型筛选，代价小得多。
--
-- 什么时候才该拆表：两者字段出现明显分叉时（比如随笔要挂图片、长文要挂目录结构）。
-- ============================================================

ALTER TABLE posts
  ADD COLUMN type ENUM('post','note') NOT NULL DEFAULT 'post'
  COMMENT '内容类型：post 长文 / note 随笔'
  AFTER category;

-- 列表页按类型筛选，加个索引
ALTER TABLE posts ADD INDEX idx_type_created (type, created_at);
