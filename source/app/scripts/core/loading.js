// ---------- loading ----------
async function loadFile(file, asLayer){
  if (!file) return;
  busy(true);
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const base = (file.name || 'pasted-image').replace(/\.[^.]+$/, '') || 'image';
    if (isProjectBytes(buf)){ await openProject(buf, base); return; }
    let res = null;
    const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
    const isTiff = (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 42) || (buf[0] === 0x4D && buf[1] === 0x4D && buf[3] === 42);
    if (isGif){ try { res = decodeGif(buf); } catch (err) { res = null; } }
    if (!res && !isGif && 'ImageDecoder' in window && /image\/(webp|png|apng|avif)/.test(file.type)){
      try { res = await decodeAnimated(buf, file.type); } catch (err) { res = null; }
    }
    if (!res){ try { res = await decodeRaster(file); } catch (err) { if (!isTiff) throw err; } }
    if (!res && isTiff) res = decodeTiff(buf);
    if (!res) throw new Error('unreadable');
    if (asLayer && W){ busy(false); await addLayerFromRes(res, base); }
    else if (setImage(res, base)) toast('Opened ' + (file.name || 'image') + (res.frames.length > 1 ? ' · ' + res.frames.length + ' frames' : ''));
  } catch (err) {
    toast(err && err.message && err.message.length > 20 ? err.message : 'This browser could not read that file. Try PNG, JPEG, WebP or GIF.', 4500);
  } finally { busy(false); }
}
async function decodeAnimated(buf, type){
  const dec = new ImageDecoder({ data: buf, type });
  await dec.tracks.ready;
  const tr = dec.tracks.selectedTrack;
  if (!tr || !tr.animated || tr.frameCount < 2){ dec.close(); return null; }
  const n = Math.min(tr.frameCount, 600);
  const out = [], ds = []; let w = 0, h = 0, cv = null, g = null;
  for (let i = 0; i < n; i++){
    const { image } = await dec.decode({ frameIndex: i });
    if (!cv){ w = image.displayWidth; h = image.displayHeight; cv = document.createElement('canvas'); cv.width = w; cv.height = h; g = cv.getContext('2d', { willReadFrequently: true }); }
    g.clearRect(0, 0, w, h); g.drawImage(image, 0, 0, w, h);
    out.push(g.getImageData(0, 0, w, h).data); ds.push(Math.max(2, Math.round((image.duration || 100000) / 10000)));
    image.close();
  }
  dec.close();
  return { w, h, frames: out, delays: ds };
}
async function decodeRaster(file){
  let src = null, w = 0, h = 0;
  try { src = await createImageBitmap(file); w = src.width; h = src.height; }
  catch (e) {
    const url = URL.createObjectURL(file);
    try { const img = new Image(); img.src = url; await img.decode(); src = img; w = img.naturalWidth || 1024; h = img.naturalHeight || 1024; }
    finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  let s = Math.min(1, 8192 / Math.max(w, h), Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));
  if (s < 1){ toast('Large image scaled to ' + Math.round(w * s) + '×' + Math.round(h * s) + ' px for editing.', 4000); }
  const cvw = Math.max(1, Math.round(w * s)), cvh = Math.max(1, Math.round(h * s));
  const cv = document.createElement('canvas'); cv.width = cvw; cv.height = cvh;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, cvw, cvh);
  if (src.close) src.close();
  return { w: cvw, h: cvh, frames: [g.getImageData(0, 0, cvw, cvh).data], delays: [0] };
}
$('#openBtn').addEventListener('click', () => $('#fileIn').click());
$('#openBtn2').addEventListener('click', () => $('#fileIn').click());
$('#fileIn').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
// The overlay shows while files are dragged over the page and hides itself shortly after dragover events stop
// (drag left the window, was cancelled, or dropped), so it can never get stuck.
let dropT = 0;
const hideDrop = () => { clearTimeout(dropT); $('#drop').hidden = true; };
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragover', e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  $('#drop').hidden = false; clearTimeout(dropT); dropT = setTimeout(hideDrop, 180);
});
window.addEventListener('dragleave', e => { if (!e.relatedTarget) hideDrop(); });
window.addEventListener('dragend', hideDrop);
window.addEventListener('drop', e => { e.preventDefault(); hideDrop(); const fl = [...(e.dataTransfer?.files || [])]; if (fl.length) (async () => { FIT.batch = fl.length; FIT.choice = null; try { for (const f of fl) await loadFile(f, !!W); } finally { FIT.batch = 0; FIT.choice = null; } })(); });
window.addEventListener('paste', e => { const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/')); if (it){ e.preventDefault(); loadFile(it.getAsFile(), !!W); } });
