# 部署手册

从一台空的云服务器，到网站能被公网访问。照着这个顺序做，每一步都有预期结果可以对照。

> 本文档中的 `<尖括号>` 都是占位符，需要替换成你自己的值。
> 全文不含任何真实密码、密钥或服务器 IP，可以直接提交到公开仓库。

---

## 0. 前置信息

开始前先确认这几个值，后面会反复用到：

| 项目 | 你的值 | 在哪看 |
|---|---|---|
| 服务器公网 IP | `<SERVER_IP>` | 云厂商控制台 → 实例列表 |
| 登录用户名 | `root` | Ubuntu 镜像默认就是 root |
| 登录密码 | （自己记，别写在任何文件里） | 购买时设置，或控制台重置 |
| 系统版本 | Ubuntu 22.04 / 24.04 | `cat /etc/os-release` |
| 代码仓库 | `https://github.com/<你的用户名>/<仓库名>.git` | GitHub |

**约定**：下文的项目部署目录统一用 `/var/www/blog`。

---

## 1. 连接到服务器

在你自己的电脑上打开 PowerShell：

```bash
ssh root@<SERVER_IP>
```

| 提示 | 该做什么 |
|---|---|
| `Are you sure you want to continue connecting (yes/no)?` | 输入 `yes` 回车 |
| `password:` | 输入密码，屏幕上不显示任何字符，输完直接回车 |

成功的标志：提示符变成 `root@<主机名>:~#`

> **报错 `Permission denied (publickey)`**：说明服务器没开密码登录（购买时选了密钥对）。
> 去控制台「重置实例密码」，**然后必须重启实例**，否则不生效。

---

## 2. 更新软件清单

```bash
apt update
```

这一步只是刷新软件清单，不安装任何东西。**必须做**，否则后面装软件会报"找不到包"。

顺手看一眼输出的第一行：

- 显示 `mirrors.cloud.aliyuncs.com` 或 `mirrors.aliyun.com` → 已经是国内源，很好
- 显示 `archive.ubuntu.com` 且卡很久 → 需要换源（阿里云 ECS 一般不会这样）

> `apt upgrade`（升级已装软件）可选。它是打安全补丁用的，不做也能跑，只是安全性差一点。

---

## 3. 安装 Node.js 20

Ubuntu 自带的 Node 版本太旧，跑不了 Vue 3 + Vite，必须装新版。

```bash
apt install -y curl
```
装下载工具。

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
```
往系统里添加 Node 20 的软件源。输出里会看到 `## Run sudo apt-get install -y nodejs`，这是提示，不用管。

```bash
apt install -y nodejs
```
真正安装 Node，会连带装上 npm。

```bash
npm config set registry https://registry.npmmirror.com
```
把 npm 下载源换成国内镜像。**不做这步，后面装依赖会非常慢。**

验证：

```bash
node -v
npm -v
```

期望：`v20.x.x` 和 `10.x.x` 或更高。

---

## 4. 加 Swap（2G 内存的机器必做）

服务器内存只有 2G，跑 MySQL + Node 容易触发 OOM（内存溢出，进程会被系统直接杀掉）。加一块磁盘当"备用内存"可以顶住突发。

```bash
fallocate -l 2G /swapfile
```
创建一个 2G 的文件。

```bash
chmod 600 /swapfile
```
只有 root 能读写，安全检查。

```bash
mkswap /swapfile
```
把它格式化成 swap 分区。

```bash
swapon /swapfile
```
启用。

