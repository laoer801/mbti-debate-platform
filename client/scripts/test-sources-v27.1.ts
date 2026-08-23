/**
 * v27.1 验证脚本：16 人格本地模板书籍引用（weaveSources）+ toneSuffixes 补全
 * 用法：npm run test:sources  （esbuild bundle + node）
 */
import { generateDebateResponse } from '../src/utils/debateEngine'
import { PERSONA_SOURCES } from '../src/utils/debatePrompts'

const allTypes = Object.keys(PERSONA_SOURCES)
console.log(`PERSONA_SOURCES 覆盖人格数：${allTypes.length}`)
console.log('—— 16 人格书籍引用抽样（每人格 2 次聊天回复）——')

let sourcedCount = 0
let total = 0
for (const typeId of allTypes) {
  const names = PERSONA_SOURCES[typeId].map(s => s.source)
  let hit = 0
  for (let i = 0; i < 6; i++) {
    const history = [
      { typeId: 'me', content: '我觉得城市里应该全面禁电动车，太危险了。', isUser: true },
    ]
    const resp = generateDebateResponse(typeId, '城市应不应该禁止电动车', history, {
      side: i % 2 === 0 ? 'pro' : 'con',
    })
    total++
    const mentioned = names.some(n => resp.content.includes(n.slice(0, 4)))
    if (mentioned) {
      hit++
      sourcedCount++
    }
  }
  console.log(`${typeId.padEnd(4)} 弹药库[${names.join(' / ')}]  6 次中 ${hit} 次提及书籍`)
}

console.log(`\n合计：${total} 次回复，${sourcedCount} 次提及书籍（${Math.round((sourcedCount / total) * 100)}%）`)
