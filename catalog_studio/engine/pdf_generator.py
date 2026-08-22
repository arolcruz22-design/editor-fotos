"""Premium catalog PDF layout engine, built directly on ReportLab's
canvas (not Platypus) so we have full editorial control over
typography and image placement.

Two quality profiles share the exact same layout code:
- "digital": smaller embedded images, tuned for WhatsApp/email/screen.
- "print": full-resolution embedded images for physical printing.
"""
import os

from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from .text_utils import format_price

PAGE_W, PAGE_H = A4
MARGIN = 15 * 2.834645  # ~15mm in points

BLACK = (0.02, 0.02, 0.02)
GRAPHITE = (0.11, 0.11, 0.12)
GRAPHITE_LIGHT = (0.17, 0.17, 0.19)
WHITE = (1, 1, 1)
OFFWHITE = (0.95, 0.95, 0.94)
MUTED = (0.55, 0.55, 0.56)


def _hex_to_rgb01(hex_color):
    hex_color = (hex_color or "#F26A1B").lstrip("#")
    if len(hex_color) != 6:
        hex_color = "F26A1B"
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return (r, g, b)


class CatalogPDF:
    def __init__(self, output_path, config):
        self.path = output_path
        self.config = config
        self.accent = _hex_to_rgb01(config.get("accent_color", "#F26A1B"))
        self.currency = config.get("currency", "L")
        self.c = canvas.Canvas(output_path, pagesize=A4)
        self.page_num = 0
        self._register_fonts()

    def _register_fonts(self):
        # Use ReportLab's built-in Helvetica family; it's always available
        # with no external font files required, which keeps this fully
        # self-contained/offline.
        self.font_display = "Helvetica-Bold"
        self.font_body = "Helvetica"
        self.font_body_bold = "Helvetica-Bold"
        self.font_light = "Helvetica"

    # ---------- low level helpers ----------

    def _fill_bg(self, rgb):
        self.c.setFillColorRGB(*rgb)
        self.c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    def _text(self, x, y, text, font, size, rgb, tracking=0, align="left"):
        self.c.setFillColorRGB(*rgb)
        self.c.setFont(font, size)
        if tracking:
            self._tracked_text(x, y, text, font, size, align)
        else:
            if align == "left":
                self.c.drawString(x, y, text)
            elif align == "right":
                self.c.drawRightString(x, y, text)
            else:
                self.c.drawCentredString(x, y, text)

    def _tracked_text(self, x, y, text, font, size, align="left"):
        widths = [pdfmetrics.stringWidth(ch, font, size) + tracking_px(size) for ch in text]
        total = sum(widths)
        if align == "center":
            x -= total / 2
        elif align == "right":
            x -= total
        cx = x
        for ch, w in zip(text, widths):
            self.c.drawString(cx, y, ch)
            cx += w

    def _footer(self, category_label=""):
        self.page_num += 1
        self.c.setFillColorRGB(*MUTED)
        self.c.setFont(self.font_body, 7.5)
        self.c.drawString(MARGIN, 14 * 2.834645, "TODOMOTOS")
        if category_label:
            self.c.drawCentredString(PAGE_W / 2, 14 * 2.834645, category_label.upper())
        self.c.drawRightString(PAGE_W - MARGIN, 14 * 2.834645, f"{self.page_num:02d}")

    def new_page(self):
        self.c.showPage()

    # ---------- image helpers ----------

    def _draw_image_cover(self, path, x, y, w, h):
        """Draw image covering the given box (crop to fill, keep aspect)."""
        if not path or not os.path.exists(path):
            self.c.setFillColorRGB(*GRAPHITE_LIGHT)
            self.c.rect(x, y, w, h, fill=1, stroke=0)
            return
        img = ImageReader(path)
        iw, ih = img.getSize()
        box_ratio = w / h
        img_ratio = iw / ih
        if img_ratio > box_ratio:
            draw_h = h
            draw_w = h * img_ratio
        else:
            draw_w = w
            draw_h = w / img_ratio
        self.c.saveState()
        p = self.c.beginPath()
        p.rect(x, y, w, h)
        self.c.clipPath(p, stroke=0, fill=0)
        ox = x + (w - draw_w) / 2
        oy = y + (h - draw_h) / 2
        self.c.drawImage(img, ox, oy, draw_w, draw_h, mask="auto")
        self.c.restoreState()

    def _draw_image_contain(self, path, x, y, w, h, align="center"):
        """Draw image fit inside the given box (no cropping)."""
        if not path or not os.path.exists(path):
            self.c.setFillColorRGB(*GRAPHITE_LIGHT)
            self.c.rect(x, y, w, h, fill=1, stroke=0)
            return
        img = ImageReader(path)
        iw, ih = img.getSize()
        box_ratio = w / h
        img_ratio = iw / ih
        if img_ratio > box_ratio:
            draw_w = w
            draw_h = w / img_ratio
        else:
            draw_h = h
            draw_w = h * img_ratio
        ox = x + (w - draw_w) / 2
        oy = y + (h - draw_h) / 2
        self.c.drawImage(img, ox, oy, draw_w, draw_h, mask="auto")

    # ---------- cover ----------

    def draw_cover(self, title_line1, title_line2, tagline, hero_image_path, year):
        self._fill_bg(BLACK)
        if hero_image_path:
            self._draw_image_cover(hero_image_path, 0, PAGE_H * 0.28, PAGE_W, PAGE_H * 0.62)
            self.c.saveState()
            self.c.setFillColorRGB(*BLACK)
            self.c.setFillAlpha(0.55)
            self.c.rect(0, PAGE_H * 0.28, PAGE_W, PAGE_H * 0.10, fill=1, stroke=0)
            self.c.restoreState()

        self.c.setFillColorRGB(*self.accent)
        self.c.rect(MARGIN, PAGE_H * 0.24, 60, 3, fill=1, stroke=0)

        self.c.setFillColorRGB(*WHITE)
        self.c.setFont(self.font_display, 52)
        self.c.drawString(MARGIN, PAGE_H * 0.155, title_line1)

        self.c.setFillColorRGB(*self.accent)
        self.c.setFont(self.font_display, 26)
        self.c.drawString(MARGIN, PAGE_H * 0.105, title_line2)

        self.c.setFillColorRGB(*MUTED)
        self.c.setFont(self.font_body, 10.5)
        self.c.drawString(MARGIN, PAGE_H * 0.075, tagline.upper())

        self.c.setFillColorRGB(*MUTED)
        self.c.setFont(self.font_body, 9)
        self.c.drawRightString(PAGE_W - MARGIN, PAGE_H * 0.075, str(year))
        self.new_page()

    def draw_category_divider(self, category_name, image_path):
        self._fill_bg(GRAPHITE)
        if image_path:
            self._draw_image_cover(image_path, 0, 0, PAGE_W, PAGE_H)
            self.c.saveState()
            self.c.setFillColorRGB(*BLACK)
            self.c.setFillAlpha(0.45)
            self.c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
            self.c.restoreState()
        self.c.setFillColorRGB(*self.accent)
        self.c.rect(MARGIN, PAGE_H * 0.46, 60, 3, fill=1, stroke=0)
        self.c.setFillColorRGB(*WHITE)
        self.c.setFont(self.font_display, 38)
        self.c.drawString(MARGIN, PAGE_H * 0.40, category_name.upper())
        self.c.setFillColorRGB(*MUTED)
        self.c.setFont(self.font_body, 10)
        self.c.drawString(MARGIN, PAGE_H * 0.36, "COLLECTION")
        self._footer()
        self.new_page()

    # ---------- product info block ----------

    def _draw_product_text(self, product, x, y_top, width, align="left"):
        c = self.c
        marca = (product.get("marca") or "").upper()
        modelo = (product.get("modelo") or "").upper()
        y = y_top

        if marca:
            c.setFillColorRGB(*self.accent)
            c.setFont(self.font_body_bold, 10)
            if align == "left":
                c.drawString(x, y, marca)
            else:
                c.drawCentredString(x + width / 2, y, marca)
            y -= 20

        c.setFillColorRGB(*WHITE)
        c.setFont(self.font_display, 27)
        modelo_display = modelo if modelo else "—"
        max_chars = max(int(width / 13), 6)
        lines = _wrap_text(modelo_display, max_chars)
        for line in lines[:2]:
            if align == "left":
                c.drawString(x, y, line)
            else:
                c.drawCentredString(x + width / 2, y, line)
            y -= 28
        y -= 6

        descripcion = product.get("descripcion")
        if descripcion:
            c.setFillColorRGB(*MUTED)
            c.setFont(self.font_body, 9.5)
            for line in _wrap_text(descripcion, max(int(width / 5.2), 20))[:3]:
                if align == "left":
                    c.drawString(x, y, line)
                else:
                    c.drawCentredString(x + width / 2, y, line)
                y -= 13
            y -= 8

        extras = []
        if product.get("color"):
            extras.append(("COLOR", product["color"]))
        if product.get("talla"):
            extras.append(("TALLA", product["talla"]))
        if product.get("categoria"):
            extras.append(("CATEGORIA", product["categoria"]))
        if extras:
            c.setFont(self.font_body, 8)
            line = "   ".join(f"{k}: {v}" for k, v in extras)
            c.setFillColorRGB(*MUTED)
            if align == "left":
                c.drawString(x, y, line.upper())
            else:
                c.drawCentredString(x + width / 2, y, line.upper())
            y -= 16

        codigo = product.get("codigo") or product.get("sku")
        precio = product.get("precio_visual") if product.get("precio_visual") is not None else product.get("precio_mayorista")

        y -= 6
        if codigo:
            c.setFillColorRGB(*MUTED)
            c.setFont(self.font_body, 8)
            if align == "left":
                c.drawString(x, y, "SKU")
            else:
                c.drawCentredString(x + width / 2, y, "SKU")
            y -= 12
            c.setFillColorRGB(*OFFWHITE)
            c.setFont(self.font_body_bold, 11)
            if align == "left":
                c.drawString(x, y, str(codigo))
            else:
                c.drawCentredString(x + width / 2, y, str(codigo))
            y -= 20

        if precio is not None:
            c.setFillColorRGB(*self.accent)
            c.setFont(self.font_display, 22)
            price_text = format_price(precio, self.currency)
            if align == "left":
                c.drawString(x, y, price_text)
            else:
                c.drawCentredString(x + width / 2, y, price_text)
            y -= 24
            if product.get("precio_visual_advertencia"):
                c.setFillColorRGB(1, 0.4, 0.35)
                c.setFont(self.font_body, 7)
                warn = "* precio visual editado manualmente"
                if align == "left":
                    c.drawString(x, y, warn)
                else:
                    c.drawCentredString(x + width / 2, y, warn)
                y -= 12
        return y

    # ---------- product layouts ----------

    def draw_product_layout_a(self, product, category_label=""):
        self._fill_bg(BLACK)
        img_w = PAGE_W * 0.52
        self._draw_image_cover(product.get("foto_principal_procesada") or product.get("foto_principal"), 0, 0, img_w, PAGE_H)
        text_x = img_w + 34
        text_w = PAGE_W - text_x - MARGIN
        self._draw_product_text(product, text_x, PAGE_H * 0.72, text_w, align="left")
        self._footer(category_label)
        self.new_page()

    def draw_product_layout_b(self, product, category_label=""):
        self._fill_bg(GRAPHITE)
        img_h = PAGE_H * 0.66
        self._draw_image_cover(product.get("foto_principal_procesada") or product.get("foto_principal"), 0, PAGE_H - img_h, PAGE_W, img_h)
        self._draw_product_text(product, MARGIN, PAGE_H - img_h - 26, PAGE_W - 2 * MARGIN, align="left")
        self._footer(category_label)
        self.new_page()

    def draw_product_layout_c(self, product, category_label=""):
        self._fill_bg(BLACK)
        main_w = PAGE_W * 0.60
        main_h = PAGE_H * 0.62
        top_y = PAGE_H - MARGIN - main_h
        self._draw_image_cover(product.get("foto_principal_procesada") or product.get("foto_principal"), MARGIN, top_y, main_w, main_h)

        secundarias = product.get("fotos_secundarias_procesadas") or []
        side_x = MARGIN + main_w + 14
        side_w = PAGE_W - side_x - MARGIN
        side_h = (main_h - 14) / 2
        if len(secundarias) > 0:
            self._draw_image_cover(secundarias[0], side_x, top_y + side_h + 14, side_w, side_h)
        if len(secundarias) > 1:
            self._draw_image_cover(secundarias[1], side_x, top_y, side_w, side_h)

        self._draw_product_text(product, MARGIN, top_y - 24, PAGE_W - 2 * MARGIN, align="left")
        self._footer(category_label)
        self.new_page()

    def draw_product_layout_d(self, product, category_label=""):
        self._fill_bg(BLACK)
        self._draw_image_cover(product.get("foto_principal_procesada") or product.get("foto_principal"), 0, 0, PAGE_W, PAGE_H)
        self.c.saveState()
        grad_h = PAGE_H * 0.42
        steps = 40
        for i in range(steps):
            t = i / steps
            self.c.setFillColorRGB(*BLACK)
            self.c.setFillAlpha(0.75 * t)
            self.c.rect(0, (grad_h / steps) * i, PAGE_W, grad_h / steps + 1, fill=1, stroke=0)
        self.c.restoreState()
        self._draw_product_text(product, MARGIN, grad_h - 20, PAGE_W - 2 * MARGIN, align="left")
        self._footer(category_label)
        self.new_page()

    LAYOUTS = ["A", "B", "C", "D"]

    def draw_product(self, product, index, category_label=""):
        layout = product.get("layout") or "auto"
        if layout == "auto" or layout not in self.LAYOUTS:
            layout = self.LAYOUTS[index % len(self.LAYOUTS)]
        getattr(self, f"draw_product_layout_{layout.lower()}")(product, category_label)

    def save(self):
        self.c.save()


