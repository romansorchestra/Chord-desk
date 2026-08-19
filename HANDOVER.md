# Chord Desk — handover brief

A chord-trigger instrument for iPad, built as a single self-contained HTML page
and hosted on GitHub Pages. Read this before changing anything.

Repo: `romansorchestra/Chord-desk` — served at
`https://romansorchestra.github.io/Chord-desk/`

---

## 1. What the thing is, and the idea behind it

The user is a professional songwriter/producer/composer. He composes by loading
Xfer **Cthulhu**'s classical chord folders in Logic, playing semi-random notes,
and harvesting sequences and inner melodies he wouldn't have written himself.
This app is a bigger version of that machine, drawn from the classical
repertoire.

**The central principle — do not break this.** Cthulhu has 128 chord slots, one
per MIDI note. For its classical folders, each piece was reduced to its stream
of **vertical sonorities in chronological order** and laid into consecutive
slots from the bottom of the keyboard up. Three consequences:

- Slot order is **chronological, not harmonic**. Playing the slots in order, in
  the written rhythm, reproduces the piece as written.
- Voicings are **absolute** — real register, inversion, spacing, doublings. It's
  the whole texture including the melody, not a root-position reduction.
- Rhythm is **not stored** in Cthulhu. (We do store it, so "Play as written"
  can walk a bank at the written durations. This is an addition, not a
  departure.)

Bach chorales dominate Cthulhu's set because chorales are already pure vertical
sonorities. That is why they fit the format perfectly.

## 2. Current state

`index.html` (~835 KB, single file, no build step) plus 33 audio bundles and
one impulse response. The page, the `.m4a` files and `hall-spokane.wav` sit
together in the repo root. Deployed via GitHub Pages from `main` / root.

`index.html` is the live page. The `chord-desk*.html` files in the repo are
Finder duplicates of older builds and should be deleted, along with
`choir-men 2.m4a`, `choirmen 2.m4a` and `choirwomen 2.m4a`. Note that
`choir-women.m4a` was **missing** from the repo while the page asked for it —
the women's chorus has been falling back silently. Fixed.

Shipped and working:

- **248 banks / ~25,900 chord slots**, picker grouped by composer
- 4×N pad grid, variable slot counts up to 128, press-and-hold with multi-touch
- Hold latch, Record, Play take, Play as written, Clear
- MIDI and MusicXML export
- Bass-line ribbon across the header (mini bass-clef stave, one notehead per
  slot, lights as pads fire)
- Ensembles: Strings, Brass, Woodwind, Choir, Piano
- Hall reverb on a 0–100% send — a real impulse response of the Spokane
  Woman's Club hall (OpenAIR, CC BY), with the old modelled hall as fallback
- Articulations: strings pizzicato / staccato / tremolo / accent, brass and
  woodwind staccato, chorus sustains only. Tap plays the short articulation,
  hold brings the sustain in under it, two fingers on a pad means tremolo
- Every voice individually humanised and drifting, so no two presses match
- Design: Edition Peters score-paper vernacular. Paper `#E6E4DA`, ink
  `#16181C`, Peters bottle green `#1F4A3C`, rehearsal-mark oxblood `#A8322A`.
  Bodoni Moda for display/chord symbols, IBM Plex Sans Condensed for labels.

## 3. Where the chord banks came from

Two different derivations, because the material demanded it.

**Pre-Romantic (36 banks)** — `music21`'s bundled corpus, via `chordify()`,
which performs exactly Cthulhu's reduction. Bach chorales, Mozart, Handel,
Corelli, Schubert, Schumann, Beethoven, Chopin, Palestrina, Monteverdi, Joplin,
Beach.

Verified: for every slot, take the midpoint of its written duration, ask the
original score what is sounding at that instant, compare. **99.6% of slots
match the source exactly**; all Bach chorales are 100%. Haydn Op.74, Weber and
Verdi were **dropped** because they didn't verify — do not re-add them without
re-running the check.

**Romantic (212 banks)** — DCMLab annotated corpora (Grieg Lyric Pieces 66,
Chopin mazurkas 57, Schumann 26, Liszt 19, Medtner 19, Dvořák 12, Tchaikovsky
12, Debussy 4).

Naive vertical slicing **fails** on Romantic piano writing: it's arpeggiated, so
slices give broken-chord fragments rather than chords. Instead there is **one
slot per musicologist-annotated harmony**, gathering the pitches that sustain
through it (≥55% of the harmony's span, plus the bass). The harmonic rhythm is
therefore an expert's, not a heuristic's, and the chord symbols on the pads are
their Roman numerals.

Verified by decoding the annotations' `chord_tones` (line-of-fifths, relative to
the local tonic) and checking what fraction of each slot's notes are genuine
chord tones: **93.4%**. The remainder are sustained suspensions and pedal tones
— deliberately kept, because for Romantic harmony that's the flavour.

## 4. Audio engine