```bash
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
写进开机自启，否则重启后就没了。

验证：

```bash
free -h
```

`Swap:` 那一行应该显示 `2.0Gi`。

---

## 5. 安装 MySQL 8

```bash
apt install -y mysql-server
```

安装过程中不会让你设密码（Ubuntu 上的 MySQL 默认用 socket 认证，root 账号只能用系统 root 身份直接进）。

验证服务在跑：

```bash
systemctl status mysql --no-pager
```

看到 `active (running)` 就对了。**按 `q` 退出**。

### 5.1 导入数据库结构

⚠️ **SQL 脚本放在代码仓库里，所以请先做完第 6 步（拉取代码），再回来执行本节。**
实际执行顺序是：4（Swap）→ 6（拉代码）→ 5（MySQL）→ 7（.env）→ 8（构建）→ 9（pm2）。

```bash
cd /var/www/blog
mysql < db/schema.sql
```

这个脚本会自己 `DROP DATABASE IF EXISTS blog_db` 然后重建，**第一次执行是安全的**。如果库里已有数据，会全部清空——注意这一行。

验证：

```bash
mysql -e "SHOW DATABASES;" | grep blog_db
```

应该看到 `blog_db`。

### 5.2 创建应用专用账号

**不要用 root 跑应用。** 建一个只能访问 `blog_db` 的账号，即使密码泄露，也影响不到整个数据库。

```bash
mysql -e "CREATE USER 'blog'@'localhost' IDENTIFIED BY '<数据库密码>';"
```
密码自己定，8 位以上，包含大小写和数字。

```bash
mysql -e "GRANT ALL PRIVILEGES ON blog_db.* TO 'blog'@'localhost';"
```
只给 `blog_db` 这一个库的权限。

```bash
mysql -e "FLUSH PRIVILEGES;"
```
让权限立即生效。

验证能不能登录：

```bash
mysql -u blog -p -e "USE blog_db; SHOW TABLES;"
```

输入刚才设的密码，应该能列出 `users`、`posts`、`comments` 等表。

> `albums` 表这会儿**还没有**，它是迁移 002 才建的，下一步补上。

### 5.3 执行数据库迁移（**最容易漏的一步**）

`db/schema.sql` 只是建库时的**初始快照**，之后每次改表结构都单独放在 `db/migrations/` 里。
只跑 `schema.sql` 不跑迁移，会出现这种典型症状：

> 网站首页能打开、文章详情页也能打开，但**列表页空白**，接口报 `500 服务器内部错误`。

原因是列表查询的 SQL 里写到了 `type`、`parent_id` 这些**迁移才加上去的列**，
而库里没有这些列，MySQL 直接抛 `Unknown column`。
（详情页用的是 `SELECT *`，不点名要哪个列，所以反而"正常"。）

```bash
cd /var/www/blog/server
node scripts/migrate.mjs
```

期望输出（首次）：
```
已执行：001_add_post_type.sql（2 条语句）
已执行：002_add_albums.sql（1 条语句）
已执行：003_add_comment_replies.sql（3 条语句）
已执行：004_disable_comment_moderation.sql（2 条语句）
迁移完成
```

脚本靠一张 `schema_migrations` 表记录跑过哪些文件，**重复执行是安全的**，已跑过的会显示"跳过"。

验证：
```bash
mysql -u blog -p -e "USE blog_db; DESCRIBE posts;" | grep type
mysql -u blog -p -e "USE blog_db; SHOW TABLES;" | grep albums
```

两条都要有输出，缺一条就说明迁移没跑完。

---

## 6. 拉取代码

```bash
apt install -y git
```

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/<你的用户名>/<仓库名>.git blog
```

如果是公开仓库，不需要登录。私有仓库会要求输入用户名和 token。

验证：

```bash
ls /var/www/blog
```

应该看到 `client`、`server`、`db`、`.gitignore`。

---

## 7. 配置环境变量

`.env` 不进 git（这是设计如此），所以服务器上要单独建一份。

```bash
cd /var/www/blog/server
nano .env
```

把下面这段整个粘进去（`nano` 里粘贴：右键或 `Ctrl+Shift+V`）：

```ini
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=blog
DB_PASSWORD=<第 5.2 步设置的数据库密码>
DB_NAME=blog_db

JWT_SECRET=<下面生成的随机串>
JWT_EXPIRES_IN=7d

ADMIN_USERNAME=admin
ADMIN_PASSWORD=<管理员初始密码>
```

生成 `JWT_SECRET`：

```bash
openssl rand -hex 32
```

复制输出，替换掉上面的 `<下面生成的随机串>`。

**保存退出**：`Ctrl+O` → 回车 → `Ctrl+X`。

> ⚠️ 注意 `DB_NAME` 这个键名。仓库里的 `.env.example` 把它写成了 `DB_NAME`（是个笔误），如果直接复制那个文件，数据库名会读不到，应用会用默认库名，可能连错库。以本文档为准。

### 7.1 初始化管理员账号

```bash
cd /var/www/blog/server
npm install
npm run seed
```

期望输出：`用户 admin 就绪 (id=1)，密码 <你设的密码>`

> `seed` 会顺带插入演示留言、覆盖 id 为 1/2/3 的文章阅读数。首次部署无所谓。
> **以后在线上改密码，不要用 seed**，用 `node scripts/set-password.js`。

---

## 8. 安装依赖并构建前端

```bash
cd /var/www/blog/client
npm install
npm run build
```