def _wrap_text(text, max_chars):
    words = str(text).split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > max_chars and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines or [""]


def tracking_px(size):
    return size * 0.02


def select_hero_image(products):
    """Pick a photo for the cover: prefer the first visible product that
    has a processed main photo with the largest pixel area."""
    best = None
    best_area = -1
    for p in products:
        if p.get("oculto"):
            continue
        path = p.get("foto_principal_procesada") or p.get("foto_principal")
        if not path or not os.path.exists(path):
            continue
        try:
            with Image.open(path) as im:
                area = im.width * im.height
        except Exception:
            continue
        if area > best_area:
            best_area = area
            best = path
    return best


def generate_catalog_pdf(output_path, products, config, quality="digital"):
    """products: list of product dicts, already ordered, with
    foto_principal_procesada / fotos_secundarias_procesadas pointing at
    the *_digital or *_print variants matching `quality`."""
    visibles = [p for p in products if not p.get("oculto")]

    pdf = CatalogPDF(output_path, config)

    hero = select_hero_image(visibles)
    pdf.draw_cover(
        "TODOMOTOS",
        f"HELMET COLLECTION {config.get('year', 2026)}",
        "PERFORMANCE · PROTECTION · STYLE",
        hero,
        config.get("year", 2026),
    )

    categories = []
    seen = set()
    for p in visibles:
        cat = p.get("categoria")
        if cat and cat not in seen:
            seen.add(cat)
            categories.append(cat)

    by_category = {}
    for p in visibles:
        by_category.setdefault(p.get("categoria") or "COLECCION", []).append(p)
    if "COLECCION" in by_category and "COLECCION" not in categories:
        categories.append("COLECCION")

    idx = 0
    if categories:
        for cat in categories:
            items = sorted(by_category.get(cat, []), key=lambda p: p.get("orden", 0))
            divider_img = select_hero_image(items) or hero
            pdf.draw_category_divider(cat, divider_img)
            for product in items:
                pdf.draw_product(product, idx, category_label=cat)
                idx += 1
    else:
        items = sorted(visibles, key=lambda p: p.get("orden", 0))
        for product in items:
            pdf.draw_product(product, idx, category_label="")
            idx += 1

    pdf.save()
    return output_path
