/**
 * 人格知识库扩展数据
 *
 * 在 mbtiProfiles（基础档案）与 personalitySystem（语言系统）之上，
 * 补充知识库页面所需的内容：
 *  - 认知功能栈（荣格八维）
 *  - 代表人物（真实名人归类，主流社区共识）
 *  - 职业方向 / 沟通提示 / 成长建议
 *  - 经典书籍观点（按人格 × 按书籍两种浏览方式）
 */

export interface PersonaKnowledge {
  typeId: string
  cognitiveStack: string      // 荣格八维功能栈，如 Ni-Te-Fi-Se
  dominantFunction: string    // 主导功能名
  dominantDesc: string        // 主导功能一句话解释
  famousPeople: { name: string; field: string; note: string }[]
  careers: string[]
  communicationTips: string[]
  growthTips: string
}

export interface BookQuote {
  typeId: string
  quote: string               // 书籍对该人格的核心观点（贴合该书视角与人设）
  source: string              // 出处/章节概念
}

export interface PersonalityBook {
  id: string
  title: string
  author: string
  year: number
  description: string         // 书籍简介
  theme: string               // 主题标签
  accent: string              // 展示色
  quotes: BookQuote[]         // 书中对各人格的观点（代表性人格，非全量）
}

// ============ 16 人格扩展知识 ============

