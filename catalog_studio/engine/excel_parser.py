"""Excel import with automatic column detection.

Reads any .xlsx/.xls/.csv the user hands us and tries to figure out
which column is which product field, using a table of known header
aliases plus a fuzzy fallback. Nothing here invents data: a field
that isn't found in the sheet simply stays empty.
"""
import difflib

import pandas as pd

from .text_utils import normalize_key, parse_price, clean_text

# Canonical field -> list of header aliases (already normalize_key'd style,
# but we normalize both sides at match time so casing/accents don't matter).
FIELD_ALIASES = {
    "codigo": ["CODIGO", "COD", "COD PRODUCTO", "ID", "ITEM", "NO", "NUM", "CODIGO PRODUCTO"],
    "sku": ["SKU", "REFERENCIA", "REF", "CODIGO SKU"],
    "marca": ["MARCA", "BRAND"],
    "modelo": ["MODELO", "MODEL", "NOMBRE", "PRODUCTO", "ARTICULO"],
    "descripcion": ["DESCRIPCION", "DESCRIPCION PRODUCTO", "DETALLE", "DESC", "OBSERVACIONES"],
    "precio_mayorista": [
        "PRECIO MAYORISTA", "PRECIO MAYOREO", "PRECIO MAYOR", "MAYORISTA",
        "PRECIO", "PRECIO VENTA", "PVP", "PRECIO LISTA",
    ],
    "precio_especial": ["PRECIO ESPECIAL", "PRECIO PROMOCION", "PRECIO OFERTA", "PRECIO DESCUENTO"],
    "categoria": ["CATEGORIA", "TIPO", "LINEA", "FAMILIA", "CLASE"],
    "color": ["COLOR", "COLORES"],
    "talla": ["TALLA", "TALLAS", "SIZE", "TAMANO"],
}

REQUIRED_FIELDS = ["modelo", "precio_mayorista"]
ALL_FIELDS = list(FIELD_ALIASES.keys())


def _read_dataframe(path):
    if str(path).lower().endswith(".csv"):
        return pd.read_csv(path, dtype=object)
    return pd.read_excel(path, dtype=object, engine="openpyxl")


def detect_columns(columns):
    """Given a list of raw header strings, return {field: column_name or None}."""
    normalized = {col: normalize_key(col) for col in columns}
    mapping = {}
    used = set()

    for field, aliases in FIELD_ALIASES.items():
        alias_keys = [normalize_key(a) for a in aliases]
        match = None
        # 1) exact normalized match
        for col, key in normalized.items():
            if col in used:
                continue
            if key in alias_keys:
                match = col
                break
        # 2) fuzzy match against aliases
        if match is None:
            candidates = [col for col in normalized if col not in used]
            for alias_key in alias_keys:
                close = difflib.get_close_matches(
                    alias_key, [normalized[c] for c in candidates], n=1, cutoff=0.82
                )
                if close:
                    for c in candidates:
                        if normalized[c] == close[0]:
                            match = c
                            break
                if match:
                    break
        if match:
            used.add(match)
        mapping[field] = match
    return mapping


def load_excel(path):
    """Load the spreadsheet and return (dataframe, detected_mapping, row_count)."""
    df = _read_dataframe(path)
    df = df.dropna(how="all")
    mapping = detect_columns(list(df.columns))
    return df, mapping, len(df)


def build_products(df, mapping):
    """Turn the raw dataframe + confirmed column mapping into product dicts."""
    products = []
    for idx, row in df.reset_index(drop=True).iterrows():
        raw = {str(col): (None if pd.isna(val) else val) for col, val in row.items()}

        def get(field):
            col = mapping.get(field)
            if not col or col not in row:
                return None
            val = row[col]
            if pd.isna(val):
                return None
            return val

        codigo = get("codigo")
        sku = get("sku")
        modelo = get("modelo")
        descripcion = get("descripcion")

        codigo = clean_text(codigo) or None if codigo is not None else None
        sku = clean_text(sku) or None if sku is not None else None
        modelo = clean_text(modelo) or None if modelo is not None else None
        descripcion_original = str(descripcion) if descripcion is not None else None
        descripcion_limpia = clean_text(descripcion, fix_case=True) or None if descripcion is not None else None

        # Skip fully-empty rows (no code, no model, no price at all)
        if not any([codigo, sku, modelo, get("precio_mayorista") is not None]):
            continue

        product = {
            "id": f"row-{idx}",
            "codigo": codigo,
            "sku": sku,
            "marca": clean_text(get("marca")) or None,
            "modelo": modelo,
            "descripcion_original": descripcion_original,
            "descripcion": descripcion_limpia,
            "precio_mayorista": parse_price(get("precio_mayorista")),
            "precio_especial": parse_price(get("precio_especial")),
            "categoria": clean_text(get("categoria")) or None,
            "color": clean_text(get("color")) or None,
            "talla": clean_text(get("talla")) or None,
            "raw": raw,
            "fotos": [],
            "foto_principal": None,
            "fotos_secundarias": [],
            "sin_foto": True,
            "oculto": False,
            "precio_visual": None,
            "precio_visual_advertencia": False,
            "layout": "auto",
            "orden": idx,
        }
        products.append(product)
    return products


def validation_summary(products):
    total = len(products)
    visibles = [p for p in products if not p["oculto"]]
    con_precio = sum(1 for p in visibles if p["precio_mayorista"] is not None)
    con_foto = sum(1 for p in visibles if not p["sin_foto"])
    con_codigo = sum(1 for p in visibles if p["codigo"] or p["sku"])
    con_descripcion = sum(1 for p in visibles if p["descripcion"])
    return {
        "total": total,
        "visibles": len(visibles),
        "con_precio": con_precio,
        "sin_precio": len(visibles) - con_precio,
        "con_foto": con_foto,
        "sin_foto": len(visibles) - con_foto,
        "con_codigo": con_codigo,
        "sin_codigo": len(visibles) - con_codigo,
        "con_descripcion": con_descripcion,
        "sin_descripcion": len(visibles) - con_descripcion,
    }
