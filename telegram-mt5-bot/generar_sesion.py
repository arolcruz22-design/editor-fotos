# Genera TG_SESSION. Pensado para Google Colab (colab.research.google.com) desde el móvil:
#   1) Celda 1:  !pip install telethon
#   2) Celda 2:  pega este archivo completo y ejecútalo.
# Te pedirá tu API ID, API HASH, teléfono (+52...) y el código que te llega por Telegram.
# El texto largo que imprime es TG_SESSION: da acceso a tu cuenta, NO lo compartas con nadie.
from telethon import TelegramClient
from telethon.sessions import StringSession

api_id = int(input("API ID: "))
api_hash = input("API HASH: ").strip()
client = TelegramClient(StringSession(), api_id, api_hash)
await client.start()  # noqa: F704  (Colab permite await directo en la celda)
print("\n=== TG_SESSION (cópialo completo) ===\n")
print(client.session.save())
await client.disconnect()  # noqa: F704
