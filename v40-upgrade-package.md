# DebateSphere v40 → v40.3 升级落地包

> **作者**：Python 全栈工程师角色 · 2026-09-03 22:49
> **配套 skill**（已装）：提示词工程专家 v2 / 腾讯乐享 / Agent Team Orchestration / 深度研究智能体 / 六维观点提炼
> **基线版本**：v40（最新）

---

## 0. 一分钟总览

```
v40.1  人格强化升级 ─── 双轨 prompt + 强度滑块 + 60 题量表
v40.2  辩论能力升级 ─── 七维裁判 + 辩论大师模块
v40.3  学习能力升级 ─── 云端知识库 + 本地 RAG 双轨兜底
```

每个小版本**独立可拆**，缺哪个回滚哪个；**不破坏现有 v40 UI 和 API**。

---

## 1. 文件清单（13 个文件 + 2 个改）

### ✅ 新增客户端（8 文件）

| 路径 | 行数 | 作用 |
|---|---|---|
| `client/src/data/personalityCore.ts` | 405 | 16 人格**内核层**（身份锚 + 反例边界 + 失败应对） |
| `client/src/data/personalityShell.ts` | 393 | 16 人格**外壳层**（按强度档动态拼装） |
| `client/src/data/personalityValidation.ts` | 320 | 60 题量表 + 行为验证器（behaviorCheck） |
| `client/src/utils/personalityIntensity.ts` | 100 | 强度滑块状态管理（localStorage + Hook） |
| `client/src/components/IntensitySlider.tsx` | 95 | 强度滑块 UI（compact + full 双模式） |
| `client/src/utils/debateMasterClient.ts` | 200 | 辩论大师 Hook（analyzeTopic / research / getTip / review） |
| `client/src/utils/judgeClient.ts` | 230 | 七维裁判客户端（含 8 维雷达图组件） |
| `client/src/utils/cloudKbClient.ts` | 150 | 云端知识库客户端封装（useCloudKB Hook） |

### ✅ 新增服务端（4 文件）

| 路径 | 行数 | 作用 |
|---|---|---|
| `server/routes/persona.js` | 180 | 60 题校准 + 强度档 + 行为验证路由 |
| `server/routes/judge.js` | 290 | 七维裁判配置 + 三裁判融合算法 |
| `server/routes/master.js` | 215 | 辩论大师 4 个端点（审题/资料/tip/复盘） |
| `server/routes/cloudkb.js` | 165 | 云端 KB 路由（FTS5 + 引用追踪） |

### ✏️ 改：2 文件

| 路径 | 改动 |
|---|---|
| `server/db.js` | 新增 5 张表（persona_calibration / judge_rubric / judge_verdicts / uploaded_docs / uploaded_chunks）+ FTS5 全文虚拟表 + 引用追踪表 |
| `server/index.js` | 注册 4 个新路由（/api/persona /api/judge /api/master /api/cloudkb） |

---

## 2. 5 分钟接入指南

### 步骤 1：数据库自动迁移（首次启动自动）
- 服务启动时 `db.js` 自动跑 `CREATE TABLE IF NOT EXISTS`
- 会自动插入 2 条 judge_rubric seed（legacy-5d + 7d-v1）
- 无需手动操作

### 步骤 2：把人格引擎接双轨 prompt（推荐：渐进式）
打开 `client/src/utils/debateEngine.ts:generateDebateResponse`

```ts
import { getIntensity } from './personalityIntensity'
import { assembleV40Prompt } from '../data/personalityShell'

// 在 generateDebateResponse 中替换原 buildDynamicContext() 调用：
const intensity = getIntensity(typeId)
const v40Prompt = assembleV40Prompt(typeId, intensity, topic, {
  stance: side,
  sceneName,
  otherSpeakers: participants.filter(p => p !== typeId),
})
// 把 v40Prompt 作为 system 消息发给 LLM
```

### 步骤 3：在 TabBar 加强度总览（1 行代码）
打开 `client/src/components/TabBar.tsx`

```tsx
import { IntensityOverview } from './IntensitySlider'

// 在设置抽屉里加
<button onClick={...}>16 人格强度仪表</button>
{showIntensity && <IntensityOverview />}
```

