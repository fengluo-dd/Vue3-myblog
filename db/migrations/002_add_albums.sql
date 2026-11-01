-- ============================================================
-- 迁移 002：相册表
--
-- file_name 存的是服务端生成的文件名（如 1730xxxx-a1b2c3d4.jpg），
-- 不是用户的原始文件名。原始名可能带中文、空格、甚至 ../ 路径，
-- 直接拿来拼路径就是目录穿越漏洞。
--
-- 不存完整 URL：域名换了、以后接对象存储了，存 URL 就得全表改数据。
-- 只存文件名，URL 由前端按当前环境拼。
-- ============================================================

CREATE TABLE albums (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '照片 id',
  title       VARCHAR(120) NOT NULL DEFAULT '' COMMENT '照片标题',
  description VARCHAR(300) NOT NULL DEFAULT '' COMMENT '一句话说明',
  file_name   VARCHAR(200) NOT NULL COMMENT '服务端文件名（不含路径）',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='相册';
