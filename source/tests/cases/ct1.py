import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
# Checking and refining a cut-out: backdrop buttons and the Q key, edge check, and the refine edge brush on a
# picture with fine hair against a gradient (scored against the true alpha), with undo.
import asyncio, base64, io
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
SAVE = "window.__GWIZ_TEST__=1;window.__saved=null;window.showSaveFilePicker=async(o)=>({name:o.suggestedName,createWritable:async()=>({write:async b=>{const a=new Uint8Array(b instanceof Blob?await b.arrayBuffer():b);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));window.__saved=btoa(s)},close:async()=>{}})});"
async def alpha(pg):
  await pg.evaluate("window.__saved=null"); await pg.click('#saveTop'); await pg.select_option('#fmt', 'png'); await pg.uncheck('#trim'); await pg.click('#saveBtn')
  await pg.wait_for_function("window.__saved!==null", timeout=60000)
  return np.array(Image.open(io.BytesIO(base64.b64decode(await pg.evaluate('window.__saved')))).convert('RGBA'))[..., 3] / 255
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1366, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(SAVE); await pg.goto(URL); await pg.wait_for_timeout(800)
    await pg.set_input_files('#fileIn', 't1_gradient.png'); await pg.wait_for_timeout(500)
    await pg.click('[data-page-btn="auto"]'); await pg.click('#aMethod [data-v="classic"]')
    # backdrops
    await pg.click('#aBgSeg [data-bg2="white"]'); v1 = (await pg.evaluate('window.__gwizView()'))['bg']
    await pg.click('#view', position={'x': 5, 'y': 5}); await pg.keyboard.press('q'); v2 = (await pg.evaluate('window.__gwizView()'))['bg']
    pressed = await pg.evaluate("document.querySelector('#aBgSeg [aria-pressed=true]').dataset.bg2")
    print('backdrop', v1, v2, 'pressed', pressed)
    # removal, then edge check: magenta pixels appear on the canvas around the soft hair
    await pg.click('#autoBtn'); await pg.wait_for_function("document.querySelector('#busy').hidden"); await pg.wait_for_timeout(300)
    t = np.array(Image.open('t1_gradient_truth.png')) / 255; a0 = await alpha(pg)
    band = np.zeros_like(t, bool); band[20:170, 230:580] = True
    # refine edge brush across the hair
    r = await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top]}"); v = await pg.evaluate('window.__gwizView()')
    sc = lambda x, y: (r[0] + v['panX'] + x * v['zoom'], r[1] + v['panY'] + y * v['zoom'])
    await pg.click('#aRefine'); tool = (await pg.evaluate('window.__gwizView()'))['tool']
    await pg.evaluate("()=>{const e=document.querySelector('#aRefineSize');e.value=90;e.dispatchEvent(new Event('input'))}")
    for y in (50, 95, 140):
      x0, y0 = sc(240, y); x1, y1 = sc(570, y)
      await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(x1, y1, steps=25); await pg.mouse.up()
      await pg.wait_for_timeout(300); await pg.wait_for_function("document.querySelector('#busy').hidden")
    msg = await pg.inner_text('#sbHelp')
    a1 = await alpha(pg)
    e0, e1 = np.abs(a0 - t)[band].mean(), np.abs(a1 - t)[band].mean()
    print('refine tool', tool, '| hair-region error before %.3f after %.3f' % (e0, e1), 'ok', bool(e1 < e0 * 0.4), '|', msg)
    # edge check: the refined hair is partly see-through, so it shows magenta on the canvas
    await pg.check('#aEdgeCheck'); await pg.wait_for_timeout(400)
    shot = np.array(Image.open(io.BytesIO(await pg.locator('#view').screenshot())).convert('RGB')).astype(int)
    mag = ((shot[..., 0] > 230) & (shot[..., 1] < 60) & (shot[..., 2] > 200)).sum()
    await pg.uncheck('#aEdgeCheck'); await pg.wait_for_timeout(300)
    shot2 = np.array(Image.open(io.BytesIO(await pg.locator('#view').screenshot())).convert('RGB')).astype(int)
    mag2 = ((shot2[..., 0] > 230) & (shot2[..., 1] < 60) & (shot2[..., 2] > 200)).sum()
    print('edge check magenta pixels on', int(mag), 'off', int(mag2), 'ok', bool(mag > 200 and mag2 < mag / 10))
    for _ in range(3): await pg.click('#undoBtn'); await pg.wait_for_timeout(150)
    a2 = await alpha(pg)
    print('undo restores', bool(np.abs(a2 - a0).max() < 0.01))
    print('errors', errs); await b.close()
asyncio.run(main())
