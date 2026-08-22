"""Automatic association between product rows and photo files.

Matching priority (per the spec): codigo -> sku -> modelo -> filename.
A photo can match a product either by being an exact stem match or by
having the product's key as a prefix/contained token (covers the
V001.jpg / V001_1.jpg / V001_lateral.jpg pattern).
"""
import os

from .text_utils import slug

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def list_photos(folder):
    photos = []
    for name in sorted(os.listdir(folder)):
        ext = os.path.splitext(name)[1].lower()
        if ext in IMAGE_EXTENSIONS:
            photos.append({
                "filename": name,
                "path": os.path.join(folder, name),
                "stem_slug": slug(os.path.splitext(name)[0]),
            })
    return photos


def _candidate_keys(product):
    """Ordered (priority, key) pairs to try for this product."""
    keys = []
    if product.get("codigo"):
        keys.append((1, slug(product["codigo"])))
    if product.get("sku"):
        keys.append((2, slug(product["sku"])))
    if product.get("modelo"):
        keys.append((3, slug(product["modelo"])))
        if product.get("marca"):
            keys.append((3, slug(product["marca"]) + slug(product["modelo"])))
    return [(p, k) for p, k in keys if k]


def match_photos(products, photos):
    """Mutates each product in place: sets fotos, foto_principal,
    fotos_secundarias, sin_foto. Returns the set of matched photo paths."""
    used_paths = set()

    for product in products:
        candidates = _candidate_keys(product)
        matches = []  # (priority, match_kind_rank, filename, photo)
        for priority, key in candidates:
            for photo in photos:
                stem = photo["stem_slug"]
                if not stem:
                    continue
                if stem == key:
                    matches.append((priority, 0, photo["filename"], photo))
                elif stem.startswith(key) and (
                    len(stem) == len(key) or not stem[len(key)].isalnum()
                ):
                    matches.append((priority, 1, photo["filename"], photo))
                elif key in stem and len(key) >= 3:
                    matches.append((priority, 2, photo["filename"], photo))

        # Deduplicate by path, keep best (lowest priority number, lowest rank)
        best_by_path = {}
        for priority, rank, filename, photo in matches:
            path = photo["path"]
            score = (priority, rank)
            if path not in best_by_path or score < best_by_path[path][0]:
                best_by_path[path] = (score, filename, photo)

        ordered = sorted(best_by_path.values(), key=lambda item: (item[0], item[1]))
        product_photos = [
            {"path": item[2]["path"], "filename": item[1]}
            for item in ordered
        ]

        product["fotos"] = product_photos
        if product_photos:
            product["foto_principal"] = product_photos[0]["path"]
            product["fotos_secundarias"] = [p["path"] for p in product_photos[1:4]]
            product["sin_foto"] = False
            for p in product_photos:
                used_paths.add(p["path"])
        else:
            product["foto_principal"] = None
            product["fotos_secundarias"] = []
            product["sin_foto"] = True

    return used_paths


def unassigned_photos(photos, used_paths):
    return [p for p in photos if p["path"] not in used_paths]
