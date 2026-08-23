/**
 * 打印单条带书籍引用的完整回复，检查句子自然度
 */
import { generateDebateResponse } from '../src/utils/debateEngine'

const typeId = 'INTJ'
for (let i = 0; i < 12; i++) {
  const history = [
    { typeId: 'me', content: '人工智能以后会不会取代人类？', isUser: true },
  ]
  const resp = generateDebateResponse(typeId, '人工智能会不会取代人类', history, {
    side: i % 2 === 0 ? 'pro' : 'con',
  })
  if (/尼采|卡尼曼|奥卡姆/.test(resp.content)) {
    console.log('【INTJ 含书籍引用】')
    console.log(resp.content)
    console.log('---')
    break
  }
}

const typeId2 = 'ISFP'
for (let i = 0; i < 12; i++) {
  const history = [
    { typeId: 'me', content: '你觉得现在的年轻人太浮躁了吗？', isUser: true },
  ]
  const resp = generateDebateResponse(typeId2, '年轻人是不是越来越浮躁', history, {
    side: i % 2 === 0 ? 'pro' : 'con',
  })
  if (/梭罗|济慈/.test(resp.content)) {
    console.log('【ISFP 含书籍引用】')
    console.log(resp.content)
    console.log('---')
    break
  }
}