`npm run build` 会生成 `client/dist` 目录。**构建成功后，Express 会自动托管它**——整个网站只需要一个进程、一个端口。

验证：

```bash
ls /var/www/blog/client/dist
```

应该看到 `index.html` 和 `assets` 目录。

```bash
cd /var/www/blog/server
npm install
```

---

## 9. 用 pm2 常驻运行

**千万别直接 `node src/index.js`** —— 你一断开 SSH，进程就死了，网站立刻打不开。

```bash
npm install -g pm2
```

```bash
cd /var/www/blog/server
pm2 start src/index.js --name blog
```

```bash
pm2 save
```
保存当前进程列表，重启机器后能恢复。

```bash
pm2 startup
```
它会输出一行以 `sudo env PATH=...` 开头的命令，**复制那一行单独执行**，才能实现开机自启。

常用命令：

| 命令 | 作用 |
|---|---|
| `pm2 list` | 看所有进程状态 |
| `pm2 logs blog` | 看实时日志（排查问题必用） |
| `pm2 restart blog` | 重启 |
| `pm2 stop blog` | 停止 |

验证服务活着：

```bash
curl http://127.0.0.1:3000/api/health
```

期望返回：`{"code":0,"data":{"ok":true,"db":"connected",...}}`

**如果 `db` 不是 `connected`**，说明第 7 步的 `.env` 里数据库配置有误，检查用户名密码库名。

---

## 10. 放行端口

去云厂商控制台 → 实例 → 安全组 / 防火墙 → 添加入方向规则：

| 项目 | 值 |
|---|---|
| 协议 | TCP |
| 端口 | 3000 |
| 来源 | `0.0.0.0/0`（允许所有人访问） |

**这一条没加，就会出现"服务器上 curl 能通、手机打不开"的经典症状。**

---

## 11. 验证上线

**本机验证**（在服务器上）：

```bash
curl -I http://127.0.0.1:3000
```

应返回 `HTTP/1.1 200 OK`。

**外部验证**：

- 电脑浏览器打开 `http://<SERVER_IP>:3000`
- 手机用 4G（**关掉 WiFi**，确保走公网）打开同一个地址

两边都能看到网站，就说明真的上线了。

---

## 12. 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| `apt install` 报 `Unable to locate package` | 没执行 `apt update` | 先 `apt update` |
| `npm install` 卡住不动 | npm 源还是国外的 | `npm config set registry https://registry.npmmirror.com` |
| 本机 curl 通，手机打不开 | 安全组没放行 3000 | 第 10 步 |
| 页面能打开但没数据 | `.env` 数据库配置错，或没导 schema | `pm2 logs blog` 看报错 |
| **首页列表空白、接口 500，但文章详情页能开** | **只跑了 `schema.sql`，没跑 `db/migrations` 里的迁移** | **第 5.3 步 `node scripts/migrate.mjs`** |
| `EADDRINUSE` 端口被占用 | 有旧进程还在跑 | `pm2 list` 找到后 `pm2 delete <name>` |
| `502` / 网站突然挂了 | 进程被 OOM 杀了 | `free -h` 看内存，`pm2 logs blog` 看日志，确认 swap 已启用 |
| SSH 断开后网站没了 | 没用 pm2，直接跑的 node | 第 9 步 |
| 重装系统后 SSH 报 `HOST IDENTIFICATION HAS CHANGED` | 服务器指纹变了 | 删掉 `C:\Users\<你>\.ssh\known_hosts` 里对应那行 |

---

## 13. 日常更新流程（改完代码后）

在你自己的电脑上：

```bash
git add .
git commit -m "改了什么"
git push
```

在服务器上：

```bash
cd /var/www/blog
git pull

cd client
npm run build          # 前端改了才需要

cd ../server
pm2 restart blog
```

> 只改了后端代码的话，不用 `npm run build`，直接 `pm2 restart blog`。
> 改了 `package.json` 依赖的话，要在对应目录 `npm install`。

---

## 14. 后续可做的事（按优先级）

1. **买域名 + ICP 备案** —— 把 `http://IP:3000` 变成 `https://你的域名`，这是简历项目最关键的一步
2. **装 Nginx 反向代理** —— 隐藏端口号，用 80/443 访问
3. **配 HTTPS** —— 用 Let's Encrypt 免费证书（`certbot`），登录密码不再明文传输
4. **数据库定时备份** —— 用 `crontab` 每天 `mysqldump`
5. **改掉初始管理员密码** —— `node scripts/set-password.js`
