'use strict';

// PDF-Layout orientiert sich an der Protokoll-Vorlage [9][10]
// Rd-Zuordnung basiert auf der Bemessungstabelle (Ø220, SF 2,0) [1]

const DEPTHS = Array.from({ length: 25 }, (_, i) => i);
const STORAGE_DRAFT   = 'htb-rammpfahl-draft-v4';
const STORAGE_HISTORY = 'htb-rammpfahl-history-v4';
const HISTORY_MAX     = 30;

// Bemessungstabelle-Werte (Ø220, Sicherheitsbeiwert 2,0 enthalten) [1]
const RD_PER_M_220 = {
  nichtbindig: {
    gedrueckt: 0.0,
    s5_10:     27.646015351590183,   // (40 kN/m²) – Klammerwert [1]
    s10_20:    55.292030703180366,   // 80 kN/m²
    s20_30:    82.938046054770550,   // 120 kN/m²
    gt30:      103.672557568463190   // 150 kN/m²
  },
  bindig: {
    gedrueckt: 0.0,
    s5_10:     13.823007675795091,   // (20 kN/m²) – Klammerwert [1]
    s10_20:    27.646015351590183,   // (40 kN/m²) – Klammerwert [1]
    s20_30:    48.380526865282820,   // 70 kN/m²
    gt30:      69.115038378975460    // 100 kN/m²
  }
};

// Produktdaten aus Excel [1]
const TRM_PRODUCTS = [
  { name:'TRM98/6',     od:98,    id:86,    ws:6,    kgm:14.04,  preis:17.10  },
  { name:'TRM98/7,5',   od:98,    id:83,    ws:7.5,  kgm:12.7,   preis:19.83  },
  { name:'TRM118/6',    od:118,   id:106,   ws:6,    kgm:16.57,  preis:19.02  },
  { name:'TRM118/7,5',  od:118,   id:103,   ws:7.5,  kgm:21.0,   preis:22.06  },
  { name:'TRM118/9',    od:118,   id:100,   ws:9,    kgm:24.4,   preis:25.62  },
  { name:'TRM118/10,6', od:118,   id:96.8,  ws:10.6, kgm:28.0,   preis:29.40  },
  { name:'TRM170/7,5',  od:170,   id:155,   ws:7.5,  kgm:33.8,   preis:32.43  },
  { name:'TRM170/9',    od:170,   id:152,   ws:9,    kgm:37.1,   preis:35.48  },
  { name:'TRM170/10,6', od:170,   id:148.8, ws:10.6, kgm:42.5,   preis:40.63  },
  { name:'TRM170/13',   od:170,   id:144,   ws:13,   kgm:50.4,   preis:47.45  },
];

const SSAB_PRODUCTS = [
  { name:'RR75/6,3',    grade:'S440J2H', od:76.1,  id:63.5,  ws:6.3,  kgm:10.84, preis:0     },
  { name:'RR90/6,3',    grade:'S440J2H', od:88.9,  id:76.3,  ws:6.3,  kgm:12.83, preis:0     },
  { name:'RRs100/6,3',  grade:'S550J2H', od:101.6, id:89.0,  ws:6.3,  kgm:14.81, preis:0     },
  { name:'RR115/6,3',   grade:'S440J2H', od:115,   id:102.4, ws:6.3,  kgm:16.89, preis:0     },
  { name:'RR115/8',     grade:'S440J2H', od:115,   id:99,    ws:8,    kgm:21.11, preis:0     },
  { name:'RRs140/8',    grade:'S550J2H', od:139.7, id:123.7, ws:8,    kgm:25.98, preis:0     },
  { name:'RR140/8',     grade:'S440J2H', od:139.7, id:123.7, ws:8,    kgm:25.98, preis:23.95 },
  { name:'RR140/10',    grade:'S440J2H', od:139.7, id:119.7, ws:10,   kgm:31.99, preis:28.85 },
  { name:'RR170/10',    grade:'S440J2H', od:168.3, id:148.3, ws:10,   kgm:39.04, preis:35.30 },
  { name:'RR170/12,5',  grade:'S440J2H', od:168.3, id:143.3, ws:12.5, kgm:48.03, preis:42.95 },
  { name:'RR190/10',    grade:'S440J2H', od:190,   id:170,   ws:10,   kgm:44.39, preis:42.20 },
  { name:'RR190/12,5',  grade:'S440J2H', od:190,   id:165,   ws:12.5, kgm:54.72, preis:49.80 },
];

const $ = (id) => document.getElementById(id);

let timeInputs = [];
let noteInputs = [];

const state = {
  includeKlammer: false,
  timer: { running: false, startMs: 0, raf: null, selectedIdx: 0 }
};

// -------------------- HELPERS --------------------
function fmtComma(n, digits = 2) {
  return Number(n || 0).toFixed(digits).replace('.', ',');
}

