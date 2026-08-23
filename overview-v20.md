# v20 交付概览：自动辩论 + 学习系统 + 主题选择

## 完成的功能点

1. **主题选择弹窗 (TopicPicker)**
   - 大厅点击"开始辩论"（≥2人）后弹出主题选择模态
   - 4 大推荐分类（科技前沿/社会议题/人生哲学/校园职场），支持自定义输入 + 随机抽取
   - 玻璃拟态 UI，选中态带 accent 边框高亮

2. **用户可添加书籍（知识库）**
   - 知识库页新增"添加书籍"按钮和模态表单
   - 字段：书名、作者、主题标签、书中观点/金句、读书笔记
   - 保存后显示在"我的藏书"区，随机 accent 色书封，人格可实时学习引用

3. **人格实时学习系统 (learningStore)**
   - localStorage 双存储：`mbti_user_books`（用户书籍）+ `mbti_debate_sessions`（历史辩论会话）
   - `getLearningMaterial(typeId, topic, max)`：按话题关键词相关度打分，返回书籍观点 + 历史辩论精华
   - 注入辩论发言：开场/反驳/深化 三种策略分别以口语化方式引用学习素材

4. **自动辩论 + 插话打断**
   - 辩论室挂载即自动开启，无需用户手动触发
   - 人格自主发言循环，`MAX_AUTO_ROUNDS = 10` 上限，自动调度下一轮
   - 用户随时插话：输入框按 Enter 打断 → 发言后立即恢复自动辩论
   - 顶部显示"⚡ 自动辩论中"徽章，底部提示"人格正在自主辩论 · 输入内容并按 Enter 即可插话打断"

5. **自然语言生成（辩论引擎重构）**
   - 删除机械复读句式（`"${topic}"——${stanceText}` 等）
   - 新增 `buildOpening`/`buildReaction`/`buildDeepen` 三层策略 + `argumentExpanders` 自然论证句池
   - `weaveLearning()`：按人格类型以口语化引用书籍/历史（思考型用"正好，我最近在读《…》"，情感型用"我最近看《…》的时候…"）

6. **会话持久化**
   - App 层 `hydrateSessions` / `persistSessions`：localStorage 自动恢复与落盘
   - 补全 Message 缺省字段（id/typeName/emoji/color/timestamp）

## 构建与部署

- **前端构建**：`npm run build` 16.92s，TS 零错误
- **Electron 打包**：NSIS 安装包 81MB + 便携版 72MB
- **产物路径**：
  - `D:/mbti-debate-platform/electron-app/dist-v20/`
  - 桌面：`MBTI人格辩论平台v20-Setup.exe` / `MBTI人格辩论平台v20-便携版.exe`

## 验证截图

- `debug/v20-03-topic-picker.png` — 主题选择弹窗
- `debug/v20-04-debate-room.png` — 自动辩论徽章
- `debug/v20-06-interrupt.png` — 插话打断 + 自然回应
- `debug/v20-09-add-book-form.png` — 添加书籍表单
- `debug/v20-10-book-added.png` — 我的藏书区展示
