'use strict';

/* =========================================================
   HTB RAMMPFAHL – app.js (v2)
   Änderungen:
   - Erste Meter werden angerechnet (keine 1,5m-Sperre mehr)
   - Bemerkungsspalte entfernt
   - Zeitmessung per Start/Stop, Auto-Übernahme in Zeile, Auto-Weiter
   - PDF-Drucklayout im Stil deiner Vorlage [9]
   - Autosave/Restore in localStorage (interner Speicher)
   - Rd-Berechnung passend zur Bemessungstabelle (Ø220) [1]
========================================================= */

const STORAGE_KEY = 'htb-rammpfahl-protokoll-draft-v2';

const $ = (id) => document.getElementById(id);

// Tiefenstufen 0–24m (25 Zeilen à 1m)
const DEPTHS = Array.from({ length: 25 }, (_, i) => i);

/* Bemessungstabelle-Logik (sec/m-Klassen) aus deiner Vorlage [1]
   Wichtig: Die in der Tabelle angegebenen Rd/m-Werte bei Ø220 entsprechen qs * π * d
   (Sicherheitsbeiwert ist laut Tabelle bereits enthalten) [1].
*/
const SOIL_QS = {
  nichtbindig: {
    // sec/m Klasse -> qs (kN/m²)
    // gedrückt: 0
    qs_5_10: 40,      // (40) Klammerwert [1]
    qs_10_20: 80,
    qs_20_30: 120,
    qs_gt_30: 150
  },
  bindig: {
    qs_5_10: 20,      // (20) Klammerwert [1]
    qs_10_20: 40,     // (40) Klammerwert [1]
    qs_20_30: 70,
    qs_gt_30: 100
  }
};

function fmtComma(n, digits = 2) {
  return Number(n).toFixed(digits).replace('.', ',');
}

function depthLabel(d) {
  return `${d}-${d + 1}m`;
}

function qsFromTime(secPerM, bodenart) {
  const s = SOIL_QS[bodenart] || SOIL_QS.bindig;
  if (!secPerM || secPerM <= 0) return { qs: 0, isKlammer: false, cls: '—' };

  if (secPerM < 5) return { qs: 0, isKlammer: false, cls: 'gedrückt' };
  if (secPerM < 10) return { qs: s.qs_5_10, isKlammer: true, cls: '5-10' };
  if (secPerM < 20) {
    const isK = (bodenart === 'bindig'); // bei bindig ist 10-20 ebenfalls Klammerwert [1]
    return { qs: s.qs_10_20, isKlammer: isK, cls: '10-20' };
  }
  if (secPerM <= 30) return { qs: s.qs_20_30, isKlammer: false, cls: '20-30' };
  return { qs: s.qs_gt_30, isKlammer: false, cls: '>30' };
}

function rdPerMeter(secPerM, bodenart, schuhDmMm, includeKlammer) {
  const schuhM = (Number(schuhDmMm) || 220) / 1000;
  const { qs, isKlammer } = qsFromTime(secPerM, bodenart);
  if (!includeKlammer && isKlammer) return 0;
  // Rd/m = qs * π * d  (passt zu den Tabellenwerten bei Ø220) [1]
  return qs * Math.PI * schuhM;
}

/* ===================== DOM/STATE ===================== */
let timeInputs = []; 
let noteInputs = []; // NEU
const state = {
  timer: { running: false, startMs: 0, raf: null, selectedIdx: 0 },
  includeKlammer: false
};

function collectFormState() {
  return {
    v: 2,
    meta: {
      datum: $('inp-datum')?.value || '',
      pfahlNr: $('inp-pfahl-nr')?.value || '',
      projekt: $('inp-projekt')?.value || '',
      kostenstelle: $('inp-kostenstelle')?.value || '',
      auftraggeber: $('inp-auftraggeber')?.value || '',
      traeger: $('inp-traeger')?.value || '',
      hammer: $('inp-hammer')?.value || '',
      pfahltyp: $('inp-pfahltyp')?.value || '',
      schuh: $('inp-schuh')?.value || '',
      bodenart: $('inp-bodenart')?.value || 'bindig',
      ed: $('inp-ed')?.value || ''
    },
    includeKlammer: state.includeKlammer ? 1 : 0,
    times: DEPTHS.map((_, i) => timeInputs[i]?.value || ''),
    notes: DEPTHS.map((_, i) => noteInputs[i]?.value || '') // NEU
  };
}

