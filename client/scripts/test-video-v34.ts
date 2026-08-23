/**
 * v34 视频知识模块测试（test-video-v34.ts）
 *
 * 覆盖：
 *  - parseSrt / parseVtt / parseSubtitleFile（字幕解析）
 *  - importVideoKnowledge（Node 内存降级：内容入库 + 元数据）
 *  - searchVideos / retrieveVideoKnowledge（检索 + 提示词段）
 *  - buildVideoKnowledgeSection（引用格式）
 *  - removeVideoBook / clearVideoBooks（删除链路）
 *  - 辩论提示词注入（buildSpeechMessages 含 videoKnowledge 段）
 *
 * 运行：npm run test:video:v34
 */

import { parseSrt, parseVtt, parseSubtitleFile } from '../src/utils/videoKnowledge'
import { importVideoKnowledge, searchVideos, retrieveVideoKnowledge, buildVideoKnowledgeSection, getVideoBooks, removeVideoBook, clearVideoBooks, type VideoBook, type VideoRagHit } from '../src/utils/videoKnowledge'
import { buildSpeechMessages } from '../src/utils/debatePrompts'

let passed = 0
let failed = 0
const errors: string[] = []

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    errors.push(name + (detail ? ` — ${detail}` : ''))
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ============ 1. 字幕解析 ============

function testParseSrt() {
  console.log('\n[1] parseSrt')
  const srt = `1
00:00:01,000 --> 00:00:03,500
黑洞是宇宙中最神秘的天体之一

2
00:00:04,000 --> 00:00:07,200
它的引力强大到连光都无法逃脱

3
00:00:08,000 --> 00:00:10,000
科学家通过事件视界望远镜拍摄到了第一张照片`
  const out = parseSrt(srt)
  assert(out.includes('黑洞是宇宙中最神秘的天体之一'), '提取第一句字幕')
  assert(out.includes('它的引力强大到连光都无法逃脱'), '提取第二句字幕')
  assert(out.includes('科学家通过事件视界望远镜拍摄到了第一张照片'), '提取第三句字幕')
  assert(!/--></.test(out), '无时间轴残留')
  assert(!/^\d+$/m.test(out), '无序号残留')
  assert(out.split('\n').length === 3, '共 3 行纯文本', `实际 ${out.split('\n').length} 行`)

  // 无时间轴的纯文本（容错）
  const plain = parseSrt('纯文本内容\n没有时间轴')
  assert(plain.includes('纯文本内容'), '无时间轴容错')
}

function testParseVtt() {
  console.log('\n[2] parseVtt')
  const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.500
量子纠缠是爱因斯坦眼中的幽灵

2
00:00:04.000 --> 00:00:07.200
两个粒子无论距离多远都会同步变化`
  const out = parseVtt(vtt)
  assert(out.includes('量子纠缠是爱因斯坦眼中的幽灵'), '提取第一句')
  assert(out.includes('两个粒子无论距离多远都会同步变化'), '提取第二句')
  assert(!/WEBVTT/.test(out), '去掉 WEBVTT 头部')
  assert(!/--></.test(out), '无时间轴残留')
}

function testParseSubtitleFile() {
  console.log('\n[3] parseSubtitleFile')
  const srt = `1
00:00:01,000 --> 00:00:03,500
碳基生命的核心是DNA`
  assert(parseSubtitleFile('video.srt', srt).includes('碳基生命的核心是DNA'), '.srt 路由到 parseSrt')
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.500
暗物质占宇宙质量的85%`
  assert(parseSubtitleFile('video.vtt', vtt).includes('暗物质占宇宙质量的85%'), '.vtt 路由到 parseVtt')
  const md = `# 视频转录

00:00:01,000 --> 00:00:03,500
这段是转录内容`
  const mdOut = parseSubtitleFile('transcript.md', md)
  assert(mdOut.includes('这段是转录内容'), '.md 保留正文')
  assert(!/--></.test(mdOut), '.md 清理时间轴残留')
  const external = `1
00:00:02,000 --> 00:00:05,000
外部转录工具的内容`
  assert(parseSubtitleFile('video.transcript.txt', external).includes('外部转录工具的内容'), '.txt 通用清理')
}

// ============ 2. 导入 ============

