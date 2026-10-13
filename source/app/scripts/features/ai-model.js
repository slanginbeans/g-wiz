// ===================== AI subject detection: U²-Net running on this device =====================
// A neural network looks at the picture at 320 × 320 and says, for every point, how likely it is to be part of
// the main subject. Background removal uses that map to know what to keep; its own color and edge work then cuts
// along the real edges. Two models (Apache License 2.0, see app/models/README.md):
//   - Standard: U²-Net-P, built into the app (2.3 MB), fast; runs on the graphics chip with WebGL2 or, more
//     slowly, in plain JavaScript;
//   - High quality: U²-Net, a 44 MB download kept on the device afterwards (or loaded from a file), about three
//     times the work; graphics chip only.
// Nothing is sent anywhere: the models run here.
var AIM = { models: {}, backend: '', ms: 0, gpuFailed: false, cache: new WeakMap(), dl: { state: 'none', got: 0, total: 0, err: '' } };
const AI_LARGE = { file: 'models/u2net.bin', site: 'https://slanginbeans.github.io/g-wiz/', size: 44158636, label: 'High quality' };
const AI_CACHE = 'gwiz-models-v1';

// ---------- model files ----------
function aiParse(b, id){
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 16 || String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'GWNN') throw new Error('this is not a G-WIZ model file');
  const n = dv.getUint32(8, true), meta = JSON.parse(new TextDecoder().decode(b.subarray(12, 12 + n)));
  let off = 12 + n; off += (4 - off % 4) % 4;
  const bits = meta.wbits || 16;
  const nf = meta.program.reduce((a, p) => a + (p.op === 'conv' ? 2 * p.cout + (p.fw !== undefined ? p.cout * p.cin * p.k * p.k : 0) : 0), 0);
  const buf = b.byteOffset ? b.slice().buffer : b.buffer, rest = b.length - off - nf * 4;
  const fl = new Float32Array(buf, off, nf);
  const wq = bits === 8 ? new Int8Array(buf, off + nf * 4, rest) : new Int16Array(buf, off + nf * 4, rest >> 1);
  // how many later steps read each tensor, so it can be freed after its last use
  const uses = new Int32Array(meta.channels.length);
  for (const p of meta.program) for (const t of [].concat(p.in)) uses[t]++;
  uses[meta.output]++;
  return { id, meta, fl, wq, uses, S: meta.size, macs: 0 };
}
// the model for id ('small' is always there; 'large' once downloaded or loaded)
function aiModel(id){
  id = id || 'small';
  if (AIM.models[id]) return AIM.models[id];
  if (id !== 'small') return null;
  const s = atob(AI_MODEL_B64), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return AIM.models.small = aiParse(b, 'small');
}
// weight w[o][c][ky][kx] of conv step p, already scaled
const aiW = (M, p, o, c, ky, kx) => { const i = ((o * p.cin + c) * p.k + ky) * p.k + kx; return p.fw !== undefined ? M.fl[p.fw + i] : M.wq[p.q + i] * M.fl[p.f + o]; };
// all weights of conv step p as floats (for the JavaScript path; kept after the first use)
function aiWeights(M, p){
  if (p._w) return p._w;
  const n = p.cout * p.cin * p.k * p.k, per = n / p.cout, w = new Float32Array(n);
  if (p.fw !== undefined) w.set(M.fl.subarray(p.fw, p.fw + n));
  else for (let i = 0; i < n; i++) w[i] = M.wq[p.q + i] * M.fl[p.f + Math.floor(i / per)];
  return p._w = w;
}