function applyFormState(s) {
  if (!s || !s.meta) return;

  $('inp-datum').value = s.meta.datum || $('inp-datum').value;
  $('inp-pfahl-nr').value = s.meta.pfahlNr || '';
  $('inp-projekt').value = s.meta.projekt || '';
  $('inp-kostenstelle').value = s.meta.kostenstelle || '';
  $('inp-auftraggeber').value = s.meta.auftraggeber || '';
  $('inp-traeger').value = s.meta.traeger || '';
  $('inp-hammer').value = s.meta.hammer || '';
  if (s.meta.pfahltyp) $('inp-pfahltyp').value = s.meta.pfahltyp;
  if (s.meta.schuh) $('inp-schuh').value = s.meta.schuh;
  if (s.meta.bodenart) $('inp-bodenart').value = s.meta.bodenart;
  if (s.meta.ed) $('inp-ed').value = s.meta.ed;

  state.includeKlammer = !!Number(s.includeKlammer || 0);
  const opt = $('optIncludeKlammer');
  if (opt) opt.value = state.includeKlammer ? '1' : '0';

  if (Array.isArray(s.times)) {
    s.times.slice(0, 25).forEach((v, i) => {
      if (timeInputs[i]) timeInputs[i].value = v;
    });
  }
  // NEU: Anmerkungen laden
  if (Array.isArray(s.notes)) {
    s.notes.slice(0, 25).forEach((v, i) => {
      if (noteInputs[i]) noteInputs[i].value = v;
    });
  }
}
let saveT = null;
function saveDebounced() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormState()));
    } catch (_) {}
  }, 250);
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    applyFormState(s);
  } catch (_) {}
}

/* ===================== PROTOKOLL TABLE ===================== */
function buildMeterSelect() {
  const sel = $('meterSelect');
  if (!sel) return;
  sel.innerHTML = '';
  DEPTHS.forEach((d, i) => sel.appendChild(new Option(depthLabel(d), String(i))));
  sel.value = String(state.timer.selectedIdx || 0);
  sel.addEventListener('change', () => {
    state.timer.selectedIdx = Number(sel.value) || 0;
    saveDebounced();
  });
}

function buildProtocolTable() {
  const tbody = $('protoBody');
  tbody.innerHTML = '';
  timeInputs = [];
  noteInputs = []; // NEU

  DEPTHS.forEach((d, i) => {
    const tr = document.createElement('tr');

    const tdDepth = document.createElement('td');
    tdDepth.textContent = depthLabel(d);
    tr.appendChild(tdDepth);

    const tdTime = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '0';
    inp.step = '1';
    inp.placeholder = 'sec';
    inp.addEventListener('input', () => { recalc(); saveDebounced(); });
    timeInputs.push(inp);
    tdTime.appendChild(inp);
    tr.appendChild(tdTime);

    const tdRd = document.createElement('td');
    tdRd.className = 'rd-cell';
    tdRd.id = `rd-${i}`;
    tdRd.textContent = '0,00';
    tr.appendChild(tdRd);

    // NEU: Anmerkung-Spalte
    const tdNote = document.createElement('td');
    const noteInp = document.createElement('input');
    noteInp.type = 'text';
    noteInp.placeholder = 'Anmerkung...';
    noteInp.addEventListener('input', saveDebounced);
    noteInputs.push(noteInp);
    tdNote.appendChild(noteInp);
    tr.appendChild(tdNote);

    tbody.appendChild(tr);
  });
}

/* ===================== RECALC ===================== */
function recalc() {
  const bodenart = $('inp-bodenart').value;
  const schuhDm  = Number($('inp-schuh').value) || 220;
  const ed       = Number($('inp-ed').value) || 0;
  const includeK = state.includeKlammer;

  let sumRd = 0;
  let sumTime = 0;

  DEPTHS.forEach((_, i) => {
    const t = Number(timeInputs[i]?.value || 0);
    if (t > 0) sumTime += t;

    const rd = t > 0 ? rdPerMeter(t, bodenart, schuhDm, includeK) : 0;
    sumRd += rd;

    const rdEl = $(`rd-${i}`);
    if (rdEl) rdEl.textContent = fmtComma(rd, 2);
  });

  $('sumTime').textContent = `${sumTime} s`;
  $('sumRd').textContent = `${fmtComma(sumRd, 2)} kN`;

  const ok = sumRd >= ed;
  const sumResult = $('sumResult');
  sumResult.textContent = ok ? 'Rd ≥ Ed' : 'Rd < Ed';
  sumResult.className = 'sum-result ' + (ok ? 'ok' : 'err');
}

/* ===================== TIMER (Start/Stop) ===================== */
function setTimerUI() {
  const live = $('timeLive');
  const bS = $('btnTimeStart');
  const bP = $('btnTimeStop');
  if (!live || !bS || !bP) return;

  bS.disabled = state.timer.running;
  bP.disabled = !state.timer.running;
}

