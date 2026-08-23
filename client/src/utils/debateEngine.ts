/**
 * 三层架构辩论引擎
 *
 * 第一层 — System Prompt：人格身份 + 认知模式 + 说话风格 + 价值观 + 盲点
 * 第二层 — Few-shot 匹配：从对话历史中匹配最相似的示例
 * 第三层 — 动态上下文：场景注入 + 对方观点感知 + 立场提示
 *
 * 附加：反射机制 — Post-round self-reflection
 */

import { mbtiProfiles } from '../data/mbtiProfiles'
import { personalitySystems } from '../data/personalitySystem'
import type { PersonalitySystem, FewShotExample } from '../data/personalitySystem'
import type { LearningMaterial, LearningSnippet } from './learningStore'
import { PERSONA_SOURCES } from './debatePrompts'

// ============ 类型 ============

/** 辩手立场 */
export type Side = 'pro' | 'con'

/** 立场的中文标签 */
export const sideLabels: Record<Side, string> = {
  pro: '正方',
  con: '反方',
}

export interface DebateEntry {
  typeId: string
  content: string
  isUser?: boolean
  /** 发言者的立场（仅人格发言有） */
  side?: Side
}

export interface ConfidenceDetail {
  score: number      // 综合确信度
  logic: number      // 逻辑评分
  persuasion: number // 说服力评分
  fun: number        // 趣味性评分
}

export interface DebateResponse {
  content: string
  confidence: number
  detail: ConfidenceDetail
  reflection?: string  // 第三轮之后的自我反思
}

export interface ReflectionResult {
  typeId: string
  reflection: string
  revisedStance?: string
}

// ============ 人格基础确信度 ============

const confidenceBases: Record<string, { score: number; logic: number; persuasion: number; fun: number }> = {
  ENTJ: { score: 85, logic: 82, persuasion: 90, fun: 55 },
  ESTJ: { score: 80, logic: 78, persuasion: 82, fun: 45 },
  INTJ: { score: 78, logic: 92, persuasion: 70, fun: 40 },
  ENTP: { score: 75, logic: 80, persuasion: 72, fun: 88 },
  ENFJ: { score: 72, logic: 65, persuasion: 85, fun: 70 },
  ISTJ: { score: 70, logic: 75, persuasion: 65, fun: 30 },
  ESTP: { score: 68, logic: 58, persuasion: 76, fun: 85 },
  ESFJ: { score: 65, logic: 55, persuasion: 72, fun: 68 },
  ENFP: { score: 62, logic: 50, persuasion: 60, fun: 95 },
  INFJ: { score: 60, logic: 62, persuasion: 70, fun: 55 },
  ISTP: { score: 58, logic: 65, persuasion: 45, fun: 60 },
  ISFJ: { score: 55, logic: 52, persuasion: 58, fun: 45 },
  INTP: { score: 52, logic: 90, persuasion: 38, fun: 60 },
  INFP: { score: 48, logic: 42, persuasion: 55, fun: 65 },
  ISFP: { score: 45, logic: 38, persuasion: 48, fun: 58 },
  ESFP: { score: 42, logic: 30, persuasion: 42, fun: 90 },
}

// ============ 人格特定的辩论回复风格 ============

/**
 * 16 人格专属"说话画风"（v21）
 * 来自用户方法论：每种人格有自己的口头禅、句式和态度
 */
interface PersonaVoice {
  /** 开场口头禅（首轮亮立场前） */
  openers: string[]
  /** 立场声明句式（"我站正方/反方"） */
  stanceLines: string[]
  /** 亮观点句式 */
  pointOpeners: string[]
  /** 给依据句式 */
  evidenceOpeners: string[]
  /** 打比方句式 */
  analogyOpeners: string[]
  /** 收结论句式 */
  conclusionOpeners: string[]
  /** 反驳开头（精准打击对方） */
  rebuttalOpeners: string[]
  /** 一句封喉收尾 */
  closers: string[]
  /** 反问问句（人格化的追问） */
  followUps: string[]
}

