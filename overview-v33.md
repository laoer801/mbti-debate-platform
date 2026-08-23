# DebateSphere v33 — 辩论报告生成 + 专业建议·困境拆解

> 版本：v33 · 2026-08-13
> 主题：辩论结束一键生成结构化 Markdown 报告；1v1 对话中识别困境/决策类问题，拆解为三条行动路径 + 风险提示。

## 一、为什么做 v33

用户研究了大量开源项目（Dialectic / debate-bot / Council-Of-HAL / llm-parliament / Cognix / MiT / MPG 等），提出把「辩论报告、专业建议和 1v1 AI 对话」等功能加进现有系统。

经对照分析：
- **1v1 对话** → v31 已实现（PersonaChat LLM 优先 + 人格状态/记忆）
- **多智能体辩论** → v25-v28 已实现（debateArena 编排器 + 提示词架构 + CoT）
- **人格状态演化** → v31 已实现（四层人格引擎）
- **本地 RAG 知识库** → v32 已实现
- **辩论报告** → ❌ 缺失（辩论结束只有分数，没有结构化复盘报告）
- **专业建议·困境拆解** → ❌ 缺失（1v1 对话只有共情回应，没有行动路径拆解）
- crewAI/LangGraph/模型微调 → 不可集成（纯前端，无 Python 后端/GPU）

v33 聚焦两个真正缺失的增量。

## 二、新增功能

### 功能一：辩论报告生成器

**对标**：Dialectic / debate-bot / llm-parliament

辩论结束后（arena 裁判出结果 或 模板模式自动结束有评分），消息列表底部出现「📜 辩论报告」按钮，点击弹出全屏报告模态。

报告结构（严格 Markdown）：
1. **辩论概览** — 辩题、双方立场概述、发言轮数、裁判来源
2. **正方核心论点** — 提炼 3-5 个论点，每条标注 [n] 引用来源
3. **反方核心论点** — 同上
4. **交锋焦点** — 双方分歧最大的 2-3 点，各引用 [n]
5. **共识** — 双方都认同的部分
6. **分歧** — 双方无法调和的分歧
7. **折中方案** — 融合双方立场的可落地中间立场
8. **裁判判定** — 各维度评分 + 胜方理由
9. **置信度评估** — 发言轮数、论据充分度、裁判一致性

双路生成：
- **LLM 优先**（temperature 0.6, maxTokens 1200）：把整场发言 + 裁判结果喂给 LLM，要求严格 Markdown 结构
- **本地兜底**：LLM 未配置/失败时，模板从 speeches + judge 机械拼接（交锋焦点/共识/分歧/折中方案标注「请配置 AI」）

工具栏：重新生成 / 复制全文 / 下载 .md 文件 / 关闭

### 功能二：专业建议·困境拆解

**对标**：Cognix Problem Mode / llm-parliament

1v1 对话中，当 LLM 判断用户表达的是困境/选择/决策类问题（如「要不要换工作」「选 A 还是 B」）时，在常规共情回应之后，自动追加结构化的【路径建议】块：

```
【路径建议】
路径A：稳妥过渡
- 适合：手头紧、不能断收入的人
- 利：风险最小，骑驴找马
- 弊：可能错过当下的机会窗口
路径B：激进转身
- 适合：...
路径C：暂缓观察
- 适合：...
风险提示：三条路都有机会成本...
建议下一步：今晚花 15 分钟写下你最在意的三件事...
```

设计原则：
- **不给唯一正确答案** — 呈现选择空间，把判断权交还给用户
- **三条路径必须真正不同** — 不是同一条的微调变体
- **非困境类问题绝不触发** — 纯知识问答/闲聊/纯倾诉不输出此块
- 路径用霓虹青/紫/品红三色区分，点击展开利弊

数据流：LLM 输出 → `extractAdviceFromResponse` 剥离【路径建议】块 → 正文进对话气泡、路径进独立 `PathAdviceCard` 卡片

## 三、技术实现

### 新增文件（5 个）

| 文件 | 职责 |
|------|------|
| `src/data/pathAdviceRules.ts` | 困境拆解提示词 + parsePathAdvice 解析器 + extractAdviceFromResponse 分离器 |
| `src/utils/markdownLite.ts` | 零依赖轻量 Markdown 渲染器（escapeHtml + 行内格式 + 块级结构） |
| `src/utils/debateReport.ts` | 辩论报告生成器（统一 ReportInput + LLM 生成 + 本地兜底 + 导出工具） |
| `src/components/PathAdviceCard.tsx` | 三路径卡片组件（三色区分 + 点击展开利弊 + 风险/下一步） |
| `src/components/DebateReport.tsx` | 全屏报告模态（自动生成 + 工具栏 + Markdown 渲染 + source 徽章） |

### 修改文件（4 个）

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | 新增 PathOption / PathAdvice 类型；Message 加 advice 字段 |
| `src/data/dialogueMode.ts` | buildDialogueSystemPrompt 注入 PROBLEM_SOLVING_RULES |
| `src/components/PersonaChat.tsx` | LLM 分支用 extractAdviceFromResponse 剥离路径块；PathAdviceCard 渲染 |
| `src/components/DebateRoom.tsx` | 报告按钮 + handleGenerateReport + DebateReport 模态接入 |

### 测试

- `scripts/test-report-v33.ts`：79 项纯函数测试，全 ✅
  - parsePathAdvice：3 路径/2 路径/无块/1 路径/缺字段/截断
  - extractAdviceFromResponse：有块剥离/无块原样/空字符串
  - fallbackReport：报告结构完整性 + 无裁判降级
  - renderMarkdownLite：标题/列表/粗体/代码/引用/[n]/XSS 防护
  - toReportSpeechesFromMessages：过滤 isUser/无 side/空 content
  - toReportSpeechesFromArena / toReportJudgeFromArena：arena 数据转换
  - toReportStances：立场转换 + 空数组/undefined

### 验证

- `npx tsc -b` → 0 错误
- `npm run build` → 1970 模块，25.83s，成功
- dev 预览 → http://localhost:5176/

## 四、依赖方向

```
pathAdviceRules → types（type-only）
markdownLite → 无依赖（纯函数）
debateReport → llmClient（运行时）+ types + debateArena（type-only）
PathAdviceCard → types
DebateReport → debateReport + markdownLite
dialogueMode → pathAdviceRules（提示词注入）
PersonaChat → pathAdviceRules（extractAdviceFromResponse）+ PathAdviceCard
DebateRoom → debateReport（工具函数）+ DebateReport
```

无循环依赖。

## 五、待办

- [ ] 用户确认前端效果后，重新打包桌面端（便携版 / NSIS 安装版）
- [ ] 用户确认效果后，重新打包 Android APK v33
- [ ] 可选增强：辩论报告增加 PDF 导出（当前仅 Markdown）
- [ ] 可选增强：路径建议支持「追问某条路径的详细执行计划」