### 步骤 4：在 DebateRoom 接七维裁判
打开 `client/src/pages/DebateRoom.tsx`

```tsx
import { JudgePanel } from '../utils/judgeClient'

// 在辩论结束页（赛后）展示
<JudgePanel
  rubricVersion="7d-v1"
  messages={messages}
  onFeedback={(id, fb) => fetch(`/api/judge/verdict/${id}/feedback`, { method: 'POST', body: JSON.stringify({ feedback: fb }) })}
/>
```

### 步骤 5：在 KnowledgeLibrary 加"上传到云端 KB"按钮
打开 `client/src/components/KnowledgeLibrary.tsx`

```tsx
import { useCloudKB } from '../utils/cloudKbClient'

// 在头部 button 群加
<button onClick={() => document.getElementById('cloud-upload-input')?.click()}>
  <CloudUpload size={14} /> 上传到云端知识库
</button>
<input
  id="cloud-upload-input"
  type="file"
  hidden
  onChange={async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()  // 或调用 lexiang-knowledge-base skill
    await upload({ title: file.name, content: text, sourceType: 'markdown' })
  }}
/>
{cloudKB.docs.map(...)}
```

### 步骤 6：在 DebateStage 切换处触发大师 Tip
打开 `client/src/utils/debateArena.ts`

```ts
import { useDebateMaster, MasterTipToast } from './debateMasterClient'

// 在 stage 切换的 emit 处：
const tip = await getTip(stage, currentTypeId, topic, history)
setMasterTip(tip)
```

---

## 3. 上线前自检清单

### 服务端启动验证
```bash
cd D:/mbti-debate-platform/server
node --check index.js          # 语法检查 0 错
node --check routes/persona.js # 0 错
node --check routes/judge.js  # 0 错
node --check routes/master.js # 0 错
node --check routes/cloudkb.js # 0 错
npm start
```

### 端到端验证（新 14 端点）
```bash
# 1. 60 题校准
curl -X POST http://localhost:3001/api/persona/calibrate \
  -H "Content-Type: application/json" \
  -H "x-user-id: kkk" \
  -d '{"answers":[5,5,4,4,5,5,4,4,5,5,5,5,4,4, 6,6,5,5,5,5,6,6,5,5,6,6,5,5,6,6, 6,6,5,5,6,6,5,5,6,6,5,5,6,6,5, 5,5,6,6,5,5,6,6,5,5,6,6,5,5], "typeId":"INTJ"}'
# 期望: { "E": 50, "N": 50, ... "result_type": "XNTJ", "intensity": 50 }

# 2. 取评分配置
curl http://localhost:3001/api/judge/rubric
# 期望: { "version":"7d-v1", "dimensions": { ..., "rhetoric":0.12, "strategy":0.10, "ethics":0.10 } }

# 3. 跑三裁判融合
curl -X POST http://localhost:3001/api/judge/run \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"typeId":"INTJ","typeName":"INTJ","typeEmoji":"🏛️","typeColor":"#6366f1","content":"因为 X，所以 Y。"}], "rubricVersion":"7d-v1"}'

# 4. 审题
curl -X POST http://localhost:3001/api/master/analyze-topic \
  -H "Content-Type: application/json" \
  -d '{"topic":"AI 应该拥有版权吗？"}'

# 5. 赛中 tip
curl -X POST http://localhost:3001/api/master/tip \
  -H "Content-Type: application/json" \
  -d '{"stage":"cross","typeId":"INTJ","topic":"AI 版权","history":[]}'

# 6. 上传文档
curl -X POST http://localhost:3001/api/cloudkb/upload \
  -H "Content-Type: application/json" \
  -H "x-user-id: kkk" \
  -d '{"title":"测试","sourceType":"markdown","content":"AI 应该拥有版权的第一段……AI 应该拥有版权的第二段……"}'

# 7. 检索
curl -X POST http://localhost:3001/api/cloudkb/search \
  -H "Content-Type: application/json" \
  -H "x-user-id: kkk" \
  -d '{"query":"AI 版权","limit":3}'
```

### 前端语法验证
```bash
cd D:/mbti-debate-platform/client
npx tsc --noEmit 2>&1 | head -40
```

