'use strict';
console.log('HTB Rammpfahl app.js v11 loaded');

const DEPTHS          = Array.from({ length: 25 }, (_, i) => i);
const STORAGE_DRAFT   = 'htb-rammpfahl-draft-v9';
const STORAGE_HISTORY = 'htb-rammpfahl-history-v9';
const HISTORY_MAX     = 30;

const RD_PER_M_220 = {
  nichtbindig: {
    gedrueckt: 0.0,
    s5_10:     27.646015351590183,
    s10_20:    55.292030703180366,
    s20_30:    82.93804605477055,
    gt30:     103.67255756846319
  },
  bindig: {
    gedrueckt: 0.0,
    s5_10:     13.823007675795091,
    s10_20:    27.646015351590183,
    s20_30:    48.38052686528282,
    gt30:      69.11503837897546
  }
};

const TRM_PRODUCTS = [
  { name:'TRM98/6',     od:98,  id:86,    ws:6,    kgm:14.04, preis:17.10 },
  { name:'TRM98/7,5',   od:98,  id:83,    ws:7.5,  kgm:12.70, preis:19.83 },
  { name:'TRM118/6',    od:118, id:106,   ws:6,    kgm:16.57, preis:19.02 },
  { name:'TRM118/7,5',  od:118, id:103,   ws:7.5,  kgm:21.00, preis:22.06 },
  { name:'TRM118/9',    od:118, id:100,   ws:9,    kgm:24.40, preis:25.62 },
  { name:'TRM118/10,6', od:118, id:96.8,  ws:10.6, kgm:28.00, preis:29.40 },
  { name:'TRM170/7,5',  od:170, id:155,   ws:7.5,  kgm:33.80, preis:32.43 },
  { name:'TRM170/9',    od:170, id:152,   ws:9,    kgm:37.10, preis:35.48 },
  { name:'TRM170/10,6', od:170, id:148.8, ws:10.6, kgm:42.50, preis:40.63 },
  { name:'TRM170/13',   od:170, id:144,   ws:13,   kgm:50.40, preis:47.45 },
];

const SSAB_PRODUCTS = [
  { name:'RR75/6,3',    grade:'S440J2H', od:76.1,  ws:6.3,  kgm:10.8446, preis:0 },
  { name:'RR90/6,3',    grade:'S440J2H', od:88.9,  ws:6.3,  kgm:12.8334, preis:0 },
  { name:'RRs100/6,3',  grade:'S550J2H', od:101.6, ws:6.3,  kgm:14.8065, preis:0 },
  { name:'RR115/6,3',   grade:'S440J2H', od:115.0, ws:6.3,  kgm:16.8884, preis:0 },
  { name:'RR115/8',     grade:'S440J2H', od:115.0, ws:8.0,  kgm:21.1102, preis:0 },
  { name:'RRs115/8',    grade:'S550J2H', od:115.0, ws:8.0,  kgm:21.1102, preis:0 },
  { name:'RRs125/6,3',  grade:'S550J2H', od:127.0, ws:6.3,  kgm:18.7529, preis:0 },
  { name:'RR140/8',     grade:'S440J2H', od:139.7, ws:8.0,  kgm:25.9834, preis:23.95 },
  { name:'RR140/10',    grade:'S440J2H', od:139.7, ws:10.0, kgm:31.9860, preis:28.85 },
  { name:'RRs140/8',    grade:'S550J2H', od:139.7, ws:8.0,  kgm:25.9834, preis:0 },
  { name:'RRs140/10',   grade:'S550J2H', od:139.7, ws:10.0, kgm:31.9860, preis:0 },
  { name:'RR170/10',    grade:'S440J2H', od:168.3, ws:10.0, kgm:39.0392, preis:35.30 },
  { name:'RR170/12,5',  grade:'S440J2H', od:168.3, ws:12.5, kgm:48.0283, preis:42.95 },
  { name:'RRs170/10',   grade:'S550J2H', od:168.3, ws:10.0, kgm:39.0392, preis:0 },
  { name:'RR190/10',    grade:'S440J2H', od:190.0, ws:10.0, kgm:44.3907, preis:42.20 },
  { name:'RR190/12,5',  grade:'S440J2H', od:190.0, ws:12.5, kgm:54.7177, preis:49.80 },
  { name:'RR220/10',    grade:'S440J2H', od:219.1, ws:10.0, kgm:51.5672, preis:0 },
  { name:'RR220/12,5',  grade:'S440J2H', od:219.1, ws:12.5, kgm:63.6883, preis:0 },
  { name:'RR270/10',    grade:'S440J2H', od:273.0, ws:10.0, kgm:64.8598, preis:0 },
  { name:'RR270/12,5',  grade:'S440J2H', od:273.0, ws:12.5, kgm:80.3040, preis:0 },
  { name:'RRs270/10',   grade:'S550J2H', od:273.0, ws:10.0, kgm:64.8598, preis:0 },
  { name:'RRs270/12,5', grade:'S550J2H', od:273.0, ws:12.5, kgm:80.3040, preis:0 },
  { name:'RR320/10',    grade:'S440J2H', od:323.9, ws:10.0, kgm:77.4125, preis:0 },
  { name:'RR320/12,5',  grade:'S440J2H', od:323.9, ws:12.5, kgm:95.9949, preis:0 },
  { name:'RRs320/10',   grade:'S550J2H', od:323.9, ws:10.0, kgm:77.4125, preis:0 },
  { name:'RRs320/12,5', grade:'S550J2H', od:323.9, ws:12.5, kgm:95.9949, preis:0 },
];