export const personaKnowledge: Record<string, PersonaKnowledge> = {
  INTJ: {
    typeId: 'INTJ',
    cognitiveStack: 'Ni-Te-Fi-Se',
    dominantFunction: '内倾直觉 (Ni)',
    dominantDesc: '从纷繁信息中提炼出唯一的、深层的发展脉络，看见"未来的剧本"',
    famousPeople: [
      { name: '埃隆·马斯克', field: '企业家 / 工程师', note: '把"移民火星"这种宏大愿景拆成十年路线图' },
      { name: '弗里德里希·尼采', field: '哲学家', note: '重估一切价值，独自对抗时代的主流叙事' },
    ],
    careers: ['战略顾问', '系统架构师', '科研学者', '投资分析师', '城市规划师'],
    communicationTips: ['直奔重点，先给结论再给论证', '用数据和框架说话，避免情绪化表述', '尊重他的独立思考，不要试图用"大家都这样"说服他'],
    growthTips: '练习把内心蓝图拆解为可执行的短周期动作，并主动表达对身边人的认可——不是所有价值都能量化。',
  },
  INTP: {
    typeId: 'INTP',
    cognitiveStack: 'Ti-Ne-Si-Fe',
    dominantFunction: '内倾思考 (Ti)',
    dominantDesc: '构建精确的内部逻辑模型，不断追问"这个原理为什么成立"',
    famousPeople: [
      { name: '阿尔伯特·爱因斯坦', field: '物理学家', note: '用思想实验撬动经典物理的根基' },
      { name: '比尔·盖茨', field: '企业家 / 慈善家', note: '把"阅读-思考-输出"当作终身的操作系统' },
    ],
    careers: ['研究员', '程序员', '数据分析师', '哲学学者', '系统设计师'],
    communicationTips: ['给足思考时间，不要逼他当场表态', '指出逻辑漏洞会赢得他的尊重', '少寒暄，多讨论"为什么"'],
    growthTips: '把"足够好"当作一种能力，而不是妥协；偶尔用行动替代分析，用经验校验理论。',
  },
  ENTJ: {
    typeId: 'ENTJ',
    cognitiveStack: 'Te-Ni-Se-Fi',
    dominantFunction: '外倾思考 (Te)',
    dominantDesc: '用外部目标校准一切，组织资源、人力和流程直取结果',
    famousPeople: [
      { name: '史蒂夫·乔布斯', field: '企业家', note: '以"现实扭曲力场"驱动团队完成不可能的产品' },
      { name: '玛格丽特·撒切尔', field: '政治家', note: '"没有社会这种东西，只有个人与家庭"的果断执行者' },
    ],
    careers: ['CEO / 高管', '战略运营', '产品负责人', '律师', '创业创始人'],
    communicationTips: ['带着方案来讨论，不要只抛问题', '语言精炼、有结论、有下一步行动', '他欣赏被挑战，但挑战要有依据'],
    growthTips: '在效率之外给"人"留出空间——倾听成本很低，错过人心的代价却很高。',
  },
  ENTP: {
    typeId: 'ENTP',
    cognitiveStack: 'Ne-Ti-Fe-Si',
    dominantFunction: '外倾直觉 (Ne)',
    dominantDesc: '看到无数可能性与关联，享受在思想碰撞中迸发新想法',
    famousPeople: [
      { name: '托马斯·爱迪生', field: '发明家', note: '一千次失败的"试错"都是通向答案的岔路' },
      { name: '马克·吐温', field: '作家', note: '用幽默和反讽拆穿所有一本正经' },
    ],
    careers: ['产品经理', '创业策划', '律师 / 辩论', '内容创作者', '商业分析师'],
    communicationTips: ['陪他玩"思想实验"，先接住脑洞再谈落地', '别用"你错了"开头，用"如果换个前提呢"', '他需要被认真反驳，敷衍的附和会让他失望'],
    growthTips: '选一个方向深耕到出成果，而非永远在"下一个想法"的路上——点子只有兑现才有价值。',
  },
  INFJ: {
    typeId: 'INFJ',
    cognitiveStack: 'Ni-Fe-Ti-Se',
    dominantFunction: '内倾直觉 (Ni)',
    dominantDesc: '洞见事物的深层意义与长远走向，近乎预言的直觉',
    famousPeople: [
      { name: '马丁·路德·金', field: '民权运动领袖', note: '以愿景与信念感召千万人，而非靠强权' },
      { name: '甘地', field: '社会活动家', note: '用非暴力不合作证明信念可以改变现实' },
    ],
    careers: ['心理咨询师', '教育工作者', '作家', '公益事业', '组织发展顾问'],
    communicationTips: ['真诚第一——他能察觉任何形式的敷衍', '谈论意义和价值观，而非单纯利弊', '给他独处空间，不要索取即时回应'],
    growthTips: '理想需要落地接口：定期把愿景翻译成可执行的小事，学会拒绝超载的责任。',
  },
  INFP: {
    typeId: 'INFP',
    cognitiveStack: 'Fi-Ne-Si-Te',
    dominantFunction: '内倾情感 (Fi)',
    dominantDesc: '以内心价值罗盘为锚，追求真实、美与意义',
    famousPeople: [
      { name: '威廉·莎士比亚', field: '剧作家', note: '在十四行诗里安放全部内心风暴' },
      { name: 'J·R·R·托尔金', field: '作家', note: '用一整座中土世界安放对自然与善良的信念' },
    ],
    careers: ['作家 / 编辑', '插画师', '心理咨询', '公益组织', '翻译'],
    communicationTips: ['先共情，再讨论事情', '不要否定他的理想——那是在否定他的核心', '温和表达分歧，给他消化时间'],
    growthTips: '练习把"我觉得"升级为"我决定"，让内心价值在现实中拿到结果。',
  },
  ENFJ: {
    typeId: 'ENFJ',
    cognitiveStack: 'Fe-Ni-Se-Ti',
    dominantFunction: '外倾情感 (Fe)',
    dominantDesc: '敏锐读取群体情绪，天然地凝聚人心、推动共同成长',
    famousPeople: [
      { name: '奥普拉·温弗瑞', field: '媒体人', note: '把私人的眼泪变成千万人的共鸣' },
      { name: '贝拉克·奥巴马', field: '政治家', note: '以"我们可以"的叙事凝聚集体信念' },
    ],
    careers: ['教育工作者', 'HR / 组织发展', '主持人', '销售', '公益领袖'],
    communicationTips: ['回应他的关心，别让他独自付出', '坦诚表达需求，他乐于被你信任', '他会照顾所有人——记得照顾他'],
    growthTips: '学会说"不"与设定边界：你对所有人的好，不应该以消耗自己为代价。',
  },
  ENFP: {
    typeId: 'ENFP',
    cognitiveStack: 'Ne-Fi-Te-Si',
    dominantFunction: '外倾直觉 (Ne)',
    dominantDesc: '点燃连接的火花，在人与人的可能性中寻找灵感',
    famousPeople: [
      { name: '罗宾·威廉姆斯', field: '演员', note: '用即兴表演让全场相信快乐是免费的' },
      { name: '沃尔特·迪士尼', field: '动画家', note: '把"如果……会怎样"变成一整座梦想乐园' },
    ],
    careers: ['创意策划', '市场品牌', '演讲 / 培训', '记者', '社群运营'],
    communicationTips: ['热情回应他的灵感，先肯定再落地', '把任务写下来交给他，别靠口头约定', '给他探索的自由，同时约定交付节点'],
    growthTips: '给热情装上"完成机制"：日历比灵感更可靠，收尾比开场更见功力。',
  },
  ISTJ: {
    typeId: 'ISTJ',
    cognitiveStack: 'Si-Te-Fi-Ne',
    dominantFunction: '内倾感觉 (Si)',
    dominantDesc: '以过往经验为基石，忠实、可靠、按章办事',
    famousPeople: [
      { name: '乔治·华盛顿', field: '政治家', note: '以制度与自律立国，而非个人魅力' },
      { name: '沃伦·巴菲特', field: '投资人', note: '用纪律和复利对抗市场的喧嚣' },
    ],
    careers: ['会计师', '审计', '工程师', '公务员', '质量管理'],
    communicationTips: ['用事实和时间线说话，少讲"感觉"', '提前告知变更，他讨厌临时的意外', '承诺的事一定要做到'],
    growthTips: '偶尔把"过去一直如此"换成"这次可以不同"——经验是地基，不是天花板。',
  },
  ISFJ: {
    typeId: 'ISFJ',
    cognitiveStack: 'Si-Fe-Ti-Ne',
    dominantFunction: '内倾感觉 (Si)',
    dominantDesc: '守护传统与细节，用默默的付出照顾身边每一个人',
    famousPeople: [
      { name: '特蕾莎修女', field: '慈善家', note: '在微小而具体的照料中实践大爱' },
      { name: '罗莎·帕克斯', field: '民权运动家', note: '一个看似微小的座位决定，撬动了历史' },
    ],
    careers: ['护理 / 医疗', '行政助理', '教师', '社会工作', '客服管理'],
    communicationTips: ['看见并感谢他的付出——他不说，不代表不需要', '讨论变更时先问他的顾虑', '他记得你说过的每一件小事'],
    growthTips: '学习把需求说出口：你的感受同样值得被照顾，不必总是最后一个。',
  },
  ESTJ: {
    typeId: 'ESTJ',
    cognitiveStack: 'Te-Si-Ne-Fi',
    dominantFunction: '外倾思考 (Te)',
    dominantDesc: '以规则、秩序与结果组织世界，天生的管理者',
    famousPeople: [
      { name: '亨利·福特', field: '企业家', note: '用流水线把效率变成工业时代的信条' },
      { name: '桑德拉·奥康纳', field: '美国大法官', note: '以制度与先例审慎裁决每个争议' },
    ],
    careers: ['管理者', '项目经理', '执法 / 军警', '财务总监', '运营主管'],
    communicationTips: ['条理清晰，结论先行，附上时间表', '尊重规则——先了解规矩再谈变通', '他看重执行力，空谈愿景不如展示进度'],
    growthTips: '规则之外有例外，效率之外有温度——偶尔倾听情感，世界不会因此失序。',
  },
  ESFJ: {
    typeId: 'ESFJ',
    cognitiveStack: 'Fe-Si-Ne-Ti',
    dominantFunction: '外倾情感 (Fe)',
    dominantDesc: '在人际连接中获得能量，天生的照料者与组织者',
    famousPeople: [
      { name: '泰勒·斯威夫特', field: '歌手', note: '把粉丝的认同感经营成一种文化' },
      { name: '休·杰克曼', field: '演员', note: '以暖与担当成为团队公认的"灵魂人物"' },
    ],
    careers: ['护理', '教师', '活动策划', '客户关系', '社区管理'],
    communicationTips: ['表达感激要具体，他会记在心里', '避免公开批评，私下沟通更有效', '让他参与决策，归属感源于被需要'],
    growthTips: '他人评价不该是唯一的镜子：练习与自己相处，听见自己真实的声音。',
  },
  ISTP: {
    typeId: 'ISTP',
    cognitiveStack: 'Ti-Se-Ni-Fe',
    dominantFunction: '内倾思考 (Ti) + 外倾感觉 (Se)',
    dominantDesc: '动手拆解一切，在"做"中理解世界的运作方式',
    famousPeople: [
      { name: '克林特·伊斯特伍德', field: '演员 / 导演', note: '话少、手稳，用镜头语言直击要害' },
      { name: '李小龙', field: '武术家', note: '把哲学变成身体的精确反应' },
    ],
    careers: ['工程师', '外科医生', '飞行员', '赛车手 / 运动员', '技术维修'],
    communicationTips: ['简洁直接，别绕弯子', '用实际问题开场，而不是寒暄', '给他动手试错的空间，不要微观管理'],
    growthTips: '长期规划不是束缚，是方向盘：为热爱的事设置一个时间维度。',
  },
  ISFP: {
    typeId: 'ISFP',
    cognitiveStack: 'Fi-Se-Ni-Te',
    dominantFunction: '内倾情感 (Fi) + 外倾感觉 (Se)',
    dominantDesc: '在当下鲜活感受中忠于内心，用美与行动表达自我',
    famousPeople: [
      { name: '迈克尔·杰克逊', field: '音乐人', note: '把敏感与孤独淬炼成舞台上的纯粹表达' },
      { name: '约翰尼·德普', field: '演员', note: '用独特角色安放不合群的天性' },
    ],
    careers: ['设计师', '摄影师', '音乐人', '厨师', '手工艺人'],
    communicationTips: ['先理解感受，再讨论道理', '给他空间，不要催促表态', '欣赏他的作品——那是他的一部分'],
    growthTips: '用计划保护才华：灵感来时记录下来，交给一个能完成的机制。',
  },
  ESTP: {
    typeId: 'ESTP',
    cognitiveStack: 'Se-Ti-Fe-Ni',
    dominantFunction: '外倾感觉 (Se)',
    dominantDesc: '活在当下、行动敏捷，在真实世界里解决真实问题',
    famousPeople: [
      { name: '温斯顿·丘吉尔', field: '政治家', note: '在危机现场以果断行动力挽狂澜' },
      { name: '麦当娜', field: '歌手', note: '一次次打破边界，永远站在潮流浪尖' },
    ],
    careers: ['创业者', '销售', '消防 / 应急', '体育教练', '投资交易'],
    communicationTips: ['用事实和行动说话，拒绝纸上谈兵', '直接指出分歧，他会欣赏你的坦诚', '给他刺激与挑战，无聊是他的敌人'],
    growthTips: '行动之前多花三分钟想后果——勇气需要判断力做刹车。',
  },
  ESFP: {
    typeId: 'ESFP',
    cognitiveStack: 'Se-Fi-Te-Ni',
    dominantFunction: '外倾感觉 (Se)',
    dominantDesc: '把现场变成舞台，用热情与感染力点亮每个当下',
    famousPeople: [
      { name: '埃尔顿·约翰', field: '音乐人', note: '用华丽与热力征服每一座舞台' },
      { name: '玛丽莲·梦露', field: '演员', note: '镜头前的光芒背后是渴望被看见的心' },
    ],
    careers: ['演艺 / 表演', '活动主持', '时尚', '销售', '旅游'],
    communicationTips: ['一起玩，一起体验，先建立快乐连接', '讨论严肃话题时给足轻松缓冲', '认可他的魅力，但也要聊现实规划'],
    growthTips: '今天的快乐很重要，明天的账也要算：给热情配一个储蓄罐。',
  },
}

