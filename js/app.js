/* ============================================================
   Concept Vault — Google Drive edition
   Reads your Drive folder structure live via the Drive API,
   so adding a category, model-type, or image is just:
   drop it into the right Drive folder from your phone or desktop.
   ============================================================ */

const PALETTE = ["c-blue", "c-red", "c-gold", "c-green", "c-purple", "c-teal"];
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

const els = {
  tabs: document.getElementById("tabs"),
  pageTitle: document.getElementById("pageTitle"),
  crumbs: document.getElementById("crumbs"),
  stateMsg: document.getElementById("stateMsg"),
  folderGrid: document.getElementById("folderGrid"),
  imageGrid: document.getElementById("imageGrid"),
  lightbox: document.getElementById("lightbox"),
  lbImage: document.getElementById("lbImage"),
  lbCaption: document.getElementById("lbCaption"),
  lbClose: document.getElementById("lbClose"),
  lbPrev: document.getElementById("lbPrev"),
  lbNext: document.getElementById("lbNext"),
};

const state = {
  categories: [],      // [{ id, name, color }]
  activeCategory: null,
  activeFolder: null,
  currentImages: [],
  lightboxIndex: 0,
};

els.pageTitle.textContent = CONFIG.siteTitle || "CONCEPT VAULT";

/* ------------------------------------------------------------
   DRIVE API HELPERS
   ------------------------------------------------------------ */
async function driveList(query, fields) {
  let results = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: query,
      fields: `nextPageToken, files(${fields})`,
      key: CONFIG.apiKey,
      pageSize: "200",
      orderBy: "name_natural",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${DRIVE_API}?${params.toString()}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const reason = body?.error?.errors?.[0]?.reason || "";
      if (res.status === 403 && reason === "rateLimitExceeded") throw new Error("RATE_LIMIT");
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (res.status === 400) throw new Error("BAD_KEY");
      throw new Error("FETCH_FAILED");
    }
    const data = await res.json();
    results = results.concat(data.files || []);
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return results;
}

function listSubfolders(parentId) {
  return driveList(`'${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`, "id,name");
}

function listImages(parentId) {
  return driveList(`'${parentId}' in parents and mimeType contains 'image/' and trashed=false`, "id,name,thumbnailLink");
}

function thumbAt(file, size) {
  // Drive thumbnailLink ends in "=s220" (or similar) — swap the size.
  if (!file.thumbnailLink) return "";
  return file.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
}

function colorFor(name, index) {
  const override = (CONFIG.categoryColors || {})[name.toLowerCase()];
  const map = { blue: "c-blue", red: "c-red", gold: "c-gold", green: "c-green", purple: "c-purple", teal: "c-teal" };
  if (override && map[override]) return map[override];
  return PALETTE[index % PALETTE.length];
}

function setState(msg) {
  els.stateMsg.hidden = false;
  els.stateMsg.innerHTML = msg;
  els.folderGrid.hidden = true;
  els.imageGrid.hidden = true;
  els.folderGrid.innerHTML = "";
  els.imageGrid.innerHTML = "";
}
function clearState() { els.stateMsg.hidden = true; }

function handleError(err) {
  if (err.message === "RATE_LIMIT") {
    setState(`Google's API rate limit was hit. Wait a bit and reload.`);
  } else if (err.message === "BAD_KEY") {
    setState(`Google rejected the request. Double check <b>apiKey</b> and <b>rootFolderId</b> in <code>js/config.js</code>, and that the Drive API is enabled for that key.`);
  } else if (err.message === "FORBIDDEN") {
    setState(`Access denied. Make sure the Drive folder is shared as <b>"Anyone with the link → Viewer"</b>, and that your API key's HTTP referrer restriction includes this site's URL.`);
  } else {
    setState(`Couldn't reach Google Drive. Check your internet connection and the values in <code>js/config.js</code>.`);
  }
}

/* ------------------------------------------------------------
   INIT — load top-level categories
   ------------------------------------------------------------ */
async function init() {
  if (!CONFIG.apiKey || CONFIG.apiKey.startsWith("YOUR_") || !CONFIG.rootFolderId || CONFIG.rootFolderId.startsWith("YOUR_")) {
    setState(`Set <b>apiKey</b> and <b>rootFolderId</b> in <code>js/config.js</code> first — see <code>README.md</code> for how to get them.`);
    return;
  }

  setState("Loading your archive…");
  try {
    const dirs = await listSubfolders(CONFIG.rootFolderId);

    if (dirs.length === 0) {
      setState(`No category folders found yet.<br><br>Inside your root Drive folder, create a folder for each category (e.g. <b>cars</b>, <b>guns</b>), then a subfolder for each model type, and drop your images in. Reload after.`);
      return;
    }

    state.categories = dirs.map((d, i) => ({ id: d.id, name: d.name, color: colorFor(d.name, i) }));
    renderTabs();
    selectCategory(state.categories[0]);
  } catch (err) {
    handleError(err);
  }
}

/* ------------------------------------------------------------
   TABS (categories)
   ------------------------------------------------------------ */
function renderTabs() {
  els.tabs.innerHTML = "";
  state.categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.style.setProperty("--tab-color", `var(--${cat.color})`);
    btn.dataset.id = cat.id;
    btn.innerHTML = `
      <span class="tab-icon">${escapeHtml(cat.name.charAt(0))}</span>
      <span class="tab-text">
        <span class="tab-label">${escapeHtml(cat.name)}</span>
        <span class="tab-count" data-count></span>
      </span>
    `;
    btn.addEventListener("click", () => selectCategory(cat));
    els.tabs.appendChild(btn);
  });
}

