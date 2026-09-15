# -*- coding: utf-8 -*-
"""
Бланк ТОРГ-12 в Word с расставленными переменными.

Встроенная ТОРГ-12 живёт в коде, и поправить её заказчик не может. Этот бланк —
её отправная точка для правки: скачал, поправил в Word, загрузил в Настройки →
Шаблоны с типом «Бланк накладной».

Собирается из голого OOXML, без python-docx: зависимостей в проекте для этого
нет, а структура у бланка простая. Переменные — те же, что в справочнике
src/lib/documentVars.ts; строки позиций размножаются циклом {#items}…{/items}.

Запуск из корня проекта:
    python scripts/templates/make-torg12-blank.py
Результат: public/templates/torg12-blank.docx
"""
import os
import struct
import zipfile
import zlib

OUT = os.path.join("public", "templates", "torg12-blank.docx")

# ─── Геометрия ───────────────────────────────────────────────────────────────
# A4 лёжа, поля 8 мм. Все размеры в twips (1/20 пункта).
PAGE_W, PAGE_H = 16838, 11906
MARGIN = 454
CONTENT_W = PAGE_W - 2 * MARGIN  # 15930

FONT = "Arial"
SZ = 14        # 7 пт — основной текст бланка
SZ_SMALL = 10  # 5 пт — подписи под линиями
SZ_TITLE = 22  # 11 пт
GREY = "555555"


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ─── Картинки-заглушки ───────────────────────────────────────────────────────
def png(w, h, rgba):
    raw = b"".join(b"\x00" + bytes(rgba) * w for _ in range(h))

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


# Полупрозрачные серые прямоугольники: в Word видно, где стоят печать и подпись.
STAMP_PNG = png(120, 120, (190, 196, 210, 110))
SIGN_PNG = png(160, 60, (190, 196, 210, 110))

EMU_PER_TWIP = 635


# ─── Текст ───────────────────────────────────────────────────────────────────
def run(text, sz=SZ, bold=False, color=None):
    rpr = "<w:rFonts w:ascii='%s' w:hAnsi='%s' w:cs='%s'/>" % (FONT, FONT, FONT)
    if bold:
        rpr += "<w:b/>"
    if color:
        rpr += "<w:color w:val='%s'/>" % color
    rpr += "<w:sz w:val='%d'/><w:szCs w:val='%d'/>" % (sz, sz)
    # xml:space — только в двойных кавычках. docxtemplater, заполняя текст,
    # сам дописывает xml:space="preserve" и проверяет наличие атрибута с учётом
    # кавычек: при одинарных получался дубль, и заполненный файл не открывался.
    return '<w:r><w:rPr>%s</w:rPr><w:t xml:space="preserve">%s</w:t></w:r>' % (rpr, esc(text))


def para(text="", sz=SZ, bold=False, align=None, color=None, extra_runs=""):
    ppr = "<w:spacing w:before='0' w:after='0' w:line='228' w:lineRule='auto'/>"
    if align:
        ppr += "<w:jc w:val='%s'/>" % align
    body = run(text, sz, bold, color) if text else ""
    return "<w:p><w:pPr>%s</w:pPr>%s%s</w:p>" % (ppr, body, extra_runs)


# ─── Таблицы ─────────────────────────────────────────────────────────────────
NO_BORDERS = ("<w:tblBorders>"
              "<w:top w:val='nil'/><w:left w:val='nil'/><w:bottom w:val='nil'/>"
              "<w:right w:val='nil'/><w:insideH w:val='nil'/><w:insideV w:val='nil'/>"
              "</w:tblBorders>")


def borders(top=False, bottom=False, left=False, right=False):
    def side(name, on):
        return "<w:%s w:val='%s' w:sz='4' w:space='0' w:color='000000'/>" % (
            name, "single" if on else "nil")
    return "<w:tcBorders>%s%s%s%s</w:tcBorders>" % (
        side("top", top), side("left", left), side("bottom", bottom), side("right", right))


