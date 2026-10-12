// ---------- animation ----------
let playT = 0;
function setupAnim(){
  const multi = docFrames() > 1 || ANIM.on;
  $('#animSec').hidden = frames.length < 2;
  $('#frameSl').max = Math.max(0, docFrames() - 1); $('#frameSl').value = S.dcur;
  $('#timeline').hidden = !multi; stage.classList.toggle('has-tl', multi); $('#motionSec').hidden = frames.length < 2;
  $('#stabSec').hidden = frames.length < 2; $$('.anim-none, #animNone').forEach(el => el.hidden = frames.length > 1); $$('.anim-only').forEach(b => b.disabled = frames.length < 2);
  $('#tlSl').max = Math.max(0, docFrames() - 1); syncTl(); drawTlMarks();
  $('#rotScopeRow').hidden = !multi;
  $('#cropSub').textContent = multi ? 'Crop · applies to every frame' : 'Crop';
  updateFrameInfo();
  buildStrip();
}
function updateFrameInfo(){
  const d = docDelay(S.dcur); const ms = (d >= 2 ? d : 10) * 10;
  $('#frameInfo').textContent = 'Frame ' + (S.dcur + 1) + ' of ' + docFrames() + ' · ' + ms + ' ms';
}
function setFrame(i){ S.dcur = i; S.cur = i % frames.length; refreshOtherAnimated(); invalidateRefine(); if (!S.rotAll) updateRotScopeHint(); $('#frameSl').value = i; renderRect(0, 0, W, H); updateFrameInfo(); updateHud(); markThumb(); syncTl(); if (stab) drawStabGraph(); if (motionReady && S.mMode === 'plate' && !S.playing) scheduleMotion(false); updateAnimPage(); }
function play(){ if (S.playing) return; S.playing = true; $('#playBtn').innerHTML = '<i class="ic" data-ic="pause"></i>'; $('#playBtn').setAttribute('aria-label', 'Pause'); syncTl(); tick(); }
function tick(){ if (!S.playing) return; const d = docDelay(S.dcur); playT = setTimeout(() => { if (!S.playing) return; setFrame((S.dcur + 1) % docFrames()); tick(); }, (d >= 2 ? d : 10) * 10); }
function stopPlay(){ if (!S.playing) return; S.playing = false; clearTimeout(playT); $('#playBtn').innerHTML = '<i class="ic" data-ic="play"></i>'; $('#playBtn').setAttribute('aria-label', 'Play'); syncTl(); }
$('#playBtn').addEventListener('click', () => S.playing ? stopPlay() : play());
$('#frameSl').addEventListener('input', e => { stopPlay(); setFrame(+e.target.value); });
