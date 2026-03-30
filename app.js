'use strict';
// ===================== DATEN =====================

const BODEN_DATA = {
  nichtbindig: [
    { label: 'sehr locker',  secM: 'gedrückt', qs: 0,   klammer: false },
    { label: 'locker',       secM: '5 – 10',   qs: 40,  klammer: true  },
    { label: 'mitteldicht',  secM: '10 – 20',  qs: 80,  klammer: false },
    { label: 'dicht',        secM: '20 – 30',  qs: 120, klammer: false },
    { label: 'sehr dicht',   secM: '> 30',     qs: 150, klammer: false },
  ],
  bindig: [
    { label: 'sehr locker',  secM: 'gedrückt', qs: 0,   klammer: false },
    { label: 'locker',       secM: '5 – 10',   qs: 20,  klammer: true  },
    { label: 'mitteldicht',  secM: '10 – 20',  qs: 40,  klammer: true  },
    { label: 'dicht',        secM: '20 – 30',  qs: 70,  klammer: false },
    { label: 'sehr dicht',   secM: '> 30',     qs: 100, klammer: false },
  ]
};

const TRM_PRODUCTS = [
  { name:'TRM98/6',      fy:320, od:98,    id:86,    ws:6,    ks:1734.16, kgm:14.04,  preis:17.10  },
  { name:'TRM98/7,5',    fy:320, od:98,    id:83,    ws:7.5,  ks:2132.36, kgm:12.7,   preis:19.83  },
  { name:'TRM118/6',     fy:320, od:118,   id:106,   ws:6,    ks:2111.15, kgm:16.57,  preis:19.02  },
  { name:'TRM118/7,5',   fy:320, od:118,   id:103,   ws:7.5,  ks:2603.59, kgm:21.0,   preis:22.06  },
  { name:'TRM118/9',     fy:320, od:118,   id:100,   ws:9,    ks:3081.90, kgm:24.4,   preis:25.62  },
  { name:'TRM118/10,6',  fy:320, od:118,   id:96.8,  ws:10.6, ks:3576.51, kgm:28.0,   preis:29.40  },
  { name:'TRM170/7,5',   fy:320, od:170,   id:155,   ws:7.5,  ks:3828.82, kgm:33.8,   preis:32.43  },
  { name:'TRM170/9',     fy:320, od:170,   id:152,   ws:9,    ks:4552.17, kgm:37.1,   preis:35.48  },
  { name:'TRM170/10,6',  fy:320, od:170,   id:148.8, ws:10.6, ks:5308.16, kgm:42.5,   preis:40.63  },
  { name:'TRM170/13',    fy:320, od:170,   id:144,   ws:13,   ks:6411.99, kgm:50.4,   preis:47.45  },
];

