import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react'

interface VoiceInputProps {
  onResult: (text: string) => void
  isRecording: boolean
  setIsRecording: (v: boolean) => void
}

/**
 * 语音输入错误 → 用户可读的中文提示
 * v40 核心修复：非安全上下文（http://IP:端口 访问）下 Web Speech API 会被静默封锁，
 * 之前 onerror 只是静默停止，用户完全不知道为什么麦克风"没反应"。
 */
function describeVoiceError(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限被拒绝，请在浏览器地址栏 🔒 图标中允许麦克风后重试'
    case 'network':
      return '语音识别服务不可用（Electron 桌面版不支持在线语音识别，请用键盘输入）'
    case 'audio-capture':
      return '未检测到麦克风设备，请检查麦克风连接'
    case 'language-not-supported':
      return '当前浏览器不支持中文语音识别'
    default:
      return `语音识别出错（${error}），请重试或使用键盘输入`
  }
}

/** 检测是否因非安全上下文导致语音 API 被封锁（手机 http://IP 访问的典型场景） */
function isInsecureContextBlocked(): boolean {
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  // Electron file:// 与 localhost 均视为安全上下文；只有 http + 局域网 IP 会被封锁
  return (protocol === 'http:' && !isLocal) || (window.isSecureContext === false && !isLocal)
}

export function VoiceInput({ onResult, isRecording, setIsRecording }: VoiceInputProps) {
  const [supported, setSupported] = useState(true)
  const [interim, setInterim] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef<any>(null)
  // 用 ref 同步录音状态，避免 onend 回调中的 stale closure
  const isRecordingRef = useRef(false)
  // 用户主动停止标志：主动 stop 触发的 onend 不应自动重启
  const manuallyStoppedRef = useRef(false)
  // 错误提示自动清除定时器
  const errorTimerRef = useRef(0)

  useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    window.clearTimeout(errorTimerRef.current)
    errorTimerRef.current = window.setTimeout(() => setErrorMsg(''), 8000)
  }, [])

  useEffect(() => {
    // 非安全上下文（手机 http://局域网IP 访问）→ Web Speech API 被浏览器安全策略封锁
    if (isInsecureContextBlocked()) {
      setSupported(false)
      setErrorMsg(`当前通过 http://${window.location.host} 访问，浏览器安全策略禁止语音识别。请改用 https:// 局域网地址（见服务器启动日志的 3443 端口），或在电脑端 localhost 使用`)
      return
    }

    // Check Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      setErrorMsg('当前浏览器不支持语音识别，请使用 Chrome / Edge，或改用键盘输入')
      return
    }
    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = true
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = 'zh-CN'

    recognitionRef.current.onresult = (event: any) => {
      let final = ''
      let temp = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript
        } else {
          temp += event.results[i][0].transcript
        }
      }
      if (final) {
        onResult(final)
      }
      setInterim(temp)
    }

    recognitionRef.current.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error)
      setIsRecording(false)
      manuallyStoppedRef.current = true
      // no-speech（静音超时）与 aborted（主动中止）属正常流程，不打扰用户
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        showError(describeVoiceError(event.error))
      }
    }

    recognitionRef.current.onend = () => {
      setInterim('')
      // 仅当仍在录音状态且非用户主动停止时，才自动重启（处理静音超时）
      if (isRecordingRef.current && !manuallyStoppedRef.current) {
        try { recognitionRef.current?.start() } catch {}
      } else {
        setIsRecording(false)
        isRecordingRef.current = false
        manuallyStoppedRef.current = false
      }
    }

    return () => {
      try { recognitionRef.current?.abort() } catch {}
      window.clearTimeout(errorTimerRef.current)
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return
    if (isRecordingRef.current) {
      // 用户主动停止 → 标记手动停止，onend 不会自动重启
      manuallyStoppedRef.current = true
      try { recognitionRef.current.stop() } catch {}
      setInterim('')
      setIsRecording(false)
      isRecordingRef.current = false
    } else {
      manuallyStoppedRef.current = false
      setErrorMsg('')
      try { recognitionRef.current.start() } catch {}
      setIsRecording(true)
      isRecordingRef.current = true
    }
  }, [setIsRecording])

  return (
    <div className="relative flex flex-col items-start">
      <button
        onClick={supported ? toggleRecording : undefined}
        disabled={!supported}
        className={supported
          ? (isRecording
            ? 'p-2.5 rounded-lg animate-pulse text-white'
            : 'p-2.5 rounded-lg hover:opacity-80')
          : 'p-2.5 rounded-lg opacity-30 cursor-not-allowed'
        }
        style={supported
          ? (isRecording
            ? { background: 'linear-gradient(135deg, #e57e7e, #e8976f)', color: '#fff' }
            : { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' })
          : { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }
        }
        title={isRecording ? '停止录音' : '开始语音输入'}
      >
        {!supported ? <MicOff size={18} /> : isRecording ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
      </button>
      {isRecording && interim && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs shadow-lg whitespace-nowrap max-w-[200px] truncate"
          style={{ background: '#333', color: '#fff' }}>
          🎤 {interim}
        </div>
      )}
      {/* v40：错误提示（不再静默失败） */}
      {errorMsg && (
        <div className="absolute bottom-full mb-2 left-0 w-56 px-3 py-2 rounded-lg text-[11px] leading-snug shadow-lg z-30"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid #e57e7e55', color: 'var(--color-text)' }}>
          <span className="flex items-start gap-1.5">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#e57e7e' }} />
            <span>{errorMsg}</span>
          </span>
        </div>
      )}
    </div>
  )
}
