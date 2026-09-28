import "./style.css";

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";

import { loadEntries, saveEntries } from "./storage.js";
import { toRoman } from "./roman.js";
import { exportDocx } from "./docxExport.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  newBtn: $("#newBtn"),
  searchInput: $("#searchInput"),
  entryList: $("#entryList"),
  entryCount: $("#entryCount"),
  saveStatus: $("#saveStatus"),
  headerTitle: $("#headerTitle"),
  titleInput: $("#titleInput"),
  toolbar: $("#toolbar"),
  saveBtn: $("#saveBtn"),
  deleteBtn: $("#deleteBtn"),
  duplicateBtn: $("#duplicateBtn"),
  exportBtn: $("#exportBtn"),
  previewBtn: $("#previewBtn"),
  previewDialog: $("#previewDialog"),
  closePreviewBtn: $("#closePreviewBtn"),
  documentPreview: $("#documentPreview"),
  toast: $("#toast"),
  wordCount: $("#wordCount"),
  updatedAt: $("#updatedAt")
};

let entries = loadEntries();
let currentId = null;
let autosaveTimer = null;

const editor = new Editor({
  element: $("#editor"),
  extensions: [
    StarterKit,
    Underline,
    Highlight,
    Link.configure({
      openOnClick: false,
      autolink: true
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"]
    })
  ],
  content: "<p></p>",
  editorProps: {
    attributes: {
      spellcheck: "true"
    }
  },
  onUpdate: () => {
    updateWordCount();
    updateToolbarState();
    scheduleAutosave();
  },
  onSelectionUpdate: updateToolbarState,
  onTransaction: updateToolbarState
});

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.remove("show"), 1600);
}

function markSaving() {
  els.saveStatus.textContent = "Modifiche…";
  els.saveStatus.style.color = "#a36a3d";
}

function markSaved() {
  els.saveStatus.textContent = "Salvato";
  els.saveStatus.style.color = "#4f7658";
}

function formatDate(iso) {
  if (!iso) return "Non ancora salvato";
  const d = new Date(iso);
  return `Aggiornato ${d.toLocaleDateString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric"
  })} · ${d.toLocaleTimeString("it-IT", {
    hour: "2-digit", minute: "2-digit"
  })}`;
}

function updateWordCount() {
  const text = editor.getText().trim();
  const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
  els.wordCount.textContent = `${count} ${count === 1 ? "parola" : "parole"}`;
}

function setCurrent(entry) {
  currentId = entry?.id || null;
  els.titleInput.value = entry?.title || "";
  editor.commands.setContent(entry?.content || { type: "doc", content: [{ type: "paragraph" }] });
  els.headerTitle.textContent = entry?.title || "Nuovo testo";
  els.deleteBtn.disabled = !entry;
  els.duplicateBtn.disabled = !entry;
  els.updatedAt.textContent = formatDate(entry?.updatedAt);
  updateWordCount();
  renderList();
  setTimeout(() => editor.commands.focus("end"), 0);
}

function newEntry() {
  currentId = null;
  els.titleInput.value = "";
  editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
  els.headerTitle.textContent = "Nuovo testo";
  els.deleteBtn.disabled = true;
  els.duplicateBtn.disabled = true;
  els.updatedAt.textContent = "Non ancora salvato";
  renderList();
  els.titleInput.focus();
}

function persist() {
  saveEntries(entries);
  markSaved();
  renderList();
}

function saveCurrent({ silent = false } = {}) {
  const title = els.titleInput.value.trim();
  const text = editor.getText().trim();

  if (!title && !text) return;

  const now = new Date().toISOString();

  if (!currentId) {
    const entry = {
      id: uuid(),
      title: title || "Senza titolo",
      content: editor.getJSON(),
      createdAt: now,
      updatedAt: now
    };
    entries.push(entry);
    currentId = entry.id;
  } else {
    const entry = entries.find(e => e.id === currentId);
    if (!entry) return;
    entry.title = title || "Senza titolo";
    entry.content = editor.getJSON();
    entry.updatedAt = now;
  }

  persist();
  const current = entries.find(e => e.id === currentId);
  els.headerTitle.textContent = current.title;
  els.titleInput.value = current.title;
  els.deleteBtn.disabled = false;
  els.duplicateBtn.disabled = false;
  els.updatedAt.textContent = formatDate(current.updatedAt);

  if (!silent) showToast("Testo salvato");
}

