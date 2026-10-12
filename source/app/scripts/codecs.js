
/*CODECS-START*/
// ---------- GIF decoding ----------
function lzwDecode(minCode, data, count){
  const out = new Uint8Array(count);
  const clear = 1 << minCode, eoi = clear + 1;
  const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), first = new Uint8Array(4096), len = new Uint16Array(4096);
  for (let i = 0; i < clear; i++){ prefix[i] = -1; suffix[i] = i; first[i] = i; len[i] = 1; }
  let size = minCode + 1, mask = (1 << size) - 1, next = eoi + 1, old = -1, op = 0, cur = 0, bits = 0, p = 0;
  outer: while (op < count){
    while (bits < size){ if (p >= data.length) break outer; cur |= data[p++] << bits; bits += 8; }
    let code = cur & mask; cur >>>= size; bits -= size;
    if (code === clear){ size = minCode + 1; mask = (1 << size) - 1; next = eoi + 1; old = -1; continue; }
    if (code === eoi) break;
    if (old === -1){ if (code >= clear) break; out[op++] = suffix[code]; old = code; continue; }
    if (code > next) break;
    const fc = code < next ? first[code] : first[old];
    if (next < 4096){
      prefix[next] = old; suffix[next] = fc; first[next] = first[old]; len[next] = len[old] + 1; next++;
      if (next === (1 << size) && size < 12){ size++; mask = (1 << size) - 1; }
    }
    let L = len[code], end = op + L, c = code;
    if (end > count){ // truncate
      let skip = end - count; while (skip-- > 0) c = prefix[c]; end = count; L = count - op;
    }
    for (let k = end - 1; k >= op; k--){ out[k] = suffix[c]; c = prefix[c]; }
    op = end; old = code;
  }
  return out;
}

function decodeGif(bytes){
  let p = 0;
  const rd = () => bytes[p++];
  const u16 = () => { const v = bytes[p] | (bytes[p + 1] << 8); p += 2; return v; };
  const sig = String.fromCharCode.apply(null, bytes.subarray(0, 6));
  if (!/^GIF8[79]a$/.test(sig)) throw new Error('Not a GIF');
  p = 6;
  const w = u16(), h = u16(), pk = rd(); rd(); rd();
  let gct = null;
  if (pk & 0x80){ const n = 2 << (pk & 7); gct = bytes.subarray(p, p + n * 3); p += n * 3; }
  const skipBlocks = () => { while (p < bytes.length){ const s = rd(); if (!s) break; p += s; } };
  const readBlocks = () => {
    const parts = []; let total = 0;
    while (p < bytes.length){ const s = rd(); if (!s) break; parts.push(bytes.subarray(p, p + s)); total += s; p += s; }
    const out = new Uint8Array(total); let o = 0; for (const q of parts){ out.set(q, o); o += q.length; } return out;
  };
  const canvas = new Uint8ClampedArray(w * h * 4);
  const frames = [], delays = [];
  let gce = { disp: 0, delay: 0, trans: -1 }, lastDisp = 0, lastRect = null, saved = null;
  while (p < bytes.length){
    const b = rd();
    if (b === 0x3B) break;
    if (b === 0x21){
      const label = rd();
      if (label === 0xF9){
        const s = rd(), pk2 = bytes[p], delay = bytes[p + 1] | (bytes[p + 2] << 8), ti = bytes[p + 3];
        p += s; gce = { disp: (pk2 >> 2) & 7, delay, trans: (pk2 & 1) ? ti : -1 };
      }
      skipBlocks(); continue;
    }
    if (b === 0x2C){
      const fx = u16(), fy = u16(), fw = u16(), fh = u16(), ipk = rd();
      let ct = gct;
      if (ipk & 0x80){ const n = 2 << (ipk & 7); ct = bytes.subarray(p, p + n * 3); p += n * 3; }
      const inter = !!(ipk & 0x40), minCode = rd(), data = readBlocks();
      const idx = lzwDecode(minCode, data, fw * fh);
      if (lastDisp === 2 && lastRect){
        const [rx, ry, rw, rh] = lastRect;
        for (let y = ry; y < Math.min(h, ry + rh); y++) canvas.fill(0, (y * w + rx) * 4, (y * w + Math.min(w, rx + rw)) * 4);
      } else if (lastDisp === 3 && saved) canvas.set(saved);
      if (gce.disp === 3) saved = canvas.slice();
      let rows = null;
      if (inter){ rows = []; for (const [s, st] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let r = s; r < fh; r += st) rows.push(r); }
      for (let r = 0; r < fh; r++){
        const y = fy + (rows ? rows[r] : r); if (y >= h) continue;
        for (let x = 0; x < fw; x++){
          const gx = fx + x; if (gx >= w) continue;
          const ci = idx[r * fw + x];
          if (ci === gce.trans || !ct || ci * 3 + 2 >= ct.length) continue;
          const o = (y * w + gx) * 4;
          canvas[o] = ct[ci * 3]; canvas[o + 1] = ct[ci * 3 + 1]; canvas[o + 2] = ct[ci * 3 + 2]; canvas[o + 3] = 255;
        }
      }
      frames.push(canvas.slice()); delays.push(gce.delay);
      lastDisp = gce.disp; lastRect = [fx, fy, fw, fh]; gce = { disp: 0, delay: 0, trans: -1 };
      continue;
    }
    break;
  }
  if (!frames.length) throw new Error('GIF has no frames');
  return { w, h, frames, delays };
}

