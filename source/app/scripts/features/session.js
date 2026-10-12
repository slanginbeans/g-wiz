// ===================== importing big pictures, and autosave =====================

// ---------- "the picture is bigger than the canvas" ----------
var FIT = { batch: 0, choice: null, last: store.get('fitChoice', 'scale') };
const fitDlg = document.createElement('div');
fitDlg.className = 'modal'; fitDlg.id = 'fitDlg'; fitDlg.hidden = true;
fitDlg.innerHTML = '<div class="win" role="dialog" aria-modal="true" aria-labelledby="fitTitle" style="width:min(460px,94vw)">' +
  '<div class="titlebar"><span class="tt" id="fitTitle">The picture is bigger than the canvas</span><button class="tbx" type="button" id="fitX" aria-label="Close"><svg viewBox="0 0 8 7"><path d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z"/></svg></button></div>' +
  '<div class="winbody"><p class="hint" id="fitInfo"></p>' +
  '<div class="fitopts" role="radiogroup" aria-label="How to fit it">' +
  '<label class="fitopt"><input type="radio" name="fitHow" value="scale"><span><b>Shrink the picture to fit the canvas</b><span class="hint dim" id="fitScaleTxt"></span></span></label>' +
  '<label class="fitopt"><input type="radio" name="fitHow" value="canvas"><span><b>Enlarge the canvas to fit the picture</b><span class="hint dim" id="fitCanvasTxt"></span></span></label>' +
  '<label class="fitopt"><input type="radio" name="fitHow" value="keep"><span><b>Keep both sizes</b><span class="hint dim">The picture keeps its size; the parts outside the canvas are kept and can be moved into view with the Move tool.</span></span></label>' +
  '</div>' +
  '<label class="check" id="fitAllRow"><input type="checkbox" id="fitAll"> Do the same for the other pictures</label>' +
  '<div class="winbtns"><button class="btn" type="button" id="fitCancel">Cancel</button><button class="btn default" type="button" id="fitOk">Add</button></div></div></div>';
document.body.appendChild(fitDlg);
let fitResolve = null;
function askFit(name, w, h){
  if (FIT.batch > 1 && FIT.choice) return Promise.resolve(FIT.choice);
  const s = Math.min(DocW / w, DocH / h);
  $('#fitInfo').textContent = '"' + name + '" is ' + w + ' × ' + h + ' px. The canvas is ' + DocW + ' × ' + DocH + ' px.';
  $('#fitScaleTxt').textContent = 'Becomes ' + Math.max(1, Math.round(w * s)) + ' × ' + Math.max(1, Math.round(h * s)) + ' px; the canvas stays as it is.';
  const blank = isBlankDoc();
  $('#fitCanvasTxt').textContent = 'The canvas becomes ' + Math.max(DocW, w) + ' × ' + Math.max(DocH, h) + ' px' + (blank ? ', filled with the current background.' : '; the other layers stay centered.');
  $$('#fitDlg input[name=fitHow]').forEach(r => r.checked = r.value === FIT.last);
  $('#fitAllRow').hidden = !(FIT.batch > 1); $('#fitAll').checked = false;
  fitDlg.hidden = false; setTimeout(() => $('#fitOk').focus(), 0);
  return new Promise(res => { fitResolve = res; });
}
function closeFit(v){
  fitDlg.hidden = true; const r = fitResolve; fitResolve = null;
  if (v){ FIT.last = v; store.set('fitChoice', v); if ($('#fitAll').checked) FIT.choice = v; }
  if (r) r(v);
}
$('#fitOk').addEventListener('click', () => closeFit(($('#fitDlg input[name=fitHow]:checked') || {}).value || 'scale'));
$('#fitCancel').addEventListener('click', () => closeFit(null));
$('#fitX').addEventListener('click', () => closeFit(null));
fitDlg.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $('#fitOk').click(); } else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeFit(null); } });
$$('#fitDlg .fitopt').forEach(l => l.addEventListener('dblclick', () => $('#fitOk').click()));

