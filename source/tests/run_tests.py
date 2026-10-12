#!/usr/bin/env python3
"""G-WIZ regression tests.

Runs every script in cases/ against the built app in a headless Chromium (desktop and
iPad emulation), then checks each script's report against the expectations in EXPECT.

    python3 run_tests.py              run everything
    python3 run_tests.py px1 s1       run only these cases
    python3 run_tests.py --list       list the cases

Needs: Python 3.9+, Pillow, numpy, playwright (pip install pillow numpy playwright;
python -m playwright install chromium). Build the app first (ui-build/build.py), or point
GWIZ_URL at any copy of the app, e.g. GWIZ_URL=https://slanginbeans.github.io/g-wiz/.
Screenshots, logs and exported files go to tests/out/.
"""
import os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
CASES = os.path.join(HERE, 'cases')
OUT = os.path.join(HERE, 'out')

# What each case covers, and lines its report must (or must not) contain.
# Every case must also end with "errors []" (no script errors in the app) and exit cleanly.
EXPECT = {
    'l1':    ('layers: add, move, transform, merge, crop, GIF export, project save and reopen',
              [r"reopened .*'n': 4", r"saved \['sample-cactus-cutout\.gif'", r"project \['sample-cactus\.gwiz'"], []),
    'l3':    ('File > New dialog, crop, distort', [r"newdlg True", r"new .*'size': '320 × 200 px'"], []),
    'g4':    ('GIF frames, motion finder, About box', [r"motion: Still areas cover", r"about open: True"], []),
    'i1':    ('iPad: touch mode, pen, brush, lines, menus, sharing a save', [r"shared \['sample-cactus-cutout\.png'"], []),
    'i2':    ('iPad: two/three-finger undo/redo, canvas view, minimized layers, crop', [r"same True", r"layer list hidden True"], []),
    'a1':    ('animation mode: frames, onion skin, duplicate/move/delete, tween, GIF export',
              [r"tween .*'frame': '1 / 12'", r"gif \['untitled-cutout\.gif'", r"pages scrollable \[\d+, \d+, True\]"], []),
    'b1':    ('brush styles, pressure curve, tool strip in canvas view', [r"mini hidden after exit True"], []),
    'b2':    ('every brush style draws', [], []),
    'c1':    ('calligraphy pen with old settings, opaque marker', [r"marker opacity ui 100 blend source-over", r"marker px \(want 0,0,255\) \[0, 0, 255, 255\]"], []),
    's1':    ('picture-does-not-fit dialog, autosave, recovery after restart', [r"restored .*'n': 3", r"prompt after seen False"], []),
    's2':    ('autosave keeps each document when switching', [r"after doc2 stroke \[\[.*\], \[.*\]\]"], []),
    'm1':    ('every menu fits the screen (desktop, iPad landscape and portrait)', [r"ipadP helpm"], [r"BAD"]),
    'st1':   ('storage: protection status, making room when full, backing off',
              [r"empty recover \['There is no autosaved work yet", r"granted recover .*'Protected: ", r"room made \[\[800, 600\]\] \| Storage was full",
               r"full \| Autosave stopped: .* \| puts 1 1", r"recovered after backoff 2 ", r"ipad recover Not protected: Safari", r"ipad persist asked [1-9]"], []),
    'ai1':   ('AI background removal: the network matches the reference on both paths, cuts, preview, page',
              [r"engine gpu maxdiff .* ok True", r"engine cpu maxdiff .* ok True", r"ai t1_gradient method ai IoU .* ok True \| Subject found in",
               r"ai t4_twotone method ai IoU .* ok True", r"preview (Would erase|Nothing left)", r"visible trust,border,edge,detail \[True, False, False, True\]"], []),
    'px1':   ('pixel art: new Game Boy canvas, mirror, animation alongside, integer zoom, 4x export, hard brush',
              [r"export \(640, 576\) .* True", r"brush hard .* True", r"zooms 400% 500% 400%", r"anim\+pix .*'pix': True, 'anim': True"], []),
    'px2':   ('pixel art: color reduction for palettes, depths and dithering',
              [r"NES d4 fs .* colors 16 inNES=True", r"NES full none .* inNES=True", r" d1 o4 .* colors 2 \[\(0, 0, 0\), \(255, 255, 255\)\]",
               r" d2 o2 .* colors 4 ", r" d12 none .* 4bit-ch=True", r"Commodore 64 d2 fs .* colors 4 "], []),
    'px3':   ('pixel art on iPad portrait: scale to PICO-8 size, tile grid, CRT preview', [r"128 × 128 px"], []),
    'bench': ('background removal accuracy on 4 test pictures', [], []),
}
# these check gestures recognized by timing (double taps, multi-finger taps); they run alone so a busy
# machine running other tests at once does not delay their events
SERIAL = {'i2'}
# background removal must stay at least this good (IoU = overlap with the true subject, 1.0 is perfect)
BENCH_MIN_IOU = {('smart', 't1_gradient'): 0.97, ('smart', 't2_similar'): 0.95, ('smart', 't3_texture'): 0.90, ('smart', 't4_twotone'): 0.97}


