import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio, base64, io, sys, json, time
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
TESTS=['t1_gradient','t2_similar','t3_texture','t4_twotone']
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1366,'height':800})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.add_init_script("window.__saved=null;window.showSaveFilePicker=async(o)=>({name:o.suggestedName,createWritable:async()=>({write:async b=>{const a=new Uint8Array(await b.arrayBuffer());let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));window.__saved=btoa(s)},close:async()=>{}})});")
    await pg.goto(URL); await pg.wait_for_timeout(600)
    await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(600)
    res={}
    for method in ['classic','smart']:
      for t in TESTS:
        await pg.set_input_files('#fileIn', t+'.png'); await pg.wait_for_timeout(500)
        await pg.click('[data-page-btn="auto"]'); await pg.click(f'#aMethod [data-v="{method}"]'); await pg.wait_for_timeout(100)
        t0=time.time(); await pg.click('#autoBtn'); await pg.wait_for_function("document.querySelector('#busy').hidden"); dt=time.time()-t0
        await pg.evaluate("window.__saved=null"); await pg.click('#saveTop'); await pg.select_option('#fmt','png'); await pg.uncheck('#trim'); await pg.click('#saveBtn')
        await pg.wait_for_function("window.__saved!==null", timeout=30000)
        im=Image.open(io.BytesIO(base64.b64decode(await pg.evaluate('window.__saved')))).convert('RGBA')
        a=np.array(im)[...,3].astype(np.float32)/255; truth=np.array(Image.open(t+'_truth.png')).astype(np.float32)/255
        mae=np.abs(a-truth).mean(); inter=((a>0.5)&(truth>0.5)).sum(); uni=((a>0.5)|(truth>0.5)).sum(); iou=inter/uni
        # error on soft (hair) pixels
        soft=(truth>0.02)&(truth<0.98); smae=np.abs(a-truth)[soft].mean() if soft.any() else 0
        res[(method,t)]=(mae,iou,smae,dt); im.save(f'out_{method}_{t}.png')
        print(f'{method:8s} {t:12s} MAE={mae:.4f} IoU={iou:.4f} softMAE={smae:.3f} time={dt:.2f}s')
    print('errors',errs); await b.close()
asyncio.run(main())
