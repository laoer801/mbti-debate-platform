# DebateSphere v32 — 多领域知识库（本地 RAG）

> 版本：v32 · 2026-08-17
> 主题：从「辩论」升级为「1v1 深度交流 + 各行各业知识科普」——用户可自建知识库，提问时自动路由到对应领域，以人格口吻做正确常识科普。

## 一、为什么做 v32

用户明确需求：
1. **导入各行各业知识库**（金融、市场、法律、医疗、教育等）
2. **1v1 不是辩论，是提问和交流 + 正确常识科普**
3. 按 RAG 方案文档思路落地（本地检索增强，无需部署 Python 后端）

根因：v31 的「1v1 深度交流」虽然有 LLM + 人格状态/记忆，但**没有外部知识来源**——用户问专业问题时，LLM 只能凭训练数据回答，无法基于权威资料做「可溯源的科普」。

## 二、架构：纯前端本地 RAG

项目为 Electron + Android APK 纯前端，**没有后端服务**，无法部署 LightRAG/UltraRAG/FastGPT 那套 Python 服务。自主实现等价的纯本地 RAG，零部署、离线可用、数据不出设备。

```
用户提问
   ↓
【路由智能体】router.ts —— 查询分词，与领域关键词表打分匹配
   ↓ 命中金融领域 → 在金融领域检索；未命中 → general 兜底
【检索智能体】store.ts + bm25.ts —— BM25 概率模型建索引、检索、跨领域合并
   ↓
【科普人格回答】dialogueMode.ts —— 知识库上下文注入系统提示词 + 人格驱力/状态/记忆
   ↓
LLM 生成回答（带 [n] 引用编号）
   ↓
UI 展示回答 + 「📚 参考来源」卡片（可追溯的科普）
```

## 三、六大新模块

### 1. `data/domainPresets.ts` — 11 个内置领域
- **finance / marketing / law / health / education / tech / psychology / philosophy / career / life / general**
- 每个领域：id/name/emoji/color/description/keywords/examples
- 路由关键词表合计 500+ 词，覆盖常见提问用语
- 用户可自建领域（store 持久化），预设领域固定不可删

### 2. `utils/knowledgeBase/tokenizer.ts` — 中文轻量分词器
- 词典最长匹配（领域关键词 + 通用双字词，最多 6 字）
- 2-gram 滑窗回退，停用词 + 单字噪声过滤
- 词典命中优先，检索场景无需完美分词

### 3. `utils/knowledgeBase/bm25.ts` — 经典 BM25 信息检索
- k1=1.5, b=0.75，标题词频 ×3 加权
- `mergeHits` 跨领域合并去重
- 懒构建索引缓存，数据变更自动失效重建

### 4. `utils/knowledgeBase/documentParser.ts` — 文档解析
- `.txt/.md` 直读
- `.docx` JSZip 解包 word/document.xml 提取段落
- `.pdf` pdfjs-dist v6 逐页提取（主线程模式，worker asset 随包分发）
- 分块策略：400 字/块 + 60 字重叠

### 5. `utils/knowledgeBase/store.ts` — 双后端存储
- **IndexedDB**（浏览器主环境）——三表 domains/documents/chunks
- **内存 Map 降级**（Node 测试环境）——逻辑等价，esbuild bundle 直接跑测试
- `getAllDomains()` 合并预设 + 自定义；预设覆盖 name/emoji/color
- `getIndexForDomain()` 懒构建缓存
- `getDomainStats()` / `getGlobalStats()` 实时统计

### 6. `utils/knowledgeBase/rag.ts` — RAG 编排
- `retrieveForQuery(query, topK=4)`：路由 → 检索 → 合并 → 组装「知识库上下文」
- `buildKnowledgeSection(rag)`：带 [n] 引用编号的注入段 + 科普准则
- `extractCitations(text)`：提取回答中的引用序号，UI 展示参考来源卡
- `hasAnyKnowledge()`：全局探测知识库是否有数据

### 7. `components/DomainKnowledgeBase.tsx` — 完整管理 UI
- 领域 tab 条（内置 + 自建，含块数徽标）
- 领域信息卡：启用/停用开关、删自定义领域
- 拖拽/点击导入（txt/md/docx/pdf），导入日志
- 文档列表（查看/删除）
- 检索测试：输入问题实时查看命中片段
- 新建领域模态：名称/emoji/色板/关键词

