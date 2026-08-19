/* With the network fully blocked, every chord slot in every bank still sounds
   on every ensemble.  The structural sweep is exhaustive; a stratified sample
   is additionally listened to and measured. */
import { open, boot, report } from './harness.mjs';

const checks = [];
const {page, errors, close} = await open({offline: true});
await boot(page, {});
checks.push(['the built-in tone engine takes over when nothing can be fetched',
             (await page.evaluate(() => __desk.engine)) === 'synth']);
checks.push(['the page still opened', await page.evaluate(() =>
             document.querySelector('#veil').classList.contains('hidden'))]);

const newCtx = async () => page.evaluate(async () => {
  const D = window.__desk;
  if(D.ctx && D.ctx.close && D.ctx.state !== 'closed'){ try{ await D.ctx.close(); }catch(e){} }
  D.ctx = new (window.AudioContext||window.webkitAudioContext)();
  D.buildDrift();
  D.master = D.ctx.createGain(); D.master.gain.value = 0.85;
  D.master.connect(D.ctx.destination);
  const an = D.ctx.createAnalyser(); an.fftSize = 2048;
  D.master.connect(an);
  const buf = new Float32Array(an.fftSize);
  window.__probe2 = {rms(){ an.getFloatTimeDomainData(buf);
    let s=0; for(let i=0;i<buf.length;i++) s+=buf[i]*buf[i];
    return Math.sqrt(s/buf.length); }};
});

/* ---- exhaustive: every ensemble x every slot builds a sounding voice ---- */
const t0 = Date.now();
let cursor = {ens: 0, piece: 0, bar: 0};
let total = 0, silent = [], badPitch = [];
for(;;){
  await newCtx();                       // headless contexts never reclaim stopped nodes
  const r = await page.evaluate(async (cur) => {
    const D = window.__desk;
    const ens = Object.keys(D.ENSEMBLES);
    const out = {done: 0, silent: [], badPitch: [], cur: {...cur}, finished: false};
    while(out.done < 2000){
      if(out.cur.ens >= ens.length){ out.finished = true; break; }
      const e = ens[out.cur.ens];
      const p = D.PIECES[out.cur.piece];
      const notes = p.bars[out.cur.bar][2];
      if(notes.some(n => typeof n !== 'number' || n < 12 || n > 108))
        out.badPitch.push({ens:e, piece:p.id, notes});
      const v = new D.Voice(e, notes, undefined, {dur: 0.5});
      const parts = v.legacy ? v.legacy.parts.length
                             : v.layers.reduce((a,l)=>a+l.parts.length, 0);
      if(!parts && out.silent.length < 20)
        out.silent.push({ens:e, piece:p.id, bar:out.cur.bar, notes});
      v.stop(D.ctx.currentTime);
      out.done++;
      out.cur.bar++;
      if(out.cur.bar >= p.bars.length){ out.cur.bar = 0; out.cur.piece++; }
      if(out.cur.piece >= D.PIECES.length){ out.cur.piece = 0; out.cur.ens++; }
    }
    return out;
  }, cursor);
  total += r.done; silent = silent.concat(r.silent); badPitch = badPitch.concat(r.badPitch);
  cursor = r.cur;
  process.stdout.write(`\r  swept ${total.toLocaleString()} slot x ensemble combinations…   `);
  if(r.finished) break;
}
process.stdout.write('\n');
checks.push([`every one of ${total.toLocaleString()} slot x ensemble combinations sounds`,
             silent.length === 0,
             silent.slice(0,3).map(s=>`${s.ens} ${s.piece} bar ${s.bar}`).join('; ') +
             ` (${((Date.now()-t0)/1000).toFixed(0)}s)`]);
checks.push(['every stored pitch is a real MIDI note', badPitch.length === 0,
             badPitch.slice(0,3).map(b=>JSON.stringify(b.notes)).join('; ')]);

/* ---- and a stratified sample is actually listened to ---- */
await newCtx();
// wake the graph up: the first voice after a context is created renders
// nothing measurable until the audio thread has actually started
await page.evaluate(async () => {
  const D = window.__desk;
  const v = new D.Voice('strings', [60,64,67], undefined, {dur: 0.5});
  await new Promise(r=>setTimeout(r, 700));
  v.stop();
  await new Promise(r=>setTimeout(r, 400));
});
const quiet = [];
let listened = 0;
const STEP = 6;
for(let pi = 0; pi < 248; pi += STEP){
  const r = await page.evaluate(async ({pi, ei}) => {
    const D = window.__desk;
    const ens = Object.keys(D.ENSEMBLES)[ei];
    const p = D.PIECES[pi];
    const out = [];
    for(const bi of [0, Math.floor(p.bars.length/2), p.bars.length-1]){
      const v = new D.Voice(ens, p.bars[bi][2], undefined, {dur: 0.5});
      // long enough for the slowest attack in the set (the chorus, 0.2 s)
      let best = 0; const t = performance.now();
      while(performance.now() - t < 420){
        const x = window.__probe2.rms(); if(x > best) best = x;
        await new Promise(r=>setTimeout(r, 10));
      }
      v.stop();
      out.push({ens, piece: p.id, bi, rms: +best.toFixed(5)});
      await new Promise(r=>setTimeout(r, 60));
    }
    return out;
  }, {pi, ei: (pi/STEP) % 5});
  r.forEach(x => { listened++; if(x.rms < 0.0008) quiet.push(x); });
}
checks.push([`${listened} chords listened to, ensembles rotated — all audible`,
             quiet.length === 0,
             quiet.slice(0,4).map(q=>`${q.ens} ${q.piece} slot ${q.bi} rms ${q.rms}`).join('; ')]);
console.log(`  coverage: structure exhaustive (${total.toLocaleString()}); ` +
            `audio measured on ${listened} chords (every ${STEP}th bank, first/middle/last slot)`);

const hard = errors.filter(e => !/404|ERR_TUNNEL|ERR_FAILED|fonts.googleapis|Failed to load resource|net::/.test(e));
checks.push(['no page errors with the network gone', hard.length === 0, hard.slice(0,3).join(' | ')]);
await close();
process.exit(report('test-offline', checks) ? 1 : 0);
