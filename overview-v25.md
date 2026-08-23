# DebateSphere v25「顶尖辩手模式」— LLM 结构化对抗辩论

> 版本主题：告别"扮演专家"，拥抱"结构化对抗"——让 AI 辩论水平逼近顶尖辩手，**零模型训练**。
> 全部为前端改动（React 18 + TypeScript），无需后端配合。

## 核心思路（2026 主流方法：设计"模型思考和协作的方式"，而非"教模型知识"）

1. **多智能体辩论（MAD）**：16 个 MBTI 人格各自成为独立 LLM Agent，立场锚定后互相攻击论证
2. **四阶段赛制**：开场陈词 → 交叉质询 → 自由辩论 → 总结陈词（8 轮状态机）
3. **动态上下文**：每轮注入对方最新发言 + 历史摘要 + 压缩协议，保证"正面回应"而非各说各话
4. **裁判 Agent 独立裁决**：四维评分 + 套话密度检测（>10% 判无效发言）

## 新增/修改文件

| 文件 | 说明 |
|------|------|
| `client/src/utils/llmClient.ts` | LLM 客户端：OpenAI 兼容 chatCompletion，内置 DeepSeek/OpenAI/通义/硅基流动预设 + 自定义 baseURL，localStorage 持久化 |
| `client/src/utils/debatePrompts.ts` | 提示词架构层：16 人格系统提示词生成器 + AI 裁判提示词 + 四阶段指令 + 防套话强化规则 |
| `client/src/utils/debateArena.ts` | 多智能体编排器：辩论场状态机 + 轮转发言 + 动态上下文 + LLM 裁判；LLM 失败自动回退本地模板引擎 |
| `client/src/components/SettingsPage.tsx` | 新增「顶尖辩手模式」设置区块：开关 / 服务商 / API Key / 模型名 / 连接测试 |
| `client/src/components/DebateRoom.tsx` | 辩论房间 arena 分支：创建辩论场 → 轮流发言（打字机 + 人格音色 TTS）→ 8 轮结束 → AI 裁判裁决 |

## 防套话机制（按用户提供的模板 1:1 编码）

**辩论核心规则**：切题要求 / 论证要求（结论先行 + 例证 + 来源）/ 套话识别与惩罚 / 字数与次数控制

**人格强化指令**（针对各人格认知弱点）：
- INTJ / INTP：禁抽象套话（"从本质上讲"），必须给具体机制
- ENFP / ENTP：禁跑题，先回应对方再发散
- INFJ / ENFJ：禁"我觉得"，必须给可验证论据
- ISTJ / ESTJ：禁只堆数据，必须讲推理链条

**裁判检测规则**：
- 切题性评分 1-5 / 新信息量评分 1-5 / 套话密度 0-10%
- 套话密度超 10% 判无效发言并扣分
- 典型套话示例扣分（如"这个问题有利有弊"扣 1 分）

## 使用方式

1. 设置页 →「顶尖辩手模式」→ 打开开关
2. 选择服务商（默认 DeepSeek），填入 API Key 与模型名，点「测试连接」
3. 进入辩论房间 → 开始辩论 → 8 轮自动进行（AI 语音可选开启）
4. 结束后弹出 AI 裁判面板：四维分数 + 套话检测报告 + 胜方裁决

## 技术要点

- **容错**：LLM 调用失败 / 未配置 → 自动回退本地模板引擎，不影响原有辩论功能
- **提示词压缩协议**：控制单轮上下文长度，防止长辩论上下文爆炸
- **类型安全**：`npx tsc --noEmit` 全绿；Vite 构建 5.83s 通过（产物 89 个文件）

## 构建与交付（已完成）

- 前端：`npm run build -- --outDir dist-new` 成功（5.83s，`index-SJ5yiRMk.js`）→ `cp -r` 同步 `dist` 与 android assets
- Gradle：走 v24 终极绕行方案（全量锁目录改名 + `java -jar` 直启 + GRADLE_USER_HOME 隔离）→ `BUILD SUCCESSFUL in 18m14s`（215 任务，缓存全清重建）
- 签名验证：debug `CN=Android Debug` / release `CN=MBTI Debate Platform` 均通过
- 解包验证：APK 内 `index.html` 引用 `index-SJ5yiRMk.js`，标题「DebateSphere · 思辩星球」✓
- 交付 4 个 APK：
  - `D:\mbti-debate-platform\MBTI辩论平台-手机版.apk`（release 4.93MB）
  - `D:\mbti-debate-platform\MBTI辩论平台-手机版-debug.apk`（debug 6.10MB）
  - `D:\mbti-debate-platform\artifacts\DebateSphere-v25-{release,debug}.apk`

## 待办 / 注意

- API Key 存 localStorage，仅用于浏览器直连 LLM 服务商，不上传服务器
- 桌面 Electron 版未同步 v25（与 v24 语音同为遗留项）