### 8. `components/KnowledgeLibrary.tsx` — 三模式知识库
- 人格档案（原 PersonaBooks）
- 书籍学习
- 领域知识库（新增）

### 9. `components/PersonaChat.tsx` — 1v1 深度交流 + RAG
- `handleSend` 开头执行 RAG 检索（try/catch 失败不阻塞）
- `buildDialogueMessages` 注入 `rag` 参数
- 思考链前缀：`📚 知识库：📈 金融理财（命中 N 条资料）`
- AI 消息带 `sources?: KnowledgeSource[]` 持久化
- UI 气泡下：「📚 参考来源 · 📈 金融理财（N）」可展开卡片
- 知识库状态卡：已就绪 / 还是空的 + 引导去知识库页

### 10. `data/dialogueMode.ts` — 科普准则注入
- `POPULAR_SCIENCE_RULES`：双重身份（交流者 + 科普者）、结论先行分点解释、引用标 [n]、不知道就说不知道、区分资料事实与个人观点
- `buildDialogueSystemPrompt` 新增 `opts.rag?` 参数，注入知识段 + 科普规则

## 四、提示词注入链路

v31 → v32 提示词扩展：

```
系统提示词
├── 人格设定（v30）
├── 输入识别规则（v30）
├── 内在驱力（v31）
├── 此刻内在状态（v31）
├── 对 TA 的记忆（v31）
├── 📚 知识库上下文（v32 新增） ← 检索命中片段 [n]
└── 科普准则（v32 新增）         ← 双重身份 + 引用规范
```

## 五、测试与验证

### 纯函数测试
`npm run test:rag:v32` — **30/30 全绿**：
- 分词器：最长匹配、2-gram 回退、停用词过滤、段内去重、query 分词
- BM25：索引构建、搜索命中、空查询、标题加权、合并去重
- 分块：基本分块、超长滑窗、空行分段、空文本
- 路由：关键词精确命中、包含命中、多领域打分、general 兜底
- store + RAG 端到端：添加文档/检索/删除/引用提取/领域路由
- 文档解析：md/txt/不支持的格式

### 构建验证
- `npx tsc -b` ✅ 0 错误（修复 DomainKnowledgeBase examples 类型 + pdfjs destroy 类型）
- `npm run build` ✅ 32.2s（pdfjs worker asset `pdf-DEp6sk-T.js` 479KB + jszip 97KB 均正确打包）
- vite dev server 全部新模块编译 200 ✅
- Edge headless 首页文案验证 ✅

## 六、使用流程

1. **进入知识库页** → 切到「领域知识库」
2. **选择领域**（如 📈 金融理财）→ 拖拽/点击导入 `.txt/.md/.docx/.pdf`
3. **等导入完成**（分块→建索引）→ 可用「检索测试」验证
4. **进入 1v1 深度交流** → 选人格 → 开场或自由提问
5. **提问**（如「定投基金怎么选？」）→ 自动路由到金融 → 检索命中资料 → LLM 结合知识库生成科普回答 → 带 📚 参考来源卡

## 七、预览

Dev server：http://localhost:5175
- 建议走一遍：知识库 → 导入一篇 `.md` 到金融领域 → 1v1 深度交流 → 提问「基金怎么选」看参考来源卡

## 八、交付记录

- ✅ v32 核心功能：多领域知识库 + 本地 RAG + 1v1 科普交流
- ✅ tsc 0 错误；vite build 32.2s；RAG 测试 30/30 全绿
- ⏳ 桌面 exe / APK 待用户确认前端效果后打包

## 九、技术要点备忘

- **IndexedDB 持久化**：Electron 桌面和 Android（via Capacitor WebView）均支持 IndexedDB → 数据跨端本地持久
- **BM25 索引懒构建**：首次检索时构建，变更后标记失效 → 下次自动重建
- **Node 测试降级**：`typeof indexedDB === 'undefined'` 时自动切内存 Map → esbuild bundle + node 可直接跑全部 RAG 逻辑
- **pdfjs v6 类型坑**：`PDFDocumentProxy.destroy` 类型已移除，用 `(pdf as any).destroy?.()` 规避
- **DomainRecord vs DomainPreset**：`examples` 只在 `DomainPreset` 上，UI 通过 `getDomainPreset(id)?.examples` 取示例
- **知识库导入格式**：txt/md/docx/pdf；docx 用 JSZip 解 word/document.xml；pdf 用 pdfjs-dist 逐页提取（主线程 + vite ?url worker asset）