// ---------- autosave ----------
// The whole picture (every layer, frame and edit) is kept in the browser's own storage on this device, a few
// seconds after each change and whenever the app is hidden or closed. The last three pictures are kept.
var AUTO = { on: store.get('autosave', true), failN: 0, askedAfterSave: false, dirty: false, everEdited: false, timer: 0, first: 0, saving: false, docId: null, lastSave: 0, took: 0, savedProject: false };
const newDocId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function idbOpen(){
  return new Promise((res, rej) => {
    if (!window.indexedDB){ rej(new Error('no storage')); return; }
    const r = indexedDB.open('gwiz', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('autosave')) r.result.createObjectStore('autosave', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn){
  const db = await idbOpen();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction('autosave', mode), st = tx.objectStore('autosave'); let out;
      const req = fn(st); if (req) req.onsuccess = () => { out = req.result; };
      tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  } finally { db.close(); }
}
const idbAll = () => idbDo('readonly', st => st.getAll()).then(a => (a || []).sort((x, y) => y.time - x.time));
const idbPut = rec => idbDo('readwrite', st => st.put(rec));
const idbDel = id => idbDo('readwrite', st => st.delete(id));
const idbGet = id => idbDo('readonly', st => st.get(id));
// called just before another picture replaces this one: unsaved changes are kept first
function autoBeforeSwitch(){ if (AUTO.on && AUTO.dirty && AUTO.everEdited && W && !AUTO.saving) autoSave(true); }
function autoNewDoc(){ AUTO.docId = newDocId(); AUTO.dirty = false; AUTO.everEdited = false; AUTO.savedProject = false; clearTimeout(AUTO.timer); AUTO.first = 0; }
function markDirty(){
  if (!W) return;
  if (typeof pixDirty === 'function') pixDirty();
  AUTO.dirty = true; AUTO.everEdited = true; AUTO.savedProject = false;
  if (!AUTO.on) return;
  const now = Date.now(); if (!AUTO.first) AUTO.first = now;
  // a few seconds after the last change, but never more than half a minute after the first unsaved one
  const wait = Math.max(2500, Math.min(AUTO.took * 3, 20000));
  clearTimeout(AUTO.timer);
  AUTO.timer = setTimeout(autoSave, Math.max(500, Math.min(wait, AUTO.first + 30000 + wait - now)));
}
function autoThumb(){
  const rgba = composeDoc(S.dcur, false), c = toCanvas(rgba, DocW, DocH), s = Math.min(1, 160 / Math.max(DocW, DocH));
  const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(DocW * s)); t.height = Math.max(1, Math.round(DocH * s));
  const g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL('image/png');
}
async function autoSave(force){
  clearTimeout(AUTO.timer);
  if (!AUTO.on || !W || !AUTO.dirty || !AUTO.everEdited || AUTO.saving) return;
  // wait for the stroke or operation in progress to finish
  if (!force && (DS.active || stroke || op || (typeof hintStroke !== 'undefined' && hintStroke) || (XF && XF.drag))){ AUTO.timer = setTimeout(autoSave, 1500); return; }
  AUTO.saving = true; const t0 = performance.now();
  try {
    AUTO.dirty = false;
    // everything about the picture is read before the first wait, so a document that is being replaced is captured whole
    const rec = { id: AUTO.docId || (AUTO.docId = newDocId()), name: S.name || 'untitled', time: Date.now(), w: DocW, h: DocH, layers: layers.length, frames: docFrames(), thumb: autoThumb(), bytes: null, saved: AUTO.savedProject, seen: false };
    const bytesP = projectBytes();
    const bytes = await bytesP;
    if (bytes.length > (IS_IOS ? 250e6 : 600e6)){ sbFlash('This picture is too large to autosave. Save it as a project (Ctrl+Shift+S).'); return; }
    rec.bytes = bytes;
    await putWithRoom(rec);
    const all = await idbAll();
    for (const r of all.slice(3)) await idbDel(r.id);
    AUTO.lastSave = rec.time; AUTO.first = 0; AUTO.failN = 0; AUTO.warned = false;
    // once there is work worth keeping, ask again for storage the browser will not clear on its own
    if (!AUTO.askedAfterSave){ AUTO.askedAfterSave = true; askPersist(); }
  } catch (err){
    AUTO.dirty = true; AUTO.failN++;
    if (isQuota(err)) sbFlash('Autosave stopped: this device has no storage space left for G-WIZ. Save your work as a project (File > Save project) to keep it.', 9000);
    else if (!AUTO.warned){ AUTO.warned = true; sbFlash('Autosave is not available here: ' + (err && err.message || err), 6000); }
  } finally {
    AUTO.took = performance.now() - t0; AUTO.saving = false;
    // after a failure, wait longer before each new try (30 s, 1 min, 2 min … up to 5 min)
    if (AUTO.dirty && AUTO.on){ if (AUTO.failN){ clearTimeout(AUTO.timer); AUTO.timer = setTimeout(autoSave, Math.min(300000, 30000 * 2 ** (AUTO.failN - 1))); } else markDirty(); }
  }
}
const isQuota = err => !!err && (err.name === 'QuotaExceededError' || err.code === 22 || /quota|space/i.test(err.message || ''));
// when storage is full, older autosaves of other pictures are removed to make room for the current one
async function putWithRoom(rec){
  try { await idbPut(rec); }
  catch (err){
    if (!isQuota(err)) throw err;
    const others = (await idbAll()).filter(r => r.id !== rec.id);
    if (!others.length) throw err;
    for (const r of others) await idbDel(r.id);
    await idbPut(rec);
    sbFlash('Storage was full, so G-WIZ removed ' + others.length + (others.length === 1 ? ' older autosave' : ' older autosaves') + ' to keep this picture.', 7000);
  }
}
// ---------- storage the browser will not clear ----------
// Browsers may clear a site's saved data when the device runs low on space. Persistent storage protects it;
// Safari grants it mostly to apps opened from the Home Screen.
async function askPersist(){
  try { const st = navigator.storage; if (st && st.persist && !(st.persisted && await st.persisted())) return await st.persist(); } catch (e){}
  return false;
}
const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e){ return false; } };
async function storageText(){
  const st = navigator.storage; let persisted = null, est = null;
  try { if (st && st.persisted) persisted = await st.persisted(); } catch (e){}
  try { if (st && st.estimate) est = await st.estimate(); } catch (e){}
  const use = est && est.usage != null ? ' G-WIZ uses ' + fmtBytes(est.usage) + (est.quota ? ' of the ' + fmtBytes(est.quota) + ' it may use.' : '.') : '';
  if (persisted) return 'Protected: the browser will not clear your autosaves to free up space.' + use;
  if (persisted === null) return 'This browser does not say whether autosaves are protected. Save important work as a project.' + use;
  if (IS_IOS && !isStandalone()) return 'Not protected: Safari may clear autosaves when the iPad runs low on space. Opening G-WIZ from its Home Screen icon usually protects them. Save important work as a project.' + use;
  return 'Not protected: the browser may clear autosaves when the device runs low on space. Save important work as a project.' + use;
}
// save straight away when the app is hidden, switched away from or closed
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && AUTO.dirty) autoSave(true); });
window.addEventListener('pagehide', () => { if (AUTO.dirty) autoSave(true); });
// layer settings that do not go through undo still count as changes
['#lBlend', '#lOpac', '#lName', '#lVis', '#lLock'].forEach(id => $(id).addEventListener('change', markDirty));
$('#layerList').addEventListener('click', e => { if (e.target.closest('.lbtn')) markDirty(); });
askPersist();

