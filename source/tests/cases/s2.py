import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio
from playwright.async_api import async_playwright
REC="new Promise(res=>{const q=indexedDB.open('gwiz');q.onsuccess=()=>{const t=q.result.transaction('autosave').objectStore('autosave').getAll();t.onsuccess=()=>res(t.result.map(r=>[r.id,r.name,r.w,r.h,r.layers]))}})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1366,'height':800}); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.type+':'+m.text) if m.type in ('error','warning') else None)
    await pg.goto(URL); await pg.wait_for_timeout(900)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def scribble(y):
      await pg.click('[data-tool="brush"]'); await pg.mouse.move(r[0]+200,r[1]+y); await pg.mouse.down(); await pg.mouse.move(r[0]+600,r[1]+y+50,steps=8); await pg.mouse.up()
    await scribble(200); await pg.wait_for_timeout(4500); print('after doc1 stroke', await pg.evaluate(REC), await pg.inner_text('#sbHelp'))
    await pg.click('[data-cmd="new"]'); await pg.wait_for_timeout(200); await pg.fill('#nW','800'); await pg.fill('#nH','600'); await pg.click('#nOk'); await pg.wait_for_timeout(300)
    await scribble(300); await pg.wait_for_timeout(4500); print('after doc2 stroke', await pg.evaluate(REC), await pg.inner_text('#sbHelp'))
    print('errors', errs); await b.close()
asyncio.run(main())