function timerTick() {
  if (!state.timer.running) return;
  const live = $('timeLive');
  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs) / 1000));
  if (live) live.value = `${sec} s`;
  state.timer.raf = requestAnimationFrame(timerTick);
}

function timerStart() {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.startMs = Date.now();
  const live = $('timeLive');
  if (live) live.value = '0 s';
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

  // Auto-weiter zum nächsten Meter
  const next = Math.min(DEPTHS.length - 1, idx + 1);
  state.timer.selectedIdx = next;
  const sel = $('meterSelect');
  if (sel) sel.value = String(next);

  const live = $('timeLive');
  if (live) live.value = `${sec} s`;

  recalc();
  saveDebounced();
  setTimerUI();
}

function initTimerControls() {
  $('btnTimeStart')?.addEventListener('click', timerStart);
  $('btnTimeStop')?.addEventListener('click', timerStopAndWrite);

  $('optIncludeKlammer')?.addEventListener('change', () => {
    state.includeKlammer = $('optIncludeKlammer').value === '1';
    recalc();
    saveDebounced();
  });
}

/* ===================== PDF EXPORT (Layout wie Vorlage) ===================== */
function exportPDF_likeTemplate() {
  // Layout/Bezeichnungen wie im Protokoll-PDF [9]
  const meta = collectFormState().meta;

  const pfahltypText = (() => {
    // im Select steht value (intern) – wir nehmen Anzeige-Text
    const sel = $('inp-pfahltyp');
    const txt = sel?.options?.[sel.selectedIndex]?.text || '';
    return txt || meta.pfahltyp || '';
  })();

  const bodenartText = (meta.bodenart === 'nichtbindig') ? 'nicht bindig' : 'bindig';
  const schuhText = `ø${Number(meta.schuh || 220)}mm`;

  const ed = Number(meta.ed || 0);
  const includeK = state.includeKlammer;

  // Tabellenzeilen + Summen
  let sumTime = 0;
  let sumRd = 0;

  let rowsHtml = '';
  DEPTHS.forEach((d, i) => {
    const t = Number(timeInputs[i]?.value || 0);
    if (t > 0) sumTime += t;

    const rd = t > 0 ? rdPerMeter(t, meta.bodenart, Number(meta.schuh || 220), includeK) : 0;
    sumRd += rd;

    rowsHtml += `
      <tr>
        <td class="c1">${depthLabel(d)}</td>
        <td class="c2">${t > 0 ? t : ''}</td>
        <td class="c3">${t > 0 ? fmtComma(rd, 2) : '0,00'}</td>
      </tr>
    `;
  });

  const ok = sumRd >= ed;

  const w = window.open('', '_blank');
  if (!w) { alert('Popup blockiert!'); return; }

  w.document.open();
  w.document.write(`<!doctype html><html><head>
<meta charset="utf-8"/>
<title>RAMMPFAHL-PROTOKOLL</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  body { font-family: Arial, sans-serif; color:#000; font-size:10px; }
  .sheet { width: 190mm; margin: 0 auto; }
  table { border-collapse: collapse; width: 100%; }
  .outer { border: 2px solid #000; }
  .outer td, .outer th { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
  .title { font-weight: 900; text-align: left; font-size: 11px; }
  .lbl { font-weight: 700; width: 18%; white-space: nowrap; }
  .val { width: 32%; }
  .rightLbl { font-weight: 700; width: 24%; white-space: nowrap; }
  .rightVal { width: 26%; }
  .subtle { font-weight: 700; }
  .protoHead th { font-weight: 900; text-align: left; }
  .proto td { height: 18px; }
  .c1 { width: 34%; }
  .c2 { width: 33%; }
  .c3 { width: 33%; }
  .footerRow td { font-weight: 700; }
  .sign td { height: 34px; }
  .resultCell { font-weight: 900; text-align: left; }
</style>
</head><body>
<div class="sheet">
  <table class="outer">
    <tr>
      <td class="title" colspan="4">RAMMPFAHL-PROTOKOLL RDS SPEZIAL TIEFBAU</td>
    </tr>
    <tr>
      <td class="lbl">Datum:</td><td class="val">${meta.datum || ''}</td>
      <td class="rightLbl">Kostenstelle:</td><td class="rightVal">${meta.kostenstelle || ''}</td>
    </tr>
    <tr>
      <td class="lbl">Projekt:</td><td class="val">${meta.projekt || ''}</td>
      <td class="rightLbl">Auftraggeber:</td><td class="rightVal">${meta.auftraggeber || ''}</td>
    </tr>
    <tr>
      <td class="lbl">Trägergerät:</td><td class="val">${meta.traeger || 'SK 270'}</td>
      <td class="rightLbl">Pfahlnummer:</td><td class="rightVal">${meta.pfahlNr || ''}</td>
    </tr>
    <tr>
      <td class="lbl">Hyd-hammer:</td><td class="val">${meta.hammer || 'Wimmer WH26'}</td>
      <td class="rightLbl">Pfahl-Bemessungslast [kN] :</td><td class="rightVal">${meta.ed ? fmtComma(Number(meta.ed), 2) : ''}</td>
    </tr>
    <tr>
      <td class="lbl">Pfahltyp:</td><td class="val">${pfahltypText}</td>
      <td class="rightLbl">${schuhText}</td><td class="rightVal">Bodenart: <span class="subtle">${bodenartText}</span></td>
    </tr>

    <tr>
      <td colspan="4" style="padding:0">
        <table class="proto" style="width:100%; border-collapse:collapse">
          <tr class="protoHead">
            <th class="c1">Eindring- tiefe[m]</th>
            <th class="c2">Zeit [sec]</th>
            <th class="c3">Rd&nbsp;&nbsp;&nbsp;&nbsp;[kN]</th>
          </tr>
          ${rowsHtml}
          <tr class="footerRow">
            <td>Gesamtzeit:</td>
            <td>${sumTime}</td>
            <td>${meta.ed ? fmtComma(Number(meta.ed), 2) : ''}</td>
          </tr>
          <tr class="footerRow">
            <td>Σ Pfahlwiderstand Rd</td>
            <td>${fmtComma(sumRd, 2)}</td>
            <td class="resultCell">${ok ? 'Rd ≥ Ed' : 'Rd < Ed'}</td>
          </tr>
        </table>
      </td>
    </tr>

    <tr class="sign">
      <td colspan="2">AN ( Datum; Unterschrift)</td>
      <td colspan="2">AG/ ÖBA (Datum; Unterschrift)</td>
    </tr>
  </table>

  <div style="margin-top:6px; font-size:9px; color:#444;">
    Hinweis: Druckdialog → Skalierung <b>100%</b>, Kopf-/Fußzeilen deaktivieren (für 1:1 Layout).
  </div>
</div>
<script>setTimeout(()=>window.print(), 250);<\/script>
</body></html>`);
  w.document.close();
}

