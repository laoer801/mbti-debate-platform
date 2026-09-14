# -*- coding: utf-8 -*-
"""
思辩星球 · 产品思想与使用指南 生成器
内容模型 CONTENT → Word (.docx) + 打印友好 HTML（内嵌插图）
"""
import os, io, base64, html as H
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(OUT_DIR, 'assets')
DOCX_PATH = os.path.join(OUT_DIR, "产品思想与使用指南-思辩星球.docx")
HTML_PATH = os.path.join(OUT_DIR, "产品思想与使用指南-思辩星球.html")

CN = '微软雅黑'
EN = 'Segoe UI'

INK   = RGBColor(0x1E, 0x29, 0x3B)
INK2  = RGBColor(0x47, 0x55, 0x69)
MUTED = RGBColor(0x64, 0x74, 0x8B)
PRIMARY = RGBColor(0x0F, 0x76, 0x6E)
ACCENT2 = RGBColor(0xB4, 0x53, 0x09)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

H_FILL = '134E4A'
Z_FILL = 'F0FDFA'
BORDER = 'CBD5E1'
H1_LINE = '0F766E'
CALLOUT_FILL = 'FFFBEB'
CALLOUT_BORDER = 'FDE68A'
CALLOUT_TEXT = RGBColor(0x92, 0x40, 0x0E)


