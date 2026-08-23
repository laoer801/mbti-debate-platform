/**
 * 全网热门观点库（v27.2）
 *
 * 收录当下（2026）真实高热度、争议大的话题及各方主流观点。
 * 每个热点带「热度标记」与「适合人格」——按人格认知风格分配：
 * 理性型人格（NT）适合引用数据/逻辑类观点，情感型（NF/SF）适合引用人文关怀类观点。
 *
 * 数据来源：2026 年公开报道与公开讨论（AI 三巨头 Ai4 交锋、胡锡进 AI 理发事件、
 * 学历通胀讨论、内卷整治、奇葩说等）。铁律：观点必须真实有出处，不虚构。
 */

export interface HotTopicPoint {
  /** 一句话观点 */
  text: string
  /** 观点出处/提出者 */
  source: string
}

export interface HotTopic {
  id: string
  /** 话题名 */
  title: string
  /** 热度：🔥 越多越热（1-3） */
  heat: 1 | 2 | 3
  /** 一句话背景 */
  summary: string
  /** 支持/正方观点 */
  proPoints: HotTopicPoint[]
  /** 反对/反方观点 */
  conPoints: HotTopicPoint[]
  /** 适合引用这些人���（按认知风格分配） */
  types: string[]
  /** 来源（报道/事件名） */
  source: string
}