const SSAB_PRODUCTS = [
  { name:'RR75/6,3',    grade:'S440J2H', fy:440, od:76.1,  id:63.5,  ws:6.3,  ks:1381.48, kgm:10.84, preis:0 },
  { name:'RR90/6,3',    grade:'S440J2H', fy:440, od:88.9,  id:76.3,  ws:6.3,  ks:1634.82, kgm:12.83, preis:0 },
  { name:'RRs100/6,3',  grade:'S550J2H', fy:550, od:101.6, id:89.0,  ws:6.3,  ks:1886.18, kgm:14.81, preis:0 },
  { name:'RR115/6,3',   grade:'S440J2H', fy:440, od:115,   id:102.4, ws:6.3,  ks:2151.39, kgm:16.89, preis:0 },
  { name:'RR115/8',     grade:'S440J2H', fy:440, od:115,   id:99,    ws:8,    ks:2689.20, kgm:21.11, preis:0 },
  { name:'RRs140/8',    grade:'S550J2H', fy:550, od:139.7, id:123.7, ws:8,    ks:3309.98, kgm:25.98, preis:0 },
  { name:'RR140/8',     grade:'S440J2H', fy:440, od:139.7, id:123.7, ws:8,    ks:3309.98, kgm:25.98, preis:23.95 },
  { name:'RR140/10',    grade:'S440J2H', fy:440, od:139.7, id:119.7, ws:10,   ks:4074.65, kgm:31.99, preis:28.85 },
  { name:'RRs140/10',   grade:'S550J2H', fy:550, od:139.7, id:119.7, ws:10,   ks:4074.65, kgm:31.99, preis:0 },
  { name:'RR170/10',    grade:'S440J2H', fy:440, od:168.3, id:148.3, ws:10,   ks:4973.14, kgm:39.04, preis:35.30 },
  { name:'RR170/12,5',  grade:'S440J2H', fy:440, od:168.3, id:143.3, ws:12.5, ks:6118.25, kgm:48.03, preis:42.95 },
  { name:'RRs170/10',   grade:'S550J2H', fy:550, od:168.3, id:148.3, ws:10,   ks:4973.14, kgm:39.04, preis:0 },
  { name:'RR190/10',    grade:'S440J2H', fy:440, od:190,   id:170,   ws:10,   ks:5654.87, kgm:44.39, preis:42.20 },
  { name:'RR190/12,5',  grade:'S440J2H', fy:440, od:190,   id:165,   ws:12.5, ks:6970.41, kgm:54.72, preis:49.80 },
];

const ALL_PRODUCTS = [
  ...TRM_PRODUCTS.map(p => ({ ...p, group: 'TRM' })),
  ...SSAB_PRODUCTS.map(p => ({ ...p, group: 'SSAB' })),
];

// Tiefenstufen 0–24m (25 Zeilen à 1m)
const DEPTHS = Array.from({ length: 25 }, (_, i) => i);

// ===================== DOM REFS =====================
const $ = id => document.getElementById(id);

// ===================== PROTOKOLL =====================
let timeInputs   = [];
let noteInputs   = [];

function getRdPerMeter(secPerMeter, bodenart, schuhDm) {
  const data   = BODEN_DATA[bodenart] || BODEN_DATA.bindig;
  const schuhM = (schuhDm || 220) / 1000;
  const gamma  = 2.0;
  let qs = 0;

  if (!secPerMeter || secPerMeter <= 0) return 0; // kein Eintrag

  if (secPerMeter < 5)       qs = 0;
  else if (secPerMeter < 10) qs = data[1].klammer ? 0 : data[1].qs; // Empfehlung: Klammerwerte ignorieren
  else if (secPerMeter < 20) {
    // bindig: auch mitteldicht ist Klammerwert
    qs = (bodenart === 'bindig' && data[2].klammer) ? 0 : data[2].qs;
  }
  else if (secPerMeter <= 30) qs = data[3].qs;
  else                        qs = data[4].qs;

  return (qs * Math.PI * schuhM) / gamma;
}

function getDensityLabel(secPerMeter, bodenart) {
  if (!secPerMeter || secPerMeter <= 0) return '–';
  const data = BODEN_DATA[bodenart] || BODEN_DATA.bindig;
  if (secPerMeter < 5)        return data[0].label + ' ⚠️';
  if (secPerMeter < 10)       return data[1].label + ' (Klammer)';
  if (secPerMeter < 20)       return data[2].label + (bodenart === 'bindig' ? ' (Klammer)' : '');
  if (secPerMeter <= 30)      return data[3].label;
  return data[4].label;
}

