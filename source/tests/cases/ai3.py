import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
# AI background removal on an animation with "Steady across frames" at full strength: every frame is done,
# the moving ball is kept in each frame, and no ghost of it stays where it was in the neighboring frames.
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
    b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = await b.new_page(viewport={'width': 1366, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(SAVE); await pg.goto(URL); await pg.wait_for_timeout(800)
    await pg.set_input_files('#fileIn', 'anim.gif'); await pg.wait_for_timeout(600)
    await pg.evaluate("document.querySelector('#scopeSeg [data-a=\"all\"]').click()")
    await pg.click('[data-page-btn="auto"]')
    await pg.evaluate("()=>{const e=document.querySelector('#aSmooth');e.value=100;e.dispatchEvent(new Event('input'))}")
    await pg.click('#autoBtn'); await pg.wait_for_timeout(300); await pg.wait_for_function("document.querySelector('#busy').hidden", timeout=900000)
    print('status', await pg.inner_text('#aAiStat'))
    yy, xx = np.mgrid[0:100, 0:200]
    ok = True
    for i in range(4):
      if i: await pg.click('#view', position={'x': 5, 'y': 5}); await pg.keyboard.press('.'); await pg.wait_for_timeout(200)
      a = await alpha(pg)
      ball = (xx - (40 + i * 40)) ** 2 + (yy - 50) ** 2 <= 18 ** 2
      ghosts = np.zeros_like(ball)
      for j in (i - 1, i + 1):
        if 0 <= j < 4: ghosts |= ((xx - (40 + j * 40)) ** 2 + (yy - 50) ** 2 <= 18 ** 2)
      ghosts &= ~((xx - (40 + i * 40)) ** 2 + (yy - 50) ** 2 <= 26 ** 2)
      kept, ghost = a[ball].mean(), a[ghosts].mean() if ghosts.any() else 0
      ok &= bool(kept > 0.9 and ghost < 0.1)
      print('frame', i, 'ball kept %.2f' % kept, 'ghost %.2f' % ghost)
    print('steady ok', ok)
    print('errors', errs); await b.close()
asyncio.run(main())
