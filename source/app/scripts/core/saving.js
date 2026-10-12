// ---------- saving ----------
function cropRGBA(c, [x0, y0, x1, y1]){
  if (x0 === 0 && y0 === 0 && x1 === W && y1 === H) return c;
  const bw = x1 - x0, out = new Uint8ClampedArray(bw * (y1 - y0) * 4);
  for (let y = y0; y < y1; y++) out.set(c.subarray((y * W + x0) * 4, (y * W + x1) * 4), (y - y0) * bw * 4);
  return out;
}
function resizeRGBA(c, w, h, nw, nh){
  let cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').putImageData(new ImageData(c, w, h), 0, 0);
  // halve repeatedly for clean downscaling, then finish at the exact size
  while (w / 2 >= nw && h / 2 >= nh){
    const nx = document.createElement('canvas'); nx.width = Math.max(1, w >> 1); nx.height = Math.max(1, h >> 1);
    const g = nx.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, nx.width, nx.height); cv = nx; w = nx.width; h = nx.height;
  }
  const out = document.createElement('canvas'); out.width = nw; out.height = nh;
  const g = out.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, nw, nh);
  return g.getImageData(0, 0, nw, nh).data;
}
function updateScaleOut(){ const s = S.scale / 100; $('#scaleOut').textContent = S.scale + '% · ' + Math.max(1, Math.round(DocW * s)) + '×' + Math.max(1, Math.round(DocH * s)) + ' px'; }
const fmtBytes = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
function clearEstimate(){ const e = $('#estOut'); if (e) e.textContent = ''; }
function updateFmtUI(){
  const f = $('#fmt').value, multi = docFrames() > 1;
  $('#qRow').hidden = f !== 'webp';
  $('#gifOpts').hidden = f !== 'gif';
  $('#gifAnimRows').hidden = !(f === 'gif' && multi);
  $('#gifAnimOpts').hidden = !$('#gifAll').checked;
  updateScaleOut(); clearEstimate();
  const inViewer = !!downloadsP;
  const notes = {
    png: 'Lossless, with smooth semi-transparent edges.' + (multi ? ' Saves the current frame.' : ''),
    webp: 'Keeps soft edges at a fraction of PNG size.' + (multi ? ' Saves the current frame.' : ''),
    tiff: 'Uncompressed RGBA, for print and layout tools.' + (inViewer ? ' Delivered inside a .zip, since this viewer only hands out certain file types.' : '') + (multi ? ' Saves the current frame.' : ''),
    gif: 'Each pixel is either fully shown or fully clear. Fewer colors, lossy compression, a smaller scale and fewer frames all shrink the file; pick a blend color that matches where the GIF will sit to avoid jagged edges.' + (S.opacity < 100 ? ' GIF cannot store partial opacity: below 50% the picture disappears, so set a blend color to fade it into instead.' : '')
  };
  $('#fmtNote').textContent = notes[f];
}
$('#fmt').addEventListener('change', updateFmtUI);
rangeBind('atol', 'atol', v => v + '%', () => scheduleAutoPreview());
rangeBind('shrink', 'shrink', v => v + ' px', () => invalidateRefineAndShow());
rangeBind('soft', 'soft', v => v + ' px', () => invalidateRefineAndShow());
rangeBind('gcol', 'gcol', v => v + (v === 255 ? ' (max)' : ''), clearEstimate);
rangeBind('glossy', 'glossy', v => v === 0 ? 'Off' : v + '%', clearEstimate);
rangeBind('scale', 'scale', v => v, () => { updateScaleOut(); clearEstimate(); });
$('#defringe').addEventListener('change', e => { S.defringe = e.target.checked; invalidateRefineAndShow(); });
function invalidateRefineAndShow(){ if (!W) return; invalidateRefine(); clearEstimate(); if (!refineOn()) renderRect(0, 0, W, H); }
segBind('#gpalSeg', 'p', v => { S.gpal = v; clearEstimate(); });
['#gdither', '#matte', '#gskip', '#gspeed', '#gloop', '#gopt', '#trim', '#q'].forEach(id => $(id).addEventListener('change', clearEstimate));
$('#gifAll').addEventListener('change', updateFmtUI);
$('#estBtn').addEventListener('click', estimate);