function scheduleAutosave() {
  markSaving();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (currentId || els.titleInput.value.trim() || editor.getText().trim()) {
      saveCurrent({ silent: true });
    } else {
      markSaved();
    }
  }, 650);
}

function deleteCurrent() {
  if (!currentId) return;
  const entry = entries.find(e => e.id === currentId);
  const ok = confirm(`Eliminare "${entry?.title || "questo testo"}"?`);
  if (!ok) return;
  entries = entries.filter(e => e.id !== currentId);
  persist();
  newEntry();
  showToast("Testo eliminato");
}

function duplicateCurrent() {
  if (!currentId) return;
  const source = entries.find(e => e.id === currentId);
  if (!source) return;
  const now = new Date().toISOString();
  const copy = {
    ...structuredClone(source),
    id: uuid(),
    title: `${source.title} — copia`,
    createdAt: now,
    updatedAt: now
  };
  const index = entries.findIndex(e => e.id === currentId);
  entries.splice(index + 1, 0, copy);
  persist();
  setCurrent(copy);
  showToast("Testo duplicato");
}

function filteredEntries() {
  const q = els.searchInput.value.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(e => {
    const temp = document.createElement("div");
    temp.textContent = extractTextFromJSON(e.content);
    return e.title.toLowerCase().includes(q) || temp.textContent.toLowerCase().includes(q);
  });
}

function extractTextFromJSON(node) {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  return (node.content || []).map(extractTextFromJSON).join(" ");
}

function renderList() {
  els.entryList.innerHTML = "";
  const visible = filteredEntries();

  els.entryCount.textContent = `${entries.length} ${entries.length === 1 ? "testo" : "testi"}`;

  if (!visible.length) {
    els.entryList.innerHTML = `
      <div class="empty-state">
        ${entries.length ? "Nessun risultato." : "Ancora nessun testo.<br>Premi “Nuovo testo” per iniziare."}
      </div>`;
    return;
  }

  visible.forEach((entry) => {
    const realIndex = entries.findIndex(e => e.id === entry.id);
    const button = document.createElement("button");
    button.className = `entry-item ${entry.id === currentId ? "active" : ""}`;
    button.draggable = true;
    button.dataset.id = entry.id;
    button.innerHTML = `
      <span class="entry-index">${toRoman(realIndex + 1)}</span>
      <span class="entry-title"></span>
      <span class="drag-handle" title="Trascina per riordinare">⋮⋮</span>
    `;
    button.querySelector(".entry-title").textContent = entry.title;
    button.addEventListener("click", () => {
      saveCurrent({ silent: true });
      setCurrent(entry);
    });

    button.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", entry.id);
      e.dataTransfer.effectAllowed = "move";
    });
    button.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    button.addEventListener("drop", e => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === entry.id) return;

      const from = entries.findIndex(x => x.id === draggedId);
      const to = entries.findIndex(x => x.id === entry.id);
      const [moved] = entries.splice(from, 1);
      entries.splice(to, 0, moved);
      persist();
      showToast("Ordine aggiornato");
    });

    els.entryList.appendChild(button);
  });
}

