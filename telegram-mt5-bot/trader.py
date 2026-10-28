"""Ejecución en MT5 a través de MetaApi, con los límites de riesgo."""
import logging
import math
from datetime import datetime, timezone

from metaapi_cloud_sdk import MetaApi

import config

log = logging.getLogger("trader")


class RiskBlocked(Exception):
    pass


class Trader:
    def __init__(self):
        self.api = MetaApi(config.METAAPI_TOKEN)
        self.conn = None
        self.paused = False
        self.day = None
        self.trades_today = 0
        self.start_equity = None

    async def connect(self):
        account = await self.api.metatrader_account_api.get_account(config.METAAPI_ACCOUNT_ID)
        if account.state not in ("DEPLOYING", "DEPLOYED"):
            await account.deploy()
        await account.wait_connected()
        self.conn = account.get_rpc_connection()
        await self.conn.connect()
        await self.conn.wait_synchronized()
        log.info("Conectado a MetaApi")

    # ---------- utilidades ----------
    async def _new_day_check(self):
        today = datetime.now(timezone.utc).date()
        if self.day != today:
            info = await self.conn.get_account_information()
            self.day, self.trades_today, self.start_equity = today, 0, info["equity"]

    async def _my_positions(self):
        positions = await self.conn.get_positions()
        return [p for p in positions if p.get("magic") == config.MAGIC and p["symbol"] == config.SYMBOL]

    def _volumes(self, tps):
        lot = min(config.LOT, config.MAX_LOT)
        if config.TP_MODE == "split" and len(tps) > 1:
            each = math.floor(lot / len(tps) * 100) / 100
            if each >= 0.01:
                return [(each, tp) for tp in tps]
        return [(round(lot, 2), tps[0] if tps else None)]

    # ---------- acciones ----------
    async def open(self, sig):
        """Valida la señal y abre la(s) orden(es). Devuelve el texto para el aviso."""
        await self._new_day_check()
        if self.paused:
            raise RiskBlocked("el bot está en pausa (/reanudar para activarlo)")
        if config.REQUIRE_SL and sig.sl is None:
            raise RiskBlocked("la señal no trae SL")
        if self.trades_today >= config.MAX_TRADES_PER_DAY:
            raise RiskBlocked(f"límite de {config.MAX_TRADES_PER_DAY} operaciones diarias")

        info = await self.conn.get_account_information()
        loss = self.start_equity - info["equity"]
        if loss >= config.MAX_DAILY_LOSS:
            raise RiskBlocked(f"pérdida diaria {loss:.2f} ≥ límite {config.MAX_DAILY_LOSS:g}")
        if len(await self._my_positions()) >= config.MAX_OPEN_POSITIONS:
            raise RiskBlocked(f"ya hay {config.MAX_OPEN_POSITIONS} posiciones abiertas")

        price = await self.conn.get_symbol_price(config.SYMBOL)
        market = price["ask"] if sig.side == "buy" else price["bid"]
        ref = sig.entry if sig.order_type != "market" else market
        direction = 1 if sig.side == "buy" else -1

        if sig.order_type == "market" and sig.entry is not None:
            if abs(market - sig.entry) > config.MAX_ENTRY_DEVIATION:
                raise RiskBlocked(f"precio actual {market:g} demasiado lejos de la entrada {sig.entry:g}")
        if sig.sl is not None:
            if (ref - sig.sl) * direction <= 0:
                raise RiskBlocked(f"SL {sig.sl:g} está del lado equivocado del precio {ref:g}")
            if abs(ref - sig.sl) > config.MAX_SL_POINTS:
                raise RiskBlocked(f"SL a {abs(ref - sig.sl):g} puntos (máx. {config.MAX_SL_POINTS:g})")
        tps = [tp for tp in sig.tps if (tp - ref) * direction > 0]

        orders = self._volumes(tps)
        if config.DRY_RUN:
            lines = [f"🧪 SIMULACIÓN (DRY_RUN): {sig.side} {vol} lotes TP {tp}" for vol, tp in orders]
            return "\n".join(lines) + f"\nPrecio actual {market:g}"

        lines = []
        for vol, tp in orders:
            opts = {"comment": "tg-bot", "magic": config.MAGIC}
            if sig.order_type == "market":
                fn = self.conn.create_market_buy_order if sig.side == "buy" else self.conn.create_market_sell_order
                res = await fn(config.SYMBOL, vol, sig.sl, tp, opts)
            else:
                name = f"create_{sig.order_type}_{sig.side}_order"
                res = await getattr(self.conn, name)(config.SYMBOL, vol, sig.entry, sig.sl, tp, opts)
            lines.append(f"✅ {sig.side.upper()} {vol} lotes TP {tp} → {res.get('stringCode')} "
                         f"(id {res.get('positionId') or res.get('orderId')})")
        self.trades_today += 1
        return "\n".join(lines)

    async def close_all(self):
        positions = await self._my_positions()
        if not positions:
            return "No hay posiciones del bot abiertas."
        if config.DRY_RUN:
            return f"🧪 SIMULACIÓN: cerraría {len(positions)} posición(es)."
        lines = []
        for p in positions:
            res = await self.conn.close_position(p["id"])
            lines.append(f"🔒 Cerrada {p['id']} ({p['profit']:+.2f}) → {res.get('stringCode')}")
        return "\n".join(lines)

    async def breakeven(self):
        positions = await self._my_positions()
        if not positions:
            return "No hay posiciones del bot abiertas."
        if config.DRY_RUN:
            return f"🧪 SIMULACIÓN: movería el SL a entrada en {len(positions)} posición(es)."
        lines = []
        for p in positions:
            res = await self.conn.modify_position(p["id"], p["openPrice"], p.get("takeProfit"))
            lines.append(f"🛡 SL a entrada {p['openPrice']:g} en {p['id']} → {res.get('stringCode')}")
        return "\n".join(lines)

    async def status(self):
        await self._new_day_check()
        info = await self.conn.get_account_information()
        positions = await self._my_positions()
        lines = [
            f"{'⏸ EN PAUSA' if self.paused else '▶️ ACTIVO'}{' · 🧪 DRY_RUN' if config.DRY_RUN else ''}",
            f"Balance {info['balance']:.2f} · Equity {info['equity']:.2f} {info.get('currency', '')}",
            f"Resultado hoy {info['equity'] - self.start_equity:+.2f} (límite -{config.MAX_DAILY_LOSS:g})",
            f"Operaciones hoy {self.trades_today}/{config.MAX_TRADES_PER_DAY}",
            f"Posiciones del bot: {len(positions)}",
        ]
        for p in positions:
            lines.append(f"  • {p['type'].replace('POSITION_TYPE_', '')} {p['volume']} @ {p['openPrice']:g} "
                         f"SL {p.get('stopLoss')} TP {p.get('takeProfit')} → {p['profit']:+.2f}")
        return "\n".join(lines)
