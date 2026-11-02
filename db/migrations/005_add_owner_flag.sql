-- ============================================================
-- 迁移 005：区分「主管理员」和「普通管理员」
--
-- 背景（这是个真实 bug）：
--   原来的权限规则只有三条 —— 不能改自己、不能把最后一个管理员降级、
--   角色只能是 admin / reader。
--   其中「不能改自己」挡不住 A 去改 B：主管理员把某人设为管理员之后，
--   那个人反手就能把主管理员降成 reader，后台从此易主。
--
-- 为什么不在代码里写死 username = 'admin' 来判断主管理员？
--   因为用户名是**可变的用户数据**，不是身份标识。
--   一旦哪天改了用户名，保护就静默失效了；而且别的库、别的环境里
--   主管理员未必叫 admin。所以要把「谁是根账号」存成数据本身。
--
-- is_owner = 1 的那一行就是主管理员，全表最多一行（下面用唯一索引兜住）。
-- 它只能由数据库/运维操作变更，任何后台接口都不允许改它。
-- ============================================================

ALTER TABLE users
  ADD COLUMN is_owner TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=主管理员（根账号，后台接口不可修改其角色/不可删除）'
    AFTER role;

-- 现有库里把「最早创建的那个管理员」认定为主管理员。
-- 用 MIN(id) 而不是用户名：id 是插入顺序，不会因为改名而失效。
-- 多包一层派生表 t，是因为 MySQL 不允许 UPDATE 的子查询直接引用同一张表。
UPDATE users
   SET is_owner = 1
 WHERE id = (
   SELECT id FROM (
     SELECT MIN(id) AS id FROM users WHERE role = 'admin'
   ) AS t
 );

-- 数据库层面保证「主管理员最多一个」。
-- 写法是函数索引：is_owner = 1 时取值 1，否则取值 NULL；
-- 唯一索引允许多个 NULL，所以只有那唯一一行 1 会受约束。
ALTER TABLE users
  ADD UNIQUE KEY uk_single_owner ((IF(is_owner = 1, 1, NULL)));