const $ = (id) => document.getElementById(id);
let timeInputs = [];
let noteInputs = [];
let sigPads = { an:null, ag:null };

// Klammerwerte werden IMMER berücksichtigt — keine Option mehr
const INCLUDE_KLAMMER = true;

const state = {
  timer: { running:false, startMs:0, raf:null, selectedIdx:0 }
};

/* ───────────────────────── helpers ───────────────────────── */
function fmtComma(n, d=2){ return Number(n||0).toFixed(d).replace('.', ','); }
function depthLabel(i){ return `${i}-${i+1}m`; }

function dateTag(d=new Date()){
  return String(d.getDate()).padStart(2,'0')
    + String(d.getMonth()+1).padStart(2,'0')
    + String(d.getFullYear());
}

function dateDE(iso){
  const s = String(iso||'').trim();
  if (!s) return '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return String(d.getDate()).padStart(2,'0') + '.' +
      String(d.getMonth()+1).padStart(2,'0') + '.' + d.getFullYear();
  }
  return s;
}

function secClass(sec){
  if (!sec || sec <= 0) return null;
  if (sec < 5)   return 'gedrueckt';
  if (sec < 10)  return 's5_10';
  if (sec < 20)  return 's10_20';
  if (sec <= 30) return 's20_30';
  return 'gt30';
}

function isKlammerClass(bodenart, cls){
  if (!cls) return false;
  if (bodenart === 'nichtbindig') return cls === 's5_10';
  return (cls === 's5_10' || cls === 's10_20');
}

function rdFromSec(sec, bodenart, schuhMm){
  const cls = secClass(sec);
  if (!cls) return 0;
  const base = (RD_PER_M_220[bodenart] || RD_PER_M_220.bindig)[cls] || 0;
  // Klammerwerte immer berücksichtigt → kein Skip
  return base * ((Number(schuhMm) || 220) / 220);
}

function niceTicks(maxVal, targetSteps = 4) {
  const max = Math.max(0, Number(maxVal) || 0);
  if (max <= 0) return { max: 10, ticks: [0,2,4,6,8,10] };
  const rawStep = max / Math.max(1, targetSteps);
  const pow10   = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const err     = rawStep / pow10;
  let step = err >= 7.5 ? 10*pow10 : err >= 3.5 ? 5*pow10 : err >= 1.5 ? 2*pow10 : pow10;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t=0; t<=niceMax+1e-9; t+=step) ticks.push(t);
  return { max:niceMax, step, ticks };
}

/* ───────────────────────── Tabs ───────────────────────── */
function initTabs(){
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b === btn));
      document.querySelectorAll('.pane').forEach(p => {
        const on = p.id === `tab-${btn.dataset.tab}`;
        p.classList.toggle('is-active', on);
        p.hidden = !on;
      });
      if (btn.dataset.tab === 'verlauf') renderHistoryList();
      if (btn.dataset.tab === 'bemessung') buildBemTable();
    });
  });
}

/* ───────────────────────── Draft ───────────────────────── */
function collectFormState(){
  return {
    v: 9,
    meta: {
      datum:        $('inp-datum')?.value || '',
      projekt:      $('inp-projekt')?.value || '',
      kostenstelle: $('inp-kostenstelle')?.value || '',
      auftraggeber: $('inp-auftraggeber')?.value || '',
      traeger:      $('inp-traeger')?.value || '',
      hammer:       $('inp-hammer')?.value || '',
      pfahlNr:      $('inp-pfahl-nr')?.value || '',
      pfahltyp:     $('inp-pfahltyp')?.value || '',
      schuh:        $('inp-schuh')?.value || '220',
      bodenart:     $('inp-bodenart')?.value || 'bindig',
      ed:           $('inp-ed')?.value || ''
    },
    meterIdx: state.timer.selectedIdx || 0,
    times: DEPTHS.map((_,i)=> timeInputs[i]?.value || ''),
    notes: DEPTHS.map((_,i)=> noteInputs[i]?.value || ''),
    sign: {
      an: { date: $('sigAnDate')?.value || '', img: sigPads.an?.getDataURL?.() || '' },
      ag: { date: $('sigAgDate')?.value || '', img: sigPads.ag?.getDataURL?.() || '' }
    }
  };
}

function applyFormState(s){
  if (!s?.meta) return;
  const m = s.meta;
  $('inp-datum').value        = m.datum || $('inp-datum').value;
  $('inp-projekt').value      = m.projekt || '';
  $('inp-kostenstelle').value = m.kostenstelle || '';
  $('inp-auftraggeber').value = m.auftraggeber || '';
  $('inp-traeger').value      = m.traeger || 'SK 270';
  $('inp-hammer').value       = m.hammer || 'Wimmer WH26';
  $('inp-pfahl-nr').value     = m.pfahlNr || '1';
  $('inp-pfahltyp').value     = m.pfahltyp || $('inp-pfahltyp').value;
  $('inp-schuh').value        = m.schuh || '220';
  $('inp-bodenart').value     = m.bodenart || 'bindig';
  $('inp-ed').value           = m.ed || '350.60';

  (s.times || []).slice(0,25).forEach((v,i)=> { if (timeInputs[i]) timeInputs[i].value = v; });
  (s.notes || []).slice(0,25).forEach((v,i)=> { if (noteInputs[i]) noteInputs[i].value = v; });

  state.timer.selectedIdx = Number(s.meterIdx || 0);
  if ($('meterSelect')) $('meterSelect').value = String(state.timer.selectedIdx);

  if ($('sigAnDate')) $('sigAnDate').value = s.sign?.an?.date || $('inp-datum')?.value || '';
  if ($('sigAgDate')) $('sigAgDate').value = s.sign?.ag?.date || $('inp-datum')?.value || '';
  sigPads.an?.setFromDataURL?.(s.sign?.an?.img || '');
  sigPads.ag?.setFromDataURL?.(s.sign?.ag?.img || '');
}

