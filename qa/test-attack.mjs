/* The two faults heard on the iPad: a held pad speaking twice, and a fast tap
   being chopped off. Both are measured off a real offline render. */
import { open, boot, report } from './harness.mjs';

const {page, errors, close} = await open();
const checks = [];
await boot(page, {waitArt: true});

const RENDER = `async ({secs, hold, art, dyn}) => {
  const D = window.__desk;
  const SR = 44100;
  const live = D.ctx, lm = D.master;
  const oc = new OfflineAudioContext(2, Math.ceil(SR*secs), SR);
  D.ctx = oc; D.buildDrift();
  D.buildChain();                       // the same graph the app plays through
  D.setHall(0);                         // measure the note, not the room
  if(dyn !== undefined) D.setDyn(dyn, 0.001);
  D.shortArt = art;
  const v = new D.Voice('strings', [50,57,62,66,69], 0.05, hold === null ? {} : {dur: hold});
  if(hold !== null) v.stop(0.05 + hold);
  const buf = await oc.startRendering();
  D.ctx = live; D.master = lm; D.buildDrift();   // the pool belongs to a context
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  // 10 ms RMS, then a 5-frame mean: detuned desks beat against each other by
  // design, and a raw short-window envelope reads that as re-articulation
  const hop = Math.round(SR*0.010), raw = [];
  for(let i=0;i+hop<L.length;i+=hop){
    let s=0; for(let k=i;k<i+hop;k++){ const m=(L[k]+R[k])*0.5; s+=m*m; }
    raw.push(Math.sqrt(s/hop));
  }
  const env = raw.map((_,i)=>{
    let s=0, n=0;
    for(let k=Math.max(0,i-2); k<=Math.min(raw.length-1,i+2); k++){ s+=raw[k]; n++; }
    return s/n;
  });
  return env;
}`;

const env = async o => page.evaluate(eval('(' + RENDER + ')'), o);

/* --- and it moves a note that is already sounding -------------------- */
const swell = await page.evaluate(async () => {
  const D = window.__desk, P = window.__probe;
  D.setDyn(0.2, 0.01);
  const v = new D.Voice('strings', [50,57,62,66,69], undefined, {dur: 3});
  const peak = async ms => { let b=0; const t=performance.now();
    while(performance.now()-t < ms){ const x=P.rms(); if(x>b) b=x; await new Promise(r=>setTimeout(r,10)); } return b; };
  await new Promise(r=>setTimeout(r, 500));
  const before = await peak(300);
  D.setDyn(0.95, 0.05);
  await new Promise(r=>setTimeout(r, 400));
  const after = await peak(300);
  v.stop(); D.setDyn(0.62, 0.01);
  return {before, after};
});
checks.push(['moving the wheel swells a chord that is already sounding',
             swell.after > swell.before*1.8,
             `${swell.before.toFixed(4)} -> ${swell.after.toFixed(4)}`]);

/* --- a held pad must speak once ------------------------------------- */
const MS = 10;                                   // one envelope frame
const held = await env({secs: 2.6, hold: 2.2, art: 'staccato'});
const dB = e => e.map(v => 20*Math.log10(Math.max(v, 1e-7)));

/* An attack is a fast rise. Beating between detuned desks is a slow one, so
   measuring the rise over 40 ms separates the two cleanly. */
function onsets(e, fromMs, toMs, thresh){
  const d = dB(e), a = Math.round(fromMs/MS), b = Math.min(d.length, Math.round(toMs/MS));
  const lift = [];
  for(let i=a;i<b;i++) lift.push(i>=4 ? d[i]-d[i-4] : 0);
  const hits = [];
  for(let i=1;i<lift.length-1;i++){
    if(lift[i] >= thresh && lift[i] >= lift[i-1] && lift[i] > lift[i+1]){
      if(!hits.length || (i - hits[hits.length-1]) * MS > 120) hits.push(i);
    }
  }
  return hits.map(i => (a+i)*MS);
}
const first = onsets(held, 0, 900, 6);
const second = onsets(held, 200, 900, 6);
console.log('  held envelope, 50 ms steps (x1000):',
  held.filter((_,i)=>i%5===0).slice(0,44).map(v=>Math.round(v*1000)).join(' '));
console.log('  onsets detected at (ms):', first.join(', ') || 'none');
checks.push(['a held pad speaks once, not twice', second.length === 0,
             second.length ? 'second attack at ' + second.join(', ') + ' ms' : '']);

/* and the bow is still there after the stroke has gone */
const med = (e, fromMs, toMs) => {
  const v = e.slice(Math.round(fromMs/MS), Math.round(toMs/MS)).slice().sort((x,y)=>x-y);
  return v.length ? v[Math.floor(v.length/2)] : 0;
};
const stroke = med(held, 120, 320), bowed = med(held, 500, 1200);
checks.push(['the bow carries on after the stroke', bowed > stroke*0.28,
             `stroke ${(stroke*1000).toFixed(1)}, held ${(bowed*1000).toFixed(1)} (x1000)`]);

/* --- and a held chord must not quietly fade out --------------------- */
const long = await env({secs: 4.0, hold: 3.6, art: 'staccato'});
const early = med(long, 600, 1200), late = med(long, 2400, 3400);
checks.push(['a chord held for three seconds does not fade away',
             late > early*0.55,
             `${(early*1000).toFixed(1)} at 1 s vs ${(late*1000).toFixed(1)} at 3 s (x1000)`]);

/* --- a fast tap must still speak in full ---------------------------- */
const tap = await env({secs: 2.0, hold: 0.025, art: 'staccato'});
const tapPeak = Math.max(...tap);
const tail = (() => {
  for(let i = tap.length-1; i >= 0; i--) if(tap[i] > tapPeak*0.05) return i*MS;
  return 0;
})();
checks.push(['a 25 ms tap still plays the whole staccato', tail > 240,
             `sounds for ${tail} ms`]);
const heldTail = (() => { for(let i=held.length-1;i>=0;i--) if(held[i] > Math.max(...held)*0.05) return i*MS; return 0; })();
checks.push(['and a tap is genuinely shorter than a held note', tail < heldTail*0.72,
             `${tail} ms vs ${heldTail} ms`]);

/* --- pizzicato rings out whatever the finger does -------------------- */
const pizzTap = await env({secs: 2.0, hold: 0.025, art: 'pizzicato'});
const pizzPeak = Math.max(...pizzTap);
const pizzTail = (() => { for(let i=pizzTap.length-1;i>=0;i--) if(pizzTap[i] > pizzPeak*0.05) return i*MS; return 0; })();
checks.push(['a flicked pizzicato rings out', pizzTail > 200, `${pizzTail} ms`]);

/* --- the wheel actually changes the sound --------------------------- */
const quiet = await env({secs: 1.2, hold: 1.0, art: 'staccato', dyn: 0.15});
const loud  = await env({secs: 1.2, hold: 1.0, art: 'staccato', dyn: 1.0});
const qp = Math.max(...quiet), lp = Math.max(...loud);
const spanDb = 20*Math.log10(lp/qp);
checks.push([`the wheel spans ${spanDb.toFixed(1)} dB from pp to ff`, spanDb > 7 && spanDb < 26,
             `pp ${qp.toFixed(4)} vs ff ${lp.toFixed(4)}`]);

const hard = errors.filter(e => !/404|ERR_TUNNEL|fonts.googleapis|Failed to load resource/.test(e));
checks.push(['no page errors', hard.length === 0, hard.slice(0,3).join(' | ')]);
await close();
process.exit(report('test-attack', checks) ? 1 : 0);