export const HOT_TOPICS: HotTopic[] = [
  {
    id: 'hot-ai-jobs-2026',
    title: 'AI 会不会取代人类工作',
    heat: 3,
    summary: '2026 年 8 月，Hinton、李飞飞、吴恩达三位 AI 教父在 Ai4 大会同台交锋；胡锡进因 AI 理发视频发文警告「别用 AI 消灭行业」。AI 就业之争成为年度最热辩题。',
    proPoints: [
      { text: 'AI 将重创白领岗位，客服等职业首当其冲，被替代者普遍教育程度不高、再培训也追不上', source: 'Geoffrey Hinton，Ai4 2026' },
      { text: 'AI 应「提效」而非「替代」，以取代劳动者为目的的研究立项需极其谨慎', source: '胡锡进，2026.8' },
      { text: '15 元一次、不办卡不推销的 AI 理发，是效率，也是普通劳动者饭碗的警钟', source: 'AI 理发事件网友讨论，2026.8' },
    ],
    conPoints: [
      { text: 'AI 重塑任务而非消灭岗位：写代码只是工程师工作的一小部分，人会升级为更宽的岗位', source: 'Andrew Ng，Ai4 2026' },
      { text: '与其说被取代，不如说工作在被重新定义，关键在再培训与公共投资', source: '李飞飞，Ai4 2026' },
      { text: '技术恐惧是因噎废食——19 世纪英国用《红旗法案》挡汽车，结局是自缚手脚', source: '反对 AI 恐惧论网友，2026.8' },
    ],
    types: ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'ISFJ', 'ENFJ'],
    source: 'Ai4 2026 大会 / 胡锡进微博事件，2026.8',
  },
  {
    id: 'hot-ai-disclosure',
    title: 'AI 生成内容要不要强制标注',
    heat: 3,
    summary: '2026 年 AI 深度伪造泛滥，欧盟《人工智能法案》落地后，「AI 生成内容强制标注」从技术议题变成公共政策之争。',
    proPoints: [
      { text: '观众无法在不知情时做判断，标注是认知信任的底线', source: 'AI 内容治理讨论' },
      { text: '数字水印是「用技术解决技术问题」的可行路径', source: '达沃斯论坛 AI 治理共识' },
    ],
    conPoints: [
      { text: '跨辖区强制标注不可执行，还会造成高低质量内容的虚假对等', source: 'debateladder.com 2026 辩题库' },
      { text: '过度标注可能反噬真实内容，人人自证「我是真人」的时代更荒诞', source: '反对强制标注观点' },
    ],
    types: ['INTJ', 'ISTJ', 'ENTJ', 'INTP'],
    source: '2026 AI 内容治理讨论',
  },
  {
    id: 'hot-ai-liability',
    title: '公司该不该为 AI 造成的伤害负责',
    heat: 2,
    summary: '自动驾驶事故、AI 误诊、算法歧视案件频发，「AI 责任归属」成为法律界与科技界的核心争议。',
    proPoints: [
      { text: '责任倒逼安全开发：现有侵权法无法覆盖算法伤害', source: 'AI 责任法律讨论' },
      { text: '受害者不该承担「算法黑箱」的举证困难', source: '消费者权益视角' },
    ],
    conPoints: [
      { text: '严格责任会扼杀创新，AI 涌现行为的因果链极难认定', source: '科技企业界观点' },
      { text: '把责任全压给公司，会让小企业不敢碰 AI，垄断巨头反而受益', source: '开源社区观点' },
    ],
    types: ['ENTJ', 'ESTJ', 'ISTJ', 'INTP'],
    source: '2026 AI 责任立法讨论',
  },
  {
    id: 'hot-neijuan-2026',
    title: '内卷是一场合谋的骗局吗',
    heat: 3,
    summary: '2026 年政府工作报告将「深入整治内卷式竞争」列为首要任务；网络热文《内卷是一场合谋的骗局》引爆「谁最希望内卷持续」的灵魂拷问。',
    proPoints: [
      { text: '内卷是供大于求的必然：一个岗位一千份简历，定价权在资本手里', source: '《内卷是一场合谋的骗局》，2026.6' },
      { text: '培训机构渲染起跑线焦虑、平台先补贴后收割，内卷是制造出来的', source: '同上' },
      { text: '剧场效应：有人站起来，最后所有人都站着——内卷是集体无意识', source: '南方日报评论，2026.3' },
    ],
    conPoints: [
      { text: '内卷的本质是存量厮杀而非增量创造，破解靠的是产业升级与全国统一大市场', source: '2026 政治局会议定调' },
      { text: '拒绝内卷不等于躺平：理性奋斗、向内扎根、只和过去的自己比', source: '南方日报评论' },
    ],
    types: ['ENTP', 'INTP', 'ENTJ', 'ENFP', 'ISTJ', 'ESTJ'],
    source: '2026 年整治内卷式竞争大讨论',
  },
  {
    id: 'hot-diploma-2026',
    title: '学历越高就业率越低，学历还值钱吗',
    heat: 3,
    summary: '2026 年 343 万考研、双一流扩招 10 万，却出现「学历越高就业率越低」倒挂；清华女硕士进技校学炒菜等「逆向求学」频上热搜。',
    proPoints: [
      { text: '学历是阶层跃迁最可靠的通道，「学而优则仕」的文化基因仍在', source: '教育学者观点' },
      { text: '高校扩招供给超过高质量岗位增速，学历贬值是结构性问题', source: '社科院学部委员蔡昉' },
    ],
    conPoints: [
      { text: '73% 企业已用「能力模型」而非学历筛选人才，高校却在批量生产学历', source: '2026 就业报告' },
      { text: '四川 61 名本科毕业生就读技师学院——用行动打破「唯学历」老路', source: '2026 逆向求学案例' },
      { text: '学历通胀下，真正稀缺的是技能、是学习能力，不是那张纸', source: '就业讨论' },
    ],
    types: ['ESTJ', 'ISTJ', 'ENTJ', 'INTJ', 'ISFJ', 'ESFJ'],
    source: '2026 年学历通胀与就业倒挂讨论',
  },
  {
    id: 'hot-tangping-2026',
    title: '躺平是反抗还是陷阱',
    heat: 2,
    summary: '「躺平即正义」短视频批量出现，国家安全部披露境外势力资助「躺平网红」放大焦虑；躺平从个人选择升级为意识形态议题。',
    proPoints: [
      { text: '躺平是理性止损：拒绝无效内耗，是年轻人对「卷不动」的清醒回应', source: '躺平支持者观点' },
      { text: '「努力无用」「奋斗吃亏」被刻意放大，背后有组织在系统性渗透', source: '国家安全部披露，2026' },
    ],
    conPoints: [
      { text: '躺平与内卷一体两面，都是发展转型期必须正视的现象', source: '官方评论，2026.4' },
      { text: '真正的破局不是二选一，而是理性奋斗：创造价值而非无底线内耗', source: '《及时语》评论，2026.4' },
    ],
    types: ['INFP', 'ISFP', 'ENFP', 'ENTP', 'ESTJ', 'ISTJ'],
    source: '2026 年躺平大讨论',
  },
  {
    id: 'hot-kaogong-2026',
    title: '考公考编热：稳定还是创新危机',
    heat: 2,
    summary: '2026 年国考报名再创新高、一个岗位几千人抢。当最优秀的人才都涌向体制内，谁来创新、谁来创业？',
    proPoints: [
      { text: '考公是确定性时代的最优解：稳定、体面、有保障', source: '考公群体共识' },
      { text: '35 岁危机蔓延，体制内的安全感是市场给不了的', source: '职场讨论' },
    ],
    conPoints: [
      { text: '全社会最优秀的人才涌向体制内，这是健康的信号吗', source: '《学历通胀工作难找》热文，2026' },
      { text: '年轻人求稳没错，但全社会的创新活力需要有人敢冒险', source: '创业环境讨论' },
    ],
    types: ['ISTJ', 'ESTJ', 'ISFJ', 'ESFJ', 'ENTP', 'INTP'],
    source: '2026 年考公热讨论',
  },
  {
    id: 'hot-flexible-employment',
    title: '灵活就业是自由还是裸奔',
    heat: 2,
    summary: '外卖员职业伤害认定难、网约车司机社保缺失、「自由职业不等于裸奔」成 2026 新就业形态的核心矛盾。',
    proPoints: [
      { text: '灵活就业是新经济的活力来源：时间自由、门槛低、容纳就业', source: '平台经济观点' },
      { text: '职业伤害认定难的个案不该否定整个新就业形态', source: '行业讨论' },
    ],
    conPoints: [
      { text: '灵活就业是灵活了，保障呢？收入不稳、社保自缴、没有带薪假', source: '《学历通胀工作难找》热文' },
      { text: '外卖员职业伤害认定难，就是新就业形态的裸奔现场', source: '2026 职业保障讨论' },
    ],
    types: ['ESFP', 'ESTP', 'ISFP', 'ENTP', 'ISFJ', 'ESFJ'],
    source: '2026 年新就业形态保障讨论',
  },
  {
    id: 'hot-nuclear-climate',
    title: '核能该不该成为气候方案核心',
    heat: 1,
    summary: '全球碳中和压力下，核能复兴派与「可再生能源+储能」派在 2026 气候大会持续交锋。',
    proPoints: [
      { text: '核能是可靠、零碳的基荷电源，放弃核能等于延长化石燃料依赖', source: 'debateladder.com 2026 辩题库' },
    ],
    conPoints: [
      { text: '核电部署太慢太贵，可再生能源+储能在速度与成本上完胜', source: '能源转型派观点' },
    ],
    types: ['ISTJ', 'ESTJ', 'INTJ', 'ENTJ'],
    source: '2026 气候与能源讨论',
  },
]

