# FileShare

A lightweight, self-hosted Google Drive-like file sharing system.

## Docker Hub

Image: **[nagrajdesai/fileshare:v1.0.0](https://hub.docker.com/r/nagrajdesai/fileshare)**

## Run from Docker Hub

**Quick run** (stores files in `./data` in your current directory):
```bash
docker run -d -p 8000:8000 -v ${PWD}/data:/data --name fileshare nagrajdesai/fileshare:v1.0.0
```

**Attach any local folder as storage:**
```bash
# Windows
docker run -d -p 8000:8000 -v C:\your\folder:/data --name fileshare nagrajdesai/fileshare:v1.0.0

# macOS / Linux
docker run -d -p 8000:8000 -v /your/folder:/data --name fileshare nagrajdesai/fileshare:v1.0.0
```

**Using docker-compose:**
```yaml
services:
  fileshare:
    image: nagrajdesai/fileshare:v1.0.0
    ports:
      - "8000:8000"
    volumes:
      - ./data:/data   # Change ./data to any local path you want
    restart: unless-stopped
```
```bash
docker-compose up -d
```

Once running, open **http://localhost:8000** in your browser.  
To share with others on the same network, use `http://<your-ip>:8000`.

---

## Features
- 📁 Browse files and folders
- 📤 Upload files (drag & drop supported)
- 📂 Upload entire folders (preserves structure)
- 🗂️ Create nested folders
- 📥 Download any file
- 🗜️ Download any folder as ZIP
- 🔗 Copy shareable direct download links
- 🗑️ Delete files and folders
- 🔍 Search by filename
- 📋 Grid and list views
- ⌨️ Keyboard shortcuts (Ctrl+A, Delete, Escape)

---

## Build from Source

```bash
git clone <repo-url>
cd file-sharing-system

# Local dev
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Build Docker image
docker build -t fileshare .
docker run -d -p 8000:8000 -v ${PWD}/data:/data --name fileshare fileshare
```

---

## Container Management

```bash
# View logs
docker logs fileshare

# Stop
docker stop fileshare

# Start again
docker start fileshare

# Remove container
docker rm -f fileshare
```

> Files are stored in the mounted volume and persist even if the container is stopped or removed.