BOX = dict(top=True, bottom=True, left=True, right=True)
LINE = dict(bottom=True)


def tc(content, w, span=1, vmerge=None, frame=None, valign="center"):
    """Ячейка. content — готовые абзацы; frame — какие стороны обвести."""
    pr = "<w:tcW w:w='%d' w:type='dxa'/>" % w
    if span > 1:
        pr += "<w:gridSpan w:val='%d'/>" % span
    if vmerge == "restart":
        pr += "<w:vMerge w:val='restart'/>"
    elif vmerge == "continue":
        pr += "<w:vMerge/>"
    pr += borders(**(frame or {}))
    pr += "<w:vAlign w:val='%s'/>" % valign
    return "<w:tc><w:tcPr>%s</w:tcPr>%s</w:tc>" % (pr, content or para())


def tr(cells, height=None):
    trpr = ""
    if height:
        trpr = "<w:trPr><w:trHeight w:val='%d'/></w:trPr>" % height
    return "<w:tr>%s%s</w:tr>" % (trpr, "".join(cells))


def table(widths, rows):
    grid = "".join("<w:gridCol w:w='%d'/>" % w for w in widths)
    pr = ("<w:tblW w:w='%d' w:type='dxa'/>" % sum(widths)
          + NO_BORDERS
          + "<w:tblLayout w:type='fixed'/>"
          + "<w:tblCellMar><w:top w:w='10' w:type='dxa'/><w:left w:w='40' w:type='dxa'/>"
            "<w:bottom w:w='10' w:type='dxa'/><w:right w:w='40' w:type='dxa'/></w:tblCellMar>")
    return "<w:tbl><w:tblPr>%s</w:tblPr><w:tblGrid>%s</w:tblGrid>%s</w:tbl>" % (
        pr, grid, "".join(rows))


# ─── Плавающие картинки ──────────────────────────────────────────────────────
_pic_id = [100]


def floating_image(rid, slot, w_twips, h_twips, x_twips, y_twips):
    """
    Картинка поверх текста: не раздвигает строки, когда печать не нужна и
    заглушку гасят прозрачным пикселем. Пометка slot в name и descr — по ней
    сервер находит, что подменить.
    """
    _pic_id[0] += 1
    pid = _pic_id[0]
    cx, cy = w_twips * EMU_PER_TWIP, h_twips * EMU_PER_TWIP
    return (
        "<w:r><w:drawing>"
        "<wp:anchor distT='0' distB='0' distL='0' distR='0' simplePos='0' "
        "relativeHeight='%d' behindDoc='0' locked='0' layoutInCell='1' allowOverlap='1'>"
        "<wp:simplePos x='0' y='0'/>"
        "<wp:positionH relativeFrom='column'><wp:posOffset>%d</wp:posOffset></wp:positionH>"
        "<wp:positionV relativeFrom='paragraph'><wp:posOffset>%d</wp:posOffset></wp:positionV>"
        "<wp:extent cx='%d' cy='%d'/><wp:effectExtent l='0' t='0' r='0' b='0'/><wp:wrapNone/>"
        "<wp:docPr id='%d' name='%s' descr='%s'/><wp:cNvGraphicFramePr/>"
        "<a:graphic><a:graphicData uri='http://schemas.openxmlformats.org/drawingml/2006/picture'>"
        "<pic:pic><pic:nvPicPr><pic:cNvPr id='%d' name='%s' descr='%s'/><pic:cNvPicPr/></pic:nvPicPr>"
        "<pic:blipFill><a:blip r:embed='%s'/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>"
        "<pic:spPr><a:xfrm><a:off x='0' y='0'/><a:ext cx='%d' cy='%d'/></a:xfrm>"
        "<a:prstGeom prst='rect'><a:avLst/></a:prstGeom></pic:spPr>"
        "</pic:pic></a:graphicData></a:graphic>"
        "</wp:anchor></w:drawing></w:r>"
        % (251650000 + pid, x_twips * EMU_PER_TWIP, y_twips * EMU_PER_TWIP, cx, cy,
           pid, slot, slot, pid, slot, slot, rid, cx, cy)
    )


