import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
# AI background removal: the in-app network (graphics-chip path and JavaScript path) against the NumPy reference
# in tools/convert_model.py, then the AI method end to end with the preview and the status line.
import asyncio, base64, io, time
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tools'))
import convert_model as cm
SAVE = "window.__saved=null;window.showSaveFilePicker=async(o)=>({name:o.suggestedName,createWritable:async()=>({write:async b=>{const a=new Uint8Array(b instanceof Blob?await b.arrayBuffer():b);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));window.__saved=btoa(s)},close:async()=>{}})});"
async def main():
  meta, fl, wq = cm.read(os.path.join(HERE, '..', '..', 'app', 'models', 'u2netp.bin'))
  async with async_playwright() as p:
    # software WebGL2, so the graphics-chip path runs here too (slowly)
    b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = await b.new_page(viewport={'width': 1366, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script('window.__GWIZ_TEST__=1;' + SAVE)
    await pg.goto(URL); await pg.wait_for_timeout(900)
    # 1. the network itself
    im = Image.open('t1_gradient.png').convert('RGBA').resize((320, 320), Image.LANCZOS)
    ref = cm.run_reference(meta, fl, wq, cm.preprocess(np.asarray(im.convert('RGB'))))
    rgba = np.asarray(im).ravel().tolist()
    for cpu in (False, True):
      out = np.array(await pg.evaluate('([d,c])=>window.__gwizAI.run(new Uint8ClampedArray(d),c)', [rgba, cpu]), np.float32).reshape(320, 320)
      info = await pg.evaluate('window.__gwizAI.info()')
      print('engine', 'cpu' if cpu else info['backend'], 'maxdiff %.5f' % np.abs(out - ref).max(), 'ok', bool(np.abs(out - ref).max() < 0.002), info['gpuError'] or '', flush=True)
    # 2. the AI method end to end (it is the default method)
    for t, need in (('t1_gradient', 0.95), ('t4_twotone', 0.99)):
      await pg.set_input_files('#fileIn', t + '.png'); await pg.wait_for_timeout(500)
      await pg.click('[data-page-btn="auto"]')
      method = await pg.evaluate("document.querySelector('#aMethod [aria-pressed=true]').dataset.v")
      await pg.click('#autoBtn'); await pg.wait_for_timeout(300); await pg.wait_for_function("document.querySelector('#busy').hidden", timeout=300000)
      stat = await pg.inner_text('#aAiStat')
      await pg.evaluate("window.__saved=null"); await pg.click('#saveTop'); await pg.select_option('#fmt', 'png'); await pg.uncheck('#trim'); await pg.click('#saveBtn')
      await pg.wait_for_function("window.__saved!==null", timeout=60000)
      a = np.array(Image.open(io.BytesIO(base64.b64decode(await pg.evaluate('window.__saved')))).convert('RGBA'))[..., 3] / 255
      tr = np.array(Image.open(t + '_truth.png')) / 255
      iou = ((a > .5) & (tr > .5)).sum() / ((a > .5) | (tr > .5)).sum()
      print('ai', t, 'method', method, 'IoU %.3f' % iou, 'ok', bool(iou >= need), '|', stat, flush=True)
    # 3. the preview with the AI: the subject map is cached, so it shows right away
    await pg.check('#aPrev'); await pg.wait_for_timeout(300)
    await pg.wait_for_function("/Would erase|Nothing left/.test(document.querySelector('#aPrevStat').textContent)", timeout=300000)
    print('preview', await pg.inner_text('#aPrevStat'))
    # 4. the page shows the AI settings and hides the border-only ones
    vis = await pg.evaluate("['aTrust','aBorder','aEdge','aDetail'].map(id=>!!document.getElementById(id).closest('[hidden]')===false)")
    print('visible trust,border,edge,detail', vis)
    print('errors', errs); await b.close()
asyncio.run(main())
