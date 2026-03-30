'use strict';

/**
 * HTB Rammpfahl – app.js
 * - Tabs (Protokoll/Bemessung/Varianten/Verlauf)
 * - Zeitmessung Start/Stop als Toggle (Button wird rot bei laufender Messung)
 * - Autosave Draft (localStorage)
 * - Verlauf (letzte Messungen lokal)
 * - PDF-Download (pdf-lib) mit Arial (arial.ttf) + optional Arial Bold (ARIALBD.TTF),
 *   Layout inkl. grauer Kopfzeile + Tabelle + Zeit-Tiefen-Balkendiagramm wie Vorlage [9][10]
 * - Rd/m Klassierung nach Bemessungstabelle (Ø220) [1]
 */

// -------------------- KONFIG --------------------
const DEPTHS = Array.from({ length: 25 }, (_, i) => i);

const STORAGE_DRAFT   = 'htb-rammpfahl-draft-v6';
const STORAGE_HISTORY = 'htb-rammpfahl-history-v6';
const HISTORY_MAX     = 30;

/**
 * Rd/m bei Ø220 aus der Bemessungstabelle (Äußerer Widerstand / Lastabtrag je m Pfahl) [1]
 * Klassen nach Eindringzeit (sec/m) + Bodenart
 */
const RD_PER_M_220 = {
  nichtbindig: {
    gedrueckt: 0.0,
    s5_10:     27.646015351590183,  // Klammerwert in Tabelle [1]
    s10_20:    55.292030703180366,
    s20_30:    82.93804605477055,
    gt30:      103.67255756846319
  },
  bindig: {
    gedrueckt: 0.0,
    s5_10:     13.823007675795091,  // Klammerwert in Tabelle [1]
    s10_20:    27.646015351590183,  // Klammerwert in Tabelle [1]
    s20_30:    48.38052686528282,
    gt30:      69.11503837897546
  }
};

// -------------------- DOM / STATE --------------------
const $ = (id) => document.getElementById(id);

let timeInputs = [];
let noteInputs = [];

const state = {
  includeKlammer: false,
  timer: { running: false, startMs: 0, raf: null, selectedIdx: 0 }
};