# ─── 1. Шапка: отсылка к форме и стороны ─────────────────────────────────────
# label | реквизиты на линии | подпись кода | рамка кода
HEAD_W = [1500, 11030, 2100, 1300]


def party_rows(label, value, code_label, code_value="", caption="организация, адрес, телефон, факс, банковские реквизиты"):
    return [
        tr([
            tc(para(label), HEAD_W[0], valign="bottom"),
            tc(para(value), HEAD_W[1], frame=LINE, valign="bottom"),
            tc(para(code_label, align="right"), HEAD_W[2], valign="bottom"),
            tc(para(code_value, align="center"), HEAD_W[3], frame=BOX, valign="bottom"),
        ]),
        tr([
            tc(para(), HEAD_W[0]),
            tc(para(caption, sz=SZ_SMALL, color=GREY, align="center"), HEAD_W[1], valign="top"),
            tc(para(), HEAD_W[2]),
            tc(para(), HEAD_W[3]),
        ]),
    ]


head_rows = [
    tr([
        tc(para(), HEAD_W[0]),
        tc(para("Унифицированная форма № ТОРГ-12", sz=12, align="right")
           + para("Утверждена постановлением Госкомстата России от 25.12.98 № 132", sz=12, align="right"),
           HEAD_W[1] + HEAD_W[2] + HEAD_W[3], span=3),
    ]),
    tr([
        tc(para(), HEAD_W[0]),
        tc(para(), HEAD_W[1]),
        tc(para(), HEAD_W[2]),
        tc(para("Коды", align="center"), HEAD_W[3], frame=BOX),
    ]),
    tr([
        tc(para(), HEAD_W[0]),
        tc(para(), HEAD_W[1]),
        tc(para("Форма по ОКУД", align="right"), HEAD_W[2]),
        tc(para("0330212", bold=True, align="center"), HEAD_W[3], frame=BOX),
    ]),
]
head_rows += party_rows("Грузоотправитель", "{shipper_line}", "по ОКПО", "{company_okpo}")
head_rows += [
    tr([
        tc(para(), HEAD_W[0]),
        tc(para(), HEAD_W[1]),
        tc(para("Вид деятельности по ОКДП", align="right"), HEAD_W[2]),
        tc(para(), HEAD_W[3], frame=BOX),
    ]),
]
head_rows += party_rows("Грузополучатель", "{consignee_line}", "по ОКПО", "{consignee_okpo}")
head_rows += party_rows("Поставщик", "{shipper_line}", "по ОКПО", "{company_okpo}")
head_rows += party_rows("Плательщик", "{payer_line}", "по ОКПО", "{payer_okpo}")
head_rows += [
    tr([
        tc(para("Основание"), HEAD_W[0], valign="bottom"),
        tc(para("{waybill_basis}"), HEAD_W[1], frame=LINE, valign="bottom"),
        tc(para("номер", align="right"), HEAD_W[2], valign="bottom"),
        tc(para(), HEAD_W[3], frame=BOX),
    ]),
    tr([
        tc(para(), HEAD_W[0]),
        tc(para("договор, заказ-наряд", sz=SZ_SMALL, color=GREY, align="center"), HEAD_W[1], valign="top"),
        tc(para("дата", align="right"), HEAD_W[2]),
        tc(para(), HEAD_W[3], frame=BOX),
    ]),
]
HEAD = table(HEAD_W, head_rows)

