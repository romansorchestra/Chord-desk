/* Pads, ribbon, record and playback, the exports, no stuck notes, and
   "play as written" following the written durations. */
import { open, boot, report } from './harness.mjs';

const {page, errors, close} = await open();
const checks = [];
await boot(page, {waitArt: true});
const wait = ms => page.waitForTimeout(ms);

/* --- pads match the bank, and pressing one lights its ribbon notehead --- */
const grid = await page.evaluate(() => ({
  pads: document.querySelectorAll('.pad').length,
  slots: __desk.piece.bars.length,
  heads: document.querySelectorAll('#ribbon ellipse').length
}));
checks.push(['a pad for every chord slot', grid.pads === grid.slots, `${grid.pads}/${grid.slots}`]);
checks.push(['a ribbon notehead for every slot', grid.heads === grid.slots, `${grid.heads}/${grid.slots}`]);

const lit = await page.evaluate(async () => {
  __desk.padOn(3);
  const on = document.querySelectorAll('.pad')[3].classList.contains('on');
  const head = document.querySelector('#rb3 ellipse').getAttribute('fill');
  __desk.padOff(3, true);
  await new Promise(r=>setTimeout(r,60));
  return {on, head, off: !document.querySelectorAll('.pad')[3].classList.contains('on'),
          headOff: document.querySelector('#rb3 ellipse').getAttribute('fill')};
});
checks.push(['a press lights the pad and its notehead', lit.on && lit.head === '#A8322A', lit.head]);
checks.push(['a release puts both back', lit.off && lit.headOff === '#16181C', lit.headOff]);

/* --- multi-touch: several pads at once, all released cleanly --- */
const multi = await page.evaluate(async () => {
  [0,2,5,7].forEach(i => __desk.padOn(i));
  const held = __desk.live.size;
  [0,2,5,7].forEach(i => __desk.padOff(i, true));
  await new Promise(r=>setTimeout(r, 2600));
  return {held, left: __desk.live.size,
          stillOn: document.querySelectorAll('.pad.on').length};
});
checks.push(['four pads sound at once', multi.held === 4, String(multi.held)]);
checks.push(['and none is left hanging', multi.left === 0 && multi.stillOn === 0,
             `${multi.left} live, ${multi.stillOn} lit`]);
const quiet = await page.evaluate(() => window.__probe.rms());
checks.push(['the desk falls silent afterwards', quiet < 0.002, quiet.toFixed(5)]);

/* --- hold latch --- */
const latch = await page.evaluate(async () => {
  document.getElementById('holdBtn').click();
  __desk.padOn(1);
  await new Promise(r=>setTimeout(r,120));
  const afterRelease = (__desk.padOff(1), __desk.live.size);   // padOff is a no-op while latched
  __desk.padOn(4);                                             // latch swaps to the new chord
  await new Promise(r=>setTimeout(r,120));
  const swapped = Array.from(__desk.live.keys());
  document.getElementById('holdBtn').click();
  __desk.allOff();
  await new Promise(r=>setTimeout(r,1600));
  return {afterRelease, swapped, left: __desk.live.size};
});
checks.push(['hold latches a chord past the release', latch.afterRelease === 1, String(latch.afterRelease)]);
checks.push(['and the next pad replaces it', latch.swapped.join() === '4', latch.swapped.join()]);
checks.push(['turning hold off clears everything', latch.left === 0]);

/* --- record a take, then play it back --- */
const rec = await page.evaluate(async () => {
  document.getElementById('recBtn').click();
  for(const i of [0,1,2]){
    __desk.padOn(i);
    await new Promise(r=>setTimeout(r,160));
    __desk.padOff(i, true);
    await new Promise(r=>setTimeout(r,90));
  }
  document.getElementById('recBtn').click();
  const take = __desk.take.map(e=>({bar:e.bar, n:e.notes.length, t:+e.t.toFixed(3), d:+(e.dur||0).toFixed(3)}));
  return {take, buttons: {play: !document.getElementById('playBtn').disabled,
                          midi: !document.getElementById('midiBtn').disabled,
                          xml:  !document.getElementById('xmlBtn').disabled}};
});
checks.push(['three chords were recorded', rec.take.length === 3, JSON.stringify(rec.take)]);
checks.push(['each has a positive duration', rec.take.every(e => e.d > 0.05)]);
checks.push(['the take rises in time', rec.take.every((e,i)=> i===0 || e.t > rec.take[i-1].t)]);
checks.push(['play, MIDI and MusicXML all came alive',
             rec.buttons.play && rec.buttons.midi && rec.buttons.xml, JSON.stringify(rec.buttons)]);