let _saveT = null;
function saveDraftDebounced(){
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try { localStorage.setItem(STORAGE_DRAFT, JSON.stringify(collectFormState())); } catch {}
  }, 250);
}

function loadDraft(){
  try {
    const raw = localStorage.getItem(STORAGE_DRAFT);
    if (raw) applyFormState(JSON.parse(raw));
  } catch {}
}

/* ───────────────────────── History ───────────────────────── */
function readHistory(){ try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]'); } catch { return []; } }
function writeHistory(list){ try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch {} }
function uid(){ return crypto?.randomUUID?.() || ('id_'+Date.now()+'_'+Math.random().toString(16).slice(2)); }

function sumsFromSnapshot(snap){
  const bodenart = snap.meta?.bodenart || 'bindig';
  const schuh    = Number(snap.meta?.schuh || 220);
  const ed       = Number(snap.meta?.ed || 0);
  let sumTime=0, sumRd=0;
  (snap.times||[]).slice(0,25).forEach(tv=>{
    const t = Number(tv||0);
    if (t>0) sumTime += t;
    sumRd += rdFromSec(t, bodenart, schuh);
  });
  return { sumTime, sumRd, ed, ok: sumRd >= ed };
}

function saveCurrentToHistory(){
  const snap  = collectFormState();
  const sums  = sumsFromSnapshot(snap);
  const entry = {
    id: uid(),
    savedAt: Date.now(),
    title: `${snap.meta.projekt||'—'} · Pfahl ${snap.meta.pfahlNr||'—'}`,
    snap, sums
  };
  const list = readHistory();
  list.unshift(entry);
  writeHistory(list);
  renderHistoryList();
}

function renderHistoryList(){
  const host = $('historyList');
  if (!host) return;
  const list = readHistory();
  if (!list.length) {
    host.innerHTML = `<div class="text"><p>Noch keine Messungen gespeichert.</p></div>`;
    return;
  }
  host.innerHTML = '';
  list.forEach(entry => {
    const s = entry.sums || sumsFromSnapshot(entry.snap);
    const div = document.createElement('div');
    div.className = 'historyItem';
    div.innerHTML = `
      <div class="historyTop">
        <span>${entry.title}</span>
        <span style="color:var(--muted);font-size:.82em">${new Date(entry.savedAt).toLocaleString('de-DE')}</span>
      </div>
      <div class="historySub">
        ΣRd: <b>${fmtComma(s.sumRd,2)} kN</b> · Ed: <b>${fmtComma(s.ed,2)} kN</b> ·
        <b style="color:${s.ok?'var(--ok)':'var(--err)'}">${s.ok?'Rd ≥ Ed':'Rd < Ed'}</b>
      </div>
      <div class="historyBtns">
        <button class="btn btn--ghost" type="button" data-act="load" data-id="${entry.id}">Laden</button>
        <button class="btn btn--ghost" type="button" data-act="pdf"  data-id="${entry.id}">PDF</button>
        <button class="btn btn--ghost" type="button" data-act="del"  data-id="${entry.id}">Löschen</button>
      </div>
    `;
    host.appendChild(div);
  });

  host.querySelectorAll('button[data-act]').forEach(b => {
    b.addEventListener('click', async () => {
      const { id, act } = b.dataset;
      if (act === 'del') {
        writeHistory(readHistory().filter(e => e.id !== id));
        renderHistoryList();
      }
      if (act === 'load') {
        const e = readHistory().find(e => e.id === id);
        if (!e) return;
        applyFormState(e.snap);
        recalc();
        saveDraftDebounced();
        document.querySelector('.tab[data-tab="protokoll"]')?.click();
      }
      if (act === 'pdf') {
        const e = readHistory().find(e => e.id === id);
        if (e) await exportPdf(e.snap);
      }
    });
  });
}

/* ───────────────────────── UI build ───────────────────────── */
function buildPfahltypDropdown(){
  const sel = $('inp-pfahltyp');
  if (!sel) return;
  sel.innerHTML = '';

  const optGroupTRM = document.createElement('optgroup');
  optGroupTRM.label = 'TRM (Duktil)';
  TRM_PRODUCTS.forEach(p => optGroupTRM.appendChild(new Option(p.name, p.name)));

  const optGroupSSAB = document.createElement('optgroup');
  optGroupSSAB.label = 'SSAB (Stahlrohr)';
  SSAB_PRODUCTS.forEach(p => optGroupSSAB.appendChild(new Option(p.name, p.name)));

  sel.appendChild(optGroupTRM);
  sel.appendChild(optGroupSSAB);
}

