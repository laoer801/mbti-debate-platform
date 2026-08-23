# v24 交付概览：DebateSphere「思辩星球」AI 语音能力上线

> v24 为 DebateSphere 接入 AI 语音交互：16 人格差异化音色朗读 + 辩论阶段自动语调切换 + 语音输入。采用「免费档 + 云端预留」架构——浏览器 Web Speech API 立即可用，同时预留 VoiceEngine 抽象层，未来可无缝切换云端实时语音（Qwen-Audio / MiniMax / OpenAI）。

## 一、架构：VoiceEngine 双引擎抽象

新增 `client/src/utils/voiceEngine.ts`，定义统一引擎接口，注册表模式管理：

| 引擎 | 状态 | 说明 |
|---|---|---|
| `WebSpeechVoiceEngine` | ✅ 已启用 | 浏览器 speechSynthesis 免费 TTS，零成本零依赖 |
| `CloudRealtimeVoiceEngine` | 🔒 预留占位 | `supported=false`，TODO 标注 Qwen-Audio-3.0-Realtime / MiniMax Speech-02 / OpenAI gpt-realtime 接入点，需后端 `/api/voice` WebSocket 代理 |

- 对外统一 API：`speakAiMessage()`（打断模式，辩论自动播报）、`speakMessageOnce()`（排队模式，点击朗读）、`setAiVoiceEnabled()/isAiVoiceEnabled()`（localStorage 持久化 `ds_ai_voice_enabled`）
- 未来切换云端引擎只需实现接口 + 注册，业务代码零改动

## 二、16 人格音色系统（`speechService.ts`）

| 维度 | 设计 |
|---|---|
| 音色映射 | 16 MBTI 人格 → pitch/rate 参数表，基于认知功能能量画像（如 INTJ 0.82/0.9 沉稳、ENFP 1.22/1.2 跳脱） |
| 语调推断 | `inferMood(text)` 正则匹配文本特征 → 4 种情绪档案（立论笃定 / 质询质疑 / 反驳激昂 / 收束温暖），叠加 pitchDelta/rateDelta |
| 中文语音 | `pickChineseVoice()` 优先本机 zh 声线，回退在线 zh |
| 长文拆分 | `splitSentences()` 按句末标点切 ≤120 字符块，规避 Chrome TTS 长文本自动中断 bug |

## 三、界面接入点

| 位置 | 功能 |
|---|---|
| 辩论房间 Header | 🔊 语音播报开关（Volume2/VolumeX 图标，开启时高亮） |
| 自动辩论循环 | 每位 AI 辩手发言后自动朗读（打断模式，随辩手轮替切换音色） |
| 消息气泡 | AI 发言右侧 🔊 按钮，点击单条朗读（排队模式，不打断当前） |
| 输入区 | 语音输入（Web Speech API ASR）转文字填入辩论框 |
| 设置页 | 「AI 辩手语音播报」开关行（role=switch + aria-checked） |

## 四、APK 产物

| 文件 | 大小 | 签名 |
|---|---|---|
| `MBTI辩论平台-手机版.apk` | 4.18 MB | CN=MBTI Debate Platform（正式密钥） |
| `MBTI辩论平台-手机版-debug.apk` | 5.25 MB | Android Debug 密钥 |
| `artifacts/DebateSphere-v24-release.apk` | 4.18 MB | 同上（归档） |
| `artifacts/DebateSphere-v24-debug.apk` | 5.25 MB | 同上（归档） |

前端资源 hash `index-DPMpexe3.js` 已确认打包进 APK 压缩资源，语音功能代码完整进包。

## 五、技术备注

- 桌面 Electron 版未同步（仍为 v23 前端），如需同步可复用 client/dist 重新打包
- 云端实时语音引擎（Qwen-Audio-3.0-Realtime 等）预留了接口位，待后端 WebSocket 网关就绪后可平滑接入
- 语音播报依赖系统 TTS 声线，不同设备音色表现略有差异；Chrome/Edge 体验最佳

## 六、待办/后续

- [ ] 真机验证 16 人格音色差异与阶段语调切换
- [ ] 云端实时语音引擎（需后端 `/api/voice` WebSocket 代理）
- [ ] 桌面 Electron 版同步 v24
