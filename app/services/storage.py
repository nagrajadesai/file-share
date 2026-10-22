"""
Filesystem service — all operations are sandboxed inside BASE_DIR.
"""

import io
import os
import shutil
import zipfile
from pathlib import Path
from typing import Generator

BASE_DIR = Path(os.getenv("STORAGE_PATH", "./data")).resolve()


def _safe_path(rel: str) -> Path:
    """Resolve a relative path and ensure it stays inside BASE_DIR."""
    # Strip leading slashes so Path doesn't treat it as absolute
    rel = rel.lstrip("/\\")
    full = (BASE_DIR / rel).resolve()
    if not str(full).startswith(str(BASE_DIR)):
        raise PermissionError("Path escapes storage root")
    return full


def ensure_base():
    BASE_DIR.mkdir(parents=True, exist_ok=True)


# ── Listing ────────────────────────────────────────────────────────────────

def list_directory(rel_path: str = "") -> dict:
    target = _safe_path(rel_path)
    if not target.exists():
        raise FileNotFoundError(f"Path not found: {rel_path!r}")
    if not target.is_dir():
        raise NotADirectoryError(f"Not a directory: {rel_path!r}")

    items = []
    for entry in sorted(target.iterdir(), key=lambda e: (e.is_file(), e.name.lower())):
        rel = entry.relative_to(BASE_DIR).as_posix()
        items.append({
            "name": entry.name,
            "path": rel,
            "type": "file" if entry.is_file() else "folder",
            "size": entry.stat().st_size if entry.is_file() else None,
            "modified": entry.stat().st_mtime,
        })

    # Build breadcrumb
    parts = Path(rel_path.strip("/")).parts if rel_path.strip("/") else []
    breadcrumb = []
    for i, part in enumerate(parts):
        breadcrumb.append({
            "name": part,
            "path": "/".join(parts[: i + 1]),
        })

    return {"path": rel_path.strip("/"), "items": items, "breadcrumb": breadcrumb}


# ── Folder ──────────────────────────────────────────────────────────────────

def create_folder(rel_path: str) -> dict:
    target = _safe_path(rel_path)
    if target.exists():
        raise FileExistsError(f"Already exists: {rel_path!r}")
    target.mkdir(parents=True)
    return {"created": rel_path}


# ── Upload ──────────────────────────────────────────────────────────────────

def save_file(rel_dir: str, filename: str, data: bytes) -> dict:
    dest_dir = _safe_path(rel_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    # Sanitise filename
    safe_name = Path(filename).name
    dest = dest_dir / safe_name
    dest.write_bytes(data)
    rel = dest.relative_to(BASE_DIR).as_posix()
    return {"path": rel, "name": safe_name, "size": len(data)}


# ── Download ────────────────────────────────────────────────────────────────

def resolve_file(rel_path: str) -> Path:
    target = _safe_path(rel_path)
    if not target.exists():
        raise FileNotFoundError(f"File not found: {rel_path!r}")
    if not target.is_file():
        raise IsADirectoryError(f"Path is a directory: {rel_path!r}")
    return target


# ── Delete ──────────────────────────────────────────────────────────────────

def delete_path(rel_path: str) -> dict:
    target = _safe_path(rel_path)
    if not target.exists():
        raise FileNotFoundError(f"Path not found: {rel_path!r}")
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return {"deleted": rel_path}


# ── Zip folder ──────────────────────────────────────────────────────────────

def zip_folder(rel_path: str) -> tuple[io.BytesIO, str]:
    """Return an in-memory ZIP of the folder and the suggested filename."""
    target = _safe_path(rel_path)
    if not target.exists():
        raise FileNotFoundError(f"Path not found: {rel_path!r}")
    if not target.is_file():
        pass  # expected: it's a directory
    if target.is_file():
        raise NotADirectoryError(f"Not a directory: {rel_path!r}")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file in target.rglob("*"):
            if file.is_file():
                arcname = file.relative_to(target.parent).as_posix()
                zf.write(file, arcname)
    buf.seek(0)
    zip_name = f"{target.name}.zip"
    return buf, zip_name


# ── Search ──────────────────────────────────────────────────────────────────

def search_files(query: str) -> list:
    query = query.lower()
    results = []
    for root, dirs, files in os.walk(BASE_DIR):
        for name in dirs + files:
            if query in name.lower():
                full = Path(root) / name
                rel = full.relative_to(BASE_DIR).as_posix()
                results.append({
                    "name": name,
                    "path": rel,
                    "type": "file" if full.is_file() else "folder",
                    "size": full.stat().st_size if full.is_file() else None,
                    "modified": full.stat().st_mtime,
                })
    return results