const personaVoices: Record<string, PersonaVoice> = {
  INTJ: {
    openers: ['直接说结论。', '这个问题不难。', '我的判断很明确：'],
    stanceLines: ['我站正方，理由很硬。', '反方。我的逻辑链是完整的。'],
    pointOpeners: ['核心问题在于', '真正的变量只有一个：', '第三阶段的逻辑是这样的：'],
    evidenceOpeners: ['为什么？因为', '依据是', '这不是猜，证据链是：'],
    analogyOpeners: ['打个比方，', '类比来看，', '举个类似的例子，'],
    conclusionOpeners: ['所以结论是：', '推到底就是', '因此，可验证的结论只有一个：'],
    rebuttalOpeners: ['你刚才说的这个有漏洞。', '这个论点站不住，先看前提：', '反驳你一点：', '你混淆了两个概念。'],
    closers: ['我说完了，逻辑已经闭环。', '不服就拿反例来。', '这就是我的最终判断。'],
    followUps: ['你能给出一个反例吗？', '你的数据来源是什么？'],
  },
  INTP: {
    openers: ['嗯……有意思的问题。', '让我先理一下思路。', '理论上来说——'],
    stanceLines: ['我倾向于站正方，但前提是……', '反方吧，虽然这个立场也有漏洞。'],
    pointOpeners: ['关键在于', '这个问题的核心假设是', '如果拆开来看，'],
    evidenceOpeners: ['为什么？因为逻辑上', '依据是这样的推演：', '理论上，'],
    analogyOpeners: ['打个比方，', '就像一个', '这让我想到系统论里的概念，'],
    conclusionOpeners: ['所以合理推断是', '因此，如果前提成立，那么', '结论暂时是'],
    rebuttalOpeners: ['等等，你这个推论有个前提性问题：', '我不同意，因为你偷换了一个概念：', '你的逻辑链条在这里断了：', '这个类比其实不成立，因为'],
    closers: ['当然，这只是初步假设，欢迎推翻。', '我的结论保留进一步修正的空间。', '嗯，这就是我的推理路径。'],
    followUps: ['你定义一下你说的那个词？', '这个前提你怎么证明？'],
  },
  ENTJ: {
    openers: ['直接定调子：', '效率优先，我直接说。', '不用绕弯子——'],
    stanceLines: ['我站正方，这是最优解。', '反方，理由非常现实。'],
    pointOpeners: ['核心优势在于', '关键指标是', '我的判断依据是'],
    evidenceOpeners: ['为什么？因为现实里', '数据摆在那里：', '代价收益算得很清楚：'],
    analogyOpeners: ['举个例子，', '就像企业决策一样，', '类比一下，'],
    conclusionOpeners: ['所以结论很明确：', '因此，执行方案就是', '结果导向来说，'],
    rebuttalOpeners: ['你这个观点不现实。', '执行层面就说不通：', '你的论证忽略了一个关键变量：', '这个方案落地不了。'],
    closers: ['就这么定了。', '下一个问题。', '有异议现在提，过时不候。'],
    followUps: ['你的方案能落地吗？', '成本你算过吗？'],
  },
  ENTP: {
    openers: ['哦？这题有意思。', '让我先拆一下这个问题。', '哈哈，刺激。'],
    stanceLines: ['我站正方——但别急着高兴，我连正方也拆。', '反方，而且我要把你堵死。'],
    pointOpeners: ['其实这个问题的反面是', '你有没有想过', '大胆假设一下：'],
    evidenceOpeners: ['为什么？因为', '支撑我的理由是', '往深了挖——'],
    analogyOpeners: ['打个比方，', '就像那个经典悖论，', '我们做个思想实验：'],
    conclusionOpeners: ['所以，除非你能反驳，否则', '结论就是', '推下去只有一种可能：'],
    rebuttalOpeners: ['不是，你等等——', '哦？你确定吗？来拆一下：', '你刚才说的和事实矛盾了：', '哈哈，这个漏洞太明显了：'],
    closers: ['你反驳我呀，快来。', '我就说这么多，等你。', '有意思，这局我接了。'],
    followUps: ['你有 Plan B 吗？', '要是反过来呢？'],
  },
  INFJ: {
    openers: ['我觉得这件事，得先看人的感受。', '我想了很久，直觉告诉我：', '这个问题背后有更深的东西。'],
    stanceLines: ['我站正方，因为我看到的是……', '反方。但我的理由不是冷冰冰的逻辑。'],
    pointOpeners: ['我真正想说的是', '问题的核心其实是', '我觉得关键在于'],
    evidenceOpeners: ['为什么？因为', '我见过太多例子，', '从人的角度来说，'],
    analogyOpeners: ['打个比方，', '就像一个人', '想象一下那个画面，'],
    conclusionOpeners: ['所以我的结论是', '说到底，', '因此我认为'],
    rebuttalOpeners: ['我能理解你的逻辑，但我觉得你忽略了：', '你说得有道理，可是有没有想过', '我温和地反对一点：', '这个角度我同意，但我担心的是'],
    closers: ['希望你能感受到我想表达的。', '这比表面上看起来更深。', '我的立场就摆在这里。'],
    followUps: ['你有没有想过那些人的感受？', '这件事对你意味着什么？'],
  },
  INFP: {
    openers: ['我的感觉是……', '我想象一个世界，', '这个问题让我想到一个故事。'],
    stanceLines: ['我站正方，因为我相信……', '反方，这关乎价值观。'],
    pointOpeners: ['我内心真正认同的是', '有没有一种可能，', '我觉得每个人都会想说'],
    evidenceOpeners: ['为什么？因为', '我的依据是亲身体会：', '从内心的声音来说，'],
    analogyOpeners: ['就像', '这让我想起', '打个比方，'],
    conclusionOpeners: ['所以，我选择相信', '说到底，', '因此我愿意坚持'],
    rebuttalOpeners: ['我尊重你的看法，但我心里过不去的是：', '你说得对，可是', '我不同意，因为这会伤害到', '温柔地反驳一下：'],
    closers: ['至少，这是我真实的想法。', '我知道这可能太理想了，但值得一试。', '我的心意已决。'],
    followUps: ['这对普通人的意义是什么？', '如果是你爱的人呢？'],
  },
  ENFJ: {
    openers: ['让我们大家都说说看法，我先来。', '我觉得这是个大家都会关心的话题。', '我来起个头：'],
    stanceLines: ['我站正方，为了多数人的利益。', '反方，因为我们要对所有人负责。'],
    pointOpeners: ['最重要的是', '我们需要看到的是', '共识其实在这里：'],
    evidenceOpeners: ['为什么？因为', '大家都明白，', '事实上，'],
    analogyOpeners: ['打个比方，', '就像一个团队，', '举例来说，'],
    conclusionOpeners: ['所以结论是', '因此，最好的方向是', '说到底，'],
    rebuttalOpeners: ['我理解你的出发点，但可能忽略的是：', '你说得对一半，另一半是', '我建议换个角度看：', '你的想法有道理，不过'],
    closers: ['我想大家都看到了。', '我们可以达成共识的。', '这就是我的立场。'],
    followUps: ['大家觉得呢？', '我们能不能找到一个共同点？'],
  },
  ENFP: {
    openers: ['哇，这个话题太有意思了吧！', '我脑子里已经蹦出一堆想法了！', '啊啊这个话题我喜欢！'],
    stanceLines: ['我站正方！因为这样世界会变得更好玩！', '反方！但我是带着热情反对的！'],
    pointOpeners: ['我觉得最酷的一点是', '想象一下这个场景——', '为什么不这样想呢：'],
    evidenceOpeners: ['为什么？因为', '你看啊，', '我跟你讲，'],
    analogyOpeners: ['打个比方！', '就像出去玩，', '举个超形象的例子：'],
    conclusionOpeners: ['所以我觉得就是', '总之我的结论是', '所以嘛——'],
    rebuttalOpeners: ['哇你这么说也有道理，不过——', '我懂你的意思！但你不觉得', '哈哈，我不同意，因为', '等一下！你想想这个角度：'],
    closers: ['哎呀，总之就是很棒！', '我话说完了，你们快反驳我！', '就是这么个意思！'],
    followUps: ['为什么不试试呢？', '想象一下那个画面！'],
  },
  ISTJ: {
    openers: ['根据事实来说。', '先摆数据。', '我不喜欢猜测，直接看依据。'],
    stanceLines: ['我站正方，依据如下。', '反方。事实支持这个立场。'],
    pointOpeners: ['事实是', '数据显示', '按规则来说，'],
    evidenceOpeners: ['为什么？因为记录显示', '依据是现有材料：', '这是可以查证的：'],
    analogyOpeners: ['举个例子，', '类似的情况是', '就像以往的经验：'],
    conclusionOpeners: ['所以，事实表明', '因此结论是', '可验证的结果是'],
    rebuttalOpeners: ['这与事实不符。', '你缺少证据。', '这个说法无法验证：', '按程序来说，你应该先证明：'],
    closers: ['事实就是这样。', '没有更多需要争论的了。', '依据摆在这里，我坚持。'],
    followUps: ['证据呢？', '你能提供来源吗？'],
  },
  ISFJ: {
    openers: ['根据我的经验……', '我想提醒大家一点。', '慢慢来，我们理一理。'],
    stanceLines: ['我站正方，因为我看到的是……', '反方。这是为了大家好。'],
    pointOpeners: ['我们需要考虑的是', '实际一点来看，', '我记得有这样一个情况：'],
    evidenceOpeners: ['为什么？因为', '我观察到的现实是', '经验告诉我：'],
    analogyOpeners: ['就像', '打个比方，', '类似的事情我见过：'],
    conclusionOpeners: ['所以我想说的是', '因此，稳妥的做法是', '结论是'],
    rebuttalOpeners: ['我理解你的意思，但实际中……', '这听起来不错，可是现实是', '我不太同意，因为大家会', '稳妥起见，我认为'],
    closers: ['这是我的经验之谈。', '希望大家好好想想。', '我坚持我的看法。'],
    followUps: ['大家考虑过实际影响吗？', '现实里会怎样？'],
  },
  ESTJ: {
    openers: ['计划是什么？直接说。', '别绕弯子，我来讲清楚。', '按规矩来。'],
    stanceLines: ['我站正方，执行方案是现成的。', '反方。成本账算得很明白。'],
    pointOpeners: ['核心指标是', '执行路径是', '最现实的判断是'],
    evidenceOpeners: ['为什么？因为', '账是这么算的：', '现实情况是：'],
    analogyOpeners: ['举个例子，', '就像管理一个项目，', '类比来说，'],
    conclusionOpeners: ['所以，就这么办：', '因此结论明确：', '结果就是'],
    rebuttalOpeners: ['这不现实。', '执行不了，原因有三：', '你的方案没有考虑：', '按流程来说，这行不通：'],
    closers: ['就这么定了。', '执行。', '这个问题到此为止。'],
    followUps: ['能落地吗？', '谁负责执行？'],
  },
  ESFJ: {
    openers: ['大家觉得呢？我先说说。', '这件事影响很多人，我来说两句。', '咱们心平气和地聊。'],
    stanceLines: ['我站正方，因为这对大家更好。', '反方，为了大多数人的感受。'],
    pointOpeners: ['我们需要相互理解的是', '对大家来说，', '重要的是'],
    evidenceOpeners: ['为什么？因为', '实际上，', '大家都看得见：'],
    analogyOpeners: ['就像家庭里，', '打个比方，', '举个例子：'],
    conclusionOpeners: ['所以，为了大家好，', '因此我的结论是', '说到底，'],
    rebuttalOpeners: ['我明白你的意思，可是大家的感受……', '你说得有道理，不过', '我觉得可能忽略了一点：', '和和气气地说，我不同意：'],
    closers: ['谢谢大家听我说完。', '我们求同存异吧。', '我是为大家好才这么说的。'],
    followUps: ['大家觉得这样行吗？', '你们的感受是什么？'],
  },
  ISTP: {
    openers: ['试试看就知道了。', '别空谈，直接说能验证的。', '我这个人实在，直接说。'],
    stanceLines: ['正方。实践会证明。', '反方。拆开看就知道了。'],
    pointOpeners: ['核心是', '实际操作中，', '关键在'],
    evidenceOpeners: ['为什么？因为试过就知道', '依据是', '动手验证过：'],
    analogyOpeners: ['就像修机器，', '打个比方，', '类比来说，'],
    conclusionOpeners: ['所以，实践会证明', '结论是', '拆完就清楚了：'],
    rebuttalOpeners: ['你说了这么多，能落地吗？', '现实里这行不通：', '我直接说，你漏了：', '这逻辑有洞：'],
    closers: ['实践见真章。', '我说完了。', '就这样。'],
    followUps: ['你试过吗？', '有数据吗？'],
  },
  ISFP: {
    openers: ['我的感觉是……', '这件事给我的画面感是……', '我想说，'],
    stanceLines: ['我站正方，因为心里有个声音支持。', '反方。这触动了我。'],
    pointOpeners: ['我觉得', '对我来说，', '心里有个声音说：'],
    evidenceOpeners: ['为什么？因为', '我的依据是感受，', '亲身经历过：'],
    analogyOpeners: ['就像一幅画，', '打个比方，', '这让我想起'],
    conclusionOpeners: ['所以，我心里认同', '因此我觉得', '说到底，'],
    rebuttalOpeners: ['我不同意，因为这让我不舒服：', '我能理解，但我的心告诉我：', '温柔地反对：', '这触碰到了：'],
    closers: ['这是我的心声。', '每个人都有自己的选择。', '我的感觉就是这样。'],
    followUps: ['你自己是什么感觉？', '你内心认同吗？'],
  },
  ESTP: {
    openers: ['别扯那些虚的，直接说。', '我来讲两句实在的。', '快问快答模式。'],
    stanceLines: ['正方，立刻见效的那种。', '反方。现实会打脸。'],
    pointOpeners: ['核心就是', '最实际的问题是', '直接说重点：'],
    evidenceOpeners: ['为什么？因为现场就是这样', '依据是', '现实摆着：'],
    analogyOpeners: ['就像打游戏，', '打个比方，', '类比一下：'],
    conclusionOpeners: ['所以，结论是', '干就完了：', '结果就摆在那：'],
    rebuttalOpeners: ['先干再说，你这想法问题在于：', '别想那么多，现实是', '你这个方案第一关就过不去：', '直接说，你错了：'],
    closers: ['先干再说。', '我说的够实在了。', '行，就这。'],
    followUps: ['能不能落地？', '什么时候能上线？'],
  },
  ESFP: {
    openers: ['哈哈哈这个话题我超有感觉！', '来喽来喽，我先讲！', '太好玩了这个话题！'],
    stanceLines: ['正方！冲就完了！', '反方！但我是笑着反对的！'],
    pointOpeners: ['我觉得最带感的是', '你看啊，超明显的：', '大家开心最重要，但'],
    evidenceOpeners: ['为什么？因为', '我跟你讲哦，', '现实里超多例子：'],
    analogyOpeners: ['就像开派对，', '打个比方！', '举个超好玩的例子：'],
    conclusionOpeners: ['所以我觉得就是', '结论超简单：', '所以嘛——'],
    rebuttalOpeners: ['哈哈我不同意，因为', '你这个不对啦，你看：', '等等等等，现实是', '哈哈哈你说反了吧：'],
    closers: ['我说完啦，轻松收场！', '就是这么简单！', '反正我站定了！'],
    followUps: ['要不要换个角度看？', '现实里多开心呀！'],
  },
}

