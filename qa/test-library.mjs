/* The companion bank file: does it arrive, merge, and stay optional? */
import { open, boot, report } from './harness.mjs';
const checks = [];

{
  const {page, errors, close} = await open();
  await boot(page, {});
  await page.waitForFunction(() => window.__desk.PIECES.length > 300, null, {timeout: 60000});
  const info = await page.evaluate(() => {
    const D = window.__desk;
    const comps = {}; D.PIECES.forEach(p => comps[p.composer] = (comps[p.composer]||0)+1);
    return {n: D.PIECES.length, composers: Object.keys(comps).length,
            slots: D.PIECES.reduce((a,p)=>a+p.bars.length, 0),
            wanted: ['Maurice Ravel','Richard Wagner','Richard Strauss','Gustav Mahler',
                     'Sergei Rachmaninoff','Béla Bartók','Erik Satie','Anton Webern']
                    .map(c => [c, comps[c]||0]),
            keyed: D.PIECES.filter(p=>p.key).length,
            titled: D.PIECES.filter(p=>/_{1,}|\.mxl$|\.tsv/.test(p.title)).length,
            sorted: D.PIECES.every((p,i)=> i===0 || (D.PIECES[i-1].composer||'').localeCompare(p.composer||'') <= 0),
            dupes: D.PIECES.length - new Set(D.PIECES.map(p=>p.id)).size};
  });
  console.log('  ' + info.n + ' banks, ' + info.composers + ' composers, ' +
              info.slots.toLocaleString() + ' slots');
  console.log('  ' + info.wanted.map(([c,n])=>`${c} ${n}`).join(', '));
  checks.push([`the extra banks merge (${info.n} total)`, info.n > 900, String(info.n)]);
  checks.push([`${info.composers} composers`, info.composers > 60]);
  checks.push(['Ravel, Wagner and Strauss are all in', info.wanted.every(([,n]) => n > 0),
               info.wanted.filter(([,n])=>!n).map(([c])=>c).join(', ') || 'all present']);
  checks.push(['no duplicate banks', info.dupes === 0, String(info.dupes)]);
  checks.push(['grouped by composer', info.sorted]);
  checks.push([`${info.keyed} of ${info.n} banks carry a key`, info.keyed > info.n*0.9]);
  checks.push(['no raw filenames left in titles', info.titled === 0, String(info.titled)]);

  const play = await page.evaluate(async () => {
    const D = window.__desk;
    const ravel = D.PIECES.find(p => p.composer === 'Maurice Ravel');
    D.piece = ravel; D.renderWork(); D.renderPads(); D.renderRibbon();
    D.padOn(0);
    let heard = 0;
    for(let i=0;i<70;i++){ await new Promise(r=>setTimeout(r, 12));
                           const v = window.__probe.rms(); if(v > heard) heard = v; }
    D.padOff(0, true);
    return {title: ravel.title, key: ravel.key, slots: ravel.bars.length,
            pads: document.querySelectorAll('.pad').length, heard};
  });
  checks.push([`a Ravel bank loads and sounds (${play.title}, ${play.key}, ${play.slots} slots)`,
               play.pads === play.slots && play.heard > 0.003, 'rms ' + play.heard.toFixed(4)]);
  const hard = errors.filter(e => !/404|ERR_TUNNEL|fonts.googleapis|Failed to load resource/.test(e));
  checks.push(['no page errors', hard.length === 0, hard.slice(0,2).join(' | ')]);
  await close();
}

/* --- and the desk still works when the companion file never arrives --- */
{
  const {page, close} = await open({offline: true});
  await boot(page, {});
  const n = await page.evaluate(() => window.__desk.PIECES.length);
  const ok = await page.evaluate(async () => {
    window.__desk.padOn(0);
    await new Promise(r=>setTimeout(r, 150));
    const live = window.__desk.live.size;
    window.__desk.allOff();
    return live;
  });
  checks.push(['with the network gone it falls back to the inline banks', n === 248, String(n)]);
  checks.push(['and still plays', ok === 1]);
  await close();
}
process.exit(report('test-library', checks) ? 1 : 0);
