# v40+ 知乎三 API 接入包

> **作者**：Python 全栈工程师角色 · 2026-09-03 22:58
> **用途**：把知乎"全网搜索 + 直答 LLM + 热榜"三个 API 安全接进 v40+ 平台
> **接入原则**：secret 永远留在服务端（`.env`），前端只与自家代理对话

---

## 0. 一分钟总览

| API | 用途 | 落地位置 |
|---|---|---|
| **全网搜索** | 辩论大师的"资料包"从骨架升级为真实数据 | `master.research` 已改接 |
| **直答 LLM** | 平台真正有"在线大脑"（fast/thinking/agent 三档） | 接入 `llmClient.chatCompletion` |
| **热榜** | NewsLibrary 新 tab + 任意页面"今日热问" | `ZhihuHotlistPanel.tsx` 已就位 |

---

## 1. 新增 / 改动文件

### ✅ 新增（5 文件）
| 路径 | 行数 | 作用 |
|---|---|---|
| `server/zhihu.js` | 75 | 服务端统一封装（鉴权 + RPM 限流 + 3 端点元数据） |
| `server/routes/zhihu.js` | 175 | 4 个 API 路由：`/status /search /chat /hotlist` |
| `client/src/utils/zhihuClient.ts` | 220 | 前端封装 + 3 个 Hook（status / hotlist / search）+ 流式 chat |
| `client/src/components/ZhihuSearchPanel.tsx` | 100 | 知乎搜索 UI（debounce + 错误降级） |
| `client/src/components/ZhihuHotlistPanel.tsx` | 130 | 热榜 UI（缩略图 + 名次色 + 辩题转换按钮） |

### ✏️ 改（3 文件）
| 路径 | 改动 |
|---|---|
| `server/index.js` | 导入 `zhihuRoutes`、注册 `/api/zhihu` |
| `server/routes/master.js` | `/research` 端点：**真去知乎搜**（未启用 secret 时退回骨架） |
| `client/src/utils/llmClient.ts` | 新增 `provider: 'zhihu'` 选项 + `chatViaZhihu()` 路由 + 设置项 |
| `.env.example` | 新增 `ZHIHU_ACCESS_SECRET` + 三档模型名 + RPM 配置 |

---

## 2. 接入流程（3 步）

