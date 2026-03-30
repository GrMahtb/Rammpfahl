'use strict';

const DEPTHS = Array.from({ length: 25 }, (_, i) => i);

const STORAGE_DRAFT = 'htb-rammpfahl-draft-v5';
const STORAGE_HISTORY = 'htb-rammpfahl-history-v5';
const HISTORY_MAX = 30;

const RD_PER_M_220 = {
  nichtbindig: { gedrueckt:0, s5_10:27.646015351590183, s10_20:55.292030703180366, s20_30:82.93804605477055, gt30:103.67255756846319 },
  bindig:      { gedrueckt:0, s5_10:13.823007675795091, s10_20:27.646015351590183, s20_30:48.38052686528282, gt30:69.11503837897546 }
};

const $ = (id) => document.getElementById(id);

let timeInputs = [];
let noteInputs = [];

const state = {
  includeKlammer: false,
  timer: { running:false, startMs:0, raf:null, selectedIdx:0 }
};

function fmtComma(n, digits=2){ return Number(n||0).toFixed(digits).replace('.', ','); }
function depthLabel(i){ return `${i}-${i+1}m`; }

function dateTag(d=new Date()){
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

function secClass(sec){
  if (!sec || sec <= 0) return null;
  if (sec < 5) return 'gedrueckt';
  if (sec < 10) return 's5_10';
  if (sec < 20) return 's10_20';
  if (sec <= 30) return 's20_30';
  return 'gt30';
}
function isKlammerClass(bodenart, cls){
  if (!cls) return false;
  if (bodenart === 'nichtbindig') return cls === 's5_10';
  return (cls === 's5_10' || cls === 's10_20'); // bindig
}
function rdFromSec(sec, bodenart, schuhMm, includeKlammer){
  const cls = secClass(sec);
  if (!cls) return 0;
  const base = (RD_PER_M_220[bodenart] || RD_PER_M_220.bindig)[cls] || 0;
  if (!includeKlammer && isKlammerClass(bodenart, cls)) return 0;
  return base * ((Number(schuhMm)||220) / 220);
}

/* ---------- Tabs ---------- */
function initTabs(){
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b===btn));
      document.querySelectorAll('.pane').forEach(p => {
        const on = p.id === `tab-${btn.dataset.tab}`;
        p.classList.toggle('is-active', on);
        p.hidden = !on;
      });
      if (btn.dataset.tab === 'verlauf') renderHistoryList();
    });
  });
}

/* ---------- Draft speichern ---------- */
function collectFormState(){
  return {
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
    times: DEPTHS.map((_,i)=> timeInputs[i]?.value || ''),
    notes: DEPTHS.map((_,i)=> noteInputs[i]?.value || '')
  };
}

function applyFormState(s){
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

  state.includeKlammer = !!Number(s.includeKlammer||0);
  $('optIncludeKlammer').value = state.includeKlammer ? '1' : '0';

  (s.times||[]).slice(0,25).forEach((v,i)=> { if (timeInputs[i]) timeInputs[i].value = v; });
  (s.notes||[]).slice(0,25).forEach((v,i)=> { if (noteInputs[i]) noteInputs[i].value = v; });

  state.timer.selectedIdx = Number(s.meterIdx||0);
  $('meterSelect').value = String(state.timer.selectedIdx);
}

let saveT=null;
function saveDraftDebounced(){
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(STORAGE_DRAFT, JSON.stringify(collectFormState())); } catch {}
  }, 200);
}
function loadDraft(){
  try {
    const raw = localStorage.getItem(STORAGE_DRAFT);
    if (!raw) return;
    applyFormState(JSON.parse(raw));
  } catch {}
}

