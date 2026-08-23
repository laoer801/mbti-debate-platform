/**
 * 经典辩论案例库（v27.2）
 *
 * 把真实发生过的经典辩论赛 / 名场面 / 社会大讨论提炼成「案例弹药」：
 * - 供 LLM 辩手在发言时引用（如「1993 年国际大专辩论赛上，蒋昌建说过……」）
 * - 供本地模板引擎 weaveCases 口语化织入
 * - 每条含：出处 / 辩题 / 正反核心观点 / 金句 / 适合人格
 *
 * 铁律：全部来自真实可查的辩论赛与公开讨论，不虚构案例。
 */

export interface DebateCase {
  id: string
  /** 出处：哪场辩论赛 / 哪个节目 / 哪次公开争论 */
  source: string
  /** 辩题或争议核心 */
  topic: string
  /** 正方核心观点（1-2 条） */
  proPoints: string[]
  /** 反方核心观点（1-2 条） */
  conPoints: string[]
  /** 流传最广的金句/经典语录（可引用） */
  quotes: string[]
  /** 这个案例最能打动/最适合哪几类人格（辩论时优先推荐） */
  types: string[]
  /** 一句点评：这个案例为什么经典 */
  note: string
}

export const DEBATE_CASES: DebateCase[] = [
  {
    id: 'case-intl1993-human-nature',
    source: '1993 年国际大专辩论会决赛',
    topic: '人性本善还是人性本恶',
    proPoints: ['人性本善，恶是社会环境后天污染的产物', '教育的意义正在于守护与唤醒天生的善'],
    conPoints: ['人性本恶，善是后天教化与约束的结果', '承认人性之恶才能设计出有效的制度约束'],
    quotes: ['黑夜给了我黑色的眼睛，我却用它寻找光明。（蒋昌建总结陈词）', '善花结善果，恶花结恶果——关键看社会给你什么土壤。'],
    types: ['INFJ', 'ENFJ', 'INTJ', 'ENTJ'],
    note: '华语辩论史上的封神之战，复旦四朵金花与台湾大学一战，定义了「立论-交锋-升华」的经典结构。',
  },
  {
    id: 'case-intl2001-money',
    source: '2001 年国际大专辩论会决赛',
    topic: '钱是万恶之源吗',
    proPoints: ['钱诱发贪欲，贪欲驱动恶行', '社会性恶行背后几乎都有金钱的驱动力'],
    conPoints: ['恶源于人心而非钱本身，钱只是工具', '将恶归因于钱，是为作恶者开脱'],
    quotes: ['万恶之源是钱吗？不，万恶之源是人对钱的无度渴望。', '钱的本身无善无恶，善恶在用它的人。'],
    types: ['ENTJ', 'ESTJ', 'ISTJ', 'INTJ'],
    note: '武大与马大世纪之战，把「定义之争」做到极致——正反双方在「万」「恶」「源」三个字上反复拉锯。',
  },
  {
    id: 'case-qipa-change-self',
    source: '《奇葩说》第一季',
    topic: '要不要为了喜欢的人改变自己',
    proPoints: ['爱本身就是双向塑造，改变是投入的证明', '愿意改变说明你在乎，关系需要磨合'],
    conPoints: ['为取悦对方改变自我会失去吸引力', '真正的爱接受你的本来面目，不要求你变形'],
    quotes: ['好的爱情不是让你变成另一个人，而是让你更成为自己。', '我改变不是因为我不好，而是因为我愿意为你更好。'],
    types: ['ISFP', 'ENFP', 'INFP', 'ESFP'],
    note: '把私人情感议题辩论化的国民级节目，情感型人格的最佳素材。',
  },
  {
    id: 'case-qipa-keyboard-man',
    source: '《奇葩说》辩题',
    topic: '键盘侠是不是侠',
    proPoints: ['键盘侠推动了公共事件的舆论监督', '网络发声是普通人的武器，侠在民间'],
    conPoints: ['只说不做、跟风起哄不配称侠', '侠要有担当与后果，躲在屏幕后的不算'],
    quotes: ['侠是「天下兴亡匹夫有责」，不是「事不关己高高挂起」。', '网络正义感廉价，实名负责的才叫侠。'],
    types: ['ENTP', 'ESTP', 'INTP', 'ENTJ'],
    note: '关于网络话语权的经典辩题，直接映射「流量时代发声责任」的当代争论。',
  },
  {
    id: 'case-qipa-food-delivery',
    source: '《奇葩说》辩题',
    topic: '外卖小哥惹毛我，该不该投诉他',
    proPoints: ['投诉是消费者权利，也是平台改进的反馈', '不投诉会纵容服务质量下降'],
    conPoints: ['小哥不易，多一份体谅少一份苛责', '投诉可能让他丢了饭碗，善良应该优先'],
    quotes: ['制度的善意，体现在它允许普通人犯错。', '外卖迟到可以忍，但社会规则不能一直让步。'],
    types: ['ISFJ', 'ESFJ', 'ENFJ', 'INFJ'],
    note: '「规则 vs 体谅」的微型伦理剧场，feeler 型人格最能共情的话题。',
  },
  {
    id: 'case-qipa-adult-collapse',
    source: '《奇葩说》辩题',
    topic: '成年人崩溃要不要藏起来',
    proPoints: ['藏起崩溃是成年人的体面与责任', '情绪管理是职业素养的一部分'],
    conPoints: ['藏起崩溃是在惩罚自己，允许脆弱才是健康', '真实的崩溃能换来理解与支持'],
    quotes: ['成年人的崩溃，是默不作声的崩溃。', '体面不是不哭，而是哭完还能继续走。'],
    types: ['ISFJ', 'INFP', 'ENFP', 'ISFP'],
    note: '戳中当代职场人情绪管理的集体痛点，感性型人格的共鸣库。',
  },
  {
    id: 'case-qipa-work-message',
    source: '《奇葩说》辩题',
    topic: '下班后工作消息要不要回',
    proPoints: ['回消息是职业素养，紧急事务需要响应', '不回消息可能错失重要机会'],
    conPoints: ['下班时间是个人权利，不回是边界', '24 小时待命文化正在吞噬生活'],
    quotes: ['工作消息可以回，但人生的消息也得有人回。', '划不清边界的人，永远在下班。'],
    types: ['ISTJ', 'ESTJ', 'INTJ', 'ENTJ'],
    note: '数字时代「工作-生活边界」的代表性辩题，实感型人格的现实痛点。',
  },
  {
    id: 'case-ai4-2026-three-pioneers',
    source: '2026 年 Ai4 大会 AI 三巨头同台交锋',
    topic: 'AI 会取代人类工作吗',
    proPoints: ['辛顿：AI 将重创白领岗位，客服等职业首当其冲', '机器把「挖沟的人」的历史重演一遍'],
    conPoints: ['吴恩达：AI 重塑任务而非消灭岗位，工程师反而升级', '李飞飞：岗位在转型，关键是再培训与公共投资'],
    quotes: ['辛顿：那些人的出路是什么？他们普遍教育程度不高，AI 能做的，再培训也追不上。', '吴恩达：AI 正在接管写代码，但写代码只是工程师工作的一小部分。', '李飞飞：与其说工作被取代，不如说工作在被重新定义。'],
    types: ['INTJ', 'INTP', 'ENTJ', 'ENTP'],
    note: '2026 年 AI 就业之争的巅峰现场，三位教父级人物观点直接对立，是「AI 取代论」最权威的素材。',
  },
  {
    id: 'case-huxijin-ai-barber',
    source: '2026 年 8 月胡锡进 AI 全自动理发机事件',
    topic: 'AI 应该「提效」还是「替代」',
    proPoints: ['AI 应帮助提高效率与准确性，而不是消灭行业、剥夺饭碗', '以替代劳动者为目的的研究，立项需极其谨慎'],
    conPoints: ['技术恐惧是「因噎废食」，类比 19 世纪英国《红旗法案》', '提效的尽头就是替代，资本的逻辑没有适可而止'],
    quotes: ['15 元剪一次、不办卡不推销——技术普惠，但理发的师傅怎么办？', '效率与公平之间，总有人要付出代价，问题是谁来兜底。'],
    types: ['ISFJ', 'ENFJ', 'ESFJ', 'INFJ'],
    note: '2026 年中国社会最火的 AI 争议：一条 AI 理发视频引爆「技术进步 vs 劳动者饭碗」全民大讨论。',
  },
  {
    id: 'case-lao-you-sai-love-superpower',
    source: '2019 华语辩坛老友赛',
    topic: '如果你有超能力让爱的人也爱你，要不要用',
    proPoints: ['让爱圆满是人之常情，能力就该为人所用', '爱需要成全，超能力只是缩短了过程'],
    conPoints: ['被操控的爱不是爱，剥夺了对方的选择自由', '真正的爱要经得起自由的检验'],
    quotes: ['爱不是占有，是让被爱者有自由说不的权利。', '如果爱能被制造，那它就不是爱，是麻醉剂。'],
    types: ['INFP', 'INFJ', 'ENFP', 'ISFP'],
    note: '近年华语辩坛传播最广的价值辩题，把「自由意志与爱」讨论到哲学深度。',
  },
  {
    id: 'case-diploma-inflation-2026',
    source: '2026 年学历通胀大讨论',
    topic: '学历还值钱吗',
    proPoints: ['学历仍是阶层跃迁的最可靠通道', '名校光环在求职市场的筛选价值依然存在'],
    conPoints: ['73% 企业已用能力模型而非学历筛选人才', '学历越高就业率反倒越低，供给已严重过剩'],
    quotes: ['清华女硕士走进技校学炒菜——学历的尽头是技能。', '学历通胀的本质：文凭贬值，但学习永远保值。'],
    types: ['ESTJ', 'ISTJ', 'ENTJ', 'INTJ'],
    note: '2026 年 343 万考研 + 双一流扩招 10 万 + 就业倒挂，教育焦虑的现实素材。',
  },
  {
    id: 'case-neijuan-2026',
    source: '2026 年「内卷 vs 躺平」全民讨论',
    topic: '内卷与躺平，是出路还是陷阱',
    proPoints: ['内卷是供需失衡的必然，破解要靠增量创造', '躺平是消极避世，甚至被境外势力利用放大'],
    conPoints: ['内卷是一场合谋：资本与平台制造焦虑收割', '躺平是理性止损，拒绝无效内耗是清醒的选择'],
    quotes: ['剧场效应：有人站起来看戏，最后所有人都站着。', '不卷不是认输，是不愿在存量里互相踩踏。'],
    types: ['ENTP', 'INTP', 'ENTJ', 'ENFP'],
    note: '2026 年政府工作报告把「深入整治内卷式竞争」列为首要任务，社会共识级辩题。',
  },
]

/**
 * 按辩题关键词匹配案例（命中越多越靠前）
 */
export function findCasesForTopic(topic: string, limit = 2): DebateCase[] {
  const kws = topic
    .replace(/[？?！!。，,.、：:；;「」『』]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 2)
  const scored = DEBATE_CASES.map(c => {
    let score = 0
    const hay = `${c.topic}${c.proPoints.join('')}${c.conPoints.join('')}`
    for (const kw of kws) {
      if (hay.includes(kw)) score += 2
      if (c.topic.includes(kw)) score += 1
    }
    return { c, score }
  })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.c)
  return scored.slice(0, limit)
}

/**
 * 随机取一个案例（不限辩题匹配，兜底用）
 */
export function randomCase(): DebateCase {
  return DEBATE_CASES[Math.floor(Math.random() * DEBATE_CASES.length)]
}