// ---------- GIF encoding ----------
class ByteW {
  constructor(){ this.b = new Uint8Array(1 << 16); this.n = 0; }
  ensure(k){ if (this.n + k > this.b.length){ const nb = new Uint8Array(Math.max(this.b.length * 2, this.n + k)); nb.set(this.b.subarray(0, this.n)); this.b = nb; } }
  byte(v){ this.ensure(1); this.b[this.n++] = v & 255; }
  u16(v){ this.byte(v); this.byte(v >> 8); }
  bytes(a){ this.ensure(a.length); this.b.set(a, this.n); this.n += a.length; }
  str(s){ for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  out(){ return this.b.slice(0, this.n); }
}

const _dictCode = new Int16Array(1 << 20), _dictGen = new Uint32Array(1 << 20); let _gen = 0;
function lzwEncode(idx, minCode, bw){
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, next = eoi + 1;
  const blk = new Uint8Array(255); let bl = 0, cur = 0, bits = 0;
  const flushByte = (v) => { blk[bl++] = v; if (bl === 255){ bw.byte(255); bw.bytes(blk); bl = 0; } };
  const write = (code) => { cur |= code << bits; bits += size; while (bits >= 8){ flushByte(cur & 255); cur >>>= 8; bits -= 8; } };
  _gen++;
  write(clear);
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++){
    const k = idx[i], key = (prefix << 8) | k;
    if (_dictGen[key] === _gen){ prefix = _dictCode[key]; continue; }
    write(prefix);
    if (next < 4096){
      _dictGen[key] = _gen; _dictCode[key] = next++;
      if (next > (1 << size) && size < 12) size++;
    } else {
      write(clear); _gen++; size = minCode + 1; next = eoi + 1;
    }
    prefix = k;
  }
  write(prefix); write(eoi);
  if (bits > 0) flushByte(cur & 255);
  if (bl){ bw.byte(bl); bw.bytes(blk.subarray(0, bl)); }
  bw.byte(0);
}