function buildProtocol() {
  const tbody = $('protoBody');
  tbody.innerHTML = '';
  timeInputs  = [];
  noteInputs  = [];

  DEPTHS.forEach((d, i) => {
    const from = d;
    const to   = d + 1;
    const isIgnored = (from < 1.5); // erste 1,5m

    const tr = document.createElement('tr');
    tr.className = isIgnored ? 'null-row' : '';

    // Tiefenbereich
    const tdDepth = document.createElement('td');
    tdDepth.textContent = `${from}–${to} m`;
    tr.appendChild(tdDepth);

    // Zeit-Input
    const tdTime = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = '0'; inp.step = '1';
    inp.placeholder = isIgnored ? '–' : 'sec/m';
    inp.disabled = isIgnored;
    inp.dataset.idx = i;
    inp.addEventListener('input', recalcProtocol);
    timeInputs.push(inp);
    tdTime.appendChild(inp);
    tr.appendChild(tdTime);

    // Lagerungsdichte
    const tdDens = document.createElement('td');
    tdDens.id = `dens-${i}`;
    tdDens.textContent = isIgnored ? '(nicht angerechnet)' : '–';
    tr.appendChild(tdDens);

    // Rd
    const tdRd = document.createElement('td');
    tdRd.className = 'rd-cell';
    tdRd.id = `rd-${i}`;
    tdRd.textContent = isIgnored ? '0.00' : '–';
    tr.appendChild(tdRd);

    // Σ Rd
    const tdSigma = document.createElement('td');
    tdSigma.className = 'sigma-cell';
    tdSigma.id = `sigma-${i}`;
    tdSigma.textContent = '–';
    tr.appendChild(tdSigma);

    // Anmerkung
    const tdNote = document.createElement('td');
    const noteInp = document.createElement('input');
    noteInp.type = 'text'; noteInp.placeholder = 'Anmerkung …';
    noteInputs.push(noteInp);
    tdNote.appendChild(noteInp);
    tr.appendChild(tdNote);

    tbody.appendChild(tr);
  });

  recalcProtocol();
}

function recalcProtocol() {
  const bodenart = $('inp-bodenart').value;
  const schuhDm  = parseFloat($('inp-schuh').value) || 220;
  const ed       = parseFloat($('inp-ed').value) || 0;

  let sigma = 0;

  DEPTHS.forEach((d, i) => {
    const from = d;
    const isIgnored = (from < 1.5);
    const tVal = parseFloat(timeInputs[i]?.value) || 0;

    let rd = 0;
    if (!isIgnored && tVal > 0) {
      rd = getRdPerMeter(tVal, bodenart, schuhDm);
    }
    sigma += rd;

    const densEl  = $(`dens-${i}`);
    const rdEl    = $(`rd-${i}`);
    const sigmaEl = $(`sigma-${i}`);

    if (!isIgnored) {
      if (densEl)  densEl.textContent  = tVal > 0 ? getDensityLabel(tVal, bodenart) : '–';
      if (rdEl)    rdEl.textContent    = tVal > 0 ? rd.toFixed(2) : '–';
      if (sigmaEl) sigmaEl.textContent = tVal > 0 ? sigma.toFixed(2) : '–';
    }
  });

  // Gesamtergebnis
  $('sumRd').textContent = sigma.toFixed(2) + ' kN';
  const pass = sigma >= ed;
  const sumResult = $('sumResult');
  sumResult.textContent = pass
    ? `✅ ERFÜLLT (Rd=${sigma.toFixed(1)} ≥ Ed=${ed.toFixed(1)})`
    : `❌ NICHT ERFÜLLT (Rd=${sigma.toFixed(1)} < Ed=${ed.toFixed(1)})`;
  sumResult.className = 'sum-result ' + (pass ? 'ok' : 'err');

  // Result-Box
  $('resultRd').textContent = `Σ Rd = ${sigma.toFixed(2)} kN`;
  $('resultEd').textContent = `Ed = ${ed.toFixed(2)} kN`;
  const badge = $('resultBadge');
  badge.textContent  = pass ? '✅ ERFÜLLT' : '❌ NICHT ERFÜLLT';
  badge.className    = 'result-badge ' + (pass ? 'ok' : 'err');
}

// Pfahltyp → Schuh synchronisieren
$('inp-pfahltyp').addEventListener('change', () => {
  const parts = $('inp-pfahltyp').value.split('|');
  if (parts[2]) $('inp-schuh').value = parts[2];
  recalcProtocol();
});
$('inp-bodenart').addEventListener('change', recalcProtocol);
$('inp-schuh').addEventListener('input', recalcProtocol);
$('inp-ed').addEventListener('input', recalcProtocol);

