/**
 * v32 本地知识库 RAG 测试（test-rag-v32.ts）
 *
 * 覆盖：分词器 / BM25 索引检索 / 分块 / 领域路由 / 存储 / RAG 端到端 / 引用标注
 * 运行：npm run test:rag:v32（esbuild bundle → node）
 */
import { tokenize, tokenizeQuery } from '../src/utils/knowledgeBase/tokenizer'
import { buildIndex, searchIndex } from '../src/utils/knowledgeBase/bm25'
import { chunkText, parseDocumentFile } from '../src/utils/knowledgeBase/documentParser'
import { routeDomain, pickDomain } from '../src/utils/knowledgeBase/router'
import { addDocument, searchDomain, getAllDomains, getDocuments, removeDocument } from '../src/utils/knowledgeBase/store'
import { retrieveForQuery, buildKnowledgeSection, extractCitations } from '../src/utils/knowledgeBase/rag'

let passed = 0
let failed = 0
const failures: string[] = []

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

function section(t: string) {
  console.log(`\n=== ${t} ===`)
}

;(async () => {
  // ============ 1. 分词器 ============
  section('分词器 tokenizer')
  {
    const t1 = tokenize('如何投资基金')
    assert(t1.includes('投资') && t1.includes('基金'), '词典命中：投资/基金', JSON.stringify(t1))
    const t2 = tokenize('量子纠缠原理是什么')
    assert(t2.includes('原理'), '2-gram/词典回退：原理', JSON.stringify(t2))
    const t3 = tokenize('我觉得这个事情是这样的')
    assert(!t3.includes('的') && !t3.includes('我'), '停用词过滤', JSON.stringify(t3))
    const t4 = tokenize('GPT-4 大模型')
    assert(t4.includes('gpt') || t4.includes('大模型'), '英文/数字 token', JSON.stringify(t4))
    const t5 = tokenizeQuery('股票基金怎么定投')
    assert(t5.includes('股票') && t5.includes('基金') && t5.includes('定投'), '查询分词口径一致', JSON.stringify(t5))
  }

  // ============ 2. BM25 ============
  section('BM25 索引与检索')
  {
    const chunks = [
      { id: 'a', text: '基金定投是指定期定额投资基金，通过长期分批买入摊薄成本。', title: '基金定投入门' },
      { id: 'b', text: '劳动合同应当约定工作内容、劳动报酬、休息休假等条款。', title: '劳动合同指南' },
      { id: 'c', text: '民法典规定民事主体从事民事活动应当遵循诚信原则。', title: '民法典常识' },
    ]
    const index = buildIndex(chunks, tokenize)
    const hits = searchIndex(index, '基金定投怎么操作', tokenizeQuery, 3)
    assert(hits.length > 0, '检索返回结果')
    assert(hits[0]?.id === 'a', '基金问题命中基金块', hits.map(h => `${h.id}:${h.score.toFixed(2)}`).join(', '))
    const law = searchIndex(index, '劳动合同违约赔偿', tokenizeQuery, 3)
    assert(law[0]?.id === 'b', '劳动合同问题命中合同块', law.map(h => h.id).join(','))
    // 标题加权：查询「劳动合同」应命中 b（标题含该词）而非 c
    const t = searchIndex(index, '劳动合同 诚信', tokenizeQuery, 3)
    assert(t[0]?.id === 'b', '标题加权优先', t.map(h => `${h.id}:${h.score.toFixed(2)}`).join(', '))
    assert(extractCitations('[1] 和 [2] 引用，见[3]')[0] === 1 && extractCitations('[1] 和 [2] 引用，见[3]').length === 3, 'extractCitations 提取序号')
  }

  // ============ 3. 分块 ============
  section('分块 chunkText')
  {
    const long = Array.from({ length: 30 }, (_, i) => `这是第${i}段关于金融投资知识的说明文字，内容足够长以便测试分块逻辑是否正确工作。`).join('\n\n')
    const chunks = chunkText(long, 400, 60)
    assert(chunks.length >= 3, '长文本切成多块', `${long.length}字 → ${chunks.length}块`)
    assert(chunks.every(c => c.length <= 500), '每块不超过上限', chunks.map(c => c.length).join(','))
    const single = chunkText('短文本', 400, 60)
    assert(single.length === 1, '短文本单块')
    assert(chunkText('', 400, 60).length === 0, '空文本零块')
  }

  // ============ 4. 领域路由 ============
  section('领域路由 router')
  {
    const domains = (await getAllDomains()).filter(d => d.enabled)
    const fin = routeDomain('股票基金怎么定投', domains, tokenize)
    assert(fin.length > 0 && fin[0].domain.id === 'finance', '金融问题 → finance', fin[0]?.domain.id)
    const law = routeDomain('劳动合同违约怎么赔偿', domains, tokenize)
    assert(law.length > 0 && law[0].domain.id === 'law', '法律问题 → law', law[0]?.domain.id)
    const mkt = routeDomain('小红书品牌营销怎么做', domains, tokenize)
    assert(mkt.length > 0 && mkt[0].domain.id === 'marketing', '营销问题 → marketing', mkt[0]?.domain.id)
    const noHit = pickDomain('今天天气怎么样', domains, tokenize)
    assert(noHit.general?.id === 'general', '无命中兜底 general', noHit.general?.id)
  }

  // ============ 5. 存储 + RAG 端到端 ============
  section('存储与 RAG 端到端（内存后端）')
  {
    const financeDoc = await addDocument(
      'finance',
      '基金定投入门.md',
      '基金定投入门',
      'md',
      [
        { text: '基金定投的核心是定期定额买入，通过时间分散风险，长期来看摊薄持仓成本。', title: '基金定投入门', fileName: '基金定投入门.md', seq: 0 },
        { text: '定投适合长期投资目标，如养老、教育金；选择指数基金通常费率更低。', title: '基金定投入门', fileName: '基金定投入门.md', seq: 1 },
      ],
      512
    )
    assert(financeDoc.chunkCount === 2, '文档入库生成块', JSON.stringify(financeDoc))
    const docs = await getDocuments('finance')
    assert(docs.some(d => d.docId === financeDoc.docId), '文档可查询')

    const hits = await searchDomain('finance', '基金定投怎么做', 3)
    assert(hits.length >= 1, '领域内检索命中', hits.map(h => h.id).join(', '))

    const rag = await retrieveForQuery('基金定投适合长期投资吗', 4)
    assert(rag !== null, 'RAG 检索返回上下文')
    if (rag) {
      assert(rag.domainId === 'finance', '路由到 finance', `${rag.domainId}(${rag.domainName})`)
      assert(rag.hits.length >= 1, '命中至少 1 条资料', String(rag.hits.length))
      const sec = buildKnowledgeSection(rag)
      assert(sec.includes('[1]') && sec.includes('知识库上下文'), '知识上下文带引用编号')
      const cites = extractCitations('根据资料[1]，定投适合长期[2]')
      assert(cites.length === 2, '回答引用提取 [1][2]', JSON.stringify(cites))
    }

    // 清理
    await removeDocument('finance', financeDoc.docId)
    const after = await getDocuments('finance')
    assert(!after.some(d => d.docId === financeDoc.docId), '删除文档生效')
  }

  // ============ 6. 文档解析（纯文本 + docx） ============
  section('文档解析 parser')
  {
    const mdFile = { name: '测试.md', arrayBuffer: async () => new TextEncoder().encode('# 标题\n\n基金定投是定期定额投资。\n\n法律合同要点。').buffer }
    const parsed = await parseDocumentFile(mdFile as any)
    assert(parsed.kind === 'md' && parsed.chunks.length >= 1, 'md 解析', `${parsed.kind} chunks=${parsed.chunks.length}`)
    const txtFile = { name: '测试.txt', arrayBuffer: async () => new TextEncoder().encode('纯文本内容测试。').buffer }
    const parsedTxt = await parseDocumentFile(txtFile as any)
    assert(parsedTxt.kind === 'txt' && parsedTxt.chunks.length === 1, 'txt 解析')
    const badFile = { name: '测试.exe', arrayBuffer: async () => new ArrayBuffer(4) }
    const parsedBad = await parseDocumentFile(badFile as any)
    assert(parsedBad.error != null, '不支持格式友好报错', parsedBad.error)
  }

  // ============ 汇总 ============
  console.log(`\n${'='.repeat(46)}`)
  console.log(`结果：${passed} 通过 / ${failed} 失败`)
  if (failed > 0) {
    console.log('失败项：' + failures.join('；'))
    process.exit(1)
  }
  console.log('🎉 v32 本地知识库 RAG 全部测试通过！')
})().catch(err => {
  console.error('测试执行异常：', err)
  process.exit(1)
})