function buildMeterSelect(){
  const sel = $('meterSelect');
  if (!sel) return;
  sel.innerHTML = '';
  DEPTHS.forEach((_,i)=> sel.appendChild(new Option(depthLabel(i), String(i))));
  sel.value = String(state.timer.selectedIdx || 0);
  sel.addEventListener('change', () => {
    state.timer.selectedIdx = Number(sel.value) || 0;
    saveDraftDebounced();
  });
}

function buildProtocolTable(){
  const tbody = $('protoBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  timeInputs = [];
  noteInputs = [];
  DEPTHS.forEach((_,i) => {
    const tr = document.createElement('tr');

    const tdD = document.createElement('td');
    tdD.textContent = depthLabel(i);
    tr.appendChild(tdD);

    const tdT = document.createElement('td');
    const inpT = document.createElement('input');
    inpT.type='number'; inpT.min='0'; inpT.step='1';
    inpT.addEventListener('input', () => { recalc(); saveDraftDebounced(); });
    timeInputs.push(inpT);
    tdT.appendChild(inpT);
    tr.appendChild(tdT);

    const tdR = document.createElement('td');
    tdR.className='rd-cell';
    tdR.id = `rd-${i}`;
    tdR.textContent = '0,00';
    tr.appendChild(tdR);

    const tdN = document.createElement('td');
    const inpN = document.createElement('input');
    inpN.type='text';
    inpN.addEventListener('input', saveDraftDebounced);
    noteInputs.push(inpN);
    tdN.appendChild(inpN);
    tr.appendChild(tdN);

    tbody.appendChild(tr);
  });
}

function buildBemTable(){
  const bodenart = $('bem-bodenart')?.value || 'bindig';
  const schuhMm  = Number($('bem-schuh')?.value || 220);
  const tbody = $('bemBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rows = [
    { secm:'gedrückt', label:'sehr locker',  qs:0,                            klammer:false },
    { secm:'5–10',     label:'locker',       qs:bodenart==='bindig'?  20: 40,  klammer:true  },
    { secm:'10–20',    label:'mitteldicht',  qs:bodenart==='bindig'?  40: 80,  klammer:(bodenart==='bindig') },
    { secm:'20–30',    label:'dicht',        qs:bodenart==='bindig'?  70:120,  klammer:false },
    { secm:'> 30',     label:'sehr dicht',   qs:bodenart==='bindig'? 100:150,  klammer:false },
  ];

  rows.forEach(r => {
    const rd = r.qs * Math.PI * (schuhMm/1000);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="${r.klammer?'klammer':''}">${r.secm}</td>
      <td class="${r.klammer?'klammer':''}">${r.label}</td>
      <td class="${r.klammer?'klammer':''}">${r.klammer ? '('+r.qs+')' : r.qs}</td>
      <td class="rd-val">${fmtComma(rd,3)}</td>
      <td class="${r.klammer?'klammer':''}">${r.klammer?'Klammerwert – wird berücksichtigt':''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function buildProductLists(){
  const trmBody  = $('trmList');
  const ssabBody = $('ssabList');

  if (trmBody) {
    trmBody.innerHTML = '';
    TRM_PRODUCTS.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${p.od}mm</td><td>${p.id}mm</td><td>${p.ws}mm</td><td>${p.kgm}</td><td>${p.preis>0?p.preis.toFixed(2)+' €':'–'}</td>`;
      trmBody.appendChild(tr);
    });
  }

  if (ssabBody) {
    ssabBody.innerHTML = '';
    SSAB_PRODUCTS.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${p.grade}</td><td>${p.od}mm</td><td>${p.ws}mm</td><td>${p.kgm}</td><td>${p.preis>0?p.preis.toFixed(2)+' €':'–'}</td>`;
      ssabBody.appendChild(tr);
    });
  }
}

/* ───────────────────────── recalc ───────────────────────── */
function recalc(){
  const bodenart = $('inp-bodenart')?.value || 'bindig';
  const schuh = Number($('inp-schuh')?.value || 220);
  const ed = Number($('inp-ed')?.value || 0);
  let sumTime=0, sumRd=0;

  DEPTHS.forEach((_,i) => {
    const t = Number(timeInputs[i]?.value || 0);
    if (t>0) sumTime += t;
    const rd = rdFromSec(t, bodenart, schuh);
    sumRd += rd;
    const el = $(`rd-${i}`);
    if (el) el.textContent = fmtComma(rd,2);
  });

  $('sumTime') && ($('sumTime').textContent = String(sumTime));
  $('sumRd') && ($('sumRd').textContent = fmtComma(sumRd,2));
  const res = $('sumResult');
  if (res) {
    const ok = sumRd >= ed;
    res.textContent = ok ? 'Rd ≥ Ed' : 'Rd < Ed';
    res.className = 'sum-result ' + (ok ? 'ok' : 'err');
  }
}

/* ───────────────────────── timer ───────────────────────── */
function timerSetBtnUI(){
  const btnStart = $('btnStartNext');
  const btnStop  = $('btnStop');
  if (!btnStart || !btnStop) return;
  if (state.timer.running) {
    btnStart.textContent = '▶ Nächster Meter';
    btnStop.disabled = false;
  } else {
    btnStart.textContent = '▶ Start';
    btnStop.disabled = true;
  }
}

function timerTick(){
  if (!state.timer.running) return;
  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs)/1000));
  $('timeLive') && ($('timeLive').value = `${sec} s`);
  state.timer.raf = requestAnimationFrame(timerTick);
}

