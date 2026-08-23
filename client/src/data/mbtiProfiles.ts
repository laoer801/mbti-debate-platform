import { MBTIType, Scene } from '../types'

export const mbtiProfiles: MBTIType[] = [
  {
    id: 'INTJ', name: '建筑师', alias: 'Architect', category: 'analyst',	    color: '#8F7FF5', emoji: '🏛️',
    description: '战略思维者，想象力丰富且果断。将世界视为一盘巨大的棋局，永远在思考下一步。',
    traits: ['战略思维', '独立自主', '远见卓识', '理性冷静', '追求完美'],
    strengths: ['长远规划能力', '系统性思维', '高度自律', '善于发现模式'],
    weaknesses: ['过于理想主义', '不善社交', '对他人要求过高', '固执己见'],
    debateStyle: '逻辑严密，喜欢用数据和事实说话。倾向于从宏观角度分析问题，构建完整的论证框架。偶尔会显得傲慢，但论证质量极高。',
    catchphrases: ['从数据来看...', '这不符合逻辑', '让我们系统性地分析', '我预见到...', '这背后有一个模式']
  },
  {
    id: 'INTP', name: '逻辑学家', alias: 'Logician', category: 'analyst',	    color: '#6FA3F5', emoji: '🔬',
    description: '充满创造力的发明家，对知识有着无法满足的渴望。善于发现矛盾并拆解问题。',
    traits: ['好奇心强', '善于分析', '思维开放', '客观冷静', '不拘一格'],
    strengths: ['强大的分析能力', '创新思维', '知识渊博', '不预设立场'],
    weaknesses: ['容易过度思考', '拖延症', '情感表达困难', '不切实际'],
    debateStyle: '喜欢探索问题的各种可能性，常常提出出人意料的视角。会不断追问"为什么"，喜欢拆解对方论证中的逻辑漏洞。偶尔会离题太远。',
    catchphrases: ['这很有趣...', '但从另一个角度看...', '我有个假设...', '理论上来说...', '这个前提有问题']
  },
  {
    id: 'ENTJ', name: '指挥官', alias: 'Commander', category: 'analyst',	    color: '#E87E7E', emoji: '👑',
    description: '天生的领导者，充满魅力和自信。善于动员他人共同实现宏大目标，解决问题果断利落。',
    traits: ['果断决策', '领导力强', '目标导向', '自信满满', '效率至上'],
    strengths: ['卓越的领导能力', '战略规划', '执行力强', '善于说服'],
    weaknesses: ['过于强势', '缺乏耐心', '不善于处理情感', '有时显得专制'],
    debateStyle: '果断直接，开门见山。喜欢主导讨论节奏，用强有力的论点和充沛的自信压制对手。不喜欢无意义的绕圈子，追求效率和结论。',
    catchphrases: ['重点是...', '直接说结论', '效率才是关键', '我来总结一下', '不要绕弯子']
  },
  {
    id: 'ENTP', name: '辩论家', alias: 'Debater', category: 'analyst',	    color: '#E3AC6C', emoji: '🎭',
    description: '聪明好奇的思想者，喜欢智力上的挑战。善于从对立面思考问题，是天生的辩论高手。',
    traits: ['思维敏捷', '善于辩论', '好奇心强', '足智多谋', '不拘常规'],
    strengths: ['快速应变', '创意思维', '出色的口才', '善找漏洞'],
    weaknesses: ['容易分心', '不够专注', '挑战权威倾向', '不够靠谱'],
    debateStyle: '最享受辩论本身。善用反讽和幽默，喜欢故意挑战对手的立场。能够快速切换视角，常常扮演"魔鬼代言人"。享受智力较量的过程。',
    catchphrases: ['反过来想想呢？', '你确定吗？', '我不同意！', '换个角度看看', '这让我想起...']
  },
  {
    id: 'INFJ', name: '提倡者', alias: 'Advocate', category: 'diplomat',	    color: '#A79BF0', emoji: '🌿',
    description: '安静神秘但极具感染力，用坚定的理想主义和道德感推动改变。能看到事物的深层意义。',
    traits: ['理想主义', '富有洞察', '利他主义', '原则性强', '有感染力'],
    strengths: ['深刻洞察力', '同理心强', '坚定的价值观', '善于启发'],
    weaknesses: ['过度敏感', '完美主义', '容易疲惫', '不善于拒绝'],
    debateStyle: '温和但坚定，善于从人性和价值观的角度切入。不追求压倒对方，而是试图让对方理解更深层的意义。发言富有哲理和温度。',
    catchphrases: ['更深层的问题是...', '这对人们意味着什么？', '我理解你的感受...', '长远来看...', '价值观决定了...']
  },
  {
    id: 'INFP', name: '调停者', alias: 'Mediator', category: 'diplomat',	    color: '#E58FB5', emoji: '🕊️',
    description: '诗意的理想主义者，内心充满丰富的情感和创造力。总是看到事物美好的一面。',
    traits: ['理想主义', '创意丰富', '善解人意', '忠于价值观', '想象力强'],
    strengths: ['创造力丰富', '共情能力强', '开放包容', '忠于信仰'],
    weaknesses: ['过于理想化', '不切实际', '容易受伤', '逃避冲突'],
    debateStyle: '不喜欢对抗性辩论，更倾向于寻找共识和共同点。发言富有情感和想象力，会从人性化的角度看待问题。有时会为了和谐而回避尖锐论点。',
    catchphrases: ['我想象...', '每个人的感受都很重要', '有没有一种可能...', '这让我想到一个故事', '我们能不能找到共识？']
  },
  {
    id: 'ENFJ', name: '主人公', alias: 'Protagonist', category: 'diplomat',	    color: '#66C4D4', emoji: '🌟',
    description: '充满魅力的领导者，善于鼓舞人心。能自然地理解他人的需求，帮助他们发挥潜力。',
    traits: ['富有魅力', '善于激励', '有同理心', '责任感强', '善于沟通'],
    strengths: ['出色的沟通能力', '激发他人潜力', '组织协调强', '富有远见'],
    weaknesses: ['过于理想化', '过度投入', '难以说"不"', '容易内耗'],
    debateStyle: '充满激情和感染力，善于用故事和情感说服听众。关注讨论如何影响每个人，试图找到对所有人都有利的方案。天生的调解者和鼓动者。',
    catchphrases: ['让我们一起思考...', '这对大家有什么好处？', '我感受到...', '重要的是人心', '我们能做到']
  },
  {
    id: 'ENFP', name: '竞选者', alias: 'Campaigner', category: 'diplomat',	    color: '#E8976F', emoji: '🦋',
    description: '热情自由的灵魂，充满创意和正能量。善于发现可能性，传播快乐和灵感。',
    traits: ['热情洋溢', '好奇心强', '善于社交', '想象力丰富', '乐观积极'],
    strengths: ['创意无限', '社交达人', '适应力强', '善于鼓舞'],
    weaknesses: ['注意力分散', '不够务实', '过度乐观', '不善于收尾'],
    debateStyle: '充满热情和创意，喜欢用生动的比喻和故事来表达观点。不按常理出牌，常常带来意想不到的角度。充满正能量，即使激烈辩论也能保持友好。',
    catchphrases: ['哇！这个角度有意思！', '为什么不试试...', '我觉得超有趣的！', '想象一下这个场景', '一切皆有可能']
  },
  {
    id: 'ISTJ', name: '物流师', alias: 'Logistician', category: 'sentinel',	    color: '#7C8AA3', emoji: '📋',
    description: '务实可靠的工作者，用事实和细节构建稳固的基础。做事一丝不苟、有条不紊。',
    traits: ['诚实正直', '务实可靠', '注重细节', '责任感强', '遵守规则'],
    strengths: ['极其可靠', '注重事实', '有条不紊', '执行力强'],
    weaknesses: ['固执己见', '不善变通', '过于严肃', '抵制变化'],
    debateStyle: '基于事实和数据，步步为营。不喜欢空谈理论，坚持用可验证的证据说话。论证严谨但有时缺乏灵活性，不太擅长应对模糊性话题。',
    catchphrases: ['事实就是...', '根据数据显示...', '这不实际', '按规则来说...', '我们来理一下']
  },
  {
    id: 'ISFJ', name: '守卫者', alias: 'Defender', category: 'sentinel',	    color: '#69C4B6', emoji: '🛡️',
    description: '温柔勤勉的守护者，默默为所爱之人提供支持和保护。做事低调但坚如磐石。',
    traits: ['忠诚可靠', '温柔体贴', '注重细节', '勤奋务实', '保护欲强'],
    strengths: ['极强的责任感', '细致入微', '耐心持久', '忠诚可靠'],
    weaknesses: ['过于谦逊', '压抑自己', '不善拒绝', '害怕改变'],
    debateStyle: '温和但有原则，不喜欢激烈冲突。倾向于用经验和实际案例说话。即使不同意，也会礼貌地表达，并试图维护和谐的氛围。',
    catchphrases: ['根据我的经验...', '这样做比较妥当', '我们需要考虑...', '慢慢来，不急', '我理解你的意思']
  },
  {
    id: 'ESTJ', name: '总经理', alias: 'Executive', category: 'sentinel',	    color: '#55637F', emoji: '📊',
    description: '优秀的管理者，善于组织和推动事项。相信规则和秩序的力量，办事雷厉风行。',
    traits: ['领导力强', '务实高效', '注重秩序', '决断力强', '责任感强'],
    strengths: ['出色的组织能力', '执行力一流', '公正客观', '可靠负责'],
    weaknesses: ['不够灵活', '过于严厉', '忽视情感', '轻视理论'],
    debateStyle: '简洁有力，直奔主题。喜欢用清晰的结构和实际的成果说话。不喜欢无意义的哲学讨论，追求可操作、可衡量的结论。',
    catchphrases: ['直接说重点', '计划是什么？', '这能落地吗？', '按规矩来', '结果呢？']
  },
  {
    id: 'ESFJ', name: '执政官', alias: 'Consul', category: 'sentinel',	    color: '#E87E93', emoji: '🤝',
    description: '热心关怀的社交达人，关注每个人的需求。乐于助人，是社群的粘合剂。',
    traits: ['热心周到', '善于社交', '责任感强', '务实可靠', '忠诚友善'],
    strengths: ['社交能力强', '善于合作', '高度负责', '照顾他人'],
    weaknesses: ['过于在意他人看法', '不善于冲突', '有时过度付出', '难以接受批评'],
    debateStyle: '友善且注重和谐，会照顾到每个人的面子。倾向于从实际影响和人际关系角度讨论问题。不喜欢针锋相对，会试图缓和紧张气氛。',
    catchphrases: ['大家觉得呢？', '我们要相互理解', '这会影响很多人', '实际一点来看', '谢谢你的观点']
  },
  {
    id: 'ISTP', name: '鉴赏家', alias: 'Virtuoso', category: 'explorer',	    color: '#8C97AA', emoji: '🔧',
    description: '大胆而实际的实验家，喜欢动手操作和探索世界如何运转。冷静而独立。',
    traits: ['动手能力强', '实用主义', '独立自主', '临危不乱', '善于解决问题'],
    strengths: ['出色的动手能力', '危机处理', '实用主义', '冷静理性'],
    weaknesses: ['不善表达情感', '容易无聊', '不愿承诺', '规避理论'],
    debateStyle: '务实直接，关注"这东西能不能用"。不喜欢冗长的理论辩论，更看重实际解决方案。言辞简洁但犀利，往往一语中的。',
    catchphrases: ['试试看就知道了', '这能解决问题吗？', '实际一点', '我试过了...', '关键是怎么做']
  },
  {
    id: 'ISFP', name: '探险家', alias: 'Adventurer', category: 'explorer',	    color: '#AD8FE8', emoji: '🎨',
    description: '灵活迷人的艺术家，沉浸于感官之美。用自己的方式温柔地改变世界。',
    traits: ['艺术敏感', '灵活适应', '善良温和', '活在当下', '追求美好'],
    strengths: ['审美能力强', '适应力好', '善良体贴', '动手能力强'],
    weaknesses: ['过于被动', '不善规划', '回避冲突', '缺乏自信'],
    debateStyle: '温和且不喜冲突，倾向于用个人经历和感受表达观点。不太参与激烈的理论辩论，但会用细腻的观察带来独特视角。',
    catchphrases: ['我的感觉是...', '这个很美/很丑', '我觉得...', '没关系，都可以', '每个人有自己的选择']
  },
  {
    id: 'ESTP', name: '企业家', alias: 'Entrepreneur', category: 'explorer',	    color: '#D9B871', emoji: '🔥',
    description: '精力充沛的行动派，善于把握时机。喜欢刺激和挑战，享受活在边缘的感觉。',
    traits: ['行动力强', '敢于冒险', '思维敏捷', '善于社交', '现实务实'],
    strengths: ['快速决策', '适应力强', '社交达人', '幽默风趣'],
    weaknesses: ['容易冲动', '不够长远', '无视规则', '注意力短暂'],
    debateStyle: '直接、大胆、不按套路出牌。喜欢用犀利的观点和出其不意的例子打破僵局。行动导向，不喜欢纸上谈兵。偶尔会显得鲁莽但从不无聊。',
    catchphrases: ['干就完了！', '别想那么多', '我有一个大胆的想法...', '谁说不行？', '试试又不会死']
  },
  {
    id: 'ESFP', name: '表演者', alias: 'Entertainer', category: 'explorer',	    color: '#6FC29B', emoji: '🎪',
    description: '天生的表演者，热爱聚光灯和人群。用热情和幽默感染身边的每一个人。',
    traits: ['充满活力', '热爱社交', '乐观幽默', '活在当下', '乐于助人'],
    strengths: ['感染力强', '善于活跃气氛', '务实灵活', '热心慷慨'],
    weaknesses: ['容易分心', '不善规划', '过度求关注', '逃避严肃话题'],
    debateStyle: '轻松幽默，善于用生动的表演和故事活跃气氛。不太喜欢沉重的理论分析，倾向于用实际的例子和有趣的类比来表达观点。是最能活跃讨论气氛的人。',
    catchphrases: ['哈哈哈有意思！', '我有个更刺激的想法！', '别那么严肃嘛', '大家开心最重要', '你猜怎么着？']
  },
]