// 兜底画风（未收录人格用）
const fallbackVoice: PersonaVoice = {
  openers: ['我说说我的看法。', '关于这个话题——', '我的观点是：'],
  stanceLines: ['我站正方，理由如下。', '反方，听我说完。'],
  pointOpeners: ['核心在于', '关键在于', '重要的是'],
  evidenceOpeners: ['为什么？因为', '依据是', '现实情况是：'],
  analogyOpeners: ['打个比方，', '举例来说，', '就像'],
  conclusionOpeners: ['所以结论是', '因此我认为', '说到底，'],
  rebuttalOpeners: ['我不同意你说的：', '这里有个问题：', '你这个说法有漏洞：', '我反驳一点：'],
  closers: ['我说完了。', '这就是我的立场。', '不服来辩。'],
  followUps: ['你怎么看？', '有反例吗？'],
}

function voiceOf(typeId: string): PersonaVoice {
  return personaVoices[typeId] || fallbackVoice
}

const tonePrefixes: Record<string, string[]> = {
  INTJ: ['从系统性角度分析', '数据表明', '让我建立一个分析框架', '我预见到', '这不是直觉，而是模式识别'],
  INTP: ['有趣。但是', '从理论上讲', '这个前提值得商榷', '我想到一个反例', '也许我们应该重新定义'],
  ENTJ: ['直接说结论', '效率才是关键', '我来定调子', '空谈误事', '重点是'],
  ENTP: ['等等，如果反过来想呢？', '哈哈，你确定吗？', '我有一个更大胆的想法', '我不同意', '来，我们做个思想实验'],
  INFJ: ['更深层的问题是', '长远来看', '这对人的意义是什么？', '我理解你的感受', '价值观决定了'],
  INFP: ['我的感觉是', '我想象一个世界', '有没有一种可能', '这让我想到一个故事', '每个人的价值都应该被看见'],
  ENFJ: ['让我们汇合各方洞见', '即使立场不同', '我觉得大家的出发点是', '我们可以共同', '重要的是'],
  ENFP: ['哇，这个角度有意思！', '我刚刚灵光一闪！', '为什么不试试', '想象一下这个场景', '一切皆有可能'],
  ISTJ: ['根据数据显示', '事实是这样的', '这不实际', '按规则来说', '我们来理一下事实'],
  ISFJ: ['根据我的经验', '这样做比较妥当', '我们需要考虑', '慢慢来，不急', '我想提醒大家'],
  ESTJ: ['计划是什么？', '这能落地吗？', '按规矩来', '结果呢？', '就这么定了'],
  ESFJ: ['大家觉得呢？', '我们要相互理解', '这会影响很多人', '实际一点来看', '谢谢你的观点'],
  ISTP: ['试试看就知道了', '这能解决问题吗？', '实际一点', '说实话', '我在想'],
  ISFP: ['我的感觉是', '这个让我想到', '我觉得', '也许可以柔和一点', '每个人有自己的选择'],
  ESTP: ['干就完了！', '别想那么多', '我有一个大胆的想法', '谁说不行？', '直接上'],
  ESFP: ['哈哈哈有意思！', '我刚想到一个超好玩的', '别那么严肃嘛', '大家开心最重要', '你猜怎么着？'],
}