function depthLabel(d) { return `${d}-${d + 1}m`; }

function dateTag(d = new Date()) {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`; // TTMMJJJJ
}

function secClass(sec) {
  if (!sec || sec <= 0) return null;
  if (sec < 5)  return 'gedrueckt';
  if (sec < 10) return 's5_10';
  if (sec < 20) return 's10_20';
  if (sec <= 30) return 's20_30';
  return 'gt30';
}

function isKlammerClass(bodenart, cls) {
  if (!cls) return false;
  if (bodenart === 'nichtbindig') return cls === 's5_10';
  if (bodenart === 'bindig')      return cls === 's5_10' || cls === 's10_20';
  return false;
}

function rdFromSec(sec, bodenart, schuhMm, includeKlammer) {
  const cls = secClass(sec);
  if (!cls) return 0;
  const base = (RD_PER_M_220[bodenart] || RD_PER_M_220.bindig)[cls] || 0;
  if (!includeKlammer && isKlammerClass(bodenart, cls)) return 0;
  return base * ((Number(schuhMm) || 220) / 220); // skaliert mit Ø
}

// Auto-Skalierung für Diagramm
function niceTicks(maxVal, targetSteps = 4) {
  const max = Math.max(0, Number(maxVal) || 0);
  if (max <= 0) return { max: 10, ticks: [0, 2, 4, 6, 8, 10] };
  const rawStep = max / Math.max(1, targetSteps);
  const pow10   = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const err     = rawStep / pow10;
  let step;
  if (err >= 7.5)      step = 10 * pow10;
  else if (err >= 3.5) step = 5  * pow10;
  else if (err >= 1.5) step = 2  * pow10;
  else                 step = 1  * pow10;
  const niceMax = Math.ceil(max / step) * step;
  const ticks   = [];
  for (let t = 0; t <= niceMax + 1e-9; t += step) ticks.push(t);
  return { max: niceMax, step, ticks };
}

// -------------------- DRAFT SAVE / LOAD --------------------
function collectFormState() {
  return {
    v: 4,
    meta: {
      datum:        $('inp-datum')?.value        || '',
      projekt:      $('inp-projekt')?.value      || '',
      kostenstelle: $('inp-kostenstelle')?.value || '',
      auftraggeber: $('inp-auftraggeber')?.value || '',
      traeger:      $('inp-traeger')?.value      || '',
      hammer:       $('inp-hammer')?.value       || '',
      pfahlNr:      $('inp-pfahl-nr')?.value     || '',
      pfahltyp:     $('inp-pfahltyp')?.value     || '',
      schuh:        $('inp-schuh')?.value        || '220',
      bodenart:     $('inp-bodenart')?.value     || 'bindig',
      ed:           $('inp-ed')?.value           || ''
    },
    includeKlammer: state.includeKlammer ? 1 : 0,
    times: DEPTHS.map((_, i) => timeInputs[i]?.value || ''),
    notes: DEPTHS.map((_, i) => noteInputs[i]?.value || '')
  };
}

function applyFormState(s) {
  if (!s || !s.meta) return;
  $('inp-datum').value        = s.meta.datum        || $('inp-datum').value;
  $('inp-projekt').value      = s.meta.projekt      || '';
  $('inp-kostenstelle').value = s.meta.kostenstelle || '';
  $('inp-auftraggeber').value = s.meta.auftraggeber || '';
  $('inp-traeger').value      = s.meta.traeger      || 'SK 270';
  $('inp-hammer').value       = s.meta.hammer       || 'Wimmer WH26';
  $('inp-pfahl-nr').value     = s.meta.pfahlNr      || '1';
  if (s.meta.pfahltyp) $('inp-pfahltyp').value = s.meta.pfahltyp;
  $('inp-schuh').value   = s.meta.schuh   || '220';
  $('inp-bodenart').value = s.meta.bodenart || 'bindig';
  $('inp-ed').value       = s.meta.ed       || '350.60';

  state.includeKlammer = !!Number(s.includeKlammer || 0);
  $('optIncludeKlammer').value = state.includeKlammer ? '1' : '0';

  (s.times || []).slice(0, 25).forEach((v, i) => { if (timeInputs[i]) timeInputs[i].value = v; });
  (s.notes || []).slice(0, 25).forEach((v, i) => { if (noteInputs[i]) noteInputs[i].value = v; });
}

let saveT = null;
function saveDraftDebounced() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(STORAGE_DRAFT, JSON.stringify(collectFormState())); } catch {}
  }, 200);
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_DRAFT);
    if (!raw) return;
    applyFormState(JSON.parse(raw));
  } catch {}
}

// -------------------- HISTORY --------------------
function readHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]'); }
  catch { return []; }
}
function writeHistory(list) {
  try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch {}
}
function uid() {
  return crypto?.randomUUID?.() || ('id_' + Date.now() + '_' + Math.random().toString(16).slice(2));
}

function sumsFromSnapshot(snap) {
  const bodenart = snap.meta?.bodenart || 'bindig';
  const schuh    = Number(snap.meta?.schuh || 220);
  const ed       = Number(snap.meta?.ed || 0);
  const includeK = !!Number(snap.includeKlammer || 0);
  let sumTime = 0, sumRd = 0;
  (snap.times || []).slice(0, 25).forEach(tv => {
    const t = Number(tv || 0);
    if (t > 0) sumTime += t;
    sumRd += rdFromSec(t, bodenart, schuh, includeK);
  });
  return { sumTime, sumRd, ed, ok: sumRd >= ed };
}

function saveCurrentToHistory() {
  const snap  = collectFormState();
  const sums  = sumsFromSnapshot(snap);
  const entry = {
    id: uid(), savedAt: Date.now(),
    title: `${snap.meta?.projekt || '—'} · Pfahl ${snap.meta?.pfahlNr || '—'}`,
    snap, sums
  };
  const list = readHistory();
  list.unshift(entry);
  writeHistory(list);
  renderHistoryList();
}

function deleteHistory(id) {
  writeHistory(readHistory().filter(e => e.id !== id));
  renderHistoryList();
}

function loadHistoryToForm(id) {
  const entry = readHistory().find(e => e.id === id);
  if (!entry) return;
  applyFormState(entry.snap);
  recalc();
  saveDraftDebounced();
  document.querySelector('.tab[data-tab="protokoll"]')?.click();
}

function showHistoryDetail(id) {
  const entry = readHistory().find(e => e.id === id);
  if (!entry) return;
  $('historyDetailCard').hidden = false;

  const m    = entry.snap.meta || {};
  const sums = entry.sums || sumsFromSnapshot(entry.snap);

  $('historyMeta').innerHTML = `
    <p><b>Gespeichert:</b> ${new Date(entry.savedAt).toLocaleString('de-DE')}</p>
    <p><b>Projekt:</b> ${m.projekt || '—'} · <b>Kostenstelle:</b> ${m.kostenstelle || '—'} · <b>Auftraggeber:</b> ${m.auftraggeber || '—'}</p>
    <p><b>Pfahltyp:</b> ${m.pfahltyp || '—'} · <b>ø:</b> ${m.schuh || '220'}mm · <b>Bodenart:</b> ${m.bodenart || '—'}</p>
    <p><b>ΣRd:</b> ${fmtComma(sums.sumRd, 2)} kN · <b>Ed:</b> ${fmtComma(sums.ed, 2)} kN ·
       <b style="color:${sums.ok ? 'var(--ok)' : 'var(--err)'}">${sums.ok ? 'Rd ≥ Ed ✅' : 'Rd < Ed ❌'}</b></p>
  `;

  const tbody    = $('historyTableBody');
  tbody.innerHTML = '';
  const bodenart  = entry.snap.meta?.bodenart || 'bindig';
  const schuh     = Number(entry.snap.meta?.schuh || 220);
  const includeK  = !!Number(entry.snap.includeKlammer || 0);

  DEPTHS.forEach((d, i) => {
    const t    = Number(entry.snap.times?.[i] || 0);
    const rd   = rdFromSec(t, bodenart, schuh, includeK);
    const note = entry.snap.notes?.[i] || '';
    const tr   = document.createElement('tr');
    tr.innerHTML = `
      <td>${depthLabel(d)}</td>
      <td>${t > 0 ? t : ''}</td>
      <td>${fmtComma(rd, 2)}</td>
      <td>${note}</td>
    `;
    tbody.appendChild(tr);
  });

  drawBarChartToCanvas($('historyChart'), entry.snap);
}

function renderHistoryList() {
  const host = $('historyList');
  const list = readHistory();

  if (!list.length) {
    host.innerHTML = `<div class="text"><p>Noch keine gespeicherten Messungen.</p></div>`;
    $('historyDetailCard').hidden = true;
    return;
  }

  host.innerHTML = '';
  list.forEach(entry => {
    const sums = entry.sums || sumsFromSnapshot(entry.snap);
    const el   = document.createElement('div');
    el.className = 'historyItem';
    el.innerHTML = `
      <div class="historyTop">
        <div>${entry.title || 'Messung'}</div>
        <div style="color:var(--muted);font-size:.85em;font-weight:800">${new Date(entry.savedAt).toLocaleString('de-DE')}</div>
      </div>
      <div class="historySub">
        ΣRd: <b>${fmtComma(sums.sumRd, 2)} kN</b> · Ed: <b>${fmtComma(sums.ed, 2)} kN</b> ·
        Status: <b style="color:${sums.ok ? 'var(--ok)' : 'var(--err)'}">${sums.ok ? 'Rd ≥ Ed' : 'Rd < Ed'}</b>
      </div>
      <div class="historyBtns">
        <button class="btn btn--ghost" type="button" data-act="detail" data-id="${entry.id}">Anzeigen</button>
        <button class="btn btn--ghost" type="button" data-act="load"   data-id="${entry.id}">Laden</button>
        <button class="btn btn--ghost" type="button" data-act="pdf"    data-id="${entry.id}">PDF</button>
        <button class="btn btn--ghost" type="button" data-act="del"    data-id="${entry.id}">Löschen</button>
      </div>
    `;
    host.appendChild(el);
  });

  host.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id  = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === 'detail') showHistoryDetail(id);
      if (act === 'load')   loadHistoryToForm(id);
      if (act === 'del')    deleteHistory(id);
      if (act === 'pdf') {
        const entry = readHistory().find(e => e.id === id);
        if (entry) await exportPdfDownload(entry.snap);
      }
    });
  });
}

// -------------------- TABLE BUILD --------------------
function buildMeterSelect() {
  const sel = $('meterSelect');
  sel.innerHTML = '';
  DEPTHS.forEach((d, i) => sel.appendChild(new Option(depthLabel(d), String(i))));
  sel.value = String(state.timer.selectedIdx || 0);
  sel.addEventListener('change', () => {
    state.timer.selectedIdx = Number(sel.value) || 0;
    saveDraftDebounced();
  });
}

function buildProtocolTable() {
  const tbody = $('protoBody');
  tbody.innerHTML = '';
  timeInputs = [];
  noteInputs = [];

  DEPTHS.forEach((d, i) => {
    const tr = document.createElement('tr');

    const tdDepth = document.createElement('td');
    tdDepth.textContent = depthLabel(d);
    tr.appendChild(tdDepth);

    const tdTime = document.createElement('td');
    const inpT   = document.createElement('input');
    inpT.type = 'number'; inpT.min = '0'; inpT.step = '1'; inpT.placeholder = 'sec';
    inpT.addEventListener('input', () => { recalc(); saveDraftDebounced(); });
    timeInputs.push(inpT);
    tdTime.appendChild(inpT);
    tr.appendChild(tdTime);

    const tdRd = document.createElement('td');
    tdRd.className = 'rd-cell'; tdRd.id = `rd-${i}`; tdRd.textContent = '0,00';
    tr.appendChild(tdRd);

    const tdNote = document.createElement('td');
    const inpN   = document.createElement('input');
    inpN.type = 'text'; inpN.placeholder = '';
    inpN.style.width = '100%';
    inpN.addEventListener('input', saveDraftDebounced);
    noteInputs.push(inpN);
    tdNote.appendChild(inpN);
    tr.appendChild(tdNote);

    tbody.appendChild(tr);
  });
}

// -------------------- BEMESSUNGSTABELLE --------------------
function buildBemTable() {
  const bodenart = $('bem-bodenart').value;
  const schuhMm  = Number($('bem-schuh').value || 220);
  const tbody    = $('bemBody');
  tbody.innerHTML = '';

  const rows = [
    { secm: 'gedrückt', label: 'sehr locker', qs: 0,   klammer: false },
    { secm: '5 – 10',   label: 'locker',       qs: bodenart==='bindig'?20:40, klammer: true  },
    { secm: '10 – 20',  label: 'mitteldicht',   qs: bodenart==='bindig'?40:80, klammer: bodenart==='bindig' },
    { secm: '20 – 30',  label: 'dicht',         qs: bodenart==='bindig'?70:120, klammer: false },
    { secm: '> 30',     label: 'sehr dicht',    qs: bodenart==='bindig'?100:150, klammer: false },
  ];

  rows.forEach(row => {
    const rd = (row.qs * Math.PI * (schuhMm/1000)) / 2.0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="${row.klammer?'klammer':''}">${row.secm}</td>
      <td class="${row.klammer?'klammer':''}">${row.label}</td>
      <td class="${row.klammer?'klammer':''}">${row.klammer?'('+row.qs+')':row.qs}</td>
      <td class="rd-val">${fmtComma(rd,3)}</td>
      <td class="${row.klammer?'klammer':''}">${row.klammer?'Klammerwert':''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function buildProductLists() {
  const trmBody  = $('trmList');
  const ssabBody = $('ssabList');
  TRM_PRODUCTS.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.od}mm</td><td>${p.id}mm</td><td>${p.ws}mm</td><td>${p.kgm}</td><td>${p.preis>0?p.preis.toFixed(2)+' €':'–'}</td>`;
    trmBody.appendChild(tr);
  });
  SSAB_PRODUCTS.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.grade}</td><td>${p.od}mm</td><td>${p.ws}mm</td><td>${p.kgm}</td><td>${p.preis>0?p.preis.toFixed(2)+' €':'–'}</td>`;
    ssabBody.appendChild(tr);
  });
}

// -------------------- RECALC --------------------
function recalc() {
  const bodenart = $('inp-bodenart').value;
  const schuh    = Number($('inp-schuh').value || 220);
  const ed       = Number($('inp-ed').value || 0);
  const includeK = state.includeKlammer;
  let sumTime = 0, sumRd = 0;

  DEPTHS.forEach((_, i) => {
    const t  = Number(timeInputs[i]?.value || 0);
    if (t > 0) sumTime += t;
    const rd = rdFromSec(t, bodenart, schuh, includeK);
    sumRd += rd;
    const rdEl = $(`rd-${i}`);
    if (rdEl) rdEl.textContent = fmtComma(rd, 2);
  });

  $('sumTime').textContent = String(sumTime);
  $('sumRd').textContent   = fmtComma(sumRd, 2);

  const ok  = sumRd >= ed;
  const res = $('sumResult');
  res.textContent = ok ? 'Rd ≥ Ed' : 'Rd < Ed';
  res.className   = 'sum-result ' + (ok ? 'ok' : 'err');
}

// -------------------- TIMER --------------------
function setTimerUI() {
  $('btnTimeStart').disabled = state.timer.running;
  $('btnTimeStop').disabled  = !state.timer.running;
}

function timerTick() {
  if (!state.timer.running) return;
  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs) / 1000));
  $('timeLive').value = `${sec} s`;
  state.timer.raf = requestAnimationFrame(timerTick);
}

function timerStart() {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.startMs = Date.now();
  $('timeLive').value = '0 s';
  setTimerUI();
  timerTick();
}

function timerStopAndWrite() {
  if (!state.timer.running) return;
  state.timer.running = false;
  if (state.timer.raf) cancelAnimationFrame(state.timer.raf);
  state.timer.raf = null;

  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs) / 1000));
  const idx = state.timer.selectedIdx || 0;
  if (timeInputs[idx]) timeInputs[idx].value = String(sec);

  const next = Math.min(DEPTHS.length - 1, idx + 1);
  state.timer.selectedIdx = next;
  $('meterSelect').value  = String(next);
  $('timeLive').value     = `${sec} s`;

  recalc();
  saveDraftDebounced();
  setTimerUI();
}

// -------------------- BAR CHART (Canvas Verlauf-Detail) --------------------
function drawBarChartToCanvas(canvas, snap) {
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const W    = rect.width || 700;
  const H    = rect.height || 320;
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, W, H);

  const mL = 80, mR = 20, mT = 24, mB = 32;
  const pw  = W - mL - mR;
  const ph  = H - mT - mB;

  const times = (snap?.times || []).slice(0, 25).map(v => Number(v || 0));
  const maxT  = Math.max(1, ...times);
  const scale = niceTicks(maxT, 4);
  const xMax  = scale.max;

  const xOf = (v) => mL + (Math.max(0, Math.min(xMax, v)) / xMax) * pw;
  const rowH = ph / DEPTHS.length;

  // Achsentitel
  ctx.fillStyle = '#8a8a92';
  ctx.font      = '12px Arial';
  ctx.fillText('Zeit [sec]', mL + pw - 68, H - 10);
  ctx.save();
  ctx.translate(12, mT + ph / 2 + 50);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Eindringtiefe [m]', 0, 0);
  ctx.restore();

  // Grid + X-Ticks (Auto-Skala)
  scale.ticks.forEach(t => {
    const gx = xOf(t);
    ctx.strokeStyle = '#1e1e22';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(gx, mT); ctx.lineTo(gx, mT + ph); ctx.stroke();

    ctx.fillStyle   = '#8a8a92';
    ctx.font        = '11px Arial';
    ctx.textAlign   = 'center';
    ctx.fillText(String(t), gx, H - 14);
  });
  ctx.textAlign = 'left';

  // Balken
  for (let i = 0; i < DEPTHS.length; i++) {
    const yMid = mT + i * rowH + rowH / 2;
    const t    = times[i] || 0;

    ctx.fillStyle = '#6c6c74';
    ctx.font      = '10px Arial';
    ctx.fillText(depthLabel(i), 4, yMid + 4);

    if (t > 0) {
      const barH = Math.max(2, rowH * 0.6);
      ctx.fillStyle = '#ffed00';
      ctx.fillRect(xOf(0), yMid - barH / 2, Math.max(1, xOf(t) - xOf(0)), barH);
    }
  }
}

// -------------------- PDF EXPORT (Download, echtes Arial) --------------------
async function exportPdfDownload(snap = null) {
  const s    = snap || collectFormState();
  const meta = s.meta || {};

  if (!window.PDFLib) {
    alert('PDF-Library noch nicht geladen – bitte kurz warten und erneut versuchen.');
    return;
  }
  if (!window.fontkit) {
    alert('Fontkit noch nicht geladen – bitte kurz warten und erneut versuchen.');
    return;
  }

  const { PDFDocument, rgb } = window.PDFLib;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(window.fontkit);

  // Arial einbetten (aus Repo) – Fallback auf Helvetica wenn nicht vorhanden
  let font, fontBold;
  try {
    const fontBytes     = await fetch('arial.ttf').then(r => r.arrayBuffer());
    font     = await pdf.embedFont(fontBytes, { subset: true });
    fontBold = font; // falls du arialbd.ttf hast, hier einfügen
    try {
      const boldBytes = await fetch('ARIALBD.TTF').then(r => r.arrayBuffer());
      fontBold = await pdf.embedFont(boldBytes, { subset: true });
    } catch {}
  } catch {
    const { StandardFonts } = window.PDFLib;
    font     = await pdf.embedFont(StandardFonts.Helvetica);
    fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  // Logo
  let logoImg = null;
  try {
    const logoBytes = await fetch('logo.png').then(r => r.arrayBuffer());
    logoImg = await pdf.embedPng(logoBytes);
  } catch {}

  const page = pdf.addPage([595.28, 841.89]); // A4
  const mm   = (v) => v * 72 / 25.4;

  const margin = mm(10);
  const x0 = margin, y0 = margin;
  const W  = 595.28 - 2 * margin;
  const H  = 841.89 - 2 * margin;

  // Äußerer Rahmen
  page.drawRectangle({ x:x0, y:y0, width:W, height:H, borderColor:rgb(0,0,0), borderWidth:1.5 });

  // Grauer Header-Balken (wie Vorlage) [9][10]
  const headerH = mm(10);
  page.drawRectangle({ x:x0, y:y0+H-headerH, width:W, height:headerH, color:rgb(0.88,0.88,0.88), borderColor:rgb(0,0,0), borderWidth:1 });

  // Logo im Header
  if (logoImg) {
    const lh    = headerH * 0.78;
    const scale = lh / logoImg.height;
    page.drawImage(logoImg, {
      x: x0 + mm(2), y: y0 + H - headerH + (headerH - lh) / 2,
      width: logoImg.width * scale, height: lh
    });
  }

  // Titel
  page.drawText('RAMMPFAHL-PROTOKOLL RDS SPEZIAL TIEFBAU', {
    x: x0 + mm(33), y: y0 + H - headerH + mm(2.5),
    size: 11, font: fontBold, color: rgb(0,0,0)
  });

  // Meta-Rows [9][10]
  const rowH = mm(8);
  let cy     = y0 + H - headerH - rowH;

  function drawLine(y) {
    page.drawLine({ start:{x:x0,y}, end:{x:x0+W,y}, thickness:1, color:rgb(0,0,0) });
  }
  function drawMidLine(y) {
    page.drawLine({ start:{x:x0+W/2,y}, end:{x:x0+W,y}, thickness:1, color:rgb(0,0,0) });
  }

  function metaRow(l1, v1, l2, v2) {
    drawLine(cy);
    const mid = x0 + W * 0.5;
    page.drawText(l1,           { x:x0+mm(2),    y:cy+mm(2.2), size:10, font:fontBold, color:rgb(0,0,0) });
    page.drawText(String(v1||''), { x:x0+mm(32), y:cy+mm(2.2), size:10, font,          color:rgb(0,0,0) });
    page.drawText(l2,             { x:mid+mm(2),  y:cy+mm(2.2), size:10, font:fontBold, color:rgb(0,0,0) });
    page.drawText(String(v2||''), { x:mid+mm(45), y:cy+mm(2.2), size:10, font,          color:rgb(0,0,0) });
    page.drawLine({ start:{x:mid,y:cy}, end:{x:mid,y:cy+rowH}, thickness:1, color:rgb(0,0,0) });
    cy -= rowH;
  }

  drawLine(y0 + H - headerH);
  metaRow('Datum:',       meta.datum,        'Kostenstelle:', meta.kostenstelle);
  metaRow('Projekt:',     meta.projekt,      'Auftraggeber:', meta.auftraggeber);
  metaRow('Trägergerät:', meta.traeger||'SK 270', 'Pfahlnummer:', meta.pfahlNr);
  metaRow('Hyd-hammer:',  meta.hammer||'Wimmer WH26', 'Pfahl-Bemessungslast [kN] :', meta.ed ? fmtComma(Number(meta.ed),2) : '');
  metaRow('Pfahlyp:',     meta.pfahltyp,     `ø${Number(meta.schuh||220)}mm`, `Bodenart: ${meta.bodenart||''}`);

  // ---- Tabellenbereich (links) + Diagramm (rechts, halbe Breite) [10] ----
  const tableTop    = cy + rowH;
  const tableBottom = y0 + mm(28);
  const tH          = tableTop - tableBottom;

  const leftW  = W * 0.52;
  const rightW = W - leftW;
  const thRow  = mm(7);

  // Kopfzeilen-Hintergrund grau
  page.drawRectangle({ x:x0,       y:tableTop-thRow, width:leftW,  height:thRow, color:rgb(0.93,0.93,0.93), borderColor:rgb(0,0,0), borderWidth:1 });
  page.drawRectangle({ x:x0+leftW, y:tableTop-thRow, width:rightW, height:thRow, color:rgb(0.93,0.93,0.93), borderColor:rgb(0,0,0), borderWidth:1 });

  // Spalten links: Tiefe / Zeit / Rd / Anmerkung [9][10]
  const c1 = leftW * 0.23;
  const c2 = leftW * 0.16;
  const c3 = leftW * 0.16;
  // c4 = Rest

  const xC1 = x0 + c1;
  const xC2 = xC1 + c2;
  const xC3 = xC2 + c3;

  [xC1, xC2, xC3].forEach(xx =>
    page.drawLine({ start:{x:xx,y:tableBottom}, end:{x:xx,y:tableTop}, thickness:1, color:rgb(0,0,0) })
  );
  page.drawLine({ start:{x:x0+leftW,y:tableBottom}, end:{x:x0+leftW,y:tableTop}, thickness:1, color:rgb(0,0,0) });

  // Kopfzeilen-Texte
  page.drawText('Eindring-\ntiefe[m]', { x:x0+mm(1.5), y:tableTop-thRow+mm(1.5), size:9, font:fontBold, color:rgb(0,0,0), lineHeight:11 });
  page.drawText('Zeit [sec]',          { x:xC1+mm(1.5), y:tableTop-thRow+mm(2.5), size:9, font:fontBold, color:rgb(0,0,0) });
  page.drawText('Rd [kN]',             { x:xC2+mm(1.5), y:tableTop-thRow+mm(2.5), size:9, font:fontBold, color:rgb(0,0,0) });
  page.drawText('Anmerkung',           { x:xC3+mm(1.5), y:tableTop-thRow+mm(2.5), size:9, font:fontBold, color:rgb(0,0,0) });

  // Diagramm-Kopf rechts [10]
  const cx = x0 + leftW;
  page.drawText('Eindringtiefe [m]', { x:cx+mm(2),       y:tableTop-thRow+mm(2.5), size:9, font:fontBold, color:rgb(0,0,0) });
  page.drawText('Zeit [sec]',        { x:cx+rightW-mm(22), y:tableTop-thRow+mm(2.5), size:9, font:fontBold, color:rgb(0,0,0) });

  // Auto-Skala (nicht fix 0/10/20/30 wie Vorlage, sondern angepasst)
  const times  = (s.times || []).slice(0, 25).map(v => Number(v || 0));
  const maxT   = Math.max(1, ...times);
  const scale  = niceTicks(maxT, 4);
  const xMax   = scale.max;

  const innerL = cx + mm(26);
  const innerR = cx + rightW - mm(4);
  const innerW = innerR - innerL;

  function chartX(v) {
    return innerL + (Math.max(0, Math.min(xMax, v)) / xMax) * innerW;
  }

  // Tick-Beschriftung X-Achse
  scale.ticks.forEach(t => {
    page.drawText(String(t), { x:chartX(t)-mm(2), y:tableTop-thRow+mm(2), size:8, font, color:rgb(0,0,0) });
  });

  // Datenzeilen
  const dataRowH    = (tH - thRow - mm(12)) / (25 + 2);
  let yRowTop       = tableTop - thRow;
  let sumTime = 0, sumRd = 0;
  const bodenart    = meta.bodenart || 'bindig';
  const schuhMm     = Number(meta.schuh || 220);
  const includeK    = !!Number(s.includeKlammer || 0);

  for (let i = 0; i < 25; i++) {
    const yBot = yRowTop - dataRowH;
    page.drawLine({ start:{x:x0, y:yBot}, end:{x:x0+W, y:yBot}, thickness:1, color:rgb(0,0,0) });

    const t    = Number(s.times?.[i] || 0);
    const note = String(s.notes?.[i] || '');
    if (t > 0) sumTime += t;
    const rd = rdFromSec(t, bodenart, schuhMm, includeK);
    sumRd += rd;

    // Texte Tabelle
    page.drawText(depthLabel(i), { x:x0+mm(1.5), y:yBot+mm(1.5), size:9.5, font, color:rgb(0,0,0) });
    if (t > 0) page.drawText(String(t), { x:xC1+mm(1.5), y:yBot+mm(1.5), size:9.5, font, color:rgb(0,0,0) });
    page.drawText(fmtComma(rd,2), { x:xC2+mm(1.5), y:yBot+mm(1.5), size:9.5, font, color:rgb(0,0,0) });
    if (note) page.drawText(note.slice(0,32), { x:xC3+mm(1.5), y:yBot+mm(1.5), size:9, font, color:rgb(0,0,0) });

    // Grid-Linien Diagramm (Ticks)
    scale.ticks.forEach(tt => {
      const gx = chartX(tt);
      page.drawLine({ start:{x:gx,y:yBot}, end:{x:gx,y:yRowTop}, thickness:0.5, color:rgb(0.75,0.75,0.75) });
    });

    // Balken HTB-Gelb
    if (t > 0) {
      const barH  = dataRowH * 0.60;
      const barY  = yBot + (dataRowH - barH) / 2;
      const barX0 = chartX(0);
      const barX1 = chartX(t);
      page.drawRectangle({ x:barX0, y:barY, width:Math.max(0.5, barX1-barX0), height:barH, color:rgb(1,0.929,0) });
    }

    yRowTop = yBot;
  }

  // Footer Zeile 1: Gesamtzeit [9][10]
  const fy1 = yRowTop - dataRowH;
  page.drawLine({ start:{x:x0,y:fy1}, end:{x:x0+W,y:fy1}, thickness:1, color:rgb(0,0,0) });
  page.drawText('Gesamtzeit:',   { x:x0+mm(1.5), y:fy1+mm(1.5), size:10, font:fontBold, color:rgb(0,0,0) });
  page.drawText(String(sumTime), { x:xC1+mm(1.5), y:fy1+mm(1.5), size:10, font, color:rgb(0,0,0) });
  page.drawText(meta.ed ? fmtComma(Number(meta.ed),2) : '', { x:xC2+mm(1.5), y:fy1+mm(1.5), size:10, font, color:rgb(0,0,0) });

  // Footer Zeile 2: Σ Rd [9][10]
  const fy2 = fy1 - dataRowH;
  page.drawLine({ start:{x:x0,y:fy2}, end:{x:x0+W,y:fy2}, thickness:1, color:rgb(0,0,0) });
  page.drawText('Σ Pfahlwiderstand Rd', { x:x0+mm(1.5), y:fy2+mm(1.5), size:10, font:fontBold, color:rgb(0,0,0) });
  page.drawText(fmtComma(sumRd,2), { x:xC1+mm(1.5), y:fy2+mm(1.5), size:10, font, color:rgb(0,0,0) });

  const ok = sumRd >= Number(meta.ed || 0);
  page.drawText(ok ? 'Rd ≥ Ed' : 'Rd < Ed', { x:xC2+mm(1.5), y:fy2+mm(1.5), size:10, font:fontBold, color:ok?rgb(0,0.5,0):rgb(0.8,0,0) });

  // Signaturzeilen [9][10]
  const signTop = y0 + mm(22);
  page.drawLine({ start:{x:x0,y:signTop}, end:{x:x0+W,y:signTop}, thickness:1, color:rgb(0,0,0) });
  page.drawLine({ start:{x:x0+W/2,y:y0}, end:{x:x0+W/2,y:signTop}, thickness:1, color:rgb(0,0,0) });
  page.drawText('AN ( Datum; Unterschrift)',      { x:x0+mm(2),     y:y0+mm(6), size:10, font, color:rgb(0,0,0) });
  page.drawText('AG/ ÖBA (Datum; Unterschrift)',  { x:x0+W/2+mm(2), y:y0+mm(6), size:10, font, color:rgb(0,0,0) });

  // Download (Dateiname = TTMMJJJJ) [10]
  const bytes = await pdf.save();
  const blob  = new Blob([bytes], { type: 'application/pdf' });
  const name  = `${dateTag()}.pdf`;
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// -------------------- AUTOSAVE EVENTS --------------------
function hookAutosave() {
  [
    'inp-datum','inp-projekt','inp-kostenstelle','inp-auftraggeber',
    'inp-traeger','inp-hammer','inp-pfahl-nr','inp-pfahltyp',
    'inp-schuh','inp-bodenart','inp-ed'
  ].forEach(id => {
    $(id)?.addEventListener('input',  () => { recalc(); saveDraftDebounced(); });
    $(id)?.addEventListener('change', () => { recalc(); saveDraftDebounced(); });
  });

  $('optIncludeKlammer')?.addEventListener('change', () => {
    state.includeKlammer = $('optIncludeKlammer').value === '1';
    recalc(); saveDraftDebounced();
  });

  $('btnReset')?.addEventListener('click', () => {
    timeInputs.forEach(inp => inp.value = '');
    noteInputs.forEach(inp => inp.value = '');
    $('timeLive').value = '0 s';
    state.timer.selectedIdx = 0;
    $('meterSelect').value = '0';
    recalc(); saveDraftDebounced();
  });

  $('btnS