# ============================================================
# CONTENT MODEL
# ============================================================
CONTENT = [
    ('cover',),

    ('h1', '前言'),
    ('p', '这不是一份产品规格书。它只做两件事：第一，把你在整个开发过程中反复表达过的判断与要求，提炼成一套能复述、能坚持的产品主张；第二，给出配套的使用指南，让任何人拿到产品就知道怎么用。'),
    ('p', '下面每一条主张后面，都写清了"你为什么这么想"（来自我们的对话）与"产品怎么落地"（对应真实实现）。没有空话——你提过的每一句，都能在文档里找到落点。'),
    ('callout', '一句话总结你的产品主张：做真 AI、说人话、按场景分玩法、把门槛降到零、运维全自动、能力靠借力、成长看得见、细节做扎实。'),

    # ======================= 第一部分 =======================
    ('h1', '第一部分 · 我的产品思想'),
    ('h2', '1.1 主张总览'),
    ('p', '八条主张，构成这个产品的性格。它们不是并列的口号，而是有先后：先解决"真不真、像不像人"，再解决"好不好玩、好不好用"，最后才是"长不长得大"。'),
    ('img', 'illust1_principles.png', '图 1 · 我的产品八大主张'),
    ('h2', '1.2 主张详解'),

    ('h3', '主张一 · 真 AI 主义'),
    ('bullets', [
        '主张：产品的每一处 AI 都必须接真模型，绝不拿本地模板"假装"智能。',
        '你为什么这么想：你反复确认"这个链接的是 AI 吗""PK 连接 AI，识别题目辩论大师"。对你来说，一个只会套模板的假对手，等于没有对手。',
        '产品怎么落地：全站 AI 统一走知乎直答（初级 / 中级用 fast 档，大师用 thinking 档）；生成失败宁可提示"AI 走神了"，也绝不落本地模板凑数。',
    ]),
    ('h3', '主张二 · 真实感优先'),
    ('bullets', [
        '主张：AI 要像真人一样说话——一句一句说，把观点讲完整，再进入下一轮。',
        '你为什么这么想：你的原话是"把辩论语言论点分成几句发出，一句一句发，不是让你转到下一阶段，观点表达要完整"。你要的不是快，是像。',
        '产品怎么落地：发言节奏引擎——按句拆分发，每约 1.1 秒落一条，观点表达完整后才交还回合、切换阶段。',
    ]),
    ('h3', '主张三 · 场景即语境'),
    ('bullets', [
        '主张：一个内核、四种气质；话题要跟着场景走，而不是一个模子套所有。',
        '你为什么这么想：你要求四个场景各自差异化——法律要普法、圆桌不设正反、脱口秀要有趣、街头要日常，且话题不能是写死的。',
        '产品怎么落地：场景由"模式 + 目标 + 话题池 + 玩法提示"四要素定义；进入场景后，话题由 AI 结合知乎热榜实时生成。',
    ]),
    ('h3', '主张四 · 门槛最低'),
    ('bullets', [
        '主张：让任何一个人都能开口——不懂规则也能玩，不想打字就用说的。',
        '你为什么这么想：语音输入、按键音效、"请 AI 继续说"、退出按钮、删除自己的内容——你点名要的每一项，本质都是在降低使用门槛。',
        '产品怎么落地：Web Speech 语音输入、一键 poke AI、明显的退出按钮、可删除自己发布的帖子与记录。',
    ]),
    ('h3', '主张五 · 云端零负担'),
    ('bullets', [
        '主张：用户永远不碰命令行；部署、升级、证书，都该自动完成。',
        '你为什么这么想：你说过"不要让我做了""你自己解决"——在你看来，运维的复杂度不该转嫁给使用者。',
        '产品怎么落地：HTTPS 3443 开箱解锁麦克风并公开 CA 证书；云端一条命令完成整包发布与自检。',
    ]),
    ('h3', '主张六 · 开放借力'),
    ('bullets', [
        '主张：不重复造轮子——能用知乎的内容与大脑，就不自己从零搭建。',
        '你为什么这么想：你的要求是"全部链接 AI，还有知乎，不要本地部署"。你选的是借力，而不是自建。',
        '产品怎么落地：已接入知乎直答、全网搜索、热榜、用户内容与收藏共 6 类 API，纯加法、不侵入既有功能。',
    ]),
    ('h3', '主张七 · 成长可量化'),
    ('bullets', [
        '主张：光"辩论爽"不够，要让用户看见自己的进步。',
        '你为什么这么想：你反复追问 AI 到底有没有真发言、观点完不完整——你真正在意的，是这一场有没有发生真实的交锋与收获。',
        '产品怎么落地：七维评分 + 辩论报告 + 个性化 7 天训练计划 + 实力分匹配，让每一场都留下可回溯的成长轨迹。',
    ]),
    ('h3', '主张八 · 细节即体验'),
    ('bullets', [
        '主张：产品好不好，取决于音效、开关、退出、删除这些小事。',
        '你为什么这么想：音效要能开关、PK 要有退出、帖子要能自己删——你逐条点名，说明你认定体验藏在这些地方。',
        '产品怎么落地：全站按键音效（设置页可关）、PK 明显退出按钮、内容自删、错误全可视化提示。',
    ]),

    ('h2', '1.3 从主张到功能：一句话对照'),
    ('table', ['主张', '对应能力'], [
        ['真 AI 主义', '知乎直答驱动全部 AI，失败降级而非降智'],
        ['真实感优先', '逐句发言节奏引擎'],
        ['场景即语境', '四大场景 + AI 实时命题'],
        ['门槛最低', '语音输入 / poke / 退出 / 自删'],
        ['云端零负担', 'HTTPS 开箱 + 自动化部署'],
        ['开放借力', '6 类知乎 API 接入'],
        ['成长可量化', '七维评分 + 训练计划 + 实力分'],
        ['细节即体验', '音效开关 / 可视化错误 / 可逆操作'],
    ]),

    # ======================= 第二部分 =======================
    ('h1', '第二部分 · 思想如何变成玩法'),
    ('h2', '2.1 四大场景：一个内核，四种气质'),
    ('p', '这是"场景即语境"的落地。同一套对战引擎，通过模式、目标、话题池与玩法提示的差异，派生出四种完全不同的玩法。'),
    ('img', 'illust2_scenes.png', '图 2 · 四大场景一览'),
    ('table', ['场景', '模式', '一句话玩法'], [
        ['法律辩论 · 普法现场', '对抗', '法官 + 控辩双方，把法律讲清楚'],
        ['圆桌会谈 · 哲思夜话', '自由 · 不分胜负', '没有正反方，围坐把一个问题聊透'],
        ['脱口秀大会', '自由', '幽默是唯一正义，必须落到生活细节'],
        ['街头对谈 · 人间观察', '自由', '像街头采访，说人话、别端着'],
    ]),
    ('h2', '2.2 两种玩法：一个入口'),
    ('p', '所有玩法都从"人格广场"进入，再分成单人对辩与实时 PK 两条路——想练手就单挑 AI，想找对手就进房开赛。'),
    ('img', 'illust4_paths.png', '图 3 · 两种玩法路径'),
    ('h2', '2.3 AI 的四个角色'),
    ('table', ['角色', '做什么', '用到时'], [
        ['AI 辩手', '与人格化 AI 展开多智能体辩论', '单人辩论模式'],
        ['AI 对手', '充当反方，三档难度自适应', 'PK 对战中'],
        ['AI 裁判', '七维评分、判定胜负、生成战报', '每场结束时'],
        ['AI 教练', '依据表现给出个性化训练计划', '赛后成长环节'],
    ]),

    # ======================= 第三部分 =======================
    ('h1', '第三部分 · 如何使用'),
    ('h2', '3.1 五步上手'),
    ('p', '从测人格到拿战报，全过程不超过三分钟，AI 全程在线陪辩。'),
    ('img', 'illust3_flow.png', '图 4 · 五步上手流程'),
    ('h3', '第一步 · 测人格'),
    ('p', '花两分钟做 16 型 MBTI 测评，得到属于你的"星球"——不只是四个字母，还有认知、情感、意志、社交、表达五维驱力画像。人格会随你的辩论历史持续演化。'),
    ('h3', '第二步 · 选场景'),
    ('p', '进入人格广场，按此刻心情挑一个场景：想较真选法律辩论，想静下来聊选圆桌，想搞笑选脱口秀，想随便聊聊选街头。'),
    ('h3', '第三步 · 开局对阵'),
    ('p', '一个人就选"单人 · 与 AI 对辩"，挑难度直接开打；想找对手就建房或加入房间，进实时 PK。'),
    ('h3', '第四步 · 逐句交锋'),
    ('p', '这是本产品最与众不同的一步——AI 不会甩给你一整段，而是一句一句地回，观点讲完整了才进入下一阶段。你随时可以点"请 AI 继续说"，也可以随时退出。'),
    ('img', 'illust5_rhythm.png', '图 5 · AI 逐句发言的节奏'),
    ('h3', '第五步 · 看战报与成长'),
    ('p', '每场结束自动生成战报：七维评分、胜负判定、以及基于你最弱维度的 7 天训练计划。打完不是结束，而是下一场变强的起点。'),
    ('h2', '3.2 进阶技巧'),
    ('bullets', [
        '懒得打字就用说的——点麦克风图标，语音实时转文字；若提示不安全，切到 HTTPS 版并安装 CA 证书即可解锁。',
        'AI 卡壳了别急——点"请 AI 继续说"，它会接着把观点讲完。',
        '让 AI 更懂你——把你的知乎回答、文章、收藏导入知识库，下一场 AI 就能引用你自己的论点。',
        '想练难度就调档——从初级一路打到大师，AI 会越来越会用你的表达方式与你交锋。',
        '打完看训练计划——按报告里的 7 天计划练，最弱的维度提升最快。',
    ]),
    ('h2', '3.3 设置与常见问题'),
    ('table', ['问题 / 需求', '怎么做'], [
        ['想关掉按键音效', '设置页 → 界面音效 → 关闭'],
        ['麦克风用不了', '改用 HTTPS 地址访问，并按提示安装信任 CA 证书'],
        ['想删除自己发的帖子', '在帖子右上角点删除，仅本人可见、可删'],
        ['想中途退出 PK', '点顶部"退出"按钮，二次确认后离开房间'],
        ['AI 没反应', '点"请 AI 继续说"；若仍无响应，多为上游限流，稍后再试'],
        ['换设备还能继续吗', '可以——账号、人格、成长记录都在云端'],
    ]),

    # ======================= 结语 =======================
    ('h1', '结语'),
    ('p', '这份文档把你的判断整理成了一套主张。它们能撑起一个清晰的产品：不装智能、不摆模板、不说空话，把"敢不敢说、有没有人应、说不说得下去、说完了有没有收获"这四个最朴素的问题解决好。'),
    ('callout', '人格给他身份，AI 给他对手，辩论给他内容，战报给他成长，而知乎生态给他更大的回响。'),
]


