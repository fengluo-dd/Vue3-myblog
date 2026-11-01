import 'dotenv/config'
import bcrypt from 'bcryptjs'
import readline from 'node:readline'
import { pool } from '../src/db.js'

// 单独修改管理员密码的小工具。
// 和 seed.js 的区别：seed.js 会顺带插入演示留言、覆盖阅读数，
// 在线上跑会把真实数据冲掉。这个脚本只 UPDATE users 表的一行，别的一概不碰。

/**
 * 从终端读一行输入，输入过程中不回显字符。
 * 密码不应该显示在屏幕上，也不该留在 shell 历史里。
 */
function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    })

    // readline 每敲一个字符都会调用 _writeToOutput 把字符画到屏幕上。
    // 把它替换成空函数，输入就"隐身"了。提示语由我们自己提前输出。
    rl._writeToOutput = () => {}

    process.stdout.write(prompt)

    rl.question('', (answer) => {
      rl.close()
      // 回车时也不会自动换行（因为输出被拦掉了），手动补一个
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin'

  // 优先用命令行参数，方便脚本化调用：node scripts/set-password.js 新密码
  // 不传参数就走交互输入，这样密码不会留在 shell 历史里
  let password = process.argv[2]

  if (!password) {
    password = await askHidden(`请输入 ${username} 的新密码（输入时不显示）：`)
  }

  if (!password || password.length < 6) {
    console.error('密码至少 6 位')
    process.exit(1)
  }

  // 每次 hash 的盐都是随机的，所以同一个密码每次算出来的哈希都不同，这是正常的
  const hash = await bcrypt.hash(password, 10)

  // 只更新已存在的账号。故意不用 INSERT，
  // 是为了避免打错用户名时凭空造出一个新账号来
  const [result] = await pool.query(
    'UPDATE users SET password_hash = ? WHERE username = ?',
    [hash, username]
  )

  if (result.affectedRows === 0) {
    console.error(`没有找到用户 ${username}，请先执行 npm run seed 初始化`)
    process.exit(1)
  }

  console.log(`已更新 ${username} 的密码`)
  await pool.end()
}

main().catch(async (err) => {
  console.error('修改失败：', err.message)
  await pool.end()
  process.exit(1)
})
