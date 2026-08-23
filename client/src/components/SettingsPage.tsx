import { ThemeMode, FontSize } from '../types'
import { Moon, Sun, SunMoon, Type, Eye, Accessibility, Monitor, Server, Check, RefreshCw, ChevronDown, Volume2, VolumeX, Brain, KeyRound, Wifi, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { getServerUrl, setServerUrl } from '../config'
import { isAiVoiceEnabled, setAiVoiceEnabled } from '../utils/voiceEngine'
import { getLLMConfig, setLLMConfig, isLLMConfigured, LLM_PROVIDERS, getArenaMode, setArenaMode, chatOnce } from '../utils/llmClient'
import { useState } from 'react'

interface SettingsPageProps {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  fontSize: FontSize
  setFontSize: (f: FontSize) => void
}

const themeOptions: { id: ThemeMode; label: string; icon: typeof Sun; desc: string }[] = [
  { id: 'light', label: '浅色模式', icon: Sun, desc: '清新明亮，适合白天使用' },
  { id: 'dark', label: '深色模式', icon: Moon, desc: '护眼舒适，适合夜间使用' },
  { id: 'high-contrast', label: '高对比度', icon: Accessibility, desc: '黑白分明，视障友好' },
]

const fontSizeOptions: { id: FontSize; label: string; desc: string; preview: string }[] = [
  { id: 'normal', label: '标准', desc: '默认字体大小', preview: 'Aa' },
  { id: 'large', label: '大号', desc: '适合阅读舒适', preview: 'Aa+' },
  { id: 'xlarge', label: '特大', desc: '最大字体显示', preview: 'Aa++' },
]

export function SettingsPage({ theme, setTheme, fontSize, setFontSize }: SettingsPageProps) {
  const [serverInput, setServerInput] = useState(getServerUrl())
  const [saved, setSaved] = useState(false)
  const [voiceOn, setVoiceOn] = useState(isAiVoiceEnabled())

  // v25 顶尖辩手模式（LLM 多智能体辩论）
  const [arenaMode, setArenaModeState] = useState(getArenaMode())
  const [llmBaseURL, setLlmBaseURL] = useState(getLLMConfig().baseURL)
  const [llmApiKey, setLlmApiKey] = useState(getLLMConfig().apiKey)
  const [llmModel, setLlmModel] = useState(getLLMConfig().model)
  const [llmSaved, setLlmSaved] = useState(false)
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const saveServer = () => {
    const url = serverInput.trim().replace(/\/+$/, '')
    if (!url) return
    setServerUrl(url)
    setSaved(true)
    // 延迟刷新，让用户看到保存成功的反馈
    setTimeout(() => { window.location.reload() }, 800)
  }

  const applyProvider = (providerId: string) => {
    const p = LLM_PROVIDERS.find(x => x.id === providerId)
    if (!p) return
    setLlmBaseURL(p.baseURL)
    setLlmModel(p.model)
  }

  const saveLLM = () => {
    setLLMConfig({ baseURL: llmBaseURL.trim(), apiKey: llmApiKey.trim(), model: llmModel.trim() })
    setLlmSaved(true)
    setTimeout(() => setLlmSaved(false), 1500)
  }

  const testLLM = async () => {
    setLlmTesting(true)
    setLlmTestResult(null)
    try {
      const reply = await chatOnce(
        '你是连接测试助手，只回复：连接成功',
        '测试连接',
        { maxTokens: 20, timeoutMs: 20000 }
      )
      setLlmTestResult({ ok: true, msg: `✅ 连接成功：${reply.slice(0, 40)}` })
    } catch (err) {
      setLlmTestResult({ ok: false, msg: `❌ ${err instanceof Error ? err.message : '连接失败'}` })
    } finally {
      setLlmTesting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6" role="main" aria-label="设置页面">
      <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>设置</h2>

      {/* Server Connection — collapsible advanced setting */}
      <section className="mb-8" aria-labelledby="server-heading">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer py-2 list-none">
            <h3 id="server-heading" className="flex items-center gap-2 text-sm font-bold uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
              <Server size={16} /> 服务器连接 <span className="text-[10px] font-normal opacity-60">(高级设置)</span>
            </h3>
            <ChevronDown size={16} className="transition-transform group-open:rotate-180 opacity-60" style={{ color: 'var(--color-text-tertiary)' }} />
          </summary>
          <div className="glass p-4 space-y-3 mt-2">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              手机 App 需连接电脑上运行的后端服务。电脑与手机连同一 WiFi，在电脑上运行「启动MBTI辩论平台.bat」后，
              在此填入电脑的局域网地址（如 <code className="px-1 rounded" style={{ background: 'var(--color-bg-secondary)' }}>http://192.168.1.100:3001</code>）。
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverInput}
                onChange={e => setServerInput(e.target.value)}
                placeholder="http://192.168.x.x:3001"
                aria-label="服务器地址"
                spellCheck={false}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
              <button
                onClick={saveServer}
                className="btn btn-primary btn-sm whitespace-nowrap"
                aria-label="保存服务器地址"
              >
                {saved ? <Check size={14} className="inline mr-1" /> : <RefreshCw size={14} className="inline mr-1" />}
                保存并重连
              </button>
            </div>
            {saved && (
              <p role="status" aria-live="polite" className="text-xs font-bold" style={{ color: '#2fc9a3' }}>
                ✅ 已保存，正在重新连接...
              </p>
            )}
          </div>
        </details>
      </section>

      {/* 顶尖辩手模式（v25 LLM 多智能体辩论） */}
      <section className="mb-8" aria-labelledby="arena-heading">
        <h3 id="arena-heading" className="flex items-center gap-2 text-sm font-bold uppercase mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          <Brain size={16} /> 顶尖辩手模式 <span className="text-[10px] font-normal opacity-60">(LLM 多智能体)</span>
        </h3>

        {/* 模式开关 */}
        <div className="glass p-4 mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>启用 LLM 结构化对抗辩论</div>
            <div className="text-[10px] mt-0.5 opacity-60" style={{ color: 'var(--color-text-secondary)' }}>
              16 人格独立 Agent · 开场陈词 → 交叉质询 → 自由辩论 → 总结陈词 · AI 裁判套话检测
            </div>
            {arenaMode && !isLLMConfigured() && (
              <div className="text-[10px] font-bold mt-1" style={{ color: '#d9b871' }}>
                ⚠️ 尚未配置 LLM API，开启后辩论将自动回退本地引擎
              </div>
            )}
          </div>
          <button
            onClick={() => { const v = !arenaMode; setArenaModeState(v); setArenaMode(v) }}
            className={clsx('px-3 py-1 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0', arenaMode && 'ring-2')}
            style={arenaMode
              ? { background: 'var(--color-accent-light)', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }
              : { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
            role="switch"
            aria-checked={arenaMode}
            aria-label="顶尖辩手模式"
          >
            {arenaMode ? <Brain size={13} /> : <KeyRound size={13} />}
            {arenaMode ? '已开启' : '已关闭'}
          </button>
        </div>

        {/* LLM 配置表单 */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer py-2 list-none">
            <span className="text-xs font-bold uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
              <KeyRound size={13} className="inline mr-1" /> LLM API 配置 {isLLMConfigured() && <span className="text-[10px] font-normal" style={{ color: '#2fc9a3' }}>✓ 已配置</span>}
            </span>
            <ChevronDown size={16} className="transition-transform group-open:rotate-180 opacity-60" style={{ color: 'var(--color-text-tertiary)' }} />
          </summary>
          <div className="glass p-4 space-y-3 mt-2">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              选择服务商后填入 API Key 即可。支持 DeepSeek / OpenAI / 通义千问 / 硅基流动等
              任意 OpenAI 兼容接口。辩论发言由 LLM 实时生成，裁判 Agent 独立评分。
            </p>
            {/* 服务商快捷选择 */}
            <div className="flex flex-wrap gap-2">
              {LLM_PROVIDERS.map(p => (
                <button key={p.id} onClick={() => applyProvider(p.id)}
                  className={clsx('px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer', llmBaseURL === p.baseURL && 'ring-2')}
                  style={llmBaseURL === p.baseURL
                    ? { background: 'var(--color-accent-light)', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }
                    : { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                  {p.name}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={llmBaseURL}
              onChange={e => setLlmBaseURL(e.target.value)}
              placeholder="Base URL（如 https://api.deepseek.com）"
              aria-label="LLM Base URL"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
            <input
              type="password"
              value={llmApiKey}
              onChange={e => setLlmApiKey(e.target.value)}
              placeholder="API Key"
              aria-label="LLM API Key"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
            <input
              type="text"
              value={llmModel}
              onChange={e => setLlmModel(e.target.value)}
              placeholder="模型名（如 deepseek-chat）"
              aria-label="LLM 模型名"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
            <div className="flex gap-2">
              <button onClick={saveLLM} className="btn btn-primary btn-sm" aria-label="保存 LLM 配置">
                {llmSaved ? <Check size={14} className="inline mr-1" /> : <KeyRound size={14} className="inline mr-1" />}
                保存配置
              </button>
              <button onClick={testLLM} disabled={llmTesting || !llmApiKey.trim()}
                className="btn btn-ghost btn-sm disabled:opacity-50" aria-label="测试 LLM 连接">
                {llmTesting ? <Loader2 size={14} className="inline mr-1 animate-spin" /> : <Wifi size={14} className="inline mr-1" />}
                {llmTesting ? '测试中...' : '测试连接'}
              </button>
            </div>
            {llmTestResult && (
              <p role="status" aria-live="polite" className="text-xs font-bold break-all"
                style={{ color: llmTestResult.ok ? '#2fc9a3' : '#e57e7e' }}>
                {llmTestResult.msg}
              </p>
            )}
            <p className="text-[10px] opacity-70" style={{ color: 'var(--color-text-tertiary)' }}>
              💡 API Key 仅保存在本机 localStorage，不会上传。测试辩题可在辩论房开启自动辩论后直接体验。
            </p>
          </div>
        </details>
      </section>

      {/* Theme */}
      <section className="mb-8" aria-labelledby="theme-heading">
        <h3 id="theme-heading" className="flex items-center gap-2 text-sm font-bold uppercase mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          <SunMoon size={16} /> 主题外观
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={clsx('glass p-4 text-center transition-all cursor-pointer', theme === opt.id && 'ring-2')}
              style={theme === opt.id ? { borderColor: 'var(--color-accent)' } : {}}
              role="radio"
              aria-checked={theme === opt.id}
              aria-label={opt.label}
            >
              <opt.icon size={28} className="mx-auto mb-2" style={{ color: theme === opt.id ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }} />
              <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{opt.label}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Font Size */}
      <section className="mb-8" aria-labelledby="font-heading">
        <h3 id="font-heading" className="flex items-center gap-2 text-sm font-bold uppercase mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          <Type size={16} /> 字体大小
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {fontSizeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFontSize(opt.id)}
              className={clsx('glass p-4 text-center transition-all cursor-pointer', fontSize === opt.id && 'ring-2')}
              style={fontSize === opt.id ? { borderColor: 'var(--color-accent)' } : {}}
              role="radio"
              aria-checked={fontSize === opt.id}
              aria-label={`${opt.label}字体`}
            >
              <div className="text-2xl font-bold mb-1" style={{ color: fontSize === opt.id ? 'var(--color-accent)' : 'var(--color-text)' }}>{opt.preview}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{opt.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Preview */}
      <section className="mb-8" aria-labelledby="preview-heading">
        <h3 id="preview-heading" className="flex items-center gap-2 text-sm font-bold uppercase mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          <Eye size={16} /> 效果预览
        </h3>
        <div className="glass p-5 space-y-3">
          <p className="font-bold" style={{ color: 'var(--color-text)' }}>标题文字示例 / Title Preview</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>正文文本示例。这段文字展示了当前主题下的正文阅读效果，包括颜色对比度和行高设置。</p>
          <p style={{ color: 'var(--color-text-tertiary)' }}>辅助文字示例 / Secondary text example</p>
          <div className="flex gap-2 pt-2">
            <span className="btn btn-primary btn-sm">主要按钮</span>
            <span className="btn btn-ghost btn-sm">次要按钮</span>
            <span className="tag tag-active">标签</span>
          </div>
        </div>
      </section>

      {/* Accessibility */}
      <section aria-labelledby="a11y-heading">
        <h3 id="a11y-heading" className="flex items-center gap-2 text-sm font-bold uppercase mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          <Accessibility size={16} /> 无障碍
        </h3>
        <div className="glass p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>键盘快捷导航</span>
            <span className="tag">✅ 已启用</span>
          </div>
          {/* AI 辩手语音播报开关 */}
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>
              AI 辩手语音播报
              <span className="block text-[10px] opacity-60 mt-0.5">16 人格音色 · 立论/质询/总结自动切换语调</span>
            </span>
            <button
              onClick={() => { const v = !voiceOn; setVoiceOn(v); setAiVoiceEnabled(v) }}
              className={clsx('px-3 py-1 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5', voiceOn && 'ring-2')}
              style={voiceOn
                ? { background: 'var(--color-accent-light)', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }
                : { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
              role="switch"
              aria-checked={voiceOn}
              aria-label="AI 辩手语音播报"
            >
              {voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {voiceOn ? '已开启' : '已关闭'}
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>屏幕阅读器支持</span>
            <span className="tag">✅ 已适配</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>跳转到主内容</span>
            <span className="tag">✅ Tab键可用</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>减少动态效果</span>
            <span className="tag">{typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '✅ 已启用' : '⚙️ 跟随系统'}</span>
          </div>
        </div>
      </section>
    </div>
  )
}
