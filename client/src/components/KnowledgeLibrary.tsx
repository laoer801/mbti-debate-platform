import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { personalitySystems } from '../data/personalitySystem'
import { personaKnowledge, personalityBooks, getBookQuotesByType, PersonalityBook } from '../data/personaKnowledge'
import { BookOpen, Users, Briefcase, MessageCircle, TrendingUp, Brain, X, Plus, Trash2, BookPlus, GraduationCap, Database, Clapperboard, Newspaper } from 'lucide-react'
import { getUserBooks, addUserBook, removeUserBook, pushBooksToCloud } from '../utils/learningStore'
import type { UserBook } from '../utils/learningStore'
import { useAuth } from '../hooks/useAuth'
// v32：多领域知识库（本地 RAG）——第三个浏览模式
import { DomainKnowledgeBase } from './DomainKnowledgeBase'
// v34：视频知识（科普视频提炼文字 + 人格学习）——第四个浏览模式
import { VideoKnowledgeLibrary } from './VideoKnowledgeLibrary'
// v38：每日新闻学习（RSS 抓取 → RAG → 辩论/对话引用）——第五个浏览模式
import { NewsLibrary } from './NewsLibrary'
import clsx from 'clsx'

type LibraryMode = 'persona' | 'book' | 'domain' | 'video' | 'news'

export function KnowledgeLibrary() {
  const { isLoggedIn, token } = useAuth()
  const [mode, setMode] = useState<LibraryMode>('persona')
  const [selectedId, setSelectedId] = useState<string>('INTJ')
  const [userBooks, setUserBooks] = useState<UserBook[]>(getUserBooks)
  const [addingBook, setAddingBook] = useState(false)

  // 监听云端/跨标签/合并触发后 localStorage 变化，自动刷新
  useEffect(() => {
    const refresh = () => setUserBooks(getUserBooks())
    window.addEventListener('mbti:books-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('mbti:books-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const selectedProfile = mbtiProfiles.find(p => p.id === selectedId)
  const selectedKnowledge = personaKnowledge[selectedId]
  const selectedSystem = personalitySystems[selectedId]

  const handleAddBook = (b: Omit<UserBook, 'id' | 'addedAt'>) => {
    const nb = addUserBook(b)
    setUserBooks(prev => [nb, ...prev])
    setAddingBook(false)
    // 已登录 → 同步到云端（用户信息跟随账号）
    if (isLoggedIn && token) pushBooksToCloud(token).catch(() => {})
  }

  const handleRemoveBook = (id: string) => {
    removeUserBook(id)
    setUserBooks(prev => prev.filter(b => b.id !== id))
    if (isLoggedIn && token) pushBooksToCloud(token).catch(() => {})
  }

  return (
    <div className="h-full flex flex-col" role="main" aria-label="人格知识库">
      {/* 头部 */}
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2 display-title gradient-text">
              <BookOpen size={18} style={{ color: 'var(--color-accent)' }} /> 知识库
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              人格档案 · 书籍学习 · 领域知识库 · 视频知识 · 每日新闻（辩论与 1v1 交流的资料来源）
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setMode('domain') }}
              className={clsx('btn btn-sm transition-all', mode === 'domain' ? 'btn-primary btn-sheen' : 'btn-ghost')}
              aria-label="多领域知识库"
            >
              <Database size={14} /> 领域知识库
            </button>
            <button
              onClick={() => { setMode('video') }}
              className={clsx('btn btn-sm transition-all', mode === 'video' ? 'btn-primary btn-sheen' : 'btn-ghost')}
              aria-label="视频知识"
            >
              <Clapperboard size={14} /> 视频知识
            </button>
            <button
              onClick={() => { setMode('news') }}
              className={clsx('btn btn-sm transition-all', mode === 'news' ? 'btn-primary btn-sheen' : 'btn-ghost')}
              aria-label="每日新闻"
            >
              <Newspaper size={14} /> 每日新闻
            </button>
            {mode !== 'domain' && (
              <button
                onClick={() => { setMode('book'); setAddingBook(true) }}
                className="btn btn-primary btn-sm btn-sheen"
                aria-label="添加书籍"
              >
                <Plus size={14} /> 添加书籍
              </button>
            )}
            {/* 模式切换 */}
            <div className="flex rounded-lg p-1 gap-1" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }} role="tablist" aria-label="浏览方式">
              <button
                role="tab"
                aria-selected={mode === 'persona'}
                onClick={() => setMode('persona')}
                className={clsx('px-3 py-1.5 rounded-md text-xs font-semibold transition-all', mode === 'persona' ? 'text-white' : '')}
                style={mode === 'persona' ? { background: 'var(--color-accent)' } : { color: 'var(--color-text-secondary)' }}
              >
                按人格
              </button>
              <button
                role="tab"
                aria-selected={mode === 'book'}
                onClick={() => setMode('book')}
                className={clsx('px-3 py-1.5 rounded-md text-xs font-semibold transition-all', mode === 'book' ? 'text-white' : '')}
                style={mode === 'book' ? { background: 'var(--color-accent)' } : { color: 'var(--color-text-secondary)' }}
              >
                按书籍
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === 'persona' ? (
          <PersonaBrowse selectedId={selectedId} onSelect={setSelectedId} />
        ) : mode === 'book' ? (
          <BookBrowse
            userBooks={userBooks}
            onRemove={handleRemoveBook}
            onAddRequest={() => setAddingBook(true)}
          />
        ) : mode === 'video' ? (
          <VideoKnowledgeLibrary />
        ) : mode === 'news' ? (
          <NewsLibrary />
        ) : (
          <DomainKnowledgeBase />
        )}
      </div>

      {/* 添加书籍模态 */}
      {addingBook && <AddBookModal onClose={() => setAddingBook(false)} onAdd={handleAddBook} />}
    </div>
  )
}

