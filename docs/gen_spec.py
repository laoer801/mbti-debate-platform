# -*- coding: utf-8 -*-
"""
思辩星球 DebateSphere · 产品说明计划书 生成器
一次内容模型，双重渲染：Word (.docx) + 打印友好 HTML
"""
import os, io, html as H
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
DOCX_PATH = os.path.join(OUT_DIR, "产品说明计划书-思辩星球×知乎生态.docx")
HTML_PATH = os.path.join(OUT_DIR, "产品说明计划书-思辩星球×知乎生态.html")

CN = '微软雅黑'
EN = 'Segoe UI'
MONO = 'Consolas'

INK   = RGBColor(0x1E, 0x29, 0x3B)
INK2  = RGBColor(0x47, 0x55, 0x69)
MUTED = RGBColor(0x64, 0x74, 0x8B)
ACCENT = RGBColor(0x43, 0x38, 0xCA)   # indigo-700
ACCENT2 = RGBColor(0x08, 0x91, 0xB2)  # cyan-600
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

H_FILL = '1E293B'   # table header fill
Z_FILL = 'F1F5F9'   # zebra fill
BORDER = 'CBD5E1'


# ============================================================
# CONTENT MODEL  ——  blocks:
#   ('h1', text) ('h2', text) ('h3', text)
#   ('p', text) ('bullets', [..]) ('nums', [..])
#   ('quote', text) ('callout', text)
#   ('table', [headers], [[cells], ...])
#   ('pagebreak',) ('cover',)
# ============================================================
CONTENT = [
    ('cover',),

    # ---------- 摘要 ----------
    ('h1', '摘要'),
    ('p', '思辩星球（DebateSphere）是一款以 MBTI 人格为身份入口、以 AI 多智能体为辩手与裁判、以实时辩论为核心交互的在线辩论平台。产品把知乎式的"静态问答沉淀"，升级为"动态实时交锋"——让每一次观点碰撞都能被评分、被记录、被沉淀为可传播的内容。'),
    ('callout', '一句话定位：人人都有的对手，场场都有的裁判。'),
    ('p', '本计划书围绕三条主线展开：'),
    ('bullets', [
        '核心思路 —— 以"人格降低表达门槛、辩论生产优质内容、AI 补齐对手与裁判"为三大支点，用四大场景覆盖从硬核辩理到轻松唠嗑的全部表达需求。',
        '技术方案 —— React + Express + SQLite 全栈架构，服务器权威的实时对战引擎，接入知乎直答大模型（fast / thinking / agent 三档）作为统一 AI 大脑，并以自建知识引擎把用户内容变成辩论素材。',
        '知乎生态契合度 —— 产品在价值观、内容形态、用户画像、AI 能力四个层面与知乎高度同构：知乎解决"有问题就有答案"，本产品解决"有分歧就有交锋"，二者共同构成中文互联网"观点生产 — 沉淀 — 再激发"的完整闭环。',
    ]),
    ('pagebreak',),

    # ---------- 一、产品概述 ----------
    ('h1', '一、产品概述'),
    ('h2', '1.1 一句话定义'),
    ('p', '思辩星球是一个"人人都有对手、场场都有裁判"的 AI 实时辩论平台：用户以 MBTI 人格作为身份，进入四大场景之一，与真人或 AI 就一个话题展开结构化实时辩论，结束后获得多维评分与个性化成长报告。'),
    ('h2', '1.2 产品定位'),
    ('table', ['维度', '内容'], [
        ['定位', '中文互联网的"动态观点场"'],
        ['一句话价值', '把"我想说、没处说、说了没人应"变成"随时开局、对手在线、观点被看见"'],
        ['形态', 'Web / Android / Windows 桌面，三端同源'],
        ['核心资产', '16 型人格身份 + AI 辩论引擎 + 结构化观点内容库'],
    ]),
    ('h2', '1.3 目标用户：三类人格族群 + 一类学习人群'),
    ('p', '相比于按年龄/地域划分，本产品按"表达动机"划分用户，这直接对应 MBTI 维度与产品能力：'),
    ('table', ['人群', '典型人格', '核心诉求', '本产品对应能力'], [
        ['表达型', 'ENFP / ENTP / ESFP', '我要舞台、要被看见', '脱口秀场景 · 实时对战 · 观点广场'],
        ['逻辑型', 'INTJ / INTP / ENTJ', '我要对手、要较真', '法律辩论 · PK 大师档 · 七维评分'],
        ['沉思型', 'INFP / ISFJ / ISTP', '低压力地表达与思考', '圆桌会谈 · 街头对谈 · 匿名参与'],
        ['学习型', '学生 / 备考人群', '想练表达、逻辑与口语', '语音输入 · 个性化训练计划 · 知识库'],
    ]),
    ('h2', '1.4 现状：v40.6 已上线能力矩阵'),
    ('table', ['模块', '能力', '状态'], [
        ['人格测试', '16 型 MBTI 完整测评 + 五维驱力刻画', '已上线'],
        ['人格引擎', '四层引擎：画像 / 驱力 / 演化 / 记忆', '已上线'],
        ['PK 实时对战', '服务器权威对战 + AI 三档对手 + 逐句发言', '已上线'],
        ['AI 裁判', '七维评分 + 个性化 7 天训练计划', '已上线'],
        ['四大场景', '法律辩论 / 圆桌会谈 / 脱口秀 / 街头对谈', '已上线'],
        ['知识引擎', '本地 RAG + 云端知识库 + 知乎源导入', '已上线'],
        ['语音输入', 'Web Speech API + HTTPS 3443 解锁麦克风', '已上线'],
        ['多端交付', 'Web / Android APK / Windows 桌面', '已上线'],
        ['社区广场', '发帖 / 评论 / 点赞 / 删除自己的内容', '已上线'],
        ['知乎生态', '直答 + 全网搜索 + 热榜 + 用户内容/收藏', '已实测接入'],
    ]),
    ('h2', '1.5 上线 90 天目标（示意）'),
    ('table', ['层级', '指标', '目标值'], [
        ['增长', '次日留存率', '≥ 35%'],
        ['参与', '周人均有效辩论场次', '≥ 3 场'],
        ['内容', '知乎源导入用户占比', '≥ 40%'],
        ['生态', '辩论报告 / 观点发布量', '周环比正增长'],
    ]),
    ('pagebreak',),

    # ---------- 二、核心思路 ----------
    ('h1', '二、核心思路'),
    ('h2', '2.1 出发点：中文用户"公开表达"的三道坎'),
    ('p', '用户研究观察显示，普通用户在"公开表达观点"这件事上，普遍卡在三道坎：'),
    ('nums', [
        '不敢说 —— 公开表达有社交压力，怕被喷、怕不专业、怕被贴标签。',
        '没人吵 —— 想认真辩一辩，身边却找不到旗鼓相当的对手。',
        '留不下 —— 在群聊、评论区吵完就散了，观点没有沉淀，也没有成长。',
    ]),
    ('p', '本产品的核心假设：如果为用户提供（a）一层人格化的身份面具、（b）一个永远在线的 AI 对手、（c）一次有评分、有结论的结构化交锋——那么公开表达的心理成本与内容成本都会显著下降。'),
    ('h2', '2.2 三个设计支点'),
    ('h3', '支点一 · 人格即身份 —— 解决"不敢说"'),
    ('p', 'MBTI 在这里不是标签，而是身份系统与动机系统。用户以人格作为化身，承担的是"人格立场"而非"个人立场"，心理负担大幅降低；人格色、头像、光晕构成完整的视觉身份，让表达更有归属感。人格还会随辩论历史确定性演化——它是活的，不是一次性的测试结果。'),
    ('h3', '支点二 · 辩论即内容 —— 解决"留不下"'),
    ('p', '一场辩论天然产出：立论、反驳、总结、裁判评分、金句。这些内容以结构化形式落库，可生成辩论报告、可发布到观点广场、可转化为知乎式内容。辩论由此不再是消耗，而是内容生产。'),
    ('h3', '支点三 · AI 即队友 —— 解决"没人吵"'),
    ('p', '全链路 AI 化：AI 可以当辩手（多智能体辩论）、当对手（PK 三档难度）、当裁判（七维评分）、当教练（个性化建议）。关键设计在于"真实感"——AI 发言逐句连发、观点表达完整后再进入下一阶段，追求"旗鼓相当的人在对话"，而不是一次性甩出模板。'),
    ('h2', '2.3 四大场景玩法'),
    ('p', '四个场景覆盖不同表达动机：从"硬核对抗"到"轻松闲聊"，用户总能找到当前心情对应的入口。每个场景配有专属目标、独立话题池（各 10 条兜底）与玩法提示；进入场景后，话题由 AI 结合知乎热榜实时生成。'),
    ('table', ['场景', '玩法', '模式', '目标', '话题示例'], [
        ['法律辩论 · 普法现场', '法官 + 控辩双方围绕真实法律议题交锋', '对抗', '把法律讲清楚', 'AI 生成内容是否受著作权法保护？'],
        ['圆桌会谈 · 哲思夜话', '没有正反方，围坐把一个大问题聊透', '自由（不分胜负）', '多元视角，不做裁决', '人生的意义是赋予的还是本来就有？'],
        ['脱口秀大会', '聚光灯下讲段子，幽默是唯一正义', '自由', '幽默表达，共鸣感', '大学生的钱到底是怎么没的？'],
        ['街头对谈 · 人间观察', '像街头采访一样闲聊，说人话、别端着', '自由', '接地气的真实对话', '合群与做自己，哪个更难？'],
    ]),
    ('h2', '2.4 产品闭环：每一场辩论都为下一场变强提供燃料'),
    ('p', '人格测评 → 匹配对手 → 结构化对战（立论 / 自由辩论 / 总结）→ AI 裁判七维评分 → 辩论报告 + 个性化训练计划 → 沉淀（观点广场 / 知识库）→ 再匹配。'),
    ('quote', '用户测评得到身份，对战得到反馈，报告得到成长，沉淀得到内容——四个环节首尾相接，构成可循环的参与动机。'),
    ('h2', '2.5 差异化定位'),
    ('table', ['维度', '传统论坛', '知乎', '微信群聊', '思辩星球'], [
        ['内容形态', '帖子+回复', '问答+文章', '碎片消息', '结构化辩论场'],
        ['交锋方式', '异步、易跑题', '异步、温和', '即时、无结构', '实时、分阶段'],
        ['参与门槛', '中', '高（需专业感）', '低（熟人压力）', '低（人格面具）'],
        ['即时反馈', '弱', '弱', '强但无沉淀', '强（评分+报告）'],
        ['对手供给', '不稳定', '—', '仅熟人', 'AI 永远在线'],
    ]),
    ('pagebreak',),

    # ---------- 三、技术方案 ----------
    ('h1', '三、技术方案'),
    ('h2', '3.1 总体架构'),
    ('p', '系统采用"客户端 — 接入 — 应用 — AI 能力 — 数据 — 基础设施"六层架构，各层职责单一、耦合清晰：'),
    ('table', ['层级', '组成', '职责'], [
        ['客户端层', 'Web（Vite/React18）、Android（Capacitor）、Windows（Electron）', '三端同源，共享一套业务逻辑与视觉系统'],
        ['接入层', 'Express + Socket.IO；HTTP 3001 / HTTPS 3443（自签 CA 可下载）', '请求路由、实时广播、HTTPS 解锁麦克风'],
        ['应用层', '人格引擎 / 辩论编排 / PK 房间 / 裁判评分 / 知识检索 / 社区', '承载全部业务逻辑，服务器权威'],
        ['AI 能力层', '知乎直答（fast / thinking / agent）+ 全网搜索 + 热榜 + 用户内容', '统一 AI 大脑与真实资料源'],
        ['数据层', 'SQLite（better-sqlite3, WAL）+ FTS5 全文索引 + 前端 IndexedDB', '持久化与检索'],
        ['基础设施', '阿里云 ECS（cn-hangzhou）+ systemd + 自动化部署链路', '稳定运行与可持续交付'],
    ]),
    ('h2', '3.2 技术栈'),
    ('table', ['领域', '选型'], [
        ['前端', 'React 18 · TypeScript · Vite · Tailwind · framer-motion'],
        ['服务端', 'Node.js · Express · better-sqlite3（WAL）· Socket.IO'],
        ['AI 能力', '知乎直答大模型（fast / thinking / agent）· 知乎全网搜索 · 热榜'],
        ['检索', '服务端 FTS5 + BM25；前端中文分词 + BM25 + IndexedDB'],
        ['实时', 'Socket.IO 房间广播（服务器权威计算 + 双端一致渲染）'],
        ['多端', 'Capacitor（Android APK）· Electron（Windows 便携版/安装版）'],
        ['部署', '阿里云 ECS · systemd · Cloud Assistant 自动化部署'],
    ]),
    ('h2', '3.3 AI 能力层（核心）'),
    ('h3', '3.3.1 统一 AI 大脑：知乎直答'),
    ('p', '平台所有 AI 能力统一走知乎直答，服务端持有凭证，前端零配置即可用，避免依赖用户自备 LLM Key。三档模型按场景调度：'),
    ('table', ['档位', '模型', '延迟', '适用场景'], [
        ['fast', 'zhida-fast-1p5', '< 2s', '赛中提示、快速补刀、初级/中级 AI 对手'],
        ['thinking', 'zhida-thinking-1p5', '5–15s', '赛后复盘、七维裁判、大师级 AI 对手'],
        ['agent', 'zhida-agent', '长', '资料组装、工具调用型复杂任务'],
    ]),
    ('h3', '3.3.2 四类 AI 角色'),
    ('bullets', [
        'AI 辩手 —— 多智能体辩论：审题 → 检索 → 立场 → 发言 → 裁判，思考链折叠展示、打字机流式输出。',
        'AI 对手 —— PK 房间中的反方辩友，三档难度自适应。',
        'AI 裁判 —— 七维评分（逻辑 30% / 论据 25% / 表达 20% / 反驳 15% / 风度 10% 等），输出结构化战报。',
        'AI 教练 —— 依据历史表现生成个性化 7 天训练计划与座右铭。',
    ]),
    ('h3', '3.3.3 PK 三档难度'),
    ('table', ['档位', '模型', '温度', '回复长度', '学习用户风格'], [
        ['初级 · 新手感', 'fast', '0.9', '≤ 150 字', '否'],
        ['中级 · 有套路', 'fast', '0.65', '≤ 200 字', '是（轻度）'],
        ['大师 · 强对抗', 'thinking', '0.45', '≤ 260 字', '是（深度）'],
    ]),
    ('h3', '3.3.4 发言节奏引擎（关键体验）'),
    ('p', '这是"像不像真人"的分水岭。系统不把 AI 的整段回复一次性倾倒，而是拆成"一句一句"地发：'),
    ('bullets', [
        '逐句拆分 —— 按换行与句末标点切分，超长句硬切，保证每句可读。',
        '阶段状态机 —— 立论（opening）→ 自由辩论（free_debate）→ 总结（closing）。',
        '节奏落库 —— 每约 1.1 秒落一条发言，观点全部表达完再交还回合、广播切换。',
        '三种触发 —— 开场（kickoff，AI 主动立论）、追问（poke，用户"请 AI 继续说"）、强制（force）。',
        '智能顺延 —— 倒计时到点且 AI 仍在发言时，自动切阶段并顺延，绝不打断。',
    ]),
    ('h3', '3.3.5 静默风格学习'),
    ('p', '从用户历史发言中提取语言特征（平均句长、反问频率、分点习惯、"所以/但是/换句话说"等推进词、Emoji 使用），生成"对方表达画像"注入 AI 提示词，让 AI 逐渐"像你"地对话——但立场仍是反方，保证对抗性。样本不足时自动不启用，避免过度拟合。'),
    ('h2', '3.4 人格引擎（四层）'),
    ('table', ['层级', '内容', '作用'], [
        ['画像层', '16 型 MBTI · 五维驱力（认知/情感/意志/社交/表达）', '定义人格是谁'],
        ['认知层', '信息处理 / 决策风格 / 说话风格 / 价值观 / 核心指令', '定义人格怎么想、怎么说'],
        ['演化层', '随辩论历史确定性演化', '让人格"活着"'],
        ['记忆层', '偏好 / 经历 / 关系沉淀', '让人格"记得你"'],
    ]),
    ('h2', '3.5 知识引擎（三源合一）'),
    ('table', ['来源', '技术实现', '用途'], [
        ['本地 RAG', '中文分词 + BM25 + IndexedDB（纯前端）', '个人文档 txt / md / docx / pdf'],
        ['云端知识库', '服务端 FTS5 + BM25', '知乎导入内容、新闻、共享资料'],
        ['每日新闻', '8+ RSS 源自动抓取 → 结构化入库', '辩论自动引用时事'],
    ]),
    ('quote', '闭环：用户收藏什么，AI 就学什么——下一场辩论时，AI 能引用你自己的知乎论点来反问你。'),
    ('h2', '3.6 实时对战架构'),
    ('bullets', [
        '服务器权威 —— 伤害与评分由服务端计算并广播，两端画面完全一致，杜绝作弊与不同步。',
        '房间广播 —— Socket.IO 推送回合切换与发言，前端仅做渲染。',
        'AI 影子用户 —— AI 以 ai__ 前缀的影分身身份参与发言流，与真人用户在同一条时间线上。',
        '防重入 —— 发言队列带 busy 标志，避免 AI 重复开场或并发发言。',
    ]),
    ('h2', '3.7 语音与多端'),
    ('p', '语音输入基于 Web Speech API 实时转写，支持连续识别与中间结果；针对浏览器"非安全上下文禁用麦克风"的限制，服务端内置 HTTPS（3443 端口）并对外提供 CA 证书下载，手机安装信任后即可解锁麦克风。三端交付：Web、Android（APK 可装）、Windows（桌面端）。'),
    ('h2', '3.8 数据模型（核心表）'),
    ('table', ['数据域', '核心表', '说明'], [
        ['账号', 'users', 'MBTI 类型、角色、封禁状态'],
        ['辩论会话', 'sessions / messages', '话题、场景、参与人格、发言记录'],
        ['社区', 'posts / comments / likes', '观点广场内容与互动'],
        ['人格库', 'personality_profiles / few_shot_examples', '五层人格知识与示例'],
        ['实时对战', 'pk_rooms / pk_moves', '房间状态、阶段、逐条发言'],
        ['风格学习', 'ai_learner_styles', '静默表达画像统计'],
        ['实力分', 'rating / pet_dim_history', '匹配分与维度成长轨迹'],
    ]),
    ('h2', '3.9 安全与合规'),
    ('bullets', [
        '凭证隔离 —— 知乎 Access Secret 仅存于服务端 .env，前端永远接触不到。',
        '服务端代理 —— 所有第三方调用经服务端转发，Bearer 鉴权 + 时间戳 + RPM 限流（默认 60/分钟）。',
        '权限校验 —— JWT 鉴权；删除接口校验 user_id，非本人返回 403；用户只能操作自己的内容。',
        'OAuth 透传 —— 用户侧接口兼容 X-OAuth-Token，普通用户只能读取"本人或经授权的公开数据"。',
        '降级透明 —— 未配置凭证时接口返回 503 并给出明确提示，前端优雅降级，不静默失败。',
        '敏感文件不入库 —— 数据库、证书、签名密钥库均在 .gitignore 中。',
    ]),
    ('h2', '3.10 部署与运维（阿里云）'),
    ('p', '生产环境部署于阿里云 ECS（cn-hangzhou），以 systemd 常驻，同时开放 HTTP 3001 与 HTTPS 3443。后端提供自动化部署链路：打包 → 分段上传 → 服务器拼接 → 解压 → 重启 → 自检，实现"一条命令完成整包发布"。'),
    ('h2', '3.11 关键技术取舍'),
    ('table', ['决策', '取舍', '理由'], [
        ['SQLite 而非 PostgreSQL', '牺牲并发上限', '单机轻量、零运维、WAL 模式足以支撑验证期规模'],
        ['自签 HTTPS 而非公网证书', '需引导用户信任证书', '内测期以最低成本快速解锁麦克风'],
        ['逐句连发而非整段输出', '单场总时长略增', '真实感优先，是本产品体验的核心差异点'],
        ['缺凭证即降级 503', '功能不可用', '透明可诊断，避免静默失败带来的排查成本'],
        ['服务器权威计算', '服务端压力略增', '保证多端一致与防作弊，是实时对战的地基'],
    ]),
    ('pagebreak',),

    # ---------- 四、知乎生态契合度 ----------
    ('h1', '四、与知乎生态的契合度'),
    ('h2', '4.1 战略契合：同源的价值主张'),
    ('table', ['对标', '价值主张', '本质'], [
        ['知乎', '"有问题，就会有答案"', '知识的沉淀与分享'],
        ['思辩星球', '"有分歧，就会有交锋"', '观点的碰撞与激发'],
    ]),
    ('p', '二者不是竞争关系，而是上下游：知乎沉淀结论，本产品生产交锋。辩论产出的高质量观点——有立场、有论据、有反驳——恰恰是知乎最稀缺的"有理有据的回答"。'),
    ('h2', '4.2 能力契合：已接入的知乎能力（真实落地）'),
    ('table', ['知乎能力', '平台落地', '价值'], [
        ['直答大模型', '全站 AI 大脑（辩手 / 对手 / 裁判 / 教练）', '免配置接入中文一流 LLM'],
        ['全网搜索', '辩论大师"赛前资料包"', '论据从骨架升级为真实数据'],
        ['热榜', '每日热问 + 一键转辩题', '内容与热点实时同步'],
        ['用户内容', '一键导入知识库', '把"我的回答"变成 AI 素材'],
        ['用户收藏', '批量导入知识库', '收藏什么，AI 就学什么'],
        ['收藏夹', '按类目批量导入', '结构化知识管理'],
    ]),
    ('callout', '接入原则：凭证永不出服务端，前端只与自家代理对话；未配置时全链路优雅降级、不破坏任何既有功能。'),
    ('h2', '4.3 内容契合：内容形态的天然映射'),
    ('table', ['知乎内容形态', '思辩星球对应物', '关系'], [
        ['回答', '一篇辩论报告 / 一次立论', '同构'],
        ['想法', '街头对谈 / 脱口秀金句', '同构'],
        ['圆桌', '圆桌会谈场景', '同名同构'],
        ['热榜', 'AI 实时命题来源', '上游'],
        ['收藏夹', 'AI 知识库语料', '上游'],
    ]),
    ('h2', '4.4 用户契合'),
    ('p', '知乎核心用户画像——高学历、爱表达、重逻辑、认同"理性讨论"——与本产品"表达型 / 逻辑型 / 沉思型"三类人群高度重合。用户从知乎带着"我想说点什么"的动机来到本平台，交锋后再把结论带回知乎，形成天然的双向通路。'),
    ('h2', '4.5 流量与内容闭环'),
    ('p', '知乎热榜 / 问题 → AI 生成辩题 → 用户在平台实时交锋 → 高质量内容沉淀为辩论报告 → 以知乎式内容形态回流（回答 / 想法）→ 反哺知乎话题热度。整条链路让两个平台互相供给"话题"与"内容"。'),
    ('h2', '4.6 互补性分析'),
    ('table', ['维度', '知乎', '思辩星球', '关系'], [
        ['内容时序', '静态沉淀', '动态实时', '互补'],
        ['交互形态', '单向问答', '双向交锋', '互补'],
        ['用户角色', '读者 / 答主', '辩手 / 裁判', '递进'],
        ['AI 价值', '辅助检索与生成', '主动参与对抗', '延伸'],
        ['时间成本', '分钟级阅读', '秒级互动', '覆盖不同场景'],
    ]),
    ('h2', '4.7 契合度自评'),
    ('table', ['维度', '契合度', '说明'], [
        ['价值观', '★★★★★  5/5', '"理性讨论、观点交锋"高度同源'],
        ['AI 能力', '★★★★★  5/5', '直答三档已实测接入并驱动全站 AI'],
        ['技术接口', '★★★★★  5/5', '已打通 6 类知乎 API，纯加法、无侵入'],
        ['内容形态', '★★★★☆  4/5', '回答/想法/圆桌天然映射，视频形态待补'],
        ['用户画像', '★★★★☆  4/5', '核心人群重合度高，需扩大下沉覆盖'],
        ['商业化', '★★★☆☆  3/5', '合作路径清晰，但变现模型待验证'],
        ['综合', '★★★★☆  4.3 / 5', '生态契合度整体高，技术侧已具备落地条件'],
    ]),
    ('h2', '4.8 深化合作设想'),
    ('bullets', [
        '账号互通 —— 知乎账号一键登录，人格档案与身份同步。',
        '内容双发 —— 辩论报告一键发布为知乎回答/想法，并带平台署名。',
        '官方大脑 —— 知乎直答作为"官方推荐辩手"入驻，强化品牌心智。',
        '联合运营 —— 基于知乎热榜的辩题挑战赛、圆桌共创。',
        '数据反哺 —— 优质辩论观点结构化回流知乎问题页，抬高问答深度。',
    ]),
    ('pagebreak',),

    # ---------- 五、路线图 ----------
    ('h1', '五、路线图与里程碑'),
    ('table', ['阶段', '周期', '重点', '交付里程碑'], [
        ['近期', '0–3 个月', '四大场景体验打磨、PK 稳定性、知乎源普及', '对话真实感达标、知乎源导入率 ≥ 40%'],
        ['中期', '3–6 个月', '真人实时语音房（WebRTC）、实力分匹配、账号互通', '真人实时对战上线、匹配分体系成型'],
        ['远期', '6–12 个月', '内容双发闭环、AI 教练体系、开放辩论 API', '与知乎内容双向回流、开放平台雏形'],
    ]),

    # ---------- 六、成功指标 ----------
    ('h1', '六、成功指标'),
    ('callout', '北极星指标：每周有效辩论场次（用户真正完成一次"立论—交锋—总结"的完整对决）。'),
    ('table', ['层级', '指标', '意义'], [
        ['用户体验', '次日留存 / 完赛率 / AI 发言满意度', '产品是否留住人、体验是否真实'],
        ['内容', '内容产出量 / 知乎源导入率 / 内容回流率', '辩论是否真的生产了内容'],
        ['生态', '知乎 API 调用健康度 / 跨平台用户占比', '与知乎生态的耦合深度'],
    ]),

    # ---------- 七、风险 ----------
    ('h1', '七、风险评估与对策'),
    ('table', ['风险', '影响', '对策'], [
        ['知乎 API 限流', 'AI 发言延迟或失败', '退避重试 + 失败降级 fast + 结果缓存'],
        ['AI 内容质量与合规', '内容不可控、存在风险', '敏感词过滤 + 审核 + 人工兜底'],
        ['用户冷启动', '开局找不到对手', 'AI 永远在线兜底 + 热榜命题降低选题门槛'],
        ['多端一致性', '体验割裂、状态不同步', '服务器权威 + 单一数据源 + 统一协议'],
        ['隐私与合规', '数据安全与信任危机', '凭证服务端隔离、最小权限、支持删除自己的内容'],
    ]),

    # ---------- 附录 ----------
    ('h1', '附录 A · 已落地的知乎接入接口'),
    ('table', ['端点', '对应知乎能力', '用途'], [
        ['GET  /api/zhihu/status', '—', '查看启用状态与模型配置'],
        ['GET  /api/zhihu/search', '全网搜索', '辩论资料检索'],
        ['POST /api/zhihu/chat', '直答大模型', '统一 AI 生成（支持流式）'],
        ['GET  /api/zhihu/hotlist', '热榜', '今日热问 / 一键转辩题'],
        ['GET  /api/zhihu/user/contents', '用户内容', '导入我的回答 / 文章'],
        ['GET  /api/zhihu/user/collections', '用户收藏', '导入我的收藏'],
        ['GET  /api/zhihu/user/favlists', '收藏夹列表', '按类目浏览收藏夹'],
        ['GET  /api/zhihu/favlist-contents', '收藏夹内容', '批量导入某个收藏夹'],
        ['POST /api/zhihu/import-to-kb', '（自建）', '转码为知识库上传载荷'],
    ]),
    ('h1', '附录 B · 术语表'),
    ('table', ['术语', '含义'], [
        ['MBTI', '迈尔斯-布里格斯类型指标，16 型人格分类'],
        ['RAG', '检索增强生成，先检索资料再让模型生成'],
        ['FTS5', 'SQLite 全文检索扩展'],
        ['BM25', '一种经典的相关性排序算法'],
        ['RPM', '每分钟请求数（速率限制单位）'],
        ['SSE', '服务器推送事件，用于流式输出'],
        ['七维评分', '逻辑 / 论据 / 修辞 / 策略 / 表达 / 风度 / 伦理'],
        ['服务器权威', '关键计算在服务端完成，客户端仅渲染'],
    ]),
]