// -------------------- HELPER --------------------
function fmtComma(n, digits = 2) {
  return Number(n || 0).toFixed(digits).replace('.', ',');
}
function depthLabel(i) {
  return `${i}-${i + 1}m`;
}
function dateTag(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`; // TTMMJJJJ
}

function secClass(sec) {
  if (!sec || sec <= 0) return null;
  if (sec < 5) return 'gedrueckt';
  if (sec < 10) return 's5_10';
  if (sec < 20) return 's10_20';
  if (sec <= 30) return 's20_30';
  return 'gt30';
}

function isKlammerClass(bodenart, cls) {
  if (!cls) return false;
  if (bodenart === 'nichtbindig') return cls === 's5_10';
  // bindig: 5-10 und 10-20 sind Klammerwerte [1]
  return (cls === 's5_10' || cls === 's10_20');
}

/**
 * Rd pro Meter aus Zeitklasse + Bodenart.
 * Tabelle ist für Ø220 [1], wir skalieren proportional mit d_Schuh (Rd ∝ d).
 */
function rdFromSec(sec, bodenart, schuhMm, includeKlammer) {
  const cls = secClass(sec);
  if (!cls) return 0;

  const base = (RD_PER_M_220[bodenart] || RD_PER_M_220.bindig)[cls] || 0;
  if (!includeKlammer && isKlammerClass(bodenart, cls)) return 0;

  const d = Number(schuhMm) || 220;
  return base * (d / 220);
}

/**
 * "Schöne" Achsenskalierung (Auto-Skala fürs Diagramm – passt sich Max-Zeit an)
 */
function niceTicks(maxVal, targetSteps = 4) {
  const max = Math.max(0, Number(maxVal) || 0);
  if (max <= 0) return { max: 10, step: 2, ticks: [0, 2, 4, 6, 8, 10] };

  const rawStep = max / Math.max(1, targetSteps);
  const pow10 = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const err = rawStep / pow10;

  let step;
  if (err >= 7.5) step = 10 * pow10;
  else if (err >= 3.5) step = 5 * pow10;
  else if (err >= 1.5) step = 2 * pow10;
  else step = 1 * pow10;

  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = 0; t <= niceMax + 1e-9; t += step) ticks.push(t);
  return { max: niceMax, step, ticks };
}

// -------------------- TABS --------------------
function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b === btn));
      document.querySelectorAll('.pane').forEach((p) => {
        const on = p.id === `tab-${btn.dataset.tab}`;
        p.classList.toggle('is-active', on);
        p.hidden = !on;
      });

      if (btn.dataset.tab === 'verlauf') renderHistoryList();
    });
  });
}

// -------------------- DRAFT (Autosave) --------------------
function collectFormState() {
  return {
    v: 6,
    meta: {
      datum: $('inp-datum')?.value || '',
      projekt: $('inp-projekt')?.value || '',
      kostenstelle: $('inp-kostenstelle')?.value || '',
      auftraggeber: $('inp-auftraggeber')?.value || '',
      traeger: $('inp-traeger')?.value || '',
      hammer: $('inp-hammer')?.value || '',
      pfahlNr: $('inp-pfahl-nr')?.value || '',
      pfahltyp: $('inp-pfahltyp')?.value || '',
      schuh: $('inp-schuh')?.value || '220',
      bodenart: $('inp-bodenart')?.value || 'bindig',
      ed: $('inp-ed')?.value || ''
    },
    includeKlammer: state.includeKlammer ? 1 : 0,
    meterIdx: state.timer.selectedIdx || 0,
    times: DEPTHS.map((_, i) => timeInputs[i]?.value || ''),
    notes: DEPTHS.map((_, i) => noteInputs[i]?.value || '')
  };
}

function applyFormState(s) {
  if (!s || !s.meta) return;

  $('inp-datum').value = s.meta.datum || $('inp-datum').value;
  $('inp-projekt').value = s.meta.projekt || '';
  $('inp-kostenstelle').value = s.meta.kostenstelle || '';
  $('inp-auftraggeber').value = s.meta.auftraggeber || '';
  $('inp-traeger').value = s.meta.traeger || 'SK 270';
  $('inp-hammer').value = s.meta.hammer || 'Wimmer WH26';
  $('inp-pfahl-nr').value = s.meta.pfahlNr || '1';
  $('inp-pfahltyp').value = s.meta.pfahltyp || $('inp-pfahltyp').value;
  $('inp-schuh').value = s.meta.schuh || '220';
  $('inp-bodenart').value = s.meta.bodenart || 'bindig';
  $('inp-ed').value = s.meta.ed || '350.60';

  state.includeKlammer = !!Number(s.includeKlammer || 0);
  $('optIncludeKlammer').value = state.includeKlammer ? '1' : '0';

  (s.times || []).slice(0, 25).forEach((v, i) => { if (timeInputs[i]) timeInputs[i].value = v; });
  (s.notes || []).slice(0, 25).forEach((v, i) => { if (noteInputs[i]) noteInputs[i].value = v; });

  state.timer.selectedIdx = Number(s.meterIdx || 0);
  const sel = $('meterSelect');
  if (sel) sel.value = String(state.timer.selectedIdx);
}

let saveDraftT = null;
function saveDraftDebounced() {
  clearTimeout(saveDraftT);
  saveDraftT = setTimeout(() => {
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

// -------------------- VERLAUF (History) --------------------
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
  const schuh = Number(snap.meta?.schuh || 220);
  const ed = Number(snap.meta?.ed || 0);
  const includeK = !!Number(snap.includeKlammer || 0);

  let sumTime = 0;
  let sumRd = 0;

  (snap.times || []).slice(0, 25).forEach((tv) => {
    const t = Number(tv || 0);
    if (t > 0) sumTime += t;
    sumRd += rdFromSec(t, bodenart, schuh, includeK);
  });

  return { sumTime, sumRd, ed, ok: sumRd >= ed };
}

function saveCurrentToHistory() {
  const snap = collectFormState();
  const sums = sumsFromSnapshot(snap);

  const entry = {
    id: uid(),
    savedAt: Date.now(),
    title: `${snap.meta?.projekt || '—'} · Pfahl ${snap.meta?.pfahlNr || '—'}`,
    snap,
    sums
  };

  const list = readHistory();
  list.unshift(entry);
  writeHistory(list);
  renderHistoryList();
}

function deleteHistory(id) {
  writeHistory(readHistory().filter((e) => e.id !== id));
  renderHistoryList();
}

function loadHistoryToForm(id) {
  const entry = readHistory().find((e) => e.id === id);
  if (!entry) return;
  applyFormState(entry.snap);
  recalc();
  saveDraftDebounced();
  document.querySelector('.tab[data-tab="protokoll"]')?.click();
}

function renderHistoryList() {
  const host = $('historyList');
  if (!host) return;

  const list = readHistory();
  if (!list.length) {
    host.innerHTML = `<div class="text"><p>Noch keine gespeicherten Messungen.</p></div>`;
    return;
  }

  host.innerHTML = '';
  list.forEach((entry) => {
    const s = entry.sums || sumsFromSnapshot(entry.snap);

    const div = document.createElement('div');
    div.className = 'historyItem';
    div.innerHTML = `
      <div class="historyTop">
        <div>${entry.title}</div>
        <div style="color:var(--muted);font-size:.85em;font-weight:800">
          ${new Date(entry.savedAt).toLocaleString('de-DE')}
        </div>
      </div>
      <div class="historySub">
        Gesamtzeit: <b>${s.sumTime} s</b> · ΣRd: <b>${fmtComma(s.sumRd,2)} kN</b> · Ed: <b>${fmtComma(s.ed,2)} kN</b> ·
        Status: <b style="color:${s.ok ? 'var(--ok)' : 'var(--err)'}">${s.ok ? 'Rd ≥ Ed' : 'Rd < Ed'}</b>
      </div>
      <div class="historyBtns">
        <button class="btn btn--ghost" type="button" data-act="load" data-id="${entry.id}">Laden</button>
        <button class="btn btn--ghost" type="button" data-act="pdf"  data-id="${entry.id}">PDF</button>
        <button class="btn btn--ghost" type="button" data-act="del"  data-id="${entry.id}">Löschen</button>
      </div>
    `;
    host.appendChild(div);
  });

  host.querySelectorAll('button[data-act]').forEach((b) => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      const act = b.dataset.act;

      if (act === 'del') deleteHistory(id);
      if (act === 'load') loadHistoryToForm(id);
      if (act === 'pdf') {
        const entry = readHistory().find((e) => e.id === id);
        if (!entry) return;
        await exportPdfDownload(entry.snap);
      }
    });
  });
}

// -------------------- UI: Meter Select + Protokoll-Tabelle --------------------
function buildMeterSelect() {
  const sel = $('meterSelect');
  if (!sel) return;

  sel.innerHTML = '';
  DEPTHS.forEach((_, i) => sel.appendChild(new Option(depthLabel(i), String(i))));
  sel.value = String(state.timer.selectedIdx || 0);

  sel.addEventListener('change', () => {
    state.timer.selectedIdx = Number(sel.value) || 0;
    saveDraftDebounced();
  });
}

function buildProtocolTable() {
  const tbody = $('protoBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  timeInputs = [];
  noteInputs = [];

  DEPTHS.forEach((_, i) => {
    const tr = document.createElement('tr');

    const tdD = document.createElement('td');
    tdD.textContent = depthLabel(i);
    tr.appendChild(tdD);

    const tdT = document.createElement('td');
    const inpT = document.createElement('input');
    inpT.type = 'number';
    inpT.min = '0';
    inpT.step = '1';
    inpT.placeholder = '';
    inpT.addEventListener('input', () => { recalc(); saveDraftDebounced(); });
    timeInputs.push(inpT);
    tdT.appendChild(inpT);
    tr.appendChild(tdT);

    const tdR = document.createElement('td');
    tdR.className = 'rd-cell';
    tdR.id = `rd-${i}`;
    tdR.textContent = '0,00';
    tr.appendChild(tdR);

    const tdN = document.createElement('td');
    const inpN = document.createElement('input');
    inpN.type = 'text';
    inpN.placeholder = '';
    inpN.addEventListener('input', saveDraftDebounced);
    noteInputs.push(inpN);
    tdN.appendChild(inpN);
    tr.appendChild(tdN);

    tbody.appendChild(tr);
  });
}

// -------------------- RECALC --------------------
function recalc() {
  const bodenart = $('inp-bodenart')?.value || 'bindig';
  const schuh = Number($('inp-schuh')?.value || 220);
  const ed = Number($('inp-ed')?.value || 0);
  const includeK = state.includeKlammer;

  let sumTime = 0;
  let sumRd = 0;

  DEPTHS.forEach((_, i) => {
    const t = Number(timeInputs[i]?.value || 0);
    if (t > 0) sumTime += t;

    const rd = rdFromSec(t, bodenart, schuh, includeK);
    sumRd += rd;

    const el = $(`rd-${i}`);
    if (el) el.textContent = fmtComma(rd, 2);
  });

  if ($('sumTime')) $('sumTime').textContent = String(sumTime);
  if ($('sumRd')) $('sumRd').textContent = fmtComma(sumRd, 2);

  const ok = sumRd >= ed;
  const res = $('sumResult');
  if (res) {
    res.textContent = ok ? 'Rd ≥ Ed' : 'Rd < Ed';
    res.className = 'sum-result ' + (ok ? 'ok' : 'err');
  }
}

// -------------------- TIMER (Toggle Button) --------------------
function timerSetButtonUI() {
  const btn = $('btnTimeToggle');
  if (!btn) return;

  if (state.timer.running) {
    btn.textContent = 'Stop';
    btn.classList.remove('btn--accent');
    btn.classList.add('btn--stop');
  } else {
    btn.textContent = 'Start';
    btn.classList.remove('btn--stop');
    btn.classList.add('btn--accent');
  }
}

function timerTick() {
  if (!state.timer.running) return;
  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs) / 1000));
  const live = $('timeLive');
  if (live) live.value = `${sec} s`;
  state.timer.raf = requestAnimationFrame(timerTick);
}

function timerStart() {
  state.timer.running = true;
  state.timer.startMs = Date.now();
  const live = $('timeLive');
  if (live) live.value = '0 s';
  timerSetButtonUI();
  timerTick();
}

function timerStopWriteAdvance() {
  state.timer.running = false;
  if (state.timer.raf) cancelAnimationFrame(state.timer.raf);
  state.timer.raf = null;

  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs) / 1000));
  const idx = state.timer.selectedIdx || 0;

  if (timeInputs[idx]) timeInputs[idx].value = String(sec);

  // auto-weiter
  const next = Math.min(DEPTHS.length - 1, idx + 1);
  state.timer.selectedIdx = next;
  const sel = $('meterSelect');
  if (sel) sel.value = String(next);

  const live = $('timeLive');
  if (live) live.value = `${sec} s`;

  recalc();
  saveDraftDebounced();
  timerSetButtonUI();
}

function timerToggle() {
  if (state.timer.running) timerStopWriteAdvance();
  else timerStart();
}

function formatDateDE_TTMMJJJJ(isoOrAny) {
  // erwartet meist "YYYY-MM-DD" aus <input type="date">
  const s = String(isoOrAny || '').trim();
  if (!s) return '';
  // schon TT.MM.JJJJ?
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
  // ISO?
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  // Fallback: versuche Date.parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }
  return s;
}

function textWidth(font, size, text) {
  try { return font.widthOfTextAtSize(String(text || ''), size); }
  catch { return 999999; }
}

function drawTextFit(page, text, x, y, maxWidth, font, size, color) {
  let s = size;
  const min = 6;
  const t = String(text ?? '');
  while (s > min && textWidth(font, s, t) > maxWidth) s -= 0.25;
  page.drawText(t, { x, y, size: s, font, color });
  return s;
}

function wrapLines(text, font, size, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? (cur + ' ' + w) : w;
    if (textWidth(font, size, test) <= maxWidth) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawTextWrap(page, text, x, yTop, maxWidth, font, size, lineHeight, color, maxLines = 2) {
  const lines = wrapLines(text, font, size, maxWidth).slice(0, maxLines);
  lines.forEach((ln, i) => {
    page.drawText(ln, { x, y: yTop - i * lineHeight, size, font, color });
  });
  return lines.length;
}

// -------------------- PDF EXPORT (Download, Arial, Layout wie Vorlage) --------------------
async function exportPdfDownload(optionalSnap = null) {
  const snap = optionalSnap || collectFormState();
  const meta = snap.meta || {};

  if (!window.PDFLib || !window.fontkit) {
    alert('PDF-Library/Fontkit noch nicht geladen. Bitte einmal online laden (wird danach gecached).');
    return;
  }

  const { PDFDocument, rgb, degrees } = window.PDFLib;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(window.fontkit);

  // Fonts: Arial Regular + optional Bold
  let fontReg, fontBold;
  try {
    const arialBytes = await fetch('arial.ttf').then(r => r.arrayBuffer());
    fontReg = await pdf.embedFont(arialBytes, { subset: true });
    try {
      const arialBoldBytes = await fetch('ARIALBD.TTF').then(r => r.arrayBuffer());
      fontBold = await pdf.embedFont(arialBoldBytes, { subset: true });
    } catch {
      fontBold = fontReg;
    }
  } catch {
    const { StandardFonts } = window.PDFLib;
    fontReg  = await pdf.embedFont(StandardFonts.Helvetica);
    fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  // Logo
  let logoImg = null;
  try {
    const logoBytes = await fetch('logo.png').then(r => r.arrayBuffer());
    logoImg = await pdf.embedPng(logoBytes);
  } catch {}

  const page = pdf.addPage([595.28, 841.89]); // A4
  const mm = (v) => v * 72 / 25.4;
  const black = rgb(0, 0, 0);

  const margin = mm(10);
  const x0 = margin, y0 = margin;
  const W = 595.28 - 2 * margin;
  const H = 841.89 - 2 * margin;

  // Rahmen
  page.drawRectangle({ x: x0, y: y0, width: W, height: H, borderColor: black, borderWidth: 1.5 });

  // ========= Kopfzeile höher + fett =========
  const headerH = mm(14); // höher als vorher
  page.drawRectangle({
    x: x0, y: y0 + H - headerH, width: W, height: headerH,
    color: rgb(0.88, 0.88, 0.88), borderColor: black, borderWidth: 1
  });

  if (logoImg) {
    const lh = headerH * 0.78;
    const s = lh / logoImg.height;
    page.drawImage(logoImg, {
      x: x0 + mm(2),
      y: y0 + H - headerH + (headerH - lh) / 2,
      width: logoImg.width * s,
      height: lh
    });
  }

  // Titel wie gewünscht (fett)
  page.drawText('Rammpfahl-Protokoll', {
    x: x0 + mm(33),
    y: y0 + H - headerH + mm(4.2),
    size: 13,
    font: fontBold,
    color: black
  });

  const drawHLine = (y, thick = 1) =>
    page.drawLine({ start: { x: x0, y }, end: { x: x0 + W, y }, thickness: thick, color: black });

  // ========= Meta-Block =========
  const rowH = mm(8);
  let cy = y0 + H - headerH - rowH;
  const midX = x0 + W * 0.5;

  // Value-Start weiter rechts -> mehr Abstand nach ":" (insb. Bemessungslast)
  const LEFT_VAL_X  = x0 + mm(32);
  const RIGHT_VAL_X = midX + mm(62); // vorher ~45mm, jetzt deutlich mehr Abstand

  function metaRow(l1, v1, l2, v2) {
    drawHLine(cy, 1);
    page.drawLine({ start: { x: midX, y: cy }, end: { x: midX, y: cy + rowH }, thickness: 1, color: black });

    page.drawText(l1, { x: x0 + mm(2), y: cy + mm(2.2), size: 10, font: fontBold, color: black });

    const leftMaxW = (midX - mm(2)) - LEFT_VAL_X;
    drawTextFit(page, String(v1 || ''), LEFT_VAL_X, cy + mm(2.2), leftMaxW, fontReg, 10, black);

    page.drawText(l2, { x: midX + mm(2), y: cy + mm(2.2), size: 10, font: fontBold, color: black });

    const rightMaxW = (x0 + W - mm(2)) - RIGHT_VAL_X;
    drawTextFit(page, String(v2 || ''), RIGHT_VAL_X, cy + mm(2.2), rightMaxW, fontReg, 10, black);

    cy -= rowH;
  }

  drawHLine(y0 + H - headerH, 1);

  // Datum: TT.MM.JJJJ
  const dateDE = formatDateDE_TTMMJJJJ(meta.datum || '');
  metaRow('Datum:', dateDE, 'Kostenstelle:', meta.kostenstelle);
  metaRow('Projekt:', meta.projekt, 'Auftraggeber:', meta.auftraggeber);
  metaRow('Trägergerät:', meta.traeger || 'SK 270', 'Pfahlnummer:', meta.pfahlNr);

  // Hier wichtig: Label exakt mit " :"
  metaRow('Hyd-hammer:', meta.hammer || 'Wimmer WH26', 'Pfahl-Bemessungslast [kN] :', meta.ed ? fmtComma(Number(meta.ed), 2) : '');

  // Pfahltyp + Ø direkt nebeneinander (wie du willst): 118×7,5mm Ø220mm
  const pfahlPretty = String(meta.pfahltyp || '').replace(/x/gi, '×');
  const pfahlMitD = `${pfahlPretty} Ø${Number(meta.schuh || 220)}mm`;
  metaRow('Pfahltyp:', pfahlMitD, 'Bodenart:', meta.bodenart || '');

  // ========= Tabelle + Diagramm =========
  const tableTop = cy + rowH;
  const tableBottom = y0 + mm(28);
  const tH = tableTop - tableBottom;

  const leftW = W * 0.52;
  const rightW = W - leftW;
  const th = mm(7);

  // Header backgrounds
  page.drawRectangle({ x: x0, y: tableTop - th, width: leftW, height: th, color: rgb(0.93,0.93,0.93), borderColor: black, borderWidth: 1 });
  page.drawRectangle({ x: x0 + leftW, y: tableTop - th, width: rightW, height: th, color: rgb(0.93,0.93,0.93), borderColor: black, borderWidth: 1 });

  // ======= Spaltenbreiten anpassen =======
  // Eindringtiefe breiter + damit auch Σ Pfahlwiderstand Platz hat
  const c1 = leftW * 0.30; // war 0.23 -> breiter
  const c2 = leftW * 0.16;
  const c3 = leftW * 0.16;
  const xC1 = x0 + c1;
  const xC2 = xC1 + c2;
  const xC3 = xC2 + c3;

  [xC1, xC2, xC3].forEach((xx) => {
    page.drawLine({ start: { x: xx, y: tableBottom }, end: { x: xx, y: tableTop }, thickness: 1, color: black });
  });

  // Separator table/chart
  const chartX0 = x0 + leftW;
  page.drawLine({ start: { x: chartX0, y: tableBottom }, end: { x: chartX0, y: tableTop }, thickness: 1, color: black });

  // Header texts (fett)
  page.drawText('Eindringtiefe [m]', { x: x0 + mm(1.5), y: tableTop - th + mm(2.2), size: 9, font: fontBold, color: black });
  page.drawText('Zeit [sec]',       { x: xC1 + mm(1.5), y: tableTop - th + mm(2.2), size: 9, font: fontBold, color: black });
  page.drawText('Rd [kN]',          { x: xC2 + mm(1.5), y: tableTop - th + mm(2.2), size: 9, font: fontBold, color: black });
  page.drawText('Anmerkung',        { x: xC3 + mm(1.5), y: tableTop - th + mm(2.2), size: 9, font: fontBold, color: black });

  // ========= Diagramm: Achsen + keine durchgehenden Linien =========
  const times = (snap.times || []).slice(0, 25).map(v => Number(v || 0));
  const maxT = Math.max(0, ...times);
  const scale = niceTicks(maxT, 4);
  const xMax = Math.max(1, scale.max);

  const innerL = chartX0 + mm(18);
  const innerR = chartX0 + rightW - mm(4);
  const innerW = innerR - innerL;
  const chartX = (v) => innerL + (Math.max(0, Math.min(xMax, v)) / xMax) * innerW;

  const chartTop = tableTop - th;
  const chartBottom = tableBottom;

  // X-Achse (oben) + Tickmarks (kurz)
  page.drawLine({ start: { x: innerL, y: chartTop }, end: { x: innerR, y: chartTop }, thickness: 0.9, color: black });

  // Y-Achse (links) einzeichnen
  page.drawLine({ start: { x: innerL, y: chartBottom }, end: { x: innerL, y: chartTop }, thickness: 0.9, color: black });

  // Achsenbeschriftung
  page.drawText('Zeit [sec]', { x: innerR - mm(18), y: chartBottom + mm(2.2), size: 9, font: fontBold, color: black });
  page.drawText('Eindringtiefe [m]', {
    x: innerL - mm(12),
    y: chartBottom + mm(2),
    size: 9,
    font: fontBold,
    color: black,
    rotate: degrees(90)
  });

  // Tick-Labels oben + kurze Tickmarks (keine durchgängigen Gridlines)
  scale.ticks.forEach((t) => {
    const gx = chartX(t);
    page.drawText(String(t), { x: gx - mm(2), y: tableTop - th + mm(2.1), size: 8, font: fontReg, color: black });
    page.drawLine({ start: { x: gx, y: chartTop }, end: { x: gx, y: chartTop - mm(2.2) }, thickness: 0.9, color: black });
  });

  // Zeilen
  const dataRowH = (tH - th - mm(12)) / (25 + 2);
  let yRowTop = tableTop - th;

  const bodenart = meta.bodenart || 'bindig';
  const schuhMm = Number(meta.schuh || 220);
  const includeK = !!Number(snap.includeKlammer || 0);

  let sumTime = 0;
  let sumRd = 0;

  for (let i = 0; i < 25; i++) {
    const yBot = yRowTop - dataRowH;

    // Zeilenlinie nur in Tabelle links (nicht durchs Diagramm)
    page.drawLine({ start: { x: x0, y: yBot }, end: { x: x0 + leftW, y: yBot }, thickness: 1, color: black });

    const t = Number(snap.times?.[i] || 0);
    const note = String(snap.notes?.[i] || '');
    if (t > 0) sumTime += t;

    const rd = rdFromSec(t, bodenart, schuhMm, includeK);
    sumRd += rd;

    // Tabelle links
    page.drawText(depthLabel(i), { x: x0 + mm(1.5), y: yBot + mm(1.5), size: 9.5, font: fontReg, color: black });
    if (t > 0) page.drawText(String(t), { x: xC1 + mm(1.5), y: yBot + mm(1.5), size: 9.5, font: fontReg, color: black });
    page.drawText(fmtComma(rd, 2), { x: xC2 + mm(1.5), y: yBot + mm(1.5), size: 9.5, font: fontReg, color: black });

    const noteMaxW = (x0 + leftW - mm(2)) - (xC3 + mm(1.5));
    if (note) drawTextFit(page, note, xC3 + mm(1.5), yBot + mm(1.5), noteMaxW, fontReg, 9, black);

    // Diagrammbalken: gelb + schwarze Umrandung
    if (t > 0) {
      const barH = dataRowH * 0.60;
      const barY = yBot + (dataRowH - barH) / 2;
      page.drawRectangle({
        x: chartX(0),
        y: barY,
        width: Math.max(0.5, chartX(t) - chartX(0)),
        height: barH,
        color: rgb(1, 0.929, 0),
        borderColor: black,
        borderWidth: 0.6
      });
    }

    yRowTop = yBot;
  }

  // Footer (nur links Linien)
  const fy1 = yRowTop - dataRowH;
  page.drawLine({ start: { x: x0, y: fy1 }, end: { x: x0 + leftW, y: fy1 }, thickness: 1, color: black });

  page.drawText('Gesamtzeit:', { x: x0 + mm(1.5), y: fy1 + mm(1.5), size: 10, font: fontBold, color: black });
  page.drawText(String(sumTime), { x: xC1 + mm(1.5), y: fy1 + mm(1.5), size: 10, font: fontReg, color: black });
  if (meta.ed) page.drawText(fmtComma(Number(meta.ed), 2), { x: xC3 + mm(1.5), y: fy1 + mm(1.5), size: 10, font: fontReg, color: black });

  const fy2 = fy1 - dataRowH;
  page.drawLine({ start: { x: x0, y: fy2 }, end: { x: x0 + leftW, y: fy2 }, thickness: 1, color: black });

  // Σ Pfahlwiderstand: jetzt hat c1 mehr Breite, zusätzlich Wrap als Sicherheit
  const sigmaMaxW = (xC1 - mm(2)) - (x0 + mm(1.5));
  drawTextWrap(page, 'Σ Pfahlwiderstand Rd', x0 + mm(1.5), fy2 + mm(4.8), sigmaMaxW, fontBold, 9.5, 10, black, 2);

  page.drawText(fmtComma(sumRd, 2), { x: xC1 + mm(1.5), y: fy2 + mm(1.5), size: 10, font: fontReg, color: black });

  const edNum = Number(meta.ed || 0);
  const ok = sumRd >= edNum;
  page.drawText(ok ? 'Rd ≥ Ed' : 'Rd < Ed', {
    x: xC3 + mm(1.5),
    y: fy2 + mm(1.5),
    size: 10,
    font: fontBold,
    color: ok ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0)
  });

  // Signaturbereich
  const signTop = y0 + mm(22);
  page.drawLine({ start: { x: x0, y: signTop }, end: { x: x0 + W, y: signTop }, thickness: 1, color: black });
  page.drawLine({ start: { x: x0 + W / 2, y: y0 }, end: { x: x0 + W / 2, y: signTop }, thickness: 1, color: black });

  page.drawText('AN ( Datum; Unterschrift)', { x: x0 + mm(2), y: y0 + mm(6), size: 10, font: fontReg, color: black });
  page.drawText('AG/ ÖBA (Datum; Unterschrift)', { x: x0 + W / 2 + mm(2), y: y0 + mm(6), size: 10, font: fontReg, color: black });

  // Download
  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const name = `${dateTag(new Date())}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
// -------------------- EVENTS --------------------
function hookEvents() {
  // meta inputs autosave + recalc
  [
    'inp-datum','inp-projekt','inp-kostenstelle','inp-auftraggeber',
    'inp-traeger','inp-hammer','inp-pfahl-nr','inp-pfahltyp',
    'inp-schuh','inp-bodenart','inp-ed'
  ].forEach((id) => {
    $(id)?.addEventListener('input', () => { recalc(); saveDraftDebounced(); });
    $(id)?.addEventListener('change', () => { recalc(); saveDraftDebounced(); });
  });

  $('optIncludeKlammer')?.addEventListener('change', () => {
    state.includeKlammer = $('optIncludeKlammer').value === '1';
    recalc();
    saveDraftDebounced();
  });

  $('btnTimeToggle')?.addEventListener('click', timerToggle);

  $('btnReset')?.addEventListener('click', () => {
    // stop timer if running
    if (state.timer.running) {
      state.timer.running = false;
      if (state.timer.raf) cancelAnimationFrame(state.timer.raf);
      state.timer.raf = null;
    }

    timeInputs.forEach((i) => (i.value = ''));
    noteInputs.forEach((i) => (i.value = ''));

    const live = $('timeLive');
    if (live) live.value = '0 s';

    state.timer.selectedIdx = 0;
    const sel = $('meterSelect');
    if (sel) sel.value = '0';

    timerSetButtonUI();
    recalc();
    saveDraftDebounced();
  });

  $('btnSave')?.addEventListener('click', () => {
    saveCurrentToHistory();
    alert('Messung im Verlauf gespeichert.');
  });

  $('btnPdf')?.addEventListener('click', async () => {
    await exportPdfDownload();
  });
}

// -------------------- INIT --------------------
window.addEventListener('DOMContentLoaded', () => {
  // Default date
  if ($('inp-datum') && !$('inp-datum').value) {
    $('inp-datum').value = new Date().toISOString().slice(0, 10);
  }

  initTabs();
  buildProtocolTable();
  buildMeterSelect();
  timerSetButtonUI();

  hookEvents();

  // load draft after table inputs exist
  loadDraft();
  recalc();
  renderHistoryList();

  // SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
