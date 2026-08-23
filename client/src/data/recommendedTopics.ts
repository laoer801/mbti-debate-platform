/**
 * 推荐辩题库 — 供辩论室 / PK 房间 / 1v1 人格对话复用
 * 按主题分类，支持一键填充到辩题输入框
 */

export interface TopicCategory {
  id: string
  label: string
  emoji: string
  topics: string[]
}

export const recommendedTopics: TopicCategory[] = [
  {
    id: 'tech',
    label: 'AI 与科技',
    emoji: '🤖',
    topics: [
      'AI 会取代人类工作吗？🔥',
      'AI 生成内容要不要强制标注？🔥',
      '公司该不该为 AI 造成的伤害负责？🔥',
      '开源 AI 模型的风险大于收益吗？',
      'AI 辅导系统 20 年内会淘汰教师吗？',
      '元宇宙是未来还是泡沫？',
      '自动驾驶事故的责任应该由谁承担？',
      '人类应该追求意识上传永生吗？',
    ],
  },
  {
    id: 'society',
    label: '社会议题',
    emoji: '🌍',
    topics: [
      '内卷是一场合谋的骗局吗？🔥',
      '学历越高就业率越低，学历还值钱吗？🔥',
      '躺平是反抗还是陷阱？🔥',
      '年轻人该不该卷考公考编？🔥',
      '灵活就业是自由还是裸奔？🔥',
      '大城市拼搏 vs 小城安逸，哪种人生更好？',
      '高学历应该等于高收入吗？',
      '网络匿名发言应该被限制吗？',
      '流量时代，内容创作应该向流量低头吗？',
      '彩礼制度应该被废除吗？',
    ],
  },
  {
    id: 'life',
    label: '人生哲学',
    emoji: '🌱',
    topics: [
      '过程与结果，哪个更重要？',
      '选择热爱的工作还是高薪的工作？',
      '三十岁前应该结婚吗？',
      '人应该忠于理想还是向现实妥协？',
      '独处是孤独还是自由？',
      '如果有超能力让爱的人也爱你，要不要用？',
    ],
  },
  {
    id: 'campus',
    label: '校园职场',
    emoji: '🎓',
    topics: [
      '学历和实际能力，哪个更重要？',
      '年轻人应该追求稳定还是折腾？',
      '996 加班文化应该被抵制吗？',
      '下班后工作消息要不要回？',
      '成年人崩溃要不要藏起来？',
      '跳槽频繁是坏事吗？',
      '大学生应该尽早创业吗？',
    ],
  },
]

/** 展开所有推荐辩题（扁平数组，便于随机抽取） */
export function flattenTopics(): string[] {
  return recommendedTopics.flatMap(c => c.topics)
}

/** 随机抽取一个推荐辩题 */
export function randomTopic(): string {
  const all = flattenTopics()
  return all[Math.floor(Math.random() * all.length)]
}