# ============================================================
# Word renderer
# ============================================================
def _rfonts(run, ascii_font, ea_font):
    rPr = run._element.get_or_add_rPr()
    rf = rPr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rPr.insert(0, rf)
    rf.set(qn('w:ascii'), ascii_font)
    rf.set(qn('w:hAnsi'), ascii_font)
    rf.set(qn('w:eastAsia'), ea_font)
    rf.set(qn('w:cs'), ascii_font)


def style_run(run, size=10.5, bold=False, color=INK, italic=False, font=EN, ea=CN):
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    _rfonts(run, font, ea)


def shade_cell(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill)
    tcPr.append(shd)


def set_cell_margins(table, top=60, bottom=60, left=100, right=100):
    tblPr = table._tbl.tblPr
    mar = OxmlElement('w:tblCellMar')
    for tag, val in (('top', top), ('left', left), ('bottom', bottom), ('right', right)):
        el = OxmlElement('w:' + tag)
        el.set(qn('w:w'), str(val))
        el.set(qn('w:type'), 'dxa')
        mar.append(el)
    tblPr.append(mar)


def table_borders(table, color=BORDER, sz=6):
    tblPr = table._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement('w:' + edge)
        el.set(qn('w:val'), 'single')
        el.set(qn('w:sz'), str(sz))
        el.set(qn('w:space'), '0')
        el.set(qn('w:color'), color)
        borders.append(el)
    tblPr.append(borders)


