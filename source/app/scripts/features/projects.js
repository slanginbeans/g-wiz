// ---------- project files (.gwiz) ----------
async function gzip(bytes){ const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function gunzip(bytes){ const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function projectBytes(){
  saveActive();
  const meta = { app: 'G-WIZ', version: 1, name: S.name, w: DocW, h: DocH, active: layers.indexOf(AL), layers: layers.map(L => ({ name: L.name, x: L.x, y: L.y, w: L.W, h: L.H, n: L.frames.length, delays: L.delays, opacity: L.opacity, blend: L.blend, visible: L.visible, locked: L.locked })) };
  const json = new TextEncoder().encode(JSON.stringify(meta)), parts = [new TextEncoder().encode('GWIZPRJ1'), new Uint8Array(new Uint32Array([json.length]).buffer), json];
  for (const L of layers) for (let f = 0; f < L.frames.length; f++){ parts.push(new Uint8Array(L.frames[f].buffer, L.frames[f].byteOffset, L.frames[f].byteLength)); parts.push(L.masks[f]); }
  return gzip(new Uint8Array(await new Blob(parts).arrayBuffer()));
}
function isProjectBytes(b){ return (b[0] === 0x1f && b[1] === 0x8b) || (b[0] === 0x50 && b[1] === 0x4b && b.length > 34 && new TextDecoder().decode(b.subarray(30, 30 + (b[26] | b[27] << 8))).endsWith('.gwiz')); }
async function openProject(bytes, fname){
  if (bytes[0] === 0x50){ const nl = bytes[26] | bytes[27] << 8, sz = bytes[18] | bytes[19] << 8 | bytes[20] << 16 | bytes[21] << 24; bytes = bytes.subarray(30 + nl, 30 + nl + (sz >>> 0)); }
  const raw = await gunzip(bytes), dec = new TextDecoder();
  if (dec.decode(raw.subarray(0, 8)) !== 'GWIZPRJ1') throw new Error('This is not a G-WIZ project file.');
  const jl = new DataView(raw.buffer, raw.byteOffset + 8, 4).getUint32(0, true), meta = JSON.parse(dec.decode(raw.subarray(12, 12 + jl)));
  let p = 12 + jl; const built = [];
  for (const m of meta.layers){
    const fr = [], ms = [];
    for (let f = 0; f < m.n; f++){ const a = m.w * m.h * 4; fr.push(new Uint8ClampedArray(raw.slice(p, p + a))); p += a; ms.push(new Uint8Array(raw.slice(p, p + m.w * m.h))); p += m.w * m.h; }
    const L = newLayerObj(m.w, m.h, fr, m.delays, m.name); L.masks = ms; Object.assign(L, { x: m.x, y: m.y, opacity: m.opacity, blend: m.blend, visible: m.visible, locked: m.locked });
    built.push(L);
  }
  const first = built[0];
  setImage({ w: first.W, h: first.H, frames: first.frames, delays: first.delays }, meta.name || fname);
  // replace the one-layer document setImage made with the project's layers
  masks = first.masks; AL.masks = first.masks; Object.assign(AL, { name: first.name, x: first.x, y: first.y, opacity: first.opacity, blend: first.blend, visible: first.visible, locked: first.locked });
  layers = [AL, ...built.slice(1)]; DocW = meta.w; DocH = meta.h; S.name = meta.name || fname;
  const act = layers[Math.max(0, Math.min(layers.length - 1, meta.active))];
  AL = null; loadActive(act); renderAllLayers(); setupAnim(); fit(); renderLayersPanel(); syncLayerProps(); undoStack.length = 0; redoStack.length = 0; updateUndoUI(); requestDraw();
  toast('Opened project "' + S.name + '" · ' + layers.length + ' layers.');
}
async function saveProject(){
  if (!W) return;
  const name = S.name + '.gwiz';
  let handle = null;
  if (canPick){
    try { handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'G-WIZ project', accept: { 'application/octet-stream': ['.gwiz'] } }] }); }
    catch (err){ if (err && err.name === 'AbortError'){ sbFlash('Save cancelled.'); return; } handle = null; }
  }
  busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const bytes = await projectBytes();
    if (handle){ const w = await handle.createWritable(); await w.write(bytes); await w.close(); toast('Saved project ' + handle.name + ' · ' + fmtBytes(bytes.length)); }
    else if (downloadsP) await saveBlob(new Blob([zipStore(name, bytes)]), S.name + '-project.zip');
    else await saveBlob(new Blob([bytes]), name);
    AUTO.savedProject = true; AUTO.dirty = true; AUTO.everEdited = true; autoSave(true).then(() => { AUTO.savedProject = true; });
  } catch (err){ toast('Could not save the project: ' + (err && err.message || err), 5000); }
  finally { busy(false); }
}
// copy the selected layer (or the whole picture) to the clipboard as a PNG
async function copyToClipboard(merged){
  if (!W) return;
  try {
    const rgba = merged ? composeDoc(S.dcur, false) : layerVisible(AL, S.cur), w = merged ? DocW : W, h = merged ? DocH : H;
    const blob = await new Promise(r => toCanvas(rgba, w, h).toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    sbFlash(merged ? 'Copied the whole picture.' : 'Copied the layer. Ctrl+V pastes it as a new layer.');
  } catch (err){ toast('Copying images is not allowed here.'); }
}
