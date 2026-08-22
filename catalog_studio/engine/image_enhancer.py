"""Local photo enhancement pipeline.

Everything here runs on-device with Pillow/NumPy and (when available)
OpenCV. No network calls, no paid services. The goal is to make the
product photo look professional (clean background, better light,
sharper) WITHOUT altering the helmet itself: no shape/color/logo
changes, only lighting, noise, framing and background.
"""
import os

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

try:
    import cv2
    HAS_CV2 = True
except ImportError:  # pragma: no cover - optional dependency
    HAS_CV2 = False

BACKGROUND_MODES = {
    "PREMIUM_DARK": {"type": "gradient", "colors": [(18, 18, 20), (4, 4, 5)]},
    "STUDIO_WHITE": {"type": "flat", "color": (255, 255, 255)},
    "GRAPHITE": {"type": "gradient", "colors": [(58, 58, 62), (28, 28, 31)]},
    "TRANSPARENT": {"type": "transparent"},
}

DIGITAL_MAX_SIDE = 1400
PRINT_MAX_SIDE = 2800


def _gray_world_white_balance(np_img):
    result = np_img.astype(np.float32)
    for c in range(3):
        channel = result[:, :, c]
        mean = channel.mean()
        if mean > 1e-3:
            result[:, :, c] = channel * (128.0 / mean)
    return np.clip(result, 0, 255).astype(np.uint8)


def _denoise(np_img):
    if not HAS_CV2:
        return np_img
    try:
        bgr = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)
        denoised = cv2.fastNlMeansDenoisingColored(bgr, None, 5, 5, 7, 21)
        return cv2.cvtColor(denoised, cv2.COLOR_BGR2RGB)
    except cv2.error:
        return np_img