# ─── 2. Заголовок с номером и датой ──────────────────────────────────────────
TITLE_W = [2800, 3100, 1500, 1800, 3030, 2400, 1300]
TITLE = table(TITLE_W, [
    tr([
        tc(para(), TITLE_W[0]),
        tc(para("ТОВАРНАЯ НАКЛАДНАЯ", sz=SZ_TITLE, bold=True, align="right"), TITLE_W[1], vmerge="restart"),
        tc(para("Номер документа", align="center"), TITLE_W[2], frame=BOX),
        tc(para("Дата составления", align="center"), TITLE_W[3], frame=BOX),
        tc(para(), TITLE_W[4]),
        tc(para("Транспортная накладная    номер", align="right"), TITLE_W[5]),
        tc(para(), TITLE_W[6], frame=BOX),
    ]),
    tr([
        tc(para(), TITLE_W[0]),
        tc(para(), TITLE_W[1], vmerge="continue"),
        tc(para("{waybill_number}", align="center"), TITLE_W[2], frame=BOX),
        tc(para("{waybill_date}", align="center"), TITLE_W[3], frame=BOX),
        tc(para(), TITLE_W[4]),
        tc(para("дата", align="right"), TITLE_W[5]),
        tc(para(), TITLE_W[6], frame=BOX),
    ]),
    tr([
        tc(para(), TITLE_W[0]),
        tc(para(), TITLE_W[1]),
        tc(para(), TITLE_W[2]),
        tc(para(), TITLE_W[3]),
        tc(para(), TITLE_W[4]),
        tc(para("Вид операции", align="right"), TITLE_W[5]),
        tc(para(), TITLE_W[6], frame=BOX),
    ]),
])

# ─── 3. Товарный раздел — 15 граф ────────────────────────────────────────────
ITEM_W = [600, 3600, 500, 900, 700, 700, 800, 700, 800, 1000, 1100, 1400, 900, 1000, 1230]
assert sum(ITEM_W) == CONTENT_W


def h(text, i, span=1, vmerge=None):
    w = sum(ITEM_W[i:i + span])
    return tc(para(text, sz=12, bold=True, align="center"), w, span=span, vmerge=vmerge, frame=BOX)


item_rows = [
    tr([
        h("Номер по порядку", 0, vmerge="restart"),
        h("Товар", 1, span=2),
        h("Единица измерения", 3, span=2),
        h("Вид упаковки", 5, vmerge="restart"),
        h("Количество", 6, span=2),
        h("Масса брутто", 8, vmerge="restart"),
        h("Количество (масса нетто)", 9, vmerge="restart"),
        h("Цена, руб. коп.", 10, vmerge="restart"),
        h("Сумма без учета НДС, руб. коп.", 11, vmerge="restart"),
        h("НДС", 12, span=2),
        h("Сумма с учетом НДС, руб. коп.", 14, vmerge="restart"),
    ]),
    tr([
        h("", 0, vmerge="continue"),
        h("наименование, характеристика, сорт, артикул товара", 1),
        h("код", 2),
        h("наимено-вание", 3),
        h("код по ОКЕИ", 4),
        h("", 5, vmerge="continue"),
        h("в одном месте", 6),
        h("мест, штук", 7),
        h("", 8, vmerge="continue"),
        h("", 9, vmerge="continue"),
        h("", 10, vmerge="continue"),
        h("", 11, vmerge="continue"),
        h("ставка, %", 12),
        h("сумма, руб. коп.", 13),
        h("", 14, vmerge="continue"),
    ]),
    tr([tc(para(str(i + 1), sz=12, align="center"), w, frame=BOX) for i, w in enumerate(ITEM_W)]),
]


def c(text, i, align="center", bold=False, frame=BOX):
    return tc(para(text, align=align, bold=bold), ITEM_W[i], frame=frame)


# Строка позиции размножается циклом: {#items} в первой ячейке, {/items} в последней.
item_rows.append(tr([
    c("{#items}{n}", 0),
    c("{name}", 1, align="left"),
    c("", 2),
    c("{unit}", 3),
    c("{okei}", 4),
    c("", 5),
    c("", 6),
    c("", 7),
    c("", 8),
    c("{qty}", 9, align="right"),
    c("{price}", 10, align="right"),
    c("{sum_no_vat}", 11, align="right"),
    c("{rate}", 12),
    c("{vat}", 13, align="right"),
    c("{total}{/items}", 14, align="right"),
]))

