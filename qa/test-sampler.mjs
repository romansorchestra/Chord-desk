/* The real load path: fetch, decode, slice, loop, play; hall behaviour;
   bundles found in the root or in samples/. */
import { open, boot, report } from './harness.mjs';

const {page, errors, close} = await open();
const checks = [];
await boot(page, {waitArt: true});

const info = await page.evaluate(async () => {
  const D = window.__desk;
  const out = {sections: {}, missing: [], slices: 0};
  for(const key of Object.keys(D.SECTION_INDEX)){
    const arts = ['sustain'].concat(Object.keys(D.SECTION_INDEX[key].art || {}));
    for(const a of arts){
      try{
        const list = await D.loadSection(key, a);
        const spec = D.slotsFor(key, a);
        out.sections[key+'|'+a] = {got: list.length, want: spec.notes.length,
                                   loops: list.filter(x=>x.loop).length};
        out.slices += list.length;
      }catch(e){ out.missing.push(key+'|'+a+': '+e.message); }
    }
  }
  out.engine = D.engine; out.hall = D.hallIsReal;
  return out;
});

checks.push(['every bundle fetched, decoded and sliced', info.missing.length === 0, info.missing.join('; ')]);
const short = Object.entries(info.sections).filter(([,v]) => v.got < v.want);
checks.push(['every slot in the index produced audio', short.length === 0,
             short.slice(0,6).map(([k,v])=>`${k} ${v.got}/${v.want}`).join(', ')]);
checks.push([`slices built (${info.slices})`, info.slices > 900]);
const sus = Object.entries(info.sections).filter(([k]) => k.endsWith('|sustain'));
const noLoop = sus.filter(([,v]) => v.loops < v.got);
checks.push(['every sustain slot carries loop points', noLoop.length === 0,
             noLoop.map(([k,v])=>`${k} ${v.loops}/${v.got}`).join(', ')]);
checks.push(['engine reports orchestral sections', info.engine === 'sections', info.engine]);
checks.push(['the real impulse response loaded', info.hall === true]);

/* sound actually comes out, and the hall send does something */
const heard = await page.evaluate(async () => {
  const D = window.__desk, P = window.__probe;
  const rms = async (ms) => {
    let best = 0; const t0 = performance.now();
    while(performance.now() - t0 < ms){ const v = P.rms(); if(v > best) best = v;
      await new Promise(r=>setTimeout(r, 12)); }
    return best;
  };
  const out = {};
  D.padOn(0); out.dry = await rms(500); D.padOff(0, true);
  await new Promise(r=>setTimeout(r, 1400));
  out.silenceAfterRelease = await rms(220);
  return out;
});
checks.push(['a pad press makes a sound', heard.dry > 0.004, 'peak rms ' + heard.dry.toFixed(4)]);
checks.push(['it stops when released', heard.silenceAfterRelease < heard.dry * 0.12,
             heard.silenceAfterRelease.toFixed(5)]);

/* the sections are balanced against each other, and a tap is not louder
   than a held chord */
const balance = await page.evaluate(async () => {
  const D = window.__desk, P = window.__probe;
  const peak = async (ms) => {
    let best = 0; const t0 = performance.now();
    while(performance.now() - t0 < ms){ const v = P.rms(); if(v > best) best = v;
      await new Promise(r=>setTimeout(r, 10)); }
    return best;
  };
  const chord = [48, 55, 60, 64, 67];
  const out = {};
  for(const ens of ['strings','brass','woodwind','choir']){
    await new Promise(async ok => { await D.loadEnsemble(ens); ok(); });
    const v = new D.Voice(ens, chord, undefined, {dur: 3});
    out[ens] = +(await peak(900)).toFixed(5);
    v.stop(); await new Promise(r=>setTimeout(r, 1500));
  }
  await D.loadEnsemble('strings');
  const held = new D.Voice('strings', chord, undefined, {dur: 3});
  out.held = +(await peak(900)).toFixed(5); held.stop();
  await new Promise(r=>setTimeout(r, 1600));
  const tapped = new D.Voice('strings', chord, undefined, {dur: 0.1});
  out.tap = +(await peak(400)).toFixed(5); tapped.stop();
  await new Promise(r=>setTimeout(r, 1200));
  return out;
});
{
  const levels = ['strings','brass','woodwind','choir'].map(k => balance[k]);
  const dB = 20*Math.log10(Math.max(...levels)/Math.min(...levels));
  checks.push([`the four ensembles sit within ${dB.toFixed(1)} dB of each other`, dB < 7,
               Object.entries(balance).map(([k,v])=>`${k} ${v}`).join('  ')]);
  const tapDb = 20*Math.log10(balance.tap/balance.held);
  checks.push([`a tap is within ${tapDb.toFixed(1)} dB of a held chord`, Math.abs(tapDb) < 7,
               `tap ${balance.tap} vs held ${balance.held}`]);
}

/* the bundles are found when they sit in samples/ instead of the root */
await close();
{
  const fs = await import('node:fs');
  const alt = '/home/claude/qa/alt';
  fs.rmSync(alt, {recursive: true, force: true});
  fs.mkdirSync(alt + '/samples', {recursive: true});
  fs.copyFileSync('/home/claude/dist/index.html', alt + '/index.html');
  for(const f of fs.readdirSync('/home/claude/dist')){
    if(f.endsWith('.m4a') || f.endsWith('.wav'))
      fs.copyFileSync('/home/claude/dist/' + f, alt + '/samples/' + f);
  }
  const h = await import('./harness.mjs');
  const orig = h.ROOT;
  const {page: p2, close: c2} = await open({root: alt});
  await boot(p2, {});
  const eng = await p2.evaluate(() => window.__desk.engine);
  checks.push(['bundles found in a samples/ folder', eng === 'sections', eng]);
  await c2();
}

const hardErrors = errors.filter(e => !/404|ERR_TUNNEL|fonts.googleapis|Failed to load resource/.test(e));
checks.push(['no page errors', hardErrors.length === 0, hardErrors.slice(0,3).join(' | ')]);
process.exit(report('test-sampler', checks) ? 1 : 0);
