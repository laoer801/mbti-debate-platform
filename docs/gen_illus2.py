# -*- coding: utf-8 -*-
"""思辩星球 · 功能手册插图（复用 gen_illus 的绘图基元）"""
import os
import gen_illus as G
from PIL import Image, ImageDraw

OUT = G.OUT
F, para, center, arrow, header = G.F, G.para, G.center, G.arrow, G.header
TEAL, TEAL_L, AMBER, AMBER_L, INDIGO, INDIGO_L = G.TEAL, G.TEAL_L, G.AMBER, G.AMBER_L, G.INDIGO, G.INDIGO_L
ROSE, ROSE_L, INK, INK2, MUTED, LINE, CARD, BORDER, SOFT = G.ROSE, G.ROSE_L, G.INK, G.INK2, G.MUTED, G.LINE, G.CARD, G.BORDER, G.SOFT


def label(d, x, y, text, size=22, color=INK2, bold=False):
    d.text((x, y), text, font=F(size, bold), fill=color)


# ============================================================
# 图 A · 全站导航地图（12 入口）
# ============================================================
def fig_nav():
    W, H = 1680, 900
    img = Image.new('RGB', (W, H), G.BG)
    d = ImageDraw.Draw(img)
    header(img, d, '全站导航 · 12 个入口', '顶部导航栏 12 个标签，以英文代号排列')

    tabs = [
        ('HALL', '人格大厅', '主入口', INDIGO), ('ARENA', '辩论室', 'AI 多方辩论', INDIGO),
        ('SCENE', '场景模式', '四大场景', TEAL), ('PK', 'PK 房间', '实时对战', TEAL),
        ('CHAT', '1v1 对话', '单聊人格', TEAL), ('SQUARE', '观点广场', '发帖讨论', AMBER),
        ('MATCH', '匹配推荐', '人格配对', AMBER), ('LOG', '战斗记录', '历史回放', ROSE),
        ('STATS', '数据统计', '成长曲线', ROSE), ('PETS', '宠物商城', '养成战斗', ROSE),
        ('LIB', '知识库', '资料学习', INDIGO), ('SYS', '设置', '音效主题', INK2),
    ]
    cols, cw, ch, gx, gy = 4, 345, 175, 40, 40
    x0, y0 = 90, 236
    for i, (en, cn, desc, col) in enumerate(tabs):
        r, c = divmod(i, cols)
        x = x0 + c * (cw + gx)
        y = y0 + r * (ch + gy)
        d.rounded_rectangle((x, y, x + cw, y + ch), radius=22, fill=CARD, outline=BORDER, width=2)
        d.rounded_rectangle((x, y, x + 8, y + ch), radius=4, fill=col)
        d.text((x + 30, y + 26), en, font=F(34, True), fill=col)
        d.text((x + 30, y + 78), cn, font=F(28, True), fill=INK)
        d.text((x + 30, y + 122), desc, font=F(23), fill=MUTED)
    img.save(os.path.join(OUT, 'illustA_nav.png'))
    print('figA ok')


