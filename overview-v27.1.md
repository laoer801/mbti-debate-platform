# v27.1「16 人格书籍引用全覆盖」迭代说明

## 一句话
让「引用书籍/观点」从只有辩论模式、只覆盖部分场景，变成 **16 个人格处处都能引用各自的思想弹药库**——辩论、聊天、界面展示全覆盖。

## 本次改动（4 项）

### 1. 聊天模式（PersonaChat）16 人格也会引用书籍 ⭐ 核心
- 新增 `weaveSources(typeId)`：从 `PERSONA_SOURCES` 取该人格匹配的书籍/思想家，织入本地模板回复（思考型/情感型各一套口语化模板）
- 织入 `buildOpening / buildReaction / buildClosing / buildDeepen` 四个回复策略，概率 35%–45%
- 实测：16 人格 × 6 次抽样，96 次回复中 42 次提及各自书籍（44%），句子自然：
  - INTJ：「这让我想到奥卡姆剃刀里的一个判断——如无必要，勿增实体。放到这个辩题上，正好可以用『最简解释优先』原则砍掉对方复杂的假设链。」
  - ISFP：「我忽然想起梭罗《瓦尔登湖》——简朴生活，回归真实。用来看今天这个话题，正好可以用自然与真实的尺度衡量辩题，反对过度人造的复杂。」

### 2. 本地模板 toneSuffixes 补全 16 人格
- 原只有 INTJ/INTP/ENTJ/ENTP/INFJ/INFP 6 个人格有专属结尾句式，补全 ENFJ/ENFP/ISTJ/ISFJ/ESTJ/ESFJ/ISTP/ISFP/ESTP/ESFP 共 10 个（每个 3 句，风格与 tonePrefixes 呼应）

### 3. UI 显性展示「思想弹药库」
- **人格大厅（HallPage）**：每张人格卡新增 📚 弹药库行（如「📚 尼采《善恶的彼岸》·卡尼曼《思考，快与慢》·奥卡姆剃刀」），hover 显示完整核心思想
- **1v1 对话设置页（PersonaChat）**：人格信息卡新增「📚 思想弹药库」区块，列出全部书目 + 核心思想，并注明「聊天中 TA 会引用这些书与观点」

### 4. 辩论模式增强（v27 已有能力上加码）
- `buildSourceSection(typeId, topic)` 新增按辩题挑选提示：优先选择与辩题关联最强的弹药库条目；弹药库与资料包冲突时以资料包事实为准、用弹药库思想框架展开

## 涉及文件
- `client/src/utils/debateEngine.ts`（weaveSources + toneSuffixes + 4 策略织入）
- `client/src/utils/debatePrompts.ts`（buildSourceSection 增强）
- `client/src/components/HallPage.tsx`（人格卡 📚 行）
- `client/src/components/PersonaChat.tsx`（设置页弹药库区块）
- 新增测试脚本 `client/scripts/test-sources-v27.1.ts`（`npm run test:sources`）

## 构建与验证
- TypeScript 零错误；Vite build 25.1s（`index-BmPDoTwT.js`）
- dist 与 Android assets 均已同步；Gradle 直启构建 `BUILD SUCCESSFUL in 2m 51s`（215 tasks）
- **APK 已打包**：`MBTI辩论平台-手机版.apk`（release 6.1MB）/ `MBTI辩论平台-手机版-debug.apk`（debug 7.5MB），另存 `artifacts/DebateSphere-v27.1-{debug,release}.apk`；包内 assets 确认含 `index-BmPDoTwT.js`

## 待办
- 桌面 Electron 版仍落后于手机端（v23 后未同步）
