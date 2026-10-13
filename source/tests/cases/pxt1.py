import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
# Pixel art tools: outline, recolor through the palette (all layers, one undo), color ramps, the shading
# pencil, shift by half, the tiled preview, and sprite sheets (PNG + JSON frame list).
import asyncio, base64, io, json
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
SAVE = "window.__GWIZ_TEST__=1;window.__saved=null;window.showSaveFilePicker=async(o)=>({name:o.suggestedName,createWritable:async()=>({write:async b=>{const a=new Uint8Array(b instanceof Blob?await b.arrayBuffer():b);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));window.__saved=btoa(s)},close:async()=>{}})});"
RED, BLACK, GREEN = (255, 0, 77), (0, 0, 0), (0, 228, 54)   # PICO-8 colors
async def export(pg):
  await pg.evaluate("window.__saved=null"); await pg.click('#saveTop'); await pg.select_option('#fmt', 'png'); await pg.uncheck('#trim'); await pg.click('#saveBtn')
  await pg.wait_for_function("window.__saved!==null", timeout=60000)
  return np.array(Image.open(io.BytesIO(base64.b64decode(await pg.evaluate('window.__saved')))).convert('RGBA'))
async def pick(pg, hexc):
  for s in await pg.query_selector_all('#palGrid .sw'):
    if (await s.get_attribute('data-tip') or '').lower() == hexc: await s.dispatch_event('mousedown', {'button': 0}); return True
  return False
def px(a, x, y): return tuple(int(v) for v in a[y, x, :3]), int(a[y, x, 3])
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(SAVE); await pg.goto(URL); await pg.wait_for_timeout(800)
    # a clear 32 × 32 pixel canvas with the PICO-8 palette
    await pg.click('[data-page-btn="pixel"]')
    await pg.fill('#pxW', '32'); await pg.fill('#pxH', '32'); await pg.dispatch_event('#pxW', 'change')
    await pg.select_option('#pxPal', 'PICO-8'); await pg.click('#pxBg button[data-v="clear"]'); await pg.click('#pxNew'); await pg.wait_for_timeout(500)
    v = await pg.evaluate('window.__gwizView()'); r = await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top]}")
    sc = lambda x, y: (r[0] + v['panX'] + x * v['zoom'], r[1] + v['panY'] + y * v['zoom'])
    # a red filled square from (10,10) to (21,21)
    await pick(pg, '#ff004d'); await pg.click('[data-tool="rect"]')
    await pg.evaluate("()=>{const b=[...document.querySelectorAll('#shStyle button')].find(x=>x.dataset.v==='fill'); b&&b.click()}")
    a, c = sc(10.5, 10.5), sc(21.5, 21.5); await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*c, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(200)
    img = await export(pg); ys, xs = np.where(img[..., 3] > 0)
    print('square', px(img, 15, 15), 'box', xs.min(), ys.min(), xs.max(), ys.max())
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
    # outline outside, no corners
    await pg.click('[data-page-btn="pixel"]'); await pick(pg, '#000000')
    await pg.click('#pxOutMode [data-v="outside"]'); await pg.click('#pxOutline'); await pg.wait_for_timeout(300)
    img = await export(pg)
    side, corner, inner = px(img, x0 - 1, (y0 + y1) // 2), px(img, x0 - 1, y0 - 1), px(img, x0, y0)
    print('outline side', side, 'corner', corner, 'inner', inner, 'ok', side == (BLACK, 255) and corner[1] == 0 and inner[0] == RED)
    # recolor red -> green through the color list, then undo
    await pg.wait_for_timeout(500)
    sw = [await s.get_attribute('data-tip') for s in await pg.query_selector_all('#pxUsed .pxsw')]
    await pg.click('#pxUsed .pxsw[aria-label="#ff004d"]'); await pick(pg, '#00e436'); await pg.click('#pxRecolor'); await pg.wait_for_timeout(300)
    img = await export(pg)
    print('used colors', [s.split(' ')[0] for s in sw], '| recolored', px(img, 15, 15), 'outline kept', px(img, x0 - 1, (y0 + y1) // 2)[0] == BLACK, 'ok', px(img, 15, 15)[0] == GREEN)
    await pg.click('#undoBtn'); await pg.wait_for_timeout(300); img = await export(pg)
    print('undo recolor', px(img, 15, 15)[0] == RED)
    # color ramp: 5 shades, then 7
    n5 = len(await pg.query_selector_all('#pxRamp .pxsw'))
    await pg.evaluate("()=>{const e=document.querySelector('#pxRampN');e.value=7;e.dispatchEvent(new Event('input'))}")
    n7 = len(await pg.query_selector_all('#pxRamp .pxsw'))
    print('ramp', n5, n7)
    # shading pencil: darken a row across the square; the pixels step to the next darker PICO-8 color
    await pg.click('#pxShade [data-v="darken"]'); tool = (await pg.evaluate('window.__gwizView()'))['tool']
    a, c = sc(8.5, 15.5), sc(24.5, 15.5); await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*c, steps=20); await pg.mouse.up(); await pg.wait_for_timeout(200)
    img = await export(pg)
    shaded, clear_after, off_row = px(img, 15, 15), px(img, 5, 15) if x0 > 6 else ((0, 0, 0), 0), px(img, 15, 13)
    lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    print('shade tool', tool, 'pixel', shaded, 'darker', lum(shaded[0]) < lum(RED), 'clear stays clear', clear_after[1] == 0, 'other rows unchanged', off_row[0] == RED)
    await pg.click('#pxShade [data-v="off"]')
    # shift by half moves the square's corner from (x0,y0) to (x0+16,y0+16), wrapping
    await pg.click('#pxShift'); await pg.wait_for_timeout(300); img = await export(pg)
    print('shift', px(img, (x0 + 16) % 32, (y0 + 16) % 32)[0] == RED, px(img, x0, y0)[1] == 0)
    await pg.click('#pxShift'); await pg.wait_for_timeout(200)
    # tiled preview: the preview canvas becomes three tiles wide
    w1 = await pg.evaluate("document.querySelector('#pvCanvas').width")
    await pg.check('#pxTilePrev'); await pg.wait_for_timeout(300)
    w3 = await pg.evaluate("document.querySelector('#pvCanvas').width")
    print('tiled preview', w1, w3, 'ok', w3 >= w1 * 2.5)
    # three frames, sprite sheet 2 × 2 at 2x with JSON
    await pg.click('[data-page-btn="animate"]'); await pg.click('#amOn'); await pg.wait_for_timeout(200)
    for _ in range(2): await pg.click('#amDup'); await pg.wait_for_timeout(200)
    await pg.click('[data-page-btn="pixel"]'); await pg.select_option('#pxExport', '2'); await pg.check('#pxSheetJson')
    files = {}
    async def grab(d): files[d.suggested_filename] = await d.path()
    pg.on('download', lambda d: asyncio.ensure_future(grab(d)))
    await pg.click('#pxSheet'); await pg.wait_for_timeout(2500)
    names = sorted(files)
    sheet = next((Image.open(files[n]) for n in names if n.endswith('.png')), None)
    meta = next((json.load(open(files[n])) for n in names if n.endswith('.json')), None)
    print('sheet files', names, 'size', sheet and sheet.size, 'frames', meta and len(meta['frames']), 'cols', meta and meta['columns'],
          'ok', bool(sheet and sheet.size == (128, 128) and meta and len(meta['frames']) == 3))
    print('errors', errs); await b.close()
asyncio.run(main())