function timerStartNext(){
  if (state.timer.running) {
    const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs)/1000));
    const idx = state.timer.selectedIdx || 0;
    if (timeInputs[idx]) timeInputs[idx].value = String(sec);
    const next = Math.min(DEPTHS.length-1, idx+1);
    state.timer.selectedIdx = next;
    $('meterSelect') && ($('meterSelect').value = String(next));
    state.timer.startMs = Date.now();
    $('timeLive') && ($('timeLive').value = '0 s');
    recalc();
    saveDraftDebounced();
  } else {
    state.timer.running = true;
    state.timer.startMs = Date.now();
    $('timeLive') && ($('timeLive').value = '0 s');
    timerTick();
  }
  timerSetBtnUI();
}

function timerStop(){
  if (!state.timer.running) return;
  state.timer.running = false;
  if (state.timer.raf) cancelAnimationFrame(state.timer.raf);
  state.timer.raf = null;
  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs)/1000));
  const idx = state.timer.selectedIdx || 0;
  if (timeInputs[idx]) timeInputs[idx].value = String(sec);
  recalc();
  saveDraftDebounced();
  timerSetBtnUI();
}

/* ───────────────────────── signature pads ───────────────────────── */
function resizeCanvasForHiDPI(canvas){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(10, Math.floor(rect.width * dpr));
  const h = Math.max(10, Math.floor(rect.height * dpr));
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function sigFillWhite(canvas){
  const ctx = canvas.getContext('2d');
  const r = canvas.getBoundingClientRect();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,r.width,r.height);
  canvas.dataset.bg = '1';
}

function makeSignaturePad(canvas, onChange){
  const ctx = canvas.getContext('2d');
  canvas.style.touchAction = 'none';
  let drawing = false;
  let last = null;
  let signed = false;

  function prep(){
    resizeCanvasForHiDPI(canvas);
    if (canvas.dataset.bg !== '1') sigFillWhite(canvas);
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
  }
  function pos(e){
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    prep();
    drawing = true;
    last = pos(e);
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
    signed = true;
  });
  function end(e){
    if (!drawing) return;
    e?.preventDefault?.();
    drawing = false;
    last = null;
    onChange?.();
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);

  return {
    clear(){
      prep();
      const r = canvas.getBoundingClientRect();
      ctx.clearRect(0,0,r.width,r.height);
      sigFillWhite(canvas);
      signed = false;
      onChange?.();
    },
    getDataURL(){
      if (!signed) return '';
      return canvas.toDataURL('image/png');
    },
    setFromDataURL(dataURL){
      prep();
      const r = canvas.getBoundingClientRect();
      ctx.clearRect(0,0,r.width,r.height);
      sigFillWhite(canvas);
      if (!dataURL) { signed = false; return; }
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, r.width, r.height); signed = true; };
      img.src = dataURL;
    }
  };
}

function initSignaturePads(){
  const anC = $('sigAnCanvas');
  const agC = $('sigAgCanvas');
  if (!anC || !agC) return;
  sigPads.an = makeSignaturePad(anC, saveDraftDebounced);
  sigPads.ag = makeSignaturePad(agC, saveDraftDebounced);
  $('sigAnClear')?.addEventListener('click', () => sigPads.an.clear());
  $('sigAgClear')?.addEventListener('click', () => sigPads.ag.clear());
  const d = $('inp-datum')?.value || new Date().toISOString().slice(0,10);
  if ($('sigAnDate') && !$('sigAnDate').value) $('sigAnDate').value = d;
  if ($('sigAgDate') && !$('sigAgDate').value) $('sigAgDate').value = d;
  $('sigAnDate')?.addEventListener('change', saveDraftDebounced);
  $('sigAgDate')?.addEventListener('change', saveDraftDebounced);
}

