# DebateSphere v38 — 每日新闻学习

> 交付时间：2026-08-21  
> 版本：v38（基于 v37.2 FUI 全站动态背景）

---

## 本次更新

### 每日新闻学习系统

人格知识库新增「每日新闻」模块——自动从 8 个中文 RSS 源抓取新闻，切块入 RAG 隐藏领域，辩论和对话中人格自动检索引用时事热点。

**新闻源（8 个）：**
| 来源 | 类别 | RSS |
|------|------|-----|
| IT之家 | 科技 | ithome.com/rss |
| cnBeta | 科技 | rss.cnbeta.com |
| V2EX | 技术社区 | v2ex.com/index.xml |
| 36氪 | 商业 | 36kr.com/feed |
| 联合早报 | 综合 | rsshub.app/zaobao |
| 知乎日报 | 综合 | rsshub.app/zhihu/daily |
| 少数派 | 科技 | rsshub.app/sspai/matrix |
| 虎嗅 | 商业 | rsshub.app/huxiu |

**架构：**
1. **后端** `routes/news.js`：RSS 抓取 → XML 解析（零依赖正则） → SQLite `news_articles` 表 → 6 个 API 端点
2. **前端** `utils/newsKnowledge.ts`：从后端拉取 → 切块入 RAG 隐藏领域 'news' → BM25 检索 → 提示词注入
3. **辩论集成** `debatePrompts.ts` + `debateArena.ts`：每轮检索新闻 → 注入 PersonaSpeechContext.newsKnowledge
4. **对话集成** `dialogueMode.ts` + `PersonaChat.tsx`：每次对话检索新闻 → 注入 DialogueContext.newsKnowledge
5. **UI** `NewsLibrary.tsx`：知识库第五个模式（📰 每日新闻）——统计/抓取/列表/搜索测试/清空
6. **自动学习** `App.tsx` 启动时 `autoFetchIfNeeded()` 检查（超过 12 小时自动抓取）

**API 端点：**
- `GET /api/news/fetch` — 手动触发抓取（返回新增/跳过/总数）
- `GET /api/news/latest?limit=N` — 获取最新 N 条
- `GET /api/news/search?q=xxx` — 关键词搜索
- `GET /api/news/sources` — 新闻源列表
- `GET /api/news/stats` — 统计（总数/按来源/上次更新）
- `DELETE /api/news/:id` — 删除单条
- `DELETE /api/news/all` — 清空全部

**自动标签系统：**
根据标题和摘要内容自动打标签——AI/手机/芯片/互联网/游戏/汽车/金融/国际/航天/安全，用于分类和检索。

---

## 技术细节

- **RSS 解析**：零依赖正则提取，兼容 RSS 2.0（`<item>`）和 Atom（`<entry>`）
- **HTML 清理**：`stripHtml()` 先 CDATA 提取 → 实体解码 → 标签移除 → 空白清理
- **去重**：按 `link` 字段去重，同一链接不重复入库
- **RAG 隐藏领域**：'news' 领域不在 `getAllDomains` 返回，不影响领域路由
- **提示词注入**：与视频知识（v34）并行注入，引用时标 📰 来源序号
- **Express 路由**：`/all` 必须在 `/:id` 之前定义（否则 `all` 被 `:id` 匹配）

---

## 验证

- tsc -b 0 错误
- vite build 19.90s 通过
- 后端 API 测试：60 条新闻抓取入库成功，列表/搜索/统计/删除全正常
- 前端模块确认进包：debateEngine/debatePrompts/DebateRoom/PersonaChat/KnowledgeLibrary
- 摘要 HTML 清理验证：无标签残留

---

## 使用说明

1. 确保后端运行（`cd server && npm start`）
2. 打开知识库 → 点击「📰 每日新闻」标签
3. 点击「立即抓取新闻」手动抓取，或等待 App 启动时自动抓取（12 小时间隔）
4. 在检索测试框输入关键词，预览人格如何检索新闻
5. 辩论或对话时，人格会自动检索相关新闻并引用（如「最近我看到一则新闻…（[1]）」）

---

## 交付物

| 文件 | 类型 | 大小 |
|------|------|------|
| `DebateSphere-v38-portable.exe` | Windows 便携版 | 69 MB |
| `DebateSphere-v38-setup.exe` | Windows NSIS 安装版 | 76 MB |
| `DebateSphere-v38-debug.apk` | Android Debug APK | 12 MB |
| `DebateSphere-v38-release.apk` | Android Release APK | 9.7 MB |

**位置：** 项目根目录 + `artifacts/` + 桌面

**旧版本 v37.2 已清理。**

---

**UI Designer**  
DebateSphere Project
