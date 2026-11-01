-- ============================================================
-- 迁移 003：留言支持「楼中楼」回复
--
-- 设计：只做两级 —— 顶层留言 + 它下面的回复。
-- 回复的回复不再往深处长，而是挂在同一个顶层留言下，
-- 用 reply_to_user_id 记住「这句话是回给谁的」，界面上显示「回复 @某人」。
--
-- 为什么不做无限层级：
--   1. 递归查询在 MySQL 里要么用 CTE 要么在应用层拼，复杂度陡增；
--   2. 三级缩进在 390px 手机上已经挤到没法看，实际没人会往下翻。
-- ============================================================

ALTER TABLE comments
  ADD COLUMN parent_id INT UNSIGNED NULL
    COMMENT '所属的顶层留言，NULL 表示自己就是顶层' AFTER post_id,
  ADD COLUMN reply_to_user_id INT UNSIGNED NULL
    COMMENT '二级回复时指向被回复的人，用于显示 @昵称' AFTER parent_id;

-- 按父留言查回复是最常用的查询，必须有索引
ALTER TABLE comments
  ADD KEY idx_parent (parent_id);

-- 删父留言时，它下面的回复一起删掉，不留孤儿
ALTER TABLE comments
  ADD CONSTRAINT fk_comment_parent
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;

-- 被回复的人注销了，回复本身要留着，只是不再显示 @
ALTER TABLE comments
  ADD CONSTRAINT fk_comment_reply_to
    FOREIGN KEY (reply_to_user_id) REFERENCES users(id) ON DELETE SET NULL;
