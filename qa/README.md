# Chord Desk — test harnesses

Headless Playwright against the real page. Nothing here ships: the harness
injects its own read-only hook when it serves `index.html`, because the page
runs in strict mode and its top-level `let`s are deliberately not on `window`.

```
cd qa
npm install
npx playwright install chromium      # skip if a browser is already present
node test-play.mjs
```

`harness.mjs` serves the repo root (edit `ROOT` if your layout differs) on a
random port and boots the page. Several controls live on footer pages now, so
use the exported `setEnsemble(page, name)` helper rather than selecting
`#ensSel` directly.

| File | Runtime | What it proves |
|---|---|---|
| `test-sampler.mjs` | ~1 min | every bundle fetches, decodes and slices to the slot count in the index; every sustain slot carries loop points; the impulse response loads; the four ensembles balance within a few dB; bundles are found in the root or in `samples/` |
| `test-artic.mjs` | ~1 min | tap plays the short articulation and hold brings the sustain in under it; a held pizzicato never becomes a bowed note; two fingers on a pad means tremolo; the chorus has no short articulation; two presses of the same pad differ in loop entry and detuning; a plain press lands at a mezzo |
| `test-play.mjs` | ~1 min | pads, ribbon, multi-touch, the hold latch, record and playback, the MIDI and MusicXML exports, no stuck notes, and "play as written" landing on the written durations |
| `test-ribbon.mjs` | ~2 min | all 248 ribbons fit their box at 390, 1024 and 1180 px; pad grid and ribbon always match the slot count |
| `test-sections.mjs` | ~1 min | every chord in every bank orchestrates into playable section ranges, for every ensemble and articulation — 1.1 M note assignments — and reports the worst pitch stretch |
| `test-attack.mjs` | ~2 min | the trigger behaviour, measured off a real offline render: one attack per press, a held chord that does not fade over three seconds, a 25 ms tap that still plays the whole staccato, a pizzicato that rings out, and the dynamics wheel's range and its effect on a note already sounding |
| `test-offline.mjs` | ~7 min | with the network fully blocked, all 129,370 slot × ensemble combinations still build a sounding voice, and a rotating sample of 126 is listened to and measured |

## One thing to know about the test browser

The headless Chromium in most CI images is built **without AAC**, so
`decodeAudioData` refuses the `.m4a` bundles — the old ones as well as the new.
The harness therefore serves an Opus mirror under `.webm` (`qa/audio/`, built
with `ffmpeg -c:a libopus`), exercising the page's real extension-fallback
path. The `.m4a` files themselves are verified in Python instead, by
`build/test_samples.py`, which decodes them with ffmpeg and measures the pitch
of every one of the 954 slots.

Regenerate the mirror with:

```
mkdir -p qa/audio
for f in site/*.m4a; do
  ffmpeg -y -v error -i "$f" -c:a libopus -b:a 128k "qa/audio/$(basename "$f" .m4a).webm"
done
```
