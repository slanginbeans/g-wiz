G-WIZ — Graphics Wizard  (version 1.8.0)
=========================================

Starting G-WIZ
--------------
Double-click G-WIZ.exe. Nothing needs to be installed.

G-WIZ opens in its own window. It uses the Microsoft Edge engine that is part of
Windows 10 and 11, in app mode: no tabs, no address bar, no browser toolbars.
The program closes itself when you close its window (or choose File > Exit).

To open an image straight away, drag it onto G-WIZ.exe, or right-click an image,
choose "Open with" > "Choose another app" and pick G-WIZ.exe.

First run: Windows may show "Windows protected your PC" because the program is
not code-signed. Click "More info", then "Run anyway". This happens only once.

Open and Save use the normal Windows file dialogs.

Where things are
----------------
  Menu bar        File, Edit, View, Image, Layer, Animation, Tools, Colors, Help
  Toolbar         New, Open, Import as layer, Save, Save project, Undo/Redo, zoom,
                  view modes, Remove background, Remove specks, Edge finishing,
                  Opacity, Adjust colors, Effects, Layer transform, Canvas size,
                  rotate and flip, Animation frames, Motion finder, Stabilize, Help
  Toolbox (left)  Move/transform (M), Crop (C), Eraser (E or B), Restore brush (R),
                  Magic wand (W), Paint bucket (G), Color picker (I), Magnifier (Z),
                  Pencil (P), Brush (Y), Pen (N), Marker (K), Airbrush (J), Text (A),
                  Line (L), Rectangle (U), Ellipse (O), Rounded rectangle,
                  Track box (T), Pan (H)
                  The box under the toolbox holds quick presets for the selected tool.
  Layers (right)  Layer list with show/hide, lock, blend mode and opacity
  Options (right) Settings for the selected tool or feature
  Color box       Primary and secondary color (bottom left), the palette, recent
                  colors, preset color schemes and Edit colors
  Frame strip     Appears at the bottom for animations: play, step, scrub, thumbnails
  Status bar      Help for whatever is under the mouse, cursor position, size, zoom, frame

Hover over any button for its name; the status bar explains what it does.
Press F1 for keyboard shortcuts.

Layers
------
  - File > Import as layer (Ctrl+Shift+O) adds one or more images as new layers.
    Dropping or pasting an image while a picture is open also adds it as a layer.
    Animated GIFs can be layers too; the picture animates as long as its longest layer.
  - Click a layer to select it. Every tool (eraser, wand, drawing, adjustments,
    effects, motion finder, stabilize) works on the selected layer only.
  - Drag layers in the list to reorder them; double-click a name to rename it.
  - Move tool (M): drag to move, drag corners to resize (Shift keeps proportions),
    drag edges to stretch, drag the round handle (or outside the box) to rotate,
    Ctrl+corner to distort, Ctrl+edge to skew. Enter applies, Esc cancels,
    arrow keys nudge. "Auto pick" selects whatever layer you click on.
  - Layer > Layer size and shape: exact position, size, rotation and skew, center,
    fit or fill the canvas, trim to visible pixels, and cut the layer to a shape
    (ellipse, circle, rounded rectangle, star, heart, triangle, hexagon, diamond).
  - Blend modes (Multiply, Screen, Overlay and more) and per-layer opacity.
  - Merge down, Flatten, Duplicate, Delete. Undo covers all of it.
  - Image > Canvas size adds or removes canvas around the layers; Image > Resize
    scales everything; Crop and Rotate can work on the whole picture or one layer.
  - Save project (Ctrl+Shift+S) keeps the layers, masks and frames in a .gwiz file
    that File > Open reopens. Saving as PNG, GIF, WebP or TIFF combines the layers.

