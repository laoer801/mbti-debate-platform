/**
 * v40.6.9 界面音效引擎（Web Audio 合成，无音频文件依赖）
 * - 设置页可开关（localStorage: mbti_sound，默认开）
 * - 全部音效极短且轻（不打扰打字/拖动）
 */
let ctx: AudioContext | null = null
let enabled = true
try { enabled = localStorage.getItem('mbti_sound') !== '0' } catch { /* ignore */ }

export function isSoundEnabled(): boolean { return enabled }

export function setSoundEnabled(v: boolean): void {
  enabled = v
  try { localStorage.setItem('mbti_sound', v ? '1' : '0') } catch { /* ignore */ }
  if (v) playSound('success') // 开启时给个反馈
}

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC) ctx = new AC()
    } catch { /* ignore */ }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { /* ignore */ })
  return ctx
}

function blip(freq: number, dur: number, type: OscillatorType, gainV: number, delay = 0): void {
  const c = ac()
  if (!c) return
  try {
    const o = c.createOscillator()
    const g = c.createGain()
    const t0 = c.currentTime + delay
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(gainV, 0.001), t0 + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start(t0)
    o.stop(t0 + dur + 0.03)
  } catch { /* ignore */ }
}

export type SoundKind = 'tap' | 'confirm' | 'back' | 'success' | 'error'

export function playSound(kind: SoundKind = 'tap'): void {
  if (!enabled) return
  switch (kind) {
    case 'tap': blip(680, 0.045, 'sine', 0.035); break
    case 'confirm': blip(523, 0.07, 'triangle', 0.05); blip(784, 0.09, 'triangle', 0.045, 0.06); break
    case 'back': blip(460, 0.055, 'sine', 0.04); break
    case 'success': blip(660, 0.06, 'sine', 0.05); blip(880, 0.1, 'sine', 0.045, 0.05); break
    case 'error': blip(210, 0.13, 'sawtooth', 0.035); break
  }
}

/** 全局按钮点击音效：捕获阶段监听，所有可点元素 tap 声 */
export function initGlobalSound(): void {
  window.addEventListener('click', (e) => {
    if (!enabled) return
    const t = e.target as HTMLElement | null
    if (!t || typeof t.closest !== 'function') return
    // 仅在真正可点控件上发声；滑动条/文本域拖选不发
    if (t.closest('input[type="range"], textarea')) return
    const el = t.closest('button, [role="button"], a[href], summary, [onclick], .btn, .cursor-pointer, label')
    if (el) playSound('tap')
  }, true)
}
