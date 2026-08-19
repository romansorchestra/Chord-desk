/* The responsive grid: does it light the pads a musician would reach for? */
import { open, boot, report } from './harness.mjs';

const {page, errors, close} = await open();
const checks = [];
await boot(page, {full: true});

/* --- the scoring itself, on chords whose answer is not in doubt --- */
const sane = await page.evaluate(() => {
  const D = window.__desk;
  const C  = [48,52,55,60,64];        // C major
  const cases = {
    'G major (dominant)':      [47,50,55,62,67],
    'F major (subdominant)':   [41,53,57,60,65],
    'A minor (relative)':      [45,52,57,60,64],
    'E major (chromatic med)': [40,52,56,59,64],
    'F# major (tritone)':      [42,54,58,61,66],
    'Db major (Neapolitan)':   [37,49,53,56,61]
  };
  const out = {};
  for(const k in cases){
    D.setGuideMode('lead');
    const lead = D.guideScore(C, cases[k]);
    D.setGuideMode('surprise');
    const surp = D.guideScore(C, cases[k]);
    out[k] = {lead:+lead.toFixed(3), surprise:+surp.toFixed(3),
              motion:+D.voiceMotion(C.slice().sort((a,b)=>a-b), cases[k].slice().sort((a,b)=>a-b)).toFixed(2)};
  }
  D.setGuideMode('lead');
  return out;
});
console.log('  from C major:');
for(const k in sane) console.log(`    ${k.padEnd(26)} motion ${String(sane[k].motion).padStart(5)}  lead ${sane[k].lead}  surprise ${sane[k].surprise}`);

checks.push(['the dominant leads better than the tritone',
             sane['G major (dominant)'].lead > sane['F# major (tritone)'].lead]);
checks.push(['the subdominant leads better than the Neapolitan',
             sane['F major (subdominant)'].lead > sane['Db major (Neapolitan)'].lead]);
checks.push(['the relative minor leads well (three common tones)',
             sane['A minor (relative)'].lead > 0.6, String(sane['A minor (relative)'].lead)]);
checks.push(['surprise mode prefers the chromatic mediant to the dominant',
             sane['E major (chromatic med)'].surprise > sane['G major (dominant)'].surprise,
             `${sane['E major (chromatic med)'].surprise} vs ${sane['G major (dominant)'].surprise}`]);
checks.push(['and prefers it to the relative minor, which is no surprise at all',
             sane['E major (chromatic med)'].surprise > sane['A minor (relative)'].surprise,
             `${sane['E major (chromatic med)'].surprise} vs ${sane['A minor (relative)'].surprise}`]);
checks.push(['and the two modes disagree, which is the point',
             sane['E major (chromatic med)'].lead < sane['G major (dominant)'].lead]);

/* --- and it actually paints --- */
const paint = await page.evaluate(async () => {
  const D = window.__desk;
  D.setGuideMode('lead');
  D.padOn(0);
  await new Promise(r=>requestAnimationFrame(r));
  await new Promise(r=>setTimeout(r, 60));
  const n = s => document.querySelectorAll('.pad.'+s).length;
  const lit = {g2:n('g2'), g1:n('g1'), gd:n('gd'), pads:document.querySelectorAll('.pad').length};
  const selfLit = document.querySelectorAll('.pad')[0].className;
  D.padOff(0, true);
  await new Promise(r=>setTimeout(r, 40));
  D.setGuideMode('off');
  await new Promise(r=>setTimeout(r, 40));
  const off = n('g2') + n('g1') + n('gd');
  D.setGuideMode('lead');
  return {lit, selfLit, off};
});
checks.push(['pressing a pad lights the grid',
             paint.lit.g2 > 3 && paint.lit.g1 > 3 && paint.lit.gd > 5,
             `${paint.lit.g2} strong, ${paint.lit.g1} mild, ${paint.lit.gd} dimmed of ${paint.lit.pads}`]);
checks.push(['about a tenth are marked strongly',
             paint.lit.g2 <= Math.ceil(paint.lit.pads*0.2),
             `${paint.lit.g2}/${paint.lit.pads}`]);
checks.push(['the sounding pad is not itself marked', !/\bg[12d]\b/.test(paint.selfLit), paint.selfLit]);
checks.push(['turning the guide off clears the grid', paint.off === 0, String(paint.off)]);

/* --- two hands read as one sonority --- */
const two = await page.evaluate(async () => {
  const D = window.__desk;
  D.padOn(2); D.padOn(5);
  await new Promise(r=>setTimeout(r, 80));
  const from = D.guideFrom ? D.guideFrom.slice() : [];
  const want = Array.from(new Set([...D.piece.bars[2][2], ...D.piece.bars[5][2]])).sort((a,b)=>a-b);
  D.allOff();
  return {from, want};
});
checks.push(['two pads down are measured as one sonority',
             two.from.join() === two.want.join(), `${two.from.length} notes`]);

/* --- every bank scores without blowing up --- */
const sweep = await page.evaluate(() => {
  const D = window.__desk;
  let n = 0, bad = 0, worst = 0;
  for(const p of D.PIECES){
    const from = p.bars[0][2];
    for(const b of p.bars){
      const v = D.guideScore(from, b[2]);
      n++;
      if(!isFinite(v) || v < -0.001 || v > 2) bad++;
      if(v > worst) worst = v;
    }
  }
  return {n, bad, worst:+worst.toFixed(3)};
});
checks.push([`every one of ${sweep.n.toLocaleString()} slots scores cleanly`,
             sweep.bad === 0, `worst ${sweep.worst}`]);

const hard = errors.filter(e => !/404|ERR_TUNNEL|fonts.googleapis|Failed to load resource/.test(e));
checks.push(['no page errors', hard.length === 0, hard.slice(0,3).join(' | ')]);
await close();
process.exit(report('test-guide', checks) ? 1 : 0);