def run_case(name):
    t0 = time.time()
    p = subprocess.run([sys.executable, os.path.join(CASES, name + '.py')], cwd=OUT, capture_output=True, text=True, timeout=900)
    log = p.stdout + ('\n--- stderr ---\n' + p.stderr if p.stderr.strip() else '')
    open(os.path.join(OUT, name + '.log'), 'w', encoding='utf-8').write(log)
    problems = []
    if p.returncode != 0:
        tail = [l for l in p.stderr.strip().splitlines() if l.strip()][-1:] or ['(no message)']
        problems.append('script failed: ' + tail[0][:200])
    errs = re.findall(r"^errors (.*)$", p.stdout, re.M)
    if not errs: problems.append('no "errors" line in the report')
    elif any(e.strip() != '[]' for e in errs): problems.append('app errors: ' + ' | '.join(e for e in errs if e.strip() != '[]')[:300])
    _, must, mustnot = EXPECT[name]
    for rx in must:
        if not re.search(rx, p.stdout): problems.append('missing: ' + rx)
    for rx in mustnot:
        m = re.search(rx, p.stdout)
        if m: problems.append('found: ' + p.stdout[max(0, m.start() - 120):m.end()].splitlines()[-1].strip())
    if name == 'bench':
        for (method, pic), lo in BENCH_MIN_IOU.items():
            m = re.search(rf"^{method}\s+{pic}\s+.*IoU=([\d.]+)", p.stdout, re.M)
            if not m: problems.append(f'no result for {method} {pic}')
            elif float(m.group(1)) < lo: problems.append(f'{method} {pic} IoU {m.group(1)} is below {lo}')
    return name, problems, time.time() - t0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    if '--list' in sys.argv:
        for k, v in EXPECT.items(): print(f'{k:6s} {v[0]}')
        return 0
    names = args or list(EXPECT)
    bad = [n for n in names if n not in EXPECT]
    if bad: print('unknown case:', ', '.join(bad)); return 2
    app = os.environ.get('GWIZ_URL') or os.path.join(HERE, '..', 'launcher', 'index.html')
    if '://' not in app and not os.path.exists(app):
        print('The app is not built yet. Run ui-build/build.py first, or set GWIZ_URL.'); return 2
    os.makedirs(OUT, exist_ok=True)
    cwd = os.getcwd(); os.chdir(OUT)
    sys.path.insert(0, HERE); import fixtures; fixtures.make_all()
    os.chdir(cwd)
    print(f'Testing {app}\n')
    failed = 0
    def report(res):
        nonlocal failed
        name, problems, dt = res
        print(f"{'PASS' if not problems else 'FAIL'}  {name:6s} {dt:5.0f}s  {EXPECT[name][0]}", flush=True)
        for pr in problems: print('        - ' + pr)
        failed += bool(problems)
    with ThreadPoolExecutor(max_workers=int(os.environ.get('GWIZ_TEST_JOBS', '4'))) as ex:
        for res in ex.map(run_case, [n for n in names if n not in SERIAL]): report(res)
    for n in names:
        if n in SERIAL: report(run_case(n))
    print(f'\n{len(names) - failed} of {len(names)} passed. Reports and screenshots: {OUT}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