Drawing
-------
  Pencil (hard pixels), Pen (smooth even lines), Brush (soft, builds up),
  Marker (see-through, chisel or round tip) and Airbrush. Each keeps its own size,
  opacity, hardness, spacing, smoothing and blend settings; brush and pen respond
  to pen pressure. Left button paints the primary color, right button the
  secondary. [ and ] change the size, Alt+click picks a color, "Keep transparent areas clear"
  paints only where the layer already has pixels.
  Shapes: line (with arrowheads), rectangle, ellipse and rounded rectangle, as
  outline, fill or both, with line width, dash pattern and corner style. Shift
  draws squares, circles and 45° lines.
  Paint bucket fills by tolerance (optionally looking at all layers); Text adds a
  new text layer with font, size, bold/italic/underline, outline and shadow.

Colors
------
  Click a swatch for the primary color, right-click for the secondary, X swaps
  them and D resets to black and white. The scheme list switches between preset
  palettes (Classic Paint, Pastel, Earth tones, Neon, Grayscale, Skin tones,
  Retro 8-bit, Game Boy, Material, Ocean, Sunset, Forest, Candy, Vintage) and
  your own Custom colors. Edit colors (or double-click a well) opens a full color
  picker with RGB, HSV, hex and opacity.

New in 1.8
----------
Background removal
  - High-quality AI model: Remove background > AI model > "High quality".
    A larger model (U²-Net) that finds subjects and their outlines more
    reliably, especially people with raised arms, busy scenes and drawings.
    It is a one-time 44 MB download, kept on this computer afterwards, and
    needs the graphics chip. "Load file…" loads the model file (u2net.bin)
    if this computer cannot download it.
  - Refine edge brush (toolbox, or Remove background > Check and refine):
    after removing the background, paint along hair, fur or a soft outline.
    When you let go, every pixel under the stroke is re-cut by how much of it
    is subject and how much background. Works after any method, even after
    erasing by hand. Undo takes a stroke back.
  - Check the result: backdrop buttons right on the Remove background page,
    Q switches between checkerboard, white, black and your own color, and
    "Edge check" paints every partly see-through pixel magenta so halos and
    fringes stand out.
  - Steady across frames (AI method, animations): the outline no longer
    flickers from frame to frame. Each frame is compared with the frames
    around it wherever the picture has not changed, so a moving subject is
    not smeared.
Pixel art (Pixel art page)
  - Colors in the picture: every color the frame uses. Pick one, choose a new
    primary color and Recolor: every pixel of that color changes, on all
    layers and frames, in one undo step.
  - Add outline: a one-pixel outline in the primary color, outside or inside
    the shape, with or without corners.
  - Shades of the primary color: a ramp of 3 to 9 shades with hue shifting
    (darker toward blue, lighter toward yellow); click one to use it, or add
    them all to Custom colors.
  - Shading pencil: Darken or Lighten; the pencil then moves each pixel it
    touches one step darker or lighter along the palette.
  - Tiled preview (3 × 3) shows seams; "Shift by half" brings the tile edges
    to the middle so you can draw over the seams (shift again to put them
    back).
  - Save sprite sheet (also in the Image menu): every animation frame in one
    PNG, square, one row, one column or a set number of columns, with an
    optional gap, at the export scale; optionally with a JSON frame list for
    game engines.

New in 1.7: AI background removal
---------------------------------
  Remove background has a new AI method, now the default. A small AI model
  that is part of G-WIZ finds the main subject (a person, an animal, a car,
  an object), and the cut then follows the picture's real edges and keeps
  soft hair and fur. It runs on this computer, works offline and sends
  nothing anywhere. On photos with busy backgrounds it gets the subject right
  far more often than the Smart method.
  - The line under the method buttons says how long finding the subject took
    and whether the graphics chip was used. With the graphics chip it is
    quick; without it (old graphics drivers) it can take half a minute.
  - "Trust the AI" (Detection): high keeps what the AI calls the subject even
    where its colors look like the background; low lets clear color
    differences decide more of the outline.
  - On a plain background (a wall, a backdrop, a sky) the AI also uses the
    border colors the way Smart does, so shapes it does not recognize are
    kept too.
  - The hint brushes work as before: paint "Mark subject" over a part the AI
    missed, or "Mark background" over a part it kept, and remove again.
  - Smart and Classic are still there. Smart is often the more exact choice
    for logos, drawings and shapes on a plain background.
  - The AI model is U²-Net-P by Xuebin Qin et al., under the Apache License
    2.0 (source\app\models has the license and details). It adds about 3 MB.