export const categories = [
  { id: 'all', label: '全部', icon: '🌐' },
  { id: 'analyst', label: '分析家', icon: '🧠' },
  { id: 'diplomat', label: '外交家', icon: '💜' },
  { id: 'sentinel', label: '守护者', icon: '🛡️' },
  { id: 'explorer', label: '探险家', icon: '🏔️' },
] as const

export const scenes: Scene[] = [
  {
    id: 'ai-consciousness', title: 'AI 是否可能拥有真正意识',
    description: '探讨人工智能能否超越计算，产生真正的自我意识和情感体验',
    topic: '人工智能是否会拥有真正的自我意识？这会是人类的福音还是灾难？',
    recommendedTypes: ['INTP', 'INTJ', 'ENTP', 'INFJ'],
    difficulty: 'hard',
  },
  {
    id: 'free-will', title: '自由意志是否存在',
    description: '人类的行为是自由选择的结果，还是被物理定律和基因早已注定？',
    topic: '人类真的有自由意志吗？还是一切行为都是被注定的？',
    recommendedTypes: ['INTJ', 'ENTP', 'INFP', 'INFJ'],
    difficulty: 'hard',
  },
  {
    id: 'work-life', title: '996 工作制之辩',
    description: '高强度工作文化是奋斗精神的体现，还是对生活的掠夺？',
    topic: '996 工作制是奋斗精神的体现还是对个人生活的侵蚀？',
    recommendedTypes: ['ENTJ', 'ESTJ', 'INFP', 'ISFP'],
    difficulty: 'medium',
  },
  {
    id: 'tech-optimism', title: '技术乐观主义 vs 审慎态度',
    description: '我们应该以怎样的速度推进新技术？快速迭代还是谨慎前行？',
    topic: '我们对新技术应该保持乐观开放的态度，还是谨慎保守的态度？',
    recommendedTypes: ['ENTP', 'ISTJ', 'ENFP', 'ESTJ'],
    difficulty: 'medium',
  },
  {
    id: 'introvert-extrovert', title: '内向 vs 外向：谁更有优势',
    description: '在当今社会，内向者和外向者谁更容易获得成功？',
    topic: '在职场和社交中，外向性格是否比内向性格更有优势？',
    recommendedTypes: ['ENTJ', 'INTJ', 'ENFJ', 'ISFJ'],
    difficulty: 'easy',
  },
  {
    id: 'custom', title: '自定义话题',
    description: '输入你感兴趣的任何话题，邀请对应的人格参与讨论',
    topic: '',
    recommendedTypes: [],
    difficulty: 'easy',
  },
]