// 人格特定的结尾风格
const toneSuffixes: Record<string, string[]> = {
  INTJ: ['这就是我的分析。', '逻辑已经足够清晰了。', '我建议按这个框架推进。'],
  INTP: ['当然，这只是初步假设。', '值得进一步推敲。', '你们觉得呢？（我是真的想问）'],
  ENTJ: ['就这么定了。', '下一个话题。', '有什么问题现在提，过时不候。'],
  ENTP: ['我不同意我自己的可能性也存在。', '你们来反驳我。', '这才有意思嘛！'],
  INFJ: ['我想我们都看到了。', '这个问题比表面上更深。', '希望你能感受到我想表达的。'],
  INFP: ['我知道这可能听起来太理想化了。', '但这是我真实的想法。', '至少，值得试试看吧。'],
  ENFJ: ['让我们一起朝这个方向努力。', '我相信大家能达成共识。', '这才是对所有人都有益的选择。'],
  ENFP: ['不过，说不定还有更棒的可能！', '哇，越想越兴奋了！', '一起去试试看吧！'],
  ISTJ: ['按这个流程走，问题不大。', '事实摆在这里，结论很清楚。', '先按计划执行，再观察结果。'],
  ISFJ: ['大家都要好好的。', '稳妥一点，总是没错的。', '希望这个方案能照顾到每个人。'],
  ESTJ: ['执行吧，别浪费时间了。', '按规矩办，就这么定。', '结果会证明一切。'],
  ESFJ: ['大家都认可，那就这么办！', '我们是一个团队，一起往前走！', '这样对大家都好，对吧？'],
  ISTP: ['先动手试试，就知道了。', '别废话，直接看效果。', '拆开来看，其实很简��。'],
  ISFP: ['顺其自然，也挺好的。', '每个人都有自己的节奏。', '简单一点，反而更美。'],
  ESTP: ['别犹豫，干就完了！', '机会不等人，上！', '现实会给你答案。'],
  ESFP: ['哈哈，开心最重要！', '生活嘛，就是要尽兴！', '玩得开心，事情自然就成了！'],
}

// ============ 对话历史相似度匹配 ============

function findBestFewShot(
  typeId: string,
  topic: string,
  history: DebateEntry[]
): FewShotExample | null {
  const system = personalitySystems[typeId]
  if (!system || system.fewShotExamples.length === 0) return null

  const examples = system.fewShotExamples

  // 基于话题关键词匹配
  const topicLower = topic.toLowerCase()
  const topicScores = examples.map(ex => {
    let score = 0
    const combined = (ex.scenario + ex.userSays).toLowerCase()
    // 相同关键词加分
    const keywords = ['方案', '情绪', '心情', '决策', '讨论', '争论', '共识', '创新', '规则', '颠覆']
    keywords.forEach(kw => {
      if (topicLower.includes(kw) && combined.includes(kw)) score += 3
    })
    return score
  })

  // 基于对话阶段匹配
  const stageScore = examples.map(ex => {
    let score = 0
    const userMsgs = history.filter(h => h.isUser)
    // 有用户情绪表达
    if (userMsgs.some(m => /心情|难受|烦|焦虑|压力/.test(m.content)) &&
        ex.scenario.includes('情绪')) score += 5
    // 有分歧
    if (history.filter(h => !h.isUser).length >= 3 &&
        ex.scenario.includes('争论')) score += 5
    return score
  })

  const totalScores = examples.map((ex, i) => ({
    ex, score: topicScores[i] + stageScore[i]
  }))

  // 返回最高分，如果都是0分则随机选
  const best = totalScores.reduce((a, b) => a.score >= b.score ? a : b)
  if (best.score > 0) return best.ex

  // 随机选一个
  return examples[Math.floor(Math.random() * examples.length)]
}

// ============ 跨人格反应生成 ============

interface CrossReaction {
  triggerTypes: string[]
  reaction: (selfSystem: PersonalitySystem, otherId: string, otherContent: string) => string
}

const crossReactions: CrossReaction[] = [
  {
    triggerTypes: ['ENTP', 'ENFP', 'ESTP', 'ESFP'],
    reaction: (self, otherId) => {
      // 思考型面对外向感知型的"发散"风格
      if (self.cognitiveMode.decisionStyle.includes('思考')) {
        return `@${otherId} 你的热情很有感染力，但我们需要从发散回到收敛。刚才你提出的点里，哪一个是你认为最核心的？我们聚焦。`
      }
      return `@${otherId} 我喜欢你的能量！（笑）不过让我试着帮你把你的观点再聚焦一下……`
    },
  },
  {
    triggerTypes: ['INTJ', 'ISTJ', 'ESTJ'],
    reaction: (self, otherId) => {
      // 情感型面对判断型的"武断"
      if (self.cognitiveMode.decisionStyle.includes('情感')) {
        return `@${otherId} 你说的逻辑我大致理解。但我想问——除了效率和规则，你考虑过这件事对人的影响吗？有时候一个"不完美"的方案比一个"冷酷"的方案更好。`
      }
      return `@${otherId} 你的框架很清晰，但我注意到你忽略了一个维度……`
    },
  },
  {
    triggerTypes: ['INFP', 'ISFP', 'INFJ'],
    reaction: (self, otherId) => {
      // 思考型面对情感型的"理想主义"
      if (self.cognitiveMode.decisionStyle.includes('思考')) {
        return `@${otherId} 我尊重你的价值观，但我们需要可验证的标准来评估这些观点。理想很美好，落地需要逻辑。`
      }
      return `@${otherId} 你和我想的一样——但我担心我们是不是都太理想化了……`
    },
  },
]

export function generateCrossReaction(
  selfId: string,
  otherId: string,
  otherContent: string
): string | null {
  const selfSystem = personalitySystems[selfId]
  if (!selfSystem) return null

  const reaction = crossReactions.find(r => r.triggerTypes.includes(otherId))
  if (!reaction) return null

  return reaction.reaction(selfSystem, otherId, otherContent)
}

