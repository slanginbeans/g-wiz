# Developing G-WIZ

This folder is the master copy of G-WIZ's source. The repository root (one level up) holds only the built
web app that GitHub Pages serves at https://slanginbeans.github.io/g-wiz/.

## What is where

| Path | Contents |
| --- | --- |
| `app/index.html` | The page: all markup (menus, toolbars, option pages, dialogs). |
| `app/styles/` | The styles, by area. |
| `app/scripts/` | The program (see the file map below). |
| `app/icons.txt` | Toolbar and menu icons as 16×16 pixel art, one letter per pixel. |
| `app/images/` | The app icon in every size (made by `tools/appicon.py`). |
| `app/models/` | The built-in AI subject model (`u2netp.bin`), its license and where it comes from. |
| `../models/u2net.bin` | The optional high-quality AI model (44 MB), in the repository root so GitHub Pages serves it; see `app/models/README.md`. |
| `app/sw.js` | Service worker for the offline web app. |
| `build.py` | Puts the page together. Holds `VERSION` and the order of the scripts. |
| `launcher/` | The Windows program (Go). It embeds the page and opens it in an Edge app window. |
| `release/` | Files shipped to users: `README.txt`, `Update G-WIZ.bat` (Windows), `Read me first.txt` (iPad). |
| `tests/` | Automatic regression tests and the manual `iPad test checklist.txt`. |
| `tools/` | `appicon.py` (draws the app icon), `mkres.py` (icon and version info for the exe), `convert_model.py` (makes `app/models/u2netp.bin` from the ONNX model, and is the NumPy reference the AI test checks against). |
| `make_release.py` | Builds everything and makes the two zips. |

Build output (ignored by git): `web/` (the iPad/web app), `launcher/index.html`, `launcher/G-WIZ.exe`,
`launcher/rsrc_windows_amd64.syso`, `dist/` (zips) and `tests/out/` (test reports and screenshots).

## Requirements

- Python 3.9+ with Pillow and numpy: `pip install pillow numpy`
- For the tests: `pip install playwright` then `python -m playwright install chromium`
- For the Windows exe: Go 1.21+ (cross-compiles from any OS)

## Building

```
python3 build.py      # -> launcher/index.html (desktop/browser) and web/ (iPad/web app)
```

Open `launcher/index.html` in a browser to try it. `?sample` at the end of the address opens the sample picture.

`build.py` does no patching: the page is `app/index.html` with the styles and the scripts put in where it
says `__STYLES__`, `__CODECS__` and `__APP__`, plus the version, the icons (`<icons>` in the list) and the AI model
file as text (`<model>`, about 3 MB). What you see in a file is
exactly what runs. The build stops if a script is missing from its list, a file is not in the list, or a
function is defined twice.

## How the program is put together

All scripts run in **one shared scope**, one after another, in the order listed in `SCRIPTS` in
`build.py`; the build puts them inside one `(() => { 'use strict'; … })()`. So:

- Any file can use what another file defines; nothing is imported or exported.
- **Order matters for code that runs at load time.** A file that runs code on load (adds menu items,
  binds buttons, sets defaults) can only use what earlier files set up. Calls inside functions that run
  later (on a click, a timer) can use anything.
- A global that an earlier file may touch before the file that declares it has run must be declared with
  `var`, not `const`/`let` (e.g. `var PIX`, `var AUTO`, `var DS`). Otherwise the browser stops with
  "cannot access before initialization".
- Function declarations are available everywhere. Each name may be defined only once (the build checks).

