# Bot Telegram → MT5 (NAS100)

Lee las señales de uno o varios canales de Telegram y las ejecuta en tu cuenta MT5 a través de **MetaApi**.
Corre en **Railway** las 24 horas. Tú lo controlas desde el teléfono con un bot de Telegram.

```
Canal de señales ──► bot.py (Railway) ──► MetaApi ──► tu cuenta MT5
                          │
                          └──► tu bot de avisos (confirmaciones, errores, /estado, /cerrar)
```

**El bot arranca en modo SIMULACIÓN (`DRY_RUN=true`):** lee las señales y te avisa de lo que haría, pero no opera.
Déjalo así unos días y con una cuenta **demo** antes de poner `DRY_RUN=false`.

---

## Paso 1: Claves de Telegram (5 min)
1. En el navegador del móvil abre **https://my.telegram.org**, entra con tu número y ve a **API development tools**.
2. Crea una app (el nombre da igual). Apunta el **api_id** y el **api_hash**.

## Paso 2: Bot de avisos (2 min)
1. En Telegram abre **@BotFather**, envía `/newbot` y sigue los pasos.
2. Copia el **token** que te da (`123456:ABC...`).
3. Abre tu bot nuevo y pulsa **Iniciar / Start**. Si no lo haces, el bot no podrá escribirte.

## Paso 3: Sesión de Telegram (5 min, en Google Colab)
1. Abre **https://colab.research.google.com** y crea un **Nuevo cuaderno**.
2. En la primera celda escribe `!pip install telethon` y ejecútala (▶).
3. Añade otra celda, pega el contenido de [`generar_sesion.py`](generar_sesion.py) y ejecútala.
4. Escribe tu api_id, tu api_hash, tu teléfono con prefijo (+52…) y el código que te llega por Telegram.
5. Copia el texto largo que aparece: es tu **TG_SESSION**.
   ⚠️ Ese texto da acceso completo a tu Telegram. No lo compartas con nadie.

## Paso 4: MetaApi (10 min)
1. Regístrate en **https://app.metaapi.cloud**.
2. **Add account**: tipo MT5, con tu login, contraseña y servidor del broker (están en los datos de tu cuenta MT5). Usa primero la cuenta **demo**.
3. Copia el **Account ID** de la cuenta que acabas de añadir.
4. En **API access token**, genera y copia el **token**.

## Paso 5: Desplegar en Railway (10 min)
1. Entra en **https://railway.app** con tu cuenta de GitHub. Necesitas el plan Hobby.
2. **New Project → Deploy from GitHub repo →** `editor-fotos`.
3. En el servicio, ve a **Settings**:
   - **Root Directory**: `telegram-mt5-bot`
   - **Branch**: la rama donde está este código.
4. Ve a **Variables → Raw Editor**, pega el contenido de [`.env.example`](.env.example) y rellena cada valor.
5. Railway despliega solo. Al terminar, te llegará al bot de avisos el mensaje **"🤖 Bot iniciado"**.

### ¿Qué pongo en `SIGNAL_CHANNELS`?
- Si el canal es público: su `@usuario` (ej. `@senales_nas100`).
- Si es privado: su ID numérico (empieza por `-100…`). Para saberlo, reenvía un mensaje del canal a **@userinfobot** o **@RawDataBot**.
- Varios canales se separan con comas: `@canal1,-1001234567890`.
- Tu cuenta de Telegram tiene que ser miembro del canal.

### ¿Qué pongo en `SYMBOL`?
El nombre exacto del símbolo en tu broker, tal como aparece en MT5: `NAS100`, `US100`, `USTEC`, `NAS100.cash`, etc.

---

## Variables

| Variable | Qué hace | Por defecto |
|---|---|---|
| `LOT` | Lote total por señal | 0.1 |
| `TP_MODE` | `first` = usa solo el TP1 · `split` = reparte el lote entre todos los TP | first |
| `DRY_RUN` | `true` = solo simula · `false` = opera de verdad | true |
| `MAX_LOT` | Tope de lote aunque `LOT` sea mayor | 1.0 |
| `REQUIRE_SL` | Rechaza las señales que no traen SL | true |
| `MAX_TRADES_PER_DAY` | Máximo de señales ejecutadas por día (UTC) | 5 |
| `MAX_OPEN_POSITIONS` | Máximo de posiciones del bot abiertas a la vez | 3 |
| `MAX_DAILY_LOSS` | Si la equity cae esto desde el inicio del día, deja de abrir operaciones | 100 |
| `MAX_SL_POINTS` | Rechaza las señales con el SL más lejos que esto | 300 |
| `MAX_ENTRY_DEVIATION` | Rechaza la entrada a mercado si el precio ya se alejó tanto | 40 |

Los cambios de variables en Railway reinician el bot automáticamente.

## Comandos (en tu bot de avisos)
- `/estado`: balance, equity, resultado del día y posiciones abiertas
- `/pausa` y `/reanudar`: detienen o reactivan la apertura de operaciones nuevas
- `/cerrar`: cierra todas las posiciones que abrió el bot
- `/ayuda`: lista de comandos

## Qué mensajes entiende
```
BUY NAS100 @ 18500 SL 18450 TP 18600
NAS100 SELL NOW 18500 / SL: 18550 / TP1: 18450 / TP2: 18400
US100 buy limit 18480-18490 sl 18430 tp 18560
COMPRA NASDAQ 18500 SL 18450 TP1 18550 TP2 18600
CLOSE NAS100                 → cierra las posiciones del bot
NAS100 SL to breakeven       → mueve el SL al precio de entrada
```
- Si un mensaje menciona NAS100 pero no lo entiende, **no hace nada** y te lo reenvía con ❓.
- Los cierres parciales ("cerrar la mitad") **no** se ejecutan: solo te avisa.
- Solo toca las posiciones que abrió el propio bot (identificadas por `MAGIC`). Tus operaciones manuales no las toca.

## Probar el lector de señales
```
pip install -r requirements.txt pytest
python -m pytest tests
```

> ⚠️ Operar con apalancamiento puede hacerte perder todo el capital. Este bot ejecuta lo que dice el canal. Si las señales son malas, perderás dinero igual de rápido.