/* ===================== EVENTS (Meta) ===================== */
function hookMetaAutosave() {
  [
    'inp-datum','inp-pfahl-nr','inp-projekt','inp-kostenstelle','inp-auftraggeber',
    'inp-traeger','inp-hammer','inp-pfahltyp','inp-schuh','inp-bodenart','inp-ed'
  ].forEach(id => {
    $(id)?.addEventListener('input', () => { recalc(); saveDebounced(); });
    $(id)?.addEventListener('change', () => { recalc(); saveDebounced(); });
     $('btnReset')?.addEventListener('click', () => {
    timeInputs.forEach(inp => inp.value = '');
    noteInputs.forEach(inp => inp.value = ''); // NEU
    $('timeLive').value = '0 s';
    state.timer.selectedIdx = 0;
    $('meterSelect').value = '0';
    recalc();
    saveDebounced();
  });
  });

  // Pfahltyp -> Schuh-Ø aus value "|...|...|220"
  $('inp-pfahltyp')?.addEventListener('change', () => {
    const v = $('inp-pfahltyp').value || '';
    const parts = v.split('|');
    if (parts[2]) $('inp-schuh').value = parts[2];
    recalc();
    saveDebounced();
  });

  $('btnPdf')?.addEventListener('click', exportPDF_likeTemplate);
  $('btnReset')?.addEventListener('click', () => {
    // Reset UI, aber Autosave läuft danach wieder
    timeInputs.forEach(inp => inp.value = '');
    $('timeLive').value = '0 s';
    state.timer.selectedIdx = 0;
    $('meterSelect').value = '0';
    recalc();
    saveDebounced();
  });
}

/* ===================== TABS + PWA SW (wie vorher) ===================== */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b === btn));
    document.querySelectorAll('.pane').forEach(p => {
      const on = p.id === `tab-${btn.dataset.tab}`;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
  });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ===================== INIT ===================== */
(function init() {
  // Heute vorbelegen (wie in Vorlage, aber dynamisch)
  if ($('inp-datum') && !$('inp-datum').value) $('inp-datum').value = new Date().toISOString().slice(0, 10);

  buildProtocolTable();
  buildMeterSelect();
  initTimerControls();

  // Restore gespeicherte Daten (interner Speicher)
  loadFromStorage();

  hookMetaAutosave();
  recalc();
  setTimerUI();
})();
