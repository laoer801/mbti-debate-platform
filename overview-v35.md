# DebateSphere v35 — 多人在线 + 后台管理

> 升级目标：从单机 AI 聊天工具 → 多用户 SaaS 平台（账号体系 / 云同步 / 实时在线 / 运营后台 / 内容管理）

## 一、后端（server/，Express + better-sqlite3 + JWT + socket.io）

| 文件 | 变更 |
|------|------|
| `db.js` | users 表加 `role`/`banned` 列 + 幂等迁移；新增 `debate_topics` / `persona_overrides` / `usage_logs` 三表 |
| `secret.js` | 新建：JWT_SECRET 共享模块（auth/admin/index 共用） |
| `presence.js` | 新建：socket.io 在线用户管理（Map + broadcastPresence） |
| `routes/auth.js` | 注册自动 admin（库中无 admin 时下个注册者升 admin）；登录 banned 校验；JWT 携带 role |
| `routes/admin.js` | 新建：adminMiddleware（JWT + 数据库 role 双校验）→ stats / users 管理 / topics CRUD / overrides CRUD |
| `index.js` | 挂载 admin 路由；公开接口 `/api/content/topics|overrides`、`/api/stats/online`；socket `identify` 事件关联账号 |

## 二、前端（client/src/）

| 文件 | 变更 |
|------|------|
| `types/index.ts` | TabId 加 `'admin'`；User 加 role/banned/created_at/login_at |
| `hooks/useAuth.tsx` | 新增 `getToken()` 导出 |
| `hooks/usePresence.ts` | 新建：socket.io presence hook（在线列表/人数/连接状态） |
| `utils/contentSync.ts` | 新建：启动拉取云端主题 + 人格覆盖，localStorage + 内存双缓存，离线静默降级 |
| `components/TabBar.tsx` | 「N 人在线」青色脉冲徽章（connected 才显示）；admin 专属「后台」入口（ADMIN 品红标签） |
| `components/AdminPage.tsx` | 新建：三子页 — 数据看板（实时在线 + 4 统计卡 + 人格热度 + 7 天趋势）/ 用户管理（设管理员/封禁）/ 内容管理（主题 CRUD + 人格提示词覆盖） |
| `App.tsx` | AdminPage 懒加载 + `activeTab==='admin'` 分支 + 快捷键 Ctrl+A + 非 admin 权限守卫（跳回大厅）+ 启动 `initContentSync()` |
| `utils/debatePrompts.ts` | `buildPersonaSystemPrompt` 接入 `getPersonaOverride(typeId)`（后台编辑的人格提示词在辩论模式生效） |
| `data/dialogueMode.ts` | `buildDialogueSystemPrompt` 同样接入覆盖（1v1 对话模式生效） |

## 三、验证结果

- ✅ `tsc -b` 0 错误；`vite build` 19.36s（AdminPage 独立分包 17.12 kB）
- ✅ 后端冒烟：master 注册自动 admin → stats 返回 16 用户 → 无 token 访问 401
- ✅ 回归测试 220 项全通过（v31:69 / v32:30 / v33:79 / v34:42）
- ✅ 后端 `node --check` 4 文件语法全通过

## 四、使用说明

1. **管理员账号**：`master` / `admin123`（旧库无 admin → 自动成为首个管理员）
2. **后台入口**：右上角 ADMIN 徽章旁「后台」按钮，或 Ctrl+A
3. **升管理员**：后台 → 用户管理 → 「设为管理员」（或库中无 admin 时新注册账号自动成为 admin）
4. **内容管理生效链路**：后台改主题/人格覆盖 → 前端启动时拉取（或刷新）→ 辩论/对话即时生效
5. **局域网部署**：`node server/index.js` 起 3001 端口，前端 `npm run dev`，朋友连同一 WiFi 即可看到实时在线人数

## 五、v35 打包交付（2026-08-19）

| 产物 | 位置 | 大小 |
|------|------|------|
| `MBTI人格辩论平台v35-便携版.exe` | 桌面 + 项目根 + desktop/release | 69 MB |
| `MBTI人格辩论平台v35-安装版.exe` | 桌面 + 项目根 + desktop/release | 75 MB |
| `MBTI辩论平台v35-debug.apk` | 项目根 + artifacts | 9.5 MB |
| `MBTI辩论平台v35-release.apk` | 项目根 + artifacts | 7.9 MB |

- 旧版 v34 全部移入 `trash/`（可恢复）
- 打包耗时：gradle 3m34s（终极绕行全生效）+ electron portable 3m11s + NSIS 25s，双 exit=0

### ⚠️ 局域网多人在线使用方式（重要）

v35 是**双端版本**，电脑上需先启动后端再打开应用：

```
cd D:\mbti-debate-platform\server && npm start    # 启动后端（3001 端口）
```

- **本机使用**：直接打开 exe / APK，前端默认连 localhost:3001，无需配置
- **朋友同 WiFi 使用**：
  1. 手机/朋友电脑连同一 WiFi
  2. 应用内「设置」→ 服务器地址改为 `http://<你电脑的局域网IP>:3001`（如 http://192.168.1.5:3001）
  3. 在「设置」里查你的 IP：Windows 运行 `ipconfig` 看 IPv4 地址
- 注册账号后，右上角出现「N 人在线」徽章，后台可看到实时在线列表

## 六、后续（v36+ 规划）

- 真人实时辩论对战房间（当前 PK 房间已支持，可扩展匹配机制）
- Supabase 迁移（凭据已暂存，先自建后迁）
- usage_logs 事件埋点接入前端（当前表已建，埋点未接）
