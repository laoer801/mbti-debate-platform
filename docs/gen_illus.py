# -*- coding: utf-8 -*-
"""
思辩星球 · 使用指南插图生成器（Pillow）
输出：docs/assets/*.png
"""
import os, math
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
os.makedirs(OUT, exist_ok=True)

BG      = (255, 255, 255)
CARD    = (255, 255, 255)
BORDER  = (226, 232, 240)
SOFT    = (248, 250, 252)
TEAL    = (15, 118, 110)
TEAL_L  = (240, 253, 250)
AMBER   = (180, 83, 9)
AMBER_L = (255, 251, 235)
INDIGO  = (79, 70, 229)
INDIGO_L= (238, 242, 255)
ROSE    = (219, 39, 119)
ROSE_L  = (253, 242, 248)
INK     = (15, 23, 42)
INK2    = (71, 85, 105)
MUTED   = (148, 163, 184)
LINE    = (203, 213, 225)


def F(size, bold=False):
    paths = (['C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/simhei.ttf']
             if bold else ['C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/simhei.ttf'])
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


BREAK_BEFORE = '，。！？、；：）】》」』”’…%!?,.;:)]}'


def wrap(d, text, font, maxw):
    """按宽度折行；避免行首出现收尾标点（标点悬挂）。"""
    lines, cur = [], ''
    for ch in text:
        if ch == '\n':
            if cur:
                lines.append(cur)
            cur = ''
            continue
        if d.textlength(cur + ch, font=font) <= maxw:
            cur += ch
        else:
            if ch in BREAK_BEFORE:      # 标点跟着上一行走
                cur += ch
                lines.append(cur); cur = ''
            else:
                lines.append(cur); cur = ch
    if cur:
        lines.append(cur)
    return lines


def para(d, x, y, text, font, fill, maxw, lh=None):
    lh = lh or int(font.size * 1.45)
    for i, ln in enumerate(wrap(d, text, font, maxw)):
        d.text((x, y + i * lh), ln, font=font, fill=fill)
    return y + len(wrap(d, text, font, maxw)) * lh


def center(d, box, text, font, fill):
    x0, y0, x1, y1 = box
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    d.text((x0 + (x1 - x0 - (r - l)) / 2 - l, y0 + (y1 - y0 - (b - t)) / 2 - t), text, font=font, fill=fill)


def arrow(d, x1, y1, x2, y2, color, w=6, head=20):
    d.line((x1, y1, x2, y2), fill=color, width=w)
    ang = math.atan2(y2 - y1, x2 - x1)
    a = math.radians(26)
    p1 = (x2 - head * math.cos(ang - a), y2 - head * math.sin(ang - a))
    p2 = (x2 - head * math.cos(ang + a), y2 - head * math.sin(ang + a))
    d.polygon([(x2, y2), p1, p2], fill=color)


def header(img, d, title, sub):
    d.text((90, 62), title, font=F(52, True), fill=INK)
    d.text((90, 136), sub, font=F(25), fill=MUTED)
    d.rounded_rectangle((90, 178, 190, 186), radius=4, fill=TEAL)


# ============================================================
# 图 1 · 我的产品八大主张
# ============================================================
def illus_1():
    W, H = 1680, 1010
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    header(img, d, '我的产品八大主张', '从我们的对话中提炼 —— 每一条，都对应一个已经落地的设计决定')

    items = [
        ('真 AI 主义', '每一处 AI 都接真模型，\n绝不用本地模板凑数'),
        ('真实感优先', 'AI 像人一样一句一句说，\n观点讲完才继续'),
        ('场景即语境', '一个内核、四种气质，\n话题随场景实时生成'),
        ('门槛最低', '语音输入 + 按钮化操作，\n让谁都能开口'),
        ('云端零负担', '部署运维全自动，\n用户永远不碰命令行'),
        ('开放借力', '借知乎的内容与大脑，\n不重复造轮子'),
        ('成长可量化', '打分、战报、训练计划，\n进步看得见'),
        ('细节即体验', '音效、退出、开关、删除，\n小事决定成败'),
    ]
    cols, cw, ch, gx, gy = 4, 345, 320, 45, 45
    x0, y0 = 90, 240
    for i, (t, desc) in enumerate(items):
        r, c = divmod(i, cols)
        x = x0 + c * (cw + gx)
        y = y0 + r * (ch + gy)
        d.rounded_rectangle((x, y, x + cw, y + ch), radius=26, fill=CARD, outline=BORDER, width=2)
        d.rounded_rectangle((x, y, x + cw, y + 10), radius=0, fill=TEAL)
        # number badge
        d.ellipse((x + 28, y + 34, x + 96, y + 102), fill=TEAL_L)
        center(d, (x + 28, y + 34, x + 96, y + 102), str(i + 1), F(38, True), TEAL)
        d.text((x + 116, y + 46), t, font=F(34, True), fill=INK)
        para(d, x + 28, y + 132, desc, F(26), INK2, cw - 56, lh=44)
    img.save(os.path.join(OUT, 'illust1_principles.png'))
    print('illust1 OK')


