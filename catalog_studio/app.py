"""TODOMOTOS Catalog Studio — local, offline catalog generator.

Run with:  python app.py
Then open: http://127.0.0.1:5050

Everything runs on this machine: no cloud server, no external
database, no login, no mandatory external APIs. Uploaded Excel/photos
and generated output stay on disk under this app's data/ folder.
"""
import os
import shutil
import threading
import time
import traceback
import uuid

from flask import Flask, jsonify, render_template, request, send_file, abort

from engine import excel_parser, photo_matcher, image_enhancer, pdf_generator, project_store
from engine.text_utils import clean_text, parse_price

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

for d in (DATA_DIR, UPLOADS_DIR, PROCESSED_DIR, OUTPUT_DIR, project_store.PROJECTS_DIR):
    os.makedirs(d, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024 * 1024  # 2GB, local use only

# ---------------------------------------------------------------------------
# In-memory application state. This is a single-user local tool (like opening
# a desktop app), so one global project in memory is enough; it is persisted
# to a JSON file on disk whenever the user saves.
# ---------------------------------------------------------------------------
STATE = {
    "project": project_store.new_project("Catalogo Todomotos"),
    "session_id": None,
    "df_columns": [],
    "photos_index": [],
}

PROGRESS = {
    "stage": "idle",
    "percent": 0,
    "current": "",
    "errors": [],
    "done": True,
    "total_stages": 1,
}


def _session_dir():
    sid = STATE["session_id"]
    if not sid:
        sid = uuid.uuid4().hex[:12]
        STATE["session_id"] = sid
    path = os.path.join(UPLOADS_DIR, sid)
    os.makedirs(path, exist_ok=True)
    return path


def _session_processed_dir():
    sid = STATE["session_id"] or "default"
    path = os.path.join(PROCESSED_DIR, sid)
    os.makedirs(path, exist_ok=True)
    return path


# ---------------------------------------------------------------------------
# Page
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Step 1-2: Excel import + column detection
# ---------------------------------------------------------------------------

@app.route("/api/excel/upload", methods=["POST"])
def excel_upload():
    file = request.files.get("excel")
    if not file or not file.filename:
        return jsonify({"error": "No se recibio ningun archivo."}), 400

    session_dir = _session_dir()
    excel_path = os.path.join(session_dir, "source_" + file.filename)
    file.save(excel_path)

    try:
        df, mapping, count = excel_parser.load_excel(excel_path)
    except Exception as exc:  # noqa: BLE001 - surface parse errors to the UI
        return jsonify({"error": f"No se pudo leer el Excel: {exc}"}), 400

    STATE["project"]["excel_path"] = excel_path
    STATE["project"]["column_mapping"] = mapping
    STATE["df_columns"] = list(df.columns)
    STATE["_df_cache_path"] = excel_path

    detected = {
        field: {"column": col, "detected": col is not None}
        for field, col in mapping.items()
    }
    preview_rows = df.head(5).fillna("").astype(str).to_dict(orient="records")

    return jsonify({
        "product_count": count,
        "columns": list(df.columns),
        "mapping": mapping,
        "detected": detected,
        "preview_rows": preview_rows,
        "required_fields": excel_parser.REQUIRED_FIELDS,
        "all_fields": excel_parser.ALL_FIELDS,
    })


@app.route("/api/excel/confirm", methods=["POST"])
def excel_confirm():
    body = request.get_json(force=True)
    mapping = body.get("mapping", {})
    excel_path = STATE["project"].get("excel_path")
    if not excel_path or not os.path.exists(excel_path):
        return jsonify({"error": "Primero sube un archivo Excel."}), 400

    df, _auto_mapping, _count = excel_parser.load_excel(excel_path)
    mapping = {field: (col if col in df.columns else None) for field, col in mapping.items()}
    products = excel_parser.build_products(df, mapping)

    STATE["project"]["column_mapping"] = mapping
    STATE["project"]["products"] = products
    STATE["project"]["state"] = "excel_confirmed"

    return jsonify({
        "products": products,
        "validation": excel_parser.validation_summary(products),
    })


# ---------------------------------------------------------------------------
# Step 3: Photos import + automatic association
# ---------------------------------------------------------------------------

@app.route("/api/photos/upload", methods=["POST"])
def photos_upload():
    files = request.files.getlist("photos")
    if not files:
        return jsonify({"error": "No se recibieron fotografias."}), 400

    session_dir = _session_dir()
    photos_dir = os.path.join(session_dir, "photos")
    os.makedirs(photos_dir, exist_ok=True)

    saved = 0
    for f in files:
        if not f.filename:
            continue
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in photo_matcher.IMAGE_EXTENSIONS:
            continue
        safe_name = os.path.basename(f.filename)
        f.save(os.path.join(photos_dir, safe_name))
        saved += 1

    STATE["project"]["photos_folder"] = photos_dir
    photos = photo_matcher.list_photos(photos_dir)
    STATE["photos_index"] = photos

    products = STATE["project"].get("products", [])
    used = photo_matcher.match_photos(products, photos)
    unassigned = photo_matcher.unassigned_photos(photos, used)

    sin_foto = [p for p in products if p["sin_foto"] and not p["oculto"]]

    return jsonify({
        "photos_found": len(photos),
        "products": products,
        "sin_foto": sin_foto,
        "unassigned_photos": [p["filename"] for p in unassigned],
    })


@app.route("/api/photos/thumb")
def photos_thumb():
    path = request.args.get("path", "")
    if not path or not os.path.isfile(path):
        abort(404)
    allowed_roots = (UPLOADS_DIR, PROCESSED_DIR, OUTPUT_DIR)
    real = os.path.realpath(path)
    if not any(real.startswith(os.path.realpath(root)) for root in allowed_roots):
        abort(403)
    return send_file(real)


@app.route("/api/photos/manual-assign", methods=["POST"])
def photos_manual_assign():
    body = request.get_json(force=True)
    product_id = body.get("product_id")
    photo_path = body.get("photo_path")
    slot = body.get("slot", "principal")

    products = STATE["project"].get("products", [])
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        return jsonify({"error": "Producto no encontrado."}), 404

    if slot == "principal":
        product["foto_principal"] = photo_path
        if photo_path not in [f["path"] for f in product["fotos"]]:
            product["fotos"].insert(0, {"path": photo_path, "filename": os.path.basename(photo_path)})
    else:
        if photo_path not in product["fotos_secundarias"]:
            product["fotos_secundarias"].append(photo_path)

    product["sin_foto"] = product["foto_principal"] is None
    return jsonify({"product": product})


@app.route("/api/photos/exclude", methods=["POST"])
def photos_exclude():
    body = request.get_json(force=True)
    product_id = body.get("product_id")
    exclude = bool(body.get("exclude", True))
    products = STATE["project"].get("products", [])
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        return jsonify({"error": "Producto no encontrado."}), 404
    product["oculto"] = exclude
    return jsonify({"product": product})


# ---------------------------------------------------------------------------
# Step 4-6: Product edits (used by the review/edit screen)
# ---------------------------------------------------------------------------

@app.route("/api/products/update", methods=["POST"])
def products_update():
    body = request.get_json(force=True)
    product_id = body.get("product_id")
    products = STATE["project"].get("products", [])
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        return jsonify({"error": "Producto no encontrado."}), 404

    if "descripcion" in body:
        product["descripcion"] = clean_text(body["descripcion"], fix_case=False) or None
    if "categoria" in body:
        product["categoria"] = clean_text(body["categoria"]) or None
    if "orden" in body:
        product["orden"] = body["orden"]
    if "layout" in body:
        product["layout"] = body["layout"] or "auto"
    if "precio_visual" in body:
        raw = body["precio_visual"]
        if raw in (None, ""):
            product["precio_visual"] = None
            product["precio_visual_advertencia"] = False
        else:
            price = parse_price(raw)
            product["precio_visual"] = price
            product["precio_visual_advertencia"] = (
                price is not None and product.get("precio_mayorista") is not None
                and abs(price - product["precio_mayorista"]) > 0.001
            )
    if "fotos_secundarias" in body:
        product["fotos_secundarias"] = body["fotos_secundarias"]
    if "foto_principal" in body:
        product["foto_principal"] = body["foto_principal"]
        product["sin_foto"] = product["foto_principal"] is None

    return jsonify({"product": product})


@app.route("/api/products/reorder", methods=["POST"])
def products_reorder():
    body = request.get_json(force=True)
    order = body.get("order", [])  # list of product ids in new order
    products = STATE["project"].get("products", [])
    by_id = {p["id"]: p for p in products}
    for idx, pid in enumerate(order):
        if pid in by_id:
            by_id[pid]["orden"] = idx
    return jsonify({"ok": True})


@app.route("/api/products/list")
def products_list():
    return jsonify({
        "products": STATE["project"].get("products", []),
        "validation": excel_parser.validation_summary(STATE["project"].get("products", [])),
    })


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@app.route("/api/config", methods=["GET", "POST"])
def config():
    if request.method == "POST":
        body = request.get_json(force=True)
        STATE["project"]["config"].update({
            k: v for k, v in body.items()
            if k in ("currency", "accent_color", "background_mode", "year")
        })
    return jsonify(STATE["project"]["config"])


# ---------------------------------------------------------------------------
# Step 6: Photo enhancement (background thread, polled progress)
# ---------------------------------------------------------------------------

def _run_enhancement(background_mode):
    products = STATE["project"].get("products", [])
    targets = []
    for product in products:
        if product.get("oculto"):
            continue
        paths = [product.get("foto_principal")] + list(product.get("fotos_secundarias", []))
        for p in paths:
            if p and p not in targets:
                targets.append(p)

    total = max(len(targets), 1)
    PROGRESS.update(stage="enhancing", percent=0, current="", errors=[], done=False, total_stages=1)

    processed_map = {}
    dest_dir = _session_processed_dir()

    for i, path in enumerate(targets):
        PROGRESS["current"] = os.path.basename(path)
        try:
            result = image_enhancer.enhance_and_save(path, dest_dir, background_mode=background_mode)
            processed_map[path] = result
        except Exception as exc:  # noqa: BLE001
            PROGRESS["errors"].append({
                "file": os.path.basename(path),
                "path": path,
                "message": str(exc),
            })
            traceback.print_exc()
        PROGRESS["percent"] = int(((i + 1) / total) * 100)
        time.sleep(0.01)

    for product in products:
        principal = product.get("foto_principal")
        if principal in processed_map:
            product["foto_principal_procesada"] = processed_map[principal]["digital"]
            product["foto_principal_procesada_print"] = processed_map[principal]["print"]
        secundarias = product.get("fotos_secundarias", [])
        product["fotos_secundarias_procesadas"] = [
            processed_map[p]["digital"] for p in secundarias if p in processed_map
        ]
        product["fotos_secundarias_procesadas_print"] = [
            processed_map[p]["print"] for p in secundarias if p in processed_map
        ]

    STATE["_processed_map"] = processed_map
    PROGRESS["stage"] = "done"
    PROGRESS["percent"] = 100
    PROGRESS["done"] = True


@app.route("/api/process/enhance", methods=["POST"])
def process_enhance():
    if not PROGRESS["done"]:
        return jsonify({"error": "Ya hay un proceso en curso."}), 409
    body = request.get_json(silent=True) or {}
    background_mode = body.get("background_mode") or STATE["project"]["config"].get("background_mode", "PREMIUM_DARK")
    STATE["project"]["config"]["background_mode"] = background_mode

    thread = threading.Thread(target=_run_enhancement, args=(background_mode,), daemon=True)
    thread.start()
    return jsonify({"started": True})


@app.route("/api/process/retry", methods=["POST"])
def process_retry():
    body = request.get_json(force=True)
    path = body.get("path")
    background_mode = STATE["project"]["config"].get("background_mode", "PREMIUM_DARK")
    dest_dir = _session_processed_dir()
    try:
        result = image_enhancer.enhance_and_save(path, dest_dir, background_mode=background_mode)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500

    processed_map = STATE.get("_processed_map", {})
    processed_map[path] = result
    STATE["_processed_map"] = processed_map

    for product in STATE["project"].get("products", []):
        if product.get("foto_principal") == path:
            product["foto_principal_procesada"] = result["digital"]
            product["foto_principal_procesada_print"] = result["print"]
        if path in product.get("fotos_secundarias", []):
            secs = [processed_map[p]["digital"] for p in product["fotos_secundarias"] if p in processed_map]
            product["fotos_secundarias_procesadas"] = secs

    PROGRESS["errors"] = [e for e in PROGRESS["errors"] if e["path"] != path]
    return jsonify({"ok": True, "result": result})


@app.route("/api/process/progress")
def process_progress():
    return jsonify(PROGRESS)


# ---------------------------------------------------------------------------
# Step 7-9: Validation + PDF generation
# ---------------------------------------------------------------------------

@app.route("/api/catalog/validate")
def catalog_validate():
    products = STATE["project"].get("products", [])
    return jsonify(excel_parser.validation_summary(products))


def _run_generation(quality_modes, out_dir):
    products = STATE["project"].get("products", [])
    config = STATE["project"]["config"]
    total = len(quality_modes)
    PROGRESS.update(stage="generating", percent=0, current="", errors=[], done=False, total_stages=1)

    results = {}
    for i, quality in enumerate(quality_modes):
        PROGRESS["current"] = f"PDF {quality}"
        render_products = []
        for p in products:
            rp = dict(p)
            if quality == "print":
                rp["foto_principal_procesada"] = p.get("foto_principal_procesada_print") or p.get("foto_principal_procesada")
                rp["fotos_secundarias_procesadas"] = p.get("fotos_secundarias_procesadas_print") or p.get("fotos_secundarias_procesadas")
            render_products.append(rp)

        suffix = "Impresion" if quality == "print" else "Digital"
        out_path = os.path.join(out_dir, f"Catalogo_Todomotos_Cascos_{config.get('year', 2026)}_{suffix}.pdf")
        try:
            pdf_generator.generate_catalog_pdf(out_path, render_products, config, quality=quality)
            results[quality] = out_path
        except Exception as exc:  # noqa: BLE001
            PROGRESS["errors"].append({"file": f"catalogo_{quality}", "message": str(exc)})
            traceback.print_exc()
        PROGRESS["percent"] = int(((i + 1) / total) * 100)

    STATE["_last_output"] = results
    PROGRESS["stage"] = "done"
    PROGRESS["percent"] = 100
    PROGRESS["done"] = True


@app.route("/api/catalog/generate", methods=["POST"])
def catalog_generate():
    if not PROGRESS["done"]:
        return jsonify({"error": "Ya hay un proceso en curso."}), 409
    body = request.get_json(silent=True) or {}
    modes = body.get("modes") or ["digital", "print"]

    project_name = STATE["project"].get("name", "Catalogo Todomotos")
    safe_name = "".join(c for c in project_name if c.isalnum() or c in (" ", "-", "_")).strip() or "Catalogo"
    out_dir = os.path.join(OUTPUT_DIR, safe_name)
    for sub in ("PDF", "IMAGENES_PROCESADAS", "PREVIEW", "DATOS"):
        os.makedirs(os.path.join(out_dir, sub), exist_ok=True)

    thread = threading.Thread(target=_run_generation, args=(modes, os.path.join(out_dir, "PDF")), daemon=True)
    thread.start()
    return jsonify({"started": True, "output_dir": out_dir})


@app.route("/api/catalog/download")
def catalog_download():
    quality = request.args.get("quality", "digital")
    results = STATE.get("_last_output", {})
    path = results.get(quality)
    if not path or not os.path.exists(path):
        abort(404)
    return send_file(path, as_attachment=True)


@app.route("/api/catalog/preview")
def catalog_preview():
    quality = request.args.get("quality", "digital")
    results = STATE.get("_last_output", {})
    path = results.get(quality)
    if not path or not os.path.exists(path):
        abort(404)
    return send_file(path, mimetype="application/pdf")


# ---------------------------------------------------------------------------
# Project management
# ---------------------------------------------------------------------------

@app.route("/api/project/new", methods=["POST"])
def project_new():
    body = request.get_json(silent=True) or {}
    name = body.get("name") or "Catalogo Todomotos"
    STATE["project"] = project_store.new_project(name)
    STATE["session_id"] = None
    STATE["photos_index"] = []
    STATE.pop("_processed_map", None)
    STATE.pop("_last_output", None)
    return jsonify({"project": STATE["project"]})


@app.route("/api/project/save", methods=["POST"])
def project_save():
    body = request.get_json(silent=True) or {}
    if body.get("name"):
        STATE["project"]["name"] = body["name"]
    path = project_store.save_project(STATE["project"])
    return jsonify({"path": path, "project": STATE["project"]})


@app.route("/api/project/list")
def project_list():
    return jsonify({"projects": project_store.list_projects()})


@app.route("/api/project/open", methods=["POST"])
def project_open():
    body = request.get_json(force=True)
    name_or_path = body.get("path") or body.get("name")
    try:
        STATE["project"] = project_store.load_project(name_or_path)
    except (OSError, ValueError) as exc:
        return jsonify({"error": str(exc)}), 400
    STATE["session_id"] = None
    return jsonify({"project": STATE["project"]})


@app.route("/api/project/current")
def project_current():
    return jsonify({"project": STATE["project"]})


if __name__ == "__main__":
    print("=" * 60)
    print("  TODOMOTOS CATALOG STUDIO")
    print("  Abre en tu navegador: http://127.0.0.1:5050")
    print("=" * 60)
    app.run(host="127.0.0.1", port=5050, debug=False, threaded=True)
