# v28 变更总览：辩论质量提升 + 对话模式

## 一句话总结
基于用户提供的两份设计文档，为辩论平台新增了「思维框架 + 思考链 CoT + 策略工具箱 + 好辩论示例库」提升辩论质量，并新增了与辩论模式并列的「对话模式」——倾听→回应→邀请三层结构，16 人格对话风格差异化，无裁判无胜负。

---

## Phase 1：辩论质量提升（文件2）

### 核心理念
不教规则教思维框架——AI 套规则而非真辩论，因为大语言模型本质是模式匹配不是逻辑推理。

### 新增文件

#### `client/src/data/debateExamples.ts`（新建）
- 精选 8 组好辩论示例，覆盖 8 种策略：
  - AI 权利（反例攻击）— INTP vs ISTJ
  - 效率 vs 体验（框架转移）— ENTJ vs ENFP
  - 结果公平 vs 机会公平（前提质疑）— ENFJ vs ISTP
  - 算法推荐（隐假设）— INFJ vs ENTP
  - 加班文化（概念解构）— ISTJ vs INFJ
  - AI 陪伴（模拟 vs 体验）— INTP vs ESFJ
  - 死亡与意义（路径 vs 终点）— INFP vs INTJ
  - 天赋 vs 努力（乘数 vs 加数）— ENTJ vs INFP
- 接口：`DebateExample { id, topic, field, strategy[], types[], rounds[], takeaway }`
- 匹配函数：`findExamplesForTopic(topic, limit)` — 按关键词匹配示例

### 改造文件

#### `client/src/utils/debatePrompts.ts`（叠加增强）
新增四个模块（在立场宣言之后、人格系统提示词之前）：

1. **`DEBATE_QUALITY_FRAMEWORK`** — 好/烂辩论对比 + 三问自检
   - 好辩论 vs 烂辩论对照表（5 个维度：攻击方式/逻辑/前提/情绪/结束）
   - 发言前三问：① 我在攻击什么？② 我的依据是什么？③ 对方最可能的反驳？
   
2. **`DEBATER_STRATEGY_TOOLBOX`** — 5 策略工具箱
   - 攻击依据、攻击逻辑、攻击前提、重新定义问题、举反例
   - 每策略含适用场景 + 示例句式

3. **`COT_FORMAT_RULE`** — 思考链格式要求
   - 强制输出格式：`【思考】...【发言】...`
   - 思考部分：分析对方弱点 + 选择策略 + 预判反斥
   - 发言部分：直接辩论内容

4. **`buildExampleSection(topic)`** — 按辩题匹配示例注入
   - 调用 `findExamplesForTopic` 取匹配示例
   - 格式化为例示文本注入系统提示词

**接入点**：
- `buildPersonaSystemPrompt`：在 `buildHotTopicSection` 之后叠加 `buildExampleSection` + `DEBATE_QUALITY_FRAMEWORK` + `DEBATER_STRATEGY_TOOLBOX`
- `buildSpeechMessages`：user 消息末尾追加 `COT_FORMAT_RULE`

#### `client/src/utils/debateArena.ts`（CoT 解析）
- `ArenaSpeech` 接口新增 `thinking?: string` 字段
- 新增 `parseCoT(rawText)` 函数：按 `【思考】`/`【发言】` 标签分离 LLM 输出
- `generateArenaSpeech`：LLM 响应经 `parseCoT` 解析后，思考存 `thinking`、发言存 `content`

#### `client/src/components/ChatMessage.tsx`（思考链展示）
- 新增 `thinking?` 字段到 `Message` 类型（`types/index.ts`）
- `ChatMessage` 组件新增可折叠思考链区域：
  - 🧠 图标 + "思考过程" 文字 + 展开/折叠箭头
  - 展开后显示思考内容（浅色、等宽字体、左边框）
  - `framer-motion` 动画展开/折叠

#### `client/src/components/DebateRoom.tsx`（流式思考链）
- `onBotMessage` 签名加 `thinking?` 参数
- 流式输出初始化时 `thinking` 一并传入 `streamingMessage`
- 思考链存在时先停 800ms 展示思考，再打字机输出发言
- 流式消息渲染时 `thinking` 传入 `ChatMessage`

#### `client/src/App.tsx`（传递 thinking）
- `handleBotMessage` 签名加 `thinking?` 参数，传入 `Message` 对象

---

## Phase 2：对话模式（文件1）

### 核心理念
1v1 对话而非辩论——倾听→回应→邀请三层结构，16 人格对话风格全方位差异化，无裁判无胜负，立场可流动。

### 新增文件

#### `client/src/data/dialogueMode.ts`（新建）
完整对话模式系统：

1. **`DIALOGUE_CORE_RULES`** — 对话核心规则
   - 三层结构：倾听 → 回应 → 邀请
   - 高质量对话 5 特征
   - 禁止 5 件事（用"但是"开头、试图击败、抽象回应情感、独白、翻译成"你应该"）

2. **`DIALOGUE_STYLES`** — 16 人格对话风格表
   - 每人格 5 维度：说话节奏 / 常用句式 / 情绪表达 / 提问方式 / 倾听风格
   - 例：INTJ「慢、有停顿、精简」/ ENFP「快、发散、带感叹」/ ISFP「慢、感性、带画面」

3. **`DIALOGUE_EXAMPLES`** — 5 组 few-shot 对话示例
   - D1 深夜情绪（INTJ）、D2 人生迷茫（INFP）、D3 人际冲突（ENFJ）、D4 自我接纳（ISFP）、D5 职业倦怠（INTP）

