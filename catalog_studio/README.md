# TODOMOTOS Catalog Studio

Generador local y autonomo de catalogos premium de cascos: convierte un
**Excel + carpeta de fotografias** en un **catalogo PDF profesional**,
con la minima intervencion manual posible.

100% local. No requiere servidor en la nube, base de datos externa,
login/usuarios, ni ninguna API de pago (OpenAI, Firebase, Supabase,
etc.) para funcionar. Todo corre en tu maquina; el navegador solo se
usa como interfaz.

## Como ejecutarlo

```bash
cd catalog_studio
pip install -r requirements.txt
python app.py
```

Luego abre **http://127.0.0.1:5050** en tu navegador. La app queda
corriendo mientras la terminal este abierta; ciérrala con `Ctrl+C`.

Requiere Python 3.9+.

## Flujo de uso

1. **Excel** — sube tu archivo `.xlsx`/`.xls`/`.csv` de cascos. El sistema
   detecta automaticamente columnas como Codigo, Modelo, Descripcion,
   Precio Mayorista, Categoria, Color, Talla, etc. (por nombre y por
   similitud), y te deja corregir manualmente cualquier columna que no
   haya detectado.
2. **Datos detectados** — confirma el mapeo de columnas antes de continuar.
3. **Fotos** — selecciona la carpeta completa de fotografias. Se asocian
   automaticamente a cada producto por Codigo → SKU → Modelo → nombre de
   archivo (soporta `V001.jpg`, `V001_2.jpg`, `V001_lateral.jpg`, etc.).
4. **Revision de asociacion** — los productos sin foto se listan aparte;
   puedes asignar una foto manualmente, excluir el producto del catalogo,
   o continuar sin foto.
5. **Mejora de fotografias** — elige el fondo (Premium Dark, Studio White,
   Graphite o Transparent) y procesa todas las fotos: balance de blancos,
   reduccion de ruido, contraste/nitidez, aislamiento de fondo (OpenCV
   GrabCut, 100% local) y composicion sobre un fondo profesional. La
   forma, color, logos y detalles del casco nunca se modifican. Si una
   imagen falla, se puede reintentar sin detener el resto del lote.
6. **Edicion y revision** — por producto: cambiar foto principal/secundarias,
   ocultar del catalogo, editar categoria/descripcion, cambiar el precio
   *visual* (con advertencia si no coincide con el Excel), elegir el orden
   y el layout de pagina.
7. **Validacion** — resumen final (productos con precio/foto/codigo/descripcion)
   antes de generar.
8. **Generar PDF** — produce **PDF Digital** (liviano, para WhatsApp/correo)
   y **PDF Impresion** (alta resolucion) con vista previa embebida en el
   navegador.

El proyecto completo (productos, asociaciones, ediciones, configuracion)
se puede **Guardar**/**Abrir** como un archivo JSON local en `projects/`,
sin ninguna base de datos.

## Que NO hace (por diseño, en esta version)

Sin servidor en la nube, sin base de datos remota, sin login/usuarios/roles,
sin URLs publicas, sin APIs de IA externas obligatorias (OpenAI, etc.), sin
cola de trabajos distribuida. El sistema tampoco inventa datos: si el Excel
no trae, por ejemplo, peso/material/certificaciones, esos campos simplemente
no aparecen en el catalogo.

## Arquitectura

```
catalog_studio/
  app.py                 Servidor Flask local (127.0.0.1) + orquestacion
  engine/
    excel_parser.py      Deteccion automatica de columnas + importacion
    photo_matcher.py      Asociacion foto <-> producto
    image_enhancer.py     Mejora de imagen 100% local (Pillow + OpenCV)
    pdf_generator.py      Diseno editorial premium (ReportLab, 4 layouts)
    project_store.py      Guardado/carga de proyecto en JSON local
    text_utils.py          Limpieza de texto/precio sin IA
  static/, templates/     Interfaz web local (vanilla JS, sin build step)
  data/                   Excel/fotos subidos y fotos procesadas (runtime)
  projects/               Proyectos guardados (.json)
  output/                 Catalogos generados (PDF/, IMAGENES_PROCESADAS/, DATOS/)
```

### Extensibilidad futura (IA externa opcional)

La arquitectura deja espacio para conectar mas adelante una API de IA
(mejor remocion de fondo, reescritura de descripciones, clasificacion,
etc.) como una capa opcional en `image_enhancer.py`/`text_utils.py`, sin
que la app deje de funcionar perfectamente sin ella. Ninguna clave de API
esta ni debe estar escrita en el codigo.
