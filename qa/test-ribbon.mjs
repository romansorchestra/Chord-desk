/* Every bank's bass-line ribbon fits its box at phone and iPad widths,
   and the pad grid always matches the slot count. */
import { open, boot, report } from './harness.mjs';

const WIDTHS = [{name:'phone', w:390, h:844}, {name:'iPad', w:1024, h:768}, {name:'iPad landscape', w:1180, h:820}];
const checks = [];
const {page, errors, close} = await open();
await boot(page, {full: true});

for(const {name, w, h} of WIDTHS){
  await page.setViewportSize({width:w, height:h});
  await page.evaluate(() => { window.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(120);
  const r = await page.evaluate(() => {
    const D = window.__desk;
    const bad = [], padBad = [];
    let maxOver = 0, worst = null;
    for(let i=0;i<D.PIECES.length;i++){
      D.piece = D.PIECES[i];
      D.renderWork(); D.renderPads(); D.renderRibbon();
      const svg = document.getElementById('ribbon');
      const box = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const heads = svg.querySelectorAll('ellipse');
      const slots = D.piece.bars.length;
      if(heads.length !== slots) padBad.push({id:D.piece.id, heads:heads.length, slots});
      if(document.querySelectorAll('.pad').length !== slots)
        padBad.push({id:D.piece.id, pads:document.querySelectorAll('.pad').length, slots});
      // every notehead has to sit inside the drawn stave box
      let over = 0;
      heads.forEach(e=>{
        const cx = +e.getAttribute('cx'), cy = +e.getAttribute('cy');
        const rx = +e.getAttribute('rx'), ry = +e.getAttribute('ry');
        over = Math.max(over, (cx+rx) - vb.width, -(cx-rx),
                              (cy+ry) - vb.height, -(cy-ry));
      });
      if(over > 0.5){ bad.push({id:D.piece.id, over:+over.toFixed(1)}); }
      if(over > maxOver){ maxOver = over; worst = D.piece.id; }
      if(box.width < 100) bad.push({id:D.piece.id, boxWidth:box.width});
    }
    return {bad, padBad, maxOver:+maxOver.toFixed(2), worst, n:D.PIECES.length};
  });
  checks.push([`${name} (${w}px): all ${r.n} ribbons fit their box`, r.bad.length === 0,
               r.bad.slice(0,3).map(b=>`${b.id} over ${b.over}`).join('; ') +
               ` (worst overflow ${r.maxOver} on ${r.worst})`]);
  checks.push([`${name}: pad grid and ribbon match the slot count`, r.padBad.length === 0,
               r.padBad.slice(0,3).map(b=>JSON.stringify(b)).join('; ')]);
}

const hard = errors.filter(e => !/404|ERR_TUNNEL|fonts.googleapis|Failed to load resource/.test(e));
checks.push(['no page errors', hard.length === 0, hard.slice(0,3).join(' | ')]);
await close();
process.exit(report('test-ribbon', checks) ? 1 : 0);
