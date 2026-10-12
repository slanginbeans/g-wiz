// ---------- setup: DOM helpers, the shared state S and the image globals ----------
// W, H, frames, masks and delays hold the image being edited. With layers (features/layers.js) they hold
// the selected layer, and DocW/DocH the whole picture.
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const stage = $('#stage'), view = $('#view'), vctx = view.getContext('2d');
const downloadsP = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(() => null) : null;

const S = {
  tool: 'erase', mode: 'smart', size: 60, rel: 'screen', hard: 75, tol: 28, edge: 55, samp: 'once',
  force: false, ghost: true, hiStroke: false, autoPrev: false, mMode: 'plate', mTarget: 'still', mThr: 12, mNoise: 8, mSmooth: 2, mGrow: 0, mShow: true, mHeat: false, opacity: 100, atol: 22, shrink: 0, soft: 0, defringe: false, gcol: 255, glossy: 0, gpal: 'shared', scale: 100, wtol: 24, wcontig: true, wedges: true, wedge: 55, scopeAll: false,
  zoom: 1, panX: 0, panY: 0, viewMode: 'result', bg: 'checker', bgColor: '#2f8f5b',
  cur: 0, playing: false, space: false, hover: null, sample: null, name: 'sample-cactus'
};
let W = 0, H = 0, frames = [], masks = [], delays = [];
let imgCanvas = document.createElement('canvas');
let imgCtx = null, disp = null;
let dpr = 1, cw = 0, ch = 0;

// ---------- UI helpers ----------
let toastT = 0;
function toast(msg, ms = 2600){ try { sbFlash(msg, Math.max(ms, 4000)); } catch (e) {} const t = $('#toast'); try { const pb = $('#palettebar'), st = $('#stage').getBoundingClientRect(); t.style.bottom = Math.max(8, innerHeight - st.bottom + 10) + 'px'; } catch (e) {} t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
function busy(on){ $('#busy').hidden = !on; }
const fmtHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

// ---------- theme colors for canvas ----------
let themeCols = null;
function readTheme(){
  const cs = getComputedStyle(document.documentElement);
  themeCols = { a: cs.getPropertyValue('--check-a').trim(), b: cs.getPropertyValue('--check-b').trim(), accent: cs.getPropertyValue('--accent').trim(), pat: null };
  requestDraw();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
function checkerPattern(){
  if (themeCols.pat) return themeCols.pat;
  const c = document.createElement('canvas'), s = Math.round(10 * dpr); c.width = c.height = s * 2;
  const g = c.getContext('2d'); g.fillStyle = themeCols.a; g.fillRect(0, 0, s * 2, s * 2); g.fillStyle = themeCols.b; g.fillRect(0, 0, s, s); g.fillRect(s, s, s, s);
  const p = vctx.createPattern(c, 'repeat'); if (p.setTransform) p.setTransform(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, 0, 0]));
  return themeCols.pat = p;
}