**core/** is the original background eraser and GIF editor. **features/** came later and build on it:
layers, drawing, the window and menus, touch, animation, smart cutout, autosave, pixel art. **boot.js**
starts the app and is last.

| File | What it does |
| --- | --- |
| `codecs.js` | GIF and TIFF decoding and encoding (its own script tag). |
| `core/setup.js` | `$`/`$$` helpers, the shared state `S`, the image globals, UI helpers, theme colors. |
| `core/image.js` | Loading an image into the editor, frames, masks, rendering. |
| `core/edge-maps.js` | Edge detection used by the eraser's edge-aware mode. |
| `core/color.js` | Sampling colors and color-difference amounts for the eraser. |
| `core/undo.js` | Undo and redo of pixel and mask edits. |
| `core/eraser.js` | The eraser and restore brushes. |
| `core/wand.js` | Magic wand. |
| `core/frames.js` | Copying masks between frames, the old film strip. |
| `core/view.js` | Zoom, pan, drawing the canvas. |
| `core/pointer.js`, `core/keyboard.js` | Mouse/pen input on the canvas; keyboard shortcuts. |
| `core/controls.js` | Wiring of the original controls; `setTool`. |
| `core/playback.js`, `core/scrubber.js` | Playing animations; the frame slider. |
| `core/loading.js` | Opening files. |
| `core/edge-finishing.js` | Edge finishing (shrink, soften, defringe) and the final combined picture. |
| `core/quick-fixes.js` | Classic automatic background removal. |
| `core/crop-rotate.js` | Rotating, flipping and resampling frames; committing size changes. |
| `core/motion-finder.js` | Canvas overlays (removal preview), motion finder, remove specks. |
| `core/saving.js` | Saving PNG, GIF, WebP, TIFF. |
| `core/sample.js` | The sample cactus picture. |
| `features/layers.js` | Layers: the document model, compositing, layer undo, adding and ordering layers. |
| `features/canvas-operations.js` | Canvas size, resize, crop, rotate and flip for the whole picture. |
| `features/transform.js` | Move tool: move, scale, rotate, skew, distort a layer. |
| `features/layers-panel.js` | The Layers panel, importing a picture as a layer, File > New. |
| `features/projects.js` | `.gwiz` project files. |
| `features/colors.js` | Primary/secondary colors, palettes, Edit Colors dialog. |
| `features/drawing-tools.js` | Pencil, pen, brush, marker, airbrush, shapes, paint bucket, pressure curve. |
| `features/picker-text.js` | Color picker; Text tool. |
| `features/adjustments-effects.js` | Adjust colors and Effects pages. |
| `features/tool-routing.js` | Sends canvas input to the right tool; the brush outline cursor. |
| `features/shell.js` | Pixel icons, status bar, tooltips, option pages, tool options box. |
| `features/menus.js` | Menus and the `runCmd` command dispatcher. |
| `features/canvas-tools.js` | On-canvas crop, track and magnifier. |
| `features/stabilize.js` | Stabilize (camera shake). |
| `features/desktop-bridge.js` | Opening files from and exiting the desktop program. |
| `features/touch.js` | Touch mode, Apple Pencil, finger gestures, canvas view, share sheet, offline updates. |
| `features/animation.js` | Animation mode: frames, onion skin, tweens. |
| `features/ai-model.js` | The AI subject model's runtime: WebGL2 shaders, a JavaScript fallback, caching per frame. |
| `features/smart-cutout.js` | Smart and AI background removal (`smartAmt`; with the AI's subject map as a prior), hint brushes. |
| `features/cutout-tools.js` | Checking a cut-out (backdrops, Q, edge check) and the refine edge brush. |
| `features/mini-bar.js` | Tool strip in canvas view. |
| `features/session.js` | "Picture bigger than the canvas" dialog, autosave, recovery, storage protection. |
| `features/pixel-art.js` | Pixel art mode. |
| `features/pixel-tools.js` | Pixel art tools: palette recolor, outline, ramps, shading pencil, tiles, sprite sheets. |

Common patterns:

- **Menus**: entries live in `MENUS` (`features/menus.js`); a feature adds its own with `MENUS.xxx.push(…)`.
  Commands go through `runCmd(c)`, which first asks each feature's `xxxCmd(c)` (returns `true` if it
  handled the command), then the built-in `switch`.
- **Option pages**: `<div class="page" data-page="name">` in `index.html`, a toolbar button with
  `data-page-btn="name"`, an entry in `PAGE_INFO`, opened with `showPage(name)`.
- **Icons**: add a block to `icons.txt` (`icon name` and 16 rows of 16 letters), use it as
  `<i class="ic" data-ic="name"></i>`.
- **Settings that persist**: `store.get(key, default)` / `store.set(key, value)` (localStorage, `gwiz.` prefix).

## Testing

```
python3 tests/run_tests.py           # all tests, about 2 minutes
python3 tests/run_tests.py px1 s1    # only some
python3 tests/run_tests.py --list    # what each test covers
```

Each test drives the app in headless Chromium (desktop and iPad emulation, including Apple Pencil and
multi-finger touch), prints a report, and the runner checks the report against `EXPECT` in `run_tests.py`.
Every test also fails if the app raises a script error. Reports and screenshots go to `tests/out/`.
`GWIZ_URL=https://slanginbeans.github.io/g-wiz/ python3 tests/run_tests.py` tests the published copy.

To add a test, put a script in `tests/cases/` that prints its findings and ends with `print('errors', errs)`,
then add a line for it to `EXPECT`. Tests that depend on gesture timing go in `SERIAL`.

Emulation cannot check the real Pencil, real gestures, Safari's storage rules or speed on the device,
so after each release also go through `tests/iPad test checklist.txt` on a real iPad.

## Making a release

1. Set `VERSION` in `build.py` (the only place; `make_release.py` copies it everywhere else).
2. Add a "New in x.y" section to `release/README.txt` and, if it matters on the iPad, to
   `release/Read me first.txt`.
3. `python3 make_release.py --test --publish` builds, tests, makes `dist/G-WIZ-x.y.z-windows.zip` and
   `dist/G-WIZ-iPad-x.y.z.zip`, and copies the web app to the repository root.
4. Commit and push. Installed iPad copies show "A new version of G-WIZ has been downloaded" the next time
   they open with internet.
5. Run the iPad checklist on a real iPad.