# ============================================================
# 图 B · PK 房间界面按键标注
# ============================================================
def fig_pk():
    W, H = 1680, 1210
    img = Image.new('RGB', (W, H), G.BG)
    d = ImageDraw.Draw(img)
    header(img, d, 'PK 房间 · 按键标注', '左为界面示意，右为每个按键的位置与作用')

    fx0, fy0, fx1, fy1 = 120, 250, 800, 1160
    d.rounded_rectangle((fx0, fy0, fx1, fy1), radius=30, fill=SOFT, outline=LINE, width=3)
    bx0, bx1 = 205, 770      # band inner
    gut = 162                # gutter x for dots

    def band(y0, y1, fill=CARD):
        d.rounded_rectangle((bx0, y0, bx1, y1), radius=16, fill=fill, outline=BORDER, width=2)

    def dot(n, cx, cy, r=19, col=AMBER):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)
        center(d, (cx - r, cy - r, cx + r, cy + r), str(n), F(22, True), (255, 255, 255))

    # 1 顶栏
    band(272, 340)
    label(d, bx0 + 22, 292, '退出', 23, INK, True)
    label(d, bx0 + 290, 292, '自由辩论   04:32', 22, TEAL, True)
    dot(1, gut, 306); dot(2, bx0 + 250, 306)

    # 进度条
    d.rounded_rectangle((bx0, 352, bx1, 360), radius=4, fill=TEAL)
    label(d, bx0 + 2, 368, '阶段进度条', 18, MUTED)

    # 3 参赛者
    band(400, 464)
    label(d, bx0 + 22, 420, '你 · 正方', 22, INDIGO, True)
    label(d, bx0 + 300, 420, '辩友 · 反方', 22, ROSE, True)
    dot(3, gut, 432)

    # 4 宠物擂台
    band(482, 646)
    label(d, bx0 + 22, 502, '宠物擂台', 23, INK, True)
    label(d, bx0 + 22, 536, '服务器权威 HP · 发言即攻击', 19, MUTED)
    label(d, bx0 + 22, 572, '我方 HP', 20, TEAL, True)
    d.rounded_rectangle((bx0 + 130, 574, bx0 + 430, 592), radius=9, fill=(226, 232, 240))
    d.rounded_rectangle((bx0 + 130, 574, bx0 + 340, 592), radius=9, fill=TEAL)
    label(d, bx0 + 22, 602, '对方 HP', 20, ROSE, True)
    d.rounded_rectangle((bx0 + 130, 604, bx0 + 430, 622), radius=9, fill=(226, 232, 240))
    d.rounded_rectangle((bx0 + 130, 604, bx0 + 265, 622), radius=9, fill=ROSE)
    dot(4, gut, 564)

    # 5 发言区
    band(664, 918)
    label(d, bx0 + 22, 684, '发言区', 23, INK, True)
    yy = 724
    for txt, col, coll in [('我方 · 立论……', INDIGO, INDIGO_L), ('对方 · 反驳……', ROSE, ROSE_L), ('我方 · 反问……', INDIGO, INDIGO_L)]:
        d.rounded_rectangle((bx0 + 22, yy, bx0 + 330, yy + 56), radius=14, fill=coll)
        label(d, bx0 + 42, yy + 14, txt, 20, col)
        yy += 70
    dot(5, gut, 770)

    # 6-9 输入区
    band(936, 1140)
    label(d, bx0 + 22, 952, '轮到你发言', 21, TEAL, True)
    # mic
    d.rounded_rectangle((bx0 + 58, 992, bx0 + 132, 1052), radius=12, fill=CARD, outline=BORDER, width=2)
    label(d, bx0 + 78, 1006, 'MIC', 20, INK2, True)
    # input
    d.rounded_rectangle((bx0 + 146, 992, bx0 + 470, 1052), radius=12, fill=CARD, outline=BORDER, width=2)
    label(d, bx0 + 164, 1008, '输入你的观点…', 20, MUTED)
    # send (triangle)
    d.rounded_rectangle((bx0 + 484, 992, bx0 + 546, 1052), radius=12, fill=TEAL)
    d.polygon([(bx0 + 503, 1010), (bx0 + 503, 1036), (bx0 + 530, 1023)], fill=(255, 255, 255))
    dot(6, gut, 1022); dot(7, 745, 1022)
    # poke / next
    d.rounded_rectangle((bx0 + 22, 1074, bx0 + 300, 1124), radius=12, fill=TEAL_L, outline=TEAL, width=2)
    label(d, bx0 + 44, 1086, '请 AI 继续说', 20, TEAL, True)
    d.rounded_rectangle((bx0 + 340, 1074, bx0 + 546, 1124), radius=12, fill=CARD, outline=BORDER, width=2)
    label(d, bx0 + 372, 1086, '下一阶段  >', 20, INK2)
    dot(8, gut, 1099); dot(9, 745, 1099)

    # legend
    legend = [
        (1, '退出对局 —— 点击后二次确认，离开房间'),
        (2, '阶段 + 倒计时 —— 剩 30 秒内变红提示'),
        (3, '正 / 反方徽章 —— 一眼看清双方阵营'),
        (4, '宠物擂台 —— 发言即攻击，HP 服务器权威'),
        (5, '发言区 —— 我方 / 对方，逐条呈现'),
        (6, '麦克风 —— 语音输入，实时转文字'),
        (7, '输入框 + 发送 —— Enter 发送，Shift+Enter 换行'),
        (8, '请 AI 继续说 —— 不想打字，让 AI 再讲一段'),
        (9, '下一阶段 —— 手动进入下一个辩论阶段'),
    ]
    lx, ly = 880, 300
    label(d, lx, ly - 14, '按键说明', 30, INK, True)
    yy = ly + 58
    for n, txt in legend:
        d.ellipse((lx, yy, lx + 40, yy + 40), fill=AMBER)
        center(d, (lx, yy, lx + 40, yy + 40), str(n), F(22, True), (255, 255, 255))
        d.text((lx + 60, yy + 8), txt, font=F(24), fill=INK2)
        yy += 82
    img.save(os.path.join(OUT, 'illustB_pk.png'))
    print('figB ok')


