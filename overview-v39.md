# DebateSphere v39 — 新闻学习系统修复与升级

> 交付日期：2026-08-21  
> 版本：v39  
> 上一版本：v38（每日新闻学习系统首发）

---

## 一、本次修复背景

v38 首次引入每日新闻学习系统，但存在三个严重问题：

1. **只能刷出科技类新闻** — 8 个 RSS 源中 6 个已失效（cnBeta 域名注销、4 个 RSSHub.app 超时、V2EX 超时），仅剩 IT之家+36氪，全部偏科技
2. **检索功能不工作** — `addDocument` 返回的真实 docId 被丢弃，写了假的 `news-${id}`，导致旧新闻删不掉、IndexedDB 无限膨胀、BM25 检索反复命中重复旧闻
3. **没有浏览器链接** — 新闻列表只展示标题/摘要，无法点击跳转原文

---

## 二、修复内容

### 2.1 RSS 源替换（后端 `server/routes/news.js`）

**实测 16+ 个候选源**，最终保留 9 个可用源，覆盖 5 大类别：

| 类别 | 源 | URL |
|------|-----|-----|
| 科技 | IT之家 | `https://www.ithome.com/rss/` |
| 科技 | 爱范儿 | `https://www.ifanr.com/feed` |
| 科技 | 雷锋网 | `https://www.leiphone.com/feed` |
| 科技 | 少数派 | `https://sspai.com/feed` |
| 科技 | Solidot | `https://www.solidot.org/index.rss` |
| 商业 | 钛媒体 | `https://www.tmtpost.com/feed` |
| 时政 | 新华网 | `http://www.xinhuanet.com/politics/news_politics.xml` |
| 国际 | 人民网国际 | `http://www.people.com.cn/rss/world.xml` |
| 综合 | 中国新闻网 | `https://www.chinanews.com.cn/rss/scroll-news.xml` |

**新增功能**：
- 每个源带 `category` 字段，支持按类别过滤
- 新增 `GET /api/news/categories` 端点返回类别统计
- `GET /api/news/latest` 支持 `?category=` 参数过滤
- `GET /api/news/fetch` 返回 `sourceStatus` 数组（每个源的抓取状态）
- 修复 `extractTag` 函数：正确处理 CDATA（`<![CDATA[...]]>`）
- 修复 empty link 去重 bug：`WHERE link != ''` 用单引号（SQLite 双引号是标识符）

### 2.2 docId 修复（前端 `client/src/utils/newsKnowledge.ts`）

**根因**：`addDocument()` 返回真实 docId（如 `doc_abc123`），但代码丢弃返回值，写了假的 `news-${article.id}`。后果：
- 旧新闻的 docId 在 IndexedDB 中找不到，删不掉
- IndexedDB 无限膨胀
- BM25 检索反复命中重复旧闻

**修复**：
- `addDocument()` 返回值解构出 `docId`，存入 `newsDocIds` Map
- 清理旧闻时用真实 docId 调用 `removeDocument()`
- 添加 `clearAllNewsDocs()` 函数：清空所有新闻文档 + 重置 docId Map
- 首次加载时自动清理旧版残留的假 docId 文档

**其他修复**：
- `fetchNewsFromBackend()` 不再写死 `localhost:3001`，改用 `config.ts` 的 `API_BASE`
- 正文不再重复拼接（summary + content → 只用 content，summary 仅用于 UI 展示）

### 2.3 浏览器链接（前端 `client/src/components/NewsLibrary.tsx`）

**新增功能**：
- 每条新闻可点击「打开原文 ↗」按钮跳转
- Web 环境用 `window.open(link, '_blank')`
- Electron 环境用 `window.electronAPI?.openExternal(link)` → `shell.openExternal`
- 新闻列表支持按类别过滤（科技/商业/时政/国际/综合/全部）
- 抓取结果展示每个源的状态（成功/失败 + 条数）
- 检索测试框可输入关键词测试 BM25 检索效果

### 2.4 辩论/对话注入不变

v38 的辩论/对话新闻知识注入逻辑不变：
- `debateArena.ts` 每轮检索新闻知识 → `PersonaSpeechContext.newsKnowledge`
- `dialogueMode.ts` 对话系统提示词注入新闻知识段
- `PersonaChat.tsx` 对话时检索新闻 + 📰 参考来源卡

---

## 三、构建验证

| 检查项 | 结果 |
|--------|------|
| TypeScript 编译 (`tsc -b`) | 0 错误 |
| Vite 生产构建 | 通过（4.89s） |
| 后端新闻抓取测试 | 9 源全部成功，577 条新闻，5 类别全覆盖 |
| CDATA 标题修复 | 新华网标题干净无残留 |
| 搜索测试 | `q=芯片` 正常返回结果 |
| 类别过滤测试 | 时政/国际 均正常返回对应类别文章 |
| Electron portable exe | 71MB ✅ |
| Electron NSIS setup exe | 79MB ✅ |
| Android debug APK | 9.9MB ✅ |
| Android release APK | 8.3MB ✅ |

---

## 四、交付物

| 文件 | 大小 | 位置 |
|------|------|------|
| DebateSphere-v39-portable.exe | 71MB | 根目录 / artifacts / 桌面 |
| DebateSphere-v39-setup.exe | 79MB | 根目录 / artifacts / 桌面 |
| DebateSphere-v39-debug.apk | 9.9MB | 根目录 / artifacts / 桌面 |
| DebateSphere-v39-release.apk | 8.3MB | 根目录 / artifacts / 桌面 |

### 启动方式

**桌面版**：
- 便携版：双击 `DebateSphere-v39-portable.exe`（无需安装）
- 安装版：双击 `DebateSphere-v39-setup.exe` → 选择安装路径 → 桌面快捷方式

**移动版**：
- 将 APK 传到手机 → 允许未知来源安装 → 安装

**后端服务**：
```bash
cd server && npm start
```
后端运行在 `http://localhost:3001`，提供注册/登录/新闻抓取/社区/PK 房间等 API。

---

## 五、版本历史

- v37 FUI 人格观测站（纯黑底 + 线框面板 + 点阵星球）
- v37.2 全站 FUI 动态背景
- v38 每日新闻学习系统（RSS 抓取 + RAG 检索 + 辩论/对话注入）
- **v39 新闻系统修复升级**（RSS 源替换 + docId 修复 + 浏览器链接 + 类别过滤）
