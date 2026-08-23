/**
 * v32 文档解析与分块（documentParser.ts）
 *
 * 支持格式：
 *  - .txt / .md / .markdown  直接读文本
 *  - .docx                    JSZip 解包 word/document.xml 抽段落文本（动态加载，不膨胀主包）
 *  - .pdf                     pdfjs-dist 逐页提取文本（动态加载 + worker asset，离线可用）
 *
 * 分块策略（面向中文）：
 *  - 按空行拆「候选段」
 *  - 贪心合并到目标块长（默认 400 字），超长段落内部按窗口切分并保留重叠（60 字）
 *  - 块带标题（文件名）+ 序号，检索结果可直接追溯出处
 */

export interface ParsedChunk {
  text: string
  title: string   // 标题（通常是文件名）
  fileName: string
  seq: number     // 块序号（0 起）
}

export interface ParsedDocument {
  fileName: string
  title: string
  kind: 'txt' | 'md' | 'docx' | 'pdf'
  chunks: ParsedChunk[]
  error?: string
}

const CHUNK_MAX = 400
const CHUNK_OVERLAP = 60

// ============ 分块 ============

/**
 * 把纯文本按「段 → 块」切分。
 * 空行分段；段超长则按窗口切（保留重叠保证上下文连续）。
 */
export function chunkText(text: string, maxLen = CHUNK_MAX, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  // 1) 候选段：空行分割，去掉纯装饰行（如 ---、### 单独行）
  const paragraphs = clean
    .split(/\n\s*\n/)
    .map(p => p.replace(/^\s*#{1,6}\s*/, '').trim()) // 去掉 markdown 标题符号（内容保留）
    .filter(p => p.length > 0 && !/^[-=*_]{3,}$/.test(p))

  const chunks: string[] = []
  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      chunks.push(para)
      continue
    }
    // 超长段：按窗口滑切
    for (let i = 0; i < para.length; i += maxLen - overlap) {
      const piece = para.slice(i, i + maxLen).trim()
      if (piece.length >= 30) chunks.push(piece) // 太短的尾巴并入前块？这里直接保留（尾部片断 >=30 字才成块）
      if (i + maxLen >= para.length) break
    }
  }
  return chunks
}

// ============ 各格式解析 ============

/** 解析 .txt / .md（直接读文本） */
function parsePlainText(fileName: string, content: string): ParsedDocument {
  const title = fileName.replace(/\.(txt|md|markdown)$/i, '')
  const text = content.replace(/^\uFEFF/, '')
  const chunks = chunkText(text).map((c, i) => ({ text: c, title, fileName, seq: i }))
  return { fileName, title, kind: fileName.toLowerCase().endsWith('.md') || fileName.toLowerCase().endsWith('.markdown') ? 'md' : 'txt', chunks }
}

/** 解析 .docx：解压 word/document.xml，按 w:p 提取段落文本 */
async function parseDocx(fileName: string, buf: ArrayBuffer): Promise<ParsedDocument> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)
  const docXml = zip.file('word/document.xml')
  if (!docXml) throw new Error('docx 内缺少 word/document.xml，可能不是标准文档')
  const xml = await docXml.async('string')

  // 段落级提取（w:p → 拼接内部 w:t）
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/g
  const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
  const lines: string[] = []
  let m: RegExpExecArray | null
  while ((m = paraRegex.exec(xml)) !== null) {
    const para = m[0]
    let t: RegExpExecArray | null
    let line = ''
    while ((t = textRegex.exec(para)) !== null) line += t[1]
    line = line.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim()
    if (line) lines.push(line)
  }

  const title = fileName.replace(/\.docx$/i, '')
  const chunks = chunkText(lines.join('\n\n')).map((c, i) => ({ text: c, title, fileName, seq: i }))
  return { fileName, title, kind: 'docx', chunks }
}

/** 解析 .pdf：pdfjs-dist 逐页提取文本（主线程模式，避免 worker 加载问题） */
async function parsePdf(fileName: string, buf: ArrayBuffer): Promise<ParsedDocument> {
  const pdfjs = await import('pdfjs-dist')
  // worker：使用 vite `?url` 静态引用的 worker asset（随包分发，离线可用）
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise
  const pages: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const lineText = content.items
      .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (lineText) pages.push(lineText)
  }
  // pdfjs-dist v6 类型移除了 PDFDocumentProxy.destroy，但运行时仍存在（释放 wasm/worker 资源）
  await (pdf as any).destroy?.()

  const title = fileName.replace(/\.pdf$/i, '')
  const chunks = chunkText(pages.join('\n\n')).map((c, i) => ({ text: c, title, fileName, seq: i }))
  return { fileName, title, kind: 'pdf', chunks }
}

// ============ 入口 ============

const EXT_MAP: Record<string, 'txt' | 'md' | 'docx' | 'pdf'> = {
  txt: 'txt', text: 'txt', md: 'md', markdown: 'md', docx: 'docx', pdf: 'pdf',
}

/**
 * 统一入口：按扩展名解析文档。
 * @param file 浏览器 File 对象（或 {name, arrayBuffer}）
 */
export async function parseDocumentFile(file: File | { name: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<ParsedDocument> {
  const fileName = file.name
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const kind = EXT_MAP[ext]

  if (!kind) {
    return { fileName, title: fileName.replace(/\.[^.]+$/, ''), kind: 'txt', chunks: [], error: `暂不支持 .${ext} 格式（支持 txt / md / docx / pdf）` }
  }

  const buf = await file.arrayBuffer()
  try {
    if (kind === 'txt' || kind === 'md') {
      const content = new TextDecoder('utf-8').decode(buf)
      return parsePlainText(fileName, content)
    }
    if (kind === 'docx') return await parseDocx(fileName, buf)
    if (kind === 'pdf') return await parsePdf(fileName, buf)
  } catch (err) {
    return { fileName, title: fileName.replace(/\.[^.]+$/, ''), kind, chunks: [], error: `解析失败：${err instanceof Error ? err.message : String(err)}` }
  }
  return { fileName, title: fileName.replace(/\.[^.]+$/, ''), kind, chunks: [], error: '未知解析错误' }
}