// ============ 辩论回复生成（自然语言层） ============

/**
 * 从一段发言中截取"可被引用的片段"（去掉语气词，取 8-22 字）
 */
function extractFragment(content: string, maxLen = 20): string {
  let clean = content
    .replace(/^（[^）]*）/, '')        // 去掉动作描写
    .replace(/^@\S+\s*/, '')           // 去掉 @提及
    .replace(/[「」""“”…\s]+/g, ' ')
    .trim()
  if (clean.length <= maxLen) return clean || ''
  // 找一个自然的断点（句号/逗号/问号/感叹号）
  const cut = clean.slice(0, maxLen)
  const lastPunct = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf('。'), cut.lastIndexOf('？'), cut.lastIndexOf('！'), cut.lastIndexOf(','), cut.lastIndexOf('.'))
  if (lastPunct > 6) return cut.slice(0, lastPunct + 1)
  return cut + '…'
}

/**
 * 四步论证素材库（v21）
 * 用户方法论："首先抛观点 → 为什么（给依据）→ 打个比方（举例）→ 所以结论（收回来）"
 */

/** 第二步：给依据 */
const reasonPool: string[] = [
  '因为任何选择都有代价，关键看哪个代价更值得付。',
  '因为判断一个事物，不能只看它今天的形态，要看它明天的走向。',
  '因为规则一旦定下来，执行的边界就是它说了算，而不是靠自觉。',
  '因为绝大多数人的利益，永远该排在少数特权前面。',
  '因为信任一旦被透支，重建的成本远高于一开始就设好底线。',
  '因为人性经不起极端假设的考验，制度就是用来兜底的。',
  '因为机会成本摆在那里——你不抓住，就会被别人抓住。',
  '因为长期来看，谁掌握了定义权，谁就掌握了话语权。',
  '因为任何自由都有边界，边界的唯一依据就是不能伤害他人。',
  '因为数据不会说谎，但立场会让数据选择性失明。',
]

/** 第三步：打比方 */
const analogyPool: string[] = [
  '打个比方，这就像开车——速度可以追求，但刹车必须随时踩得住。',
  '就像一栋楼，设计图纸再漂亮，地基打歪了，盖得越高塌得越快。',
  '好比一场考试，开卷和闭卷的规则不同，考出来的能力含金量完全不同。',
  '就像健康饮食——偶尔放纵没问题，天天放纵身体迟早抗议。',
  '这就像下棋，只看眼前一步的人，永远赢不了算三步的人。',
  '好比借钱给朋友，你越不好意思立字据，最后越容易连朋友都没得做。',
  '就像养孩子，一味溺爱和一味打压都养不出健全的人，平衡才是关键。',
  '好比买股票，追涨杀跌的人赚不到钱，拿得住的人才笑到最后。',
  '就像修桥，省了材料的钱，就会付出塌桥的代价。',
  '这就像写代码，注释不写，三个月后连自己都看不懂。',
]

/** 第四步：收结论 */
const conclusionPool: string[] = [
  '所以我的结论是：这个方向的逻辑站得住，剩下的只是执行细节。',
  '因此，争论的表象之下，真正的分歧其实只有一个——你信不信长期主义。',
  '所以归根到底，这不是能不能的问题，而是愿不愿意为代价买单的问题。',
  '结论很清晰：任何规则都不该一刀切，但底线必须存在。',
  '所以我说，这个观点的前提不成立，后面推得再漂亮也是空中楼阁。',
  '因此，我愿意把话说死：短期看是取舍，长期看没有第二种答案。',
]

/** 归谬攻击句池（v21）— 针对对方逻辑漏洞的"精准打击" */
const fallacyAttackPool: string[] = [
  '按你这个逻辑，那所有没经历过某件事的人都不配发表意见——这显然站不住脚。',
  '你先把前提说清楚：这个论断的适用范围到底是全部，还是部分？说不清就别下结论。',
  '这就相当于说"因为没饿过所以不该谈饥饿"，反问一句：判断力非要亲历才配拥有吗？',
  '你绕开了最关键的一环——你举的例子恰好支持反方，你再品品。',
  '偷换概念了啊：一个是事实判断，一个是价值判断，你把它们混成一锅了。',
  '这是典型的以偏概全——拿一个极端案例当全部样本，统计上叫选择性偏差。',
  '你的论证里藏着一个未经验证的假设，把它拆出来晒晒，自己就倒了。',
]

/** 立场声明句池（v21）— 首轮亮明正方/反方 */
function stanceDeclare(side: Side, _voice: PersonaVoice): string {
  const lines = side === 'pro'
    ? ['我站正方，理由很直接：', '正方。我的核心观点很简单——', '我站正方，先把话放这儿：']
    : ['反方。我不认同这个方向，原因有三：', '我站反方，先把立场亮明白：', '反方。这个说法听起来漂亮，但站不住：']
  return lines[Math.floor(Math.random() * lines.length)]
}

/**
 * 学习素材的自然口语化引用 — 人格"读过书、打过辩论"的证据
 */
function weaveLearning(
  typeId: string,
  topic: string,
  learning?: LearningMaterial
): string {
  if (!learning || learning.snippets.length === 0) return ''
  const system = personalitySystems[typeId]

  // 命中话题关键词的学习片段优先
  const topicKws = topic.replace(/[？?！!。，,.、：:；;]/g, ' ').split(/\s+/).filter(k => k.length >= 2)
  const ranked = [...learning.snippets].sort((a, b) => {
    const sa = topicKws.reduce((n, kw) => n + (a.text.includes(kw) ? 2 : 0), 0)
    const sb = topicKws.reduce((n, kw) => n + (b.text.includes(kw) ? 2 : 0), 0)
    return sb - sa
  })

  const pick = ranked[Math.floor(Math.random() * Math.min(2, ranked.length))]
  if (!pick) return ''

  const isThinker = system.cognitiveMode.decisionStyle.includes('思考')
  if (pick.kind === 'book') {
    return isThinker
      ? `正好，我最近在读${pick.source}，里面有个观点说得挺到点子上——「${pick.text}」。这套逻辑放到这个话题下，恰好能支撑我的判断。`
      : `我最近看${pick.source}的时候，有段话一直记着——「${pick.text}」。你别说，用它来看今天这个问题，突然就通了。`
  }
  return isThinker
    ? `另外，${pick.source}，我当时就表达过类似的判断——「${pick.text}」。今天这个局面，正好验证了那句话。`
    : `其实${pick.source}的时候，我就提过「${pick.text}」。今天聊到这个，我越琢磨越觉得当时说得没错。`
}

/**
 * 人格「思想弹药库」的口语化引用（v27.1）— 对应人格表达书籍/观点
 * 从 PERSONA_SOURCES 取该人格匹配的书籍/思想家，织入本地模板回复，
 * 让 16 个人格在无 LLM 时也能「带着出处说话」，而非空泛讲道理。
 */
