// ---------- view ----------
let drawQueued = false;
function requestDraw(){ if (!drawQueued){ drawQueued = true; requestAnimationFrame(draw); } }
function resize(){
  const r = stage.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
  const first = !cw; const ocw = cw, och = ch;
  cw = r.width; ch = r.height; view.width = Math.round(cw * dpr); view.height = Math.round(ch * dpr);
  if (themeCols) themeCols.pat = null;
  if (!first && W){ S.panX += (cw - ocw) / 2; S.panY += (ch - och) / 2; }
  requestDraw();
}
new ResizeObserver(resize).observe(stage);

function draw(){
  drawQueued = false;
  if (!themeCols) readTheme();
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vctx.clearRect(0, 0, cw, ch);
  if (!W) return;
  const x = S.panX + LX() * S.zoom, y = S.panY + LY() * S.zoom, w = W * S.zoom, h = H * S.zoom;
  const vx0 = Math.max(0, x), vy0 = Math.max(0, y), vx1 = Math.min(cw, x + w), vy1 = Math.min(ch, y + h);
  const bgFill = S.bg === 'checker' ? checkerPattern() : S.bg === 'white' ? '#ffffff' : S.bg === 'black' ? '#000000' : S.bgColor;
  drawDocument(bgFill, x, y, w, h);
  if (S.zoom >= pixGridMin()){
    vctx.strokeStyle = PIX.on ? 'rgba(128,128,128,.4)' : 'rgba(128,128,128,.28)'; vctx.lineWidth = 1; vctx.beginPath();
    const ix0 = Math.max(0, Math.floor(-x / S.zoom)), ix1 = Math.min(W, Math.ceil((cw - x) / S.zoom));
    const iy0 = Math.max(0, Math.floor(-y / S.zoom)), iy1 = Math.min(H, Math.ceil((ch - y) / S.zoom));
    for (let i = ix0; i <= ix1; i++){ const sx = Math.round(x + i * S.zoom) + 0.5; vctx.moveTo(sx, Math.max(0, y)); vctx.lineTo(sx, Math.min(ch, y + h)); }
    for (let j = iy0; j <= iy1; j++){ const sy = Math.round(y + j * S.zoom) + 0.5; vctx.moveTo(Math.max(0, x), sy); vctx.lineTo(Math.min(cw, x + w), sy); }
    vctx.stroke();
  }
  if (!S.rotA && !XF) vctx.strokeStyle = 'rgba(127,127,127,.5)', vctx.lineWidth = 1, vctx.strokeRect(Math.round(x) - 0.5, Math.round(y) - 0.5, Math.round(w) + 1, Math.round(h) + 1);
  if (S.crop && !cropIsFull(S.crop) && !S.rotA){
    const x = S.panX, y = S.panY, w = DocW * S.zoom, h = DocH * S.zoom;
    const c = S.crop, z = S.zoom, cx0 = x + c.x * z, cy0 = y + c.y * z, cx1 = cx0 + c.w * z, cy1 = cy0 + c.h * z;
    vctx.fillStyle = 'rgba(8,10,12,.58)';
    vctx.fillRect(x, y, w, cy0 - y); vctx.fillRect(x, cy1, w, y + h - cy1);
    vctx.fillRect(x, cy0, cx0 - x, cy1 - cy0); vctx.fillRect(cx1, cy0, x + w - cx1, cy1 - cy0);
    vctx.strokeStyle = 'rgba(255,255,255,.28)'; vctx.beginPath();
    for (let k = 1; k < 3; k++){ const gx = cx0 + (cx1 - cx0) * k / 3, gy = cy0 + (cy1 - cy0) * k / 3; vctx.moveTo(gx, cy0); vctx.lineTo(gx, cy1); vctx.moveTo(cx0, gy); vctx.lineTo(cx1, gy); }
    vctx.stroke();
    vctx.lineWidth = 3; vctx.strokeStyle = 'rgba(0,0,0,.5)'; vctx.strokeRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
    vctx.lineWidth = 1.25; vctx.strokeStyle = '#ffffff'; vctx.strokeRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
    const label = c.w + ' × ' + c.h;
    vctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
    const tw = vctx.measureText(label).width + 12, lx = Math.max(4, Math.min(cw - tw - 4, cx0)), ly = Math.max(4, cy0 - 22);
    vctx.fillStyle = 'rgba(0,0,0,.72)'; vctx.fillRect(lx, ly, tw, 18); vctx.fillStyle = '#ffffff'; vctx.fillText(label, lx + 6, ly + 13);
  }
  drawToolBoxes();
  // cursor
  const hv = S.hover;
  if (hv && !pan && !pinch && !S.space && (S.tool === 'erase' || S.tool === 'restore')){
    const rr = brushR() * S.zoom;
    vctx.beginPath(); vctx.arc(hv.x, hv.y, Math.max(1, rr), 0, Math.PI * 2);
    vctx.lineWidth = 3; vctx.strokeStyle = 'rgba(0,0,0,.55)'; vctx.stroke();
    const forced = stroke ? stroke.force : (S.force || hv.shift);
    vctx.lineWidth = forced ? 2 : 1.25; vctx.strokeStyle = (S.tool === 'restore' || hv.alt) ? '#7ee2a8' : forced ? '#ffb020' : '#ffffff'; vctx.stroke();
    if (S.hard < 95 && rr > 8){ vctx.beginPath(); vctx.arc(hv.x, hv.y, rr * S.hard / 100, 0, Math.PI * 2); vctx.setLineDash([3, 3]); vctx.lineWidth = 1; vctx.strokeStyle = 'rgba(255,255,255,.55)'; vctx.stroke(); vctx.setLineDash([]); }
    vctx.lineWidth = 1; vctx.strokeStyle = '#ffffff';
    vctx.beginPath(); vctx.moveTo(hv.x - 4, hv.y); vctx.lineTo(hv.x + 4, hv.y); vctx.moveTo(hv.x, hv.y - 4); vctx.lineTo(hv.x, hv.y + 4); vctx.stroke();
  }
}

