/**
 * 云服务器文件拉取（云助手 RunCommand，分段 base64）
 *
 * ⚠️ 云助手 Output 有硬上限（实测 ~24KB），单次 `base64 -w0 <file>` 会被静默截断，
 *    所以这里按 CHUNK 字节分段读取再拼接，最后校验字节数。
 *
 * 用法: AK_ID=.. AK_SECRET=.. node file-pull.js <远端绝对路径> <本地路径> [instanceId]
 */
const https = require('https')
const crypto = require('crypto')
const fs = require('fs')

const AK = process.env.AK_ID, SK = process.env.AK_SECRET
const INSTANCE = process.argv[4] || 'i-bp1047igy284wahculqm'
const REMOTE = process.argv[2], LOCAL = process.argv[3]
if (!AK || !SK || !REMOTE || !LOCAL) {
  console.error('用法: AK_ID=.. AK_SECRET=.. node file-pull.js <远端路径> <本地路径> [instanceId]')
  process.exit(2)
}
const CHUNK = 15000 // raw bytes/段 → base64 ~20000 字符，安全落在 24KB 输出上限内

function pe(s) { return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%7E/g, '~') }
function call(action, params) {
  const p = Object.assign({ Action: action, Version: '2014-05-26', Format: 'JSON', AccessKeyId: AK, SignatureMethod: 'HMAC-SHA1', SignatureVersion: '1.0', SignatureNonce: crypto.randomBytes(12).toString('hex'), Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), RegionId: 'cn-hangzhou' }, params)
  const keys = Object.keys(p).sort()
  const canonical = keys.map(k => pe(k) + '=' + pe(String(p[k]))).join('&')
  p.Signature = crypto.createHmac('sha1', SK + '&').update('POST&%2F&' + pe(canonical)).digest('base64')
  const body = keys.concat('Signature').sort().map(k => pe(k) + '=' + pe(String(p[k]))).join('&')
  return new Promise((res, rej) => { const req = https.request({ host: 'ecs.aliyuncs.com', path: '/', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(new Error(d.slice(0, 160))) } }) }); req.on('error', rej); req.write(body); req.end() })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

/** 执行远端命令并返回 stdout（trim 后） */
async function runOut(content, tries = 4) {
  for (let a = 0; a < tries; a++) {
    const r = await call('RunCommand', { 'InstanceId.1': INSTANCE, Name: 'fpull', Type: 'RunShellScript', CommandContent: content, Timeout: 60 })
    if (!r.InvokeId) {
      if (/Frequency|limit/i.test(JSON.stringify(r))) { await sleep(4000); continue }
      throw new Error('run fail ' + JSON.stringify(r).slice(0, 160))
    }
    for (let i = 0; i < 20; i++) {
      await sleep(2000)
      const q = await call('DescribeInvocationResults', { InvokeId: r.InvokeId })
      const d = (q.Invocation?.InvocationResults?.InvocationResult || []).filter(x => ['Success', 'Failed'].includes(x.InvocationStatus))
      if (d.length) {
        const out = Buffer.from(d[0].Output || '', 'base64').toString('utf-8')
        if (d[0].InvocationStatus === 'Failed') throw new Error('cmd failed: ' + out.slice(0, 200))
        return out.trim()
      }
    }
    throw new Error('timeout')
  }
  throw new Error('重试耗尽')
}

async function main() {
  const sizeStr = await runOut(`wc -c < ${REMOTE}`)
  const size = parseInt(sizeStr, 10)
  if (!Number.isFinite(size)) throw new Error('无法获取远端文件大小: ' + sizeStr)
  console.log(`远端 ${REMOTE} 大小 ${size} 字节`)

  const total = Math.ceil(size / CHUNK)
  let b64 = ''
  for (let i = 0; i < total; i++) {
    const out = await runOut(`dd if=${REMOTE} bs=${CHUNK} skip=${i} count=1 2>/dev/null | base64 -w0`)
    b64 += out.replace(/\s+/g, '')
    console.log(`  段 ${i + 1}/${total} 累计 b64 ${b64.length}`)
  }

  const buf = Buffer.from(b64, 'base64')
  if (buf.length !== size) throw new Error(`字节数不符: 得到 ${buf.length}, 期望 ${size}`)
  fs.writeFileSync(LOCAL, buf)
  console.log(`✅ 已写入 ${LOCAL}（${buf.length} 字节，与远端一致）`)
}
main().catch(e => { console.error('ERR', e.message); process.exit(1) })