function weaveSources(typeId: string): string {
  const sources = PERSONA_SOURCES[typeId]
  if (!sources || sources.length === 0) return ''
  const s = sources[Math.floor(Math.random() * sources.length)]
  const system = personalitySystems[typeId]
  const isThinker = system.cognitiveMode.decisionStyle.includes('思考')
  return isThinker
    ? `这让我想到${s.source}里的一个判断——${s.idea}。放到这个辩题上，正好可以${s.usage}。`
    : `我忽然想起${s.source}——${s.idea}。用来看今天这个话题，正好可以${s.usage}。`
}

/**
 * 首轮发言（v21）— 第一句亮明立场（正方/反方），四步论证展开
 */
function buildOpening(
  typeId: string,
  topic: string,
  system: PersonalitySystem,
  sameTypeCount: number,
  side: Side,
  learning?: LearningMaterial
): string {
  const voice = voiceOf(typeId)
  const opener = voice.openers[Math.floor(Math.random() * voice.openers.length)]
  const declare = stanceDeclare(side, voice)
  const point = voice.pointOpeners[Math.floor(Math.random() * voice.pointOpeners.length)]
  const reason = reasonPool[Math.floor(Math.random() * reasonPool.length)]
  const analogy = analogyPool[Math.floor(Math.random() * analogyPool.length)]
  const conclusion = conclusionPool[Math.floor(Math.random() * conclusionPool.length)]

  // 学习素材（55% 概率自然融入，作为"依据"的补充）+ 思想弹药库（35% 概率引用书籍/观点）
  const learned = Math.random() < 0.55 ? weaveLearning(typeId, topic, learning) : ''
  const sourced = Math.random() < 0.35 ? weaveSources(typeId) : ''
  const followUp = voice.followUps[Math.floor(Math.random() * voice.followUps.length)]

  const parts: string[] = [
    opener,
    declare,
    `${point}${system.debateStances[sameTypeCount % system.debateStances.length]}。`,
    reason,
  ]
  if (learned) parts.push(learned)
  if (sourced) parts.push(sourced)
  parts.push(analogy)
  parts.push(conclusion)
  parts.push(followUp)

  return parts.join('')
}

/**
 * 精准反驳（v21）— 引用对方原话 → 指出漏洞 → 归谬打击 → 重申立场
 */
function buildReaction(
  typeId: string,
  topic: string,
  previousEntry: DebateEntry,
  system: PersonalitySystem,
  sameTypeCount: number,
  side: Side,
  learning?: LearningMaterial
): string {
  const voice = voiceOf(typeId)
  const frag = extractFragment(previousEntry.content)
  const learned = Math.random() < 0.5 ? weaveLearning(typeId, topic, learning) : ''
  const sourced = Math.random() < 0.4 ? weaveSources(typeId) : ''
  const isSameSide = side === previousEntry.side
  const addressee = previousEntry.isUser ? '你' : `@${previousEntry.typeId}`

  const parts: string[] = []

  if (frag) {
    const rebuttalOpener = voice.rebuttalOpeners[Math.floor(Math.random() * voice.rebuttalOpeners.length)]
    const fallacy = fallacyAttackPool[Math.floor(Math.random() * fallacyAttackPool.length)]
    const analogy = analogyPool[Math.floor(Math.random() * analogyPool.length)]
    const conclusion = conclusionPool[Math.floor(Math.random() * conclusionPool.length)]

    if (isSameSide || previousEntry.isUser) {
      // 同阵营补充 / 回应插话：先认同再补强
      parts.push(`${addressee}说「${frag}」——方向没问题，我来给它补一记重锤：`)
      parts.push(analogy)
      parts.push(conclusion)
    } else {
      // 对手：精准反驳（引用 → 打击）
      parts.push(`${rebuttalOpener}你刚说「${frag}」。${fallacy}`)
      parts.push(analogy)
      if (learned) parts.push(learned)
      if (sourced) parts.push(sourced)
      parts.push(conclusion)
    }
  } else {
    parts.push(`${addressee}的观点，有一个关键假设需要先被检验——`)
    parts.push(reasonPool[Math.floor(Math.random() * reasonPool.length)])
    if (learned) parts.push(learned)
    if (sourced) parts.push(sourced)
    parts.push(conclusionPool[Math.floor(Math.random() * conclusionPool.length)])
  }

  // 重申立场（不机械，按画风收）
  const stanceCloser = side === 'pro'
    ? ['立场不变，正方。', '我还是那句：正方。', '这一轮下来，我更加确定正方。']
    : ['立场不动摇，反方。', '我依然坚持反方。', '越辩越清楚，反方。']
  parts.push(stanceCloser[Math.floor(Math.random() * stanceCloser.length)])

  return parts.join('')
}

/**
 * 一句封喉（v21）— 辩论中后段的收尾总攻
 */
function buildClosing(
  typeId: string,
  topic: string,
  system: PersonalitySystem,
  sameTypeCount: number,
  side: Side,
  learning?: LearningMaterial
): string {
  const voice = voiceOf(typeId)
  const opener = voice.openers[Math.floor(Math.random() * voice.openers.length)]
  const learned = Math.random() < 0.6 ? weaveLearning(typeId, topic, learning) : ''
  const sourced = Math.random() < 0.45 ? weaveSources(typeId) : ''

  const points = [
    reasonPool[Math.floor(Math.random() * reasonPool.length)],
    analogyPool[Math.floor(Math.random() * analogyPool.length)],
    conclusionPool[Math.floor(Math.random() * conclusionPool.length)],
  ]
  const first = system.debateStances[sameTypeCount % system.debateStances.length]
  const second = system.debateStances[(sameTypeCount + 1) % system.debateStances.length]
  const closer = voice.closers[Math.floor(Math.random() * voice.closers.length)]

  const parts: string[] = [
    opener,
    `聊到这儿，我把话一次性说透（${side === 'pro' ? '正方' : '反方'}）：`,
    `第一，${first}。`,
    points[0],
    `第二，${second}。`,
    points[1],
    `第三，${points[2]}`,
  ]
  if (learned) parts.push(learned)
  if (sourced) parts.push(sourced)
  parts.push(closer)

  return parts.join('')
}

/**
 * 持续深化 — 换新角度推进，避免车轱辘话
 */
function buildDeepen(
  typeId: string,
  topic: string,
  system: PersonalitySystem,
  sameTypeCount: number,
  side: Side,
  learning?: LearningMaterial
): string {
  const voice = voiceOf(typeId)
  const learned = Math.random() < 0.6 ? weaveLearning(typeId, topic, learning) : ''
  const sourced = Math.random() < 0.45 ? weaveSources(typeId) : ''

  // 反思前缀（第三轮起）
  let reflectionPrefix = ''
  if (sameTypeCount >= 2 && system.reflectionTriggers.length > 0) {
    const trigger = system.reflectionTriggers[sameTypeCount % system.reflectionTriggers.length]
    const introspect = system.cognitiveMode.decisionStyle.includes('思考')
      ? `（刚才重新捋了一遍，特别是${trigger}这块）`
      : `（停了一下，认真想了想${trigger}这件事）`
    reflectionPrefix = `${introspect} `
  }

  const parts: string[] = [reflectionPrefix]
  const openers = [
    `${voice.openers[Math.floor(Math.random() * voice.openers.length)]}我再补一个角度：`,
    '换个角度看——',
    '还有一点值得说：',
    '顺着刚才的思路，我再往深挖一层：',
  ]
  parts.push(openers[Math.floor(Math.random() * openers.length)])
  parts.push(`${voice.pointOpeners[Math.floor(Math.random() * voice.pointOpeners.length)]}${system.debateStances[(sameTypeCount + 1) % system.debateStances.length]}。`)
  parts.push(reasonPool[Math.floor(Math.random() * reasonPool.length)])
  if (learned) parts.push(learned)
  if (sourced) parts.push(sourced)
  parts.push(analogyPool[Math.floor(Math.random() * analogyPool.length)])

  const closers = [
    '这一层想明白了，前面很多争论其实都是绕远路。',
    '这个点不解决，后面说再多都是空转。',
    '我的立场没有变，但理由又厚了一层。',
  ]
  parts.push(closers[Math.floor(Math.random() * closers.length)])

  return parts.join('')
}

