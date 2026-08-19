/* Every chord in every bank orchestrates into playable section ranges,
   for every ensemble and every articulation.  Reports worst pitch stretch. */
import { open, boot, report } from './harness.mjs';

const {page, errors, close} = await open();
const checks = [];
await boot(page, {});

const res = await page.evaluate(() => {
  const D = window.__desk;
  const pitchesOf = (key, art) => {
    const s = D.slotsFor(key, art);
    return s ? Array.from(new Set(s.notes.map(n=>n.m))).sort((a,b)=>a-b) : null;
  };
  const cache = {};
  const nearest = (key, art, m) => {
    const id = key+'|'+art;
    const ps = cache[id] || (cache[id] = pitchesOf(key, art) || pitchesOf(key, 'sustain'));
    let best = Infinity;
    for(const p of ps){ const d = Math.abs(p-m); if(d < best) best = d; }
    return best;
  };
  const out = {chords: 0, assignments: 0, dropped: [], worst: 0, worstAt: null,
               byArt: {}, hist: {}};
  const fams = Object.keys(D.FAMILIES);
  for(const famName of fams){
    const fam = D.FAMILIES[famName];
    const arts = ['sustain'].concat(fam.shorts || [], fam.tremolo ? ['tremolo'] : []);
    for(const art of arts){
      out.byArt[famName+'/'+art] = {worst: 0, chords: 0, dropped: 0};
      const slot = out.byArt[famName+'/'+art];
      for(const piece of D.PIECES){
        for(const bar of piece.bars){
          const notes = bar[2];
          const plan = D.orchestrate(famName, notes, art);
          slot.chords++;
          if(art === 'sustain' && famName === fams[0]) out.chords++;
          if(!plan.length || plan.length < notes.length){
            slot.dropped++;
            if(out.dropped.length < 8)
              out.dropped.push({fam:famName, art, piece:piece.id, notes, got:plan.length});
            continue;
          }
          for(const p of plan){
            out.assignments++;
            const d = nearest(p.section.key, art, p.midi);
            const k = String(d);
            out.hist[k] = (out.hist[k]||0) + 1;
            if(d > slot.worst) slot.worst = d;
            if(d > out.worst){ out.worst = d; out.worstAt = {fam:famName, art, sec:p.section.key,
                                                            midi:p.midi, piece:piece.id}; }
          }
        }
      }
    }
  }
  return out;
});

checks.push([`every chord orchestrated (${res.assignments.toLocaleString()} note assignments across ` +
             `${res.chords.toLocaleString()} chords)`, res.dropped.length === 0,
             res.dropped.slice(0,3).map(d=>`${d.fam}/${d.art} ${d.piece}`).join('; ')]);
checks.push([`worst pitch stretch ${res.worst} semitone(s)`, res.worst <= 2,
             res.worstAt ? `${res.worstAt.fam}/${res.worstAt.art} ${res.worstAt.sec} at ${res.worstAt.midi}` : '']);
const perArt = Object.entries(res.byArt).filter(([,v]) => v.worst > 2);
checks.push(['no articulation is worse than 2 semitones', perArt.length === 0,
             perArt.map(([k,v])=>`${k}:${v.worst}`).join(' ')]);
const total = Object.values(res.hist).reduce((a,b)=>a+b,0);
const exact = (res.hist['0']||0) / total;
checks.push([`${(exact*100).toFixed(1)}% of notes play a sample at its own pitch`, exact > 0.3]);
console.log('  stretch histogram (semitones):',
            Object.entries(res.hist).sort((a,b)=>+a[0]-+b[0])
              .map(([k,v])=>`${k}:${(100*v/total).toFixed(1)}%`).join('  '));
console.log('  per articulation:',
            Object.entries(res.byArt).map(([k,v])=>`${k}=${v.worst}`).join(' '));

const hard = errors.filter(e => !/404|ERR_TUNNEL|fonts.googleapis|Failed to load resource/.test(e));
checks.push(['no page errors', hard.length === 0, hard.slice(0,3).join(' | ')]);
await close();
process.exit(report('test-sections', checks) ? 1 : 0);
