# DebateSphere 思辩星球 🌌

> **让每一种人格，都成为一颗星球。**
> 16 种 MBTI 人格 × AI 多智能体辩论 × 像素宠物战斗 的全栈实时辩论平台。

**Tech Stack:** React 18 · Vite · Tailwind · framer-motion · Express · better-sqlite3 · Socket.IO · Capacitor (Android) · Electron (Desktop)

---

## ✨ 核心特性

### 🧠 深度人格引擎
- 完整 **16 型 MBTI 人格测试**，五维驱力（认知/情感/意志/社交/表达）刻画人格画像
- **四层人格引擎**：personaDrives 五维驱力 + personaEngine 确定性演化 + personaMemory 偏好/经历/关系沉淀
- 人格会随辩论历史**演化**，不是标签，是活着的灵魂

### ⚔️ PK 实时对战（服务器权威）
- 房间制实时辩论：立论 → 自由辩论 → 总结 → AI 裁判评分（逻辑30% / 论据25% / 表达20% / 反驳15% / 风度10%）
- **服务器权威宠物战斗**：发言即攻击——伤害由服务端计算并广播，两端画面一致
- 8 种像素宠物（cat/dog/bird/slime/dragon/bunny/fox/penguin）+ 装备加成 + 积分商城 + 升级系统
- 伤害公式：`max(1, atk − def/2) × 发言质量乘数 × 随机`，速度决定暴击率

### 🗣️ 语音输入（PC + 手机 + 桌面端）
- Web Speech API 实时语音转文字，支持连续识别 + 中间结果
- 错误全可视化：非安全上下文 / 权限拒绝 / 设备缺失各有明确提示
- 服务端内置 **HTTPS 自签证书（3443 端口）**，手机访问即可解锁麦克风

### 🤖 AI 多智能体辩论
- LLM 驱动的 AI 辩手：审题 → 检索 → 立场 → 发言 → 裁判 完整流程
- 思考链折叠展示，打字机流式输出
- 1v1 对话模式 + 自由选题

### 📚 知识引擎
- **本地 RAG**（纯前端）：中文分词 + BM25 + IndexedDB，支持 txt/md/docx/pdf 导入
- **每日新闻学习**：8+ RSS 源自动抓取 → 结构化入库 → 辩论/对话自动引用时事
- 11 个内置领域知识库

### 🎨 视觉体验
- 深空星系设计语言：玻璃质感 + 16 色人格光谱（Linear/Vercel 基准）
- FUI 人格观测站：纯黑底 + 线框面板 + 点阵星球 + 雷达扫描
- 辩论报告 + 专业建议（三色卡 + 零依赖 Markdown 渲染）

### 📦 多端交付
- Web（Vite）
- Android（Capacitor，APK 可装）
- Desktop（Electron，Windows 便携版 / 安装版）

---

## 🚀 快速开始

### 前置要求
- Node.js ≥ 18
- npm

### 1. 启动后端

```bash
cd server
npm install
npm start
# → http://localhost:3001 (HTTP)
# → https://localhost:3443 (HTTPS，手机语音输入用，首次访问需信任自签证书)
# 启动日志会打印局域网地址，手机同一 WiFi 可直接访问
```

### 2. 启动前端（开发）

```bash
cd client
npm install
npm run dev
# → http://localhost:5173
```

### 3. 构建生产版

```bash
cd client
npm run build        # tsc -b && vite build，产物在 dist/
```

### 4. 构建 Android APK

```bash
cd client
npx cap sync android
cd android
./gradlew assembleDebug assembleRelease
```

### 5. 构建桌面端

```bash
cd desktop
npm install
npx electron-builder --win portable    # 便携版
npx electron-builder --win nsis        # 安装版
```

---

## 🧭 功能地图

| 模块 | 说明 |
|------|------|
| 人格测试 | 16 型 MBTI 完整测评 + 人格画像 |
| 辩论大厅 | AI 辩论 / 1v1 对话 / 自定义辩题 |
| PK 竞技场 | 房间实时对战 + 宠物战斗 + AI 裁判 |
| 知识库 | 领域知识 + 个人文档 RAG + 每日新闻 |
| 宠物系统 | 养成 / 商城 / 装备 / 排行榜 |
| 社区广场 | 观点广场 + 辩论报告分享 |
| 管理后台 | 内容管理 + 在线状态 + 人格覆盖 |

---

## 🏗️ 项目结构

```
mbti-debate-platform/
├── client/                 # React 前端 (Vite + TS)
│   ├── src/
│   │   ├── pages/          # 页面（HallPage/PKRoom/PersonalityTest...）
│   │   ├── components/     # 组件（PetBattleField/VoiceInput/PixelPet...）
│   │   ├── utils/          # RAG/新闻/人格引擎等核心逻辑
│   │   └── data/           # 人格数据/提示词
│   └── android/            # Capacitor Android 工程
├── server/                 # Express 后端
│   ├── routes/             # 10 组路由（auth/debate/pk-rooms/pets/news...）
│   ├── db.js               # better-sqlite3 建表
│   └── data/debate.db      # SQLite 数据库（运行时生成，不入库）
└── desktop/                # Electron 桌面端
```

---

## 🔐 安全说明

- 数据库（`server/data/`）、HTTPS 证书（`server/certs/`）、APK 签名密钥库（`*.keystore`）均在 `.gitignore` 中，**不会提交**
- JWT 密钥默认值仅用于本地开发，生产环境请通过 `JWT_SECRET` 环境变量覆盖

---

## 📜 版本历史

| 版本 | 里程碑 |
|------|--------|
| v40 | PK 服务器权威宠物战斗 + 语音输入三端修复（HTTPS 3443） |
| v39 | 新闻学习系统：RSS 抓取 → RAG 入库 → 辩论自动引用时事 |
| v38 | 每日新闻学习 + 知识库第五模式 |
| v37 | FUI 人格观测站（全站动态背景） |
| v36 | 玻璃质感 UI + 16 色人格光谱 + Bento 布局 |
| v35 | 多人在线 + 后台管理 |
| v34 | 视频知识导入（srt/vtt 切块入库） |
| v33 | 辩论报告 + 专业建议 |
| v32 | 纯前端本地 RAG（BM25 + IndexedDB） |
| v31 | 四层人格引擎（人格演化 + 记忆沉淀） |
| v29-30 | 输入识别闭环（三层意图识别） |
| v28 | LLM 多智能体辩论 |
| v24 | AI 语音（16 音色） |

---

## 📄 License

本仓库采用私有授权方式发布，源码开放供学习参考。商业使用请先联系作者。

---

*DebateSphere 思辩星球 —— 探索人格的星辰大海 🚀*