for label in ("Итого", "Всего по накладной"):
    item_rows.append(tr([
        tc(para(label, align="right"), sum(ITEM_W[0:9]), span=9),
        c("Х", 9),
        c("Х", 10),
        c("{waybill_total_no_vat}", 11, align="right", bold=True),
        c("Х", 12),
        c("{waybill_vat}", 13, align="right", bold=True),
        c("{waybill_total}", 14, align="right", bold=True),
    ]))

ITEMS = table(ITEM_W, item_rows)

# ─── 4. Приложения, масса, доверенность ──────────────────────────────────────
INFO_W = [2500, 2600, 2300, 500, 2300, 5730]
assert sum(INFO_W) == CONTENT_W


def cap(text):
    return para(text, sz=SZ_SMALL, color=GREY, align="center")


INFO = table(INFO_W, [
    tr([
        tc(para("Товарная накладная имеет приложения и содержит", align="right"), INFO_W[0], valign="bottom"),
        tc(para(), INFO_W[1], frame=LINE),
        tc(para("порядковых номеров записей"), INFO_W[2], valign="bottom"),
        tc(para(), INFO_W[3]),
        tc(para("Масса груза (нетто)"), INFO_W[4], valign="bottom"),
        tc(para(), INFO_W[5], frame=LINE),
    ]),
    tr([tc(para(), INFO_W[0]), tc(cap("прописью"), INFO_W[1]), tc(para(), INFO_W[2]),
        tc(para(), INFO_W[3]), tc(para(), INFO_W[4]), tc(cap("прописью"), INFO_W[5])]),
    tr([
        tc(para("Всего мест", align="right"), INFO_W[0], valign="bottom"),
        tc(para(), INFO_W[1], frame=LINE),
        tc(para(), INFO_W[2]),
        tc(para(), INFO_W[3]),
        tc(para("Масса груза (брутто)"), INFO_W[4], valign="bottom"),
        tc(para(), INFO_W[5], frame=LINE),
    ]),
    tr([tc(para(), INFO_W[0]), tc(cap("прописью"), INFO_W[1]), tc(para(), INFO_W[2]),
        tc(para(), INFO_W[3]), tc(para(), INFO_W[4]), tc(cap("прописью"), INFO_W[5])]),
    tr([
        tc(para("Приложение (паспорта, сертификаты и т.п.) на", align="right"), INFO_W[0], valign="bottom"),
        tc(para(), INFO_W[1], frame=LINE),
        tc(para("листах"), INFO_W[2], valign="bottom"),
        tc(para(), INFO_W[3]),
        tc(para("По доверенности №                от"), INFO_W[4], valign="bottom"),
        tc(para(), INFO_W[5], frame=LINE),
    ]),
    tr([tc(para(), INFO_W[0]), tc(cap("прописью"), INFO_W[1]), tc(para(), INFO_W[2]),
        tc(para(), INFO_W[3]), tc(para(), INFO_W[4]), tc(para(), INFO_W[5])]),
    tr([
        tc(para("Всего отпущено на сумму", bold=True), sum(INFO_W[0:3]), span=3),
        tc(para(), INFO_W[3]),
        tc(para("выданной"), INFO_W[4], valign="bottom"),
        tc(para(), INFO_W[5], frame=LINE),
    ]),
    tr([
        tc(para("{waybill_total_in_words}", bold=True), sum(INFO_W[0:3]), span=3),
        tc(para(), INFO_W[3]),
        tc(para(), INFO_W[4]),
        tc(cap("кем, кому (организация, должность, фамилия, и.о.)"), INFO_W[5]),
    ]),
    tr([
        tc(para("прописью", sz=SZ_SMALL, color=GREY), sum(INFO_W[0:3]), span=3),
        tc(para(), INFO_W[3]), tc(para(), INFO_W[4]), tc(para(), INFO_W[5]),
    ]),
])