function setZoom(z, sx = cw / 2, sy = ch / 2){
  z = Math.min(64, Math.max(0.02, z));
  const ix = (sx - S.panX) / S.zoom, iy = (sy - S.panY) / S.zoom;
  S.zoom = z; S.panX = sx - ix * z; S.panY = sy - iy * z;
  $('#zoomVal').textContent = (z >= 10 ? Math.round(z * 100) : (Math.round(z * 1000) / 10)) + '%';
  updateHud(); requestDraw();
}
function fit(){
  if (!W || !cw) return;
  let z = Math.min((cw - 40) / DocW, (ch - 40) / DocH, PIX.on ? 64 : 4);
  if (PIX.on && z >= 1) z = Math.floor(z);
  S.zoom = z; S.panX = (cw - DocW * z) / 2; S.panY = (ch - DocH * z) / 2; setZoom(z, cw / 2, ch / 2);
}
function stepZoom(dir, sx, sy){ const pz = pixStepZoom(dir); setZoom(pz != null ? pz : S.zoom * (dir > 0 ? 1.25 : 0.8), sx, sy); }

function updateHud(){
  const r = brushR();
  let html = '<span><b>' + W + '×' + H + '</b> px</span><span>zoom <b>' + $('#zoomVal').textContent + '</b></span>';
  if (S.tool === 'erase' || S.tool === 'restore') html += '<span>brush <b>' + (r * 2 < 10 ? (r * 2).toFixed(1) : Math.round(r * 2)) + '</b> image px</span>';
  if (S.sample && S.tool === 'erase' && (S.mode === 'smart' || S.mode === 'color')) html += '<span><i class="swatch" style="background:' + fmtHex(S.sample) + '"></i>' + fmtHex(S.sample) + '</span>';
  if (S.force && (S.tool === 'erase' || S.tool === 'restore')) html += '<span><b>Force on</b>: edges and color ignored</span>';
  if (frames.length > 1) html += '<span>frame <b>' + (S.cur + 1) + '/' + frames.length + '</b></span>';
  $('#hud').innerHTML = html;
  $('#sizeOut').textContent = S.size + (S.rel === 'screen' ? ' screen px' : ' image px');
  updateStatus(); renderToolOpts();
}