// Reset
$('btnReset').addEventListener('click', () => {
  timeInputs.forEach(inp => inp.value = '');
  noteInputs.forEach(inp => inp.value = '');
  recalcProtocol();
});

// ===================== PDF EXPORT =====================
$('btnPdf').addEventListener('click', () => {
  const bodenart = $('inp-bodenart').value;
  const schuhDm  = parseFloat($('inp-schuh').value) || 220;
  const ed       = parseFloat($('inp-ed').value) || 0;
  const pfahltyp = $('inp-pfahltyp').options[$('inp-pfahltyp').selectedIndex].text;

  let sigma = 0;
  let tableRows = '';

  DEPTHS.forEach((d, i) => {
    const from = d;
    const to   = d + 1;
    const isIgnored = (from < 1.5);
    const tVal = parseFloat(timeInputs[i]?.value) || 0;
    let rd = 0;
    if (!isIgnored && tVal > 0) rd = getRdPerMeter(tVal, bodenart, schuhDm);
    sigma += rd;
    const note = noteInputs[i]?.value || '';
    tableRows += `<tr>
      <td>${from}–${to} m</td>
      <td>${tVal > 0 && !isIgnored ? tVal : '–'}</td>
      <td>${isIgnored ? '(nicht angerechnet)' : (tVal > 0 ? getDensityLabel(tVal, bodenart) : '–')}</td>
      <td>${(!isIgnored && tVal > 0) ? rd.toFixed(2) : '–'}</td>
      <td>${(!isIgnored && tVal > 0) ? sigma.toFixed(2) : '–'}</td>
      <td>${note}</td>
    </tr>`;
  });

  const pass = sigma >= ed;
  const w = window.open('', '_blank');
  if (!w) { alert('Popup blockiert!'); return; }
  w.document.write(`<!doctype html><html><head>
    <meta charset="utf-8"/>
    <title>HTB Rammpfahl-Protokoll</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #111; }
      h1 { font-size: 14px; margin: 0 0 4px; }
      h2 { font-size: 11px; margin: 10px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 20px; margin-bottom: 10px; font-size: 9.5px; }
      .meta b { color: #555; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th { background: #f0f0f0; padding: 5px 4px; text-align: left; font-size: 9px; border: 1px solid #ccc; }
      td { padding: 4px; border: 1px solid #e0e0e0; font-size: 9px; }
      .result { margin-top: 12px; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 11px;
        background: ${pass ? '#d4edda' : '#f8d7da'}; color: ${pass ? '#155724' : '#721c24'}; border: 1px solid ${pass ? '#c3e6cb' : '#f5c6cb'}; }
      .footer { margin-top: 16px; font-size: 8px; color: #999; border-top: 1px solid #eee; padding-top: 6px; }
      .logo { background: #ffed00; display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 900; font-size: 13px; margin-bottom: 6px; }
    </style>
  </head><body>
    <div class="logo">HTB</div>
    <h1>Rammpfahl-Protokoll</h1>
    <div class="meta">
      <div><b>Datum:</b> ${$('inp-datum').value || '–'}</div>
      <div><b>Pfahlnummer:</b> ${$('inp-pfahl-nr').value || '–'}</div>
      <div><b>Projekt:</b> ${$('inp-projekt').value || '–'}</div>
      <div><b>Kostenstelle:</b> ${$('inp-kostenstelle').value || '–'}</div>
      <div><b>Auftraggeber:</b> ${$('inp-auftraggeber').value || '–'}</div>
      <div><b>Trägergerät:</b> ${$('inp-traeger').value || '–'}</div>
      <div><b>Hyd-Hammer:</b> ${$('inp-hammer').value || '–'}</div>
      <div><b>Pfahltyp:</b> ${pfahltyp}</div>
      <div><b>Rammschuh-Ø:</b> ${schuhDm} mm</div>
      <div><b>Bodenart:</b> ${bodenart === 'bindig' ? 'Bindig' : 'Nicht bindig'}</div>
      <div><b>Bemessungslast Ed:</b> ${ed.toFixed(2)} kN</div>
    </div>
    <h2>Ramm-Protokoll</h2>
    <table>
      <thead><tr>
        <th>Tiefe</th><th>Zeit [sec/m]</th><th>Lagerungsdichte</th>
        <th>Rd [kN]</th><th>Σ Rd [kN]</th><th>Anmerkung</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="result">
      ${pass ? '✅ ERFÜLLT' : '❌ NICHT ERFÜLLT'} &nbsp;–&nbsp;
      Σ Rd = ${sigma.toFixed(2)} kN &nbsp;≥?&nbsp; Ed = ${ed.toFixed(2)} kN
    </div>
    <div class="footer">
      AN (Datum; Unterschrift): __________________________ &nbsp;&nbsp;&nbsp;
      AG/ÖBA (Datum; Unterschrift): __________________________<br/>
      © HTB Baugesellschaft m.b.H. – Erstellt: ${new Date().toLocaleString('de-DE')}
    </div>
    <script>setTimeout(()=>window.print(),300);<\/script>
  </body></html>`);
  w.document.close();
});