def para_spacing(p, before=0, after=6, line=1.5):
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    return p


def add_page_number(paragraph):
    run = paragraph.add_run()
    style_run(run, size=8.5, color=MUTED, font=EN)
    f1 = OxmlElement('w:fldChar'); f1.set(qn('w:fldCharType'), 'begin')
    it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = 'PAGE'
    f2 = OxmlElement('w:fldChar'); f2.set(qn('w:fldCharType'), 'end')
    run._r.append(f1); run._r.append(it); run._r.append(f2)


def build_docx():
    doc = Document()

    # default style
    normal = doc.styles['Normal']
    normal.font.name = EN
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    rpr = normal.element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rpr.insert(0, rf)
    rf.set(qn('w:ascii'), EN); rf.set(qn('w:hAnsi'), EN)
    rf.set(qn('w:eastAsia'), CN)

    sec = doc.sections[0]
    sec.top_margin = Cm(2.2); sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.2); sec.right_margin = Cm(2.2)

    # footer page number
    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_page_number(fp)

    first_heading = {'v': True}

    for block in CONTENT:
        kind = block[0]

        if kind == 'cover':
            # top brand
            p = doc.add_paragraph()
            para_spacing(p, before=90, after=4, line=1.0)
            r = p.add_run('◉ 思辩星球  DebateSphere')
            style_run(r, size=12, bold=True, color=ACCENT2)

            p = doc.add_paragraph()
            para_spacing(p, before=40, after=2, line=1.0)
            r = p.add_run('产品说明计划书')
            style_run(r, size=34, bold=True, color=INK)

            p = doc.add_paragraph()
            para_spacing(p, before=0, after=10, line=1.15)
            r = p.add_run('MBTI 人格 × AI 实时辩论 × 知乎生态')
            style_run(r, size=15, bold=False, color=ACCENT)

            # accent rule
            p = doc.add_paragraph()
            para_spacing(p, before=2, after=14, line=1.0)
            r = p.add_run('─' * 34)
            style_run(r, size=10, color=ACCENT2)

            p = doc.add_paragraph()
            para_spacing(p, before=0, after=4, line=1.3)
            r = p.add_run('让每一种人格，都成为一颗星球。')
            style_run(r, size=12, italic=True, color=INK2)

            p = doc.add_paragraph()
            para_spacing(p, before=120, after=0, line=1.6)
            for line in ['文档版本：v1.0', '编制日期：2026 年 9 月', '文档密级：内部资料']:
                r = p.add_run(line + '\n')
                style_run(r, size=10, color=MUTED)
            doc.add_page_break()
            continue

        if kind == 'pagebreak':
            doc.add_page_break()
            first_heading['v'] = True
            continue

        if kind == 'h1':
            if not first_heading['v']:
                doc.add_page_break()
            first_heading['v'] = False
            p = doc.add_paragraph()
            para_spacing(p, before=0, after=10, line=1.15)
            r = p.add_run(block[1])
            style_run(r, size=19, bold=True, color=INK)
            # bottom rule
            pPr = p._p.get_or_add_pPr()
            pbdr = OxmlElement('w:pBdr')
            bottom = OxmlElement('w:bottom')
            bottom.set(qn('w:val'), 'single'); bottom.set(qn('w:sz'), '12')
            bottom.set(qn('w:space'), '6'); bottom.set(qn('w:color'), '4338CA')
            pbdr.append(bottom); pPr.append(pbdr)
            continue

        if kind == 'h2':
            p = doc.add_paragraph()
            para_spacing(p, before=12, after=5, line=1.2)
            r = p.add_run(block[1])
            style_run(r, size=14, bold=True, color=ACCENT)
            continue

        if kind == 'h3':
            p = doc.add_paragraph()
            para_spacing(p, before=8, after=4, line=1.2)
            r = p.add_run(block[1])
            style_run(r, size=12, bold=True, color=INK)
            continue

        if kind == 'p':
            p = doc.add_paragraph()
            para_spacing(p, before=0, after=7, line=1.55)
            r = p.add_run(block[1])
            style_run(r, size=10.5, color=INK2)
            continue

        if kind in ('bullets', 'nums'):
            for i, item in enumerate(block[1]):
                p = doc.add_paragraph()
                para_spacing(p, before=0, after=4, line=1.5)
                p.paragraph_format.left_indent = Cm(0.75)
                p.paragraph_format.first_line_indent = Cm(-0.42)
                mark = ('•  ' if kind == 'bullets' else '%d.  ' % (i + 1))
                r = p.add_run(mark)
                style_run(r, size=10.5, bold=True, color=ACCENT2)
                r2 = p.add_run(item)
                style_run(r2, size=10.5, color=INK2)
            continue

        if kind == 'quote':
            p = doc.add_paragraph()
            para_spacing(p, before=4, after=8, line=1.5)
            p.paragraph_format.left_indent = Cm(0.5)
            pPr = p._p.get_or_add_pPr()
            pbdr = OxmlElement('w:pBdr')
            left = OxmlElement('w:left')
            left.set(qn('w:val'), 'single'); left.set(qn('w:sz'), '18')
            left.set(qn('w:space'), '8'); left.set(qn('w:color'), '0891B2')
            pbdr.append(left); pPr.append(pbdr)
            r = p.add_run(block[1])
            style_run(r, size=10.5, italic=True, color=INK2)
            continue

        if kind == 'callout':
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            table_borders(tbl, color='BAE6FD', sz=4)
            set_cell_margins(tbl, top=100, bottom=100, left=160, right=140)
            c = tbl.cell(0, 0)
            shade_cell(c, 'ECFEFF')
            c.text = ''
            p = c.paragraphs[0]
            para_spacing(p, before=0, after=0, line=1.45)
            r = p.add_run(block[1])
            style_run(r, size=10.5, bold=True, color=RGBColor(0x0E, 0x74, 0x90))
            # spacing after callout
            sp = doc.add_paragraph(); para_spacing(sp, before=0, after=0, line=1.0)
            continue

        if kind == 'table':
            headers, rows = block[1], block[2]
            ncol = len(headers)
            tbl = doc.add_table(rows=1, cols=ncol)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            table_borders(tbl)
            set_cell_margins(tbl)
            # header
            for j, htext in enumerate(headers):
                c = tbl.cell(0, j)
                shade_cell(c, H_FILL)
                c.text = ''
                p = c.paragraphs[0]
                para_spacing(p, before=1, after=1, line=1.2)
                r = p.add_run(htext)
                style_run(r, size=9.5, bold=True, color=WHITE)
            # body
            for i, row in enumerate(rows):
                cells = tbl.add_row().cells
                for j in range(ncol):
                    c = cells[j]
                    if i % 2 == 1:
                        shade_cell(c, Z_FILL)
                    c.text = ''
                    p = c.paragraphs[0]
                    para_spacing(p, before=1, after=1, line=1.3)
                    r = p.add_run(row[j] if j < len(row) else '')
                    style_run(r, size=9.5, color=INK2, bold=(j == 0))
            sp = doc.add_paragraph(); para_spacing(sp, before=0, after=2, line=1.0)
            continue

    doc.save(DOCX_PATH)
    return DOCX_PATH


