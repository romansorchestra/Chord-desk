import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const ROOT = '/home/claude/dist';

const MIME = {'.html':'text/html','.m4a':'audio/mp4','.wav':'audio/wav','.json':'application/json','.webm':'audio/webm'};

/* The page runs in strict mode, so its top-level `let`s are not on `window`.
   The harness injects a read-only hook when it serves the page, so the
   shipped file stays clean. */
const HOOK = `
window.__desk = {
  get ctx(){return ctx}, set ctx(v){ctx=v},
  get master(){return master}, set master(v){master=v},
  get wet(){return wet}, set wet(v){wet=v},
  get engine(){return engine}, set engine(v){engine=v},
  get driftPool(){return driftPool},
  buildDrift, makeModelledHall,
  get hallIsReal(){return hallIsReal}, get sectionBuffers(){return sectionBuffers},
  get decodedBundles(){return decodedBundles},
  get FAMILIES(){return FAMILIES}, get SECTION_INDEX(){return SECTION_INDEX},
  get ENSEMBLES(){return ENSEMBLES},
  get ensName(){return ensName}, get live(){return live},
  get PIECES(){return PIECES}, get piece(){return piece},
  set piece(v){piece=v},
  get take(){return take}, set take(v){take=v},
  get shortArt(){return shortArt}, set shortArt(v){shortArt=v},
  get hold(){return hold},
  get loadedFamilies(){return loadedFamilies},
  padOn, padOff, allOff, Voice, orchestrate, sectionRange, slotsFor,
  loadEnsemble, loadSection, renderPads, renderRibbon, renderWork, buildSelects,
  midiBlob: (typeof buildMidi === 'function') ? buildMidi : null
};
`;

function withHook(html){
  const i = html.lastIndexOf('</script>');
  return html.slice(0, i) + '\n' + HOOK + '\n' + html.slice(i);
}

export const OVERLAY = '/home/claude/qa/audio';   // .webm mirror: this Chromium has no AAC

export function serve(root = ROOT){
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(root, u === '/' ? 'index.html' : u);
    if(u.endsWith('.webm')){
      const o = path.join(OVERLAY, path.basename(u));
      if(fs.existsSync(o)) f = o;
    }else if(u.endsWith('.m4a') && !fs.existsSync(f)){
      // the alternate-root test only puts bundles in samples/; keep 404s honest
    }
    if(!f.startsWith(root) && !f.startsWith(OVERLAY)){ res.writeHead(404); return res.end('no'); }
    if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){
      res.writeHead(404); return res.end('no');
    }
    if(path.extname(f) === '.html'){
      const body = Buffer.from(withHook(fs.readFileSync(f, 'utf8')), 'utf8');
      res.writeHead(200, {'Content-Type':'text/html','Content-Length':body.length});
      return res.end(body);
    }
    res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
                        'Content-Length': fs.statSync(f).size});
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({server, port: server.address().port})));
}

export async function open({offline = false, width = 1180, height = 900, quiet = true, root = ROOT} = {}){
  const {server, port} = await serve(root);
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio',
           '--disable-features=AudioServiceOutOfProcess']
  });
  const context = await browser.newContext({viewport: {width, height},
                                            hasTouch: true, deviceScaleFactor: 1});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text());
                            else if(!quiet) console.log('  [page]', m.text()); });
  if(offline){
    // everything except the page itself is unreachable
    await page.route('**/*', route => {
      const u = route.request().url();
      if(u.endsWith('/') || u.endsWith('index.html')) return route.continue();
      return route.abort();
    });
  }
  await page.goto(`http://127.0.0.1:${port}/`, {waitUntil: 'domcontentloaded'});
  const close = async () => { await browser.close(); server.close(); };
  return {page, errors, close, port};
}

/* Tap into the graph so a test can hear what the page is doing. */
export const PROBE = `
window.__probe = (function(){
  let an = null, buf = null;
  function attach(){
    const D = window.__desk;
    if(an || !D || !D.ctx || !D.master) return false;
    an = D.ctx.createAnalyser(); an.fftSize = 2048;
    D.master.connect(an);
    buf = new Float32Array(an.fftSize);
    return true;
  }
  return {
    attach,
    rms(){
      if(!an && !attach()) return -1;
      an.getFloatTimeDomainData(buf);
      let s = 0; for(let i=0;i<buf.length;i++) s += buf[i]*buf[i];
      return Math.sqrt(s/buf.length);
    },
    peakOver(ms){
      return new Promise(res=>{
        let best = 0; const t0 = performance.now();
        const tick = () => {
          const v = this.rms(); if(v > best) best = v;
          if(performance.now() - t0 < ms) requestAnimationFrame(tick); else res(best);
        };
        tick();
      });
    },
    nodes(){ const D = window.__desk; return {ctx: !!D.ctx, engine: D.engine, hall: D.hallIsReal, live: D.live.size}; }
  };
})();`;

export async function boot(page, {ensemble = null, waitArt = false} = {}){
  await page.click('#start');
  await page.waitForFunction(() => window.__desk && window.__desk.ctx && window.__desk.master, null, {timeout: 30000});
  // the veil lifts when the opening ensemble has finished loading
  await page.waitForFunction(() => document.querySelector('#veil').classList.contains('hidden'),
                             null, {timeout: 90000});
  await page.evaluate(PROBE);
  await page.evaluate(() => window.__probe.attach());
  if(ensemble){
    await page.selectOption('#ensSel', ensemble);
    await page.waitForFunction(() => !document.querySelector('#ensSel').disabled, null, {timeout: 60000});
  }
  if(waitArt){
    await page.waitForFunction(() => {
      const D = window.__desk;
      const fam = D.FAMILIES[D.ensName];
      if(!fam) return true;
      const want = (fam.shorts||[]).concat(fam.tremolo ? ['tremolo'] : []);
      return want.every(a => fam.sections.every(s => !D.slotsFor(s.key,a) || D.sectionBuffers[s.key+'|'+a]));
    }, null, {timeout: 120000});
  }
}

export function report(name, checks){
  let fail = 0;
  for(const [label, ok, extra] of checks){
    if(!ok) fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  }
  console.log(`${name}: ${checks.length - fail}/${checks.length} passed`);
  return fail;
}
