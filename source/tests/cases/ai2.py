import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
# The optional high-quality AI model: the download (served here from the repository's own copy instead of
# GitHub Pages), the page's messages, its output against the NumPy reference, and removing it again.
import asyncio
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tools'))
import convert_model as cm
MODEL = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'models', 'u2net.bin'))
async def main():
  if not os.path.exists(MODEL):
    print('large model file not found (it lives in the repository root, models/u2net.bin): skipped'); print('errors []'); return
  meta, fl, wq = cm.read(MODEL)
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = await b.new_page(viewport={'width': 1366, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    served = []
    async def serve(route):
      served.append(route.request.url)
      await route.fulfill(path=MODEL, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/octet-stream'})
    await pg.route('**/models/u2net.bin', serve)
    await pg.add_init_script('window.__GWIZ_TEST__=1;')
    await pg.goto(URL); await pg.wait_for_timeout(900)
    await pg.click('[data-page-btn="auto"]')
    await pg.select_option('#aModel', 'large'); await pg.wait_for_timeout(200)
    print('before', await pg.inner_text('#aModelStat'), '| download button', await pg.is_visible('#aModelGet'))
    await pg.click('#aModelGet')
    await pg.wait_for_function("/Ready on this device|did not work/.test(document.querySelector('#aModelStat').textContent)", timeout=120000)
    print('after', await pg.inner_text('#aModelStat'), '| served', [u.split('/')[-1] for u in served])
    # the network on the graphics chip against the reference
    im = Image.open('t4_twotone.png').convert('RGBA').resize((320, 320), Image.LANCZOS)
    ref = cm.run_reference(meta, fl, wq, cm.preprocess(np.asarray(im.convert('RGB'))))
    out = np.array(await pg.evaluate('d=>window.__gwizAI.run(new Uint8ClampedArray(d),false,"large")', np.asarray(im).ravel().tolist()), np.float32).reshape(320, 320)
    info = await pg.evaluate('window.__gwizAI.info()')
    iou = ((out > .5) & (ref > .5)).sum() / max(1, ((out > .5) | (ref > .5)).sum())
    print('large engine', info['backend'], 'maxdiff %.4f' % np.abs(out - ref).max(), 'IoU %.4f' % iou, 'ok', bool(iou > 0.99 and np.abs(out - ref).mean() < 0.01), info['gpuError'] or '', flush=True)
    await pg.click('#aModelForget'); await pg.wait_for_timeout(300)
    print('forgotten', await pg.inner_text('#aModelStat'))
    print('errors', errs); await b.close()
asyncio.run(main())
