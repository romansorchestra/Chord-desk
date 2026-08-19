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

`chord-desk.html` (~800 KB, single file, no build step) plus 15 audio bundles.
The page and the `.m4a` files sit together in the repo root. Deployed via
GitHub Pages from `main` / root.

Shipped and working:

- **248 banks / ~25,900 chord slots**, picker grouped by composer
- 4×N pad grid, variable slot counts up to 128, press-and-hold with multi-touch
- Hold latch, Record, Play take, Play as written, Clear
- MIDI and MusicXML export
- Bass-line ribbon across the header (mini bass-clef stave, one notehead per
  slot, lights as pads fire)
- Ensembles: Strings, Brass, Woodwind, Choir, Piano
- Hall reverb on a 0–100% send
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

**Sources.** Sonatina Symphonic Orchestra (`peastman/sso` on GitHub), CC
Sampling Plus 1.0 — **commercial use requires attribution**, which is not yet
in the UI and should be.

**Bundling.** Each section is one AAC file at 160 kbps, notes laid on a fixed
**8-second grid**, each note starting ~0.35 s into its slot. The client finds
each note's onset inside its slot, which makes slicing immune to whatever
padding the encoder adds. `SECTION_INDEX` (inline in the HTML) holds each
note's MIDI number, duration and loop points.

Files: `violins1 violins2 violas celli basses horns trumpets trombones tuba
flutes oboes clarinets bassoons choir-men choir-women` — 15 `.m4a`, ~21 MB.

**Orchestration.** Chords are split by register across the real sections rather
than stacked on one patch, seated in the stereo field like an orchestra (1st
violins left, basses right), with the bass doubled an octave up by the section
above. Worst pitch stretch **1 semitone** across all 333k note assignments;
choir is chromatic so it never stretches at all.

**Fallbacks.** If bundles can't be reached, a built-in oscillator engine takes
over (string/brass/woodwind/piano models plus a formant "ah" for choir), so it
can never fail silently. A tag by the piece title reads *Orchestral sections* /
*Sampled* / *Built-in tone*.

**Two gotchas that cost real time — don't rediscover them:**

- All 12 Sonatina **flute** samples are named an octave low, plus one tuba.
  Corrected in the manifest. A first pitch test missed this because it folded
  octave errors; `librosa.pyin` caught it. Trust measured pitch over filenames.
- iOS mutes Web Audio when the silent switch is on unless a media element is
  playing. A near-silent looping clip is started on first tap to flip the audio
  session. Don't remove it.

## 5. Test harnesses

All headless, all should pass before anything ships.

| File | What it proves |
|---|---|
| `test-play.mjs` | pads, ribbon, record/playback, exports, no stuck notes, "play as written" follows written durations |
| `test-offline.mjs` | every slot × ensemble sounds with the network fully blocked (~130k combinations) |
| `test-ribbon.mjs` | every bank's ribbon fits its box at phone and iPad widths; pad grid matches slot count |
| `test-sections.mjs` | every chord orchestrates into playable section ranges; reports worst pitch stretch |
| `test-sampler.mjs` | real load path — fetch, decode, slice, loop, play; hall send behaviour; bundles found in root or `samples/` |
| `test_fidelity.py` | pre-Romantic slots reproduce their source scores |
| `test_romantic.py` | Romantic slots match their annotated chord tones |

The user's standing instruction: **run the QA yourself and only bring him
verified builds.** Don't hand him things to test.

## 6. Agreed and outstanding

Everything below is decided, not up for re-litigation — he asked for it.

**Sound**
- Move to **Virtual Playing Orchestra 3** (`open-soundfonts/Virtual_Playing_Orchestra_3`,
  master branch, ~700 MB). It bundles nine free libraries and picks the best per
  instrument. Better than current for cellos (NoBudgetOrch), violas
  (Mattias-Westlund + VSCO2), horns (Westlund), trumpets/trombones
  (NoBudgetOrch2), all woodwinds (NoBudgetOrch).
- **Violins and basses are the exception**: VPO chose Sonatina, i.e. what we
  already have. There is no better free violin section sustain in the bundle.
  Layer Sonatina with NoBudgetOrch2's ViolinSect (11 notes) to get two different
  ensembles on the same note — more players, more phase variation.
- Lift Paul Battersby's tuned values from the VPO `.sfz` files rather than
  guessing: `pitch_random=12` cents, `amp_random=1.5` dB, `delay_random=0.012`,
  `ampeg_attack=0.4`, `ampeg_release=1.9`.
- **Break the static loop** — this is judged the single biggest win. Randomise
  loop entry point per note; give every voice independent slow drift in pitch,
  level and brightness, so two presses of the same pad are never identical.
- Add **articulations**: strings get pizzicato, staccato, tremolo, accent;
  woodwind and brass get staccato. Short tap → short articulation, hold →
  sustain. Strings need a selector for whether tap means pizz or staccato.
  Tremolo should go on a gesture (two fingers), not tap length. **Choir has
  sustains only** — no short articulation exists.
- Replace the modelled hall with a **real impulse response**. The current one is
  synthesised (image-source early reflections, velvet-noise tail, decaying
  low-pass) and this was disclosed to him.
- A plain press should land at a musical mezzo, not full tilt.

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
