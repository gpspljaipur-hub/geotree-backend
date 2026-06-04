import fs from "fs";
import path from "path";

/**
 * PERMANENT FIELDS — always rendered in every occasion form.
 * Admin can set `permanent_field_overrides` on the OccasionType to toggle is_required per key.
 *
 * Supported keys: name, date, state_id, project_id
 * Species rows (plant_name, quantity, height, price) are always included as a dynamic block.
 */
const PERMANENT_FIELDS = [
  {
    key: "name",
    label: "Name",
    field_type: "text",
    is_required: true,
    placeholder: "Enter name",
  },
  {
    key: "date",
    label: "Date",
    field_type: "date",
    is_required: true,
    placeholder: "",
  },
  {
    key: "state_id",
    label: "Select State",
    field_type: "dropdown_api",
    is_required: false,
    placeholder: "Choose State",
  },
  {
    key: "district",
    label: "Select District",
    field_type: "dropdown_api",
    is_required: false,
    placeholder: "Choose District",
  },
  {
    key: "project_id",
    label: "Select Project for Plantation",
    field_type: "dropdown_api",
    is_required: false,
    placeholder: "Choose Project",
  },
];

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  if (options.length === 1 && typeof options[0] === 'string') {
    const rawStr = options[0];
    const parts = rawStr.split(/\s+(?=\d+\s*-\s*)/);
    if (parts.length > 1) {
      return parts.map(p => p.trim()).filter(Boolean);
    }
  }
  return options.map(o => typeof o === 'string' ? o.trim() : o).filter(Boolean);
}

// Generates HTML for a single dynamic occasion-specific field
function generateFieldHtml(field) {
  const {
    label,
    key,
    field_type = "text",
    is_required = false,
    placeholder = "",
    options = [],
  } = field;
  const req = is_required ? "required" : "";
  const star = is_required ? '<span class="req-star">*</span>' : "";

  let inputHtml = "";
  switch (field_type) {
    case "textarea":
      inputHtml = `<textarea id="${key}" name="${key}" placeholder="${placeholder}" ${req} rows="4"></textarea>`;
      break;
    case "dropdown": {
      const normalizedOpts = normalizeOptions(options);
      const opts = normalizedOpts
        .map((o) => `<option value="${o}">${o}</option>`)
        .join("\n          ");
      inputHtml = `<select id="${key}" name="${key}" ${req}>
          <option value="" disabled selected>${placeholder || `Select ${label}`}</option>
          ${opts}
        </select>`;
      break;
    }
    default:
      inputHtml = `<input type="${field_type}" id="${key}" name="${key}" placeholder="${placeholder}" ${req} />`;
  }

  return `
    <div class="form-group" data-key="${key}" data-type="${field_type}">
      <label for="${key}">${label}${star}</label>
      ${inputHtml}
    </div>`;
}

/**
 * Generates a full self-contained HTML form page for an OccasionType.
 * Always includes permanent fields + dynamic species rows at top,
 * then occasion-specific custom fields below.
 *
 * @param {Object} occasion - OccasionType document/object
 * @returns {string} Complete HTML string
 */