function buildPalette(frames, maxColors, keep){
  const hist = new Uint32Array(32768);
  let total = 0; for (const f of frames) total += f.length >> 2;
  const stride = Math.max(1, Math.floor(total / 3e6));
  for (const f of frames){
    for (let i = 0, n = f.length >> 2; i < n; i += stride){
      const o = i * 4; if (!keep(f, o)) continue;
      hist[((f[o] >> 3) << 10) | ((f[o + 1] >> 3) << 5) | (f[o + 2] >> 3)]++;
    }
  }
  const keys = []; for (let k = 0; k < 32768; k++) if (hist[k]) keys.push(k);
  const comp = (k, a) => a === 0 ? (k >> 10) & 31 : a === 1 ? (k >> 5) & 31 : k & 31;
  const boxes = [{ s: 0, e: keys.length }];
  const boxInfo = (bx) => {
    let mn = [31, 31, 31], mx = [0, 0, 0], cnt = 0;
    for (let i = bx.s; i < bx.e; i++){ const k = keys[i]; cnt += hist[k]; for (let a = 0; a < 3; a++){ const v = comp(k, a); if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; } }
    const rg = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    const axis = rg[1] >= rg[0] && rg[1] >= rg[2] ? 1 : rg[0] >= rg[2] ? 0 : 2;
    bx.axis = axis; bx.score = rg[axis] * Math.sqrt(cnt); bx.cnt = cnt; return bx;
  };
  boxInfo(boxes[0]);
  while (boxes.length < maxColors){
    let bi = -1, best = 0;
    for (let i = 0; i < boxes.length; i++) if (boxes[i].e - boxes[i].s > 1 && boxes[i].score > best){ best = boxes[i].score; bi = i; }
    if (bi < 0) break;
    const bx = boxes[bi], a = bx.axis;
    const sub = keys.slice(bx.s, bx.e).sort((x, y) => comp(x, a) - comp(y, a));
    for (let i = 0; i < sub.length; i++) keys[bx.s + i] = sub[i];
    let acc = 0, half = bx.cnt / 2, m = bx.s + 1;
    for (let i = bx.s; i < bx.e - 1; i++){ acc += hist[keys[i]]; if (acc >= half){ m = i + 1; break; } m = i + 1; }
    boxes.splice(bi, 1, boxInfo({ s: bx.s, e: m }), boxInfo({ s: m, e: bx.e }));
  }
  const pal = [];
  for (const bx of boxes){
    if (bx.e <= bx.s) continue;
    let r = 0, g = 0, b = 0, c = 0;
    for (let i = bx.s; i < bx.e; i++){ const k = keys[i], n = hist[k]; r += (((k >> 10) & 31) * 8 + 4) * n; g += (((k >> 5) & 31) * 8 + 4) * n; b += ((k & 31) * 8 + 4) * n; c += n; }
    pal.push([Math.round(r / c), Math.round(g / c), Math.round(b / c)]);
  }
  if (!pal.length) pal.push([0, 0, 0]);
  return pal;
}

