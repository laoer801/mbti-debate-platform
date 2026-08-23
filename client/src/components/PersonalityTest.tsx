import { useState, useMemo } from 'react'
import { MBTIQuestion } from '../types'
import { mbtiQuestions, mbtiDimensions } from '../data/mbtiQuestions'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { ArrowLeft, Brain, Sparkles, ChevronRight, RotateCcw } from 'lucide-react'
import clsx from 'clsx'

interface PersonalityTestProps {
  onClose: () => void
  onResult: (typeId: string) => void
}

type Answer = Record<number, string>

export function PersonalityTest({ onClose, onResult }: PersonalityTestProps) {
  const [step, setStep] = useState(0) // 0=intro, 1-12=questions, 13=result
  const [answers, setAnswers] = useState<Answer>({})
  const [resultType, setResultType] = useState<string | null>(null)

  const currentQuestion = step >= 1 && step <= 12 ? mbtiQuestions[step - 1] : null

  const handleAnswer = (value: string) => {
    if (!currentQuestion) return
    const newAnswers = { ...answers, [currentQuestion.id]: value }
    setAnswers(newAnswers)

    if (step === 12) {
      // Calculate result
      const type = calculateType(newAnswers)
      setResultType(type)
      setStep(13)
    } else {
      setTimeout(() => setStep(s => s + 1), 300)
    }
  }

  const handleRestart = () => {
    setAnswers({})
    setResultType(null)
    setStep(0)
  }

  const profile = resultType ? mbtiProfiles.find(p => p.id === resultType) : null

  const dimensionScores = useMemo(() => {
    if (step < 13) return null
    const scores: Record<string, { a: number; b: number; total: number }> = {}
    for (const [dim, info] of Object.entries(mbtiDimensions)) {
      scores[dim] = { a: 0, b: 0, total: 0 }
    }
    for (const [qIdStr, value] of Object.entries(answers)) {
      const qId = parseInt(qIdStr)
      const q = mbtiQuestions.find(q => q.id === qId)
      if (!q) continue
      scores[q.dimension].total++
      const option = q.options.find(o => o.value === value)
      if (option) {
        const firstVal = q.options[0].value
        if (option.value === firstVal) scores[q.dimension].a++
        else scores[q.dimension].b++
      }
    }
    return scores
  }, [answers, step])

  // Intro screen
  if (step === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8" role="main" aria-label="MBTI人格匹配测试">
        <div className="glass p-8 max-w-lg w-full text-center animate-fade-in">
          <div className="flex justify-center mb-4">
            <div className="avatar avatar-lg" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
              <Brain size={24} />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>MBTI 人格匹配</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            12 道简单选择题，帮你找到最匹配的人格类型。大约需要 2 分钟。
          </p>
          <div className="flex flex-col gap-2 text-xs mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
            <span>🤔 每题只有两个选项，凭直觉选</span>
            <span>⏱️ 答案没有对错，真实的你就是最好的</span>
            <span>🎯 测试结果会推荐最适合你的人格辩论角色</span>
          </div>
          <button
            onClick={() => setStep(1)}
            className="btn btn-primary btn-lg w-full"
            aria-label="开始MBTI人格测试"
          >
            开始测试 <ChevronRight size={18} />
          </button>
          <button onClick={onClose} className="btn btn-ghost w-full mt-3">
            <ArrowLeft size={16} /> 返回大厅
          </button>
        </div>
      </div>
    )
  }

  // Result screen
  if (step === 13 && profile && dimensionScores) {
    return (
      <div className="h-full flex items-center justify-center p-8" role="main" aria-label={`测试结果：${profile.name}`}>
        <div className="glass p-8 max-w-lg w-full animate-fade-in">
          <div className="text-center mb-6">
            <div className="avatar avatar-lg mx-auto mb-3" style={{ background: profile.color, color: '#fff' }}>
              {profile.emoji}
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              你是 <span style={{ color: profile.color }}>{profile.name}</span>
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{profile.alias}</p>
          </div>

          {/* Dimension bars */}
          <div className="space-y-3 mb-6">
            {Object.entries(dimensionScores).map(([dim, score]) => {
              const info = mbtiDimensions[dim]
              const aPct = score.total > 0 ? Math.round((score.a / score.total) * 100) : 50
              const bPct = 100 - aPct
              return (
                <div key={dim}>
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    <span>{info.label}</span>
                    <span>{aPct}% {info.a.split(' ')[0]} / {bPct}% {info.b.split(' ')[0]}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--color-bg-tertiary)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${aPct}%`,
                      background: `linear-gradient(90deg, ${profile.color}, ${profile.color}88)`,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-sm mb-6 italic" style={{ color: 'var(--color-text-secondary)', borderLeft: '3px solid var(--color-accent)', paddingLeft: '12px' }}>
            "{profile.description}"
          </p>

          <div className="flex gap-3">
            <button onClick={() => { onResult(profile.id); onClose() }} className="btn btn-primary flex-1">
              <Sparkles size={16} /> 用此人格开始辩论
            </button>
            <button onClick={handleRestart} className="btn btn-ghost" aria-label="重新测试">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Question screen
  if (!currentQuestion) return null
  const progress = ((step - 1) / 12) * 100

  return (
    <div className="h-full flex items-center justify-center p-8" role="main" aria-label={`测试第${step}题`}>
      <div className="glass p-8 max-w-lg w-full animate-fade-in">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleRestart} className="p-1 rounded hover:bg-opacity-10" style={{ color: 'var(--color-text-tertiary)' }} aria-label="重新开始">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--color-bg-tertiary)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--color-accent)' }} />
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{step}/12</span>
        </div>

        {/* Dimension indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className="tag tag-active text-xs">{mbtiDimensions[currentQuestion.dimension].label}</span>
        </div>

        {/* Question */}
        <h3 className="text-lg font-semibold mb-8" style={{ color: 'var(--color-text)' }}>
          {currentQuestion.text}
        </h3>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt.value)}
              className="w-full text-left p-4 rounded-lg border transition-all hover:translate-x-1"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                background: 'var(--color-bg-tertiary)',
              }}
              aria-label={`选择：${opt.text}`}
            >
              <span className="text-xs font-mono mr-2" style={{ color: 'var(--color-text-tertiary)' }}>
                {i === 0 ? 'A' : 'B'}
              </span>
              {opt.text}
            </button>
          ))}
        </div>

        {/* Keyboard hints */}
        <div className="mt-6 flex gap-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          <kbd className="px-2 py-0.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>1</kbd>
          <span>A选项</span>
          <kbd className="px-2 py-0.5 rounded border ml-2" style={{ borderColor: 'var(--color-border)' }}>2</kbd>
          <span>B选项</span>
        </div>
      </div>
    </div>
  )
}

function calculateType(answers: Answer): string {
  const scores: Record<string, number> = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
  for (const [qIdStr, value] of Object.entries(answers)) {
    const qId = parseInt(qIdStr)
    const q = mbtiQuestions.find(q => q.id === qId)
    if (!q) continue
    scores[value] = (scores[value] || 0) + 1
  }
  const type = `${scores.E >= scores.I ? 'E' : 'I'}${scores.S >= scores.N ? 'S' : 'N'}${scores.T >= scores.F ? 'T' : 'F'}${scores.J >= scores.P ? 'J' : 'P'}`
  return type
}