export function generateOccasionFormHtml(occasion) {
  const { name, form_fields = [], permanent_field_overrides = {} } = occasion;
  const occasionId = occasion._id?.toString() || "";
  const hasCustomField = (key) => form_fields.some((f) => f.key === key);

  // Apply admin overrides to permanent field required flags
  const pf = {};
  PERMANENT_FIELDS.forEach((f) => {
    pf[f.key] = {
      ...f,
      is_required:
        permanent_field_overrides[f.key] !== undefined
          ? permanent_field_overrides[f.key]
          : f.is_required,
    };
  });

  const req = (k) => (pf[k].is_required ? "required" : "");
  const star = (k) =>
    pf[k].is_required ? '<span class="req-star">*</span>' : "";

  const customFieldsHtml =
    form_fields.length > 0
      ? form_fields.map(generateFieldHtml).join("\n      ")
      : '<p class="no-extra">No additional fields for this occasion type.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>${name} — Plantation Form</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8faf8; color: #1a2e1a; padding-bottom: 32px; }

    /* HEADER */
    .form-header {
      position: relative;
      background: linear-gradient(135deg, #2d6a35, #4caf50);
      padding: 18px 20px 14px;
      text-align: center;
      color: #fff;
    }
    .btn-back {
      position: absolute;
      left: 16px;
      top: 18px;
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 50%;
      transition: background 0.2s;
    }
    .btn-back:active { background: rgba(255,255,255,0.2); }
    .btn-back svg { width: 22px; height: 22px; }
    .form-header .badge {
      display: inline-block;
      background: rgba(255,255,255,.2);
      border-radius: 20px;
      padding: 2px 12px;
      font-size: .7rem;
      letter-spacing: .07em;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .form-header h1 { font-size: 1.2rem; font-weight: 700; }
    .form-header p  { font-size: .78rem; opacity: .85; margin-top: 2px; }

    /* BODY */
    .form-body { padding: 18px 16px 0; }

    .section-label {
      font-size: .68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .09em;
      color: #4caf50;
      margin: 18px 0 9px;
    }

    /* FORM GROUPS */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 13px;
      opacity: 0;
      transform: translateY(6px);
      animation: fadeUp .3s ease forwards;
    }
    .form-group label { font-size: .84rem; font-weight: 600; color: #374151; }
    .req-star { color: #e53e3e; margin-left: 2px; }
    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: .62rem .88rem;
      font-size: .88rem;
      font-family: 'Inter', sans-serif;
      color: #1a2e1a;
      background: #fff;
      border: 1.5px solid #d1d5db;
      border-radius: 12px;
      outline: none;
      transition: border-color .2s, box-shadow .2s;
      appearance: none;
      -webkit-appearance: none;
    }
    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      border-color: #4caf50;
      box-shadow: 0 0 0 3px rgba(76,175,80,.15);
    }
    .form-group input[type="date"] { cursor: pointer; }
    .form-group textarea { resize: vertical; min-height: 82px; }
    .form-group select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right .8rem center;
      padding-right: 2.2rem;
      cursor: pointer;
    }

    /* SPECIES BLOCK */
    .species-block {
      background: #f0f7f0;
      border: 1.5px solid #c8e6c9;
      border-radius: 14px;
      padding: 13px;
      margin-bottom: 6px;
    }
    .species-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .species-header .sp-title { font-size: .84rem; font-weight: 700; color: #2d6a35; }
    .btn-add {
      background: #4caf50;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 5px 11px;
      font-size: .76rem;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-add:active { opacity: .8; }

    .sp-row {
      background: #fff;
      border: 1.5px solid #d1d5db;
      border-radius: 10px;
      padding: 11px;
      margin-bottom: 8px;
    }
    .sp-row .row2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 7px;
    }
    .sp-row .form-group { margin-bottom: 0; }
    .btn-remove {
      display: flex;
      align-items: center;
      gap: 3px;
      background: none;
      border: none;
      color: #e53e3e;
      font-size: .76rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }

    /* DIVIDER + NO EXTRA */
    .divider { border: none; border-top: 1.5px dashed #d1d5db; margin: 18px 0 4px; }
    .no-extra { color: #9ca3af; font-style: italic; font-size: .8rem; text-align: center; padding: 8px 0; }

    @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }

    /* FOOTER / SUBMIT */
    .form-footer { margin-top: 24px; padding: 0 4px; }
    .btn-submit {
      width: 100%;
      background: linear-gradient(135deg, #2d6a35, #4caf50);
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 14px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(45, 106, 53, 0.2);
      transition: all 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-submit:active { transform: scale(0.98); background: #24522a; box-shadow: 0 2px 6px rgba(45, 106, 53, 0.2); }
    .btn-submit:disabled { background: #9ca3af; cursor: not-allowed; box-shadow: none; }
    
    .error-msg {
      color: #e53e3e;
      font-size: 0.75rem;
      margin-top: 10px;
      text-align: center;
      display: none;
    }
  </style>
</head>
<body>



<div class="form-header">
  <button type="button" class="btn-back" onclick="goBack()" aria-label="Go Back">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  </button>
  <div class="badge">Plantation Details</div>
  <h1>${name}</h1>
  <p>Fill in the details below</p>
</div>

<div class="form-body">
<form id="geo-form" autocomplete="off" novalidate>

  <!-- ═══ PERMANENT: BASIC INFO ═══ -->
  <div class="section-label">Basic Information</div>

  ${hasCustomField("name") ? "" : `
  <div class="form-group" data-key="name" data-permanent="true">
    <label for="name">Name${star("name")}</label>
    <input type="text" id="name" name="name" placeholder="Enter name" ${req("name")} />
  </div>`}

  ${hasCustomField("date") ? "" : `
  <div class="form-group" data-key="date" data-permanent="true">
    <label for="date">Date${star("date")}</label>
    <input type="date" id="date" name="date" ${req("date")} />
  </div>`}

  <!-- ═══ PERMANENT: LOCATION ═══ -->
  <div class="section-label">Location</div>

  ${hasCustomField("state_id") ? "" : `
  <div class="form-group" data-key="state_id" data-permanent="true">
    <label for="state_id">Select State${star("state_id")}</label>
    <select id="state_id" name="state_id" ${req("state_id")} onchange="onStateChange(this.value)">
      <option value="" disabled selected>Choose State</option>
    </select>
  </div>`}

  ${hasCustomField("project_id") ? "" : `
  <div class="form-group" data-key="project_id" data-permanent="true">
    <label for="project_id">Select Project for Plantation${star("project_id")}</label>
    <select id="project_id" name="project_id" ${req("project_id")} onchange="onProjectChange(this.value)" disabled>
      <option value="" disabled selected>Choose Project</option>
    </select>
  </div>`}

  <!-- ═══ PERMANENT: SPECIES ROWS ═══ -->
  <div class="section-label">Distribute Plants by Species</div>

  <div class="species-block">
    <div class="species-header">
      <span class="sp-title">Plant Distribution</span>
      <button type="button" class="btn-add" onclick="addSpeciesRow()">＋ Add Species</button>
    </div>
    <div id="sp-container"></div>
  </div>

  ${form_fields.length > 0
      ? `
  <!-- ═══ OCCASION-SPECIFIC FIELDS ═══ -->
  <hr class="divider" />
  <div class="section-label">${name} Details</div>
  ${customFieldsHtml}
  `
      : '<p class="no-extra">No additional fields for this occasion.</p>'
    }

  <div class="form-footer">
    <div id="form-error" class="error-msg">Please fill all required fields.</div>
    <button type="submit" class="btn-submit" id="submit-btn">
      🌱 Submit Plantation
    </button>
  </div>

</form>
</div>

<script>
  /* ──────────────────────────────────────
   *  GeoTree Plantation Form
   *  Communicates with app via postMessage / ReactNativeWebView
   *  Or fetches directly from backend if standalone
   * ────────────────────────────────────── */
  const OCCASION_ID   = '${occasionId}';
  const OCCASION_NAME = '${name}';

  // Detect valid HTTP(S) origin; file:// and null are not usable for API calls
  const _origin = window.location.origin;
  let BASE_URL = (_origin && _origin !== 'null' && _origin.startsWith('http')) ? _origin : '';

  // Allow the parent app (React Native WebView, iframe, etc.) to inject the real server URL
  window.setBaseUrl = function(url) {
    BASE_URL = url.replace(/\\/+$/, ''); // trim trailing slashes
    console.log("BASE_URL set to:", BASE_URL);
    // Re-fetch metadata now that we have a valid URL
    fetchMetadata();
  };

  let rowCount = 0;

  // ── Communicate to parent app ──
  function goBack() {
    postToApp({ type: 'GO_BACK' });
  }

  function postToApp(msg) {
    const str = JSON.stringify(msg);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(str);
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  }

  // ── Fetch metadata from API ──
  // async function fetchMetadata() {
  //   if (!BASE_URL) {
  //     console.warn("No valid BASE_URL – skipping API fetch (waiting for app to provide URL via setBaseUrl)");
  //     return;
  //   }
  //   try {
  //     const resp = await fetch(BASE_URL + "/api/occasion/list/" + OCCASION_ID);
  //     const result = await resp.json();
  //     if (result.status && result.data && result.data.metadata) {
  //       const meta = result.data.metadata;
  //       if (meta.states) window.setStates(meta.states);
  //       if (meta.projects) window.setProjects(meta.projects);
  //       if (meta.species) window.setSpecies(meta.species);
  //       console.log("Metadata loaded from API");
  //     }
  //   } catch (err) {
  //     console.error("Failed to fetch metadata from API:", err);
  //   }
  // }
  console.log(BASE_URL, "BASE_URLBASE_URLBASE_URL");
    async function fetchMetadata() {
        if (!BASE_URL) {
          console.warn("No valid BASE_URL");
          return;
        }

        try {
          const resp = await fetch(
            BASE_URL + "/api/occasion/list/" + OCCASION_ID,
          );
          const result = await resp.json();

          console.log("API Response =>", result); // 👈 Yaha lagao

          if (result.status && result.data && result.data.metadata) {
            const meta = result.data.metadata;

            console.log("States =>", meta.states); // 👈 Yaha lagao
            console.log("Projects =>", meta.projects);
            console.log("Species =>", meta.species);

            if (meta.states) window.setStates(meta.states);
            if (meta.projects) window.setProjects(meta.projects);
            if (meta.species) window.setSpecies(meta.species);
          }
        } catch (err) {
          console.error("Failed to fetch metadata:", err);
        }
      }

  // ── Add a species row ──
  function addSpeciesRow() {
    rowCount++;
    const idx = rowCount;
    const container = document.getElementById('sp-container');
    const div = document.createElement('div');
    div.className = 'sp-row';
    div.id = 'sp-row-' + idx;
    div.innerHTML =
      '<div class="form-group">' +
        '<label for="pn_' + idx + '">Species / Plant Name <span class="req-star">*</span></label>' +
        '<select id="pn_' + idx + '" name="species[' + idx + '][plant_id]" required onchange="onSpeciesChange(' + idx + ', this.value)" disabled>' +
          '<option value="" disabled selected>Select species</option>' +
        '</select>' +
      '</div>' +
      '<div class="row2">' +
        '<div class="form-group">' +
          '<label for="qty_' + idx + '">Quantity</label>' +
          '<input type="number" id="qty_' + idx + '" name="species[' + idx + '][quantity]" placeholder="Qty" min="1" value="1" oninput="updatePrice(' + idx + ')" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="ht_' + idx + '">Height (cm) <span class="req-star">*</span></label>' +
          '<select id="ht_' + idx + '" name="species[' + idx + '][height]" required onchange="onHeightChange(' + idx + ', this.value)" disabled>' +
            '<option value="" disabled selected>Height</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="pr_' + idx + '">Price (₹) <span class="req-star">*</span></label>' +
          '<input type="number" id="pr_' + idx + '" name="species[' + idx + '][price]" placeholder="Price" min="0" required readonly />' +
        '</div>' +
      '</div>' +
      (idx > 1 ? '<button type="button" class="btn-remove" onclick="removeSpeciesRow(' + idx + ')">🗑 Remove</button>' : '');
    container.appendChild(div);

    updateSpeciesDropdown(idx);
    syncData();
  }

  function removeSpeciesRow(idx) {
    const row = document.getElementById('sp-row-' + idx);
    if (row) { row.remove(); syncData(); }
  }

  // ── State changed → Update projects ──
  function onStateChange(stateId) {
    console.log("State changed:", stateId);
    const projectSel = document.getElementById('project_id');
    projectSel.innerHTML = '<option value="" disabled selected>Choose Project</option>';
    
    if (stateId) {
      projectSel.disabled = false;
    } else {
      projectSel.disabled = true;
    }

    // Also tell app to provide filtered projects if it wants
    postToApp({ type: 'STATE_CHANGED', state_id: stateId });
    filterProjects();
  }

  // ── filter projects ──
  function filterProjects() {
    const stateId = document.getElementById('state_id').value;
    const projectSel = document.getElementById('project_id');
    
    console.log("Filtering projects for:", { stateId });
    
    projectSel.innerHTML = '<option value="" disabled selected>Choose Project</option>';

    const filtered = (window.META_PROJECTS || []).filter(p => {
      const pStateId = p.state_id ? String(p.state_id._id || p.state_id) : null;
      return !stateId || (pStateId === String(stateId));
    });

    console.log("Projects found:", filtered.length);

    filtered.forEach(p => {
      const o = document.createElement('option');
      o.value = p._id || p.id;
      o.textContent = p.site_name || p.name;
      projectSel.appendChild(o);
    });
    syncData();
  }

  function onProjectChange(projectId) {
    console.log("Project changed:", projectId);
    // When project changes, update and enable all species dropdowns
    const speciesSelectors = document.querySelectorAll('select[id^="pn_"]');
    speciesSelectors.forEach(sel => {
      const rowIdx = sel.id.split('_')[1];
      if (projectId) {
        sel.disabled = false;
      } else {
        sel.disabled = true;
      }
      updateSpeciesDropdown(rowIdx);
    });
    postToApp({ type: 'PROJECT_CHANGED', project_id: projectId });
    syncData();
  }

  // ── App/API populates state dropdown ──
  window.setStates = function(states) {
    window.META_STATES = states;
    const sel = document.getElementById('state_id');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="" disabled selected>Choose State</option>';
    states.forEach(s => {
      const o = document.createElement('option');
      o.value = s._id || s.id;
      o.textContent = s.state_name || s.name;
      sel.appendChild(o);
    });
    if (currentVal) sel.value = currentVal;
  };

  // ── App/API populates project dropdown ──
  window.setProjects = function(projects) {
    window.META_PROJECTS = projects;
    filterProjects();
  };

  // ── App/API populates species globally ──
  window.setSpecies = function(species) {
    window.META_SPECIES = species;
    const speciesSelectors = document.querySelectorAll('select[id^="pn_"]');
    speciesSelectors.forEach(sel => {
      const rowIdx = sel.id.split('_')[1];
      updateSpeciesDropdown(rowIdx);
    });
  };

  function updateSpeciesDropdown(rowIdx) {
    const sel = document.getElementById('pn_' + rowIdx);
    if (!sel) return;
    const projectId = document.getElementById('project_id').value;
    const currentVal = sel.value;
    
    if (!projectId) {
      sel.disabled = true;
    } else {
      sel.disabled = false;
    }

    console.log("Updating species for row " + rowIdx + ", filtered by project: ", projectId);
    
    sel.innerHTML = '<option value="" disabled selected>Select species</option>';
    
    // Find selected project to get its native_species list
    const project = (window.META_PROJECTS || []).find(p => String(p._id || p.id) === String(projectId));
    const nativeIds = project ? (project.native_species || []).map(id => String(id)) : [];

    const filtered = (window.META_SPECIES || []).filter(sp => {
        if (!projectId) return true; 
        
        // Check if species is in the project's native list
        const isNative = nativeIds.includes(String(sp._id || sp.id));
        
        // Also check if the species record itself is assigned to this project
        const spProjectId = sp.project_id ? String(sp.project_id._id || sp.project_id) : null;
        const matchesProject = spProjectId === String(projectId);
        
        return isNative || matchesProject;
    });
    
    console.log("Species found for row " + rowIdx + ": ", filtered.length);
    
    filtered.forEach(sp => {
      const o = document.createElement('option');
      o.value = sp._id || sp.id;
      o.textContent = sp.name;
      sel.appendChild(o);
    });
    if (currentVal) {
        // Only restore if the value is still in the filtered list
        const exists = filtered.some(f => String(f._id || f.id) === String(currentVal));
        if (exists) sel.value = currentVal;
    }
  }

  function onSpeciesChange(rowIdx, speciesId) {
    const sp = (window.META_SPECIES || []).find(s => String(s._id || s.id) === String(speciesId));
    const htSel = document.getElementById('ht_' + rowIdx);
    const prEl = document.getElementById('pr_' + rowIdx);
    
    // Clear and populate height dropdown
    htSel.innerHTML = '<option value="" disabled selected>Height</option>';
    prEl.value = 0;

    if (speciesId) {
      htSel.disabled = false;
    } else {
      htSel.disabled = true;
    }

    if (sp && sp.variations && sp.variations.length > 0) {
      sp.variations.forEach(v => {
        const o = document.createElement('option');
        o.value = v.height;
        o.textContent = v.height;
        htSel.appendChild(o);
      });
      
      // Auto-select first variation
      const first = sp.variations[0];
      htSel.value = first.height;
      updatePrice(rowIdx);
    }
    syncData();
  }

  function onHeightChange(rowIdx, height) {
    updatePrice(rowIdx);
    syncData();
  }

  function updatePrice(rowIdx) {
    const speciesId = document.getElementById('pn_' + rowIdx).value;
    const qty = Number(document.getElementById('qty_' + rowIdx).value || 1);
    const height = document.getElementById('ht_' + rowIdx).value;
    const prEl = document.getElementById('pr_' + rowIdx);
    
    const sp = (window.META_SPECIES || []).find(s => String(s._id || s.id) === String(speciesId));
    if (sp && sp.variations) {
      const v = sp.variations.find(v => v.height === height);
      if (v) {
        prEl.value = (v.price || 0) * qty;
      }
    }
  }

  // ── Collect all form data formatted for the submission API ──
  function collectData() {
    const permanent = {};
    const permanentKeys = ['name','date','state_id','project_id'];
    permanentKeys.forEach(k => {
      const el = document.getElementById(k);
      if (el) permanent[k] = el.value;
    });

    const plants = [];
    for (let idx = 1; idx <= rowCount; idx++) {
      const row = document.getElementById('sp-row-' + idx);
      if (!row) continue;
      const plant = document.getElementById('pn_' + idx);
      const qty   = document.getElementById('qty_' + idx);
      const ht    = document.getElementById('ht_' + idx);
      const pr    = document.getElementById('pr_' + idx);
      if (plant && plant.value) {
        plants.push({
          plant_id: plant.value,
          quantity: Number(qty ? qty.value : 1),
          tree_height: ht ? ht.value : '',
          price: Number(pr ? pr.value : 0)
        });
      }
    }

    const occasion_data = {};
    const form = document.getElementById('geo-form');
    for (const el of form.elements) {
      if (el.name && !permanentKeys.includes(el.name) && !el.name.startsWith('species[')) {
        occasion_data[el.name] = el.value;
      }
    }

    return {
      occasion_id: OCCASION_ID,
      site_id: permanent.project_id || null,
      state_id: permanent.state_id || null,
      district: permanent.district || null,
      name: permanent.name || '',
      date: permanent.date || null,
      plants: plants,
      occasion_data: occasion_data,
      source: 'Occasion',
      user_id: window.USER_ID || null,
      lat: window.CURRENT_LAT || null,
      lng: window.CURRENT_LNG || null
    };
  }

  function syncData() {
    postToApp({ type: 'OCCASION_FORM_DATA', payload: collectData() });
  }

  // Expose for app to call directly
  window.getFormData = collectData;
  window.getOccasionFormData = collectData;

  // Live-sync on any change
  document.getElementById('geo-form').addEventListener('input',  syncData);
  document.getElementById('geo-form').addEventListener('change', syncData);

  // ── Handle Final Submission ──
  document.getElementById('geo-form').addEventListener('submit', function(e) {
    e.preventDefault();
    submitForm();
  });

  function submitForm() {
    const form = document.getElementById('geo-form');
    const errorEl = document.getElementById('form-error');
    errorEl.style.display = 'none';

    if (!form.checkValidity()) {
      form.reportValidity();
      errorEl.style.display = 'block';
      errorEl.textContent = "Please fill all required fields.";
      return;
    }

    const data = collectData();
    
    // Validation
    if (data.plants.length === 0) {
      errorEl.style.display = 'block';
      errorEl.textContent = "Please add at least one species.";
      return;
    }

    // Notify app
    postToApp({ type: 'SUBMIT_PLANTATION_FORM', payload: data });
  }

  // Expose triggerSubmit for app to call directly
  window.triggerSubmit = submitForm;

  // ── App sets specific state (Personalization) ──
  window.setUserLocation = function(stateId) {
    console.log("Setting user location:", stateId);
    const stateSel = document.getElementById('state_id');
    if (stateId) {
      stateSel.value = stateId;
      onStateChange(stateId);
    }
  };

  // Init
  window.addEventListener('load', function() {
    // Set date based on occasion or current date
    const dateEl = document.getElementById('date');
    if (dateEl && !dateEl.value) {
      dateEl.value = new Date().toISOString().split('T')[0];
    }
    
    addSpeciesRow();
    
    postToApp({ type: 'OCCASION_FORM_READY', occasionId: OCCASION_ID, occasionName: OCCASION_NAME });
    postToApp({ type: 'REQUEST_METADATA' });
    
    // Auto-fetch if not in app or as a fallback
    fetchMetadata();
  });
</script>
</body>
</html>`;
}

/**
 * Saves the generated HTML form to disk and returns the relative URL path.
 */
export function saveOccasionFormHtml(occasion) {
  const formsDir = path.join(process.cwd(), "public", "forms");
  if (!fs.existsSync(formsDir)) {
    fs.mkdirSync(formsDir, { recursive: true });
  }
  const filename = `occasion-${occasion._id}.html`;
  fs.writeFileSync(
    path.join(formsDir, filename),
    generateOccasionFormHtml(occasion),
    "utf-8",
  );
  return `/forms/${filename}`;
}

// export function saveOccasionFormHtml(occasion) {
//   console.log(
//     "NEW URL =>",
//     `/forms/plantation_form.html?occasion_id=${occasion._id}`,
//   );
//   return `/forms/plantation_form.html?occasion_id=${occasion._id}`;
// }

/**
 * Deletes the generated HTML form file for an occasion.
 */
export function deleteOccasionFormHtml(occasionId) {
  const filepath = path.join(
    process.cwd(),
    "public",
    "forms",
    `occasion-${occasionId}.html`,
  );
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
}