const playback = await page.evaluate(async () => {
  const seen = new Set();
  document.getElementById('playBtn').click();
  const t0 = performance.now();
  while(performance.now() - t0 < 2400){
    document.querySelectorAll('.pad.on').forEach(p => seen.add(p.dataset.i));
    await new Promise(r=>setTimeout(r, 25));
  }
  return {seen: Array.from(seen).sort(), label: document.getElementById('playBtn').textContent};
});
checks.push(['playing the take lights the same pads back up',
             ['0','1','2'].every(i => playback.seen.includes(i)), playback.seen.join()]);
await wait(1600);

/* --- the exports produce real files --- */
const files = await page.evaluate(async () => {
  const grabbed = [];
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){ grabbed.push(this.download); };
  const realCreate = URL.createObjectURL;
  const sizes = [];
  URL.createObjectURL = function(b){ sizes.push({type:b.type, size:b.size}); return realCreate.call(URL, b); };
  document.getElementById('midiBtn').click();
  document.getElementById('xmlBtn').click();
  await new Promise(r=>setTimeout(r,120));
  HTMLAnchorElement.prototype.click = realClick;
  URL.createObjectURL = realCreate;
  return {grabbed, sizes};
});
checks.push(['a MIDI file is written', files.grabbed.some(n=>/\.mid$/.test(n)), files.grabbed.join()]);
checks.push(['a MusicXML file is written', files.grabbed.some(n=>/\.(xml|musicxml)$/.test(n)), files.grabbed.join()]);
checks.push(['neither is empty', files.sizes.length === 2 && files.sizes.every(s=>s.size > 120),
             JSON.stringify(files.sizes)]);

/* --- play as written follows the written durations --- */
const written = await page.evaluate(async () => {
  __desk.take = [];
  document.getElementById('bpm').value = '150';
  const bars = __desk.piece.bars;
  const spq = 60/150;
  const marks = [];
  const t0 = performance.now();
  document.getElementById('asWrittenBtn').click();
  let last = null;
  while(performance.now() - t0 < 5200){
    const on = document.querySelector('.pad.on');
    const i = on ? +on.dataset.i : null;
    if(i !== null && i !== last){ marks.push({i, t:(performance.now()-t0)/1000}); last = i; }
    await new Promise(r=>setTimeout(r, 8));
  }
  document.getElementById('asWrittenBtn').click();
  const expected = [];
  let t = 0;
  for(let k=0;k<bars.length;k++){ expected.push({i:k, t}); t += (bars[k][1]||1)*spq; if(t > 5.2) break; }
  return {marks, expected};
});
const pairs = written.marks.map(m => {
  const e = written.expected.find(x => x.i === m.i);
  return e ? Math.abs(m.t - e.t) : null;
}).filter(v => v !== null);
const worst = pairs.length ? Math.max(...pairs) : 99;
checks.push(['play as written walks the bank in order',
             written.marks.length > 3 && written.marks.every((m,i)=> i===0 || m.i > written.marks[i-1].i),
             written.marks.slice(0,6).map(m=>m.i).join('>')]);
checks.push(['and lands on the written durations', worst < 0.12,
             `worst drift ${worst.toFixed(3)}s over ${pairs.length} chords`]);

await wait(900);
const end = await page.evaluate(() => ({live: __desk.live.size, rms: window.__probe.rms()}));
checks.push(['nothing is left sounding at the end', end.live === 0 && end.rms < 0.004,
             `${end.live} live, rms ${end.rms.toFixed(5)}`]);

const hard = errors.filter(e => !/404|ERR_TUNNEL|fonts.googleapis|Failed to load resource/.test(e));
checks.push(['no page errors', hard.length === 0, hard.slice(0,3).join(' | ')]);
await close();
process.exit(report('test-play', checks) ? 1 : 0);