/**
 * 按辩题关键词匹配热门观点库（命中越多越靠前，最多 limit 条）
 */
export function findHotTopicsForTopic(topic: string, limit = 2): HotTopic[] {
  const kws = topic
    .replace(/[？?！!。，,.、：:；;「」『』]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 2)
  const scored = HOT_TOPICS.map(h => {
    let score = 0
    const hay = `${h.title}${h.summary}${h.proPoints.map(p => p.text).join('')}${h.conPoints.map(p => p.text).join('')}`
    for (const kw of kws) {
      if (hay.includes(kw)) score += 2
      if (h.title.includes(kw)) score += 1
    }
    return { h, score }
  })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.h)
  return scored.slice(0, limit)
}

/**
 * 生成「热门观点」段落（注入辩论 prompt / 本地模板）：
 * 列出与辩题最相关的高热度话题及正反观点，供辩手引用。
 */
export function buildHotTopicSection(topic: string): string {
  const hits = findHotTopicsForTopic(topic)
  if (hits.length === 0) return ''
  const body = hits
    .map(h => {
      const heatStr = '🔥'.repeat(h.heat)
      const pro = h.proPoints.map(p => `  · 正方：${p.text}（${p.source}）`).join('\n')
      const con = h.conPoints.map(p => `  · 反方：${p.text}（${p.source}）`).join('\n')
      return `${heatStr} 【${h.title}】${h.summary}\n${pro}\n${con}`
    })
    .join('\n\n')
  return `## 全网热门观点（2026 真实高热度话题，可引用须带出处）
以下是与辩题相关的高热度社会讨论。引用时标注「据 2026 年公开讨论」，且只取与你的立场相符的部分；对方引用时可用反方观点反击。
${body}`
}
