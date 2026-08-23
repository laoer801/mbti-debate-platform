# v23 交付概览：DebateSphere「思辩星球」电影感重设计

> 从 v22 的极简风格全面升级为 2026 电影感 UI：告别极简 → Bento UI + 玻璃态 + 霓虹深空 + 沉浸式动效叙事。纯 CSS 动效层实现，不引入额外动画库（已有 framer-motion 保留用于进入动画）。

## 一、设计系统（Design Tokens）

| Token | 值 | 说明 |
|---|---|---|
| `--color-accent` | `#22d3ee` | 霓虹青（主强调色） |
| `--color-accent-3` | `#f472b6` | 霓虹品红（次强调色） |
| `--color-bg` | `#05060f` | 深空底色 |
| `--glass-bg` | `rgba(13,15,34,.62)` | 玻璃拟态背景 |
| 渐变文本 | `#22d3ee → #a78bfa → #f472b6` | Hero / 标题渐变 |
| 字体 | Space Grotesk + 系统字体栈 | Google Fonts 引入 |

- `.dark` 主题 CSS 变量整体重写（深空蓝紫 + 霓虹青/品红）
- `light` / `.high-contrast` 主题保持不变，无障碍对比仍可用

## 二、新增动效层 `client/src/debateSphere.css`（~500 行 CSS-only）

| 组件 | 效果 |
|---|---|
| `.planet-logo` | 旋转星球 Logo（conic 光环 + 核心） |
| `.hero-title` | 超大「辩·万物」渐变浮动动画 |
| `.scramble` | 故障/乱码文字（data-text + clip-path 偏移） |
| `.neon-btn` | 霓虹呼吸「开始辩论」按钮 |
| `.particle-burst` | 按钮点击粒子爆炸（JS 生成粒子 + CSS 变量） |
| `.bento-grid` / `.bento-2x2` / `.bento-1x1` | Bento 网格布局 + aura 光晕 |
| `.thinking-orb` / `.thinking-dots` | AI 思考循环动画（conic 光环 + 呼吸点） |
| `.drawer-overlay` / `.drawer-menu` | 全屏抽屉（clip-path 圆展开） |
| `.tag-marquee` | 热门标签滚动 |
| `.reveal` | 滚动渐入 |
| `.side-badge` / `.neon-bar` | 正反霓虹徽章 / 裁判五维霓虹进度条 |

## 三、页面改造

### 1. 导航（TabBar 重写）
- 左侧旋转星球 Logo + DebateSphere 品牌
- 右侧全屏抽屉菜单：4 大分组（人格大厅 / 辩论场 / 观点广场 / 我的空间），编号标签 01-12，激活指示点
- Escape 关闭 + body 滚动锁定；桌面端保留横向 Tab

### 2. Hero + Bento（HallPage 重写）
- Hero：徽章 + 超大「辩·万物」+ scramble 副标题 + 霓虹「开始辩论」按钮（粒子爆炸）+ 「匹配置测试」ghost 按钮
- Bento Grid：热门辩论场轮播（3.2s）/ 观点广场 / 快速匹配（随机 1v1）/ 今日热点 + 2x2 人格大厅（geo-avatar 几何头像 + 标签 marquee）
- 保留完整 16 人格选择器（搜索 + 分类 + 翻转/勾选），framer-motion stagger 进入
- Bento 卡片点击 → 滚动/开始辩论/跳转对应 Tab

### 3. 辩论室（DebateRoom）
- 裁判五维评分 → 霓虹进度条（.neon-bar）
- AI 思考中 →「辩手思考中…」+ thinking-dots
- 空状态 → thinking-orb 动画
- 正/反徽章 → 霓虹侧边徽章（青/品红）

### 4. 基础设施
- `index.html`：标题「DebateSphere · 思辩星球」、theme-color #0a0b22、Space Grotesk 字体
- `main.tsx` 引入 `debateSphere.css`
- 保留：无障碍 aria、键盘快捷键（Ctrl+1~0/Q/K）、懒加载、所有既有功能

## 四、构建与交付

- **前端构建**：`npm run build` TS 零错误，9.29s，29 个资源
  - 主入口：`index-DjQ5Ft90.js`（230KB，gzip 89KB）+ `index-LcN7CR_H.css`（61KB）
- **APK 打包**：`gradlew assembleDebug assembleRelease` 成功（3m14s）
  - debug 4.94MB / release 3.90MB，apksigner 验证通过（release 证书 `CN=MBTI Debate Platform`）
- **产物路径**：
  - `D:/mbti-debate-platform/MBTI辩论平台-手机版.apk`（release）
  - `D:/mbti-debate-platform/MBTI辩论平台-手机版-debug.apk`（debug）
  - `D:/mbti-debate-platform/artifacts/DebateSphere-v23-{release,debug}.apk`
- **验证**：解包 APK，`assets/public/index.html` 标题「DebateSphere · 思辩星球」+ 资源 hash 与新版一致

## 五、备注

- `client/dist` 已更新为新构建；`client/dist-new-keep-*` 为新构建备份（可删）
- `client/android/app/src/main/assets/public_old_*` 为旧 web 资产备份（可删）
- 标准 `dist` 目录名被本机 WorkBuddy/系统服务锁定（rename 报 Device busy），如需重命名请先重启相关服务或注销会话后操作
