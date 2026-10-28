"""Convierte el texto de un mensaje de Telegram en una señal de trading.

Formatos que entiende (mayúsculas/minúsculas da igual):
    BUY NAS100 @ 18500 SL 18450 TP 18600
    NAS100 SELL NOW 18500 / SL: 18550 / TP1: 18450 / TP2: 18400
    US100 buy limit 18480-18490 sl 18430 tp 18560
    COMPRA NASDAQ 18500 SL 18450 TP1 18550 TP2 18600
    CLOSE NAS100            -> cierra las posiciones del bot
    NAS100 SL to breakeven  -> mueve el SL al precio de entrada
"""
import re
from dataclasses import dataclass, field
from typing import List, Optional

SYMBOL_ALIASES = [
    "NAS100", "NAS 100", "NASDAQ", "NASDAQ100", "NASDAQ 100", "US100", "US 100",
    "USTEC", "US TECH 100", "USTECH", "USTECH100", "NDX", "NQ", "NAS",
]

NUM = r"(\d+(?:\.\d+)?)"
BUY_RE = re.compile(r"\b(BUY|LONG|COMPRA|COMPRAR|COMPRAMOS)\b")
SELL_RE = re.compile(r"\b(SELL|SHORT|VENTA|VENDER|VENDEMOS)\b")
SL_RE = re.compile(r"\b(?:SL|S/L|STOP\s*LOSS|STOPLOSS)\s*[:=@\-]?\s*" + NUM)
TP_RE = re.compile(r"\b(?:TP|T/P|TAKE\s*PROFIT)\s*(?:\d(?!\d))?\s*[:=@\-]?\s*" + NUM)
LIMIT_RE = re.compile(r"\bLIMIT\b")
STOP_ORDER_RE = re.compile(r"\b(?:BUY|SELL|COMPRA|VENTA|LONG|SHORT)\s+STOP\b|\bSTOP\s+ORDER\b")
CLOSE_RE = re.compile(r"\b(CLOSE|CLOSED|CERRAR|CIERRA|CIERREN|CERRAMOS|EXIT|SALIR|SALIMOS)\b")
PARTIAL_RE = re.compile(r"\b(HALF|PARTIAL|PARTIALS|MITAD|PARCIAL|PARCIALES|50%)")
BREAKEVEN_RE = re.compile(r"BREAK\s*EVEN|\bBE\b|SL\s+(?:TO|A)\s+(?:ENTRY|ENTRADA)")
ENTRY_RE = re.compile(NUM + r"(?:\s*[-/]\s*" + NUM + r")?")


@dataclass
class Signal:
    kind: str                       # "open" | "close" | "breakeven" | "partial"
    side: Optional[str] = None      # "buy" | "sell"
    order_type: str = "market"      # "market" | "limit" | "stop"
    entry: Optional[float] = None
    sl: Optional[float] = None
    tps: List[float] = field(default_factory=list)

    def describe(self):
        if self.kind != "open":
            return self.kind.upper()
        parts = [self.side.upper(), self.order_type.upper()]
        if self.entry is not None:
            parts.append(f"@ {self.entry:g}")
        parts.append(f"SL {self.sl:g}" if self.sl is not None else "SIN SL")
        if self.tps:
            parts.append("TP " + " / ".join(f"{tp:g}" for tp in self.tps))
        return " ".join(parts)


def _normalize(text):
    text = text.upper()
    text = re.sub(r"(\d),(\d{3})\b", r"\1\2", text)   # 18,500 -> 18500
    text = re.sub(r"(\d),(\d)", r"\1.\2", text)        # 18500,5 -> 18500.5
    return text


def mentions_symbol(text, symbol):
    text = _normalize(text)
    aliases = SYMBOL_ALIASES + [symbol.upper()]
    return any(re.search(r"(?<![A-Z0-9])" + re.escape(a) + r"(?![A-Z0-9])", text) for a in aliases)


def parse(text, symbol="NAS100"):
    """Devuelve una Signal o None si el mensaje no es una señal para el símbolo."""
    if not text or not mentions_symbol(text, symbol):
        return None
    t = _normalize(text)

    is_buy, is_sell = bool(BUY_RE.search(t)), bool(SELL_RE.search(t))
    has_levels = bool(SL_RE.search(t) or TP_RE.search(t))

    if CLOSE_RE.search(t) and not (has_levels and (is_buy or is_sell)):
        return Signal(kind="partial" if PARTIAL_RE.search(t) else "close")
    if BREAKEVEN_RE.search(t) and not has_levels:
        return Signal(kind="breakeven")
    if is_buy == is_sell:          # ninguna dirección, o ambas: ambiguo
        return None

    sig = Signal(kind="open", side="buy" if is_buy else "sell")
    if LIMIT_RE.search(t):
        sig.order_type = "limit"
    elif STOP_ORDER_RE.search(t):
        sig.order_type = "stop"

    sl = SL_RE.search(t)
    sig.sl = float(sl.group(1)) if sl else None
    sig.tps = [float(m.group(1)) for m in TP_RE.finditer(t)]

    # La entrada es el primer número "grande" que no sea SL/TP ni parte del símbolo.
    rest = SL_RE.sub(" ", TP_RE.sub(" ", t))
    for alias in sorted(SYMBOL_ALIASES + [symbol.upper()], key=len, reverse=True):
        rest = rest.replace(alias, " ")
    for m in ENTRY_RE.finditer(rest):
        low = float(m.group(1))
        if low < 1000:             # descarta números sueltos (riesgo 1%, TP2, horas...)
            continue
        high = float(m.group(2)) if m.group(2) and float(m.group(2)) >= 1000 else low
        sig.entry = round((low + high) / 2, 2)
        break

    if sig.order_type != "market" and sig.entry is None:
        return None
    return sig