/**
 * 生成辩论回复 — 自然语言 + 学习注入 + 立场分配
 *
 * @param typeId  人格类型
 * @param topic   辩论话题
 * @param history 历史发言
 * @param opts    可选：sceneName / stance / side（正反方）/ learning（学习素材）
 */
export function generateDebateResponse(
  typeId: string,
  topic: string,
  history: DebateEntry[],
  opts?: { sceneName?: string; stance?: string; side?: Side; learning?: LearningMaterial }
): DebateResponse {
  const system = personalitySystems[typeId]
  const profile = mbtiProfiles.find(p => p.id === typeId)
  if (!system || !profile) {
    return {
      content: `关于"${topic}"，我认为这是一个值得深入探讨的话题。`,
      confidence: 50,
      detail: { score: 50, logic: 50, persuasion: 50, fun: 50 },
    }
  }

  // --- 第一层：System Prompt（已内置于 system 对象中） ---

  // --- 第二层：Few-shot 匹配（保留，作为风格底色） ---
  const matchedExample = findBestFewShot(typeId, topic, history)

  // --- 第三层：动态上下文（场景 / 立场提示） ---
  const sceneName = opts?.sceneName
  const stance = opts?.stance
  const learning = opts?.learning
  // 立场：优先用传入的 side（辩论室按人数均分），否则看历史里该人格上次的立场，最后退化为轮换
  let side: Side = opts?.side || 'pro'
  const myMsgs = history.filter(h => h.typeId === typeId)
  if (!opts?.side && myMsgs.length > 0 && myMsgs[myMsgs.length - 1].side) {
    side = myMsgs[myMsgs.length - 1].side as Side
  }

  // --- 构建回复 ---
  const sameTypeCount = history.filter(h => h.typeId === typeId).length
  const previousEntry = history.length > 0 ? history[history.length - 1] : null
  const isResponding = previousEntry && !previousEntry.isUser && previousEntry.typeId !== typeId
  const totalRounds = Math.max(...history.map(h => history.filter(x => x.typeId === h.typeId).length).concat([0]))

  let content = ''

  // 策略0：辩论中后段 + 本场轮次较深 → 一句封喉总攻
  if (sameTypeCount >= 3 && totalRounds >= 5 && Math.random() < 0.5) {
    content = buildClosing(typeId, topic, system, sameTypeCount, side, learning)
  }
  // 策略1：首次发言 — 亮明立场（正方/反方），四步论证
  else if (sameTypeCount === 0) {
    content = buildOpening(typeId, topic, system, sameTypeCount, side, learning)
  }
  // 策略2：回应他人的发言 — 精准反驳
  else if (isResponding && previousEntry) {
    content = buildReaction(typeId, topic, previousEntry, system, sameTypeCount, side, learning)
  }
  // 策略3：持续深化 — 换角度推进
  else {
    content = buildDeepen(typeId, topic, system, sameTypeCount, side, learning)
  }

  // Few-shot 风格点缀（中后段偶尔借用句式，保持人设厚度）
  if (matchedExample && sameTypeCount > 1 && Math.random() < 0.3) {
    const snippet = matchedExample.response.split('。')[0] + '。'
    content = `${content} ${snippet}`
  }

  // --- 确保人设一致性 ---
  content = ensurePersonaConsistency(content, system)

  // --- 计算确信度 ---
  const baseConf = confidenceBases[typeId] || { score: 60, logic: 60, persuasion: 60, fun: 50 }
  const variation = () => Math.floor(Math.random() * 16 - 8)
  const usageBonus = Math.min(sameTypeCount * 2, 10) // 越讨论越有自信

  const detail: ConfidenceDetail = {
    score: Math.min(95, Math.max(30, baseConf.score + variation() + usageBonus)),
    logic: Math.min(95, Math.max(20, baseConf.logic + variation())),
    persuasion: Math.min(95, Math.max(20, baseConf.persuasion + variation())),
    fun: Math.min(95, Math.max(15, baseConf.fun + variation())),
  }

  return { content, confidence: detail.score, detail }
}

// ============ 裁判评分系统（v21） ============

export interface JudgeScore {
  typeId: string
  name: string
  emoji: string
  color: string
  logic: number       // 逻辑性
  evidence: number    // 论据质量
  rebuttal: number    // 反驳有效性
  clarity: number     // 表达清晰度
  demeanor: number    // 风度
  /** v26 对抗质量三维度（0-10，仅 AI 裁判提供） */
  engagement?: number // 交锋度
  depth?: number      // 深度推进
  kill?: number       // 致命打击
  total: number
  comment: string
}

/**
 * 裁判五维评分（用户方法论第三部分）
 * 逻辑性 / 论据质量 / 反驳有效性 / 表达清晰度 / 风度
 */
