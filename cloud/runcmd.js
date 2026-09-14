// 云端运维 exec：AK_ID=.. AK_SECRET=.. node runcmd.js 'shell命令' [instanceId]
const https = require('https')
const crypto = require('crypto')
const AK = process.env.AK_ID, SK = process.env.AK_SECRET
const INSTANCE = process.argv[3] || 'i-bp1047igy284wahculqm'
const content = process.argv[2]
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
async function main() {
  const r = await call('RunCommand', { 'InstanceId.1': INSTANCE, Name: 'mbti-op', Type: 'RunShellScript', CommandContent: content, Timeout: 90 })
  if (!r.InvokeId) { console.error('run fail', JSON.stringify(r).slice(0, 200)); process.exit(1) }
  for (let i = 0; i < 30; i++) {
    await sleep(3000)
    const q = await call('DescribeInvocationResults', { InvokeId: r.InvokeId })
    const d = (q.Invocation?.InvocationResults?.InvocationResult || []).filter(x => ['Success', 'Failed', 'Timeout'].includes(x.InvocationStatus))
    if (d.length) { console.log(Buffer.from(d[0].Output || '', 'base64').toString('utf-8')); process.exit(d[0].InvocationStatus === 'Success' ? 0 : 1) }
  }
  console.error('timeout'); process.exit(1)
}
main().catch(e => { console.error('ERR', e.message); process.exit(1) })
