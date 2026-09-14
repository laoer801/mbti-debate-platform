/**
 * 云服务器小文件推送（云助手 RunCommand，12KB/段 base64）
 * 用法: AK_ID=.. AK_SECRET=.. node file-push.js <本地文件> <远端绝对路径> [instanceId]
 */
const https = require('https')
const crypto = require('crypto')
const fs = require('fs')
const AK = process.env.AK_ID, SK = process.env.AK_SECRET
const INSTANCE = process.argv[4] || 'i-bp1047igy284wahculqm'
const LOCAL = process.argv[2], REMOTE = process.argv[3]
const CHUNK = 12000
const DIR = '/root/fpush'
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
async function run(content) {
  const r = await call('RunCommand', { 'InstanceId.1': INSTANCE, Name: 'fpush', Type: 'RunShellScript', CommandContent: content, Timeout: 60 })
  if (!r.InvokeId) throw new Error('run fail ' + JSON.stringify(r).slice(0, 160))
  return r.InvokeId
}
async function wait(id) {
  for (let i = 0; i < 20; i++) {
    await sleep(3000)
    const q = await call('DescribeInvocationResults', { InvokeId: id })
    const d = (q.Invocation?.InvocationResults?.InvocationResult || []).filter(x => ['Success', 'Failed'].includes(x.InvocationStatus))
    if (d.length) { if (d[0].InvocationStatus === 'Failed') throw new Error('cmd failed'); return }
  }
  throw new Error('timeout')
}
async function main() {
  const b64 = fs.readFileSync(LOCAL).toString('base64')
  const total = Math.ceil(b64.length / CHUNK)
  const c = await run(`rm -rf ${DIR} && mkdir -p ${DIR}`)
  await wait(c)
  for (let i = 0; i < total; i++) {
    const seg = b64.slice(i * CHUNK, (i + 1) * CHUNK)
    const idx = String(i + 1).padStart(4, '0')
    const inv = await run(`printf '%s' '${seg}' > ${DIR}/seg${idx}`)
    await wait(inv)
    if ((i + 1) % 5 === 0) console.log('段', i + 1, '/', total)
  }
  const deploy = await run(`for f in $(ls ${DIR}/seg* | sort); do printf '%s' "$(cat $f)"; done | base64 -d > ${REMOTE} && echo PUSHED_$(wc -c < ${REMOTE})`)
  await wait(deploy)
  console.log('推送完成 →', REMOTE)
}
main().catch(e => { console.error('ERR', e.message); process.exit(1) })
