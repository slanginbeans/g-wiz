import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); errs=[]
    for name,kw in [('desk',{'viewport':{'width':1366,'height':768}}),('ipadL',p.devices['iPad Pro 11 landscape']),('ipadP',p.devices['iPad Pro 11'])]:
      ctx=await b.new_context(**kw); pg=await ctx.new_page()
      pg.on('pageerror',lambda e:errs.append(str(e)))
      await pg.goto(URL); await pg.wait_for_timeout(700)
      menus=await pg.evaluate("[...document.querySelectorAll('.mtop')].map(m=>m.dataset.menu)")
      for m in menus:
        await pg.click(f'.mtop[data-menu="{m}"]'); await pg.wait_for_timeout(120)
        info=await pg.evaluate("""()=>{const mm=document.querySelector('#menus .menu'); if(!mm) return null; const r=mm.getBoundingClientRect();
          const over=[...mm.querySelectorAll('.mi')].filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.querySelector('.lb').textContent);
          return {l:Math.round(r.left),r:Math.round(r.right),b:Math.round(r.bottom),w:Math.round(r.width),vw:innerWidth,vh:innerHeight,over}}""")
        bad = info and (info['r']>info['vw'] or info['b']>info['vh'] or info['over'])
        print(name, m, info, 'BAD' if bad else '')
        if bad: await pg.screenshot(path=f'm_{name}_{m}.png')
        await pg.keyboard.press('Escape')
      await ctx.close()
    print('errors', errs)
    await b.close()
asyncio.run(main())