New in 1.6.1
------------
  - File > Recover autosaved work shows whether your autosaves are protected
    from being cleared when the device runs low on space, and how much space
    G-WIZ uses. G-WIZ asks the browser for this protection.
  - If storage fills up, G-WIZ removes older autosaves of other pictures to
    keep the current one, and says so. If it still cannot save, it tells you
    once and tries again later instead of every few seconds.

Pixel art mode (new in 1.6)
--------------------------
  Image > Pixel art mode, or the green sprite button on the toolbar, opens the
  Pixel art page. Pixel art mode works on its own or together with animation
  mode.
  - Screen size: pick a retro screen or sprite size (Game Boy 160 x 144, NES
    256 x 240, SNES, Genesis, Master System, Game Boy Advance, Atari 2600,
    ZX Spectrum, Commodore 64, Amstrad CPC, MSX, Apple II, Amiga, Macintosh,
    CGA/EGA/VGA modes, PICO-8, TIC-80, and sprite and tile sizes from 8 x 8
    to 256 x 256). "New pixel canvas" starts a picture at that size (clear, or
    filled with the first, last or white color); "Scale picture" resizes the
    picture with hard pixels; "Change canvas" changes the canvas around it.
    The same sizes are in File > New.
  - Palettes: PICO-8, Game Boy (green), Game Boy Pocket (gray), Virtual Boy,
    NES, Commodore 64, ZX Spectrum, CGA/EGA, both CGA 4-color palettes,
    Apple II, MSX, Amstrad CPC, Sega Master System, Teletext/BBC Micro,
    Macintosh 1-bit, DawnBringer 16 and 32, and Sweetie 16. They are also in
    the Colors menu and the scheme list under the canvas.
  - Color depth: 1-bit (2 colors), 2-bit (4), 3-bit (8), 4-bit (16),
    6-bit (64), 8-bit (256, RGB 3-3-2), and 9-, 12-, 15- and 16-bit RGB,
    which limit how finely each color channel can be set. Colors you pick
    snap to the palette and depth.
  - Reduce colors maps the selected layer (every frame, if you like) onto the
    palette and depth, with no dithering, 2 x 2 or 4 x 4 ordered dithering,
    or Floyd-Steinberg error diffusion. When the depth allows fewer colors
    than the palette has, G-WIZ picks the palette colors that suit the
    picture best. A counter shows how many colors the frame uses and warns
    in red when it goes over the limit or off the palette. "Swap primary
    color for secondary" recolors every pixel of one exact color.
  - Drawing: every tool draws solid, hard-edged pixels in palette colors; a
    pixel-perfect 1-pixel pencil (no doubled corners); mirror drawing left-right,
    top-bottom or both; a pixel grid from 300% zoom and an optional 8/16/32/64
    tile grid. The zoom steps in whole numbers.
  - A preview window shows the whole picture at its real size, optionally with
    CRT scanlines and stretched to a 4:3 TV shape.
  - Export scale saves PNG, GIF, WebP and TIFF enlarged 2, 3, 4, 6 or 8 times
    with crisp pixels.

New in 1.5
----------
  - Autosave: your picture is kept on this computer a few seconds after each
    change and when G-WIZ is closed. If it closed with work not saved as a
    project, the next start offers to open it again. File > Recover autosaved
    work lists the last three pictures; File > Autosave turns it off.
  - Adding a picture bigger than the canvas asks whether to shrink the picture,
    enlarge the canvas, or keep both sizes.
  - Markers are fully opaque by default.
  - Fixed: the calligraphy pen drew nothing if G-WIZ had been used before.
  - Long menus no longer run off the screen.