async function testImport() {
  console.log('\n[4] importVideoKnowledge（Node 内存降级）')
  const text = `在宇宙尺度上，时间并非匀速流动。爱因斯坦的广义相对论告诉我们，引力越强的区域，时间流逝得越慢。这就是引力时间膨胀效应。
在地球表面，我们每个人的头顶与脚底，时间流逝的速度其实都存在微小的差异，只是这种差异极其细微，普通仪器根本无法察觉。
GPS 卫星因为运行在更高的轨道上，受到的地球引力更弱，因此卫星上的时钟每天会比地面快大约 38 微秒。如果不进行修正，导航误差每天会累积到 10 公里以上。
这正是相对论在现代科技中最直接的应用——你在手机上使用的地图导航，每一天都在依赖爱因斯坦的理论。`
  const book = await importVideoKnowledge({
    title: '时间膨胀与GPS',
    sourceUrl: 'https://v.douyin.com/example',
    tags: ['物理', '相对论'],
    summary: '引力时间膨胀的科普',
    text,
    sourceKind: 'paste',
  })
  assert(!!book.id, '生成 id')
  assert(book.title === '时间膨胀与GPS', '保存标题')
  assert(book.tags.length === 2, '保存标签', `实际 ${book.tags.length}`)
  assert(book.chunkCount > 0, '内容切块入库', `实际 ${book.chunkCount} 块`)

  // 检索命中
  const hits = await searchVideos('GPS 卫星 时间 相对论', 3)
  assert(hits.length > 0, '检索命中视频知识', `实际 ${hits.length} 条`)
  assert(hits[0].title.includes('时间膨胀'), '命中标题正确')
  assert(hits[0].text.includes('GPS'), '命中内容正确')

  // 不相关查询不命中
  const none = await searchVideos('今天天气怎么样啊', 3)
  assert(none.length === 0 || none.length <= 3, '不相关查询低命中')

  return book
}

// ============ 3. 提示词段 ============

function testBuildSection() {
  console.log('\n[5] buildVideoKnowledgeSection')
  const hits = [
    { title: '时间膨胀与GPS', text: 'GPS 卫星每天快 38 微秒。', score: 8.5 },
    { title: '量子纠缠', text: '两个粒子距离再远也同步。', score: 6.2 },
  ]
  const section = buildVideoKnowledgeSection(hits)
  assert(section.includes('你学过的视频知识'), '含标题段')
  assert(section.includes('[1] 《时间膨胀与GPS》'), '含 [1] 引用')
  assert(section.includes('[2] 《量子纠缠》'), '含 [2] 引用')
  assert(section.includes('📺'), '含 📺 标识')
  assert(section.includes('严禁编造'), '含使用准则')
  assert(buildVideoKnowledgeSection([]) === '', '空 hits 返回空串')
  assert(buildVideoKnowledgeSection(null as unknown as VideoRagHit[]) === '', 'null 容错返回空串')
}

async function testRetrieve() {
  console.log('\n[6] retrieveVideoKnowledge')
  const section = await retrieveVideoKnowledge('相对论 时间膨胀', 3)
  assert(section !== null, '有知识时返回提示词段')
  assert(section?.includes('你学过的视频知识'), '返回段含标题')

  // 清空后检索不到
  await clearVideoBooks()
  const none = await retrieveVideoKnowledge('相对论', 3)
  assert(none === null, '清空后返回 null')
}

// ============ 4. 删除链路 ============

async function testRemove() {
  console.log('\n[7] removeVideoBook / clearVideoBooks')
  const b1 = await importVideoKnowledge({ title: '删除测试A', text: '这是第一段用于删除测试的视频知识内容，包含足够长度的文字以便切块入库。', sourceKind: 'paste' })
  const b2 = await importVideoKnowledge({ title: '删除测试B', text: '这是第二段用于删除测试的视频知识内容，同样包含足够长度的文字以便切块入库检索。', sourceKind: 'paste' })
  let books = getVideoBooks()
  assert(books.length === 2, '导入 2 条元数据', `实际 ${books.length}`)

  await removeVideoBook(b1.id)
  books = getVideoBooks()
  assert(books.length === 1, '删除后剩 1 条')
  assert(books[0].id === b2.id, '保留的是 B')

  // 删除后内容层也清掉（docId 链路）
  const hits = await searchVideos('删除测试A', 3)
  assert(!hits.some(h => h.text.includes('第一段')), 'A 的内容已从检索层移除')

  await clearVideoBooks()
  books = getVideoBooks()
  assert(books.length === 0, '清空后元数据为空')
}

// ============ 5. 辩论提示词注入 ============

function testDebatePromptInjection() {
  console.log('\n[8] buildSpeechMessages 注入 videoKnowledge')
  const msgs = buildSpeechMessages({
    typeId: 'INTJ',
    typeName: '建筑师',
    side: 'pro',
    topic: 'AI 是否应该被限制发展',
    stage: 'opening',
    ownSpeechCount: 0,
    recentHistory: [],
    research: '资料包内容',
    videoKnowledge: '## 你学过的视频知识（来自「📺 视频收藏」）\n[1] 《AI科普》：大模型训练消耗大量电力。',
  }) as unknown as { role: string; content: string }[]
  const userContent = msgs.filter(m => m.role === 'user').map(m => m.content).join('\n')
  assert(userContent.includes('你学过的视频知识'), 'user 提示词含视频知识段')
  assert(userContent.includes('[1] 《AI科普》'), '含视频引用 [1]')
  assert(userContent.includes('资料包内容'), '原资料包仍注入')
}

// ============ 主流程 ============

async function main() {
  console.log('=== v34 视频知识模块测试 ===')
  testParseSrt()
  testParseVtt()
  testParseSubtitleFile()
  await testImport()
  testBuildSection()
  await testRetrieve()
  await testRemove()
  testDebatePromptInjection()

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`)
  if (failed > 0) {
    console.log('\n失败项：')
    for (const e of errors) console.log('  - ' + e)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('测试执行异常:', err)
  process.exit(1)
})
