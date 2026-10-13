#!/usr/bin/env python3
"""Builds G-WIZ from the files in app/.

    python3 build.py

Writes launcher/index.html (the desktop program and the browser edition: one self-contained page)
and web/ (the installable offline web app for the iPad, served by GitHub Pages).

There is no patching or code generation beyond the steps below: the page is app/index.html with the
styles and scripts put in, in the order listed here. All scripts share one scope (see DEVELOPING.md).
"""
import base64, hashlib, io, json, os, re
from PIL import Image

VERSION = '1.8.0'

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, 'app')

STYLES = ['base.css', 'shell.css', 'controls.css', 'panels.css', 'touch.css', 'modes.css']

# The scripts, in the order they run. The core is the original eraser and GIF editor; the features add to it
# and may replace what the core set up, so they come after it. boot.js starts the app and must be last.
SCRIPTS = [
    # core
    'core/setup.js', 'core/image.js', 'core/edge-maps.js', 'core/color.js', 'core/undo.js', 'core/eraser.js',
    'core/wand.js', 'core/frames.js', 'core/view.js', 'core/pointer.js', 'core/keyboard.js', 'core/controls.js',
    'core/playback.js', 'core/loading.js', 'core/edge-finishing.js', 'core/scrubber.js', 'core/crop-rotate.js',
    'core/quick-fixes.js', 'core/motion-finder.js', 'core/saving.js', 'core/sample.js',
    '<icons>',   # ICON_PAL and ICONS, made from icons.txt
    # layers
    'features/layers.js', 'features/canvas-operations.js', 'features/transform.js', 'features/layers-panel.js',
    'features/projects.js',
    # colors, drawing, text, adjustments
    'features/colors.js', 'features/drawing-tools.js', 'features/picker-text.js', 'features/adjustments-effects.js',
    'features/tool-routing.js',
    # the window: status bar, tooltips, pages, menus, canvas tools, stabilize, desktop program
    'features/shell.js', 'features/menus.js', 'features/canvas-tools.js', 'features/stabilize.js',
    'features/desktop-bridge.js',
    # later features
    'features/touch.js', 'features/animation.js',
    '<model>',   # AI_MODEL_B64: app/models/u2netp.bin (the AI subject model, see app/models/README.md)
    'features/ai-model.js', 'features/smart-cutout.js', 'features/cutout-tools.js', 'features/mini-bar.js',
    'features/session.js', 'features/pixel-art.js', 'features/pixel-tools.js',
    'boot.js',
]


def read(rel): return open(os.path.join(APP, rel), encoding='utf-8').read()


def icons_js():
    """icons.txt -> two constants. 'color X #rrggbb' maps a letter to a color, 'icon NAME' + 16 rows is an icon."""
    pal, icons, cur = {}, {}, None
    for line in read('icons.txt').splitlines():
        if not line or line.startswith('#'): cur = None; continue
        if line.startswith('color '):
            _, k, v = line.split(' ', 2); pal[k] = None if v == 'none' else v
        elif line.startswith('icon '):
            cur = line[5:].strip(); icons[cur] = []
        else:
            icons[cur].append(line)
    for k, rows in icons.items():
        assert len(rows) == 16 and all(len(r) == 16 and set(r) <= set(pal) for r in rows), f'icon "{k}" must be 16 rows of 16 palette letters'
    return 'const ICON_PAL = ' + json.dumps(pal) + ';\nconst ICONS = ' + json.dumps({k: '\n'.join(v) for k, v in icons.items()}) + ';'


def model_js():
    """The AI model file, carried inside the page so it works offline everywhere (about 3 MB as text)."""
    return "const AI_MODEL_B64 = '" + base64.b64encode(open(os.path.join(APP, 'models', 'u2netp.bin'), 'rb').read()).decode() + "';"


def data_png(img):
    b = io.BytesIO(); img.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def build_page():
    # every script is separated from the next by one blank line, inside one function scope
    gen = {'<icons>': icons_js, '<model>': model_js}
    app = "\n(() => {\n'use strict';\n" + '\n'.join(gen[s]() if s in gen else read('scripts/' + s) for s in SCRIPTS) + '})();\n'
    icon = Image.open(os.path.join(APP, 'images', 'icon32.png'))
    page = read('index.html').replace('__STYLES__', '\n'.join(read('styles/' + s) for s in STYLES))
    page = page.replace('__FAVICON__', data_png(icon)).replace('__ICON64__', data_png(icon.resize((64, 64), Image.NEAREST))).replace('__VERSION__', VERSION)
    return page.replace('__CODECS__', read('scripts/codecs.js')).replace('__APP__', app)