// ===================== BEMESSUNGSTABELLE =====================
function buildBemTable() {
  const bodenart = $('bem-bodenart').value;
  const schuhDm  = parseFloat($('bem-schuh').value) || 220;
  const schuhM   = schuhDm / 1000;
  const data     = BODEN_DATA[bodenart];
  const tbody    = $('bemBody');
  tbody.innerHTML = '';

  data.forEach(row => {
    const rd = (row.qs * Math.PI * schuhM) / 2.0;
    const tr = document.createElement('tr');
    const klasse = row.klammer ? 'klammer' : '';
    tr.innerHTML = `
      <td class="${klasse}">${row.secM}${row.klammer ? ' (Klammerwert)' : ''}</td>
      <td class="${klasse}">${row.label}</td>
      <td class="${klasse}">${row.qs}${row.klammer ? ' (Klammer)' : ''}</td>
      <td class="rd-highlight">${rd.toFixed(3)}</td>
    `;
    tbody.appendChild(tr);
  });
}

$('bem-bodenart').addEventListener('change', buildBemTable);
$('bem-schuh').addEventListener('input', buildBemTable);

// ===================== VARIANTENVERGLEICH =====================
function calcPile(pile, fckContrib) {
  const fy02    = pile.fy;
  const aSteel  = pile.ks; // mm²
  const ri      = pile.id / 2;
  const aConc   = Math.PI * ri * ri; // mm² innen
  const fkoB    = (aSteel * fy02) / (1000); // kN, γm=1
  const fkmB    = fkoB + (aConc * fckContrib) / 1000; // kN
  const od      = pile.od;
  const id      = pile.id;
  const Iy      = Math.PI * (Math.pow(od, 4) - Math.pow(id, 4)) / 64;
  const Mb      = (fy02 * Iy / (od / 2)) / 1e6; // kNm
  return { fkoB, fkmB, Iy, Mb, aSteel, aConc };
}