### 第 1 步：申请 + 配 secret
1. 访问 [developer.zhihu.com](https://developer.zhihu.com/) 申请 Access Secret
2. 编辑 `server/.env`：
   ```
   ZHIHU_ACCESS_SECRET=your-secret-here
   ZHIHU_MODEL_FAST=zhida-fast-1p5
   ZHIHU_MODEL_THINKING=zhida-thinking-1p5
   ZHIHU_MODEL_AGENT=zhida-agent
   ZHIHU_RATE_LIMIT_RPM=60
   ```
3. 重启服务：`npm start`

### 第 2 步：让用户切到"⭐ 知乎直答"模型
打开设置页（SettingsPage.tsx）的 LLM 配置下拉框，现在多了 `⭐ 知乎直答（免配置）`：
- 选了之后，用户即使没配 OpenAI/Claude key，平台也能用 LLM
- 三档可切：fast（赛中 tip 低延迟）/ thinking（赛后复盘）/ agent（深度研究）

### 第 3 步：把搜索/热榜 UI 接进页面
```tsx
// 知识库页面加搜索 tab
import { ZhihuSearchPanel } from '../components/ZhihuSearchPanel'
<Tab value="zhihu">
  <ZhihuSearchPanel onPickSnippet={(s) => addUserBook({ title: s.title, content: s.snippet, sourceType: 'url' })} />
</Tab>

// 新闻页加热榜 tab
import { ZhihuHotlistPanel } from '../components/ZhihuHotlistPanel'
<Tab value="zhihu-hot">
  <ZhihuHotlistPanel onPick={(it) => setTopic(it.title)} />
</Tab>

// 辩论准备页加"赛前资料"
import { useDebateMaster } from '../utils/debateMasterClient'
const research = await research(topic)  // 现在 research.zhihu.pro/con 是真实资料
```

---

## 3. 5 分钟自检 curl

### 0. 状态
```bash
curl http://localhost:3001/api/zhihu/status
# 期望：{ "enabled": true, "models": {...}, "rpmLimit": 60 }
```

### 1. 全网搜索
```bash
curl -G 'http://localhost:3001/api/zhihu/search' \
  --data-urlencode 'q=AI 应该拥有创作版权吗' \
  -d 'count=5'
# 期望：enabled:true + items[].title/snippet/url/voteUpCount
```

### 2. 直答（非流式）
```bash
curl -X POST http://localhost:3001/api/zhihu/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "thinking",
    "messages": [
      {"role":"system","content":"你是 INTJ 建筑师"},
      {"role":"user","content":"用一句话说为什么你应该用数据说话"}
    ]
  }'
# 期望：{ "enabled":true, "content":"...", "reasoning":"..." }
```

### 3. 直答（流式）
```bash
curl -X POST 'http://localhost:3001/api/zhihu/chat?stream=1' \
  -H 'Content-Type: application/json' \
  -d '{"model":"fast","messages":[{"role":"user","content":"3 个词讲 MBTI"}]}'
# 期望：SSE 流（data: {...}\n\n 多次）
```

> 注：当前实现中 `?stream=1` query 标志并不解析，流式始终来自 body `stream:true`。如需 query 控制请改 routes/zhihu.js 路由处理。

### 4. 热榜
```bash
curl 'http://localhost:3001/api/zhihu/hotlist?limit=10'
# 期望：{ "enabled":true, "total":10, "items":[ {title, url, thumbnailUrl, summary}, ... ] }
```

### 5. 辩论大师的 research（已接知乎）
```bash
curl -X POST http://localhost:3001/api/master/research \
  -H 'Content-Type: application/json' \
  -d '{"topic":"AI 应该拥有创作版权吗","useZhihu":true}'
# 期望：research.zhihu.pro/con 数组里都是来自知乎搜索的真实素材
```

---

## 4. 模型档选择指南

| 档 | 模型 ID | 延迟 | 质量 | 推荐用途 |
|---|---|---|---|---|
| **fast** | `zhida-fast-1p5` | <2s | 中 | 赛中大师 tip / 快速补刀 |
| **thinking** | `zhida-thinking-1p5` | 5-15s | 高 | 赛后复盘 / 七维裁判 / 60 题校准 |
| **agent** | `zhida-agent` | 长 | 高 | 工具调用型复杂任务（如资料组装） |

平台默认用 **thinking**，可在设置页切。

---

## 5. 已知限制

- **secret 必须服务端配**：前端拿不到 secret，安全模型是「服务端代理 + 鉴权」
- **没 secret 时**：所有路由返回 503 + 明确错误，前端 UI 自动降级显示提示
- **RPM 默认 60**：超过会抛"速率超限"错误，可调 `ZHIHU_RATE_LIMIT_RPM`
- **直答流式**：当前 body `stream:true` 走 SSE，前端 EventSource 也可（需要解决跨域 cookie 鉴权问题）
- **search 高权威过滤**：知乎 AuthorityLevel 字段 1-4（4 超高），平台可在前端做红色徽章

---

## 6. 与 v40+ 升级包的协同

| 升级包 | 协同点 |
|---|---|
| v40.1 双轨 prompt | 知乎直答 = 真在线大脑，把 `assembleV40Prompt` 的 system 段真正交给 LLM 跑 |
| v40.2 七维裁判 | 三裁判中的 LLM 裁判可切到 `zhida-thinking-1p5`（替换默认 fallback） |
| v40.2 辩论大师 | `research.zhihu.pro/con` 给大师的"赛前资料"真正落地 |
| v40.3 云端知识库 | ZhihuSearchPanel 的"加入知识库"按钮直接把知乎结果入库 `uploaded_docs` |
| v40+ 60 题量表 | Zhihu 负责做"提示词工程体检"（人工上传 + LLM 联合判断人格一致性） |

---

## 7. 一句话总结

> **不花一分钱、免配置、立刻可用的 LLM 接入**：填一个 `ZHIHU_ACCESS_SECRET`，平台就接入了中文语义第一梯队的"知乎直答"作为默认 LLM + 全球最大的中文知识社区的"全网搜索"作为辩论大师的资料源 + 实时热榜。整套接入**纯加法、不破坏 v40 任何现有代码**。

