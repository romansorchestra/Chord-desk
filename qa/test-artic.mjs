/* Articulation routing and humanisation: tap vs hold, the strings selector,
   two fingers for tremolo, the chorus having no short articulation, and the
   promise that two presses of the same pad are never identical. */
import { open, boot, report, setEnsemble } from './harness.mjs';

const SPY = `
window.__spy = {events: [], on: false, clear(){ this.events.length = 0; }};
(function(){
  const D = window.__desk;
  const proto = Object.getPrototypeOf(D.ctx.createBufferSource());
  const start = proto.start;
  proto.start = function(when){
    if(window.__spy.on){
      window.__spy.events.push({
        when: when || 0,
        dur: this.buffer ? +this.buffer.duration.toFixed(4) : null,
        loop: this.loop,
        loopStart: +(this.loopStart||0).toFixed(5),
        loopEnd: +(this.loopEnd||0).toFixed(5),
        detune: this.detune ? +this.detune.value.toFixed(3) : null,
        rate: +this.playbackRate.value.toFixed(6)
      });
    }
    return start.apply(this, arguments);
  };
})();`;

const {page, errors, close} = await open();
const checks = [];
await boot(page, {waitArt: true});
await page.evaluate(SPY);

const wait = ms => page.waitForTimeout(ms);
async function capture(fn, settle = 320){
  await page.evaluate(() => { window.__spy.clear(); window.__spy.on = true; });
  await fn();
  await wait(settle);
  const ev = await page.evaluate(() => { window.__spy.on = false; return window.__spy.events; });
  await page.evaluate(() => window.__desk.allOff());
  await wait(260);
  return ev;
}

/* --- a tap plays the short articulation, a hold brings the sustain in --- */
const tap = await capture(async () => { await page.evaluate(() => __desk.padOn(4)); await wait(60);
                                        await page.evaluate(() => __desk.padOff(4, true)); }, 260);
const held = await capture(async () => { await page.evaluate(() => __desk.padOn(4)); await wait(420); }, 60);

checks.push(['a tap fires voices', tap.length > 0, tap.length + ' sources']);
checks.push(['the stroke and the bow start together, so nothing speaks twice',
             tap.some(e => !e.loop) && tap.some(e => e.loop),
             `${tap.filter(e=>!e.loop).length} strokes, ${tap.filter(e=>e.loop).length} bowed`]);
const gestures = await page.evaluate(async () => {
  const D = window.__desk;
  const quick = new D.Voice('strings', [50,57,62], undefined, {});
  await new Promise(r=>setTimeout(r, 40));
  const onQuick = quick.quickRelease;
  quick.stop();
  const long = new D.Voice('strings', [50,57,62], undefined, {});
  await new Promise(r=>setTimeout(r, 320));
  const onLong = {quick: long.quickRelease, bowed: !!long.sustainLayer};
  long.stop();
  await new Promise(r=>setTimeout(r, 400));
  return {onQuick, onLong};
});
checks.push(['a fast tap lets go of the bow before it arrives', gestures.onQuick === true]);
checks.push(['holding keeps the bow', gestures.onLong.quick === false && gestures.onLong.bowed,
             JSON.stringify(gestures.onLong)]);

/* --- the sustain looper enters at a different place every time --- */
const a = await capture(async () => { await page.evaluate(() => __desk.padOn(4)); await wait(360); }, 60);
const b = await capture(async () => { await page.evaluate(() => __desk.padOn(4)); await wait(360); }, 60);
const loopA = a.filter(e=>e.loop).map(e=>e.loopStart);
const loopB = b.filter(e=>e.loop).map(e=>e.loopStart);
checks.push(['the loop entry point moves between presses',
             loopA.length > 0 && loopA.join() !== loopB.join(),
             `${loopA.slice(0,3).join(',')} vs ${loopB.slice(0,3).join(',')}`]);
const detA = a.map(e=>e.detune).filter(v=>v!==null);
// +/-12 cents of Battersby randomisation, plus the +/-8 the layered violin
// desks are deliberately pulled apart by
checks.push(['every voice is detuned, none beyond the intended spread',
             detA.length > 0 && detA.every(v => Math.abs(v) <= 20.001)
             && new Set(detA).size === detA.length
             && detA.some(v => Math.abs(v) > 2),
             `${detA.length} voices, ${new Set(detA).size} distinct, max ${Math.max(...detA.map(Math.abs)).toFixed(1)}c`]);
const startA = a.map(e=>e.when);
checks.push(['no two players land on the same instant', new Set(startA).size === startA.length]);

/* --- the strings selector --- */
await page.evaluate(() => { __desk.shortArt = 'pizzicato'; });
const pizz = await capture(async () => { await page.evaluate(() => __desk.padOn(6)); await wait(420); }, 60);
checks.push(['a held pizzicato never grows into a bowed sustain', !pizz.some(e => e.loop),
             pizz.filter(e=>e.loop).length + ' looped']);
await page.evaluate(() => { __desk.shortArt = 'staccato'; });

/* --- two fingers on one pad --- */
await page.evaluate(() => __desk.padOn(8)); await wait(240);
await page.evaluate(() => __desk.padOn(8));                   // second finger
await wait(320);
const tremOn = await page.evaluate(() => {
  const v = __desk.live.get(8);
  return {trem: !!(v && v.voice && v.voice.tremolo),
          cls: (document.querySelectorAll('.pad')[8]||{}).className};
});
checks.push(['a second finger on a sounding pad turns it into tremolo', tremOn.trem === true, tremOn.cls]);
await page.evaluate(() => __desk.allOff());
await wait(300);

/* --- the chorus has sustains only --- */
await setEnsemble(page, 'choir');
await page.waitForFunction(() => __desk.loadedFamilies.has('choir'), null, {timeout:60000});
const choir = await capture(async () => { await page.evaluate(() => __desk.padOn(2)); await wait(60);
                                          await page.evaluate(() => __desk.padOff(2, true)); }, 300);
checks.push(['a tap on the chorus still sings a sustain', choir.some(e => e.loop),
             choir.filter(e=>e.loop).length + ' of ' + choir.length]);
const artSelHidden = await page.evaluate(() => {
  const f = document.getElementById('artSel').closest('.field');
  return f ? getComputedStyle(f).display === 'none' : true;
});
checks.push(['the articulation selector is hidden for the chorus', artSelHidden]);

/* --- and it is shown, with three choices, for strings --- */
await setEnsemble(page, 'strings');
const opts = await page.evaluate(() => {
  const s = document.getElementById('artSel');
  return {shown: getComputedStyle(s.closest('.field')).display !== 'none',
          values: Array.from(s.options).map(o=>o.value)};
});
checks.push(['strings offer staccato, pizzicato and accent',
             opts.shown && opts.values.join() === 'staccato,pizzicato,accent', opts.values.join()]);

/* --- a plain press is a mezzo, not full tilt --- */
const lvl = await page.evaluate(() => ({d: window.__desk.dynamics,
                                        mark: document.getElementById('dynMark').textContent}));
checks.push(['a plain press lands at a mezzo', lvl.d > 0.5 && lvl.d < 0.75 && lvl.mark === 'mf',
             `${lvl.d} (${lvl.mark})`]);

const hard = errors.filter(e => !/404|ERR_TUNNEL|fonts.googleapis|Failed to load resource/.test(e));
checks.push(['no page errors', hard.length === 0, hard.slice(0,3).join(' | ')]);
await close();
process.exit(report('test-artic', checks) ? 1 : 0);
