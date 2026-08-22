"""Small local text-cleanup helpers. No AI, no external calls.

Only formatting fixes are applied here (whitespace, casing, stray
characters). The *meaning* of any text is never altered, and the
original value coming from the Excel file is always preserved
alongside the cleaned one.
"""
import re
import unicodedata

_CONTROL_CODEPOINTS = [c for c in range(0, 32) if c not in (9, 10)] + [127]
_STRAY_CHARS = re.compile("[" + "".join(chr(c) for c in _CONTROL_CODEPOINTS) + "]")
_MULTI_SPACE = re.compile(r"[ \t]+")
_MULTI_BREAK = re.compile(r"\n{3,}")


def normalize_key(value) -> str:
    """Normalize a header or free-text value into a comparable key:
    strip accents, uppercase, collapse non-alphanumerics to spaces."""
    if value is None:
        return ""
    text = str(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^A-Za-z0-9]+", " ", text)
    return text.strip().upper()


def slug(value) -> str:
    """Aggressive normalization for filename / code matching:
    uppercase alphanumerics only, no separators."""
    if value is None:
        return ""
    text = str(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^A-Za-z0-9]", "", text)
    return text.upper()


def clean_text(value, fix_case=False) -> str:
    """Local formatting cleanup only: trims stray control characters,
    collapses repeated whitespace and normalizes line breaks. Does not
    change wording. `fix_case` (only meaningful for long free-text like
    descriptions) turns an ALL-CAPS sentence into sentence case; it is
    left off for codes/model names/short fields, where an all-caps
    token (e.g. "URBAN X") is usually intentional, not a formatting
    accident."""
    if value is None:
        return ""
    text = str(value)
    text = _STRAY_CHARS.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(_MULTI_SPACE.sub(" ", line).strip() for line in text.split("\n"))
    text = _MULTI_BREAK.sub("\n\n", text)
    text = text.strip()
    if fix_case and text and text.isupper() and len(text) > 3:
        text = text.capitalize()
    return text


def parse_price(value):
    """Parse a price cell into a float without rounding or recalculating.
    Returns None if the cell has no usable numeric value."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if value != value:  # NaN
            return None
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    text = re.sub(r"[^0-9.,\-]", "", text)
    if not text:
        return None
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        parts = text.split(",")
        if len(parts[-1]) == 2:
            text = text.replace(",", ".")
        else:
            text = text.replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None


def format_price(value, currency="L") -> str:
    if value is None:
        return ""
    return f"{currency} {value:,.2f}"
