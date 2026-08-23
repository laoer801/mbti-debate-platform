import { MBTIQuestion } from '../types'

export const mbtiQuestions: MBTIQuestion[] = [
  // E/I dimension (3 questions)
  {
    id: 1, text: '参加完一场大型社交活动后，你通常感觉：', dimension: 'EI',
    options: [
      { text: '精力充沛，还想继续聊天', value: 'E' },
      { text: '精疲力竭，需要独处充电', value: 'I' },
    ],
  },
  {
    id: 2, text: '遇到问题时，你更倾向于：', dimension: 'EI',
    options: [
      { text: '找朋友讨论，边聊边理清思路', value: 'E' },
      { text: '自己先静下来深入思考', value: 'I' },
    ],
  },
  {
    id: 3, text: '在团队中，你通常是：', dimension: 'EI',
    options: [
      { text: '主动发言、活跃气氛的那个人', value: 'E' },
      { text: '倾听观察、深思熟虑后才开口', value: 'I' },
    ],
  },
  // S/N dimension (3 questions)
  {
    id: 4, text: '阅读一本书时，你更注重：', dimension: 'SN',
    options: [
      { text: '具体细节和实际可用的知识', value: 'S' },
      { text: '整体框架和隐藏的深层含义', value: 'N' },
    ],
  },
  {
    id: 5, text: '做决策时，你更信任：', dimension: 'SN',
    options: [
      { text: '过往经验和已验证的事实', value: 'S' },
      { text: '直觉和未来可能性的预感', value: 'N' },
    ],
  },
  {
    id: 6, text: '你更喜欢的工作方式是：', dimension: 'SN',
    options: [
      { text: '按照既定流程，一步步稳定推进', value: 'S' },
      { text: '探索新方法，尝试不同的可能性', value: 'N' },
    ],
  },
  // T/F dimension (3 questions)
  {
    id: 7, text: '朋友向你倾诉烦恼时，你通常会：', dimension: 'TF',
    options: [
      { text: '分析问题根源，给出解决方案', value: 'T' },
      { text: '先共情安慰，让对方感受到被理解', value: 'F' },
    ],
  },
  {
    id: 8, text: '在争论中，你更看重：', dimension: 'TF',
    options: [
      { text: '逻辑一致性和事实的准确性', value: 'T' },
      { text: '维护和谐关系和每个人的感受', value: 'F' },
    ],
  },
  {
    id: 9, text: '做重要决定时，你的判断标准是：', dimension: 'TF',
    options: [
      { text: '客观利弊分析，什么是最合理的', value: 'T' },
      { text: '个人价值观，什么是对的/有意义的', value: 'F' },
    ],
  },
  // J/P dimension (3 questions)
  {
    id: 10, text: '面对截止日期临近的任务，你通常：', dimension: 'JP',
    options: [
      { text: '已提前规划好，按计划稳步完成', value: 'J' },
      { text: '在最后关头爆发冲刺，灵活应变', value: 'P' },
    ],
  },
  {
    id: 11, text: '周末计划被突然打乱时，你的反应是：', dimension: 'JP',
    options: [
      { text: '感到不安，尽快重新制定计划', value: 'J' },
      { text: '无所谓，随机应变反而更有趣', value: 'P' },
    ],
  },
  {
    id: 12, text: '对于未来的生活，你更倾向于：', dimension: 'JP',
    options: [
      { text: '有清晰的路线图和阶段性目标', value: 'J' },
      { text: '保持开放性，拥抱各种可能性', value: 'P' },
    ],
  },
]

export const mbtiDimensions: Record<string, { label: string; a: string; b: string }> = {
  EI: { label: '精力来源', a: '外向 Extraversion', b: '内向 Introversion' },
  SN: { label: '信息获取', a: '实感 Sensing', b: '直觉 Intuition' },
  TF: { label: '决策方式', a: '思考 Thinking', b: '情感 Feeling' },
  JP: { label: '生活方式', a: '判断 Judging', b: '感知 Perceiving' },
}
