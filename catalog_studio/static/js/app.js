(function () {
  "use strict";

  const state = {
    step: 0,
    maxStepReached: 0,
    products: [],
    columns: [],
    detected: {},
    allFields: [],
    excelSelected: false,
    photosFiles: null,
    backgroundMode: "PREMIUM_DARK",
    config: { currency: "L", accent_color: "#F26A1B", background_mode: "PREMIUM_DARK", year: 2026 },
    lastGeneration: null,
    photoPickerTarget: null,
  };

  const FIELD_LABELS = {
    codigo: "Codigo",
    sku: "SKU",
    marca: "Marca",
    modelo: "Modelo",
    descripcion: "Descripcion",
    precio_mayorista: "Precio Mayorista",
    precio_especial: "Precio Especial",
    categoria: "Categoria",
    color: "Color",
    talla: "Talla",
  };

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

  function toast(msg, isError) {
    const el = $("#toast");
    el.textContent = msg;
    el.style.borderColor = isError ? "var(--bad)" : "var(--accent)";
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3200);
  }

  async function api(path, options) {
    options = options || {};
    const opts = Object.assign({ headers: {} }, options);
    if (opts.json) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.json);
      delete opts.json;
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* not json */ }
    if (!res.ok) {
      const msg = (data && data.error) || `Error ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // -------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------

  function goToStep(idx) {
    state.step = idx;
    state.maxStepReached = Math.max(state.maxStepReached, idx);
    $all(".view").forEach(v => v.classList.toggle("active", Number(v.dataset.view) === idx));
    $all(".step-pill").forEach(p => {
      const n = Number(p.dataset.step);
      p.classList.toggle("active", n === idx);
      p.classList.toggle("done", n < idx || (n <= state.maxStepReached && n !== idx));
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $all(".step-pill").forEach(p => {
    p.addEventListener("click", () => {
      const n = Number(p.dataset.step);
      if (n <= state.maxStepReached) goToStep(n);
    });
  });

  // -------------------------------------------------------------------
  // Step 0: Excel upload
  // -------------------------------------------------------------------

  const excelDrop = $("#excelDrop");
  const excelInput = $("#excelInput");
  excelDrop.addEventListener("click", () => excelInput.click());
  excelDrop.addEventListener("dragover", e => { e.preventDefault(); excelDrop.style.borderColor = "var(--accent)"; });
  excelDrop.addEventListener("dragleave", () => { excelDrop.style.borderColor = ""; });
  excelDrop.addEventListener("drop", e => {
    e.preventDefault();
    excelDrop.style.borderColor = "";
    if (e.dataTransfer.files.length) {
      excelInput.files = e.dataTransfer.files;
      onExcelSelected();
    }
  });
  excelInput.addEventListener("change", onExcelSelected);

  function onExcelSelected() {
    const file = excelInput.files[0];
    if (!file) return;
    $("#excelFileName").textContent = file.name;
    $("#btnAnalyzeExcel").disabled = false;
    state.excelSelected = true;
  }

  $("#btnAnalyzeExcel").addEventListener("click", async () => {
    const file = excelInput.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("excel", file);
    $("#btnAnalyzeExcel").disabled = true;
    $("#btnAnalyzeExcel").textContent = "ANALIZANDO...";
    try {
      const data = await api("/api/excel/upload", { method: "POST", body: fd });
      state.columns = data.columns;
      state.detected = data.detected;
      state.mapping = data.mapping;
      state.allFields = data.all_fields;
      renderMappingStep(data);
      goToStep(1);
    } catch (e) {
      toast(e.message, true);
    } finally {
      $("#btnAnalyzeExcel").disabled = false;
      $("#btnAnalyzeExcel").textContent = "ANALIZAR EXCEL";
    }
  });

  // -------------------------------------------------------------------
  // Step 1: Column mapping
  // -------------------------------------------------------------------

  function renderMappingStep(data) {
    $("#productCountLine").innerHTML = `Productos encontrados: <b>${data.product_count}</b>`;
    const grid = $("#mappingGrid");
    grid.innerHTML = "";
    data.all_fields.forEach(field => {
      const info = data.detected[field] || { column: null, detected: false };
      const row = document.createElement("div");
      row.className = "mapping-row";
      const opts = ['<option value="">-- No usar --</option>'].concat(
        data.columns.map(c => `<option value="${escapeHtml(c)}" ${c === info.column ? "selected" : ""}>${escapeHtml(c)}</option>`)
      );
      row.innerHTML = `
        <div class="field-name">
          <span>${FIELD_LABELS[field] || field}</span>
          <span class="${info.detected ? "badge-ok" : "badge-warn"}">${info.detected ? "&#10003; detectada" : "&#9888; no detectada"}</span>
        </div>
        <select data-field="${field}">${opts.join("")}</select>
      `;
      grid.appendChild(row);
    });

    const table = $("#previewTable");
    if (data.preview_rows.length) {
      const cols = Object.keys(data.preview_rows[0]);
      table.innerHTML = "<thead><tr>" + cols.map(c => `<th>${escapeHtml(c)}</th>`).join("") + "</tr></thead>" +
        "<tbody>" + data.preview_rows.map(r => "<tr>" + cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join("") + "</tr>").join("") + "</tbody>";
    }
  }

  $("#btnConfirmData").addEventListener("click", async () => {
    const mapping = {};
    $all("#mappingGrid select").forEach(sel => { mapping[sel.dataset.field] = sel.value || null; });
    try {
      const data = await api("/api/excel/confirm", { method: "POST", json: { mapping } });
      state.products = data.products;
      toast(`${data.products.length} productos importados.`);
      goToStep(2);
    } catch (e) {
      toast(e.message, true);
    }
  });

  // -------------------------------------------------------------------
  // Step 2: Photos upload
  // -------------------------------------------------------------------

  const photosDrop = $("#photosDrop");
  const photosInput = $("#photosInput");
  photosDrop.addEventListener("click", () => photosInput.click());
  photosInput.addEventListener("change", () => {
    const files = Array.from(photosInput.files).filter(f => /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(f.name));
    state.photosFiles = files;
    $("#photosCount").textContent = `${files.length} fotografias seleccionadas`;
    $("#btnUploadPhotos").disabled = files.length === 0;
  });

  $("#btnUploadPhotos").addEventListener("click", async () => {
    if (!state.photosFiles || !state.photosFiles.length) return;
    const fd = new FormData();
    state.photosFiles.forEach(f => fd.append("photos", f, f.name));
    $("#btnUploadPhotos").disabled = true;
    $("#btnUploadPhotos").textContent = "SUBIENDO...";
    try {
      const data = await api("/api/photos/upload", { method: "POST", body: fd });
      state.products = data.products;
      renderAssociationStep(data);
      goToStep(3);
    } catch (e) {
      toast(e.message, true);
    } finally {
      $("#btnUploadPhotos").disabled = false;
      $("#btnUploadPhotos").textContent = "SUBIR Y ASOCIAR";
    }
  });

  // -------------------------------------------------------------------
  // Step 3: Association review
  // -------------------------------------------------------------------

  function renderAssociationStep(data) {
    const visibles = state.products.filter(p => !p.oculto);
    const conFoto = visibles.filter(p => !p.sin_foto).length;
    $("#assocSummary").innerHTML =
      `Fotografias encontradas: <b>${data.photos_found}</b> &nbsp;|&nbsp; ` +
      `Productos con foto: <b>${conFoto}</b> / ${visibles.length}`;

    const box = $("#missingPhotosBox");
    const list = $("#missingPhotosList");
    list.innerHTML = "";
    const missing = state.products.filter(p => p.sin_foto && !p.oculto);
    if (missing.length === 0) {
      box.hidden = true;
    } else {
      box.hidden = false;
      missing.forEach(p => {
        const row = document.createElement("div");
        row.className = "missing-item";
        row.innerHTML = `
          <span class="mi-name">${escapeHtml(p.codigo || p.sku || "")} &mdash; ${escapeHtml(p.modelo || "(sin modelo)")}</span>
          <button class="btn" data-action="assign" data-id="${p.id}">Seleccionar foto</button>
          <button class="btn" data-action="exclude" data-id="${p.id}">Excluir del catalogo</button>
        `;
        list.appendChild(row);
      });
      list.querySelectorAll('[data-action="assign"]').forEach(btn => {
        btn.addEventListener("click", () => openPhotoPicker(btn.dataset.id));
      });
      list.querySelectorAll('[data-action="exclude"]').forEach(btn => {
        btn.addEventListener("click", async () => {
          await api("/api/photos/exclude", { method: "POST", json: { product_id: btn.dataset.id, exclude: true } });
          const p = state.products.find(x => x.id === btn.dataset.id);
          if (p) p.oculto = true;
          renderAssociationStep(data);
          toast("Producto excluido del catalogo.");
        });
      });
    }
  }

  $("#btnGoEnhance").addEventListener("click", () => goToStep(4));

  // -------------------------------------------------------------------
  // Photo picker modal (manual assignment)
  // -------------------------------------------------------------------

  function openPhotoPicker(productId) {
    state.photoPickerTarget = productId;
    const grid = $("#photoPickerGrid");
    grid.innerHTML = "";
    const seen = new Set();
    const allPhotos = [];
    state.products.forEach(p => (p.fotos || []).forEach(f => {
      if (!seen.has(f.path)) { seen.add(f.path); allPhotos.push(f); }
    }));
    if (allPhotos.length === 0) {
      grid.innerHTML = '<p class="lead">No hay fotografias disponibles en la carpeta subida.</p>';
    }
    allPhotos.forEach(f => {
      const item = document.createElement("div");
      item.className = "photo-picker-item";
      item.innerHTML = `<img src="/api/photos/thumb?path=${encodeURIComponent(f.path)}" alt="${escapeHtml(f.filename)}">`;
      item.title = f.filename;
      item.addEventListener("click", async () => {
        await api("/api/photos/manual-assign", { method: "POST", json: { product_id: productId, photo_path: f.path, slot: "principal" } });
        const p = state.products.find(x => x.id === productId);
        if (p) { p.foto_principal = f.path; p.sin_foto = false; }
        closeModal("#photoPickerModal");
        renderAssociationStep({ photos_found: state.products.reduce((n, x) => n + (x.fotos || []).length, 0) });
        toast("Fotografia asignada.");
      });
      grid.appendChild(item);
    });
    showModal("#photoPickerModal");
  }
  $("#photoPickerCancel").addEventListener("click", () => closeModal("#photoPickerModal"));

  // -------------------------------------------------------------------
  // Step 4: Enhancement
  // -------------------------------------------------------------------

  $all(".bg-mode-card").forEach(card => {
    card.addEventListener("click", () => {
      $all(".bg-mode-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      state.backgroundMode = card.dataset.mode;
    });
  });
  $('.bg-mode-card[data-mode="PREMIUM_DARK"]').classList.add("selected");

  $("#btnStartEnhance").addEventListener("click", async () => {
    $("#btnStartEnhance").disabled = true;
    $("#enhanceProgressBlock").hidden = false;
    $("#enhanceContinueRow").hidden = true;
    try {
      await api("/api/process/enhance", { method: "POST", json: { background_mode: state.backgroundMode } });
      pollProgress("enhance");
    } catch (e) {
      toast(e.message, true);
      $("#btnStartEnhance").disabled = false;
    }
  });

  function pollProgress(kind) {
    const fillEl = kind === "enhance" ? $("#enhanceProgressFill") : $("#genProgressFill");
    const pctEl = kind === "enhance" ? $("#enhanceProgressPct") : $("#genProgressPct");
    const labelEl = kind === "enhance" ? $("#enhanceProgressLabel") : $("#genProgressLabel");
    const timer = setInterval(async () => {
      let data;
      try { data = await api("/api/process/progress"); } catch (e) { return; }
      fillEl.style.width = data.percent + "%";
      pctEl.textContent = data.percent + "%";
      labelEl.textContent = data.current ? `${data.stage === "generating" ? "Generando" : "Procesando"}: ${data.current}` : "Procesando...";
      if (kind === "enhance") renderEnhanceErrors(data.errors);
      if (data.done) {
        clearInterval(timer);
        if (kind === "enhance") onEnhanceDone(data);
        else onGenerateDone(data);
      }
    }, 700);
  }

  function renderEnhanceErrors(errors) {
    const box = $("#enhanceErrors");
    box.innerHTML = "";
    (errors || []).forEach(err => {
      const row = document.createElement("div");
      row.className = "error-item";
      row.innerHTML = `<span>&#9888; Error procesando ${escapeHtml(err.file)}</span><button class="btn" data-path="${encodeURIComponent(err.path)}">REINTENTAR</button>`;
      row.querySelector("button").addEventListener("click", async (ev) => {
        ev.target.disabled = true;
        ev.target.textContent = "...";
        try {
          await api("/api/process/retry", { method: "POST", json: { path: err.path } });
          toast("Fotografia reprocesada.");
          const data = await api("/api/process/progress");
          renderEnhanceErrors(data.errors);
        } catch (e2) {
          toast(e2.message, true);
          ev.target.disabled = false;
          ev.target.textContent = "REINTENTAR";
        }
      });
      box.appendChild(row);
    });
  }

  async function onEnhanceDone() {
    $("#btnStartEnhance").disabled = false;
    $("#enhanceContinueRow").hidden = false;
    toast("Mejora de fotografias completada.");
    try {
      const data = await api("/api/products/list");
      state.products = data.products;
    } catch (e) { /* ignore */ }
  }

  $("#btnGoEdit").addEventListener("click", () => {
    renderEditStep();
    goToStep(5);
  });

  // -------------------------------------------------------------------
  // Step 5: Edit / review
  // -------------------------------------------------------------------

  function productThumbSrc(p) {
    const path = p.foto_principal_procesada || p.foto_principal;
    if (!path) return null;
    return `/api/photos/thumb?path=${encodeURIComponent(path)}`;
  }

  function renderEditStep() {
    const list = $("#productEditList");
    list.innerHTML = "";
    const sorted = [...state.products].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    sorted.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-edit-card" + (p.oculto ? " hidden-product" : "");
      const thumbSrc = productThumbSrc(p);
      const thumbHtml = thumbSrc
        ? `<img class="pe-thumb" src="${thumbSrc}" data-id="${p.id}">`
        : `<div class="pe-thumb empty" data-id="${p.id}">SIN FOTO</div>`;
      card.innerHTML = `
        ${thumbHtml}
        <div class="pe-fields">
          <div style="grid-column:1/-1;font-weight:700;font-size:13px;">
            ${escapeHtml(p.codigo || p.sku || "")} &mdash; ${escapeHtml(p.modelo || "(sin modelo)")}
          </div>
          <label>Descripcion
            <textarea data-field="descripcion" data-id="${p.id}">${escapeHtml(p.descripcion || "")}</textarea>
          </label>
          <label>Categoria
            <input type="text" data-field="categoria" data-id="${p.id}" value="${escapeHtml(p.categoria || "")}">
          </label>
          <label>Precio Excel
            <input type="text" value="${p.precio_mayorista != null ? p.precio_mayorista : ""}" disabled>
          </label>
          <label>Precio visual (editar)
            <input type="text" data-field="precio_visual" data-id="${p.id}" value="${p.precio_visual != null ? p.precio_visual : ""}">
            ${p.precio_visual_advertencia ? '<div class="price-warning">El precio visual no coincide con el Excel.</div>' : ""}
          </label>
          <label>Orden
            <input type="number" data-field="orden" data-id="${p.id}" value="${p.orden}">
          </label>
          <label>Diseno de pagina
            <select data-field="layout" data-id="${p.id}">
              <option value="auto" ${p.layout === "auto" ? "selected" : ""}>Automatico</option>
              <option value="A" ${p.layout === "A" ? "selected" : ""}>Layout A - Foto izq / info der</option>
              <option value="B" ${p.layout === "B" ? "selected" : ""}>Layout B - Foto grande / info abajo</option>
              <option value="C" ${p.layout === "C" ? "selected" : ""}>Layout C - Principal + 2 fotos</option>
              <option value="D" ${p.layout === "D" ? "selected" : ""}>Layout D - Pantalla completa</option>
            </select>
          </label>
        </div>
        <div class="pe-actions">
          <button class="btn" data-action="pick-photo" data-id="${p.id}">Cambiar foto</button>
          <button class="btn" data-action="toggle-hide" data-id="${p.id}">${p.oculto ? "Mostrar" : "Ocultar"}</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll("textarea[data-field], input[data-field], select[data-field]").forEach(el => {
      el.addEventListener("change", debounce(onEditFieldChange, 250));
    });
    list.querySelectorAll('[data-action="pick-photo"]').forEach(btn => {
      btn.addEventListener("click", () => openPhotoPicker(btn.dataset.id));
    });
    list.querySelectorAll('[data-action="toggle-hide"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const p = state.products.find(x => x.id === btn.dataset.id);
        const newVal = !p.oculto;
        await api("/api/photos/exclude", { method: "POST", json: { product_id: p.id, exclude: newVal } });
        p.oculto = newVal;
        renderEditStep();
      });
    });
  }

  async function onEditFieldChange(ev) {
    const el = ev.target;
    const id = el.dataset.id;
    const field = el.dataset.field;
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const body = { product_id: id };
    body[field] = el.value;
    try {
      const data = await api("/api/products/update", { method: "POST", json: body });
      Object.assign(p, data.product);
      if (field === "precio_visual") renderEditStep();
    } catch (e) {
      toast(e.message, true);
    }
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  $("#btnGoValidate").addEventListener("click", async () => {
    try {
      const data = await api("/api/catalog/validate");
      renderValidationStep(data);
      goToStep(6);
    } catch (e) {
      toast(e.message, true);
    }
  });

  // -------------------------------------------------------------------
  // Step 6: Validation
  // -------------------------------------------------------------------

  function renderValidationStep(v) {
    const box = $("#validationBox");
    const rows = [
      [v.visibles, `productos en el catalogo`, true],
      [v.con_precio === v.visibles, `${v.con_precio} productos con precio`, v.con_precio === v.visibles],
      [v.sin_foto === 0, `${v.con_foto} productos con fotografia` + (v.sin_foto ? ` (${v.sin_foto} sin fotografia)` : ""), v.sin_foto === 0],
      [v.con_codigo === v.visibles, `${v.con_codigo} productos con codigo`, v.con_codigo === v.visibles],
      [v.sin_descripcion === 0, `${v.con_descripcion} productos con descripcion` + (v.sin_descripcion ? ` (${v.sin_descripcion} sin descripcion)` : ""), v.sin_descripcion === 0],
    ];
    box.innerHTML = `<div class="validation-row ok"><span class="vr-icon">&#10003;</span> ${v.visibles} productos totales</div>` +
      rows.slice(1).map(r => {
        const ok = r[2];
        return `<div class="validation-row ${ok ? "ok" : "warn"}"><span class="vr-icon">${ok ? "&#10003;" : "&#9888;"}</span> ${r[1]}</div>`;
      }).join("");
  }

  $("#btnBackToEdit").addEventListener("click", () => { renderEditStep(); goToStep(5); });
  $("#btnGoGenerate").addEventListener("click", () => goToStep(7));

  // -------------------------------------------------------------------
  // Step 7: Generate + preview
  // -------------------------------------------------------------------

  $("#btnGenerateBoth").addEventListener("click", async () => {
    $("#btnGenerateBoth").disabled = true;
    $("#genProgressBlock").hidden = false;
    $("#genResult").hidden = true;
    try {
      await api("/api/catalog/generate", { method: "POST", json: { modes: ["digital", "print"] } });
      pollProgress("generate");
    } catch (e) {
      toast(e.message, true);
      $("#btnGenerateBoth").disabled = false;
    }
  });

  function onGenerateDone() {
    $("#btnGenerateBoth").disabled = false;
    $("#genResult").hidden = false;
    $("#downloadDigital").href = "/api/catalog/download?quality=digital";
    $("#downloadPrint").href = "/api/catalog/download?quality=print";
    $("#previewFrame").src = "/api/catalog/preview?quality=digital";
    toast("Catalogo generado con exito.");
  }

  // -------------------------------------------------------------------
  // Top bar: project + config
  // -------------------------------------------------------------------

  function showModal(sel) { $(sel).hidden = false; }
  function closeModal(sel) { $(sel).hidden = true; }

  $("#btnConfig").addEventListener("click", async () => {
    try {
      const cfg = await api("/api/config");
      state.config = cfg;
      $("#cfgCurrency").value = cfg.currency;
      $("#cfgAccent").value = cfg.accent_color;
      $("#cfgYear").value = cfg.year;
      showModal("#configModal");
    } catch (e) { toast(e.message, true); }
  });
  $("#cfgCancel").addEventListener("click", () => closeModal("#configModal"));
  $("#cfgSave").addEventListener("click", async () => {
    try {
      const cfg = await api("/api/config", {
        method: "POST",
        json: {
          currency: $("#cfgCurrency").value || "L",
          accent_color: $("#cfgAccent").value,
          year: Number($("#cfgYear").value) || 2026,
        },
      });
      state.config = cfg;
      closeModal("#configModal");
      toast("Configuracion guardada.");
    } catch (e) { toast(e.message, true); }
  });

  $("#btnNewProject").addEventListener("click", async () => {
    if (!confirm("Esto iniciara un catalogo nuevo. Los cambios sin guardar se perderan. Continuar?")) return;
    const name = prompt("Nombre del nuevo proyecto:", "Catalogo Todomotos") || "Catalogo Todomotos";
    try {
      const data = await api("/api/project/new", { method: "POST", json: { name } });
      resetUIForNewProject(data.project);
    } catch (e) { toast(e.message, true); }
  });

  function resetUIForNewProject(project) {
    $("#projectName").textContent = project.name;
    state.products = [];
    excelInput.value = "";
    $("#excelFileName").textContent = "Ningun archivo seleccionado";
    $("#btnAnalyzeExcel").disabled = true;
    photosInput.value = "";
    $("#photosCount").textContent = "0 fotografias seleccionadas";
    $("#btnUploadPhotos").disabled = true;
    goToStep(0);
    state.maxStepReached = 0;
  }

  $("#btnSaveProject").addEventListener("click", async () => {
    try {
      const data = await api("/api/project/save", { method: "POST", json: {} });
      $("#projectName").textContent = data.project.name;
      toast("Proyecto guardado localmente.");
    } catch (e) { toast(e.message, true); }
  });

  $("#btnOpenProject").addEventListener("click", async () => {
    try {
      const data = await api("/api/project/list");
      const box = $("#projectListBox");
      box.innerHTML = "";
      if (!data.projects.length) {
        box.innerHTML = '<p class="lead">No hay proyectos guardados todavia.</p>';
      }
      data.projects.forEach(p => {
        const item = document.createElement("div");
        item.className = "project-list-item";
        item.innerHTML = `<span>${escapeHtml(p.name)}</span><span style="color:var(--text-mute);font-size:11.5px;">${p.product_count} productos</span>`;
        item.addEventListener("click", async () => {
          try {
            const opened = await api("/api/project/open", { method: "POST", json: { path: p.path } });
            state.products = opened.project.products || [];
            $("#projectName").textContent = opened.project.name;
            closeModal("#openModal");
            toast("Proyecto cargado.");
            if (state.products.length) {
              renderEditStep();
              const v = await api("/api/catalog/validate");
              renderValidationStep(v);
              goToStep(5);
              state.maxStepReached = 6;
            } else {
              goToStep(0);
            }
          } catch (e) { toast(e.message, true); }
        });
        box.appendChild(item);
      });
      showModal("#openModal");
    } catch (e) { toast(e.message, true); }
  });
  $("#openCancel").addEventListener("click", () => closeModal("#openModal"));

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Init
  api("/api/project/current").then(data => {
    if (data.project) $("#projectName").textContent = data.project.name;
  }).catch(() => {});
  goToStep(0);
})();