/* ───────────────────────── PDF export ───────────────────────── */
function dataURLtoU8(dataURL){
  const b64 = String(dataURL||'').split(',')[1];
  if (!b64) return null;
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function exportPdf(optSnap=null){
  const snap = optSnap || collectFormState();
  const meta = snap.meta || {};

  if (!window.PDFLib || !window.fontkit) {
    alert('PDF-Library/Fontkit noch nicht geladen. Bitte kurz warten.');
    return;
  }

  const { PDFDocument, rgb, degrees } = window.PDFLib;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(window.fontkit);

  let fReg, fBold;
  try {
    const arialBytes = await fetch('arial.ttf').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    fReg = await pdf.embedFont(arialBytes, { subset:true });
    const bResp = await fetch('ARIALBD.TTF');
    if (bResp.ok) {
      const boldBytes = await bResp.arrayBuffer();
      fBold = await pdf.embedFont(boldBytes, { subset:true });
    } else {
      fBold = fReg;
    }
  } catch {
    const { StandardFonts } = window.PDFLib;
    fReg  = await pdf.embedFont(StandardFonts.Helvetica);
    fBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  let logoImg = null;
  try {
    const lb = await fetch('logo.png').then(r => r.arrayBuffer());
    logoImg = await pdf.embedPng(lb);
  } catch {}

  const page = pdf.addPage([595.28, 841.89]);
  const mm = v => v * 72 / 25.4;
  const K  = rgb(0,0,0);
  const margin = mm(10);
  const x0 = margin, y0 = margin;
  const W  = 595.28 - 2*margin;
  const H  = 841.89 - 2*margin;

  page.drawRectangle({ x:x0, y:y0, width:W, height:H, borderColor:K, borderWidth:1.5 });

  const hdrH = mm(14);
  page.drawRectangle({ x:x0, y:y0+H-hdrH, width:W, height:hdrH, color:rgb(.88,.88,.88), borderColor:K, borderWidth:1 });
  if (logoImg) {
    const lh = hdrH * 0.78;
    const ls = lh / logoImg.height;
    page.drawImage(logoImg, { x:x0+mm(2), y:y0+H-hdrH+(hdrH-lh)/2, width:logoImg.width*ls, height:lh });
  }
  page.drawText('Rammpfahl-Protokoll', { x:x0+mm(33), y:y0+H-hdrH+mm(4.5), size:13, font:fBold, color:K });

  const hLine = (y,t=1)=> page.drawLine({ start:{x:x0,y}, end:{x:x0+W,y}, thickness:t, color:K });

  const rowH = mm(8);
  let cy = y0 + H - hdrH - rowH;
  const midX = x0 + W * 0.5;

  const pdfTextWidth = (font,size,text)=>{ try { return font.widthOfTextAtSize(String(text||''), size); } catch { return 0; } };
  const drawFit = (text,x,y,maxW,font,size)=> {
    let s=size;
    while (s>6 && pdfTextWidth(font,s,text) > maxW) s-=0.25;
    page.drawText(String(text||''), { x, y, size:s, font, color:K });
  };

  function metaRow(l1,v1,l2,v2){
    hLine(cy,1);
    page.drawLine({ start:{x:midX,y:cy}, end:{x:midX,y:cy+rowH}, thickness:1, color:K });
    page.drawText(l1, { x:x0+mm(2), y:cy+mm(2.2), size:10, font:fBold, color:K });
    drawFit(v1, x0+mm(32), cy+mm(2.2), (midX-mm(4))-(x0+mm(32)), fReg, 10);
    page.drawText(l2, { x:midX+mm(2), y:cy+mm(2.2), size:10, font:fBold, color:K });
    drawFit(v2, midX+mm(55), cy+mm(2.2), (x0+W-mm(2))-(midX+mm(55)), fReg, 10);
    cy -= rowH;
  }

  hLine(y0+H-hdrH,1);
  metaRow('Datum:', dateDE(meta.datum), 'Kostenstelle:', meta.kostenstelle || '');
  metaRow('Projekt:', meta.projekt || '', 'Auftraggeber:', meta.auftraggeber || '');
  metaRow('Trägergerät:', meta.traeger || 'SK 270', 'Pfahlnummer:', meta.pfahlNr || '');
  metaRow('Hyd-hammer:', meta.hammer || 'Wimmer WH26', 'Pfahl-Bemessungslast [kN] :', meta.ed ? '  '+fmtComma(Number(meta.ed),2) : '');
  const pfahlStr = String(meta.pfahltyp||'').replace(/x/gi,'×') + ` Ø${Number(meta.schuh||220)}mm`;
  metaRow('Pfahltyp:', pfahlStr, 'Bodenart:', meta.bodenart || '');

  const tableTop    = cy + rowH;
  const tableBottom = y0 + mm(28);
  const tH          = tableTop - tableBottom;
  const leftW       = W * 0.52;
  const rightW      = W - leftW;
  const thRow       = mm(7);

  page.drawRectangle({ x:x0, y:tableTop-thRow, width:leftW, height:thRow, color:rgb(.93,.93,.93), borderColor:K, borderWidth:1 });
  page.drawRectangle({ x:x0+leftW, y:tableTop-thRow, width:rightW, height:thRow, color:rgb(.93,.93,.93), borderColor:K, borderWidth:1 });

  const c1  = leftW * 0.30;
  const c2  = leftW * 0.16;
  const c3  = leftW * 0.16;
  const xC1 = x0 + c1;
  const xC2 = xC1 + c2;
  const xC3 = xC2 + c3;
  [xC1,xC2,xC3].forEach(xx => page.drawLine({ start:{x:xx,y:tableBottom}, end:{x:xx,y:tableTop}, thickness:1, color:K }));

  const chartX0 = x0 + leftW;
  page.drawLine({ start:{x:chartX0,y:tableBottom}, end:{x:chartX0,y:tableTop}, thickness:1, color:K });

  page.drawText('Eindringtiefe [m]', { x:x0+mm(1.5),  y:tableTop-thRow+mm(2.2), size:9, font:fBold, color:K });
  page.drawText('Zeit [sec]',        { x:xC1+mm(1.5), y:tableTop-thRow+mm(2.2), size:9, font:fBold, color:K });
  page.drawText('Rd [kN]',           { x:xC2+mm(1.5), y:tableTop-thRow+mm(2.2), size:9, font:fBold, color:K });
  page.drawText('Anmerkung',         { x:xC3+mm(1.5), y:tableTop-thRow+mm(2.2), size:9, font:fBold, color:K });

  const times = (snap.times||[]).slice(0,25).map(v=>Number(v||0));
  const maxT  = Math.max(0, ...times);
  const scale = niceTicks(maxT, 4);
  const xMax  = Math.max(1, scale.max);

  const innerL = chartX0 + mm(20);
  const innerR = chartX0 + rightW - mm(4);
  const innerW = innerR - innerL;
  const cX = v => innerL + (Math.max(0, Math.min(xMax, v)) / xMax) * innerW;

  const chartTop    = tableTop - thRow;
  const chartBottom = tableBottom;

  const gridStep = 10;
  for (let t = gridStep; t <= xMax + 1e-9; t += gridStep) {
    const gx = cX(t);
    page.drawLine({ start:{x:gx,y:chartBottom}, end:{x:gx,y:chartTop}, thickness:0.35, color:K, opacity:0.35 });
  }

  page.drawLine({ start:{x:innerL,y:chartTop}, end:{x:innerR,y:chartTop}, thickness:0.9, color:K });
  scale.ticks.forEach(t => {
    const gx = cX(t);
    page.drawText(String(t), { x:gx-mm(2), y:chartTop+mm(2), size:8, font:fReg, color:K });
    page.drawLine({ start:{x:gx,y:chartTop}, end:{x:gx,y:chartTop-mm(2)}, thickness:0.8, color:K });
  });
  page.drawText('Zeit [sec]', { x:innerL-mm(15), y:chartTop+mm(2), size:8.5, font:fBold, color:K });

  page.drawLine({ start:{x:innerL,y:chartBottom}, end:{x:innerL,y:chartTop}, thickness:0.9, color:K });
  page.drawText('Eindringtiefe', { x:innerL-mm(5.0), y:chartBottom+mm(1.5), size:8.5, font:fBold, color:K, rotate:degrees(90) });

  const dataRowH = (tH - thRow - mm(12)) / (25 + 2);
  let yRowTop = tableTop - thRow;

  const bodenart = meta.bodenart || 'bindig';
  const schuhMm  = Number(meta.schuh || 220);

  let sumTime = 0;
  let sumRd   = 0;

  for (let i=0; i<25; i++){
    const yBot = yRowTop - dataRowH;
    page.drawLine({ start:{x:x0,y:yBot}, end:{x:x0+leftW,y:yBot}, thickness:1, color:K });

    const t    = Number(snap.times?.[i] || 0);
    const note = String(snap.notes?.[i] || '');
    if (t>0) sumTime += t;

    const rd = rdFromSec(t, bodenart, schuhMm);
    sumRd += rd;

    page.drawText(depthLabel(i), { x:x0+mm(1.5), y:yBot+mm(1.5), size:9.5, font:fReg, color:K });
    if (t>0) page.drawText(String(t), { x:xC1+mm(1.5), y:yBot+mm(1.5), size:9.5, font:fReg, color:K });
    page.drawText(fmtComma(rd,2), { x:xC2+mm(1.5), y:yBot+mm(1.5), size:9.5, font:fReg, color:K });
    if (note) drawFit(note, xC3+mm(1.5), yBot+mm(1.5), (x0+leftW-mm(2))-(xC3+mm(1.5)), fReg, 9);

    const yMid     = yBot + dataRowH/2;
    const yLbl     = depthLabel(i);
    const yLblSize = 7.5;
    const yLblW    = pdfTextWidth(fReg, yLblSize, yLbl);
    page.drawLine({ start:{x:innerL,y:yMid}, end:{x:innerL+mm(1.5),y:yMid}, thickness:0.7, color:K });
    page.drawText(yLbl, { x:innerL-mm(1.2)-yLblW, y:yMid-mm(1.2), size:yLblSize, font:fReg, color:K });

    if (t>0) {
      const barH = dataRowH*0.60;
      const barY = yBot + (dataRowH-barH)/2;
      page.drawRectangle({ x:cX(0), y:barY, width:Math.max(0.5, cX(t)-cX(0)), height:barH, color:rgb(1,0.929,0), borderColor:K, borderWidth:0.6 });
    }
    yRowTop = yBot;
  }

  const fy1 = yRowTop - dataRowH;
  page.drawLine({ start:{x:x0,y:fy1}, end:{x:x0+leftW,y:fy1}, thickness:1, color:K });
  page.drawText('Gesamtzeit:', { x:x0+mm(1.5), y:fy1+mm(1.5), size:10, font:fBold, color:K });
  page.drawText(String(sumTime), { x:xC1+mm(1.5), y:fy1+mm(1.5), size:10, font:fReg, color:K });
  if (meta.ed) page.drawText(fmtComma(Number(meta.ed),2), { x:xC3+mm(1.5), y:fy1+mm(1.5), size:10, font:fReg, color:K });

  const fy2 = fy1 - dataRowH;
  page.drawLine({ start:{x:x0,y:fy2}, end:{x:x0+leftW,y:fy2}, thickness:1, color:K });
  drawFit('Σ Pfahlwiderstand Rd', x0+mm(1.5), fy2+mm(1.5), c1-mm(3), fBold, 9.5);
  page.drawText(fmtComma(sumRd,2), { x:xC2+mm(1.5), y:fy2+mm(1.5), size:10, font:fReg, color:K });
  const ok = sumRd >= Number(meta.ed || 0);
  page.drawText(ok ? 'Rd ≥ Ed' : 'Rd < Ed', { x:xC3+mm(1.5), y:fy2+mm(1.5), size:10, font:fBold, color: ok ? rgb(0,0.5,0) : rgb(0.8,0,0) });

  const signTop = tableBottom - mm(2);
  page.drawLine({ start:{x:x0,y:signTop}, end:{x:x0+W,y:signTop}, thickness:1, color:K });
  page.drawLine({ start:{x:x0+W/2,y:y0}, end:{x:x0+W/2,y:signTop}, thickness:1, color:K });

  page.drawText('AN ( Datum; Unterschrift)',     { x:x0+mm(2),     y:y0+mm(6), size:10, font:fReg, color:K });
  page.drawText('AG/ ÖBA (Datum; Unterschrift)', { x:x0+W/2+mm(2), y:y0+mm(6), size:10, font:fReg, color:K });

  const an = snap.sign?.an || {};
  const ag = snap.sign?.ag || {};
  const boxPad  = mm(3);
  const leftX   = x0 + boxPad;
  const leftW2  = (W/2) - 2*boxPad;
  const rightX  = x0 + (W/2) + boxPad;
  const rightW2 = (W/2) - 2*boxPad;

  const dateY = signTop - mm(6.5);
  if (an.date) page.drawText(dateDE(an.date), { x:x0+mm(2),     y:dateY, size:9, font:fBold, color:K });
  if (ag.date) page.drawText(dateDE(ag.date), { x:x0+W/2+mm(2), y:dateY, size:9, font:fBold, color:K });

  const sigBottom = y0 + mm(8);
  const sigTop    = dateY - mm(2.0);
  const sigH      = Math.max(mm(5), sigTop - sigBottom);

  function drawImageFit(img, x, y, w, h){
    const pad = Math.min(w, h) * 0.06;
    const aw = Math.max(1, w - 2*pad);
    const ah = Math.max(1, h - 2*pad);
    const s  = Math.min(aw / img.width, ah / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    const dx = x + (w - dw)/2;
    const dy = y + (h - dh)/2;
    page.drawImage(img, { x:dx, y:dy, width:dw, height:dh });
  }

  if (an.img) {
    const u8 = dataURLtoU8(an.img);
    if (u8) { const png = await pdf.embedPng(u8); drawImageFit(png, leftX, sigBottom, leftW2, sigH); }
  }
  if (ag.img) {
    const u8 = dataURLtoU8(ag.img);
    if (u8) { const png = await pdf.embedPng(u8); drawImageFit(png, rightX, sigBottom, rightW2, sigH); }
  }

  const bytes = await pdf.save();
  const blob  = new Blob([bytes], { type: 'application/pdf' });
  const url   = URL.createObjectURL(blob);
  const pdfWin = window.open(url, '_blank');
  if (!pdfWin) {
    const d    = meta.datum ? new Date(meta.datum) : new Date();
    const name = `${dateTag(d)}_Rammpfahl-Protokoll_Nr ${meta.pfahlNr || 'X'}.pdf`;
    const a    = document.createElement('a');
    a.href = url; a.download = name; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ───────────────────────── Events ───────────────────────── */
function hookEvents(){
  [
    'inp-datum','inp-projekt','inp-kostenstelle','inp-auftraggeber',
    'inp-traeger','inp-hammer','inp-pfahl-nr','inp-pfahltyp',
    'inp-schuh','inp-bodenart','inp-ed'
  ].forEach(id => {
    $(id)?.addEventListener('input',  () => { recalc(); saveDraftDebounced(); });
    $(id)?.addEventListener('change', () => { recalc(); saveDraftDebounced(); });
  });

  $('bem-bodenart')?.addEventListener('change', buildBemTable);
  $('bem-schuh')?.addEventListener('input',    buildBemTable);

  $('btnStartNext')?.addEventListener('click', timerStartNext);
  $('btnStop')?.addEventListener('click', timerStop);

  $('btnReset')?.addEventListener('click', () => {
    if (state.timer.running) {
      state.timer.running = false;
      if (state.timer.raf) cancelAnimationFrame(state.timer.raf);
      state.timer.raf = null;
    }
    timeInputs.forEach(i => i.value = '');
    noteInputs.forEach(i => i.value = '');
    const live = $('timeLive'); if (live) live.value = '0 s';
    state.timer.selectedIdx = 0;
    const sel = $('meterSelect'); if (sel) sel.value = '0';
    sigPads.an?.clear();
    sigPads.ag?.clear();
    timerSetBtnUI();
    recalc();
    saveDraftDebounced();
  });

  $('btnSave')?.addEventListener('click', () => {
    saveCurrentToHistory();
    alert('Messung im Verlauf gespeichert.');
  });

  $('btnPdf')?.addEventListener('click', () => {
    exportPdf().catch(err => {
      console.error(err);
      alert('PDF-Fehler: ' + (err?.message || String(err)));
    });
  });
}

/* ───────────────────────── Init ───────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  if ($('inp-datum') && !$('inp-datum').value)
    $('inp-datum').value = new Date().toISOString().slice(0,10);

  initTabs();
  buildProtocolTable();
  buildMeterSelect();
  buildPfahltypDropdown();
  buildProductLists();
  buildBemTable();
  timerSetBtnUI();
  hookEvents();
  initSignaturePads();
  loadDraft();
  recalc();
  renderHistoryList();

  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('sw.js').catch(() => {});

  // ── PWA Install — muss innerhalb DOMContentLoaded bleiben (Android-Fix)
  let _installPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _installPrompt = e;
    const btn = $('btnInstall');
    if (btn) btn.hidden = false;
  });

  $('btnInstall')?.addEventListener('click', async () => {
    if (!_installPrompt) return;
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    if (outcome === 'accepted') {
      const btn = $('btnInstall');
      if (btn) btn.hidden = true;
    }
    _installPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    const btn = $('btnInstall');
    if (btn) btn.hidden = true;
    _installPrompt = null;
  });
});