# ============================================================
# Word renderer
# ============================================================
def _rfonts(run, ascii_font, ea_font):
    rPr = run._element.get_or_add_rPr()
    rf = rPr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rPr.insert(0, rf)
    rf.set(qn('w:ascii'), ascii_font); rf.set(qn('w:hAnsi'), ascii_font)
    rf.set(qn('w:eastAsia'), ea_font); rf.set(qn('w:cs'), ascii_font)


def style_run(run, size=10.5, bold=False, color=INK, italic=False):
    run.font.size = Pt(size); run.bold = bold; run.italic = italic
    run.font.color.rgb = color
    _rfonts(run, EN, CN)


def shade_cell(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), fill)
    tcPr.append(shd)


def set_cell_margins(table, top=60, bottom=60, left=100, right=100):
    mar = OxmlElement('w:tblCellMar')
    for tag, val in (('top', top), ('left', left), ('bottom', bottom), ('right', right)):
        el = OxmlElement('w:' + tag); el.set(qn('w:w'), str(val)); el.set(qn('w:type'), 'dxa'); mar.append(el)
    table._tbl.tblPr.append(mar)


def table_borders(table, color=BORDER, sz=6):
    borders = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement('w:' + edge)
        el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), str(sz))
        el.set(qn('w:space'), '0'); el.set(qn('w:color'), color)
        borders.append(el)
    table._tbl.tblPr.append(borders)