// frames: array of RGBA Uint8ClampedArray (w*h*4); delays in centiseconds
// opts: matte [r,g,b]|null, colors 2..255, dither 'none'|'ordered'|'fs', local (per-frame palettes),
//       optimize (store only changed pixels between frames), lossy 0..100, loop 0=forever / -1=play once
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function encodeGif(frames, w, h, delays, opts){
  const o = Object.assign({ matte: null, colors: 255, dither: 'none', local: false, optimize: true, lossy: 0, loop: 0 }, opts || {});
  const keep = (f, p) => f[p + 3] >= 128;
  const matte = o.matte;
  const prepared = frames.map(f => {
    if (!matte) return f;
    const g = new Uint8ClampedArray(f.length);
    for (let p = 0; p < f.length; p += 4){
      const a = f[p + 3] / 255;
      g[p] = f[p] * a + matte[0] * (1 - a); g[p + 1] = f[p + 1] * a + matte[1] * (1 - a); g[p + 2] = f[p + 2] * a + matte[2] * (1 - a); g[p + 3] = f[p + 3];
    }
    return g;
  });
  const maxC = Math.max(2, Math.min(255, o.colors | 0));
  const pals = o.local ? prepared.map(f => buildPalette([f], maxC, keep)) : [buildPalette(prepared, maxC, keep)];
  const luts = pals.map(() => new Int16Array(32768).fill(-1));
  const bitsFor = (pal) => { let k = 0; while ((2 << k) < pal.length + 1) k++; return k; };
  const spread = Math.max(10, Math.min(72, 255 / Math.cbrt(maxC) * 0.9));
  const lossyThr2 = Math.pow(o.lossy * 0.42, 2);
  const N = w * h;

  function mapFrame(f, pi){
    const pal = pals[pi], lut = luts[pi], T = pal.length, idx = new Uint8Array(N);
    const near = (r, g, b) => {
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let v = lut[k];
      if (v < 0){
        const rr = ((k >> 10) & 31) * 8 + 4, gg = ((k >> 5) & 31) * 8 + 4, bb = (k & 31) * 8 + 4;
        let bd = Infinity; v = 0;
        for (let i = 0; i < pal.length; i++){ const dr = rr - pal[i][0], dg = gg - pal[i][1], db = bb - pal[i][2]; const d = dr * dr * 2 + dg * dg * 4 + db * db * 3; if (d < bd){ bd = d; v = i; } }
        lut[k] = v;
      }
      return v;
    };
    const fs = o.dither === 'fs', ord = o.dither === 'ordered';
    let eC = fs ? new Float32Array((w + 2) * 3) : null, eN = fs ? new Float32Array((w + 2) * 3) : null;
    for (let y = 0; y < h; y++){
      if (fs){ const t = eC; eC = eN; eN = t; eN.fill(0); }
      for (let x = 0; x < w; x++){
        const i = y * w + x, p = i * 4;
        if (f[p + 3] < 128){ idx[i] = T; continue; }
        let r = f[p], g = f[p + 1], b = f[p + 2];
        if (ord){ const t = ((BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * spread; r += t; g += t; b += t; }
        else if (fs){ const e = (x + 1) * 3; r += eC[e]; g += eC[e + 1]; b += eC[e + 2]; }
        r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
        let v = near(r | 0, g | 0, b | 0);
        if (lossyThr2 > 0 && x > 0){
          const q = idx[i - 1];
          if (q !== T){ const c = pal[q], dr = r - c[0], dg = g - c[1], db = b - c[2]; if ((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9 <= lossyThr2) v = q; }
        }
        idx[i] = v;
        if (fs){
          const c = pal[v], er = r - c[0], eg = g - c[1], eb = b - c[2], e = (x + 1) * 3;
          eC[e + 3] += er * 7 / 16; eC[e + 4] += eg * 7 / 16; eC[e + 5] += eb * 7 / 16;
          eN[e - 3] += er * 3 / 16; eN[e - 2] += eg * 3 / 16; eN[e - 1] += eb * 3 / 16;
          eN[e] += er * 5 / 16; eN[e + 1] += eg * 5 / 16; eN[e + 2] += eb * 5 / 16;
          eN[e + 3] += er / 16; eN[e + 4] += eg / 16; eN[e + 5] += eb / 16;
        }
      }
    }
    return idx;
  }

  const n = prepared.length;
  const pIdx = i => o.local ? i : 0;
  const idxs = []; for (let i = 0; i < n; i++) idxs.push(mapFrame(prepared[i], pIdx(i)));
  const colAt = (i, p) => { const pal = pals[pIdx(i)], v = idxs[i][p]; if (v === pal.length) return -1; const c = pal[v]; return (c[0] << 16) | (c[1] << 8) | c[2]; };

  // Build the frame list. With optimize, a frame stores only the rectangle that changed, and pixels equal to
  // what is already shown become transparent (cheap to compress). A frame is cleared afterwards (disposal 2)
  // only when the next frame needs some of its pixels to turn transparent.
  const outs = [], state = new Int32Array(N).fill(-1);
  for (let i = 0; i < n; i++){
    let d = delays[i]; if (!(d >= 2)) d = 10;
    const T = pals[pIdx(i)].length;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, needClear = true;
    if (o.optimize){
      needClear = false;
      if (i < n - 1){ for (let p = 0; p < N; p++) if (idxs[i + 1][p] === pals[pIdx(i + 1)].length && colAt(i, p) !== -1){ needClear = true; break; } }
      for (let p = 0; p < N; p++){
        const c = colAt(i, p);
        if (c !== state[p] || (needClear && c !== -1)){ const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0 && !needClear && outs.length && outs[outs.length - 1].disp === 1){ outs[outs.length - 1].delay = Math.min(65535, outs[outs.length - 1].delay + d); continue; }
      if (x1 < 0){ x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    } else { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    const rw = x1 - x0 + 1, rh = y1 - y0 + 1, data = new Uint8Array(rw * rh), src = idxs[i];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){
      const p = y * w + x, c = colAt(i, p);
      data[(y - y0) * rw + (x - x0)] = (o.optimize && c === state[p]) ? T : src[p];
      if (!needClear) state[p] = c;
    }
    if (needClear) state.fill(-1);
    outs.push({ x: x0, y: y0, w: rw, h: rh, data, disp: needClear ? 2 : 1, delay: d, pi: pIdx(i) });
  }

  const bw = new ByteW();
  bw.str('GIF89a'); bw.u16(w); bw.u16(h);
  const writeTable = (pal, k) => { for (let i = 0; i < (2 << k); i++){ const c = pal[i] || [0, 0, 0]; bw.byte(c[0]); bw.byte(c[1]); bw.byte(c[2]); } };
  if (!o.local){ const k = bitsFor(pals[0]); bw.byte(0x80 | (7 << 4) | k); bw.byte(0); bw.byte(0); writeTable(pals[0], k); }
  else { bw.byte(0x70); bw.byte(0); bw.byte(0); }
  if (outs.length > 1 && o.loop >= 0){ bw.byte(0x21); bw.byte(0xFF); bw.byte(11); bw.str('NETSCAPE2.0'); bw.byte(3); bw.byte(1); bw.u16(o.loop); bw.byte(0); }
  for (const f of outs){
    const pal = pals[f.pi], k = bitsFor(pal), T = pal.length;
    bw.byte(0x21); bw.byte(0xF9); bw.byte(4); bw.byte((f.disp << 2) | 1); bw.u16(f.delay); bw.byte(T); bw.byte(0);
    bw.byte(0x2C); bw.u16(f.x); bw.u16(f.y); bw.u16(f.w); bw.u16(f.h);
    if (o.local){ bw.byte(0x80 | k); writeTable(pal, k); } else bw.byte(0);
    const minCode = Math.max(2, k + 1);
    bw.byte(minCode); lzwEncode(f.data, minCode, bw);
  }
  bw.byte(0x3B);
  return bw.out();
}

// ---------- TIFF ----------
function encodeTiff(rgba, w, h){
  const entries = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, 4, 0], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, 0],
                   [277, 3, 1, 4], [278, 4, 1, h], [279, 4, 1, w * h * 4], [284, 3, 1, 1], [338, 3, 1, 2]];
  const ifdOff = 8, ifdSize = 2 + entries.length * 12 + 4, bpsOff = ifdOff + ifdSize, dataOff = bpsOff + 8;
  const buf = new ArrayBuffer(dataOff + w * h * 4), dv = new DataView(buf), u8 = new Uint8Array(buf);
  u8[0] = 0x49; u8[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, ifdOff, true);
  dv.setUint16(ifdOff, entries.length, true);
  entries.forEach(([tag, type, count, val], i) => {
    const e = ifdOff + 2 + i * 12;
    if (tag === 258) val = bpsOff; if (tag === 273) val = dataOff;
    dv.setUint16(e, tag, true); dv.setUint16(e + 2, type, true); dv.setUint32(e + 4, count, true);
    if (type === 3 && count === 1) dv.setUint16(e + 8, val, true); else dv.setUint32(e + 8, val, true);
  });
  dv.setUint32(ifdOff + 2 + entries.length * 12, 0, true);
  for (let i = 0; i < 4; i++) dv.setUint16(bpsOff + i * 2, 8, true);
  u8.set(rgba, dataOff);
  return u8;
}

function decodeTiff(bytes){
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const le = bytes[0] === 0x49;
  const u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le);
  if (u16(2) !== 42) throw new Error('Not a TIFF');
  const ifd = u32(4), n = u16(ifd), tags = {};
  for (let i = 0; i < n; i++){
    const e = ifd + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    const sz = { 1: 1, 3: 2, 4: 4 }[type]; if (!sz) continue;
    const vo = sz * cnt <= 4 ? e + 8 : u32(e + 8), vals = [];
    for (let k = 0; k < cnt; k++) vals.push(type === 3 ? u16(vo + 2 * k) : type === 4 ? u32(vo + 4 * k) : bytes[vo + k]);
    tags[tag] = vals;
  }
  const g = (t, d) => (tags[t] ? tags[t][0] : d);
  const w = g(256), h = g(257), bps = g(258, 1), comp = g(259, 1), photo = g(262, 2), spp = g(277, 1), planar = g(284, 1), extra = g(338, 0);
  if (bps !== 8 || planar !== 1 || (comp !== 1 && comp !== 32773)) throw new Error('This TIFF uses compression or a bit depth this app cannot read. Try PNG instead.');
  const raw = new Uint8Array(w * h * spp); let o = 0;
  const offs = tags[273] || [], cnts = tags[279] || [];
  for (let s = 0; s < offs.length && o < raw.length; s++){
    const chunk = bytes.subarray(offs[s], offs[s] + cnts[s]);
    if (comp === 1){ const take = Math.min(chunk.length, raw.length - o); raw.set(chunk.subarray(0, take), o); o += take; }
    else { let i = 0; while (i < chunk.length && o < raw.length){ const c = (chunk[i++] << 24) >> 24; if (c >= 0){ for (let k = 0; k <= c && o < raw.length; k++) raw[o++] = chunk[i++]; } else if (c !== -128){ const v = chunk[i++]; for (let k = 0; k < 1 - c && o < raw.length; k++) raw[o++] = v; } } }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++){
    const s = i * spp, d = i * 4;
    if (spp >= 3){ out[d] = raw[s]; out[d + 1] = raw[s + 1]; out[d + 2] = raw[s + 2]; out[d + 3] = spp >= 4 ? raw[s + 3] : 255;
      if (spp >= 4 && extra === 1 && out[d + 3] > 0 && out[d + 3] < 255){ const a = out[d + 3] / 255; out[d] /= a; out[d + 1] /= a; out[d + 2] /= a; } }
    else { let v = raw[s]; if (photo === 0) v = 255 - v; out[d] = out[d + 1] = out[d + 2] = v; out[d + 3] = spp === 2 ? raw[s + 1] : 255; }
  }
  return { w, h, frames: [out], delays: [0] };
}

// ---------- ZIP (store) ----------
const _crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = _crcT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(name, data){
  const nm = new TextEncoder().encode(name), crc = crc32(data), sz = data.length;
  const out = new Uint8Array(30 + nm.length + sz + 46 + nm.length + 22), dv = new DataView(out.buffer);
  let p = 0;
  dv.setUint32(p, 0x04034b50, true); dv.setUint16(p + 4, 20, true); dv.setUint16(p + 12, 33, true); dv.setUint32(p + 14, crc, true);
  dv.setUint32(p + 18, sz, true); dv.setUint32(p + 22, sz, true); dv.setUint16(p + 26, nm.length, true); out.set(nm, p + 30); p += 30 + nm.length;
  out.set(data, p); p += sz;
  const cd = p;
  dv.setUint32(p, 0x02014b50, true); dv.setUint16(p + 4, 20, true); dv.setUint16(p + 6, 20, true); dv.setUint16(p + 14, 33, true);
  dv.setUint32(p + 16, crc, true); dv.setUint32(p + 20, sz, true); dv.setUint32(p + 24, sz, true); dv.setUint16(p + 28, nm.length, true);
  out.set(nm, p + 46); p += 46 + nm.length;
  dv.setUint32(p, 0x06054b50, true); dv.setUint16(p + 8, 1, true); dv.setUint16(p + 10, 1, true);
  dv.setUint32(p + 12, p - cd, true); dv.setUint32(p + 16, cd, true);
  return out;
}
/*CODECS-END*/
