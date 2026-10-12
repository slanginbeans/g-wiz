import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio, base64, io, time
from PIL import Image
from playwright.async_api import async_playwright
from px1 import INIT, export, colors
NES='7c7c7c 0000fc 0000bc 4428bc 940084 a80020 a81000 881400 503000 007800 006800 005800 004058 000000 bcbcbc 0078f8 0058f8 6844fc d800cc e40058 f83800 e45c10 ac7c00 00b800 00a800 00a844 008888 f8f8f8 3cbcfc 6888fc 9878f8 f878f8 f85898 f87858 fca044 f8b800 b8f818 58d854 58f898 00e8d8 787878 fcfcfc a4e4fc b8b8f8 d8b8f8 f8b8f8 f8a4c0 f0d0b0 fce0a8 f8d878 d8f878 b8f8b8 b8f8d8 00fcfc f8d8f8'
NES={tuple(int(h[i:i+2],16) for i in (0,2,4)) for h in NES.split()}
CASES=[('NES','d4','fs'),('NES','full','none'),('','d1','o4'),('','d2','o2'),('','d8','fs'),('','d12','none'),('PICO-8','full','o4'),('Commodore 64','d2','fs')]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); allerr=[]
    for pal,depth,dith in CASES:
      ctx=await b.new_context(**p.devices['iPad Pro 11 landscape']); pg=await ctx.new_page()
      errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
      await pg.add_init_script(INIT)
      await pg.goto(URL+'?sample'); await pg.wait_for_timeout(1500)
      await pg.tap('[data-page-btn="pixel"]'); await pg.tap('#pxOn')
      await pg.select_option('#pxPal',pal); await pg.select_option('#pxDepth',depth); await pg.select_option('#pxDither',dith)
      t=time.time(); await pg.tap('#pxReduce'); await pg.wait_for_function("!document.documentElement.classList.contains('busy')"); await pg.wait_for_timeout(800)
      dt=time.time()-t
      cnt=await pg.inner_text('#pxCount'); size=await pg.inner_text('#sbSize')
      im=await export(pg,'1'); cs=colors(im)
      extra=''
      if pal=='NES': extra='inNES=%s'%(cs<=NES)
      if depth=='d12': extra='4bit-ch=%s'%all(v%17==0 for c in cs for v in c)
      if depth=='d1': extra=str(sorted(cs))
      im.save(f'red_{pal or "none"}_{depth}_{dith}.png'.replace(' ','_'))
      print(pal,depth,dith,size,'colors',len(cs),extra,'|',cnt,'| %.1fs'%dt, errs)
      allerr+=errs
      await ctx.close()
    print('errors', allerr)
    await b.close()
asyncio.run(main())