// ---------- input: the picture at 320 × 320, normalized the way the networks were trained ----------
// returns the network input and the small RGB copy (used to smooth maps between animation frames)
function aiInput(rgba, w, h, M){
  M = M || aiModel();
  const S = M.S, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  // a large picture is halved in steps first, so the small copy averages every pixel instead of sampling some
  let src = toCanvas(rgba, w, h), sw = w, sh = h;
  while (sw > S * 2 || sh > S * 2){
    const nw = Math.max(S, Math.round(sw / 2)), nh = Math.max(S, Math.round(sh / 2)), t = document.createElement('canvas'); t.width = nw; t.height = nh;
    const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, nw, nh); src = t; sw = nw; sh = nh;
  }
  g.drawImage(src, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data, N = S * S, x = new Float32Array(3 * N), rgb = new Uint8Array(3 * N), mean = M.meta.mean, std = M.meta.std;
  let mx = 1; for (let i = 0; i < N; i++){ const o = i * 4; if (d[o] > mx) mx = d[o]; if (d[o + 1] > mx) mx = d[o + 1]; if (d[o + 2] > mx) mx = d[o + 2]; }
  for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++){ x[k * N + i] = (d[i * 4 + k] / mx - mean[k]) / std[k]; rgb[i * 3 + k] = d[i * 4 + k]; }
  return { x, rgb };
}
function aiFinish(logits){
  // sigmoid, then stretched to 0..1 like the reference implementation
  let lo = Infinity, hi = -Infinity; const out = new Float32Array(logits.length);
  for (let i = 0; i < out.length; i++){ const v = 1 / (1 + Math.exp(-logits[i])); out[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const r = Math.max(1e-8, hi - lo); for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / r;
  return out;
}

// ---------- on the graphics chip (WebGL2) ----------
// A tensor of C channels is a 2D texture array with C/4 layers (RGBA = 4 channels). Every step is a draw call
// per output layer. A model's weights are one RGBA texture, four texels (a 4 × 4 block) per input layer and tap:
// float32 for the standard model, half float for the large one (half the graphics memory).
const AIG = { gl: null, tried: false, fmt: null, progs: {}, w: {}, pool: new Map(), fb: null, vao: null, maxTex: 2048 };
const AI_VS = '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }';
const AI_HEAD = '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2DArray; precision highp sampler2D;\nout vec4 o;\n';
function aiConvFS(K, nseg){
  return AI_HEAD + '#define KS ' + K + '\n' +
    'uniform sampler2DArray uX0, uX1; uniform sampler2D uW; uniform int uL0, uL1, uDil, uWBase, uRelu, uWMask, uWShift; uniform ivec2 uSize; uniform vec4 uBias;\n' +
    'vec4 wt(int i){ return texelFetch(uW, ivec2(i & uWMask, i >> uWShift), 0); }\n' +
    'void main(){ ivec2 p = ivec2(gl_FragCoord.xy); vec4 acc = uBias; int wi = uWBase;\n' +
    ' for (int ky = 0; ky < KS; ky++) for (int kx = 0; kx < KS; kx++){\n' +
    '  ivec2 q = p + (ivec2(kx, ky) - ivec2(KS / 2)) * uDil;\n' +
    '  if (q.x < 0 || q.y < 0 || q.x >= uSize.x || q.y >= uSize.y){ wi += 4 * (uL0 + uL1); continue; }\n' +
    '  for (int l = 0; l < uL0; l++){ acc += mat4(wt(wi), wt(wi + 1), wt(wi + 2), wt(wi + 3)) * texelFetch(uX0, ivec3(q, l), 0); wi += 4; }\n' +
    (nseg > 1 ? '  for (int l = 0; l < uL1; l++){ acc += mat4(wt(wi), wt(wi + 1), wt(wi + 2), wt(wi + 3)) * texelFetch(uX1, ivec3(q, l), 0); wi += 4; }\n' : '') +
    ' }\n if (uRelu == 1) acc = max(acc, vec4(0.0)); o = acc; }';
}
const AI_FS = {
  pool: AI_HEAD + 'uniform sampler2DArray uX; uniform int uLayer; uniform ivec2 uIn;\n' +
    'void main(){ ivec2 p = ivec2(gl_FragCoord.xy) * 2; vec4 m = vec4(-3.0e38);\n' +
    ' for (int dy = 0; dy < 2; dy++) for (int dx = 0; dx < 2; dx++){ ivec2 q = p + ivec2(dx, dy); if (q.x < uIn.x && q.y < uIn.y) m = max(m, texelFetch(uX, ivec3(q, uLayer), 0)); }\n o = m; }',
  // bilinear, PyTorch align_corners = false
  resize: AI_HEAD + 'uniform sampler2DArray uX; uniform int uLayer; uniform ivec2 uIn, uOut;\n' +
    'void main(){ vec2 s = max((gl_FragCoord.xy) * vec2(uIn) / vec2(uOut) - 0.5, vec2(0.0)); ivec2 a = min(ivec2(floor(s)), uIn - 1), b = min(a + 1, uIn - 1); vec2 f = s - vec2(a);\n' +
    ' vec4 v00 = texelFetch(uX, ivec3(a, uLayer), 0), v10 = texelFetch(uX, ivec3(b.x, a.y, uLayer), 0), v01 = texelFetch(uX, ivec3(a.x, b.y, uLayer), 0), v11 = texelFetch(uX, ivec3(b, uLayer), 0);\n' +
    ' o = mix(mix(v00, v10, f.x), mix(v01, v11, f.x), f.y); }',
  add: AI_HEAD + 'uniform sampler2DArray uX, uY; uniform int uLayer;\nvoid main(){ ivec3 q = ivec3(ivec2(gl_FragCoord.xy), uLayer); o = texelFetch(uX, q, 0) + texelFetch(uY, q, 0); }',
  // gathers single channels from up to four tensors into one layer
  pack: AI_HEAD + 'uniform sampler2DArray uP0, uP1, uP2, uP3; uniform ivec4 uLay, uComp, uOn;\n' +
    'float ch(vec4 v, int c){ return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }\n' +
    'void main(){ ivec2 p = ivec2(gl_FragCoord.xy);\n' +
    ' o = vec4(uOn.x == 1 ? ch(texelFetch(uP0, ivec3(p, uLay.x), 0), uComp.x) : 0.0, uOn.y == 1 ? ch(texelFetch(uP1, ivec3(p, uLay.y), 0), uComp.y) : 0.0,\n' +
    '          uOn.z == 1 ? ch(texelFetch(uP2, ivec3(p, uLay.z), 0), uComp.z) : 0.0, uOn.w == 1 ? ch(texelFetch(uP3, ivec3(p, uLay.w), 0), uComp.w) : 0.0); }'
};
function aiCompile(gl, fs){
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, AI_VS)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  const u = {}, n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++){ const nm = gl.getActiveUniform(pr, i).name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(pr, nm); }
  return { pr, u };
}
function aiGL(){
  if (AIG.tried) return AIG.gl;
  AIG.tried = true;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const gl = c.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    if (gl.getExtension('EXT_color_buffer_float')) AIG.fmt = { internal: gl.RGBA32F, half: false };
    else if (gl.getExtension('EXT_color_buffer_half_float')) AIG.fmt = { internal: gl.RGBA16F, half: true };
    else return null;
    AIG.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    AIG.progs.conv31 = aiCompile(gl, aiConvFS(3, 1)); AIG.progs.conv32 = aiCompile(gl, aiConvFS(3, 2));
    AIG.progs.conv11 = aiCompile(gl, aiConvFS(1, 1)); AIG.progs.conv12 = aiCompile(gl, aiConvFS(1, 2));
    for (const k of ['pool', 'resize', 'add', 'pack']) AIG.progs[k] = aiCompile(gl, AI_FS[k]);
    AIG.fb = gl.createFramebuffer(); AIG.vao = gl.createVertexArray();
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    AIG.gl = gl;
  } catch (err){ AIG.gl = null; AIM.gpuError = String(err && err.message || err); console.warn('[ai] GPU not available:', AIM.gpuError); }
  return AIG.gl;
}
// float -> IEEE half (for the large model's weight texture)
const aiF32 = new Float32Array(1), aiU32 = new Uint32Array(aiF32.buffer);
function aiHalf(v){
  aiF32[0] = v; const x = aiU32[0], s = (x >>> 16) & 0x8000, m = x & 0x7fffff; let e = ((x >>> 23) & 0xff) - 112;
  if (e <= 0){ if (e < -10) return s; return s | (((m | 0x800000) >> (1 - e)) + 0x1000 >> 13); }
  if (e >= 31) return s | 0x7c00;
  return s | ((e << 10) + ((m + 0x1000) >> 13));
}
// the model's weights on the graphics chip, laid out in the order the conv shader reads them
function aiGLWeights(M){
  if (AIG.w[M.id]) return AIG.w[M.id];
  const gl = AIG.gl, ch = M.meta.channels, base = new Map(); let total = 0;
  for (const p of M.meta.program){ if (p.op !== 'conv') continue; const L = p.in.reduce((a, t) => a + Math.ceil(ch[t] / 4), 0); base.set(p, total); total += Math.ceil(p.cout / 4) * p.k * p.k * L * 4; }
  const half = M.id !== 'small';
  let width = 2048; while (Math.ceil(total / width) > AIG.maxTex && width * 2 <= AIG.maxTex) width *= 2;
  const rows = Math.ceil(total / width);
  if (rows > AIG.maxTex) throw new Error('the model is too large for this graphics chip');
  const data = half ? new Uint16Array(rows * width * 4) : new Float32Array(rows * width * 4);
  for (const p of M.meta.program){
    if (p.op !== 'conv') continue;
    let t = base.get(p); const ws = aiWeights(M, p), KK = p.k * p.k;
    for (let g = 0; g < Math.ceil(p.cout / 4); g++) for (let ky = 0; ky < p.k; ky++) for (let kx = 0; kx < p.k; kx++){
      let cOff = 0;
      for (const tin of p.in){
        const cs = ch[tin];
        for (let l = 0; l < Math.ceil(cs / 4); l++) for (let j = 0; j < 4; j++, t++){
          const ci = l * 4 + j; if (ci >= cs) continue;
          for (let r = 0; r < 4; r++){ const o = g * 4 + r; if (o < p.cout){ const v = ws[(o * p.cin + cOff + ci) * KK + ky * p.k + kx]; data[t * 4 + r] = half ? aiHalf(v) : v; } }
        }
        cOff += cs;
      }
    }
    if (half) p._w = null;   // the float copy is not needed any more
  }
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA32F, width, rows, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.FLOAT, data);
  for (const pn of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, pn, gl.NEAREST);
  return AIG.w[M.id] = { tex, base, mask: width - 1, shift: Math.log2(width) };
}
function aiTex(w, h, L){
  const gl = AIG.gl, key = w + 'x' + h + 'x' + L, free = AIG.pool.get(key);
  const t = free && free.length ? free.pop() : (() => { const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tx); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, AIG.fmt.internal, w, h, L);
    for (const pn of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D_ARRAY, pn, gl.NEAREST); return tx; })();
  return { tex: t, w, h, L, key };
}
function aiFree(T){ if (!T) return; const a = AIG.pool.get(T.key) || []; a.push(T.tex); AIG.pool.set(T.key, a); }
function aiDrop(){ const gl = AIG.gl; if (!gl) return; for (const a of AIG.pool.values()) for (const t of a) gl.deleteTexture(t); AIG.pool.clear(); }
function aiRunGPU(M, x){
  const gl = AIG.gl, MW = aiGLWeights(M), S = M.S, ch = M.meta.channels, uses = M.uses.slice(), env = new Map(), dims = new Map();
  const bindIn = (unit, T) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D_ARRAY, T.tex); };
  const target = (T, l) => { gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, T.tex, 0, l); };
  const use = P => { gl.useProgram(P.pr); return P.u; };
  gl.bindFramebuffer(gl.FRAMEBUFFER, AIG.fb); gl.bindVertexArray(AIG.vao);
  // the input, three channels in one layer
  const T0 = aiTex(S, S, 1), px = new Float32Array(S * S * 4), N = S * S;
  for (let i = 0; i < N; i++){ px[i * 4] = x[i]; px[i * 4 + 1] = x[N + i]; px[i * 4 + 2] = x[2 * N + i]; }
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, T0.tex); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, S, S, 1, gl.RGBA, gl.FLOAT, px);
  env.set(0, T0); dims.set(0, [S, S]);
  const release = t => { if (--uses[t] === 0){ aiFree(env.get(t)); env.delete(t); } };
  for (const p of M.meta.program){
    if (p.op === 'conv'){
      const A = env.get(p.in[0]), B = p.in.length > 1 ? env.get(p.in[1]) : null, w = A.w, h = A.h, T = aiTex(w, h, Math.ceil(p.cout / 4));
      const u = use(AIG.progs['conv' + p.k + (B ? 2 : 1)]);
      bindIn(0, A); gl.uniform1i(u.uX0, 0); gl.uniform1i(u.uL0, A.L);
      if (B){ bindIn(1, B); gl.uniform1i(u.uX1, 1); gl.uniform1i(u.uL1, B.L); } else if (u.uL1) gl.uniform1i(u.uL1, 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, MW.tex); gl.uniform1i(u.uW, 2); gl.uniform1i(u.uWMask, MW.mask); gl.uniform1i(u.uWShift, MW.shift);
      gl.uniform1i(u.uDil, p.dil); gl.uniform1i(u.uRelu, p.relu ? 1 : 0); gl.uniform2i(u.uSize, w, h); gl.viewport(0, 0, w, h);
      const stride = p.k * p.k * (A.L + (B ? B.L : 0)) * 4, b0 = MW.base.get(p);
      for (let g = 0; g < T.L; g++){
        const bias = [0, 1, 2, 3].map(r => g * 4 + r < p.cout ? M.fl[p.f + p.cout + g * 4 + r] : 0);
        gl.uniform4f(u.uBias, bias[0], bias[1], bias[2], bias[3]); gl.uniform1i(u.uWBase, b0 + g * stride);
        target(T, g); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      env.set(p.out, T); dims.set(p.out, [w, h]); p.in.forEach(release);
    } else if (p.op === 'pool'){
      const A = env.get(p.in), w = Math.ceil(A.w / 2), h = Math.ceil(A.h / 2), T = aiTex(w, h, A.L), u = use(AIG.progs.pool);
      bindIn(0, A); gl.uniform1i(u.uX, 0); gl.uniform2i(u.uIn, A.w, A.h); gl.viewport(0, 0, w, h);
      for (let l = 0; l < T.L; l++){ gl.uniform1i(u.uLayer, l); target(T, l); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      env.set(p.out, T); dims.set(p.out, [w, h]); release(p.in);
    } else if (p.op === 'resize'){
      const A = env.get(p.in), [w, h] = dims.get(p.ref);
      const T = aiTex(w, h, A.L), u = use(AIG.progs.resize);
      bindIn(0, A); gl.uniform1i(u.uX, 0); gl.uniform2i(u.uIn, A.w, A.h); gl.uniform2i(u.uOut, w, h); gl.viewport(0, 0, w, h);
      for (let l = 0; l < T.L; l++){ gl.uniform1i(u.uLayer, l); target(T, l); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      env.set(p.out, T); dims.set(p.out, [w, h]); release(p.in);
    } else if (p.op === 'add'){
      const A = env.get(p.in[0]), B = env.get(p.in[1]), T = aiTex(A.w, A.h, A.L), u = use(AIG.progs.add);
      bindIn(0, A); bindIn(1, B); gl.uniform1i(u.uX, 0); gl.uniform1i(u.uY, 1); gl.viewport(0, 0, A.w, A.h);
      for (let l = 0; l < T.L; l++){ gl.uniform1i(u.uLayer, l); target(T, l); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      env.set(p.out, T); dims.set(p.out, [A.w, A.h]); p.in.forEach(release);
    } else if (p.op === 'pack'){
      // channel k of the packed tensor comes from tensor src[k], channel cc[k]
      const src = [], cc = [];
      for (const t of p.in) for (let c = 0; c < ch[t]; c++){ src.push(t); cc.push(c); }
      const A0 = env.get(p.in[0]), T = aiTex(A0.w, A0.h, Math.ceil(src.length / 4)), u = use(AIG.progs.pack); gl.viewport(0, 0, A0.w, A0.h);
      for (let l = 0; l < T.L; l++){
        const lay = [0, 0, 0, 0], comp = [0, 0, 0, 0], on = [0, 0, 0, 0];
        for (let j = 0; j < 4; j++){ const k = l * 4 + j; if (k >= src.length) continue; bindIn(j, env.get(src[k])); lay[j] = cc[k] >> 2; comp[j] = cc[k] & 3; on[j] = 1; }
        for (let j = 0; j < 4; j++){ if (!on[j]) bindIn(j, A0); gl.uniform1i(u['uP' + j], j); }
        gl.uniform4i(u.uLay, ...lay); gl.uniform4i(u.uComp, ...comp); gl.uniform4i(u.uOn, ...on);
        target(T, l); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      env.set(p.out, T); dims.set(p.out, [A0.w, A0.h]); p.in.forEach(release);
    }
  }
  const F = env.get(M.meta.output); target(F, 0);
  const rd = new Float32Array(F.w * F.h * 4); gl.readPixels(0, 0, F.w, F.h, gl.RGBA, gl.FLOAT, rd);
  const err = gl.getError();
  for (const T of env.values()) aiFree(T);
  aiDrop();
  if (err) throw new Error('WebGL error ' + err);
  const lg = new Float32Array(F.w * F.h); for (let i = 0; i < lg.length; i++) lg[i] = rd[i * 4];
  return lg;
}

// ---------- in plain JavaScript (when there is no WebGL2) ----------
async function aiRunCPU(M, x, progress){
  const S = M.S, ch = M.meta.channels, env = new Map(), dims = new Map(), uses = M.uses.slice();
  env.set(0, x); dims.set(0, [S, S]);
  const release = t => { if (--uses[t] === 0) env.delete(t); };
  const total = M.meta.program.length; let k = 0, t0 = performance.now();
  for (const p of M.meta.program){
    if (performance.now() - t0 > 50){ if (progress) progress(k / total); await new Promise(r => setTimeout(r, 0)); t0 = performance.now(); }
    k++;
    if (p.op === 'conv'){
      const [w, h] = dims.get(p.in[0]), HW = w * h, out = new Float32Array(p.cout * HW);
      const planes = []; for (const t of p.in){ const a = env.get(t); for (let c = 0; c < ch[t]; c++) planes.push(a.subarray(c * HW, (c + 1) * HW)); }
      aiConvCPU(planes, out, w, h, aiWeights(M, p), M.fl.subarray(p.f + p.cout, p.f + 2 * p.cout), p.cout, p.cin, p.k, p.dil, p.relu);
      env.set(p.out, out); dims.set(p.out, [w, h]); p.in.forEach(release);
    } else if (p.op === 'pool'){
      const a = env.get(p.in), [w, h] = dims.get(p.in), C = ch[p.in], ow = Math.ceil(w / 2), oh = Math.ceil(h / 2), out = new Float32Array(C * ow * oh);
      for (let c = 0; c < C; c++) for (let y = 0; y < oh; y++) for (let xx = 0; xx < ow; xx++){
        let m = -Infinity; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++){ const yy = y * 2 + dy, x2 = xx * 2 + dx; if (yy < h && x2 < w){ const v = a[c * w * h + yy * w + x2]; if (v > m) m = v; } }
        out[c * ow * oh + y * ow + xx] = m;
      }
      env.set(p.out, out); dims.set(p.out, [ow, oh]); release(p.in);
    } else if (p.op === 'resize'){
      const a = env.get(p.in), [w, h] = dims.get(p.in), [ow, oh] = dims.get(p.ref), C = ch[p.in];
      let out = a;
      if (w !== ow || h !== oh){
        out = new Float32Array(C * ow * oh);
        const co = (o, i, n) => { const s = Math.max(0, (o + 0.5) * i / n - 0.5), a0 = Math.min(Math.floor(s), i - 1); return [a0, Math.min(a0 + 1, i - 1), s - a0]; };
        const cx = Array.from({ length: ow }, (_, X) => co(X, w, ow)), cy = Array.from({ length: oh }, (_, Y) => co(Y, h, oh));
        for (let c = 0; c < C; c++){ const A = c * w * h, B = c * ow * oh;
          for (let y = 0; y < oh; y++){ const [ya, yb, fy] = cy[y];
            for (let xx = 0; xx < ow; xx++){ const [xa, xb, fx] = cx[xx];
              out[B + y * ow + xx] = (a[A + ya * w + xa] * (1 - fx) + a[A + ya * w + xb] * fx) * (1 - fy) + (a[A + yb * w + xa] * (1 - fx) + a[A + yb * w + xb] * fx) * fy; } } }
      }
      env.set(p.out, out); dims.set(p.out, [ow, oh]); release(p.in);
    } else if (p.op === 'add'){
      const a = env.get(p.in[0]), b = env.get(p.in[1]), out = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
      env.set(p.out, out); dims.set(p.out, dims.get(p.in[0])); p.in.forEach(release);
    } else if (p.op === 'pack'){
      const parts = p.in.map(t => env.get(t)), out = new Float32Array(parts.reduce((s, a) => s + a.length, 0)); let o = 0;
      for (const a of parts){ out.set(a, o); o += a.length; }
      env.set(p.out, out); dims.set(p.out, dims.get(p.in[0])); p.in.forEach(release);
    }
  }
  return env.get(M.meta.output).slice(0, S * S);
}

// one convolution: row by row (so the rows being summed stay in the cache), four output channels at a time
// (so each input value is read once for all four)
function aiConvCPU(planes, out, w, h, wt, bias, CO, CI, K, d, relu){
  const HW = w * h, r = K >> 1, KK = K * K;
  for (let y = 0; y < h; y++){
    for (let o = 0; o < CO; o += 4){
      const n = Math.min(4, CO - o), b0 = o * HW + y * w, b1 = b0 + HW, b2 = b1 + HW, b3 = b2 + HW;
      for (let j = 0; j < n; j++) out.fill(bias[o + j], b0 + j * HW, b0 + j * HW + w);
      for (let c = 0; c < CI; c++){
        const pl = planes[c], w0 = (o * CI + c) * KK, w1 = w0 + CI * KK, w2 = w1 + CI * KK, w3 = w2 + CI * KK;
        for (let ky = 0; ky < K; ky++){
          const sy = y + (ky - r) * d; if (sy < 0 || sy >= h) continue;
          const rb = sy * w;
          for (let kx = 0; kx < K; kx++){
            const t = ky * K + kx, dx = (kx - r) * d, x0 = dx < 0 ? -dx : 0, x1 = dx > 0 ? w - dx : w, sb = rb + dx;
            if (n === 4){
              const a0 = wt[w0 + t], a1 = wt[w1 + t], a2 = wt[w2 + t], a3 = wt[w3 + t];
              for (let x = x0; x < x1; x++){ const v = pl[sb + x]; out[b0 + x] += a0 * v; out[b1 + x] += a1 * v; out[b2 + x] += a2 * v; out[b3 + x] += a3 * v; }
            } else {
              for (let j = 0; j < n; j++){ const a = wt[w0 + j * CI * KK + t], bj = b0 + j * HW; if (a !== 0) for (let x = x0; x < x1; x++) out[bj + x] += a * pl[sb + x]; }
            }
          }
        }
      }
      if (relu) for (let j = 0; j < n; j++){ const bj = b0 + j * HW; for (let x = 0; x < w; x++) if (out[bj + x] < 0) out[bj + x] = 0; }
    }
  }
}

// ---------- running a model ----------
// the subject map (S × S, 0..1) of a picture, and its small RGB copy; progress(f) is called on the slow path
async function aiSubject(rgba, w, h, progress, M){
  M = M || aiModel();
  const inp = aiInput(rgba, w, h, M), t0 = performance.now();
  let lg = null;
  if (!AIM.gpuFailed && aiGL()){
    try {
      lg = aiRunGPU(M, inp.x);
      if (!lg.every(Number.isFinite)) throw new Error('the graphics chip returned invalid numbers');
      AIM.backend = 'gpu';
    } catch (err){
      const msg = String(err && err.message || err); lg = null;
      if (M.id !== 'small') throw new Error('the high-quality model could not run on this graphics chip (' + msg + '); choose the standard model');
      AIM.gpuFailed = true; AIM.gpuError = msg; console.warn('[ai] GPU run failed, using the CPU:', msg);
    }
  }
  if (!lg){
    if (M.id !== 'small') throw new Error('the high-quality model needs the graphics chip (WebGL2), which is not available here; choose the standard model');
    lg = await aiRunCPU(M, inp.x, progress); AIM.backend = 'cpu';
  }
  AIM.ms = performance.now() - t0;
  return { map: aiFinish(lg), rgb: inp.rgb };
}

// ---------- the high-quality model: download once, keep on this device ----------
const aiCurrent = () => (typeof CUT !== 'undefined' && CUT.aiModel === 'large') ? 'large' : 'small';
const aiLargeKey = () => AI_LARGE.site + AI_LARGE.file;
// on the installed web app it comes from the same site; elsewhere from G-WIZ's GitHub Pages site
function aiLargeURL(){ const onSite = window.__GWIZ_PWA__ && location.protocol === 'https:'; return new URL(AI_LARGE.file, onSite ? location.href : AI_LARGE.site).href; }
async function aiLargeFromCache(){
  if (AIM.models.large) return true;
  try {
    if (!window.caches) return false;
    const r = await (await caches.open(AI_CACHE)).match(aiLargeKey()); if (!r) return false;
    AIM.models.large = aiParse(new Uint8Array(await r.arrayBuffer()), 'large'); AIM.dl.state = 'ready'; return true;
  } catch (e){ return false; }
}
async function aiLargeStore(b){
  try { if (window.caches) await (await caches.open(AI_CACHE)).put(aiLargeKey(), new Response(b, { headers: { 'Content-Type': 'application/octet-stream' } })); }
  catch (e){ console.warn('[ai] could not keep the model on this device:', e); }
}
async function aiLargeForget(){
  delete AIM.models.large; const w = AIG.w.large; if (w && AIG.gl) AIG.gl.deleteTexture(w.tex); delete AIG.w.large;
  AIM.dl = { state: 'none', got: 0, total: 0, err: '' };
  try { if (window.caches) await (await caches.open(AI_CACHE)).delete(aiLargeKey()); } catch (e){}
}
let aiUIT = 0;
async function aiLargeDownload(){
  if (AIM.dl.state === 'loading') return;
  AIM.dl = { state: 'loading', got: 0, total: AI_LARGE.size, err: '' }; aiModelUI();
  try {
    // the app's own site first; if the file is not there, G-WIZ's GitHub Pages site
    const urls = [...new Set([aiLargeURL(), AI_LARGE.site + AI_LARGE.file])];
    let r = null, last = '';
    for (const u of urls){ try { r = await fetch(u, { cache: 'no-store' }); if (r.ok) break; last = 'the server answered ' + r.status; r = null; } catch (e){ last = String(e && e.message || e); r = null; } }
    if (!r) throw new Error(last || 'no connection');
    const total = +r.headers.get('Content-Length') || AI_LARGE.size, parts = []; let got = 0;
    if (r.body && r.body.getReader){
      const rd = r.body.getReader();
      for (;;){ const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; AIM.dl.got = got; AIM.dl.total = total;
        if (!aiUIT) aiUIT = setTimeout(() => { aiUIT = 0; aiModelUI(); }, 200); }
    } else { const v = new Uint8Array(await r.arrayBuffer()); parts.push(v); got = v.length; }
    const b = new Uint8Array(got); let o = 0; for (const p of parts){ b.set(p, o); o += p.length; }
    AIM.models.large = aiParse(b, 'large'); AIM.dl.state = 'ready';
    await aiLargeStore(b);
    sbFlash('The high-quality AI model is ready and kept on this device.');
  } catch (err){ AIM.dl.state = 'error'; AIM.dl.err = String(err && err.message || err); }
  aiModelUI(); scheduleAutoPreview();
}
async function aiLargeFile(file){
  try {
    const b = new Uint8Array(await file.arrayBuffer());
    AIM.models.large = aiParse(b, 'large'); AIM.dl.state = 'ready'; await aiLargeStore(b);
    sbFlash('Loaded the high-quality AI model from "' + file.name + '".');
  } catch (err){ AIM.dl.state = 'error'; AIM.dl.err = String(err && err.message || err); }
  aiModelUI(); scheduleAutoPreview();
}
const aiMB = n => (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + " MB";
// the "AI model" row on the Remove background page
function aiModelUI(){
  const sel = $('#aModel'); if (!sel) return;
  const large = aiCurrent() === 'large', st = AIM.dl.state, have = !!AIM.models.large;
  sel.value = aiCurrent();
  $('#aModelGet').hidden = !large || have || st === 'loading';
  $('#aModelFile').hidden = !large || have || st === 'loading';
  $('#aModelForget').hidden = !large || !have;
  const link = $('#aModelLink'); link.href = aiLargeURL(); link.hidden = !(large && st === 'error');
  $('#aModelStat').textContent = !large ? 'Built in. Fast, and works everywhere.'
    : have ? 'Ready on this device. About three times the work of the standard model, for cleaner subjects and edges.'
    : st === 'loading' ? 'Downloading… ' + aiMB(AIM.dl.got) + ' of ' + aiMB(AIM.dl.total || AI_LARGE.size)
    : st === 'error' ? 'The download did not work (' + AIM.dl.err + '). Download the file with the link below and load it with "Load file…", or try again later.'
    : 'Not on this device yet. Download it once (' + aiMB(AI_LARGE.size) + '); after that it works offline.';
}

// ---------- subject maps, cached per frame and model ----------
// a cheap fingerprint, so a cached map is not used after the frame was painted on
function aiPrint(fr){ let h = fr.length; const st = Math.max(1, Math.floor(fr.length / 8192)) * 4 + 1; for (let i = 0; i < fr.length; i += st) h = (h * 31 + fr[i]) | 0; return h; }
function aiEntry(f, id){
  const fr = frames[f]; if (!fr) return null;
  const c = AIM.cache.get(fr), e = c && c[id || aiCurrent()];
  return e && e.w === W && e.h === H && e.fp === aiPrint(fr) ? e : null;
}
// with smoothing on, the maps of neighboring frames are needed too
function aiFramesFor(fs){
  if (!(CUT.aiSmooth > 0) || frames.length < 2) return fs;
  const set = new Set(); for (const f of fs) for (let d = -2; d <= 2; d++){ const g = f + d; if (g >= 0 && g < frames.length) set.add(g); }
  return [...set].sort((a, b) => a - b);
}
// makes sure the subject maps of these frames of the selected layer are ready
async function aiEnsure(fs, status){
  const id = aiCurrent();
  let M = aiModel(id);
  if (!M && id === 'large' && await aiLargeFromCache()) M = aiModel('large');
  if (!M) throw Object.assign(new Error('the high-quality model is not on this device yet'), { noModel: true });
  const todo = aiFramesFor(fs).filter(f => !aiEntry(f, id));
  for (let k = 0; k < todo.length; k++){
    const f = todo[k], fr = frames[f];
    if (status) status((todo.length > 1 ? 'Finding the subject: frame ' + (k + 1) + ' of ' + todo.length : 'Finding the subject') + (id === 'large' ? ' (high quality)…' : '…'), 0);
    await new Promise(r => setTimeout(r, 16));
    const res = await aiSubject(fr, W, H, p => { if (status) status('Finding the subject without the graphics chip (slow): ' + Math.round(p * 100) + '%…', p); }, M);
    const c = AIM.cache.get(fr) || {}; c[id] = { fp: aiPrint(fr), w: W, h: H, S: M.S, map: res.map, rgb: res.rgb }; AIM.cache.set(fr, c);
  }
  return todo.length;
}
// aiEnsure with messages: on the Remove background page, in the status bar, and on failure. false if it failed.
async function aiReady(fs, status){
  const line = $('#aAiStat'), say = t => { if (line) line.textContent = t; if (status) status(t); else sbFlash(t); };
  let n;
  try { n = await aiEnsure(fs, say); }
  catch (err){
    say('');
    if (err && err.noModel){ toast('Download the high-quality AI model first (AI model, on the Remove background page), or choose Standard.', 6000); aiModelUI(); }
    else { toast('The AI could not run here: ' + (err && err.message || err) + '. Choose the Smart method instead.', 6000); console.warn('[ai]', err); }
    return false;
  }
  if (n) say('Subject found in ' + (AIM.ms < 1000 ? (AIM.ms / 1000).toFixed(2) : (AIM.ms / 1000).toFixed(1)) + ' s ' + (AIM.backend === 'gpu' ? 'on the graphics chip' : 'without the graphics chip') +
    (aiCurrent() === 'large' ? ', high-quality model' : '') + (n > 1 ? ' (' + n + ' frames).' : '.'));
  return true;
}
// the subject map of frame f resized to w × h (0..1); null if it has not been worked out.
// In animations the neighboring frames' maps are blended in where the picture has not changed there, which
// steadies the outline from frame to frame without dragging it behind a moving subject.
function aiPrior(f, w, h){
  const id = aiCurrent(), c = aiEntry(f, id); if (!c) return null;
  const S = c.S; let m = c.map;
  const k = (CUT.aiSmooth || 0) / 100;
  if (k > 0 && frames.length > 1){
    const out = new Float32Array(S * S), ws = new Float32Array(S * S), N = S * S;
    for (let d = -2; d <= 2; d++){
      const e = d === 0 ? c : aiEntry(f + d, id); if (!e || e.S !== S) continue;
      const base = d === 0 ? 1 : Math.pow(k, Math.abs(d));
      for (let i = 0; i < N; i++){
        let wt = base;
        if (d){ const o = i * 3, dr = c.rgb[o] - e.rgb[o], dg = c.rgb[o + 1] - e.rgb[o + 1], db = c.rgb[o + 2] - e.rgb[o + 2]; wt *= Math.exp(-(dr * dr + dg * dg + db * db) / (2 * 20 * 20)); }
        out[i] += wt * e.map[i]; ws[i] += wt;
      }
    }
    for (let i = 0; i < N; i++) out[i] /= ws[i];
    m = out;
  }
  const res = new Float32Array(w * h);
  for (let y = 0; y < h; y++){
    const sy = Math.min(S - 1, Math.max(0, (y + 0.5) * S / h - 0.5)), y0 = Math.floor(sy), y1 = Math.min(S - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < w; x++){
      const sx = Math.min(S - 1, Math.max(0, (x + 0.5) * S / w - 0.5)), x0 = Math.floor(sx), x1 = Math.min(S - 1, x0 + 1), fx = sx - x0;
      res[y * w + x] = (m[y0 * S + x0] * (1 - fx) + m[y0 * S + x1] * fx) * (1 - fy) + (m[y1 * S + x0] * (1 - fx) + m[y1 * S + x1] * fx) * fy;
    }
  }
  return res;
}
// for the automatic tests: run a model on a given S × S × 4 picture
if (window.__GWIZ_TEST__) window.__gwizAI = {
  run: async (rgba, cpu, id) => {
    const M = aiModel(id || 'small'), S = M.S;
    if (cpu){ const inp = aiInput(rgba, S, S, M); return Array.from(aiFinish(await aiRunCPU(M, inp.x))); }
    AIM.gpuFailed = false; return Array.from((await aiSubject(rgba, S, S, null, M)).map);
  },
  input: rgba => { const M = aiModel(); return Array.from(aiInput(rgba, M.S, M.S, M).x); },
  info: () => ({ backend: AIM.backend, ms: AIM.ms, half: AIG.fmt && AIG.fmt.half, gpuError: AIM.gpuError || null, large: !!AIM.models.large, dl: AIM.dl.state })
};