# ============================================================
# HTML renderer
# ============================================================
def esc(t):
    return H.escape(t)


def build_html():
    css = """
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { margin:0; background:#eef1f6; color:#1e293b;
      font-family:"Segoe UI","Microsoft YaHei","微软雅黑",-apple-system,sans-serif;
      font-size:14px; line-height:1.7; }
    .page { max-width:820px; margin:0 auto; background:#fff; padding:56px 60px 72px;
      box-shadow:0 10px 40px rgba(15,23,42,.10); }
    .cover { min-height:960px; display:flex; flex-direction:column; justify-content:center; padding:60px 0; }
    .brand { color:#0891b2; font-weight:700; font-size:15px; letter-spacing:.5px; }
    h1.title { font-size:44px; font-weight:800; letter-spacing:-1px; margin:26px 0 10px; color:#0f172a; }
    .subtitle { font-size:19px; color:#4338ca; font-weight:600; margin-bottom:18px; }
    .rule { height:4px; width:120px; background:linear-gradient(90deg,#4338ca,#0891b2); border-radius:3px; margin:0 0 22px; }
    .tagline { font-size:17px; color:#475569; font-style:italic; }
    .meta { margin-top:120px; color:#64748b; font-size:13px; line-height:2; }
    h1 { font-size:25px; font-weight:800; color:#0f172a; margin:44px 0 16px; padding-bottom:10px;
      border-bottom:2.5px solid #4338ca; letter-spacing:-.4px; page-break-after:avoid; }
    h2 { font-size:18px; font-weight:700; color:#4338ca; margin:28px 0 10px; page-break-after:avoid; }
    h3 { font-size:15px; font-weight:700; color:#1e293b; margin:20px 0 8px; page-break-after:avoid; }
    p { margin:0 0 12px; color:#475569; }
    ul,ol { margin:0 0 14px; padding-left:22px; }
    li { margin-bottom:6px; color:#475569; }
    blockquote { margin:14px 0; padding:6px 0 6px 16px; border-left:3px solid #0891b2;
      color:#475569; font-style:italic; }
    .callout { background:#ecfeff; border:1px solid #bae6fd; border-radius:10px; padding:14px 18px;
      margin:14px 0; color:#0e7490; font-weight:600; }
    table { width:100%; border-collapse:collapse; margin:14px 0 20px; font-size:13px; page-break-inside:avoid; }
    th { background:#1e293b; color:#fff; text-align:left; padding:9px 12px; font-weight:600; font-size:12.5px; }
    td { padding:8px 12px; border-bottom:1px solid #cbd5e1; color:#475569; vertical-align:top; }
    td:first-child { color:#1e293b; font-weight:600; }
    tbody tr:nth-child(even) td { background:#f1f5f9; }
    .sec { page-break-before:always; }
    .foot { margin-top:40px; padding-top:14px; border-top:1px solid #e2e8f0;
      color:#94a3b8; font-size:12px; text-align:center; }
    @media print { body{background:#fff;} .page{box-shadow:none; margin:0; max-width:none; padding:0;} }
    """
    out = ['<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">',
           '<meta name="viewport" content="width=device-width, initial-scale=1">',
           '<title>产品说明计划书 · 思辩星球 DebateSphere</title>',
           '<style>%s</style></head><body><div class="page">' % css]

    for block in CONTENT:
        k = block[0]
        if k == 'cover':
            out.append('<div class="cover">'
                       '<div class="brand">◉ 思辩星球 &nbsp;DebateSphere</div>'
                       '<h1 class="title">产品说明计划书</h1>'
                       '<div class="subtitle">MBTI 人格 × AI 实时辩论 × 知乎生态</div>'
                       '<div class="rule"></div>'
                       '<div class="tagline">让每一种人格，都成为一颗星球。</div>'
                       '<div class="meta">文档版本：v1.0<br>编制日期：2026 年 9 月<br>文档密级：内部资料</div>'
                       '</div>')
        elif k == 'pagebreak':
            out.append('<div class="sec"></div>')
        elif k == 'h1':
            out.append('<h1>%s</h1>' % esc(block[1]))
        elif k == 'h2':
            out.append('<h2>%s</h2>' % esc(block[1]))
        elif k == 'h3':
            out.append('<h3>%s</h3>' % esc(block[1]))
        elif k == 'p':
            out.append('<p>%s</p>' % esc(block[1]))
        elif k == 'bullets':
            out.append('<ul>' + ''.join('<li>%s</li>' % esc(x) for x in block[1]) + '</ul>')
        elif k == 'nums':
            out.append('<ol>' + ''.join('<li>%s</li>' % esc(x) for x in block[1]) + '</ol>')
        elif k == 'quote':
            out.append('<blockquote>%s</blockquote>' % esc(block[1]))
        elif k == 'callout':
            out.append('<div class="callout">%s</div>' % esc(block[1]))
        elif k == 'table':
            headers, rows = block[1], block[2]
            th = ''.join('<th>%s</th>' % esc(x) for x in headers)
            tb = ''.join('<tr>' + ''.join('<td>%s</td>' % esc(c) for c in r) + '</tr>' for r in rows)
            out.append('<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (th, tb))

    out.append('<div class="foot">思辩星球 DebateSphere · 产品说明计划书 v1.0 · 2026-09 · 内部资料</div>')
    out.append('</div></body></html>')

    with io.open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    return HTML_PATH


if __name__ == '__main__':
    d = build_docx()
    h = build_html()
    print('DOCX:', d, os.path.getsize(d), 'bytes')
    print('HTML:', h, os.path.getsize(h), 'bytes')