# ─── 5. Подписи ──────────────────────────────────────────────────────────────
# Левая половина: роль | должность | подпись | расшифровка; справа то же.
SIGN_HALF = [1700, 1700, 2200, 2200]
SIGN_W = SIGN_HALF + [330] + SIGN_HALF
assert sum(SIGN_W) == CONTENT_W


def sign_cells(role, title="", name="", image=""):
    return [
        tc(para(role), SIGN_HALF[0], valign="bottom"),
        tc(para(title, align="center"), SIGN_HALF[1], frame=LINE, valign="bottom"),
        tc(para(extra_runs=image), SIGN_HALF[2], frame=LINE, valign="bottom"),
        tc(para(name, align="center"), SIGN_HALF[3], frame=LINE, valign="bottom"),
    ]


def caption_cells():
    return [
        tc(para(), SIGN_HALF[0]),
        tc(cap("должность"), SIGN_HALF[1]),
        tc(cap("подпись"), SIGN_HALF[2]),
        tc(cap("расшифровка подписи"), SIGN_HALF[3]),
    ]


GAP = [tc(para(), 330)]
blank = [tc(para(), w) for w in SIGN_HALF]

# Подпись руководителя — поверх линии «Отпуск разрешил», печать — у «М.П.».
signature = floating_image("rIdSign", "signature", 1500, 560, 150, -420)
stamp = floating_image("rIdStamp", "stamp", 1900, 1900, 2300, -700)

SIGNS = table(SIGN_W, [
    tr(sign_cells("Отпуск разрешил", "{director_title}", "{director}", signature) + GAP
       + sign_cells("Груз принял"), height=420),
    tr(caption_cells() + GAP + caption_cells()),
    tr(sign_cells("Главный (старший) бухгалтер", "", "{accountant}") + GAP
       + sign_cells("Груз получил грузополучатель"), height=420),
    tr(caption_cells() + GAP + caption_cells()),
    tr(sign_cells("Отпуск груза произвел", "{director_title}", "{director}") + GAP + blank, height=420),
    tr(caption_cells() + GAP + blank),
    tr([
        tc(para("М.П.", extra_runs=stamp), SIGN_HALF[0], valign="top"),
        tc(para("{waybill_date_long}"), sum(SIGN_HALF[1:]), span=3, valign="top"),
    ] + GAP + [
        tc(para("М.П."), SIGN_HALF[0], valign="top"),
        tc(para("«____» _______________ 20___ г."), sum(SIGN_HALF[1:]), span=3, valign="top"),
    ], height=500),
])

# ─── Сборка документа ────────────────────────────────────────────────────────
SPACER = para("", sz=8)

BODY = "".join([
    HEAD, SPACER,
    TITLE, SPACER,
    ITEMS, SPACER,
    INFO, SPACER,
    SIGNS,
    "<w:sectPr>"
    "<w:pgSz w:w='%d' w:h='%d' w:orient='landscape'/>"
    "<w:pgMar w:top='%d' w:right='%d' w:bottom='%d' w:left='%d' w:header='0' w:footer='0' w:gutter='0'/>"
    "</w:sectPr>" % (PAGE_W, PAGE_H, MARGIN, MARGIN, MARGIN, MARGIN),
])

NS = (
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'
)

DOCUMENT = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document %s><w:body>%s</w:body></w:document>' % (NS, BODY))

STYLES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="14"/><w:szCs w:val="14"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="228" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>'''

CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

ROOT_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

DOC_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdStamp" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/stamp.png"/>
<Relationship Id="rIdSign" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/>
</Relationships>'''

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", CONTENT_TYPES)
    z.writestr("_rels/.rels", ROOT_RELS)
    z.writestr("word/document.xml", DOCUMENT)
    z.writestr("word/styles.xml", STYLES)
    z.writestr("word/_rels/document.xml.rels", DOC_RELS)
    z.writestr("word/media/stamp.png", STAMP_PNG)
    z.writestr("word/media/signature.png", SIGN_PNG)

print("готово:", OUT, os.path.getsize(OUT), "байт")
