"""Bot: lee señales de canales de Telegram y opera NAS100 en MT5 vía MetaApi.

- Cliente de usuario (Telethon + TG_SESSION): escucha los canales de señales.
- Bot de @BotFather (TG_BOT_TOKEN): te avisa de todo y recibe tus comandos.
"""
import asyncio
import logging

from telethon import TelegramClient, events
from telethon.sessions import StringSession

import config
import signal_parser
from trader import RiskBlocked, Trader

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("bot")

HELP = (
    "Comandos:\n"
    "/estado – cuenta, posiciones y límites\n"
    "/pausa – deja de abrir operaciones nuevas\n"
    "/reanudar – vuelve a operar\n"
    "/cerrar – cierra todas las posiciones del bot\n"
    "/ayuda – este mensaje"
)


def _channel(value):
    return int(value) if value.lstrip("-").isdigit() else value


async def main():
    user = TelegramClient(StringSession(config.TG_SESSION), config.TG_API_ID, config.TG_API_HASH)
    bot = TelegramClient(StringSession(), config.TG_API_ID, config.TG_API_HASH)
    await user.connect()
    if not await user.is_user_authorized():
        raise SystemExit("TG_SESSION no es válida. Genera una nueva con generar_sesion.py")
    await bot.start(bot_token=config.TG_BOT_TOKEN)
    owner = (await user.get_me()).id

    trader = Trader()
    await trader.connect()
    lock = asyncio.Lock()   # una señal a la vez, para que los límites cuenten bien

    async def notify(text):
        try:
            await bot.send_message(owner, text)
        except Exception:
            log.exception("No pude enviarte el aviso (¿le diste /start al bot?)")

    channels = [_channel(c) for c in config.SIGNAL_CHANNELS]

    @user.on(events.NewMessage(chats=channels))
    async def on_signal(event):
        text = event.raw_text or ""
        sig = signal_parser.parse(text, config.SYMBOL)
        if sig is None:
            if signal_parser.mentions_symbol(text, config.SYMBOL):
                await notify(f"❓ Mensaje con {config.SYMBOL} que no entendí, no hice nada:\n\n{text[:500]}")
            return
        log.info("Señal: %s", sig.describe())
        async with lock:
            try:
                if sig.kind == "open":
                    result = await trader.open(sig)
                elif sig.kind == "close":
                    result = await trader.close_all()
                elif sig.kind == "breakeven":
                    result = await trader.breakeven()
                else:
                    result = "Cierre parcial: no lo hago automático, revísalo tú."
                await notify(f"📩 {sig.describe()}\n{result}")
            except RiskBlocked as e:
                await notify(f"⛔ {sig.describe()}\nNo operé: {e}")
            except Exception as e:
                log.exception("Error ejecutando la señal")
                await notify(f"⚠️ {sig.describe()}\nError: {e}")

    @bot.on(events.NewMessage(from_users=owner, pattern=r"^/"))
    async def on_command(event):
        cmd = event.raw_text.split()[0].split("@")[0].lower()
        try:
            if cmd == "/estado":
                await event.reply(await trader.status())
            elif cmd == "/pausa":
                trader.paused = True
                await event.reply("⏸ En pausa: no abriré operaciones nuevas.")
            elif cmd == "/reanudar":
                trader.paused = False
                await event.reply("▶️ Reanudado.")
            elif cmd == "/cerrar":
                async with lock:
                    await event.reply(await trader.close_all())
            else:
                await event.reply(HELP)
        except Exception as e:
            log.exception("Error en comando")
            await event.reply(f"⚠️ Error: {e}")

    await notify(
        f"🤖 Bot iniciado · {config.SYMBOL} · lote {config.LOT}"
        f"{' · 🧪 DRY_RUN (no opera de verdad)' if config.DRY_RUN else ' · 💰 OPERANDO REAL'}\n"
        f"Escuchando: {', '.join(config.SIGNAL_CHANNELS)}\n\n{HELP}"
    )
    log.info("Escuchando %s", config.SIGNAL_CHANNELS)
    await asyncio.gather(user.run_until_disconnected(), bot.run_until_disconnected())


if __name__ == "__main__":
    asyncio.run(main())
