from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from typing import List
from app.services import storage

router = APIRouter(prefix="/api")


@router.get("/list")
async def list_dir(path: str = Query(default="")):
    try:
        return storage.list_directory(path)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except NotADirectoryError as e:
        raise HTTPException(400, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.post("/upload")
async def upload_files(
    path: str = Query(default=""),
    files: List[UploadFile] = File(...),
):
    saved = []
    for f in files:
        data = await f.read()
        try:
            result = storage.save_file(path, f.filename or "upload", data)
            saved.append(result)
        except PermissionError as e:
            raise HTTPException(403, str(e))
    return {"uploaded": saved}


@router.post("/folder")
async def create_folder(path: str = Query(...)):
    try:
        return storage.create_folder(path)
    except FileExistsError as e:
        raise HTTPException(409, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.get("/download")
async def download_file(path: str = Query(...)):
    try:
        file_path = storage.resolve_file(path)
        return FileResponse(
            path=str(file_path),
            filename=file_path.name,
            media_type="application/octet-stream",
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except IsADirectoryError as e:
        raise HTTPException(400, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.get("/download-folder")
async def download_folder(path: str = Query(...)):
    try:
        buf, zip_name = storage.zip_folder(path)
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except NotADirectoryError as e:
        raise HTTPException(400, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.delete("/delete")
async def delete_item(path: str = Query(...)):
    try:
        return storage.delete_path(path)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.get("/search")
async def search(q: str = Query(...)):
    return {"results": storage.search_files(q)}
