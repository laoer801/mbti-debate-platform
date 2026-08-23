# v34 视频知识 + 人格学习

> 版本：v34 ｜ 日期：2026-08-18 ｜ 状态：✅ 已打包交付（exe + APK）

## 需求

用户想把喜欢的**抖音科普视频**内容提炼成文字、记录保存，并让**辩论的人格也能学习**这些知识。

## 架构约束与落地方案

用户方案涉及 douyin-fetch-skill（Playwright 抓取 + mlx-audio 语音识别）与 kb-rag（Ollama + bge-m3），但本项目是**纯前端**（Electron + Android APK），无 Python 运行时；且 **mlx-audio 仅支持 Apple Silicon（Mac M 芯片）**，Windows 上无法安装。

因此采用**导入通道**方案（用户确认：导入全开 + 全局共享 + 辩论&对话双接入）：

```
抖音科普视频
  ├─ ① 粘贴文案/字幕（抖音 App 复制全文）
  ├─ ② 上传字幕文件（.srt/.vtt/.txt/.md，自动解析时间轴）
  └─ ③ 外部转录产物（transcript.md 等直接导入）
        ↓
  切块入库（复用 v32 BM25 + IndexedDB，隐藏领域 videos）
        ↓
  辩论/1v1 对话时自动检索 → 注入人格提示词 → 带 📺 引用
```

## 功能清单

### 1. 视频知识模块 `utils/videoKnowledge.ts`（新建）
- **字幕解析**：`parseSrt` / `parseVtt` / `parseSubtitleFile`（按扩展名路由，清理时间轴/序号）
- **元数据层**：localStorage `mbti_video_books` 保存 VideoBook（标题/来源链接/标签/摘要/全文/导入方式）+ 内存兜底（Node 测试环境）
- **内容层**：`importVideoKnowledge` 切块 → `addDocument('videos', …)` 入库，BM25 可检索
- **检索**：`searchVideos` / `retrieveVideoKnowledge`（返回提示词段或 null）
- **提示词注入**：`buildVideoKnowledgeSection`（「你学过的视频知识」段，[n] 引用 + 使用准则）
- **删除链路**：`removeVideoBook` / `clearVideoBooks`（用入库 docId 精确定位 chunk）

### 2. 辩论模式接入（全局共享）
- `debatePrompts.ts`：`PersonaSpeechContext` 加 `videoKnowledge?`，`buildSpeechMessages` 注入「你学过的视频知识」段（与资料包并列，冲突时以资料包为准）
- `debateArena.ts`：`generateArenaSpeech` 每轮发言前检索视频知识（失败静默跳过，不阻塞辩论）

### 3. 1v1 对话接入
- `dialogueMode.ts`：`buildDialogueSystemPrompt` / `DialogueContext` 加 `videoKnowledge?`
- `PersonaChat.tsx`：提问时检索视频知识 → 注入提示词 + 合并进参考来源卡（📺 视频收藏，品红色）

### 4. 管理 UI `components/VideoKnowledgeLibrary.tsx`（新建）
- 导入面板：粘贴文字 / 上传字幕文件（多选）/ 标题·来源链接·标签·摘要
- 视频列表：展开查看全文、删除、清空、原视频链接跳转
- 检索测试：输入问题实时看人格会引用哪些视频知识
- 接入位置：知识库页「视频知识」按钮（第四个浏览模式）

## 验证

| 检查项 | 结果 |
|--------|------|
| `test:video:v34` | **42/42 全绿** ✅ |
| `npx tsc -b` | **0 错误** ✅ |
| `npm run build` | **1972 模块，19.42s** ✅ |
| dev 预览 | **http://localhost:5176/** ✅ |

## 文件清单

- **新增 3 个**：`utils/videoKnowledge.ts` / `components/VideoKnowledgeLibrary.tsx` / `scripts/test-video-v34.ts`
- **修改 5 个**：`utils/debatePrompts.ts` / `utils/debateArena.ts` / `data/dialogueMode.ts` / `components/PersonaChat.tsx` / `components/KnowledgeLibrary.tsx`
- **配置**：`package.json` 加 `test:video:v34`

## 待办

- ~~用户确认前端效果后打包~~ ✅ 2026-08-18 已打包交付

## 交付产物（v34）

| 产物 | 大小 | 位置 |
|------|------|------|
| 桌面便携版 `MBTI人格辩论平台v34-便携版.exe` | 71.9 MB | 项目根目录 + 桌面 |
| 桌面安装版 `MBTI人格辩论平台v34-安装版.exe` | 79.1 MB | 项目根目录 + 桌面 |
| 手机版 debug `MBTI辩论平台v34-debug.apk` | 8.8 MB | 项目根目录 + artifacts/ |
| 手机版 release `MBTI辩论平台v34-release.apk` | 7.3 MB | 项目根目录 + artifacts/ |

- 旧版（v20/v28/v29/v31 exe、旧 APK、zip）已全部移入 `trash/`
- 验证：Gradle BUILD SUCCESSFUL（3m48s，215 tasks）；electron-builder portable + nsis 均 exit=0