Removing a background (1.4)
---------------------------
  Remove background has a Smart method (the default until 1.7): it learns the background
  colors from the border, works out what the subject looks like, cuts along
  the picture's real edges and keeps soft edges on hair. Presets, hint brushes
  (Mark subject / Mark background, also in the toolbox), and sliders for
  tolerance, edges, background colors, border width, refinement passes,
  enclosed gaps, edge detail, softness and contrast. Turn on the preview to
  see the result before applying. Classic is the old border flood.
  The Eraser's Detection settings gain "Perceptual color matching" and
  "Ignore fine texture and noise in edges".

Drawing (1.4)
-------------
  Each drawing tool has a Style list (pencil: hard round, square, grainy,
  sketch; pen: ink, ballpoint, calligraphy, felt tip, brush pen; brush: soft,
  hard, bristle, chalk, splatter, watercolor; marker: chisel, round,
  highlighter, dry; airbrush: fine, coarse, soft, spatter, stipple), a pen
  pressure curve editor with presets, and a tool strip with size and opacity
  sliders in canvas view (Tab).

Animation mode
--------------
  Animation > Animation mode (or the film-strip toolbar button) shows every
  frame in the strip, with New frame, Duplicate, Delete and move buttons,
  onion skins (frames before in red, after in green; choose how many and how
  strong) and Motion tween, which moves, scales, turns or fades the selected
  layer smoothly between two frames. Save as GIF to export.
  G-WIZ starts on a blank white picture; Help > Open the sample picture loads
  the cactus.

Canvas view and panels
----------------------
  Tab (or View > Canvas view, or the picture button on the toolbar) hides
  everything but the picture; Tab or the "Show interface" button brings the
  interface back. Click the Layers title bar to minimize the Layers panel.

Touch screens
-------------
  On a touch-screen PC, View > Touch mode makes every control finger-sized and adds
  an on-screen key bar (Undo, Redo, Shift, Alt, Ctrl, 2nd color, Fit, Panels).
  Tap with two fingers to undo, three fingers to redo; pinch to zoom. With a pen,
  View > "Pencil draws, fingers pan" keeps your hand from drawing.
  An iPad version that installs from a web address and then works offline comes
  as a separate download (G-WIZ-iPad-1.8.0.zip).

Also new in 1.1
---------------
  File > New for a blank picture, Image > Adjust colors (brightness, contrast,
  saturation, hue, temperature, gamma, grayscale/sepia/invert/posterize, auto
  contrast) with live preview, Image > Effects (blur, sharpen, pixelate, sticker
  outline, drop shadow), copy layer or whole picture to the clipboard.

Stabilize (animations)
----------------------
  1. Click the Stabilize button (crosshair) on the toolbar.
  2. Optional: pick the Track box tool (T) and drag a box around something that
     should stay still, then choose "Track box".
  3. Click "Analyze shake". The graph shows the measured movement.
  4. "Keep camera moves" at 0 locks the picture; higher values remove only jitter.
  5. Choose what happens to edges uncovered by the shift, then Apply. Undo reverses it.

Updating G-WIZ
--------------
Run "Update G-WIZ.bat" in this folder.
  - Drag a newer G-WIZ zip onto it, or just double-click it: it finds the newest
    G-WIZ-*-windows.zip in this folder, your Downloads folder or your Desktop.
  - If the releases are hosted online, put the zip's direct download address on
    one line in a file named update-url.txt next to the updater; it will then
    download the update itself.
It shows the installed and new versions, asks before installing, asks you to
close G-WIZ if it is open, keeps the old version in backup\<version>, and offers
to start the new one. If copying fails it puts the previous version back.

Removing G-WIZ
--------------
Delete this folder. G-WIZ also keeps its window settings in
  %LOCALAPPDATA%\G-WIZ
which you can delete too.

Other files in this folder
--------------------------
  G-WIZ browser edition.html   The same program as a single web page, for use
                               in any modern browser on any computer.
  source\                      Source code, the same as in the GitHub repository
                               (github.com/slanginbeans/g-wiz, folder "source").
                               source\DEVELOPING.md explains how to build, test and
                               make a release (Python 3 + Pillow; Go 1.21+ for the exe).