def _foreground_mask(np_img):
    """Best-effort subject isolation using GrabCut, seeded with a
    centered rectangle. Returns a soft (0-255) mask, or None if
    OpenCV isn't available / segmentation fails."""
    if not HAS_CV2:
        return None
    h, w = np_img.shape[:2]
    if h < 20 or w < 20:
        return None
    try:
        bgr = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)
        mask = np.zeros((h, w), np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        margin_x, margin_y = int(w * 0.06), int(h * 0.06)
        rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)
        cv2.grabCut(bgr, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        soft = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        # Reject degenerate masks (near-empty or near-full: grabcut failed to separate)
        coverage = soft.mean() / 255.0
        if coverage < 0.05 or coverage > 0.97:
            return None
        # Also reject masks that only cover a small fragment of the seed
        # rectangle (e.g. a low-contrast product against a similarly light
        # background can make GrabCut latch onto a single high-contrast
        # detail - like a dark visor - and drop the rest of the product).
        # A real product silhouette should span most of the rect on both
        # axes; a mask that doesn't is more likely a bad segmentation than
        # a genuinely tiny product, so we fall back to the uncropped photo.
        ys, xs = np.where(soft > 0)
        if len(xs) == 0:
            return None
        bbox_w = (xs.max() - xs.min()) / rect[2]
        bbox_h = (ys.max() - ys.min()) / rect[3]
        if bbox_w < 0.4 or bbox_h < 0.4:
            return None
        soft = cv2.GaussianBlur(soft, (9, 9), 0)
        return soft
    except cv2.error:
        return None


def _apply_background(rgba_img, mode):
    spec = BACKGROUND_MODES.get(mode, BACKGROUND_MODES["PREMIUM_DARK"])
    w, h = rgba_img.size
    if spec["type"] == "transparent":
        return rgba_img
    if spec["type"] == "flat":
        base = Image.new("RGB", (w, h), spec["color"])
    else:
        top, bottom = spec["colors"]
        base = _vertical_gradient(w, h, top, bottom)
    base = base.convert("RGBA")
    base.alpha_composite(rgba_img)
    return base.convert("RGB")


def _vertical_gradient(w, h, top, bottom):
    grad = np.zeros((h, w, 3), dtype=np.uint8)
    t = np.linspace(0, 1, h).reshape(h, 1)
    for c in range(3):
        col = top[c] + (bottom[c] - top[c]) * t
        grad[:, :, c] = np.repeat(col, w, axis=1).astype(np.uint8)
    return Image.fromarray(grad, "RGB")


def _crop_to_mask(img, mask_arr, padding_ratio=0.12):
    ys, xs = np.where(mask_arr > 40)
    if len(xs) == 0 or len(ys) == 0:
        return img
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    w, h = img.size
    pad_x = int((x1 - x0) * padding_ratio) + 10
    pad_y = int((y1 - y0) * padding_ratio) + 10
    x0 = max(0, x0 - pad_x)
    y0 = max(0, y0 - pad_y)
    x1 = min(w, x1 + pad_x)
    y1 = min(h, y1 + pad_y)
    return img.crop((x0, y0, x1, y1))


def _square_canvas(img, size, background_rgb=None, fill_ratio=0.9):
    """Center `img` (RGB or RGBA) on a square canvas of `size`x`size`,
    scaling it (up OR down, unlike PIL's shrink-only .thumbnail) so its
    longest side fills `fill_ratio` of the canvas. Without this, a photo
    that was tightly cropped to the helmet (a small pixel region) would
    stay at its native crop size and end up as a tiny island surrounded
    by background instead of a properly framed product shot."""
    img = img.copy()
    target = max(1, int(size * fill_ratio))
    scale = target / max(img.width, img.height)
    new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    img = img.resize(new_size, Image.LANCZOS)
    mode = "RGBA" if img.mode == "RGBA" else "RGB"
    if mode == "RGBA":
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGB", (size, size), background_rgb or (255, 255, 255))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y), img if mode == "RGBA" else None)
    return canvas


def enhance_image(source_path, background_mode="PREMIUM_DARK", canvas_size=1600):
    """Run the full local enhancement pipeline on one photo.
    Returns a PIL Image (RGB, or RGBA for TRANSPARENT mode)."""
    img = Image.open(source_path)
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")

    np_img = np.array(img)
    np_img = _gray_world_white_balance(np_img)
    np_img = _denoise(np_img)
    img = Image.fromarray(np_img, "RGB")

    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.05)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.6, percent=110, threshold=3))

    mask = _foreground_mask(np.array(img))

    if mask is not None:
        cropped_img = _crop_to_mask(img, mask)
        cropped_mask = _crop_to_mask(Image.fromarray(mask), mask)
        rgba = cropped_img.convert("RGBA")
        rgba.putalpha(cropped_mask.convert("L"))
        composed = _apply_background(rgba, background_mode)
    else:
        composed = img if background_mode != "TRANSPARENT" else img.convert("RGBA")

    if background_mode == "TRANSPARENT":
        final = _square_canvas(composed.convert("RGBA"), canvas_size)
    else:
        flat_bg = BACKGROUND_MODES.get(background_mode, {}).get("color", (20, 20, 22))
        final = _square_canvas(composed.convert("RGB"), canvas_size, background_rgb=flat_bg)

    return final


def enhance_and_save(source_path, dest_dir, background_mode="PREMIUM_DARK"):
    """Process one photo and save both a digital and a print variant.
    Returns {"digital": path, "print": path}."""
    os.makedirs(dest_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(source_path))[0]

    processed = enhance_image(source_path, background_mode, canvas_size=PRINT_MAX_SIDE)

    print_path = os.path.join(dest_dir, f"{stem}_print.png" if processed.mode == "RGBA" else f"{stem}_print.jpg")
    if processed.mode == "RGBA":
        processed.save(print_path, "PNG", optimize=True)
    else:
        processed.save(print_path, "JPEG", quality=95)

    digital_img = processed.copy()
    digital_img.thumbnail((DIGITAL_MAX_SIDE, DIGITAL_MAX_SIDE), Image.LANCZOS)
    digital_path = os.path.join(dest_dir, f"{stem}_digital.png" if digital_img.mode == "RGBA" else f"{stem}_digital.jpg")
    if digital_img.mode == "RGBA":
        digital_img.save(digital_path, "PNG", optimize=True)
    else:
        digital_img.save(digital_path, "JPEG", quality=82)

    return {"digital": digital_path, "print": print_path}