4. **`buildDialogueSystemPrompt(typeId)`** — 组装系统提示词
   = 人格基础信息 + 对话核心规则 + 风格指令 + few-shot 示例

5. **`buildDialogueMessages(ctx)`** — 组装消息序列（system + history + user）

6. **`buildDialogueFallback(typeId, typeName, userMessage)`** — 本地兜底

### 改造文件

#### `client/src/types/index.ts`
- `DebateMode` 类型新增 `'dialogue'`
- `Message` 接口新增 `thinking?: string`

#### `client/src/data/debateModes.ts`
- 新增对话模式配置：`id: 'dialogue', name: '对话模式', emoji: '💬'`
  - `turnStyle: 'interruptible'`, `maxRounds: 30`
  - `specialRules`: 三层结构/无裁判无胜负/立场可流动/16人格风格差异化/先回应情绪再回应内容

#### `client/src/components/DebateRoom.tsx`
- 新增 imports：`chatCompletion`, `buildDialogueMessages`, `buildDialogueFallback`
- `startBotRound` 顶部插入对话模式分支：
  - 检测 `debateMode === 'dialogue'`
  - 取第一个选中人格作为对话对象
  - 从 `messagesRef` 提取最近对话历史
  - LLM 优先调用 `buildDialogueMessages` + `chatCompletion`，失败用 `buildDialogueFallback`
  - 打字机流式输出
  - 不自动续聊——等用户发下一条消息
- `handleSend`：对话模式不设 `autoOn`，仅触发一次 `startBotRound`
- 裁判按钮：对话模式隐藏（`debateMode !== 'dialogue'`）
- 续辩按钮（RotateCcw）：对话模式隐藏
- 输入框 placeholder：对话模式显示「分享你的想法或感受，TA 会倾听并回应你」

---

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `data/debateExamples.ts` | 新建 | 8 组好辩论示例库 + 匹配函数 |
| `data/dialogueMode.ts` | 新建 | 对话核心规则 + 16 人格风格表 + few-shot + 构建函数 |
| `data/debateModes.ts` | 修改 | 新增 dialogue 模式配置 |
| `utils/debatePrompts.ts` | 修改 | 叠加思维框架 + CoT + 策略工具箱 + 示例注入 |
| `utils/debateArena.ts` | 修改 | ArenaSpeech 加 thinking + parseCoT 解析 |
| `types/index.ts` | 修改 | DebateMode 加 dialogue + Message 加 thinking |
| `components/ChatMessage.tsx` | 修改 | 可折叠思考链展示 |
| `components/DebateRoom.tsx` | 修改 | 对话模式分支 + 隐藏裁判/续辩 + 流式思考链 |
| `App.tsx` | 修改 | handleBotMessage 传递 thinking |

## 验证
- `npx tsc -b --force --noEmit` → EXIT 0，零错误
- `npx vite build` → ✓ built in 14.85s，零警告
- `Gradle assembleDebug + assembleRelease` → BUILD SUCCESSFUL in 3m 20s，215 tasks
- `test-arena-v28.ts` 纯函数测试 → 7/7 全部 ✅

## 测试结果（test-arena-v28.ts）
| 测试项 | 验证内容 | 结果 |
|--------|---------|------|
| 1.1 好辩论示例匹配 | findExamplesForTopic 匹配 3 组 | ✅ |
| 1.2 CoT 思考链解析 | parseCoT 分离思考+发言，策略关键词检测 | ✅ |
| 1.3 对话模式提示词 | buildDialogueSystemPrompt 含规则+风格+示例 | ✅ |
| 1.4 对话模式消息构建 | buildDialogueMessages 系统+用户消息完整 | ✅ |
| 1.5 对话模式本地兜底 | buildDialogueFallback 非空回复 | ✅ |
| 1.6 辩论提示词含框架 | 5785 字符，含思维框架+策略+示例 | ✅ |
| 1.7 CoT 格式指令注入 | buildSpeechMessages user 消息含【思考】【发言】 | ✅ |

> LLM 实测（Part 2）需配置 `DS_API_KEY` 环境变量后运行 `npm run test:arena:v28`

## APK 交付
- `mbti-debate-v28-debug.apk` — 7.5 MB（调试版，含调试日志）
- `mbti-debate-v28-release.apk` — 6.2 MB（签名发布版）
- 交付位置：`D:\mbti-debate-platform\` 根目录 + `artifacts\` 子目录

## 桌面 exe 交付
- `MBTI人格辩论平台v28-便携版.exe` — 69 MB（portable 单文件，双击即运行）
- Electron 31.7.7 + electron-builder 24.13.3 打包
- 交付位置：桌面 + `D:\mbti-debate-platform\` 根目录
- 旧版已移至 `D:\mbti-debate-platform\trash\`（可恢复）

## 使用方式

### 辩论质量提升
1. 在设置页开启「顶尖辩手模式」+ 配置 LLM
2. 选择辩题和人格，开始辩论
3. LLM 发言时自动输出【思考】+【发言】
4. 思考部分在发言卡片上方折叠展示（🧠 图标可展开）
5. 系统提示词已注入好/烂对比、策略工具箱、匹配示例

### 对话模式
1. 在辩论室顶部模式选择器点击 💬（对话模式）
2. 选择一个人格（取第一个选中人格作为对话对象）
3. 输入消息发送
4. 人格以倾听→回应→邀请三层结构回复
5. 16 人格各有独特说话节奏/句式/情绪表达/提问方式
6. 无裁判、无胜负、不自动续聊——自然对话节奏
