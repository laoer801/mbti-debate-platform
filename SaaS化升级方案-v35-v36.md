# DebateSphere 多用户 SaaS 化升级方案（v35 → v36）

> 版本：规划稿 v1.0 ｜ 日期：2026-08-18 ｜ 决策来源：用户确认（两阶段 / Supabase / 运营后台+内容管理）

## 一、现状与目标

- **现状**：v34 纯前端单机（React 18 + Vite），数据全在本地（浏览器存储 / 内置数据库），无账号、无后端、无网络依赖。桌面 Electron + Android APK 双端。
- **目标**：多用户 SaaS——账号体系、云端数据同步、实时在线人数、运营后台 + 内容管理（v35）；真人实时辩论对战房间（v36）。
- **铁律**：前端 16 人格引擎 / LLM / RAG / 视频知识等全部保留，不做技术栈替换。

## 二、选型结论（已确认）

| 项 | 选择 | 理由 |
|---|---|---|
| 后端 | **Supabase 云服务（BaaS）** | 免费层（500MB DB / 5万 MAU / Realtime 200 并发），Auth + PostgreSQL + Realtime + Studio 后台一体，免运维 |
| 前端 | React 18 + Vite **不动** | `@supabase/supabase-js` 纯前端 SDK，Electron / Capacitor / Web 三端通用 |
| 认证 | 邮箱 + 密码 | 微信 OAuth 需企业认证资质，个人项目暂不可行 |
| 离线策略 | 游客本地模式保留 | 未登录或断网时照常单机使用，登录后云同步，双轨并行 |

## 三、阶段 A（v35）：账号 + 云同步 + 在线 + 运营后台

### 3.1 数据模型（SQL 迁移）

| 表 | 用途 | 关键字段 |
|---|---|---|
| `profiles` | 用户资料 | uid、nickname、mbti、avatar_url、last_seen_at |
| `persona_states` | 16 人格状态云端 | uid、type_id、state JSONB、updated_at（PK uid+type_id） |
| `persona_memories` | 人格记忆云端 | uid、type_id、kind、content、created_at |
| `kb_documents` | 领域/视频知识库云端 | uid、domain_id、doc_id、title、chunks JSONB、meta |
| `debate_topics` | 辩论主题（后台可编辑） | title、description、sides、active |
| `persona_overrides` | 人格提示词覆盖（后台可编辑） | type_id、system_prompt_override、path_advice_override |
| `usage_logs` | 使用统计 | uid、event、payload、created_at |
| 在线状态 | Realtime Presence 机制 | 无需建表，SDK 自带在线列表 |

### 3.2 前端改造清单

1. **`utils/supabaseClient.ts`**：客户端初始化，URL / anon key 从设置页读取（localStorage 配置，不硬编码进仓库）
2. **Auth**：登录 / 注册 / 登出页（邮箱+密码），支持游客模式跳过
3. **`utils/cloudSync.ts`**：人格状态 / 记忆 / 知识库三向同步（本地 ↔ 云，冲突以新为准；登录自动开启，离线降级本地）
4. **在线仪表盘**：Realtime Presence 订阅 → 首页显示在线人数 / 在线列表
5. **内容管理**：`debate_topics` / `persona_overrides` 启动时拉取覆盖本地（仅 admin 可写）
6. **`#/admin` 受保护路由**：数据看板（实时在线、注册数、人格热度、使用统计图表）+ 内容管理表单
7. **设置页**：Supabase URL / anon key / LLM Key 统一进设置页

### 3.3 后台双通道

- **Supabase Studio**（免费内置，零开发）：用户管理、封禁、SQL、表浏览
- **自建 `/admin`**（定制体验）：运营看板 + 内容编辑，判断 `role = admin`

## 四、阶段 B（v36）：真人实时辩论对战

| 表 | 用途 | 关键字段 |
|---|---|---|
| `rooms` | 对战房间 | title、topic、mode、status、players JSONB、created_by |
| `room_messages` | 实时发言 | room_id、user_id、speaker_type_id、content、turn、created_at |

- 房间流程：创建 / 加入 / 观战 → 准备 → 逐轮发言（LLM 辅助思考 + 真人确认）→ 裁判 → 报告
- 实时同步：Postgres Changes → WebSocket 广播，前端 `useRoom()` hook 订阅
- 报告云端保存 + 历史回看

## 五、工作量与风险

- v35 ≈ 1 个版本迭代；v36 ≈ 1 个版本迭代（均按惯例打包 exe + APK）
- 风险 ①：免费层 Realtime 并发 200，小规模够用，规模上来再议
- 风险 ②：知识库全文上云体积——chunk 化后 500MB 够用；超限可降级为只同步元数据
- 风险 ③：云功能需联网，游客本地模式兜底离线体验

## 六、启动前置（需要用户提供）

1. 注册 [supabase.com](https://supabase.com) 免费账号 → New Project（区域选 Singapore / Tokyo，离国内近）
2. 提供 **Project URL** 与 **anon public key**（将写入设置页，不进代码仓库）
3. 凭据到位后开始 v35 实施：SQL 迁移 → 前端骨架 → 联调 → 打包
