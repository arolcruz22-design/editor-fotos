"""Configuración leída de variables de entorno (Railway → Variables)."""
import os


def _bool(name, default):
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "si", "sí", "yes")


def _float(name, default):
    return float(os.getenv(name, default))


def _int(name, default):
    return int(os.getenv(name, default))


def _required(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Falta la variable de entorno {name}. Revisa el README.")
    return value


# --- Telegram ---
TG_API_ID = int(_required("TG_API_ID"))
TG_API_HASH = _required("TG_API_HASH")
TG_SESSION = _required("TG_SESSION")          # string generado con generar_sesion.py
TG_BOT_TOKEN = _required("TG_BOT_TOKEN")      # bot de @BotFather para avisos y comandos
# Canales de señales: @usuario, enlace t.me o ID numérico; separados por coma.
SIGNAL_CHANNELS = [c.strip() for c in _required("SIGNAL_CHANNELS").split(",") if c.strip()]

# --- MetaApi ---
METAAPI_TOKEN = _required("METAAPI_TOKEN")
METAAPI_ACCOUNT_ID = _required("METAAPI_ACCOUNT_ID")

# --- Operativa ---
SYMBOL = os.getenv("SYMBOL", "NAS100")        # nombre EXACTO del símbolo en tu broker
LOT = _float("LOT", "0.1")                    # lote total por señal
TP_MODE = os.getenv("TP_MODE", "first").lower()  # first = solo TP1 | split = reparte el lote entre los TP
MAGIC = _int("MAGIC", "770100")               # identifica las posiciones abiertas por el bot
DRY_RUN = _bool("DRY_RUN", True)              # true = solo avisa, NO opera

# --- Riesgo ---
MAX_LOT = _float("MAX_LOT", "1.0")
REQUIRE_SL = _bool("REQUIRE_SL", True)
MAX_TRADES_PER_DAY = _int("MAX_TRADES_PER_DAY", "5")
MAX_OPEN_POSITIONS = _int("MAX_OPEN_POSITIONS", "3")
MAX_DAILY_LOSS = _float("MAX_DAILY_LOSS", "100")   # en la moneda de la cuenta
MAX_SL_POINTS = _float("MAX_SL_POINTS", "300")     # distancia máxima entrada-SL en puntos del índice
MAX_ENTRY_DEVIATION = _float("MAX_ENTRY_DEVIATION", "40")  # si el precio ya se alejó tanto de la entrada, no entra