def para_spacing(p, before=0, after=6, line=1.5):
    pf = p.paragraph_format
    pf.space_before = Pt(before); pf.space_after = Pt(after); pf.line_spacing = line
    return p


def add_page_number(paragraph):
    run = paragraph.add_run()
    style_run(run, size=8.5, color=MUTED)
    f1 = OxmlElement('w:fldChar'); f1.set(qn('w:fldCharType'), 'begin')
    it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = 'PAGE'
    f2 = OxmlElement('w:fldChar'); f2.set(qn('w:fldCharType'), 'end')
    run._r.append(f1); run._r.append(it); run._r.append(f2)


def build_docx():
    doc = Document()
    normal = doc.styles['Normal']
    normal.font.name = EN; normal.font.size = Pt(10.5); normal.font.color.rgb = INK
    rpr = normal.element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rpr.insert(0, rf)
    rf.set(qn('w:ascii'), EN); rf.set(qn('w:hAnsi'), EN); rf.set(qn('w:eastAsia'), CN)

    sec = doc.sections[0]
    sec.top_margin = Cm(2.2); sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.2); sec.right_margin = Cm(2.2)

    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_page_number(fp)

    first = {'v': True}
    for block in CONTENT:
        kind = block[0]

        if kind == 'cover':
            p = doc.add_paragraph(); para_spacing(p, before=90, after=4, line=1.0)
            style_run(p.add_run('◉ 思辩星球  DebateSphere'), size=12, bold=True, color=PRIMARY)
            p = doc.add_paragraph(); para_spacing(p, before=40, after=2, line=1.0)
            style_run(p.add_run('产品思想与使用指南'), size=32, bold=True, color=INK)
            p = doc.add_paragraph(); para_spacing(p, before=0, after=10, line=1.2)
            style_run(p.add_run('从对话中提炼的产品主张 · 附完整使用手册'), size=13, color=ACCENT2)
            p = doc.add_paragraph(); para_spacing(p, before=2, after=14, line=1.0)
            style_run(p.add_run('─' * 34), size=10, color=PRIMARY)
            p = doc.add_paragraph(); para_spacing(p, before=0, after=4, line=1.3)
            style_run(p.add_run('让每一种人格，都成为一颗星球。'), size=12, italic=True, color=INK2)
            p = doc.add_paragraph(); para_spacing(p, before=120, after=0, line=1.6)
            for line in ['文档版本：v1.0', '编制日期：2026 年 9 月', '文档密级：内部资料']:
                style_run(p.add_run(line + '\n'), size=10, color=MUTED)
            doc.add_page_break()
            continue

        if kind == 'pagebreak':
            doc.add_page_break(); first['v'] = True; continue

        if kind == 'h1':
            if not first['v']:
                doc.add_page_break()
            first['v'] = False
            p = doc.add_paragraph(); para_spacing(p, before=0, after=10, line=1.15)
            style_run(p.add_run(block[1]), size=19, bold=True, color=INK)
            pPr = p._p.get_or_add_pPr(); pbdr = OxmlElement('w:pBdr')
            b = OxmlElement('w:bottom')
            b.set(qn('w:val'), 'single'); b.set(qn('w:sz'), '12'); b.set(qn('w:space'), '6'); b.set(qn('w:color'), H1_LINE)
            pbdr.append(b); pPr.append(pbdr)
            continue

        if kind == 'h2':
            p = doc.add_paragraph(); para_spacing(p, before=12, after=5, line=1.2)
            style_run(p.add_run(block[1]), size=14, bold=True, color=PRIMARY)
            continue

        if kind == 'h3':
            p = doc.add_paragraph(); para_spacing(p, before=8, after=4, line=1.2)
            style_run(p.add_run(block[1]), size=12, bold=True, color=INK)
            continue

        if kind == 'p':
            p = doc.add_paragraph(); para_spacing(p, before=0, after=7, line=1.55)
            style_run(p.add_run(block[1]), size=10.5, color=INK2)
            continue

        if kind in ('bullets', 'nums'):
            for i, item in enumerate(block[1]):
                p = doc.add_paragraph(); para_spacing(p, before=0, after=4, line=1.5)
                p.paragraph_format.left_indent = Cm(0.75)
                p.paragraph_format.first_line_indent = Cm(-0.42)
                style_run(p.add_run('•  ' if kind == 'bullets' else '%d.  ' % (i + 1)), size=10.5, bold=True, color=PRIMARY)
                style_run(p.add_run(item), size=10.5, color=INK2)
            continue

        if kind == 'callout':
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            table_borders(tbl, color=CALLOUT_BORDER, sz=4)
            set_cell_margins(tbl, 100, 100, 160, 140)
            c = tbl.cell(0, 0); shade_cell(c, CALLOUT_FILL); c.text = ''
            p = c.paragraphs[0]; para_spacing(p, before=0, after=0, line=1.45)
            style_run(p.add_run(block[1]), size=10.5, bold=True, color=CALLOUT_TEXT)
            sp = doc.add_paragraph(); para_spacing(sp, before=0, after=0, line=1.0)
            continue

        if kind == 'img':
            fname, caption = block[1], block[2]
            path = os.path.join(ASSETS, fname)
            p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            para_spacing(p, before=6, after=3, line=1.0)
            run = p.add_run()
            run.add_picture(path, width=Cm(16.0))
            pc = doc.add_paragraph(); pc.alignment = WD_ALIGN_PARAGRAPH.CENTER
            para_spacing(pc, before=0, after=10, line=1.2)
            style_run(pc.add_run(caption), size=9, italic=True, color=MUTED)
            continue

        if kind == 'table':
            headers, rows = block[1], block[2]
            ncol = len(headers)
            tbl = doc.add_table(rows=1, cols=ncol)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            table_borders(tbl); set_cell_margins(tbl)
            for j, htext in enumerate(headers):
                c = tbl.cell(0, j); shade_cell(c, H_FILL); c.text = ''
                p = c.paragraphs[0]; para_spacing(p, before=1, after=1, line=1.2)
                style_run(p.add_run(htext), size=9.5, bold=True, color=WHITE)
            for i, row in enumerate(rows):
                cells = tbl.add_row().cells
                for j in range(ncol):
                    c = cells[j]
                    if i % 2 == 1:
                        shade_cell(c, Z_FILL)
                    c.text = ''
                    p = c.paragraphs[0]; para_spacing(p, before=1, after=1, line=1.3)
                    style_run(p.add_run(row[j] if j < len(row) else ''), size=9.5, color=INK2, bold=(j == 0))
            sp = doc.add_paragraph(); para_spacing(sp, before=0, after=2, line=1.0)
            continue

    doc.save(DOCX_PATH)
    return DOCX_PATH