// ============ 经典书籍观点 ============

export const personalityBooks: PersonalityBook[] = [
  {
    id: 'gifts-differing',
    title: '天生不同',
    author: '伊莎贝尔·迈尔斯 & 彼得·迈尔斯',
    year: 1980,
    description: 'MBTI 奠基之作，由迈尔斯母女在荣格类型论基础上开发。书中提出：性格类型无优劣，每一种偏好组合都是一套完整、自洽的心理操作系统；理解差异不是给人贴标签，而是学会"翻译"彼此。',
    theme: '类型差异 / 自我认知',
    accent: '#6366f1',
    quotes: [
      { typeId: 'INTJ', quote: '直觉-思考的组合让他们能看见未来的棋局，却常常惊讶于他人为何看不到。', source: '类型与气质（第12章）' },
      { typeId: 'INTP', quote: '思考-直觉型将世界视为一个待解的谜题，他们的乐趣不在于结论，而在于解题本身。', source: '思考型人格' },
      { typeId: 'ENTJ', quote: '外倾思考者天生是组织者——他们不满足于理解世界，而要改造世界。', source: '外倾思考（第7章）' },
      { typeId: 'ENTP', quote: '直觉-思考型中最喜欢争辩的一群：他们不是在反对你，而是在测试想法的强度。', source: '直觉型人格' },
      { typeId: 'INFJ', quote: '内倾直觉让他们看见表象之下的暗流，这类人常常在安静中酝酿改变。', source: '内倾直觉（第9章）' },
      { typeId: 'INFP', quote: '理想主义者中最安静的一支：他们的忠诚不指向组织，而指向内心认定的价值。', source: '情感型人格' },
      { typeId: 'ENFJ', quote: '外倾情感者是天生的催化剂——他们让周围的人感到被看见，从而愿意做得更好。', source: '外倾情感（第8章）' },
      { typeId: 'ISTJ', quote: '感觉-判断型是社会运行的压舱石：他们提供的稳定，让冒险成为可能。', source: '感觉型人格' },
      { typeId: 'ISFJ', quote: '内倾感觉者铭记每一个细节与承诺——他们的可靠常常被视作理所当然。', source: '感觉-情感组合' },
      { typeId: 'ESTJ', quote: '外倾思考-感觉型的管理者相信秩序即公平：规则面前人人平等，包括他们自己。', source: '判断型人格' },
      { typeId: 'ISTP', quote: '内倾思考者用行动检验理论——世界对他们是可拆卸、可重组的机器。', source: '思考-感觉组合' },
      { typeId: 'ESTP', quote: '感觉-思考型的行动派只在现场做决定：他们的智慧长在手脚上。', source: '感觉型人格' },
    ],
  },
  {
    id: 'please-understand-me',
    title: '请理解我 II',
    author: '大卫·凯尔西',
    year: 1998,
    description: '凯尔西的气质类型学把 16 型归为四大气质——工匠、护卫者、理想主义者、理性者。他不关心"你适合什么工作"，而关心"你是谁、你追求什么"。语言犀利，直指每种气质的欲望与恐惧。',
    theme: '四种气质 / 人生追求',
    accent: '#2fc9a3',
    quotes: [
      { typeId: 'INTJ', quote: '理性者中的策划者：他们在脑中预演未来三十年的棋局，并以此为乐。', source: '理性者气质' },
      { typeId: 'INTP', quote: '理性者痴迷于能力与知识本身——他们真正的伴侣是问题，而不是答案。', source: '理性者气质' },
      { typeId: 'ENTJ', quote: '策划者的欲望是指挥：他们要的是战场，而不是会议室。', source: '理性者：策划者' },
      { typeId: 'ENTP', quote: '发明家气质的灵魂是"可能性"——被束缚的 ENTP 会枯萎，自由才是他们的氧。', source: '理性者：发明家' },
      { typeId: 'INFJ', quote: '理想主义者中的咨询师：他们知道人心如何运作，却常常不懂如何保护自己。', source: '理想主义者气质' },
      { typeId: 'INFP', quote: '理想主义者中的治疗师：他们以抚平伤痛为使命，却容易把世界的痛背在自己身上。', source: '理想主义者：治疗师' },
      { typeId: 'ENFJ', quote: '教师气质的本质是启迪：他们站在人群前面，不是要领导，而是要点灯。', source: '理想主义者：教师' },
      { typeId: 'ISTJ', quote: '护卫者中的监察者：他们守护的是秩序本身——混乱对他们而言是原罪。', source: '护卫者气质' },
      { typeId: 'ESFJ', quote: '护卫者中的供给者：他们的快乐来自照顾具体的人，而非抽象的理想。', source: '护卫者：供给者' },
      { typeId: 'ISTP', quote: '工匠中的机械师：话最少的人往往最懂机器——包括人心的机器。', source: '工匠气质' },
      { typeId: 'ESTP', quote: '工匠中的创业者：他们用身体丈量世界，危险与刺激是他们存在的方式。', source: '工匠：创业者' },
      { typeId: 'ESFP', quote: '工匠中的表演者：人群是他们最好的舞台，掌声是他们确认自己存在的方式。', source: '工匠：表演者' },
    ],
  },
  {
    id: 'do-what-you-are',
    title: '就业宝典',
    author: '保罗·蒂格 & 芭芭拉·巴伦',
    year: 2001,
    description: '把 MBTI 应用于职业规划的经典指南：不是"哪种工作适合哪种人"，而是"你的偏好组合在哪种工作环境中能发挥最大能量"。强调选择职业 = 选择一种生活方式。',
    theme: '职业规划 / 工作方式',
    accent: '#d9b871',
    quotes: [
      { typeId: 'INTJ', quote: 'INTJ 需要的是独立决策权与长远视角——给他们一个"十年项目"，而不是一份周报。', source: 'INTJ 职业环境' },
      { typeId: 'ENTJ', quote: 'ENTJ 在组织中要的是指挥权：他们可以容忍任何艰苦，唯独不能容忍低效。', source: 'ENTJ 领导风格' },
      { typeId: 'INTP', quote: 'INTP 的职业关键词是"自由探索"：被钉在流程上的 INTP，才华会迅速氧化。', source: 'INTP 工作偏好' },
      { typeId: 'INFJ', quote: 'INFJ 适合帮助他人成长的职业：咨询、教育、写作——他们需要看见工作的意义。', source: 'INFJ 职业方向' },
      { typeId: 'ENFJ', quote: 'ENFJ 是天然的团队凝聚器：他们适合需要人际协调与愿景传递的岗位。', source: 'ENFJ 职场定位' },
      { typeId: 'ISTJ', quote: 'ISTJ 是组织最可靠的执行中枢：清晰的职责边界比晋升承诺更能留住他们。', source: 'ISTJ 工作满意度' },
      { typeId: 'ISFJ', quote: 'ISFJ 在服务性岗位中发光：护理、行政、教育——他们从"被需要"中获得职业意义。', source: 'ISFJ 职业匹配' },
      { typeId: 'ESTJ', quote: 'ESTJ 需要明确的权责与晋升阶梯：他们用业绩说话，也要求规则兑现。', source: 'ESTJ 管理偏好' },
      { typeId: 'ISTP', quote: 'ISTP 讨厌重复流程，热爱"解决问题"的即时反馈——技术、工程、现场是他们的主场。', source: 'ISTP 职业适配' },
      { typeId: 'ESTP', quote: 'ESTP 适合高压、多变、结果导向的环境：危机现场比办公室更能激发他们。', source: 'ESTP 工作环境' },
      { typeId: 'ESFP', quote: 'ESFP 需要人群与即时反馈：表演、销售、活动——把热情变成生产力。', source: 'ESFP 职业风格' },
      { typeId: 'INFP', quote: 'INFP 在创作与助人中寻找意义：他们宁可收入少一些，也不愿背叛价值观。', source: 'INFP 价值排序' },
    ],
  },
  {
    id: 'psychological-types',
    title: '心理类型',
    author: '卡尔·荣格',
    year: 1921,
    description: '一切类型学说的源头。荣格提出内倾/外倾两种态度与思维、情感、感觉、直觉四种功能，认为每个人都有一个主导功能在"驾驶"，其余功能在幕后协助——读懂自己，始于识别这个驾驶员。',
    theme: '类型学源头 / 八维功能',
    accent: '#8f7ff5',
    quotes: [
      { typeId: 'INTJ', quote: '内倾直觉者被未来的图景牵引，他们追随的是内心深处的"意象"，而非外界的确认。', source: '内倾直觉型（第10章）' },
      { typeId: 'INTP', quote: '内倾思维者以概念为食：外在世界对他们而言，只是内部模型的试验场。', source: '内倾思维型（第11章）' },
      { typeId: 'ENTJ', quote: '外倾思维型将理念组织成行动纲领——他们的思考必须抵达现实，否则毫无意义。', source: '外倾思维型（第10章）' },
      { typeId: 'ENTP', quote: '外倾直觉型追逐新可能如飞蛾扑火：昨日的新发现，今天已是他们的旧物。', source: '外倾直觉型（第11章）' },
      { typeId: 'INFJ', quote: '内倾直觉与内倾情感交融，使这类人既洞察未来，又深怀信念——先知与诗人的合体。', source: '功能组合分析' },
      { typeId: 'ISTJ', quote: '内倾感觉型忠实于"曾经如此"：对他们而言，经验就是真理的存档。', source: '内倾感觉型' },
      { typeId: 'ESTJ', quote: '外倾思维-感觉的组合造就务实的秩序构建者：他们用行动定义"应该"。', source: '外倾功能组合' },
      { typeId: 'ISTP', quote: '内倾思维者往往被外倾感觉牵引，成为用双手验证理论的匠人。', source: '内倾思维型（第11章）' },
      { typeId: 'ESFP', quote: '外倾感觉型活在感官的当下：他们的真实不在回忆里，也不在未来，就在此刻。', source: '外倾感觉型' },
    ],
  },
  {
    id: 'personality-plus',
    title: '性格分析',
    author: '弗洛伦斯·妮蒂雅',
    year: 1992,
    description: '大众心理学畅销经典，将希波克拉底的四种气质（活泼/完美/力量/平和）与日常行为观察结合。语言亲切、案例生动，帮助普通人识别自己与他人的性格模式，从而改善沟通与关系。',
    theme: '大众性格 / 人际沟通',
    accent: '#e58fb5',
    quotes: [
      { typeId: 'ENTP', quote: '活泼型中最具攻击性的一群：他们用聪明挑战一切，魅力与挑衅是一枚硬币的两面。', source: '活泼型（Sanguine）' },
      { typeId: 'ESFP', quote: '典型的活泼型灵魂：人群散去后的孤独，是快乐面具下的暗影。', source: '活泼型（Sanguine）' },
      { typeId: 'INTJ', quote: '完美型气质的极端演绎：他们对自己严苛，对世界更严苛，孤独是智者的税。', source: '完美型（Melancholy）' },
      { typeId: 'INFJ', quote: '完美型中最温柔的深度：敏感让他们看见别人看不见的，也承担别人承担不了的。', source: '完美型（Melancholy）' },
      { typeId: 'ESTJ', quote: '力量型领导者的教科书样本：他们要的是结果、效率与服从，温柔是他们词典里最陌生的词。', source: '力量型（Choleric）' },
      { typeId: 'ENTJ', quote: '力量型的战略版：不仅指挥当下，还指挥未来——有时连天气都想要发号施令。', source: '力量型（Choleric）' },
      { typeId: 'ISFJ', quote: '平和型中最尽责的一群：他们以沉默的付出维系家庭的温度，功勋章上却从不写自己的名字。', source: '平和型（Phlegmatic）' },
      { typeId: 'ESFJ', quote: '平和型气质融入外倾社交：他们维系关系如园丁浇花，从不觉得琐碎。', source: '平和型（Phlegmatic）' },
    ],
  },
]

// 便捷查询：某人格在所有书籍中的观点
export function getBookQuotesByType(typeId: string): { book: PersonalityBook; quote: BookQuote }[] {
  const result: { book: PersonalityBook; quote: BookQuote }[] = []
  for (const book of personalityBooks) {
    const quote = book.quotes.find(q => q.typeId === typeId)
    if (quote) result.push({ book, quote })
  }
  return result
}
