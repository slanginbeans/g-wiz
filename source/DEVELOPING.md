# Developing G-WIZ

This folder is the master copy of G-WIZ's source. The repository root (one level up) holds only the built
web app that GitHub Pages serves at https://slanginbeans.github.io/g-wiz/.

## What is where

| Folder | Contents |
| --- | --- |
| `ui-build/` | The app itself. `build.py` turns it into one self-contained HTML page. |
| `launcher/` | The Windows program (Go). It embeds the HTML page and opens it in an Edge app window. |
| `release/` | Files shipped to users: `README.txt` and `Update G-WIZ.bat` (Windows), `Read me first.txt` (iPad). |
| `tests/` | Automatic regression tests and the manual `iPad test checklist.txt`. |
| `make_release.py` | Builds everything and makes the two zips. |

Build output (ignored by git): `web/` (the iPad/web app), `launcher/index.html`, `launcher/G-WIZ.exe`,
`launcher/rsrc_windows_amd64.syso`, `dist/` (zips) and `tests/out/` (test reports and screenshots).

## Requirements

- Python 3.9+ with Pillow and numpy: `pip install pillow numpy`
- For the tests: `pip install playwright` then `python -m playwright install chromium`
- For the Windows exe: Go 1.21+ (cross-compiles from any OS)

## Building

```
python3 ui-build/build.py        # -> launcher/index.html (desktop/browser) and web/ (iPad/web app)
```

Open `launcher/index.html` in a browser to try it. `?sample` at the end of the address opens the sample picture.

## How the app is put together

`ui-build/base_app.html` is the original single-page app (version 1.0). `build.py`:

1. takes its script and applies a list of exact text replacements with `rep(old, new, count)`. Each one must
   match exactly `count` times or the build stops, so a patch can never silently miss;
2. inserts the feature modules, in this order, just before `// ---------- boot ----------`:
   `ui_layers.js, ui_draw.js, ui_extra.js, ui_touch.js, ui_anim.js, ui_cutout.js, ui_mini.js, ui_session.js, ui_pixel.js`;
3. adds the toolbar icons (`icons.py`, `icons2.py`: 16×16 pixel art as text) and the page markup and
   styles (`ui_markup.html`);
4. writes the desktop page, and the web app with its service worker (`sw_template.js`), manifest and icons.

All modules share one scope. A global that another module may touch before its own module has run must be
declared with `var`, not `const`/`let` (e.g. `var PIX`, `var AUTO`, `var DS`), or the browser throws a
"cannot access before initialization" error at start-up. Function declarations are fine anywhere.

Menu commands go through `runCmd(c)`; each module has a `xxxCmd(c)` that returns `true` when it handled
the command. Tool option pages are `<div class="page" data-page="name">` in `ui_markup.html`, listed in
`PAGE_INFO`, and opened with `showPage(name)`.

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
then add a line for it to `EXPECT`.

Emulation cannot check the real Pencil, real gestures, Safari's storage rules or speed on the device,
so after each release also go through `tests/iPad test checklist.txt` on a real iPad.

## Making a release

1. Set `VERSION` in `ui-build/build.py` (the only place; `make_release.py` copies it everywhere else).
2. Add a "New in x.y" section to `release/README.txt` and, if it matters on the iPad, to
   `release/Read me first.txt`.
3. `python3 make_release.py --test --publish` builds, tests, makes `dist/G-WIZ-x.y.z-windows.zip` and
   `dist/G-WIZ-iPad-x.y.z.zip`, and copies the web app to the repository root.
4. Commit and push. Installed iPad copies show "A new version of G-WIZ has been downloaded" the next time
   they open with internet.
5. Run the iPad checklist on a real iPad.
