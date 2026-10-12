# G-WIZ (Graphics Wizard)

Background eraser, animated GIF editor, layers and drawing tools that run entirely in the browser.

**Open it:** https://slanginbeans.github.io/g-wiz/

On an iPad, open that address in Safari, tap Share → **Add to Home Screen**, then open G-WIZ once from the new icon while online. After that it works offline. Pictures never leave the device.

To update the app, replace `index.html` (and any other changed files) in this repository. Installed copies download the change the next time they open with internet and offer a restart.

## Source code

Everything needed to build, test and release G-WIZ is in [`source/`](source/). See [`source/DEVELOPING.md`](source/DEVELOPING.md):
`python3 source/make_release.py --test --publish` builds the app, runs the regression tests, makes the Windows and iPad zips, and puts the web app here, ready to push.