class SaveError extends Error {}
async function buildOutput(rawTiff, baseName){
  const f = $('#fmt').value, trim = $('#trim').checked, n = docFrames();
  const anim = f === 'gif' && n > 1 && $('#gifAll').checked;
  let idxs = [], dl = [];
  if (anim){
    const step = +$('#gskip').value, speed = +$('#gspeed').value;
    for (let i = 0; i < n; i += step){ idxs.push(i); let sum = 0; for (let k = i; k < Math.min(n, i + step); k++){ const dk = docDelay(k); sum += dk >= 2 ? dk : 10; } dl.push(Math.max(2, Math.round(sum / speed))); }
  } else { idxs = [S.dcur]; dl = [docDelay(S.dcur)]; }
  const comps = idxs.map(i => composeDoc(i, true));
  const box = trim ? contentBoxDoc(comps) : [0, 0, DocW, DocH];
  if (!box) throw new SaveError('Nothing to save: every pixel is erased.');
  let bw = box[2] - box[0], bh = box[3] - box[1];
  let out = comps.map(c => cropDoc(c, box));
  if (S.scale < 100){
    const nw = Math.max(1, Math.round(bw * S.scale / 100)), nh = Math.max(1, Math.round(bh * S.scale / 100));
    out = out.map(c => resizeRGBA(c, bw, bh, nw, nh)); bw = nw; bh = nh;
  }
  if (PIX.on && PIX.exportScale > 1){ const k = PIX.exportScale; out = out.map(c => upscaleNearest(c, bw, bh, k)); bw *= k; bh *= k; }
  const base = baseName || (S.name + '-cutout');
  let blob, filename;
  if (f === 'png' || f === 'webp'){
    const cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
    cv.getContext('2d').putImageData(new ImageData(out[0], bw, bh), 0, 0);
    blob = await new Promise(r => cv.toBlob(r, 'image/' + f, f === 'webp' ? S.q / 100 : undefined));
    if (!blob) throw new SaveError('Could not encode the image.');
    if (f === 'webp' && blob.type !== 'image/webp') throw new SaveError('This browser cannot write WebP. Choose PNG, or use Chrome, Edge or Firefox.');
    filename = base + '.' + f;
  } else if (f === 'tiff'){
    const tif = encodeTiff(out[0], bw, bh);
    if (downloadsP && !rawTiff){ blob = new Blob([zipStore(base + '.tif', tif)]); filename = base + '-tiff.zip'; }
    else { blob = new Blob([tif], { type: 'image/tiff' }); filename = base + '.tif'; }
  } else {
    const mv = $('#matte').value;
    const matte = mv === 'white' ? [255, 255, 255] : mv === 'black' ? [0, 0, 0] : mv === 'bg' ? hexToRgb(S.bgColor) : null;
    const gif = encodeGif(out, bw, bh, dl, {
      matte, colors: S.gcol, dither: $('#gdither').value, lossy: S.glossy,
      local: anim && S.gpal === 'frame', optimize: !anim || $('#gopt').checked, loop: +$('#gloop').value
    });
    blob = new Blob([gif], { type: 'image/gif' }); filename = base + '.gif';
  }
  return { blob, filename, w: bw, h: bh, count: idxs.length };
}
const FILE_TYPES = {
  png: { ext: 'png', mime: 'image/png', desc: 'PNG image' },
  webp: { ext: 'webp', mime: 'image/webp', desc: 'WebP image' },
  tiff: { ext: 'tif', mime: 'image/tiff', desc: 'TIFF image' },
  gif: { ext: 'gif', mime: 'image/gif', desc: 'GIF image' }
};
const canPick = typeof window.showSaveFilePicker === 'function';
let savingNow = false;
// Save: open the system Save dialog first (while the click still counts as a user action), then encode and write.
async function doSave(){
  if (!W || savingNow) return;
  stopPlay();
  const t = FILE_TYPES[$('#fmt').value], suggested = S.name + '-cutout.' + t.ext;
  if (canPick){
    let handle = null;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: suggested, types: [{ description: t.desc, accept: { [t.mime]: ['.' + t.ext] } }] });
    } catch (err) {
      if (err && err.name === 'AbortError'){ toast('Save cancelled.'); return; }
      handle = null; // the picker is blocked in this view: fall back to the app's own save window
    }
    if (handle){
      savingNow = true; busy(true); await new Promise(r => setTimeout(r, 16));
      try {
        const o = await buildOutput(true); showEstimate(o);
        const w = await handle.createWritable(); await w.write(o.blob); await w.close();
        toast('Saved ' + handle.name + ' · ' + fmtBytes(o.blob.size));
      } catch (err) { toast(err instanceof SaveError ? err.message : 'Saving failed: ' + (err && err.message || err), 5000); }
      finally { busy(false); savingNow = false; }
      return;
    }
  }
  openSaveDialog(t, suggested);
}
function openSaveDialog(t, suggested){
  const dlg = $('#saveDlg');
  $('#sdName').value = suggested.replace(/\.[^.]+$/, '');
  $('#sdExt').textContent = '.' + (downloadsP && t.ext === 'tif' ? 'tif inside .zip' : t.ext);
  const s = S.scale / 100, multi = $('#fmt').value === 'gif' && docFrames() > 1 && $('#gifAll').checked;
  $('#sdInfo').textContent = t.desc + ' · ' + Math.max(1, Math.round(DocW * s)) + ' × ' + Math.max(1, Math.round(DocH * s)) + ' px' + ($('#trim').checked ? ' before trimming' : '') + (multi ? ' · animated' : '');
  $('#sdWhere').textContent = shareWanted() ? 'Next, the iPad\'s share sheet opens: choose Save to Files to pick a folder, or Save Image to put it in Photos.' : downloadsP
    ? 'The viewer asks you to confirm the download next. Where it goes depends on your browser\'s download settings; turn on "Always ask where to save files" (Chrome, Edge) or "Always ask you where to save files" (Firefox) to pick a folder each time.'
    : 'This browser does not let pages open a folder picker, so the file goes to your downloads. To choose a folder every time, turn on "Always ask you where to save files" in Firefox, or in Safari set "File download location" to "Ask for each download".';
  dlg.hidden = false; setTimeout(() => { const i = $('#sdName'); i.focus(); i.select(); }, 0);
}
function closeSaveDialog(){ $('#saveDlg').hidden = true; }
async function confirmSaveDialog(){
  const t = FILE_TYPES[$('#fmt').value];
  let name = $('#sdName').value.trim().replace(/[\\/:*?"<>|]+/g, '-') || (S.name + '-cutout');
  closeSaveDialog();
  savingNow = true; busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const o = await buildOutput(false, name); showEstimate(o);
    await saveBlob(o.blob, o.filename);
  } catch (err) { toast(err instanceof SaveError ? err.message : 'Saving failed: ' + (err && err.message || err), 5000); }
  finally { busy(false); savingNow = false; }
}
function showEstimate(o){ $('#estOut').textContent = fmtBytes(o.blob.size) + ' · ' + o.w + '×' + o.h + (o.count > 1 ? ' · ' + o.count + ' frames' : ''); }
async function estimate(){
  if (!W) return; stopPlay(); busy(true); $('#estOut').textContent = 'Encoding…'; await new Promise(r => setTimeout(r, 16));
  try { showEstimate(await buildOutput()); }
  catch (err) { $('#estOut').textContent = ''; toast(err instanceof SaveError ? err.message : 'Could not encode: ' + (err && err.message || err), 5000); }
  finally { busy(false); }
}
async function saveBlob(blob, filename){
  if (!downloadsP && shareWanted()){ shareFile(blob, filename); return; }
  if (downloadsP){
    const dl = await downloadsP;
    if (!dl){ toast('Saving files is not available in this view.', 4500); return; }
    try { await dl.save({ filename, data: blob }); toast('Saved ' + filename + ' · ' + fmtBytes(blob.size)); }
    catch (err) {
      const c = err && err.code;
      if (c === 'declined') toast('Save cancelled.');
      else if (c === 'rate_limited') toast('A save prompt is already open.');
      else if (c === 'too_large') toast('That file is too large to hand over here. Try Trim transparent edges or WebP.', 5000);
      else toast('Could not save: ' + ((err && err.message) || c || 'unknown error'), 5000);
    }
    return;
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Saved ' + filename + ' · ' + fmtBytes(blob.size));
}
$('#saveBtn').addEventListener('click', () => { closeModal('saveOpts'); doSave(); });
$('#sdForm').addEventListener('submit', e => { e.preventDefault(); confirmSaveDialog(); });
$('#sdCancel').addEventListener('click', () => { closeSaveDialog(); toast('Save cancelled.'); });
$('#saveDlg').addEventListener('pointerdown', e => { if (e.target.id === 'saveDlg') closeSaveDialog(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#saveDlg').hidden){ e.preventDefault(); closeSaveDialog(); } }, true);
$('#saveTop').addEventListener('click', openSaveOpts);
