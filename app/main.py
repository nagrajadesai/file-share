import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routes.files import router as files_router
from app.services.storage import ensure_base

app = FastAPI(title="File Sharing System")

# Ensure storage root exists on startup
ensure_base()

# API routes
app.include_router(files_router)

# Serve frontend static files
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def index():
    return FileResponse(str(STATIC_DIR / "index.html"))


# Catch-all for SPA (any path not matched returns index)
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    # Let /api routes pass through (they're registered above)
    return FileResponse(str(STATIC_DIR / "index.html"))