/* ==================== 添加书籍表单 ==================== */

function AddBookModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (b: Omit<UserBook, 'id' | 'addedAt'>) => void
}) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [theme, setTheme] = useState('')
  const [notes, setNotes] = useState('')
  const [quotesText, setQuotesText] = useState('')

  const quotes = quotesText.split('\n').map(q => q.trim()).filter(q => q.length >= 4)
  const canSave = title.trim().length >= 1 && quotes.length > 0

  const handleSave = () => {
    if (!canSave) return
    const accents = ['#6366f1', '#2fc9a3', '#d9b871', '#e57e7e', '#8f7ff5', '#66c4d4', '#e58fb5']
    onAdd({
      title: title.trim(),
      author: author.trim() || '未知作者',
      theme: theme.trim() || '自定义',
      accent: accents[Math.floor(Math.random() * accents.length)],
      notes: notes.trim(),
      quotes,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="添加书籍"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-lg rounded-2xl border shadow-2xl animate-fade-in max-h-[88vh] flex flex-col"
        style={{ borderColor: 'var(--color-border)', background: 'color-mix(in srgb, var(--color-bg-secondary) 94%, transparent)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-bold display-title gradient-text flex items-center gap-2">
            <BookPlus size={17} style={{ color: 'var(--color-accent)' }} /> 添加书籍 · 让人格学习它
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--color-text-tertiary)' }} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                书名 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="如：思考，快与慢"
                className="input-field w-full text-sm" aria-label="书名" maxLength={40} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                作者
              </label>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="如：丹尼尔·卡尼曼"
                className="input-field w-full text-sm" aria-label="作者" maxLength={30} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              主题标签
            </label>
            <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="如：心理学 / 商业 / 哲学 / 历史"
              className="input-field w-full text-sm" aria-label="主题" maxLength={20} />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              书中观点 / 金句 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <textarea
              value={quotesText}
              onChange={e => setQuotesText(e.target.value)}
              placeholder={'每行写一条观点或金句，辩论时人格会引用它们：\n例：系统1是快思考，系统2是慢思考，多数判断失误来自系统1的偷懒。\n例：损失带来的痛苦，大约是同等收益带来的快乐的两倍。'}
              className="input-field w-full text-sm resize-none h-32 leading-relaxed"
              aria-label="书中观点"
            />
            <p className="text-[11px] mt-1" style={{ color: quotes.length > 0 ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
              {quotes.length > 0 ? `已收录 ${quotes.length} 条观点` : '每行一条，至少 1 条（4 字以上）才能保存'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              读书笔记 / 摘要
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="这本书讲了什么？对你有何启发？（可选）"
              className="input-field w-full text-sm resize-none h-20 leading-relaxed"
              aria-label="读书笔记"
            />
          </div>

          <div className="p-3 rounded-xl flex gap-2 text-[11px] leading-relaxed" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
            <GraduationCap size={14} className="flex-shrink-0 mt-0.5" />
            <span>保存后，辩论中的 16 位人格会「实时学习」这些观点，并在合适的时机以自然口语引用——他们真的会读书。</span>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t flex items-center justify-end gap-2 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSave} disabled={!canSave} className="btn btn-primary btn-sm btn-sheen">
            <BookPlus size={14} /> 保存并加入学习
          </button>
        </div>
      </div>
    </div>
  )
}

/* ==================== 按人格浏览 ==================== */

function PersonaBrowse({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const profile = mbtiProfiles.find(p => p.id === selectedId)!
  const knowledge = personaKnowledge[selectedId]
  const system = personalitySystems[selectedId]
  const bookQuotes = getBookQuotesByType(selectedId)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* 人格选择条 */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4" role="tablist" aria-label="选择人格">
        {mbtiProfiles.map(p => (
          <button
            key={p.id}
            role="tab"
            aria-selected={selectedId === p.id}
            onClick={() => onSelect(p.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all', selectedId === p.id ? 'text-white' : '')}
            style={selectedId === p.id
              ? { background: p.color }
              : { background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <span>{p.emoji}</span> {p.id}
          </button>
        ))}
      </div>

      {/* 人格总览卡 */}
      <div
        className="glass card-spotlight rounded-2xl p-5 border mb-4"
        style={{
          borderColor: `${profile.color}44`,
          ...({ '--spot-color': `${profile.color}26` } as CSSProperties),
        }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
          e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
        }}
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0" style={{ background: profile.color }}>
            {profile.emoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{profile.id} · {profile.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full opacity-80" style={{ background: `${profile.color}22`, color: profile.color }}>
                {profile.alias}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                {profile.category === 'analyst' ? '分析家' : profile.category === 'diplomat' ? '外交家' : profile.category === 'sentinel' ? '守护者' : '探险家'}
              </span>
            </div>
            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{profile.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 认知功能 */}
        <section className="glass rounded-2xl p-4 border" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="flex items-center gap-1.5 text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>
            <Brain size={15} style={{ color: profile.color }} /> 认知功能栈
          </h3>
          <div className="flex items-center gap-2 mb-3">
            {knowledge.cognitiveStack.split('-').map((fn, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: `${profile.color}1a`, color: profile.color }}>
                  {fn}
                </span>
                {i < 3 && <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>}
              </div>
            ))}
          </div>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
            主导功能：{knowledge.dominantFunction}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{knowledge.dominantDesc}</p>

          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>核心价值观</div>
            <div className="flex flex-wrap gap-1.5">
              {system?.values.map(v => (
                <span key={v} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${profile.color}1a`, color: profile.color }}>
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>性格盲点</div>
            <div className="flex flex-wrap gap-1.5">
              {system?.blindSpots.map(v => (
                <span key={v} className="text-[11px] px-2 py-0.5 rounded-full opacity-70" style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 代表人物 */}
        <section className="glass rounded-2xl p-4 border" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="flex items-center gap-1.5 text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>
            <Users size={15} style={{ color: profile.color }} /> 代表人物
          </h3>
          <div className="space-y-2.5">
            {knowledge.famousPeople.map(fp => (
              <div key={fp.name} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--color-bg)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${profile.color}22` }}>
                  {fp.name[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{fp.name}</div>
                  <div className="text-[11px]" style={{ color: profile.color }}>{fp.field}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{fp.note}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>成长建议</div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{knowledge.growthTips}</p>
          </div>
        </section>

        {/* 职业与沟通 */}
        <section className="glass rounded-2xl p-4 border" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="flex items-center gap-1.5 text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>
            <Briefcase size={15} style={{ color: profile.color }} /> 适合的职业方向
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {knowledge.careers.map(c => (
              <span key={c} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-bg)' }}>
                {c}
              </span>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>辩论风格</div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{profile.debateStyle}</p>
          </div>
        </section>

        {/* 沟通提示 */}
        <section className="glass rounded-2xl p-4 border" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="flex items-center gap-1.5 text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>
            <MessageCircle size={15} style={{ color: profile.color }} /> 如何与 TA 沟通
          </h3>
          <ul className="space-y-2">
            {knowledge.communicationTips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-bold flex-shrink-0" style={{ color: profile.color }}>{i + 1}.</span>
                {tip}
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>口头禅</div>
            <div className="flex flex-wrap gap-1.5">
              {profile.catchphrases.map(c => (
                <span key={c} className="text-[11px] px-2 py-0.5 rounded-full italic" style={{ background: 'var(--color-bg)', color: profile.color }}>
                  “{c}”
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* 书籍观点 */}
      <section className="glass rounded-2xl p-4 border mt-4" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="flex items-center gap-1.5 text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>
          <BookOpen size={15} style={{ color: profile.color }} /> 经典书籍中的 {profile.id}
        </h3>
        {bookQuotes.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>暂无相关书籍引文</p>
        ) : (
          <div className="space-y-3">
            {bookQuotes.map(({ book, quote }) => (
              <div key={book.id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg)', borderLeft: `3px solid ${book.accent}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold" style={{ color: book.accent }}>《{book.title}》</span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{quote.source}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  “{quote.quote}”
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/* ==================== 按书籍浏览 ==================== */

function BookBrowse({ userBooks, onRemove, onAddRequest }: {
  userBooks: UserBook[]
  onRemove: (id: string) => void
  onAddRequest: () => void
}) {
  const [openBookId, setOpenBookId] = useState<string | null>(personalityBooks[0].id)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold mb-1 display-title gradient-text">经典 MBTI 书单</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          从荣格到凯尔西——看大师们如何解读每种人格
        </p>
      </div>

      {/* 我的藏书：人格实时学习来源 */}
      {userBooks.length === 0 ? (
        <div className="mb-6 p-4 rounded-2xl border border-dashed flex items-center gap-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
          <div className="empty-orb !w-12 !h-12 !mb-0">
            <GraduationCap size={20} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>我的藏书还是空的</div>
            <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              添加一本书，辩论中的人格就会「实时学习」书里的观点，用它们支撑自己的论证。
            </div>
          </div>
          <button onClick={onAddRequest} className="btn btn-primary btn-sm btn-sheen" aria-label="去添加书籍">
            <Plus size={14} /> 去添加
          </button>
        </div>
      ) : (
        <section className="mb-8" aria-label="我的藏书">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap size={16} style={{ color: 'var(--color-accent)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>我的藏书</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
              🧠 辩论中人格会实时学习引用
            </span>
          </div>
          <div className="space-y-3">
            {userBooks.map((book, i) => (
              <div
                key={book.id}
                className="stagger-item glass card-spotlight rounded-2xl border p-4"
                style={{
                  borderColor: `${book.accent}44`,
                  ...({ '--spot-color': `${book.accent}1f` } as CSSProperties),
                  animationDelay: `${i * 0.05}s`,
                }}
                onMouseMove={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
                  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
                }}
              >
                <div className="flex items-start gap-4">
                  {/* 书封 */}
                  <div className="w-12 h-16 rounded-lg flex-shrink-0 flex flex-col items-center justify-center gap-1 shadow-lg"
                    style={{ background: `linear-gradient(150deg, ${book.accent}, ${book.accent}99)` }}>
                    <BookPlus size={16} style={{ color: '#fff' }} />
                    <span className="text-[8px] font-bold text-white px-1 text-center leading-tight">{book.title.slice(0, 4)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold" style={{ color: 'var(--color-text)' }}>《{book.title}》</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${book.accent}1a`, color: book.accent }}>
                        {book.theme}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      {book.author} · 已加入学习
                    </div>
                    {book.notes && (
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{book.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {book.quotes.map((q, qi) => (
                        <span key={qi} className="text-[11px] px-2 py-1 rounded-lg italic" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                          “{q}”
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(book.id)}
                    className="p-2 rounded-lg transition-colors hover:scale-105 flex-shrink-0"
                    style={{ color: 'var(--color-danger)', background: 'var(--color-danger-light)' }}
                    aria-label={`删除《${book.title}》`}
                    title="删除此书（人格将停止学习它）"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        {personalityBooks.map((book, i) => (
          <div
            key={book.id}
            className="stagger-item glass card-spotlight rounded-2xl border overflow-hidden"
            style={{
              borderColor: 'var(--color-border)',
              ...({ '--spot-color': `${book.accent}22` } as CSSProperties),
              animationDelay: `${i * 0.06}s`,
            }}
            onMouseMove={e => {
              const r = e.currentTarget.getBoundingClientRect()
              e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
              e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
            }}
          >
            <button
              onClick={() => setOpenBookId(openBookId === book.id ? null : book.id)}
              className="w-full flex items-center gap-4 p-4 text-left transition-all hover:bg-opacity-50"
              aria-expanded={openBookId === book.id}
            >
              {/* 书封 */}
              <div className="w-14 h-20 rounded-lg flex-shrink-0 flex flex-col items-center justify-center gap-1 shadow-lg"
                style={{ background: `linear-gradient(150deg, ${book.accent}, ${book.accent}99)` }}>
                <BookOpen size={18} style={{ color: '#fff' }} />
                <span className="text-[9px] font-bold text-white px-1 text-center leading-tight">{book.title.slice(0, 5)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>《{book.title}》</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${book.accent}1a`, color: book.accent }}>
                    {book.theme}
                  </span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {book.author} · {book.year}
                </div>
                <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {book.description}
                </p>
              </div>
              <TrendingUp size={16} className={clsx('flex-shrink-0 transition-transform', openBookId === book.id ? 'rotate-180' : '')}
                style={{ color: 'var(--color-text-tertiary)' }} />
            </button>

            {openBookId === book.id && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {book.quotes.map(q => {
                    const p = mbtiProfiles.find(x => x.id === q.typeId)!
                    return (
                      <button
                        key={q.typeId}
                        onClick={() => { setOpenBookId(null); /* 切到人格模式 */ }}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-all hover:scale-105"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        title={`查看 ${p.id} 的完整档案`}
                      >
                        {p.emoji} {q.typeId}
                      </button>
                    )
                  })}
                </div>
                <div className="space-y-2.5">
                  {book.quotes.map(q => {
                    const p = mbtiProfiles.find(x => x.id === q.typeId)!
                    return (
                      <div key={q.typeId} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--color-bg)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: p.color }}>
                          {p.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{p.id} · {p.name}</span>
                            <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{q.source}</span>
                          </div>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                            “{q.quote}”
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
