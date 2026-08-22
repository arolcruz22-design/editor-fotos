"""Local project persistence. A project is a single JSON file with no
external database: products, associations, edits, config and state.
"""
import json
import os
from datetime import datetime, timezone

DEFAULT_CONFIG = {
    "currency": "L",
    "accent_color": "#F26A1B",
    "background_mode": "PREMIUM_DARK",
    "year": 2026,
}

PROJECTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "projects")


def new_project(name):
    return {
        "name": name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "excel_path": None,
        "photos_folder": None,
        "column_mapping": {},
        "products": [],
        "config": dict(DEFAULT_CONFIG),
        "state": "new",
    }


def project_path(name):
    os.makedirs(PROJECTS_DIR, exist_ok=True)
    safe = "".join(c for c in name if c.isalnum() or c in (" ", "-", "_")).strip() or "proyecto"
    return os.path.join(PROJECTS_DIR, f"{safe}.json")


def save_project(project):
    project["updated_at"] = datetime.now(timezone.utc).isoformat()
    path = project_path(project["name"])
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(project, fh, ensure_ascii=False, indent=2)
    return path


def load_project(name_or_path):
    path = name_or_path if os.path.isabs(name_or_path) else project_path(name_or_path)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def list_projects():
    os.makedirs(PROJECTS_DIR, exist_ok=True)
    items = []
    for fname in sorted(os.listdir(PROJECTS_DIR)):
        if fname.endswith(".json"):
            path = os.path.join(PROJECTS_DIR, fname)
            try:
                with open(path, encoding="utf-8") as fh:
                    data = json.load(fh)
                items.append({
                    "name": data.get("name", fname[:-5]),
                    "path": path,
                    "updated_at": data.get("updated_at"),
                    "product_count": len(data.get("products", [])),
                })
            except (json.JSONDecodeError, OSError):
                continue
    items.sort(key=lambda p: p.get("updated_at") or "", reverse=True)
    return items