function updateToolbarState() {
  const checks = {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    highlight: editor.isActive("highlight"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    alignLeft: editor.isActive({ textAlign: "left" }),
    alignCenter: editor.isActive({ textAlign: "center" }),
    alignRight: editor.isActive({ textAlign: "right" })
  };

  els.toolbar.querySelectorAll("[data-action]").forEach(btn => {
    btn.classList.toggle("active", !!checks[btn.dataset.action]);
  });
}

function handleToolbar(action) {
  const chain = editor.chain().focus();

  switch (action) {
    case "bold": chain.toggleBold().run(); break;
    case "italic": chain.toggleItalic().run(); break;
    case "underline": chain.toggleUnderline().run(); break;
    case "strike": chain.toggleStrike().run(); break;
    case "highlight": chain.toggleHighlight().run(); break;
    case "bulletList": chain.toggleBulletList().run(); break;
    case "orderedList": chain.toggleOrderedList().run(); break;
    case "alignLeft": chain.setTextAlign("left").run(); break;
    case "alignCenter": chain.setTextAlign("center").run(); break;
    case "alignRight": chain.setTextAlign("right").run(); break;
    case "undo": chain.undo().run(); break;
    case "redo": chain.redo().run(); break;
    case "link": {
      const previous = editor.getAttributes("link").href || "";
      const href = prompt("URL del collegamento:", previous || "https://");
      if (href === null) break;
      if (!href.trim()) {
        chain.unsetLink().run();
      } else {
        chain.extendMarkRange("link").setLink({ href: href.trim() }).run();
      }
      break;
    }
  }
}

function renderHTMLFromJSON(node) {
  if (!node) return "";
  if (node.type === "text") {
    let text = escapeHtml(node.text || "");
    for (const mark of node.marks || []) {
      if (mark.type === "bold") text = `<strong>${text}</strong>`;
      if (mark.type === "italic") text = `<em>${text}</em>`;
      if (mark.type === "underline") text = `<u>${text}</u>`;
      if (mark.type === "strike") text = `<s>${text}</s>`;
      if (mark.type === "highlight") text = `<mark>${text}</mark>`;
      if (mark.type === "link") text = `<a href="${escapeHtml(mark.attrs?.href || "#")}" target="_blank">${text}</a>`;
    }
    return text;
  }

  const children = (node.content || []).map(renderHTMLFromJSON).join("");

  if (node.type === "paragraph") {
    const align = node.attrs?.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : "";
    return `<p${align}>${children || "&nbsp;"}</p>`;
  }
  if (node.type === "bulletList") return `<ul>${children}</ul>`;
  if (node.type === "orderedList") return `<ol>${children}</ol>`;
  if (node.type === "listItem") return `<li>${children}</li>`;
  if (node.type === "blockquote") return `<blockquote>${children}</blockquote>`;
  if (node.type === "hardBreak") return "<br>";
  if (node.type === "doc") return children;
  return children;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openPreview() {
  saveCurrent({ silent: true });

  const toc = entries.map((entry, i) => `
    <div class="toc-row">
      <strong>${toRoman(i + 1)}.</strong>
      <span>${escapeHtml(entry.title)}</span>
    </div>`).join("");

  const bodies = entries.map((entry, i) => `
    <section>
      <h2>${toRoman(i + 1)}. ${escapeHtml(entry.title)}</h2>
      <div class="doc-body">${renderHTMLFromJSON(entry.content)}</div>
    </section>`).join("");

  els.documentPreview.innerHTML = `
    <h1>SOMMARIO</h1>
    <h2 class="toc-title">1. TESTI MAIL E TICKET</h2>
    ${toc || "<p>Nessun testo salvato.</p>"}
    ${bodies}
  `;

  els.previewDialog.showModal();
}

els.newBtn.addEventListener("click", () => {
  saveCurrent({ silent: true });
  newEntry();
});

els.saveBtn.addEventListener("click", () => saveCurrent());
els.deleteBtn.addEventListener("click", deleteCurrent);
els.duplicateBtn.addEventListener("click", duplicateCurrent);
els.searchInput.addEventListener("input", renderList);

els.titleInput.addEventListener("input", () => {
  els.headerTitle.textContent = els.titleInput.value.trim() || "Nuovo testo";
  scheduleAutosave();
});

els.toolbar.addEventListener("click", e => {
  const button = e.target.closest("[data-action]");
  if (button) handleToolbar(button.dataset.action);
});

els.previewBtn.addEventListener("click", openPreview);
els.closePreviewBtn.addEventListener("click", () => els.previewDialog.close());

els.exportBtn.addEventListener("click", async () => {
  saveCurrent({ silent: true });
  if (!entries.length) {
    showToast("Aggiungi almeno un testo");
    return;
  }

  try {
    els.exportBtn.disabled = true;
    els.exportBtn.textContent = "Esportazione…";
    await exportDocx(entries);
    showToast("Documento Word creato");
  } catch (err) {
    console.error(err);
    alert(`Errore durante l'esportazione: ${err.message}`);
  } finally {
    els.exportBtn.disabled = false;
    els.exportBtn.textContent = "Esporta Word";
  }
});

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveCurrent();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
    e.preventDefault();
    saveCurrent({ silent: true });
    newEntry();
  }
});

window.addEventListener("beforeunload", () => {
  saveCurrent({ silent: true });
});

renderList();
if (entries.length) setCurrent(entries[0]);
else newEntry();
