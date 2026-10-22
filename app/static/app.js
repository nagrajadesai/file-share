/* ═══════════════════════════════════════════════════════════
   FileShare — Frontend Application
   ═══════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────
const state = {
  currentPath: '',
  viewMode: 'grid',        // 'grid' | 'list'
  selected: new Set(),     // Set of rel paths
  contextTarget: null,     // item under context menu
  searchMode: false,
};

// ── DOM refs ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fileGrid      = $('fileGrid');
const loading       = $('loading');
const emptyState    = $('emptyState');
const breadcrumb    = $('breadcrumb');
const toolbar       = $('toolbar');
const selectedCount = $('selectedCount');
const searchInput   = $('searchInput');
const clearSearch   = $('clearSearch');
const dropOverlay   = $('dropOverlay');
const uploadPanel   = $('uploadPanel');
const uploadList    = $('uploadList');
const newMenu       = $('newMenu');
const contextMenu   = $('contextMenu');
const viewIcon      = $('viewIcon');

// ── API helpers ─────────────────────────────────────────────
async function api(method, path, params = {}, body = null) {
  const url = new URL(path, location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const opts = { method };
  if (body) opts.body = body;
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

// ── Navigation ──────────────────────────────────────────────
function navigateTo(path) {
  state.currentPath = path;
  state.selected.clear();
  state.searchMode = false;
  searchInput.value = '';
  clearSearch.style.display = 'none';
  loadDirectory(path);
}

async function loadDirectory(path) {
  showLoading(true);
  try {
    const data = await api('GET', '/api/list', { path });
    renderBreadcrumb(data.breadcrumb);
    renderItems(data.items);
  } catch (e) {
    toast('error', e.message);
    showLoading(false);
  }
}

// ── Render ──────────────────────────────────────────────────
function renderBreadcrumb(parts) {
  breadcrumb.innerHTML = '';
  const home = document.createElement('span');
  home.className = 'bc-item bc-home';
  home.innerHTML = `<span class="material-icons bc-icon">home</span> My Files`;
  home.onclick = () => navigateTo('');
  breadcrumb.appendChild(home);

  parts.forEach(p => {
    const sep = document.createElement('span');
    sep.className = 'bc-separator material-icons';
    sep.textContent = 'chevron_right';
    breadcrumb.appendChild(sep);

    const item = document.createElement('span');
    item.className = 'bc-item';
    item.textContent = p.name;
    item.onclick = () => navigateTo(p.path);
    breadcrumb.appendChild(item);
  });
}

function renderItems(items) {
  showLoading(false);
  fileGrid.innerHTML = '';
  fileGrid.className = `file-grid${state.viewMode === 'list' ? ' list-view' : ''}`;

  if (!items || items.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  items.forEach(item => {
    const el = state.viewMode === 'grid' ? makeCard(item) : makeRow(item);
    fileGrid.appendChild(el);
  });
  updateToolbar();
}

function makeCard(item) {
  const card = document.createElement('div');
  card.className = 'file-card' + (state.selected.has(item.path) ? ' selected' : '');
  card.dataset.path = item.path;
  card.dataset.type = item.type;
  card.dataset.name = item.name;

  const icon = fileIcon(item, 48);
  const check = `<div class="card-check"><span class="material-icons">check</span></div>`;
  const menuBtn = `<button class="card-menu-btn" title="More options">
    <span class="material-icons">more_vert</span></button>`;

  card.innerHTML = `
    ${check}
    ${menuBtn}
    <span class="file-icon">${icon}</span>
    <span class="file-name" title="${escHtml(item.name)}">${escHtml(item.name)}</span>
    <span class="file-meta">${item.type === 'file' ? formatSize(item.size) : 'Folder'}</span>
  `;

  card.addEventListener('click', e => {
    if (e.target.closest('.card-menu-btn')) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      toggleSelect(item.path);
    } else if (item.type === 'folder') {
      navigateTo(item.path);
    } else {
      // Single click on file — select
      toggleSelect(item.path);
    }
  });
  card.addEventListener('dblclick', e => {
    if (item.type === 'file') downloadFile(item.path, item.name);
  });
  card.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e, item);
  });
  card.querySelector('.card-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    showContextMenu(e, item, true);
  });

  return card;
}

function makeRow(item) {
  const row = document.createElement('div');
  row.className = 'file-row' + (state.selected.has(item.path) ? ' selected' : '');
  row.dataset.path = item.path;
  row.dataset.type = item.type;
  row.dataset.name = item.name;

  const icon = fileIcon(item, 24);
  row.innerHTML = `
    <span class="row-icon">${icon}</span>
    <span class="row-name" title="${escHtml(item.name)}">${escHtml(item.name)}</span>
    <span class="row-meta">${item.type === 'file' ? formatSize(item.size) : 'Folder'}</span>
    <span class="row-meta">${formatDate(item.modified)}</span>
    <button class="row-menu-btn icon-btn" title="More options">
      <span class="material-icons" style="font-size:18px">more_vert</span>
    </button>
  `;

  row.addEventListener('click', e => {
    if (e.target.closest('.row-menu-btn')) return;
    if (e.ctrlKey || e.metaKey) {
      toggleSelect(item.path);
    } else if (item.type === 'folder') {
      navigateTo(item.path);
    } else {
      toggleSelect(item.path);
    }
  });
  row.addEventListener('dblclick', () => {
    if (item.type === 'file') downloadFile(item.path, item.name);
  });
  row.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e, item);
  });
  row.querySelector('.row-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    showContextMenu(e, item, true);
  });

  return row;
}

function fileIcon(item, size) {
  if (item.type === 'folder') return `<span class="material-icons" style="font-size:${size}px;color:#fbbc04">folder</span>`;
  const ext = item.name.split('.').pop().toLowerCase();
  const icons = {
    pdf: ['picture_as_pdf', '#ea4335'],
    jpg: ['image', '#34a853'], jpeg: ['image', '#34a853'], png: ['image', '#34a853'],
    gif: ['gif', '#34a853'], svg: ['image', '#34a853'], webp: ['image', '#34a853'],
    mp4: ['movie', '#1a73e8'], mov: ['movie', '#1a73e8'], avi: ['movie', '#1a73e8'],
    mp3: ['audio_file', '#9334e6'], wav: ['audio_file', '#9334e6'],
    zip: ['folder_zip', '#f29900'], rar: ['folder_zip', '#f29900'], '7z': ['folder_zip', '#f29900'],
    doc: ['description', '#4285f4'], docx: ['description', '#4285f4'],
    xls: ['table_chart', '#34a853'], xlsx: ['table_chart', '#34a853'],
    ppt: ['slideshow', '#ea4335'], pptx: ['slideshow', '#ea4335'],
    txt: ['article', '#5f6368'], md: ['article', '#5f6368'],
    js: ['code', '#f29900'], py: ['code', '#3572A5'], html: ['code', '#e34c26'],
    css: ['code', '#563d7c'], json: ['data_object', '#5f6368'],
  };
  const [ico, color] = icons[ext] || ['insert_drive_file', '#5f6368'];
  return `<span class="material-icons" style="font-size:${size}px;color:${color}">${ico}</span>`;
}

// ── Selection ────────────────────────────────────────────────
function toggleSelect(path) {
  if (state.selected.has(path)) {
    state.selected.delete(path);
  } else {
    state.selected.add(path);
  }
  document.querySelectorAll(`[data-path="${CSS.escape(path)}"]`).forEach(el => {
    el.classList.toggle('selected', state.selected.has(path));
  });
  updateToolbar();
}

function updateToolbar() {
  const n = state.selected.size;
  toolbar.style.display = n > 0 ? 'flex' : 'none';
  selectedCount.textContent = `${n} selected`;
}

// ── Context Menu ─────────────────────────────────────────────
function showContextMenu(e, item, fromBtn = false) {
  state.contextTarget = item;
  contextMenu.classList.add('open');

  // Show download for both files and folders (folders download as ZIP)
  $('ctxDownload').style.display = 'flex';
  $('ctxDownload').innerHTML = item.type === 'folder'
    ? '<span class="material-icons">folder_zip</span> Download as ZIP'
    : '<span class="material-icons">download</span> Download';  let x = e.clientX, y = e.clientY;
  if (fromBtn) {
    const r = e.currentTarget.getBoundingClientRect();
    x = r.left; y = r.bottom;
  }
  contextMenu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  contextMenu.style.top  = Math.min(y, window.innerHeight - 160) + 'px';
}

document.addEventListener('click', () => contextMenu.classList.remove('open'));

$('ctxDownload').addEventListener('click', () => {
  if (!state.contextTarget) return;
  const item = state.contextTarget;
  if (item.type === 'folder') {
    downloadFolder(item.path, item.name);
  } else {
    downloadFile(item.path, item.name);
  }
});
$('ctxCopyLink').addEventListener('click', () => {
  if (!state.contextTarget) return;
  const url = `${location.origin}/api/download?path=${encodeURIComponent(state.contextTarget.path)}`;
  navigator.clipboard.writeText(url).then(() => toast('success', 'Link copied!'));
});
$('ctxDelete').addEventListener('click', () => {
  if (state.contextTarget) confirmDelete([state.contextTarget]);
});

// ── Delete ───────────────────────────────────────────────────
let pendingDelete = [];

function confirmDelete(items) {
  pendingDelete = items;
  const names = items.map(i => i.dataset?.name || i.name).join(', ');
  $('deleteMsg').textContent = `Delete "${names}"? This cannot be undone.`;
  $('deleteModal').classList.add('open');
}

$('cancelDelete').addEventListener('click', () => $('deleteModal').classList.remove('open'));
$('confirmDelete').addEventListener('click', async () => {
  $('deleteModal').classList.remove('open');
  for (const item of pendingDelete) {
    const path = item.path || item.dataset?.path;
    try {
      await api('DELETE', '/api/delete', { path });
    } catch (e) {
      toast('error', `Delete failed: ${e.message}`);
    }
  }
  state.selected.clear();
  toast('success', 'Deleted successfully');
  if (state.searchMode) runSearch(searchInput.value);
  else loadDirectory(state.currentPath);
});

$('bulkDeleteBtn').addEventListener('click', () => {
  const items = [...state.selected].map(path => ({ path, name: path.split('/').pop() }));
  if (items.length) confirmDelete(items);
});

// ── Create Folder ────────────────────────────────────────────
$('createFolderBtn').addEventListener('click', () => {
  newMenu.classList.remove('open');
  $('folderNameInput').value = 'Untitled folder';
  $('folderModal').classList.add('open');
  setTimeout(() => { $('folderNameInput').select(); }, 50);
});
$('cancelFolder').addEventListener('click', () => $('folderModal').classList.remove('open'));
$('confirmFolder').addEventListener('click', createFolder);
$('folderNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') createFolder(); });

async function createFolder() {
  const name = $('folderNameInput').value.trim();
  if (!name) return;
  const path = state.currentPath ? `${state.currentPath}/${name}` : name;
  $('folderModal').classList.remove('open');
  try {
    await api('POST', '/api/folder', { path });
    toast('success', `Folder "${name}" created`);
    loadDirectory(state.currentPath);
  } catch (e) {
    toast('error', e.message);
  }
}

// ── Upload ───────────────────────────────────────────────────
$('uploadFileBtn').addEventListener('click', () => {
  newMenu.classList.remove('open');
  $('fileInput').click();
});
$('uploadFolderBtn').addEventListener('click', () => {
  newMenu.classList.remove('open');
  $('folderInput').click();
});
$('fileInput').addEventListener('change', e => handleUpload(e.target.files));
$('folderInput').addEventListener('change', e => handleUpload(e.target.files));

async function handleUpload(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = [...fileList];

  // Show upload panel
  uploadPanel.style.display = 'block';
  uploadList.innerHTML = '';
  $('uploadPanelTitle').textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`;

  // Group files by their relative directory (for folder uploads)
  const groups = {};
  for (const f of files) {
    // webkitRelativePath = "folderName/sub/file.txt" or "" for plain files
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/');
    const dirParts = parts.slice(0, -1);
    const targetDir = dirParts.length
      ? (state.currentPath ? `${state.currentPath}/${dirParts.join('/')}` : dirParts.join('/'))
      : state.currentPath;
    if (!groups[targetDir]) groups[targetDir] = [];
    groups[targetDir].push(f);
  }

  let allOk = true;
  for (const [dir, groupFiles] of Object.entries(groups)) {
    const fd = new FormData();
    for (const f of groupFiles) fd.append('files', f);

    // Add UI rows
    for (const f of groupFiles) {
      const row = document.createElement('div');
      row.className = 'upload-item';
      row.id = `up-${f.name}-${Math.random().toString(36).slice(2)}`;
      row.innerHTML = `
        <span class="material-icons" style="color:var(--primary)">upload_file</span>
        <span class="name">${escHtml(f.name)}</span>
        <span class="status">Uploading…</span>
      `;
      uploadList.appendChild(row);
    }

    try {
      await api('POST', '/api/upload', { path: dir }, fd);
      // mark done
      uploadList.querySelectorAll('.status').forEach(s => { s.textContent = 'Done ✓'; });
    } catch (e) {
      allOk = false;
      uploadList.querySelectorAll('.status').forEach(s => { s.style.color = 'var(--danger)'; s.textContent = 'Error'; });
    }
  }

  $('uploadPanelTitle').textContent = allOk ? 'Upload complete' : 'Upload failed (some errors)';
  toast(allOk ? 'success' : 'error', allOk ? 'Upload complete!' : 'Some files failed to upload');

  // Reset file inputs
  $('fileInput').value = '';
  $('folderInput').value = '';

  loadDirectory(state.currentPath);
  setTimeout(() => { if (allOk) uploadPanel.style.display = 'none'; }, 3000);
}

$('closeUploadPanel').addEventListener('click', () => uploadPanel.style.display = 'none');

// ── Download ─────────────────────────────────────────────────
function downloadFile(path, name) {
  const a = document.createElement('a');
  a.href = `/api/download?path=${encodeURIComponent(path)}`;
  a.download = name;
  a.click();
}

function downloadFolder(path, name) {
  toast('info', `Zipping "${name}"…`);
  const a = document.createElement('a');
  a.href = `/api/download-folder?path=${encodeURIComponent(path)}`;
  a.download = `${name}.zip`;
  a.click();
}

// ── Drag and Drop ────────────────────────────────────────────
const contentEl = document.querySelector('.content');
let dragCounter = 0;

contentEl.addEventListener('dragenter', e => {
  e.preventDefault();
  dragCounter++;
  dropOverlay.classList.add('active');
});
contentEl.addEventListener('dragleave', () => {
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.remove('active'); }
});
contentEl.addEventListener('dragover', e => e.preventDefault());
contentEl.addEventListener('drop', e => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('active');
  if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
});

// ── Search ───────────────────────────────────────────────────
let searchDebounce;
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearSearch.style.display = q ? 'block' : 'none';
  clearTimeout(searchDebounce);
  if (!q) { state.searchMode = false; navigateTo(state.currentPath); return; }
  searchDebounce = setTimeout(() => runSearch(q), 300);
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  clearSearch.style.display = 'none';
  state.searchMode = false;
  navigateTo(state.currentPath);
});

async function runSearch(q) {
  state.searchMode = true;
  showLoading(true);
  breadcrumb.innerHTML = `<span class="bc-item"><span class="material-icons bc-icon">search</span> Results for "${escHtml(q)}"</span>`;
  try {
    const data = await api('GET', '/api/search', { q });
    renderItems(data.results);
  } catch (e) {
    toast('error', e.message);
    showLoading(false);
  }
}

// ── View toggle ──────────────────────────────────────────────
$('toggleView').addEventListener('click', () => {
  state.viewMode = state.viewMode === 'grid' ? 'list' : 'grid';
  viewIcon.textContent = state.viewMode === 'grid' ? 'grid_view' : 'view_list';
  if (state.searchMode) runSearch(searchInput.value);
  else loadDirectory(state.currentPath);
});

// ── New menu ─────────────────────────────────────────────────
$('openNewMenu').addEventListener('click', e => {
  e.stopPropagation();
  newMenu.classList.toggle('open');
});
document.addEventListener('click', () => newMenu.classList.remove('open'));

// ── Helpers ──────────────────────────────────────────────────
function showLoading(show) {
  loading.style.display = show ? 'flex' : 'none';
  fileGrid.style.display = show ? 'none' : '';
  if (show) emptyState.style.display = 'none';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toast(type, msg) {
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="material-icons toast-icon">${icons[type] || 'info'}</span>${escHtml(msg)}`;
  $('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── Keyboard shortcuts ───────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    state.selected.clear();
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    updateToolbar();
    contextMenu.classList.remove('open');
    $('folderModal').classList.remove('open');
    $('deleteModal').classList.remove('open');
  }
  if (e.key === 'Delete' && state.selected.size > 0) {
    const items = [...state.selected].map(path => ({ path, name: path.split('/').pop() }));
    confirmDelete(items);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    document.querySelectorAll('[data-path]').forEach(el => {
      state.selected.add(el.dataset.path);
      el.classList.add('selected');
    });
    updateToolbar();
  }
});

// ── Init ─────────────────────────────────────────────────────
navigateTo('');