function markActiveTab(id) {
  [...els.tabs.children].forEach(t => t.classList.toggle("active", t.dataset.id === id));
}

/* ------------------------------------------------------------
   CATEGORY → list of model-type folders
   ------------------------------------------------------------ */
async function selectCategory(cat) {
  state.activeCategory = cat;
  state.activeFolder = null;
  markActiveTab(cat.id);
  renderCrumbs();
  setState("Loading folders…");

  try {
    const dirs = await listSubfolders(cat.id);

    if (dirs.length === 0) {
      setState(`No model-type folders in <b>${escapeHtml(cat.name)}</b> yet.<br><br>Add a subfolder inside it for each model type (e.g. <b>super-car</b>, <b>offroad</b>) and drop images in.`);
      return;
    }

    clearState();
    els.folderGrid.hidden = false;
    els.imageGrid.hidden = true;
    els.folderGrid.innerHTML = "";

    const tabBtn = [...els.tabs.children].find(t => t.dataset.id === cat.id);
    const countEl = tabBtn?.querySelector("[data-count]");
    if (countEl) countEl.textContent = `${dirs.length} folder${dirs.length === 1 ? "" : "s"}`;

    for (const dir of dirs) {
      const card = document.createElement("button");
      card.className = "folder";
      card.innerHTML = `
        <span class="folder-swatch" style="background:var(--${cat.color})"></span>
        <div>
          <div class="folder-name">${escapeHtml(dir.name)}</div>
          <div class="folder-meta">…</div>
        </div>
      `;
      card.addEventListener("click", () => selectFolder(cat, dir));
      els.folderGrid.appendChild(card);

      listImages(dir.id).then(files => {
        card.querySelector(".folder-meta").textContent = `${files.length} image${files.length === 1 ? "" : "s"}`;
      }).catch(() => {
        card.querySelector(".folder-meta").textContent = "—";
      });
    }
  } catch (err) {
    handleError(err);
  }
}

/* ------------------------------------------------------------
   FOLDER → list of images
   ------------------------------------------------------------ */
async function selectFolder(cat, dir) {
  state.activeFolder = dir;
  renderCrumbs();
  setState("Loading images…");

  try {
    const files = await listImages(dir.id);

    if (files.length === 0) {
      setState(`No images in <b>${escapeHtml(dir.name)}</b> yet.<br><br>Drop image files into that Drive folder and reload.`);
      return;
    }

    state.currentImages = files.map(f => ({
      name: f.name,
      gridUrl: thumbAt(f, CONFIG.gridThumbSize || 500),
      fullUrl: thumbAt(f, CONFIG.lightboxThumbSize || 1800),
    }));

    clearState();
    els.folderGrid.hidden = true;
    els.imageGrid.hidden = false;
    els.imageGrid.innerHTML = "";

    state.currentImages.forEach((img, i) => {
      const cell = document.createElement("button");
      cell.className = "thumb";
      cell.innerHTML = `<img src="${img.gridUrl}" alt="${escapeHtml(img.name)}" loading="lazy"><span class="thumb-name">${escapeHtml(img.name)}</span>`;
      cell.addEventListener("click", () => openLightbox(i));
      els.imageGrid.appendChild(cell);
    });
  } catch (err) {
    handleError(err);
  }
}

/* ------------------------------------------------------------
   BREADCRUMBS
   ------------------------------------------------------------ */
function renderCrumbs() {
  const parts = [`<span class="crumb" data-target="root">index</span>`];
  if (state.activeCategory) {
    parts.push(`<span class="sep">/</span>`);
    parts.push(state.activeFolder
      ? `<span class="crumb" data-target="category">${escapeHtml(state.activeCategory.name)}</span>`
      : `<span class="current">${escapeHtml(state.activeCategory.name)}</span>`);
  }
  if (state.activeFolder) {
    parts.push(`<span class="sep">/</span>`);
    parts.push(`<span class="current">${escapeHtml(state.activeFolder.name)}</span>`);
  }
  els.crumbs.innerHTML = parts.join("");

  els.crumbs.querySelectorAll(".crumb").forEach(el => {
    el.addEventListener("click", () => {
      if (el.dataset.target === "root" || el.dataset.target === "category") {
        selectCategory(state.activeCategory);
      }
    });
  });
}

/* ------------------------------------------------------------
   LIGHTBOX
   ------------------------------------------------------------ */
function openLightbox(index) {
  state.lightboxIndex = index;
  renderLightbox();
  els.lightbox.hidden = false;
}
function closeLightbox() { els.lightbox.hidden = true; }

function renderLightbox() {
  const img = state.currentImages[state.lightboxIndex];
  els.lbImage.src = img.fullUrl;
  els.lbImage.alt = img.name;
  els.lbCaption.textContent = `${state.activeCategory.name} / ${state.activeFolder.name} / ${img.name}`;
}
function stepLightbox(delta) {
  const n = state.currentImages.length;
  state.lightboxIndex = (state.lightboxIndex + delta + n) % n;
  renderLightbox();
}

els.lbClose.addEventListener("click", closeLightbox);
els.lbPrev.addEventListener("click", () => stepLightbox(-1));
els.lbNext.addEventListener("click", () => stepLightbox(1));
els.lightbox.addEventListener("click", (e) => { if (e.target === els.lightbox) closeLightbox(); });
document.addEventListener("keydown", (e) => {
  if (els.lightbox.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") stepLightbox(-1);
  if (e.key === "ArrowRight") stepLightbox(1);
});

/* ------------------------------------------------------------
   UTIL
   ------------------------------------------------------------ */
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

init();