**Sources.** Virtual Playing Orchestra 3's instrument choices, built from the
libraries it bundles: No Budget Orchestra 1 and 2 (CC BY-SA 4.0), Mattias
Westlund (CC BY-SA 3.0), VSCO-2 Community Edition (CC0) and Sonatina
Symphonic Orchestra (CC Sampling Plus 1.0). Attribution for all of them, and
for the hall impulse response, is in the Credits panel in the footer.

The share-alike terms attach to the sample bundles, which are adaptations, so
the `.m4a` files must stay free and credited. They do not reach music made
with the app — Battersby's licence page is explicit about that.

Violins, basses, oboes, tuba and chorus are still Sonatina: VPO chose Sonatina
for those, and for oboes and tuba there is nothing else in the bundle. There
is no violin-section sustain anywhere in VPO3 other than Sonatina's, so the
"layer with NoBudgetOrch2 ViolinSect" plan is not possible — those 11 files
are tremolo. Instead each violin line layers the other violin section
underneath it, quieter, detuned and delayed: two genuinely different desks.

**Bundling.** Each section is one AAC file at 160 kbps, notes laid on a fixed
**8-second grid**, each note starting ~0.35 s into its slot. The client finds
each note's onset inside its slot, which makes slicing immune to whatever
padding the encoder adds. `SECTION_INDEX` (inline in the HTML) holds each
note's MIDI number, duration and loop points.

Files: `<section>.m4a` (sustain), `<section>-short.m4a` (staccato, pizzicato
and accent laid end to end on a 1.8 s grid) and `<section>-trem.m4a` for the
strings — 33 `.m4a`, ~34 MB, plus `hall-spokane.wav` at 469 KB. `SECTION_INDEX`
now carries an explicit slot number per note, plus an `art` map naming the
bundle, grid and notes for each articulation. The loader tries `.m4a` then
`.webm`, so a browser built without AAC can be served an Opus mirror.

Articulations are fetched behind the sustains, so the first press never waits;
until they land, a tap plays the sustain.

**Orchestration.** Chords are split by register across the real sections rather
than stacked on one patch, seated in the stereo field like an orchestra (1st
violins left, basses right), with the bass doubled an octave up by the section
above. Worst pitch stretch **1 semitone** across all 333k note assignments;
choir is chromatic so it never stretches at all.

**Fallbacks.** If bundles can't be reached, a built-in oscillator engine takes
over (string/brass/woodwind/piano models plus a formant "ah" for choir), so it
can never fail silently. A tag by the piece title reads *Orchestral sections* /
*Sampled* / *Built-in tone*.

**Humanising.** Paul Battersby's tuned values, lifted from the `.sfz` files:
`pitch_random` ±12 cents, `amp_random` ±1.5 dB, `delay_random` 0–12 ms,
`ampeg_attack` 0.40 s, `ampeg_release` 1.90 s. On top of that every sustained
voice enters its loop at a random point, and three independent slow drifts
(pitch, level, brightness) are drawn from a shared pool of twelve
0.061–0.473 Hz oscillators, so the cost is fixed no matter how many pads are
down. Short articulations keep two alternate recordings per pad.

A plain press lands at level 0.62, which is both quieter and darker than full
— the single number the dynamics work in section 6 will drive.

**Three gotchas that cost real time — don't rediscover them:**

- **Never trust `pitch_keycenter`, and never trust a single pitch reading
  either.** All 45 Sonatina staccato round-robin-2 files are a semitone sharp;
  111 samples in total needed re-keying and 125 more needed fine-tuning. But a
  pitch detector octave-errors on plucked and tongued attacks, so every sample
  is measured through four windows and a correction is only applied when they
  agree — and refused outright if it would land the sample outside the
  section's own range. `build/calibrate.py` and `build/corrections.json` are
  the record.
- The Chromium in a headless test box has **no AAC**. Both the old and the new
  bundles fail `decodeAudioData` there. The harness serves an Opus mirror
  under `.webm`; the AAC files themselves are verified in Python with ffmpeg.
- iOS mutes Web Audio when the silent switch is on unless a media element is
  playing. A near-silent looping clip is started on first tap to flip the audio
  session. Don't remove it.

## 5. Test harnesses

All headless, all should pass before anything ships.

They live in `qa/` (Playwright) and `build/` (Python). `cd qa && npm i` then
`node test-<name>.mjs`. The harness injects its own read-only hook when it
serves the page, so nothing test-only ships in `index.html`.