# ============================================================
# HTML renderer（插图 base64 内嵌，单文件自包含）
# ============================================================
def esc(t):
    return H.escape(t)


def img_uri(fname):
    with open(os.path.join(ASSETS, fname), 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


def build_html():
    css = """
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { margin:0; background:#eef1f6; color:#1e293b;
      font-family:"Segoe UI","Microsoft YaHei","微软雅黑",-apple-system,sans-serif;
      font-size:14px; line-height:1.7; }
    .page { max-width:840px; margin:0 auto; background:#fff; padding:56px 60px 72px;
      box-shadow:0 10px 40px rgba(15,23,42,.10); }
    .cover { min-height:960px; display:flex; flex-direction:column; justify-content:center; padding:60px 0; }
    .brand { color:#0f766e; font-weight:700; font-size:15px; letter-spacing:.5px; }
    h1.title { font-size:40px; font-weight:800; letter-spacing:-1px; margin:26px 0 10px; color:#0f172a; }
    .subtitle { font-size:16px; color:#b45309; font-weight:600; margin-bottom:18px; }
    .rule { height:4px; width:120px; background:linear-gradient(90deg,#0f766e,#b45309); border-radius:3px; margin:0 0 22px; }
    .tagline { font-size:17px; color:#475569; font-style:italic; }
    .meta { margin-top:120px; color:#64748b; font-size:13px; line-height:2; }
    h1 { font-size:25px; font-weight:800; color:#0f172a; margin:44px 0 16px; padding-bottom:10px;
      border-bottom:2.5px solid #0f766e; letter-spacing:-.4px; page-break-after:avoid; }
    h2 { font-size:18px; font-weight:700; color:#0f766e; margin:28px 0 10px; page-break-after:avoid; }
    h3 { font-size:15px; font-weight:700; color:#1e293b; margin:20px 0 8px; page-break-after:avoid; }
    p { margin:0 0 12px; color:#475569; }
    ul,ol { margin:0 0 14px; padding-left:22px; }
    li { margin-bottom:6px; color:#475569; }
    .callout { background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:14px 18px;
      margin:14px 0; color:#92400e; font-weight:600; }
    figure { margin:18px 0 22px; text-align:center; page-break-inside:avoid; }
    figure img { width:100%; border:1px solid #e2e8f0; border-radius:12px; }
    figcaption { margin-top:8px; color:#94a3b8; font-size:12.5px; font-style:italic; }
    table { width:100%; border-collapse:collapse; margin:14px 0 20px; font-size:13px; page-break-inside:avoid; }
    th { background:#134e4a; color:#fff; text-align:left; padding:9px 12px; font-weight:600; font-size:12.5px; }
    td { padding:8px 12px; border-bottom:1px solid #cbd5e1; color:#475569; vertical-align:top; }
    td:first-child { color:#1e293b; font-weight:600; }
    tbody tr:nth-child(even) td { background:#f0fdfa; }
    .sec { page-break-before:always; }
    .foot { margin-top:40px; padding-top:14px; border-top:1px solid #e2e8f0;
      color:#94a3b8; font-size:12px; text-align:center; }
    @media print { body{background:#fff;} .page{box-shadow:none; margin:0; max-width:none; padding:0;} }
    """
    out = ['<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">',
           '<meta name="viewport" content="width=device-width, initial-scale=1">',
           '<title>产品思想与使用指南 · 思辩星球 DebateSphere</title>',
           '<style>%s</style></head><body><div class="page">' % css]

    for block in CONTENT:
        k = block[0]
        if k == 'cover':
            out.append('<div class="cover">'
                       '<div class="brand">◉ 思辩星球 &nbsp;DebateSphere</div>'
                       '<h1 class="title">产品思想与使用指南</h1>'
                       '<div class="subtitle">从对话中提炼的产品主张 · 附完整使用手册</div>'
                       '<div class="rule"></div>'
                       '<div class="tagline">让每一种人格，都成为一颗星球。</div>'
                       '<div class="meta">文档版本：v1.0<br>编制日期：2026 年 9 月<br>文档密级：内部资料</div>'
                       '</div>')
        elif k == 'pagebreak':
            out.append('<div class="sec"></div>')
        elif k == 'h1':
            out.append('<h1>%s</h1>' % esc(block[1]))
        elif k == 'h2':
            out.append('<h2>%s</h2>' % esc(block[1]))
        elif k == 'h3':
            out.append('<h3>%s</h3>' % esc(block[1]))
        elif k == 'p':
            out.append('<p>%s</p>' % esc(block[1]))
        elif k == 'bullets':
            out.append('<ul>' + ''.join('<li>%s</li>' % esc(x) for x in block[1]) + '</ul>')
        elif k == 'nums':
            out.append('<ol>' + ''.join('<li>%s</li>' % esc(x) for x in block[1]) + '</ol>')
        elif k == 'callout':
            out.append('<div class="callout">%s</div>' % esc(block[1]))
        elif k == 'img':
            out.append('<figure><img src="%s" alt="%s"><figcaption>%s</figcaption></figure>'
                       % (img_uri(block[1]), esc(block[2]), esc(block[2])))
        elif k == 'table':
            headers, rows = block[1], block[2]
            th = ''.join('<th>%s</th>' % esc(x) for x in headers)
            tb = ''.join('<tr>' + ''.join('<td>%s</td>' % esc(c) for c in r) + '</tr>' for r in rows)
            out.append('<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (th, tb))

    out.append('<div class="foot">思辩星球 DebateSphere · 产品思想与使用指南 v1.0 · 2026-09 · 内部资料</div>')
    out.append('</div></body></html>')

    with io.open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    return HTML_PATH


if __name__ == '__main__':
    d = build_docx(); h = build_html()
    print('DOCX:', d, os.path.getsize(d), 'bytes')
    print('HTML:', h, os.path.getsize(h), 'bytes')