# ============================================================
# 图 2 · 四大场景
# ============================================================
def illus_2():
    W, H = 1680, 940
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    header(img, d, '四大场景 · 一个内核，四种气质', '同一套对战引擎，通过「模式 + 目标 + 话题池 + 玩法提示」派生出四种完全不同的玩法')

    scenes = [
        ('法律辩论 · 普法现场', INDIGO, INDIGO_L, '对抗', '把法律讲清楚', 'AI 生成内容是否受著作权保护？', '较真型 · 想学法的人'),
        ('圆桌会谈 · 哲思夜话', TEAL, TEAL_L, '自由 · 不分胜负', '多元视角，把问题聊透', '人生的意义是赋予的还是本来的？', '沉思型 · 爱思考的人'),
        ('脱口秀大会', AMBER, AMBER_L, '自由', '幽默表达，讲出共鸣', '大学生的钱到底是怎么没的？', '表达型 · 爱讲段子的人'),
        ('街头对谈 · 人间观察', ROSE, ROSE_L, '自由', '接地气，说人话', '合群和做自己，哪个更难？', '所有人 · 想随便聊聊'),
    ]
    cw, ch, gx = 355, 620, 40
    x0, y0 = 90, 240
    for i, (name, col, coll, mode, goal, topic, who) in enumerate(scenes):
        x = x0 + i * (cw + gx)
        d.rounded_rectangle((x, y0, x + cw, y0 + ch), radius=26, fill=CARD, outline=BORDER, width=2)
        d.rounded_rectangle((x, y0, x + cw, y0 + 150), radius=26, fill=col)
        d.rounded_rectangle((x, y0 + 110, x + cw, y0 + 150), radius=0, fill=col)
        para(d, x + 26, y0 + 34, name, F(30, True), (255, 255, 255), cw - 52, lh=42)
        # mode badge
        d.rounded_rectangle((x + 26, y0 + 176, x + 26 + 26 + 15 * len(mode), y0 + 224), radius=16, fill=coll)
        d.text((x + 40, y0 + 186), mode, font=F(23, True), fill=col)
        yy = y0 + 258
        d.text((x + 26, yy), '目标', font=F(23, True), fill=MUTED); yy += 38
        yy = para(d, x + 26, yy, goal, F(26), INK, cw - 52, lh=40) + 22
        d.text((x + 26, yy), '话题示例', font=F(23, True), fill=MUTED); yy += 38
        yy = para(d, x + 26, yy, topic, F(25), INK2, cw - 52, lh=38) + 22
        d.text((x + 26, yy), '适合', font=F(23, True), fill=MUTED); yy += 38
        para(d, x + 26, yy, who, F(25), INK2, cw - 52, lh=38)
    img.save(os.path.join(OUT, 'illust2_scenes.png'))
    print('illust2 OK')


# ============================================================
# 图 3 · 五步上手
# ============================================================
def illus_3():
    W, H = 1680, 760
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    header(img, d, '五步上手 · 从测人格到拿战报', '全过程不超过三分钟，AI 全程在线陪辩')

    steps = [
        ('测人格', '16 型 MBTI 测评，\n测出属于你的星球'),
        ('选场景', '四大场景，\n按此刻心情挑一个'),
        ('开局对阵', '单人对 AI，\n或进房实时 PK'),
        ('逐句交锋', '立论 · 自由 · 总结，\nAI 一句一句回应'),
        ('看战报', '七维评分 +\n个性化训练计划'),
    ]
    cw, ch, gx = 270, 300, 60
    x0, y0 = 90, 300
    for i, (t, desc) in enumerate(steps):
        x = x0 + i * (cw + gx)
        d.rounded_rectangle((x, y0, x + cw, y0 + ch), radius=26, fill=CARD, outline=BORDER, width=2)
        d.ellipse((x + cw / 2 - 46, y0 - 46, x + cw / 2 + 46, y0 + 46), fill=TEAL)
        center(d, (x + cw / 2 - 46, y0 - 46, x + cw / 2 + 46, y0 + 46), str(i + 1), F(46, True), (255, 255, 255))
        center(d, (x, y0 + 66, x + cw, y0 + 122), t, F(32, True), INK)
        para(d, x + 26, y0 + 148, desc, F(24), INK2, cw - 52, lh=38)
        if i < 4:
            arrow(d, x + cw + 10, y0 + ch / 2, x + cw + gx - 10, y0 + ch / 2, LINE, w=6)
    img.save(os.path.join(OUT, 'illust3_flow.png'))
    print('illust3 OK')