| File | What it proves | Last run |
|---|---|---|
| `qa/test-play.mjs` | pads, ribbon, record/playback, exports, no stuck notes, "play as written" follows written durations | 22/22 |
| `qa/test-offline.mjs` | every slot × ensemble sounds with the network fully blocked (129,370 combinations) | 6/6 |
| `qa/test-ribbon.mjs` | every bank's ribbon fits its box at phone and iPad widths; pad grid matches slot count | 7/7 |
| `qa/test-sections.mjs` | every chord orchestrates into playable section ranges; reports worst pitch stretch | 5/5 |
| `qa/test-sampler.mjs` | real load path — fetch, decode, slice, loop, play; bundles found in root or `samples/` | 10/10 |
| `qa/test-artic.mjs` | tap vs hold, the strings selector, two-finger tremolo, chorus has no short, and two presses of a pad are never identical | 14/14 |
| `build/test_samples.py` | every shipped slot decoded from the real `.m4a`, sliced with the shipped index, and its pitch measured against the note it claims | 954 slots, 0 failures |
| `test_fidelity.py` | pre-Romantic slots reproduce their source scores | not re-run — the banks are untouched |
| `test_romantic.py` | Romantic slots match their annotated chord tones | not re-run — the banks are untouched |

The two Python bank harnesses were never in the repo and are not here either;
the bank data has not changed, so they were not needed for this build.

The user's standing instruction: **run the QA yourself and only bring him
verified builds.** Don't hand him things to test.

## 6. Agreed and outstanding

Everything below is decided, not up for re-litigation — he asked for it.

**Sound** — done, see `SOUND-BUILD.md`

- ~~Move to Virtual Playing Orchestra 3~~ **done.** Eight sections upgraded
  (violas, celli, horns, trumpets, trombones, flutes, clarinets, bassoons).
  Oboes and tuba could not be: VPO uses Sonatina for both and there is nothing
  else in the bundle. The brief's "all woodwinds (NoBudgetOrch)" was wrong
  about oboes.
- ~~Violins and basses are the exception... layer with NoBudgetOrch2's
  ViolinSect~~ **not possible.** Those 11 ViolinSect files are tremolo; there
  is no second violin-section sustain in the whole bundle. Each violin line
  now layers the *other* violin section under it instead — two different
  desks, real phase variation.
- ~~Lift Paul Battersby's tuned values~~ **done**, all five, from the `.sfz`
  group headers rather than typed in.
- ~~Break the static loop~~ **done.** Random loop entry per note, three
  independent slow drifts per voice, alternate takes on short articulations.
- ~~Add articulations~~ **done.** Strings pizz / staccato / tremolo / accent
  with a selector; brass and woodwind staccato; chorus sustains only. Tap →
  short, hold → sustain underneath, two fingers → tremolo.
- ~~Replace the modelled hall with a real impulse response~~ **done.** Spokane
  Woman's Club hall, OpenAIR, CC BY, RT60 2.29 s. Modelled hall kept as
  fallback.
- ~~A plain press should land at a musical mezzo~~ **done**, and it is the
  hook the dynamics work below will drive.

**Playing**
- **Dynamics**: vertical position on the pad sets level; swipe up while holding
  swells. Touch radius as a second dynamic dimension.
- **Voice-leading mode** (toggle): chords re-voice to move minimally from
  whatever was played last, instead of always their stored register. Judged the
  biggest single change to how it feels. Off = authentic original voicing.
- **Finger count sets chord density**: one finger = core triad from the bass;
  two = add the seventh/extension; three = full stored sonority.
- **Swipe across a pad rolls the chord**, swipe speed sets roll speed.
- **Transpose** — play any bank in any key.
- **Hold two pads** for a voice-led hybrid or a pivot between them.
- **Responsive grid** — pads that voice-lead well from the current position
  glow, ones that would clash dim; plus an inverted mode that highlights the
  surprising-but-usable ones. He was most enthusiastic about this one.

**Other**
- **Metronome**: count-in, downbeat accent, selectable time signatures.
- **Quantise the recording to the grid** — he explicitly wants this.
- **Fix the piece list.** Real bug: twelve Tchaikovsky banks are all titled
  "The Seasons Op.37" with nothing to distinguish them, because the title
  generator fell back to the opus number. Curate real titles (month names for
  The Seasons, Grieg's actual titles, mazurka number and key), and show key and
  slot count per entry.
- **MusicXML export, one staff per orchestral section** (Violins 1, 2, Violas,
  Celli, Basses) using the orchestration the app already computes, with
  voice-leading inside each staff. Keep the current single-stave version as a
  toggle.
- **MIDI input** via Web MIDI, feature-detected. Safari and iOS don't support
  it and there's no roadmap; he'll use Chrome on the Mac Studio, and
  **MIDIWeb Browser** (5of12, App Store) on the iPad.

Not agreed, raised as a possible future: a native **AUv3** version that runs
inside Logic on the iPad and sends MIDI to a track. That's the version he'd
actually use with his own libraries.

## 7. How he wants to be worked with

- Give the complete path through to the end in one message, not stage by stage.
- He skims technical detail — only what's needed for a decision.
- Do the work; don't relay instructions. Standing authority up front, run
  autonomously.
- One question at a time, and only when a decision genuinely needs him.
- **Be straight with him about limitations.** He responds well to "here's what
  won't work and why" — the finding that VPO still uses Sonatina for violins was
  more useful to him than a cheerful upgrade would have been.