function renderVarCol(colId, pile, res2) {
  const el = $(colId);
  const pile2Data = res2; // für Differenz
  el.innerHTML = `
    <div class="var-head">${pile.name} <small style="color:var(--muted)">(${pile.grade || 'S320'}, fy=${pile.fy} N/mm²)</small></div>
    <div class="var-row"><span class="var-label">Ø außen:</span><span class="var-val">${pile.od} mm</span></div>
    <div class="var-row"><span class="var-label">Wandstärke:</span><span class="var-val">${pile.ws} mm</span></div>
    <div class="var-row"><span class="var-label">Stahlfläche:</span><span class="var-val">${pile.ks.toFixed(0)} mm²</span></div>
    <div class="var-row"><span class="var-label">Betonfläche:</span><span class="var-val">${(Math.PI*(pile.id/2)**2).toFixed(0)} mm²</span></div>
    <div class="var-row"><span class="var-label">kg/m:</span><span class="var-val">${pile.kgm} kg/m</span></div>
    <div class="var-row"><span class="var-label">Preis/m:</span><span class="var-val">${pile.preis > 0 ? pile.preis.toFixed(2)+' €/m' : '–'}</span></div>
    <hr style="border-color:var(--border);margin:8px 0"/>
    <div class="var-row"><span class="var-label">FkoB (ohne Beton):</span><span class="var-val">${pile2Data.fkoB.toFixed(1)} kN</span></div>
    <div class="var-row"><span class="var-label">FkmB (mit Beton):</span><span class="var-val">${pile2Data.fkmB.toFixed(1)} kN</span></div>
    <div class="var-row"><span class="var-label">Max. Biegemoment:</span><span class="var-val">${pile2Data.Mb.toFixed(2)} kNm</span></div>
  `;
}

function updateVarianten() {
  const sel1 = $('var-pile1');
  const sel2 = $('var-pile2');
  const fckContrib = parseFloat($('var-beton').value) || 0;

  const p1name = sel1.value;
  const p2name = sel2.value;
  const pile1  = ALL_PRODUCTS.find(p => p.name === p1name);
  const pile2  = ALL_PRODUCTS.find(p => p.name === p2name);

  if (!pile1 || !pile2) return;
  const r1 = calcPile(pile1, fckContrib);
  const r2 = calcPile(pile2, fckContrib);

  renderVarCol('varCol1', pile1, r1);
  renderVarCol('varCol2', pile2, r2);
}

function buildVariantenSelects() {
  const sel1 = $('var-pile1');
  const sel2 = $('var-pile2');
  sel1.innerHTML = '';
  sel2.innerHTML = '';

  ['TRM', 'SSAB'].forEach(grp => {
    const og1 = document.createElement('optgroup');
    og1.label = grp;
    const og2 = document.createElement('optgroup');
    og2.label = grp;
    ALL_PRODUCTS.filter(p => p.group === grp).forEach(p => {
      og1.appendChild(new Option(p.name, p.name));
      og2.appendChild(new Option(p.name, p.name));
    });
    sel1.appendChild(og1);
    sel2.appendChild(og2);
  });

  // Standardauswahl
  sel1.value = 'TRM170/9';
  sel2.value = 'RRs140/8';
  updateVarianten();
}

$('var-pile1').addEventListener('change', updateVarianten);
$('var-pile2').addEventListener('change', updateVarianten);
$('var-beton').addEventListener('change', updateVarianten);

// TRM Produktliste
function buildProductLists() {
  const trmBody = $('trmList');
  TRM_PRODUCTS.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.od} mm</td><td>${p.ws} mm</td><td>${p.kgm}</td><td>${p.preis > 0 ? p.preis.toFixed(2)+' €' : '–'}</td>`;
    trmBody.appendChild(tr);
  });

  const ssabBody = $('ssabList');
  SSAB_PRODUCTS.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.grade}</td><td>${p.od} mm</td><td>${p.ws} mm</td><td>${p.kgm}</td><td>${p.preis > 0 ? p.preis.toFixed(2)+' €' : '–'}</td>`;
    ssabBody.appendChild(tr);
  });
}

// ===================== TABS =====================
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

// ===================== PWA INSTALL =====================
(() => {
  let deferredPrompt = null;
  const banner = $('installBanner');
  const btn    = $('installBtn');
  if (!banner || !btn) return;
  const IS_STANDALONE = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (IS_STANDALONE) { banner.hidden = true; return; }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    banner.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.hidden = true;
  });
  window.addEventListener('appinstalled', () => { banner.hidden = true; });
})();

// ===================== SERVICE WORKER =====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ===================== INIT =====================
// Heute als Datum vorbelegen
$('inp-datum').value = new Date().toISOString().slice(0, 10);

buildProtocol();
buildBemTable();
buildVariantenSelects();
buildProductLists();