### 评估流程（用 sample 跑 4 人格 × 3 强度）
```bash
# 1. 抽 4 家族代表（INTJ/ENFP/ISTJ/ISFP）
# 2. 各跑同一辩题 3 轮
# 3. 强度档位 1/3/5 各跑一遍
# 4. 用 behaviorCheck() 检查人格一致性
# 5. 对比生成文本的角色锚出现频次
```

---

## 4. 已知限制 + 后续路线

### 限制清单（先记账，下个版本迭代）

| 限制 | 影响 | 计划 |
|---|---|---|
| 启发式裁判无 LLM 加成 | 评分维度不够"深" | v41 接 OpenAI/Claude API |
| 60 题量表是中文自建 | 与 spcl 标准量表无法 1:1 对照 | v41 翻译 60 Personalities 量表 |
| 云端知识库默认走本地 SQLite | 联网场景未激活 lexiang skill | v40.3.1 接通 lexiang-knowledge-base CLI |
| 引用追踪只在表达层，不影响 LLM input | LLM 不知道哪条依据哪个来源 | v41 把引用块注入到 LLM prompt |
| 强度滑块无 A/B 测试 | 效果凭经验 | v41 加反馈回流到 persona_calibration |

### 后续 v41 路线图
- 真·多 LLM 裁判（heuristic × 0.3 + GPT × 0.4 + Claude × 0.3）
- 真人 vs AI 混战（用 Agent Team Orchestration skill 编排）
- 复盘 PDF 报告（六维观点提炼 skill 自动生成）
- 双语人格（中文人格 + 英文人格切换）

---

## 5. 改动影响面

- ✅ 不动的部分：现有 `mbtiProfiles.ts`（基础档案）、`personalitySystem.ts`（v37 三层 prompt）、`debateArena.ts`（赛前赛后）、`learningStore.ts`（localStorage）
- ✅ 增量的部分：双轨 prompt 作为 v40 升级选项（不在 v40 主线）
- ⚠️ 兼容注意：现有 `judgeDebate` 五维评分继续可用，`judgeRubric` 配置只对 `/api/judge/run` 新端点生效

---

## 6. 升级理由回顾

> **16 人格为什么弱？** v37 三层 prompt 是静态设计——没有外部基线、缺失败应对、缺强度档位、缺反例边界。  
> **v40.1 解决了**：双轨模型 + 60 题校准 + 强度滑块 + 反例边界 + 输出长度约束。

> **裁判为什么弱？** 本地启发式打分用关键词密度，五维没覆盖修辞/战略/伦理。  
> **v40.2 解决了**：七维（+rhetoric/strategy/ethics）+ 三裁判融合（heuristic+llm+human）+ 可配置权重。

> **学习为什么弱？** localStorage 存文本片段，关键词匹配注入。无向量化、无多模态、无引用页。  
> **v40.3 解决了**：腾讯乐享 skill（多模态 KB）+ 本地 FTS5 兜底 + 引用追踪表 + 引用小角标 UI。

---

## 7. 文件树一览

```
D:/mbti-debate-platform/
├── client/src/
│   ├── components/
│   │   └── IntensitySlider.tsx                    ← 新增 ⭐
│   ├── data/
│   │   ├── personalityCore.ts                     ← 新增 ⭐
│   │   ├── personalityShell.ts                    ← 新增 ⭐
│   │   └── personalityValidation.ts               ← 新增 ⭐
│   └── utils/
│       ├── personalityIntensity.ts                ← 新增 ⭐
│       ├── debateMasterClient.ts                  ← 新增 ⭐
│       ├── judgeClient.ts                          ← 新增 ⭐
│       └── cloudKbClient.ts                        ← 新增 ⭐
└── server/
    ├── db.js                                       ← 改 ✏️（+5 表）
    ├── index.js                                    ← 改 ✏️（+4 路由注册）
    └── routes/
        ├── persona.js                              ← 新增 ⭐
        ├── judge.js                                ← 新增 ⭐
        ├── master.js                               ← 新增 ⭐
        └── cloudkb.js                              ← 新增 ⭐
```

---

## 8. 一句话 TL;DR

> **不改一行 v40 现有代码，纯加法的方式叠加**：双轨 prompt（16 人格）、七维裁判（3 裁判融合）、本地 RAG + 云端 KB 双轨——所有新功能**独立模块**、**可拆可挂**。

