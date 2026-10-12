import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
# Storage protection: asking for persistent storage, showing whether autosaves are protected,
# making room when storage is full, and backing off when it stays full.
import asyncio
from playwright.async_api import async_playwright
REC = "new Promise(res=>{const q=indexedDB.open('gwiz');q.onsuccess=()=>{const t=q.result.transaction('autosave').objectStore('autosave').getAll();t.onsuccess=()=>res(t.result.map(r=>[r.w,r.h]))}})"
# a fake storage manager: persisted() answers what window.__persisted says; persist() counts calls.
# window.__quotaFail = n makes the next n autosave writes fail as if storage were full.
MOCK = """
window.__persistCalls=0; window.__persisted=%s; window.__quotaFail=0; window.__puts=0;
Object.defineProperty(navigator,'storage',{value:{persisted:async()=>window.__persisted, persist:async()=>{window.__persistCalls++;return window.__persisted;},
  estimate:async()=>({usage:3*1048576, quota:500*1048576})}});
const put0=IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put=function(v){ if(this.name==='autosave'){ window.__puts++; if(window.__quotaFail>0){ window.__quotaFail--; throw new DOMException('The quota has been exceeded.','QuotaExceededError'); } } return put0.apply(this,arguments); };
"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(); errs = []
    # 1. desktop, storage granted
    ctx = await b.new_context(viewport={'width': 1366, 'height': 800}); pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(MOCK % 'true')
    await pg.goto(URL); await pg.wait_for_timeout(900)
    r = await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def scribble(y):
      await pg.click('[data-tool="brush"]'); await pg.mouse.move(r[0]+200, r[1]+y); await pg.mouse.down(); await pg.mouse.move(r[0]+600, r[1]+y+50, steps=8); await pg.mouse.up()
    async def recover_text():
      await pg.click('.mtop[data-menu="file"]'); await pg.click('#menus .mi:has-text("Recover autosaved work")'); await pg.wait_for_timeout(400)
      t = [await pg.inner_text('#recInfo'), await pg.inner_text('#recStore'), await pg.inner_text('#recSkip'), await pg.is_disabled('#recDelAll')]
      await pg.click('#recSkip'); await pg.wait_for_timeout(100); return t
    print('empty recover', await recover_text())
    await scribble(200); await pg.wait_for_timeout(4500)
    print('persist asked', await pg.evaluate('window.__persistCalls'), 'saved', await pg.evaluate(REC))
    print('granted recover', await recover_text())
    # 2. storage full once: older autosaves are removed to make room
    await pg.click('[data-cmd="new"]'); await pg.wait_for_timeout(200); await pg.fill('#nW', '800'); await pg.fill('#nH', '600'); await pg.click('#nOk'); await pg.wait_for_timeout(300)
    await pg.evaluate('window.__quotaFail=1')
    await scribble(300); await pg.wait_for_timeout(4500)
    print('room made', await pg.evaluate(REC), '|', await pg.inner_text('#sbHelp'))
    # 3. storage stays full: one clear message, and no retry for at least 25 s
    await pg.evaluate('window.__quotaFail=99; window.__puts=0')
    await scribble(400); await pg.wait_for_timeout(4500)
    msg = await pg.inner_text('#sbHelp'); n1 = await pg.evaluate('window.__puts')
    await pg.wait_for_timeout(20000); n2 = await pg.evaluate('window.__puts')
    print('full', '|', msg, '| puts', n1, n2)
    await pg.evaluate('window.__quotaFail=0'); await pg.wait_for_timeout(12000)
    print('recovered after backoff', await pg.evaluate('window.__puts'), await pg.evaluate(REC))
    await ctx.close()
    # 4. iPad in Safari (not from the Home Screen), storage not granted
    ctx = await b.new_context(**p.devices['iPad Pro 11 landscape']); pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(MOCK % 'false')
    await pg.goto(URL); await pg.wait_for_timeout(900)
    await pg.tap('.mtop[data-menu="file"]'); await pg.tap('#menus .mi:has-text("Recover autosaved work")'); await pg.wait_for_timeout(400)
    print('ipad recover', await pg.inner_text('#recStore'))
    print('ipad persist asked', await pg.evaluate('window.__persistCalls'))
    await ctx.close()
    print('errors', errs); await b.close()
asyncio.run(main())
