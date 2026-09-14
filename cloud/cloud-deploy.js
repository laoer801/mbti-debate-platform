/**
 * MBTI 云端一键部署器（阿里云助手 API）
 * 用法：
 *   AK_ID=xxx AK_SECRET=yyy node cloud-deploy.js <本地.tar.gz> [instanceId]
 * 原理：tar.gz → base64 切 12KB 段 → RunCommand 逐段写 /root/cdeploy/segNNNN（独立文件防乱序）
 *       → 部署命令自旋等段齐全 → 拼接 base64 -d → 解压到 /opt/mbti/build → 重启 systemd → curl 自检
 */
const https = require('https')
const crypto = require('crypto')
const fs = require('fs')

const AK = process.env.AK_ID, SK = process.env.AK_SECRET
const INSTANCE = process.argv[3] || 'i-bp1047igy284wahculqm'
const TAR = process.argv[2]
if (!AK || !SK || !TAR) { console.error('用法: AK_ID=.. AK_SECRET=.. node cloud-deploy.js <tar.gz> [instanceId]'); process.exit(2) }
const CHUNK = 12000
const SEG_DIR = '/root/cdeploy'

function pe(s) { return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%7E/g, '~') }

function call(action, params) {
  const p = Object.assign({
    Action: action, Version: '2014-05-26', Format: 'JSON',
    AccessKeyId: AK, SignatureMethod: 'HMAC-SHA1', SignatureVersion: '1.0',
    SignatureNonce: crypto.randomBytes(12).toString('hex'),
    Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    RegionId: 'cn-hangzhou',
  }, params)
  const keys = Object.keys(p).sort()
  const canonical = keys.map(k => pe(k) + '=' + pe(String(p[k]))).join('&')
  p.Signature = crypto.createHmac('sha1', SK + '&').update('POST&%2F&' + pe(canonical)).digest('base64')
  const body = keys.concat('Signature').sort().map(k => pe(k) + '=' + pe(String(p[k]))).join('&')
  return new Promise((res, rej) => {
    const req = https.request({ host: 'ecs.aliyuncs.com', path: '/', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(new Error(d.slice(0, 200))) } })
    })
    req.on('error', rej)
    req.write(body)
    req.end()
  })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function runCmd(content, name) {
  const r = await call('RunCommand', {
    'InstanceId.1': INSTANCE, Name: name || 'mbti-op', Type: 'RunShellScript',
    CommandContent: content, Timeout: 120,
  })
  if (!r.InvokeId) throw new Error(name + ' 失败: ' + JSON.stringify(r).slice(0, 180))
  return r.InvokeId
}

async function waitDone(invokeId, label, maxSec = 60) {
  for (let i = 0; i < maxSec / 3; i++) {
    await sleep(3000)
    const q = await call('DescribeInvocationResults', { InvokeId: invokeId })
    const rs = q.Invocation?.InvocationResults?.InvocationResult || []
    const d = rs.filter(x => ['Success', 'Failed', 'Timeout'].includes(x.InvocationStatus))
    if (d.length) {
      const out = Buffer.from(d[0].Output || '', 'base64').toString('utf-8').trim()
      if (d[0].InvocationStatus === 'Success') { if (out) console.log(label + ':', out.split('\n')[0]); return }
      throw new Error(label + ' 执行失败: ' + out.slice(0, 300))
    }
  }
  throw new Error(label + ' 等待超时')
}

async function main() {
  const b64 = fs.readFileSync(TAR).toString('base64')
  const total = Math.ceil(b64.length / CHUNK)
  console.log('压缩包 base64', b64.length, '→', total, '段')
  // 0) 清理旧段（等完成，避免与后续上传竞争）
  const cleanInv = await runCmd(`rm -rf ${SEG_DIR} && mkdir -p ${SEG_DIR} && echo SEG_DIR_READY`, 'mbti-clean')
  await waitDone(cleanInv, '清理')
  console.log('目录就绪')
  // 1) 逐段上传
  for (let i = 0; i < total; i++) {
    const seg = b64.slice(i * CHUNK, (i + 1) * CHUNK)
    const idx = String(i + 1).padStart(4, '0')
    const content = `printf '%s' '${seg}' > ${SEG_DIR}/seg${idx}`
    for (let a = 0; a < 4; a++) {
      try {
        await runCmd(content, 'mbseg')
        break
      } catch (e) {
        if (String(e.message).includes('Frequency') || String(e.message).includes('limit')) { await sleep(5000); continue }
        throw e
      }
    }
    if ((i + 1) % 25 === 0) console.log('已传', i + 1, '/', total)
    await sleep(250)
  }
  console.log('全部段上传完毕，开始部署…')
  // 2) 部署：自旋等齐 → 拼接 → 解码 → 解压 → 重启
  const deployCmd = [
    `cd ${SEG_DIR}; want=${total}; for i in $(ls seg* 2>/dev/null | sort); do :; done`,
    `n=0; while [ "$(ls seg* 2>/dev/null | wc -l)" -lt ${total} ] && [ $n -lt 240 ]; do sleep 1; n=$((n+1)); done`,
    `echo HAVE=$(ls seg* 2>/dev/null | wc -l)`,
    `for f in $(ls seg* | sort); do printf '%s' "$(cat $f)"; done > /root/cdeploy.b64`,
    `base64 -d /root/cdeploy.b64 > /root/cdeploy.tar.gz && echo TAR=$(wc -c < /root/cdeploy.tar.gz)`,
    `tar -tzf /root/cdeploy.tar.gz > /dev/null 2>&1 && echo TAR_OK`,
    `cd /opt/mbti && rm -rf build && mkdir -p build && tar -xzf /root/cdeploy.tar.gz -C build/`,
    `systemctl restart mbti-debate && sleep 5`,
    `echo VER=$(grep -o 'index-[A-Za-z0-9_-]*\.js' /opt/mbti/build/index.html)`,
    `curl -s -o /dev/null -w 'HTTP:%{http_code}\n' http://localhost:3001/`,
  ].join(' && ')
  const inv = await runCmd(deployCmd, 'mbti-deploy')
  console.log('部署 InvokeId', inv)
  // 3) 轮询输出
  for (let i = 0; i < 30; i++) {
    await sleep(5000)
    const q = await call('DescribeInvocationResults', { InvokeId: inv })
    const rs = q.Invocation?.InvocationResults?.InvocationResult || []
    const done = rs.filter(x => ['Success', 'Failed', 'Timeout'].includes(x.InvocationStatus))
    if (done.length) {
      console.log('部署输出（Exit', done[0].ExitCode, '）:')
      console.log(Buffer.from(done[0].Output || '', 'base64').toString('utf-8'))
      process.exit(done[0].ExitCode === 0 && done[0].InvocationStatus === 'Success' ? 0 : 1)
    }
  }
  console.error('等待超时')
  process.exit(1)
}
main().catch(e => { console.error('部署失败:', e.message); process.exit(1) })
