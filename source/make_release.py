#!/usr/bin/env python3
"""Builds a G-WIZ release from this folder.

    python3 make_release.py              build the app, the exe and both zips into dist/
    python3 make_release.py --test       ... and run the regression tests first (stops if any fail)
    python3 make_release.py --publish    ... and copy the iPad/web app to the repository root,
                                         ready to commit and push to GitHub Pages
    python3 make_release.py --no-exe     skip the Windows exe and zip (no Go needed)

The version is set in one place: VERSION in ui-build/build.py. This script copies it into the
launcher, the exe resources, the README and the iPad guide.
"""
import os, re, shutil, subprocess, sys, zipfile

SRC = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(SRC)
UI, LAUNCHER, RELEASE, WEB, DIST = (os.path.join(SRC, d) for d in ('ui-build', 'launcher', 'release', 'web', 'dist'))
SKIP_DIRS = {'__pycache__', 'out', 'dist', 'web'}
SKIP_FILES = {'G-WIZ.exe'}


def step(msg): print('\n== ' + msg, flush=True)


def run(args, cwd, env=None):
    p = subprocess.run(args, cwd=cwd, env=env)
    if p.returncode: sys.exit(f'Failed: {" ".join(args)}')


def sub_file(path, pattern, repl, count_expected=None):
    s = open(path, encoding='utf-8').read()
    s2, n = re.subn(pattern, repl, s, flags=re.M)
    if count_expected is not None and n != count_expected: sys.exit(f'{os.path.basename(path)}: expected {count_expected} version mark(s), found {n}')
    if s2 != s: open(path, 'w', encoding='utf-8', newline='').write(s2)


def copy_source(dest):
    # the source folder as it is in the repository, without build output
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel = os.path.relpath(root, SRC)
        for f in files:
            if f in SKIP_FILES or f.endswith('.pyc'): continue
            os.makedirs(os.path.join(dest, rel), exist_ok=True)
            shutil.copy2(os.path.join(root, f), os.path.join(dest, rel, f))


def zip_dir(folder, zpath):
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        base = os.path.dirname(folder)
        for root, dirs, files in os.walk(folder):
            dirs.sort()
            for f in sorted(files):
                full = os.path.join(root, f); z.write(full, os.path.relpath(full, base))


def main():
    a = set(sys.argv[1:])
    unknown = a - {'--test', '--publish', '--no-exe'}
    if unknown: sys.exit('Unknown option: ' + ' '.join(sorted(unknown)) + '\n' + __doc__)
    version = re.search(r"^VERSION = '([\d.]+)'", open(os.path.join(UI, 'build.py'), encoding='utf-8').read(), re.M).group(1)
    print(f'G-WIZ {version}')

    step('Setting the version everywhere')
    sub_file(os.path.join(LAUNCHER, 'main.go'), r'^const version = "[\d.]+"', f'const version = "{version}"', 1)
    title = r'\A(G-WIZ[^\n]*)\(version [\d.]+\)'     # the version in each guide's title line
    sub_file(os.path.join(RELEASE, 'README.txt'), title, rf'\g<1>(version {version})', 1)
    sub_file(os.path.join(RELEASE, 'README.txt'), r'G-WIZ-iPad-[\d.]+\.zip', f'G-WIZ-iPad-{version}.zip')
    sub_file(os.path.join(RELEASE, 'Read me first.txt'), title, rf'\g<1>(version {version})', 1)

    step('Building the app page and the web/iPad app')
    run([sys.executable, 'build.py'], UI)
    run([sys.executable, 'mkres.py'], UI)

    exe = None
    if '--no-exe' not in a:
        step('Building G-WIZ.exe')
        go = shutil.which('go')
        if not go: sys.exit('Go is not installed. Install Go 1.21+ from https://go.dev/dl/ or use --no-exe.')
        env = dict(os.environ, GOOS='windows', GOARCH='amd64', CGO_ENABLED='0')
        run([go, 'build', '-trimpath', '-ldflags', '-H windowsgui -s -w', '-o', 'G-WIZ.exe', '.'], LAUNCHER, env)
        exe = os.path.join(LAUNCHER, 'G-WIZ.exe')

    if '--test' in a:
        step('Running the regression tests')
        run([sys.executable, os.path.join(SRC, 'tests', 'run_tests.py')], SRC)

    step('Packaging')
    os.makedirs(DIST, exist_ok=True)
    win, ipad = os.path.join(DIST, 'G-WIZ'), os.path.join(DIST, 'G-WIZ-iPad')
    for d in (win, ipad): shutil.rmtree(d, ignore_errors=True)
    os.makedirs(ipad)
    shutil.copytree(WEB, os.path.join(ipad, 'Upload to GitHub'))
    shutil.copy2(os.path.join(RELEASE, 'Read me first.txt'), ipad)
    shutil.copy2(os.path.join(SRC, 'tests', 'iPad test checklist.txt'), ipad)
    zips = [os.path.join(DIST, f'G-WIZ-iPad-{version}.zip')]
    zip_dir(ipad, zips[0])
    if exe:
        os.makedirs(win)
        shutil.copy2(exe, win)
        for f in ('README.txt', 'Update G-WIZ.bat'): shutil.copy2(os.path.join(RELEASE, f), win)
        shutil.copy2(os.path.join(LAUNCHER, 'index.html'), os.path.join(win, 'G-WIZ browser edition.html'))
        open(os.path.join(win, 'version.txt'), 'w').write(version + '\n')
        copy_source(os.path.join(win, 'source'))
        zips.insert(0, os.path.join(DIST, f'G-WIZ-{version}-windows.zip'))
        zip_dir(win, zips[0])

    if '--publish' in a:
        step('Copying the web app to the repository root')
        for f in os.listdir(WEB):
            s, d = os.path.join(WEB, f), os.path.join(REPO, f)
            if os.path.isdir(s): shutil.rmtree(d, ignore_errors=True); shutil.copytree(s, d)
            else: shutil.copy2(s, d)
        print('Now commit and push the repository; GitHub Pages publishes it in a minute or two.')

    print('\nDone:')
    for z in zips: print(f'  {os.path.relpath(z, SRC)}  ({os.path.getsize(z) / 1048576:.1f} MB)')


if __name__ == '__main__':
    main()
