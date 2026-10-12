// ---------- edge maps (one per frame, lazy 64px tiles, Sobel over RGBA) ----------
const TILE = 64; let edgeCache = new Map(), tilesX = 0, tilesY = 0;
function resetEdges(){ edgeCache = new Map(); tilesX = Math.ceil(W / TILE); tilesY = Math.ceil(H / TILE); }
function edgeOf(f){
  let e = edgeCache.get(f);
  if (!e){
    e = { map: new Uint8Array(W * H), done: new Uint8Array(tilesX * tilesY) };
    edgeCache.set(f, e);
    const cap = Math.max(4, Math.floor(200e6 / (W * H)));
    for (const k of edgeCache.keys()){ if (edgeCache.size <= cap) break; if (k !== f && k !== S.cur) edgeCache.delete(k); }
  }
  return e;
}
function ensureEdges(f, x0, y0, x1, y1){
  const e = edgeOf(f);
  const tx0 = Math.max(0, Math.floor(x0 / TILE)), ty0 = Math.max(0, Math.floor(y0 / TILE));
  const tx1 = Math.min(tilesX - 1, Math.floor((x1 - 1) / TILE)), ty1 = Math.min(tilesY - 1, Math.floor((y1 - 1) / TILE));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (!e.done[ty * tilesX + tx]){ computeTile(frames[f], e.map, tx, ty); e.done[ty * tilesX + tx] = 1; }
  return e.map;
}
function computeTile(src, edge, tx, ty){
  const wide = S.edgeWide;
  const xs = tx * TILE, xe = Math.min(W, xs + TILE), ys = ty * TILE, ye = Math.min(H, ys + TILE);
  for (let y = ys; y < ye; y++){
    const ym = Math.max(0, y - 1) * W, yc = y * W, yp = Math.min(H - 1, y + 1) * W;
    for (let x = xs; x < xe; x++){
      const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1);
      if (wide){ edge[yc + x] = wideEdge(src, x, y); continue; }
      const A = (ym + xm) * 4, B = (ym + x) * 4, C = (ym + xp) * 4, D = (yc + xm) * 4, F = (yc + xp) * 4, G = (yp + xm) * 4, Hh = (yp + x) * 4, K = (yp + xp) * 4;
      let best = 0;
      for (let c = 0; c < 4; c++){
        const gx = (src[C + c] + 2 * src[F + c] + src[K + c]) - (src[A + c] + 2 * src[D + c] + src[G + c]);
        const gy = (src[G + c] + 2 * src[Hh + c] + src[K + c]) - (src[A + c] + 2 * src[B + c] + src[C + c]);
        const mg = (gx < 0 ? -gx : gx) + (gy < 0 ? -gy : gy);
        if (mg > best) best = mg;
      }
      edge[yc + x] = best >= 1020 ? 255 : best >> 2;
    }
  }
}
// a 5×5 gradient: fine grain and noise average out, real edges stay
function wideEdge(src, x, y){
  let best = 0;
  const x0 = Math.max(0, x - 2), x1 = Math.min(W - 1, x + 2), y0 = Math.max(0, y - 2), y1 = Math.min(H - 1, y + 2);
  for (let c = 0; c < 4; c++){
    let l = 0, r = 0, t = 0, b = 0, nl = 0, nt = 0;
    for (let yy = y0; yy <= y1; yy++){ l += src[(yy * W + x0) * 4 + c] + src[(yy * W + Math.max(0, x - 1)) * 4 + c]; r += src[(yy * W + x1) * 4 + c] + src[(yy * W + Math.min(W - 1, x + 1)) * 4 + c]; nl += 2; }
    for (let xx = x0; xx <= x1; xx++){ t += src[(y0 * W + xx) * 4 + c] + src[(Math.max(0, y - 1) * W + xx) * 4 + c]; b += src[(y1 * W + xx) * 4 + c] + src[(Math.min(H - 1, y + 1) * W + xx) * 4 + c]; nt += 2; }
    const mg = (Math.abs(r - l) / nl + Math.abs(b - t) / nt) * 4;
    if (mg > best) best = mg;
  }
  return best >= 1020 ? 255 : best >> 2;
}
const edgeThr = sens => 6 * Math.pow(220 / 6, (100 - sens) / 100);
