/**
 * v33 轻量 Markdown 渲染器（markdownLite.ts）
 *
 * 项目无 react-markdown / marked 依赖，报告内容是 LLM 生成的 Markdown 字符串。
 * 这里实现一个**安全、够用**的子集渲染器：先转义 HTML，再按行处理常见语法。
 *
 * 支持语法：
 * - 标题 # / ## / ###
 * - 无序列表 - / *（连续行合并为 <ul>）
 * - 有序列表 1. 2.（连续行合并为 <ol>）
 * - 粗体 **text**
 * - 行内代码 `code`
 * - 引用 > text
 * - 分隔线 ---
 * - 段落（空行分隔）
 * - [n] 引用编号 → 高亮徽章
 *
 * 安全：所有用户/LLM 文本先经 escapeHtml，再插入标签，杜绝 XSS。
 */

/** 转义 HTML 特殊字符，防止注入 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 行内格式：粗体 + 行内代码 + [n] 引用编号 */
function inline(s: string): string {
  let out = escapeHtml(s)
  // 行内代码 `code`（先处理，避免内部被其他规则破坏）
  out = out.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
  // 粗体 **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // [n] 引用编号 → 小徽章
  out = out.replace(/\[(\d+)\]/g, '<span class="md-cite">[$1]</span>')
  return out
}

/**
 * 将 Markdown 字符串渲染为 HTML 片段（不含 <html><body>，可直接 dangerouslySetInnerHTML）。
 * 调用方需自行提供 .md-code / .md-cite / .md-h1... 等样式（见 DebateReport.tsx 内联样式）。
 */
export function renderMarkdownLite(md: string): string {
  if (!md) return ''
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let i = 0
  let listType: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 空行 → 段落分隔（关闭列表）
    if (trimmed === '') {
      closeList()
      i++
      continue
    }

    // 分隔线 ---
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList()
      html.push('<hr class="md-hr" />')
      i++
      continue
    }

    // 标题 # / ## / ###
    const hMatch = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (hMatch) {
      closeList()
      const level = hMatch[1].length
      html.push(`<h${level} class="md-h${level}">${inline(hMatch[2])}</h${level}>`)
      i++
      continue
    }

    // 引用 > text
    if (/^>\s?/.test(trimmed)) {
      closeList()
      const quoteText = trimmed.replace(/^>\s?/, '')
      html.push(`<blockquote class="md-quote">${inline(quoteText)}</blockquote>`)
      i++
      continue
    }

    // 无序列表 - / *
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (ulMatch) {
      if (listType !== 'ul') {
        closeList()
        html.push('<ul class="md-ul">')
        listType = 'ul'
      }
      html.push(`<li>${inline(ulMatch[1])}</li>`)
      i++
      continue
    }

    // 有序列表 1. 2.
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (olMatch) {
      if (listType !== 'ol') {
        closeList()
        html.push('<ol class="md-ol">')
        listType = 'ol'
      }
      html.push(`<li>${inline(olMatch[1])}</li>`)
      i++
      continue
    }

    // 普通段落：连续非空非格式行合并为一个 <p>
    closeList()
    const paraLines: string[] = [trimmed]
    i++
    while (i < lines.length) {
      const next = lines[i].trim()
      if (next === '') break
      if (/^(#{1,3})\s+/.test(next)) break
      if (/^[-*]\s+/.test(next)) break
      if (/^\d+\.\s+/.test(next)) break
      if (/^>\s?/.test(next)) break
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(next)) break
      paraLines.push(next)
      i++
    }
    html.push(`<p class="md-p">${inline(paraLines.join(' '))}</p>`)
  }

  closeList()
  return html.join('\n')
}
