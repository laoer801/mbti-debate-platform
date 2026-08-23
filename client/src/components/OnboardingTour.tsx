import { useState, useEffect, useCallback } from 'react'
import { TabId } from '../types'
import { Home, MessageSquare, PawPrint, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface OnboardingStep {
  tab: TabId
  icon: typeof Home
  title: string
  desc: string
}

const STEPS: OnboardingStep[] = [
  {
    tab: 'hall',
    icon: Home,
    title: '探索人格大厅',
    desc: '这里陈列着 16 种 MBTI 人格。点击任意人格卡片，即可把它加入你的辩论阵容。',
  },
  {
    tab: 'debate',
    icon: MessageSquare,
    title: '开启一场辩论',
    desc: '输入你的辩题，选择观点相左的人格，让 INTP 与 ESFJ 正面交锋，看看谁更有说服力。',
  },
  {
    tab: 'pets',
    icon: PawPrint,
    title: '领养像素宠物',
    desc: '挑一只像素宠物作为伙伴，它会陪伴你参与宠物对战，为辩论之旅增添乐趣。',
  },
]

const STORAGE_KEY = 'mbti_onboarded_v1'

interface OnboardingTourProps {
  activeTab: TabId
  onNavigate: (tab: TabId) => void
}

/**
 * 新手引导（3 步渐进式）
 * - 首次访问展示一次（localStorage 记忆），可跳过
 * - 每一步自动切换到对应 Tab，帮助用户建立心智模型
 */
export function OnboardingTour({ activeTab, onNavigate }: OnboardingTourProps) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  // 首次访问时触发（延迟 800ms，等首屏渲染稳定）
  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(STORAGE_KEY) === '1'
    } catch { /* ignore */ }
    if (!dismissed) {
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  // 切换步骤时导航到对应 Tab
  const goTo = useCallback((index: number) => {
    setStep(index)
    onNavigate(STEPS[index].tab)
  }, [onNavigate])

  const finish = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setVisible(false)
  }, [])

  if (!visible) return null

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="新手引导"
    >
      {/* 半透明遮罩，点击跳过 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={finish}
        aria-hidden="true"
      />

      {/* 引导卡片 */}
      <div
        className="relative m-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
      >
        <button
          onClick={finish}
          aria-label="关闭引导"
          className="absolute top-3 right-3 p-1.5 rounded-full hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <X size={18} />
        </button>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-1.5 mb-4" role="tablist" aria-label="引导步骤">
          {STEPS.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === step}
              aria-label={`第 ${i + 1} 步`}
              onClick={() => goTo(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === step ? 24 : 8,
                background: i === step ? 'var(--color-accent)' : 'var(--color-border)',
              }}
            />
          ))}
        </div>

        {/* 步骤图标 */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <Icon size={24} />
        </div>

        {/* 文案 */}
        <h2 className="text-lg font-bold mb-1.5" style={{ color: 'var(--color-text)' }}>
          {current.title}
        </h2>
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--color-text-secondary)' }}>
          {current.desc}
        </p>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={finish}
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            跳过引导
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => goTo(step - 1)}
                aria-label="上一步"
                className="p-2 rounded-lg hover:opacity-70 transition-opacity border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => goTo(step + 1)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1 transition-transform hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #ad8fe8)' }}
              >
                下一步
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={finish}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-transform hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #ad8fe8)' }}
              >
                开始体验
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