/* ---------- Verlauf ---------- */
function readHistory(){
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]'); } catch { return []; }
}
function writeHistory(list){
  try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch {}
}
function uid(){
  return crypto?.randomUUID?.() || ('id_' + Date.now() + '_' + Math.random().toString(16).slice(2));
}
function sumsFromSnapshot(snap){
  const bodenart = snap.meta?.bodenart || 'bindig';
  const schuh = Number(snap.meta?.schuh || 220);
  const ed = Number(snap.meta?.ed || 0);
  const includeK = !!Number(snap.includeKlammer||0);
  let sumTime=0, sumRd=0;
  (snap.times||[]).slice(0,25).forEach(tv=>{
    const t=Number(tv||0);
    if (t>0) sumTime += t;
    sumRd += rdFromSec(t, bodenart, schuh, includeK);
  });
  return { sumTime, sumRd, ed, ok: sumRd >= ed };
}
function saveCurrentToHistory(){
  const snap = collectFormState();
  const sums = sumsFromSnapshot(snap);
  const entry = { id: uid(), savedAt: Date.now(), title: `${snap.meta.projekt||'—'} · Pfahl ${snap.meta.pfahlNr||'—'}`, snap, sums };
  const list = readHistory();
  list.unshift(entry);
  writeHistory(list);
  renderHistoryList();
}
function deleteHistory(id){
  writeHistory(readHistory().filter(e=>e.id!==id));
  renderHistoryList();
}
function renderHistoryList(){
  const host = $('historyList');
  if (!host) return;
  const list = readHistory();
  if (!list.length){
    host.innerHTML = `<div class="text"><p>Noch keine gespeicherten Messungen.</p></div>`;
    return;
  }
  host.innerHTML = '';
  list.forEach(entry=>{
    const s = entry.sums || sumsFromSnapshot(entry.snap);
    const div = document.createElement('div');
    div.className = 'historyItem';
    div.innerHTML = `
      <div class="historyTop">
        <div>${entry.title}</div>
        <div style="color:var(--muted);font-size:.85em;font-weight:800">${new Date(entry.savedAt).toLocaleString('de-DE')}</div>
      </div>
      <div class="historySub">
        Gesamtzeit: <b>${s.sumTime} s</b> · ΣRd: <b>${fmtComma(s.sumRd,2)} kN</b> · Ed: <b>${fmtComma(s.ed,2)} kN</b> ·
        Status: <b style="color:${s.ok?'var(--ok)':'var(--err)'}">${s.ok?'Rd ≥ Ed':'Rd < Ed'}</b>
      </div>
      <div class="historyBtns">
        <button class="btn btn--ghost" type="button" data-act="load" data-id="${entry.id}">Laden</button>
        <button class="btn btn--ghost" type="button" data-act="del" data-id="${entry.id}">Löschen</button>
      </div>
    `;
    host.appendChild(div);
  });

  host.querySelectorAll('button[data-act]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id=b.dataset.id, act=b.dataset.act;
      if (act==='del') deleteHistory(id);
      if (act==='load'){
        const entry = readHistory().find(e=>e.id===id);
        if (!entry) return;
        applyFormState(entry.snap);
        recalc();
        saveDraftDebounced();
        document.querySelector('.tab[data-tab="protokoll"]')?.click();
      }
    });
  });
}

/* ---------- Tabelle bauen ---------- */
function buildMeterSelect(){
  const sel = $('meterSelect');
  sel.innerHTML = '';
  DEPTHS.forEach((d,i)=> sel.appendChild(new Option(depthLabel(i), String(i))));
  sel.value = String(state.timer.selectedIdx || 0);
  sel.addEventListener('change', ()=>{
    state.timer.selectedIdx = Number(sel.value)||0;
    saveDraftDebounced();
  });
}

function buildProtocolTable(){
  const tbody = $('protoBody');
  tbody.innerHTML = '';
  timeInputs = [];
  noteInputs = [];

  DEPTHS.forEach((d,i)=>{
    const tr = document.createElement('tr');

    const tdD = document.createElement('td');
    tdD.textContent = depthLabel(i);
    tr.appendChild(tdD);

    const tdT = document.createElement('td');
    const inpT = document.createElement('input');
    inpT.type='number'; inpT.min='0'; inpT.step='1';
    inpT.addEventListener('input', ()=>{ recalc(); saveDraftDebounced(); });
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

/* ---------- Recalc ---------- */
function recalc(){
  const bodenart = $('inp-bodenart').value;
  const schuh = Number($('inp-schuh').value||220);
  const ed = Number($('inp-ed').value||0);
  const includeK = state.includeKlammer;

  let sumTime=0, sumRd=0;

  DEPTHS.forEach((_,i)=>{
    const t = Number(timeInputs[i]?.value||0);
    if (t>0) sumTime += t;
    const rd = rdFromSec(t, bodenart, schuh, includeK);
    sumRd += rd;
    const el = $(`rd-${i}`);
    if (el) el.textContent = fmtComma(rd,2);
  });

  $('sumTime').textContent = String(sumTime);
  $('sumRd').textContent = fmtComma(sumRd,2);

  const ok = sumRd >= ed;
  const res = $('sumResult');
  res.textContent = ok ? 'Rd ≥ Ed' : 'Rd < Ed';
  res.className = 'sum-result ' + (ok ? 'ok' : 'err');
}

/* ---------- Timer Toggle (Start/Stop in einem Button) ---------- */
function timerSetButtonUI(){
  const btn = $('btnTimeToggle');
  if (!btn) return;
  if (state.timer.running){
    btn.textContent = 'Stop';
    btn.classList.remove('btn--accent');
    btn.classList.add('btn--stop');
  } else {
    btn.textContent = 'Start';
    btn.classList.remove('btn--stop');
    btn.classList.add('btn--accent');
  }
}

function timerTick(){
  if (!state.timer.running) return;
  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs)/1000));
  $('timeLive').value = `${sec} s`;
  state.timer.raf = requestAnimationFrame(timerTick);
}