def build_web(html):
    """The offline web app: the same page plus a manifest, a service worker and home-screen icons."""
    web = os.path.join(HERE, 'web')
    os.makedirs(os.path.join(web, 'icons'), exist_ok=True)
    pwa_head = ('<link rel="manifest" href="manifest.webmanifest">\n'
                '<meta name="theme-color" content="#000080">\n'
                '<meta name="apple-mobile-web-app-capable" content="yes">\n'
                '<meta name="mobile-web-app-capable" content="yes">\n'
                '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
                '<meta name="apple-mobile-web-app-title" content="G-WIZ">\n'
                '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
                '<script>window.__GWIZ_PWA__ = 1;</script>')
    web_html = html.replace('<!--__PWA_HEAD__-->', pwa_head, 1)
    open(os.path.join(web, 'index.html'), 'w', encoding='utf-8').write(web_html)
    small = Image.open(os.path.join(APP, 'images', 'icon32.png')).convert('RGBA')

    def tile(size, scale, bg=(0, 128, 128, 255)):
        im = Image.new('RGBA', (size, size), bg)
        ic = small.resize((32 * scale, 32 * scale), Image.NEAREST)
        o = (size - 32 * scale) // 2
        im.alpha_composite(ic, (o, o + scale // 2))
        return im
    tile(180, 4).convert('RGB').save(os.path.join(web, 'icons', 'apple-touch-icon.png'))
    tile(192, 5).save(os.path.join(web, 'icons', 'icon-192.png'))
    tile(512, 14).save(os.path.join(web, 'icons', 'icon-512.png'))
    tile(512, 9).save(os.path.join(web, 'icons', 'maskable-512.png'))
    manifest = {
        'name': 'G-WIZ Graphics Wizard', 'short_name': 'G-WIZ', 'id': './', 'start_url': './', 'scope': './',
        'display': 'standalone', 'orientation': 'any', 'background_color': '#c0c0c0', 'theme_color': '#000080',
        'description': 'Erase backgrounds, edit animated GIFs, draw and work with layers. Works offline.',
        'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                  {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                  {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]
    }
    open(os.path.join(web, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps(manifest, indent=2))
    open(os.path.join(web, 'sw.js'), 'w', encoding='utf-8').write(read('sw.js').replace('__VERSION__', VERSION))
    open(os.path.join(web, '.nojekyll'), 'w').write('')
    open(os.path.join(web, 'version.txt'), 'w').write(VERSION + '\n')
    return web_html


def main():
    missing = [s for s in SCRIPTS if not s.startswith('<') and not os.path.exists(os.path.join(APP, 'scripts', s))]
    unlisted = sorted(set(os.path.relpath(os.path.join(r, f), os.path.join(APP, 'scripts')).replace(os.sep, '/')
                          for r, _, fs in os.walk(os.path.join(APP, 'scripts')) for f in fs if f.endswith('.js')) - set(SCRIPTS) - {'codecs.js'})
    if missing or unlisted: raise SystemExit(f'Script list out of date. Missing files: {missing}. Files not in SCRIPTS: {unlisted}')
    # all scripts share one scope, where a second definition of a function silently replaces the first
    seen = {}
    for sc in SCRIPTS:
        if sc.startswith('<'): continue
        for name in re.findall(r'^(?:async )?function\s+([\w$]+)', read('scripts/' + sc), re.M):
            if name in seen: raise SystemExit(f'function {name}() is defined in both {seen[name]} and {sc}')
            seen[name] = sc
    html = build_page()
    open(os.path.join(HERE, 'launcher', 'index.html'), 'w', encoding='utf-8').write(html)
    web_html = build_web(html)
    print(f'G-WIZ {VERSION}: launcher/index.html ({len(html):,} bytes), web/ ({hashlib.sha1(web_html.encode()).hexdigest()[:10]})')


if __name__ == '__main__':
    main()