# ============================================================
# 图 C · 一场辩论的按键时序
# ============================================================
def fig_seq():
    W, H = 1680, 830
    img = Image.new('RGB', (W, H), G.BG)
    d = ImageDraw.Draw(img)
    header(img, d, '一场辩论 · 按什么键', '从进大厅到拿战报，五个节点各按一个键')

    steps = [
        ('人格大厅', '开始辩论', '选好 2 位以上人格，\n点主按钮开局', INDIGO),
        ('场景模式', 'AI 实时命题', '选场景后让 AI 出题，\n或用「内置池随机」', TEAL),
        ('PK 房间', '语音 / 发送', '语音或打字发言，卡壳\n就按「请 AI 继续说」', TEAL),
        ('阶段推进', '下一阶段', '手动推进；AI 活跃时\n到点自动顺延', AMBER),
        ('战报', '生成辩论报告', '七维评分 + 训练计划，\n可下载 .md / 复制', ROSE),
    ]
    cw, ch, gx = 288, 380, 60
    x0, y0 = 90, 300
    for i, (stage, key, desc, col) in enumerate(steps):
        x = x0 + i * (cw + gx)
        d.rounded_rectangle((x, y0, x + cw, y0 + ch), radius=24, fill=CARD, outline=BORDER, width=2)
        d.rounded_rectangle((x, y0, x + cw, y0 + 66), radius=24, fill=col)
        d.rounded_rectangle((x, y0 + 36, x + cw, y0 + 66), radius=0, fill=col)
        center(d, (x, y0, x + cw, y0 + 66), stage, F(28, True), (255, 255, 255))
        d.rounded_rectangle((x + 20, y0 + 92, x + cw - 20, y0 + 156), radius=16, fill=SOFT, outline=LINE, width=2)
        para(d, x + 38, y0 + 110, key, F(24, True), col, cw - 76, lh=34)
        para(d, x + 26, y0 + 188, desc, F(23), INK2, cw - 52, lh=36)
        if i < 4:
            arrow(d, x + cw + 12, y0 + 120, x + cw + gx - 12, y0 + 120, LINE, w=6)

    d.rounded_rectangle((90, y0 + ch + 60, 1590, y0 + ch + 132), radius=16, fill=AMBER_L, outline=(253, 230, 138), width=2)
    label(d, 120, y0 + ch + 82, '随时可用：退出对局      设置里：界面音效 可一键开关      社区里：可删除自己发布的内容',
          24, AMBER, True)
    img.save(os.path.join(OUT, 'illustC_seq.png'))
    print('figC ok')


if __name__ == '__main__':
    fig_nav(); fig_pk(); fig_seq()
    for f in ('illustA_nav.png', 'illustB_pk.png', 'illustC_seq.png'):
        p = os.path.join(OUT, f)
        print(' ', f, os.path.getsize(p), 'bytes')