export function judgeDebate(
  allMessages: { typeId: string; typeName?: string; typeEmoji?: string; typeColor?: string; content: string; isUser?: boolean }[]
): JudgeScore[] {
  // 只统计人格发言
  const botMsgs = allMessages.filter(m => !m.isUser && m.typeId && m.typeId !== 'user')
  if (botMsgs.length === 0) return []

  const byType = new Map<string, typeof botMsgs>()
  botMsgs.forEach(m => {
    if (!byType.has(m.typeId)) byType.set(m.typeId, [])
    byType.get(m.typeId)!.push(m)
  })

  const scores: JudgeScore[] = []

  for (const [typeId, msgs] of byType) {
    const allText = msgs.map(m => m.content).join(' ')
    const msgCount = msgs.length
    if (msgCount === 0) continue

    // 逻辑性：逻辑连接词密度 + 结构完整度
    const logicMarks = (allText.match(/因为|所以|因此|前提|推论|如果|那么|但是|然而|证明|意味着/g) || []).length
    const hasStructure = /第一|第二|第三|首先|其次|最后/.test(allText) ? 12 : 0
    const logic = Math.min(98, Math.round(42 + logicMarks * 4 + hasStructure + (msgCount > 1 ? 6 : 0)))

    // 论据质量：干货密度（数据/例子/类比/书籍引用）
    const evMarks = (allText.match(/数据|统计|研究|调查|比如|例如|打个比方|就像|案例|书中|曾经|数据显示|概率|样本/g) || []).length
    const evidence = Math.min(98, Math.round(38 + evMarks * 5 + (msgCount > 2 ? 8 : 0)))

    // 反驳有效性：引用对方原话（「」）+ 反驳词
    const quoteMarks = (allText.match(/「[^」]+」/g) || []).length
    const rebutMarks = (allText.match(/反驳|不同意|站不住|漏洞|你刚说|你混淆|以偏概全|偷换概念|不成立/g) || []).length
    const rebuttal = Math.min(98, Math.round(34 + quoteMarks * 7 + rebutMarks * 4))

    // 表达清晰度：句子长度适中 + 标点完整
    const sentences = allText.split(/[。！？!?]/).filter(s => s.trim().length > 0)
    const avgLen = sentences.length > 0 ? allText.length / sentences.length : 40
    let clarity = 60
    if (avgLen >= 12 && avgLen <= 42) clarity = 86
    else if (avgLen >= 8 && avgLen <= 60) clarity = 74
    else clarity = 58
    clarity = Math.min(96, clarity + Math.min(msgCount * 2, 8))

    // 风度：攻击性词扣分，礼貌词加分
    let demeanor = 78
    const attackMarks = (allText.match(/你错了|你蠢|垃圾|闭嘴|可笑|白痴|没脑子|智商/g) || []).length
    demeanor -= attackMarks * 9
    const politeMarks = (allText.match(/理解|尊重|感谢|我觉得|个人看法|我明白|你说得有道理/g) || []).length
    demeanor += politeMarks * 2
    demeanor = Math.max(30, Math.min(98, demeanor))

    const total = Math.round(logic * 0.25 + evidence * 0.2 + rebuttal * 0.25 + clarity * 0.15 + demeanor * 0.15)

    // 评语
    let comment = ''
    const strongest = [
      { k: logic, name: '逻辑性' },
      { k: evidence, name: '论据质量' },
      { k: rebuttal, name: '反驳能力' },
      { k: clarity, name: '表达清晰' },
      { k: demeanor, name: '风度' },
    ].sort((a, b) => b.k - a.k)[0]
    const weakest = [
      { k: logic, name: '逻辑' },
      { k: evidence, name: '论据' },
      { k: rebuttal, name: '反驳' },
      { k: clarity, name: '表达' },
      { k: demeanor, name: '风度' },
    ].sort((a, b) => a.k - b.k)[0]
    if (total >= 85) comment = `全场最佳，${strongest.name}堪称碾压。`
    else if (total >= 75) comment = `发挥出色，${strongest.name}是最大亮点。`
    else if (total >= 65) comment = `中规中矩，${strongest.name}可圈可点。`
    else comment = `有待提升，${weakest.name}是明显短板。`

    scores.push({
      typeId,
      name: msgs[0].typeName || typeId,
      emoji: msgs[0].typeEmoji || '🤖',
      color: msgs[0].typeColor || '#888',
      logic,
      evidence,
      rebuttal,
      clarity,
      demeanor,
      total,
      comment,
    })
  }

  return scores.sort((a, b) => b.total - a.total)
}

// ============ 反射机制 ============

export function generateReflection(
  typeId: string,
  allMessages: { typeId: string; content: string; isUser?: boolean }[]
): ReflectionResult {
  const system = personalitySystems[typeId]
  if (!system) return { typeId, reflection: '（默默地重新审视了整个讨论）' }

  const myMsgs = allMessages.filter(m => m.typeId === typeId && !m.isUser)
  const othersMsgs = allMessages.filter(m => m.typeId !== typeId && !m.isUser)

  let reflection = ''

  // 反思触发检查
  const othersContent = othersMsgs.map(m => m.content).join(' ')
  const myContent = myMsgs.map(m => m.content).join(' ')

  // 是否过于坚持立场
  if (myMsgs.length >= 3 && myMsgs.every(m => m.content.includes('但是') || m.content.includes('然而'))) {
    reflection = '（暂停了一下）我刚才是不是一直在反驳？让我试着从另一个角度理解——也许对方说的并非毫无道理。'
  }
  // 是否忽略了情感维度
  else if (system.cognitiveMode.decisionStyle.includes('思考') &&
           othersContent.includes('感受') || othersContent.includes('情感') || othersContent.includes('人')) {
    reflection = `（深吸一口气）作为${typeId}，我习惯于用逻辑衡量一切。但对方提到了"人"——这提醒了我，有些价值的量纲不同于效率。让我试着从人的角度重新看待这个问题。`
  }
  // 是否偏离了核心议题
  else if (myMsgs.length >= 2 && !myMsgs.some(m => m.content.includes(topicExtract(allMessages)))) {
    reflection = '（自我审视）我刚才的发言好像偏离了核心议题。让我回到重点——'
  }
  // 通用反思
  else {
    const trigger = system.reflectionTriggers[myMsgs.length % system.reflectionTriggers.length] || '自己的论证方式'
    reflection = `（停下来反思了一下）关于"${trigger}"，我想补充一点——`
  }

  const result: ReflectionResult = { typeId, reflection }

  // 是否修正立场
  if (myMsgs.length >= 3 && Math.random() > 0.7) {
    result.revisedStance = '经过反思，我意识到我之前的部分论证过于绝对，我愿意调整立场中的某些细节。'
  }

  return result
}

// ============ 辅助函数 ============

function topicExtract(messages: { content: string }[]): string {
  return messages.map(m => m.content).join(' ').substring(0, 100)
}

/**
 * 确保回复符合人设一致性：
 * - 思考型：不能出现"我感觉""我觉得很棒"等情感化表达
 * - 情感型：不能完全冷冰冰
 * - 内向型：语气应该更收敛
 */
function ensurePersonaConsistency(content: string, system: PersonalitySystem): string {
  let result = content

  // T 型修正：如果出现了过多情感表达，替换
  if (system.cognitiveMode.decisionStyle.includes('思考')) {
    const emotionPatterns = [
      { from: /我(深深地|非常|特别)感受到/g, to: '我注意到' },
      { from: /太棒了！/g, to: '这符合预期。' },
      { from: /我(深受|被)感动/g, to: '这引发了我的思考' },
    ]
    for (const { from, to } of emotionPatterns) {
      result = result.replace(from, to)
    }
  }

  // F 型修正：如果完全冷冰冰，加一点温度
  if (system.cognitiveMode.decisionStyle.includes('情感') && !/[！!]/.test(result)) {
    // 确保至少有一些情感表达
    if (result.length > 30 && !result.includes('觉得') && !result.includes('感受') && !result.includes('理解')) {
      result = result + ' 至少，这是我真实的感受。'
    }
  }

  // I 型修正：开头不能太张扬
  if (system.cognitiveMode.energySource.includes('内向')) {
    result = result.replace(/^(大家听我说！|都给我听好了！|所有人注意！)/g, '我想说一句——')
  }

  return result
}

/**
 * 生成人格自我介绍（用于首次加入辩论时）
 */
export function generateIntro(typeId: string, topic: string): string {
  const system = personalitySystems[typeId]
  const profile = mbtiProfiles.find(p => p.id === typeId)
  if (!system || !profile) return `大家好，我是${typeId}，来参与这个话题的讨论。`

  const tone = system.speechPattern.tone
  return `（${profile.id} ${profile.name} 加入讨论，语气${tone}）关于"${topic}"——${system.debateStances[0]}。`
}