// ---------- recovering ----------
const recDlg = document.createElement('div');
recDlg.className = 'modal'; recDlg.id = 'recDlg'; recDlg.hidden = true;
recDlg.innerHTML = '<div class="win" role="dialog" aria-modal="true" aria-labelledby="recTitle" style="width:min(520px,94vw)">' +
  '<div class="titlebar"><span class="tt" id="recTitle">Pick up where you left off?</span><button class="tbx" type="button" id="recX" aria-label="Close"><svg viewBox="0 0 8 7"><path d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z"/></svg></button></div>' +
  '<div class="winbody"><p class="hint" id="recInfo">G-WIZ saved your work automatically. Choose a picture to open it again.</p>' +
  '<div class="reclist sunken" id="recList" role="listbox"></div>' +
  '<p class="hint dim" id="recStore"></p>' +
  '<div class="winbtns"><button class="btn" type="button" id="recDelAll">Delete all</button><span class="spacer"></span><button class="btn" type="button" id="recSkip">Start fresh</button><button class="btn default" type="button" id="recOpen">Open</button></div></div></div>';
document.body.appendChild(recDlg);
let recSel = null, recItems = [];
const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t).toLocaleDateString(); };
function renderRecList(){
  const box = $('#recList'); box.innerHTML = '';
  for (const r of recItems){
    const row = document.createElement('div'); row.className = 'recrow' + (r.id === recSel ? ' sel' : ''); row.setAttribute('role', 'option'); row.tabIndex = 0;
    row.innerHTML = '<div class="recthumb"><img alt=""></div><div class="recmeta"><div class="recname"></div><div class="hint dim"></div></div><button class="lbtn recdel" type="button" data-tip="Delete this autosave">×</button>';
    row.querySelector('img').src = r.thumb || ''; row.querySelector('.recname').textContent = r.name;
    row.querySelector('.hint').textContent = r.w + ' × ' + r.h + ' px · ' + r.layers + (r.layers === 1 ? ' layer' : ' layers') + (r.frames > 1 ? ' · ' + r.frames + ' frames' : '') + ' · ' + ago(r.time) + ' · ' + fmtBytes(r.bytes ? r.bytes.length : 0) + (r.saved ? ' · saved as a project' : '');
    row.addEventListener('click', () => { recSel = r.id; renderRecList(); });
    row.addEventListener('dblclick', () => { recSel = r.id; $('#recOpen').click(); });
    row.querySelector('.recdel').addEventListener('click', async ev => { ev.stopPropagation(); await idbDel(r.id); recItems = recItems.filter(x => x.id !== r.id); if (recSel === r.id) recSel = recItems[0] ? recItems[0].id : null; renderRecList(); $('#recDelAll').disabled = !recItems.length; });
    box.appendChild(row);
  }
  $('#recOpen').disabled = !recSel;
}
async function showRecover(startup){
  let all = [];
  try { all = await idbAll(); } catch (e){ if (!startup) toast('Autosave is not available in this browser.'); return; }
  if (startup) all = all.filter(r => !r.seen && !r.saved && r.id !== AUTO.docId);
  else all = all.filter(r => r.id !== AUTO.docId || !AUTO.dirty);
  if (!all.length && startup) return;
  recItems = all; recSel = all.length ? all[0].id : null;
  $('#recTitle').textContent = startup ? 'Pick up where you left off?' : 'Recover autosaved work';
  $('#recSkip').textContent = startup ? 'Start fresh' : 'Close';
  $('#recInfo').textContent = startup ? 'G-WIZ saved your work automatically before it was closed. Choose a picture to open it again.' : 'The last pictures you worked on, saved automatically on this device.';
  if (!all.length) $('#recInfo').textContent = 'There is no autosaved work yet. G-WIZ saves your picture on this device a few seconds after each change.';
  renderRecList(); $('#recDelAll').disabled = !all.length; recDlg.hidden = false; setTimeout(() => $('#recOpen').focus(), 0);
  $('#recStore').textContent = ''; storageText().then(t => { $('#recStore').textContent = t; });
}
async function markSeen(){ try { for (const r of recItems){ const full = await idbGet(r.id); if (full){ full.seen = true; await idbPut(full); } } } catch (e){} }
$('#recOpen').addEventListener('click', async () => {
  const id = recSel; if (!id) return; recDlg.hidden = true;
  busy(true);
  try {
    const r = await idbGet(id); if (!r){ toast('That autosave is gone.'); return; }
    if (AUTO.dirty) await autoSave(true);
    await openProject(r.bytes, r.name);
    AUTO.docId = r.id; AUTO.dirty = false; AUTO.everEdited = true; AUTO.savedProject = !!r.saved; S.name = r.name; document.title = r.name + ' - G-WIZ';
    toast('Opened "' + r.name + '" from ' + ago(r.time) + '.');
    await markSeen();
  } catch (err){ toast('Could not open the autosave: ' + (err && err.message || err), 5000); }
  finally { busy(false); }
});
$('#recSkip').addEventListener('click', async () => { recDlg.hidden = true; if (!recItems.length) return; await markSeen(); sbFlash('Your autosaved work is still in File > Recover autosaved work.'); });
$('#recX').addEventListener('click', () => $('#recSkip').click());
$('#recDelAll').addEventListener('click', async () => { for (const r of recItems) await idbDel(r.id); recItems = []; recDlg.hidden = true; sbFlash('Deleted the autosaved work.'); });

// ---------- menu entries ----------
{
  const fm = MENUS.file, at = fm.findIndex(it => it && it.c === 'saveProject');
  fm.splice(at + 1, 0,
    { l: 'Recover autosaved work…', c: 'recover' },
    { l: 'Autosave', c: 'autosave', ck: () => AUTO.on });
}
function sessionCmd(c){
  if (c === 'recover'){ showRecover(false); return true; }
  if (c === 'autosave'){ AUTO.on = !AUTO.on; store.set('autosave', AUTO.on); sbFlash(AUTO.on ? 'Autosave is on: your work is kept on this device as you go.' : 'Autosave is off.'); if (AUTO.on && AUTO.dirty) markDirty(); return true; }
  return false;
}
// first look for unfinished work once the app has started
setTimeout(() => showRecover(true), 400);
