# DebateSphere v37 — FUI 人格观测站

> **版本**: v37.1 | **日期**: 2026-08-20 | **代号**: Observatory

## 版本概要

v37 将 DebateSphere 从玻璃质感全面升级为 **黑白 FUI（Future UI）科幻控制台风**，灵感来自天文观测蓝图与 Ericsson 指挥舱界面。纯黑底 + 白灰阶 + 单一品牌强调色 #7c88f0，线框面板、mono 字体、扫描线、点阵星球——克制到极致的「人格观测站」概念。

**功能零损失**：16 人格辩论/对话、PK 对战、观点广场、知识库 RAG、视频知识、人格状态引擎、宠物系统、后台管理、云同步、在线人数——全部保留，仅视觉层重构。

---

## 核心改造

### 1. FUI 全局样式层 `observatory.css`（新增）

- **纯黑底色** `#050505` + 72px 细坐标网格（顶部渐隐）+ 全局扫描线覆层
- **白灰阶排版**：mono 字体（JetBrains Mono / Space Mono）、大写英文标签、编号徽章
- **唯一强调色** `#7c88f0`（品牌蓝紫，只出现在 LIVE 点、星球微光、雷达扫描线、目标标记）
- **HUD 工具类**：线框面板 `.fui-panel`、切角装饰 `.fui-corners`、mono 标签 `.fui-label`、细线进度条 `.fui-bar`、编号徽章 `.fui-badge`、关键词标签 `.fui-kw`、信号柱 `.fui-signal`

### 2. 动效组件（新增）

| 组件 | 文件 | 效果 |
|------|------|------|
| GlobeCanvas | `components/GlobeCanvas.tsx` | 1500 点阵星球，真实大陆高斯簇分布，正交投影自转，经纬网格随转明暗，刻度环 + SIG-XXXX 目标标记（坐标玩梗 NT·NF·SJ·SP） |
| DataStream | `components/DataStream.tsx` | 三层正弦波形 + 流动数据点，LIVE 面板实时数据流 |
| RadarSweep | `components/RadarSweep.tsx` | SVG 旋转扫描雷达，Hero 区右侧 |
| TiltCard | `components/TiltCard.tsx` | 3D 倾斜卡片（perspective + rotateX/Y + glare 高光），零 re-render |
| CountUp | `components/CountUp.tsx` | 数字滚动动画（IntersectionObserver + easeOutExpo + tabular-nums） |

所有动效尊重 `prefers-reduced-motion`。

### 3. 人格大厅重写 `HallPage.tsx`

- **Hero**：超大 mono 标题 `SPHERE.` +「SIXTEEN MINDS. ONE ARENA.」+ 雷达扫描 + 粒子爆破
- **控制台三分格**：
  - 左：SYSTEM STATUS（PERSONAS 16/16、ENGINE、RAG INDEX 进度条）+ 环境指标 + 通知流
  - 中：canvas 点阵星球（自转 + 经纬网格 + 刻度环 + 目标标记）
  - 右：辩论数据折线图 + WIN RATE + DATA STREAM 三层波形 + 76% 同步圆环 + 快捷入口
- **01 人格光谱矩阵**：16 人格按 NT/NF/SJ/SP 四组陈列，P-001~P-016 编号卡片（搜索、分类筛选、点选辩手、书籍弹药库、人格状态记忆全部保留）
- **02 观测协议**：DUEL / SPECTATE / DIALOGUE 三模式入口
- **底部状态栏**：MODE / OPERATOR / LOCAL TIME / SYSTEM ID / SIGNAL 信号柱

### 4. 导航栏重写 `TabBar.tsx`

- mono 大写英文标签（HALL / ARENA / SQUARE / KNOWLEDGE / PETS / PK / STATS / SETTINGS）
- 线框在线徽章 + LOGIN/EXIT
- 抽屉菜单同步 FUI 化
- 登录、ADMIN 入口、在线人数功能原样保留

### 5. 全站 FUI 覆写（observatory.css 全局段）

纯 CSS 层覆写，不改任何 .tsx 逻辑：

| 旧类 | FUI 覆写 |
|------|---------|
| `.glass` / `.bento-card` / `.card-spotlight` | 线框面板（rgba 白 2% + 1px 细线） |
| `.neon-btn` / `.btn` / `.btn-primary` | FUI 按钮（白底黑字 / 线框 / mono 大写） |
| `.tag` / `.tag-active` | FUI 关键词标签 |
| `.input-field` | FUI 输入框（mono + 线框） |
| `.bubble-gradient` | FUI 气泡（暗灰 + 细线） |
| `.thinking-orb` | FUI 旋转色 |
| `.display-title` / `.gradient-text` | 纯白无渐变 |
| `.rounded-2xl` / `.xl` / `.lg` | 全局收敛为 3-4px 切角 |
| 滚动条 | FUI 细黑底 + 白线 |

---

## 验证

- `tsc -b` 0 错误
- `vite build` 通过（10.56s）
- FUI 类全部确认进 CSS 产物
- 前端 4173 + 后端 3001 双在线，功能验证通过

---

## 交付清单

| 产物 | 路径 |
|------|------|
| Windows 便携版 | `MBTI人格辩论平台v37-便携版.exe` |
| Windows 安装版 | `MBTI人格辩论平台v37-安装版.exe` |
| Android Debug APK | `MBTI辩论平台v37-debug.apk` |
| Android Release APK | `MBTI辩论平台v37-release.apk` |

旧版 v35 产物已移入 `trash/`。

---

## 技术栈

- React 18 + Vite + Tailwind + framer-motion
- Capacitor 8 → Android APK
- Electron 31 → Windows exe
- Express + better-sqlite3 + JWT + socket.io（后端）
- Canvas 2D（点阵星球）+ SVG（雷达）+ CSS 动画（扫描线/波形/呼吸点）
