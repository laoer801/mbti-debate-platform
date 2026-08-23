# DebateSphere v37.2 — 全站 FUI 动态背景

> 交付时间：2026-08-20  
> 版本：v37.2（基于 v37 FUI 人格观测站）

---

## 本次更新

### 全站 FUI 动态背景

在 v37 大厅/导航 FUI 化的基础上，为所有功能页面注入独立的 FUI 动态背景，实现全站科幻控制台沉浸体验。

**核心组件：**
- `FUIPageBg.tsx` — 11 种动态背景变体
- `FUIPageHeader.tsx` — FUI 编号页头组件
- `FUIPageWrapper.tsx` — 页面包裹器（背景 + 页头 + 内容 + 页脚）

**页面变体映射：**
| 页面 | Variant | 动态元素 |
|------|---------|---------|
| 辩论场 (debate) | arena | 扫描线 + 网格脉冲 |
| 场景 (scene) | scene | 场景渲染网格 |
| 广场 (square) | square | 粒子流 + 信号波 |
| 对战 (pk) | combat | 战术网格 + 警报闪烁 |
| 匹配 (match) | match | 匹配雷达 + 连接线 |
| 历史 (history) | archive | 数据流 + 编码雨 |
| 统计 (stats) | analytics | 波形图 + 数据柱 |
| 宠物 (pets) | habitat | 生命体征 + 柔光粒子 |
| 对话 (chat) | dialogue | 信号波 + 节点连接 |
| 知识库 (library) | archive | 数据矩阵 + 检索线 |
| 管理 (admin) | control | 控制台网格 + 状态灯 |
| 设置 (settings) | config | 配置矩阵 + 校准线 |

**设计原则：**
- 不改动任何页面内部代码，仅在外层包裹
- 背景动态元素使用 CSS animation + SVG，零额外依赖
- 暗色半透明面板确保内容可读性
- 所有动效遵守 `prefers-reduced-motion`

---

## 交付物

| 文件 | 类型 | 大小 |
|------|------|------|
| DebateSphere-v37.2-portable.exe | Windows 便携版 | ~72 MB |
| DebateSphere-v37.2-setup.exe | Windows NSIS 安装版 | ~80 MB |
| DebateSphere-v37.2-debug.apk | Android Debug APK | ~12 MB |
| DebateSphere-v37.2-release.apk | Android Release APK | ~6 MB |

**位置：** 项目根目录 + artifacts/ + 桌面

---

## 技术栈

- React 18 + Vite + Tailwind + framer-motion
- Electron 31 (桌面) / Capacitor (Android)
- Express + better-sqlite3 + JWT + socket.io (后端)
- FUI 设计语言：纯黑底 + 白灰阶 + mono 字体 + 线框面板 + 编号分格

---

## 使用说明

### 桌面版
- 便携版：双击 `DebateSphere-v37.2-portable.exe` 直接运行
- 安装版：双击 `DebateSphere-v37.2-setup.exe` 安装后从桌面快捷方式启动
- 注意：从 WorkBuddy 内启动可能因 `ELECTRON_RUN_AS_NODE=1` 注入而无窗口，请从资源管理器双击启动

### Android 版
- 将 APK 传输到手机安装（需开启「允许未知来源」）
- 局域网使用需先在电脑上运行 `cd server && npm start`（端口 3001）
- 手机端设置页修改服务器地址为 `http://<电脑IP>:3001`

### 管理员账号
- 自动升权：库中无 admin 时，下个注册者自动升为 admin
- 默认：master / admin123

---

**UI Designer**  
DebateSphere Project
