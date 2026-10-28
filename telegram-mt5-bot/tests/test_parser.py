import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from signal_parser import parse  # noqa: E402


def test_basic_buy():
    s = parse("BUY NAS100 @ 18500 SL 18450 TP 18600")
    assert (s.kind, s.side, s.order_type, s.entry, s.sl, s.tps) == ("open", "buy", "market", 18500, 18450, [18600])


def test_multiline_multi_tp():
    s = parse("🔥 NAS100 SELL NOW 18500\nSL: 18550\nTP1: 18450\nTP2: 18400\nTP3: 18,350")
    assert (s.side, s.entry, s.sl, s.tps) == ("sell", 18500, 18550, [18450, 18400, 18350])


def test_limit_range():
    s = parse("us100 buy limit 18480-18490 sl 18430 tp 18560")
    assert (s.order_type, s.entry, s.sl, s.tps) == ("limit", 18485, 18430, [18560])


def test_spanish_no_entry():
    s = parse("COMPRA NASDAQ ahora\nSL 18450\nTP 1 18550\nTP 2 18600")
    assert (s.side, s.entry, s.sl, s.tps) == ("buy", None, 18450, [18550, 18600])


def test_sell_stop_not_confused_with_stop_loss():
    assert parse("SELL STOP NAS100 18400 SL 18460 TP 18300").order_type == "stop"
    assert parse("BUY NAS100 18500 STOP LOSS 18450 TP 18600").order_type == "market"


def test_close_and_breakeven():
    assert parse("Close NAS100 now").kind == "close"
    assert parse("NAS100 cerrar la mitad").kind == "partial"
    assert parse("NAS100 move SL to breakeven").kind == "breakeven"


def test_ignored():
    assert parse("Good morning traders!") is None
    assert parse("BUY GOLD 2400 SL 2390 TP 2420") is None
    assert parse("NAS100 analysis: watching 18500") is None
    assert parse("BUY LIMIT NAS100 SL 18400 TP 18600") is None  # pendiente sin precio
