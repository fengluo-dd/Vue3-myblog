import 'dotenv/config'

// 集中读取并校验必需的配置项。
// 放在一处的理由：JWT 的签发（routes/auth.js）和校验（middleware/auth.js）
// 必须用同一个密钥。如果各读各的，某天改了一处漏了另一处，
// 症状会是"登录提示成功，但下一个请求立刻 401"，非常难查。

/**
 * 读一个必需的环境变量，缺失就直接终止进程。
 *
 * 为什么不给它默认值？
 * 因为默认值是这里最危险的东西：配置缺失本应是个响亮的错误，
 * 给了默认值就变成"看起来一切正常"，然后静默地用一个公开字符串当密钥。
 */
function required(name) {
  const value = process.env[name]

  if (!value) {
    console.error('')
    console.error(`[配置错误] 缺少环境变量 ${name}`)
    console.error(`请在 server/.env 里补上这一行：${name}=你的值`)
    if (name === 'JWT_SECRET') {
      console.error('生成一个随机密钥可以用：')
      console.error('  Linux / macOS : openssl rand -hex 32')
      console.error('  Windows       : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    }
    console.error('')
    process.exit(1)
  }

  return value
}

// JWT 签名密钥：泄露等于别人能伪造任意身份，必须来自环境变量
export const JWT_SECRET = required('JWT_SECRET')

// token 有效期。这个给默认值没问题，因为 7 天是个合理的业务默认，不是安全凭据
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