# ============================================================
# 图 4 · 两种玩法路径
# ============================================================
def illus_4():
    W, H = 1680, 880
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    header(img, d, '两种玩法，一个入口', '人格广场是唯一入口 —— 往下分成单人对辩与实时 PK 两条路')

    # top entry
    ew, eh = 460, 130
    ex = (W - ew) / 2
    d.rounded_rectangle((ex, 236, ex + ew, 236 + eh), radius=24, fill=INK)
    center(d, (ex, 236, ex + ew, 236 + eh), '进入 · 人格广场', F(36, True), (255, 255, 255))

    # trunk
    d.line((W / 2, 236 + eh, W / 2, 430), fill=LINE, width=7)
    d.line((W * 0.27, 430, W * 0.73, 430), fill=LINE, width=7)
    arrow(d, W * 0.27, 430, W * 0.27, 490, LINE, w=7)
    arrow(d, W * 0.73, 430, W * 0.73, 490, LINE, w=7)

    def panel(cx, title, col, coll, rows, who):
        w, h = 620, 330
        x = cx - w / 2
        y = 490
        d.rounded_rectangle((x, y, x + w, y + h), radius=26, fill=CARD, outline=BORDER, width=2)
        d.rounded_rectangle((x, y, x + w, y + 84), radius=26, fill=col)
        d.rounded_rectangle((x, y + 46, x + w, y + 84), radius=0, fill=col)
        center(d, (x, y, x + w, y + 84), title, F(34, True), (255, 255, 255))
        yy = y + 112
        for r in rows:
            d.ellipse((x + 32, yy + 12, x + 48, yy + 28), fill=col)
            d.text((x + 66, yy), r, font=F(26), fill=INK2)
            yy += 52
        d.rounded_rectangle((x + 26, y + h - 62, x + w - 26, y + h - 22), radius=14, fill=coll)
        d.text((x + 44, y + h - 56), who, font=F(23, True), fill=col)

    panel(W * 0.27, '单人 · 与 AI 对辩', TEAL, TEAL_L,
          ['自选难度：初级 / 中级 / 大师', 'AI 充当反方，与你正反交锋', '随时可让 AI「继续说」'],
          '适合：想练手、不想等对手')
    panel(W * 0.73, '对战 · 实时 PK', INDIGO, INDIGO_L,
          ['建房或加入房间，落座开辩', '与真人或 AI 同场竞技', '服务器判定胜负，双端一致'],
          '适合：想找对手、体验竞技')
    img.save(os.path.join(OUT, 'illust4_paths.png'))
    print('illust4 OK')


# ============================================================
# 图 5 · 逐句发言节奏
# ============================================================
def illus_5():
    W, H = 1680, 1000
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    header(img, d, 'AI 像真人一样说话', '同样是「回复一段话」，两种节奏的体验天差地别')

    # ---- lane A: ordinary ----
    y = 300
    d.text((90, y), '普通 AI 对话', font=F(30, True), fill=MUTED)
    d.rounded_rectangle((90, y + 56, 760, y + 200), radius=22, fill=SOFT, outline=BORDER, width=2)
    para(d, 118, y + 84, '一句话把整段回复一次性倾倒出来，像在读一段提前写好的稿子 —— 快，但有机器感。',
         F(26), INK2, 620, lh=42)

    # ---- divider ----
    d.line((90, y + 250, 1590, y + 250), fill=BORDER, width=2)

    # ---- lane B: DebateSphere ----
    y2 = y + 320
    d.text((90, y2), '思辩星球', font=F(30, True), fill=TEAL)
    bubbles = [('先立个靶', ''), ('你说的前提', '其实站不住'), ('举个反例', ''), ('所以真正的问题', '在于…'), ('结论', '')]
    bx, by = 90, y2 + 56
    bw, bh, gap = 268, 132, 40
    for i, (l1, l2) in enumerate(bubbles):
        x = bx + i * (bw + gap)
        d.rounded_rectangle((x, by, x + bw, by + bh), radius=20, fill=TEAL_L, outline=TEAL, width=2)
        if l2:
            d.text((x + 22, by + 34), l1, font=F(25, True), fill=TEAL)
            d.text((x + 22, by + 72), l2, font=F(25), fill=INK2)
        else:
            para(d, x + 22, by + 48, l1, F(26), TEAL, bw - 44, lh=38)
        d.text((x + 8, by + bh + 10), '%.1fs' % (i * 1.1), font=F(22), fill=MUTED)
        if i < 4:
            arrow(d, x + bw + 6, by + bh / 2, x + bw + gap - 6, by + bh / 2, TEAL, w=5, head=14)

    # phase bar
    py = by + bh + 66
    d.rounded_rectangle((90, py, 1590, py + 76), radius=18, fill=SOFT, outline=BORDER, width=2)
    segs = [('立论阶段', 0), ('自由辩论', 1), ('总结陈词', 2)]
    # markers
    d.text((118, py + 24), '阶段推进：', font=F(26, True), fill=INK)
    d.text((330, py + 24), '立论  →  自由辩论  →  总结', font=F(26), fill=INK2)
    d.text((980, py + 24), '观点表达完整之后，才切换到下一阶段', font=F(25, True), fill=AMBER)
    img.save(os.path.join(OUT, 'illust5_rhythm.png'))
    print('illust5 OK')


if __name__ == '__main__':
    illus_1(); illus_2(); illus_3(); illus_4(); illus_5()
    for f in sorted(os.listdir(OUT)):
        print(' ', f, os.path.getsize(os.path.join(OUT, f)), 'bytes')