function timerStart(){
  state.timer.running = true;
  state.timer.startMs = Date.now();
  $('timeLive').value = '0 s';
  timerSetButtonUI();
  timerTick();
}

function timerStopWriteAdvance(){
  state.timer.running = false;
  if (state.timer.raf) cancelAnimationFrame(state.timer.raf);
  state.timer.raf = null;

  const sec = Math.max(0, Math.round((Date.now() - state.timer.startMs)/1000));
  const idx = state.timer.selectedIdx || 0;
  if (timeInputs[idx]) timeInputs[idx].value = String(sec);

  // automatisch weiter
  const next = Math.min(DEPTHS.length-1, idx+1);
  state.timer.selectedIdx = next;
  $('meterSelect').value = String(next);

  $('timeLive').value = `${sec} s`;

  recalc();
  saveDraftDebounced();
  timerSetButtonUI();
}

function timerToggle(){
  if (state.timer.running) timerStopWriteAdvance();
  else timerStart();
}

/* ---------- PDF (Minimal: nur Dateiname testen) ---------- */
async function exportPdfDownload(){
  // Damit die App nicht blockiert, wenn pdf-lib offline noch nicht geladen ist
  if (!window.PDFLib || !window.fontkit) {
    alert('PDF-Library noch nicht geladen (einmal online laden, dann cached der Service Worker).');
    return;
  }
  // hier kannst du wieder deinen großen 1:1 Export einsetzen
  alert(`PDF Export ist aktiv (Dateiname wäre: ${dateTag()}.pdf). Wenn du willst, setze ich den 1:1 PDF-Block wieder ein.`);
}

/* ---------- Hook Events ---------- */
function hookEvents(){
  [
    'inp-datum','inp-projekt','inp-kostenstelle','inp-auftraggeber',
    'inp-traeger','inp-hammer','inp-pfahl-nr','inp-pfahltyp',
    'inp-schuh','inp-bodenart','inp-ed'
  ].forEach(id=>{
    $(id)?.addEventListener('input', ()=>{ recalc(); saveDraftDebounced(); });
    $(id)?.addEventListener('change', ()=>{ recalc(); saveDraftDebounced(); });
  });

  $('optIncludeKlammer')?.addEventListener('change', ()=>{
    state.includeKlammer = $('optIncludeKlammer').value === '1';
    recalc(); saveDraftDebounced();
  });

  $('btnTimeToggle')?.addEventListener('click', timerToggle);

  $('btnReset')?.addEventListener('click', ()=>{
    timeInputs.forEach(i=> i.value='');
    noteInputs.forEach(i=> i.value='');
    $('timeLive').value = '0 s';
    state.timer.running = false;
    timerSetButtonUI();
    state.timer.selectedIdx = 0;
    $('meterSelect').value = '0';
    recalc(); saveDraftDebounced();
  });

  $('btnSave')?.addEventListener('click', ()=>{
    saveCurrentToHistory();
    alert('Messung im Verlauf gespeichert.');
  });

  $('btnPdf')?.addEventListener('click', exportPdfDownload);
}

/* ---------- INIT ---------- */
window.addEventListener('DOMContentLoaded', () => {
  if ($('inp-datum') && !$('inp-datum').value) $('inp-datum').value = new Date().toISOString().slice(0,10);

  initTabs();
  buildProtocolTable();
  buildMeterSelect();
  timerSetButtonUI();

  hookEvents();
  loadDraft();
  recalc();
  renderHistoryList();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});
