# Chord Desk — the responsive grid, and a much bigger library

---

## The glowing grid

It's on the Play page as **Guide**, with two modes, and it's on by default.

Press a pad and every other pad is scored against what's now sounding. Two
things decide how one chord follows another, and they pull in different
directions:

- **how far the voices have to move** — the least total distance, with no
  crossings and every note connected to something in the other chord, measured
  per voice so chords of different sizes stay comparable;
- **how much of the harmony survives** — shared pitch classes, and how far the
  two chords sit apart on the circle of fifths, taken as a mean direction so
  inversions and added notes don't throw it off.

**Voice leading** (the default) wants both: small movement, tones in common.
Green-rimmed pads are the strongest handful, pale green the next tier, and the
ones that would clash fade back.

**Surprising** wants the opposite of the second while keeping the first —
the hand barely moves and yet the harmony has gone somewhere else entirely.
That is where the chromatic mediants and the pivot chords live. Weighting
smoothness hardest is what stops it from simply listing whatever is furthest
away, which would be a list of chords you can't get to.

From a C major triad it ranks, in order:

| | voice leading | surprising |
|---|---|---|
| A minor (relative) | **0.76** | 0.04 |
| G major (dominant) | 0.57 | 0.07 |
| E major (chromatic mediant) | 0.52 | **0.23** |
| F♯ major (tritone) | 0.30 | 0.34 |
| D♭ major (Neapolitan) | 0.21 | 0.17 |

Two hands down are read as one sonority, so holding a pivot and reaching from
it works the way you'd expect. Every one of the 111,893 slots in the library
scores without a special case.

## The library: 248 banks → 1,027, across 69 composers

**Ravel, Wagner and Strauss are all in**, and a good deal else. Two new sources:

**Annotated corpora (DCML)** — the same derivation as the existing Romantic
banks: one slot per musicologist-annotated harmony, holding the pitches that
sustain through it plus the bass. New from here: **Ravel** (Jeux d'eau,
Miroirs), **Wagner** (the Tristan and Meistersinger preludes),
**Rachmaninoff**, **Mahler** (Kindertotenlieder), **Bartók**, **Poulenc**,
**Schulhoff**, **Scarlatti**, **Couperin**, **Frescobaldi**, **Schütz**,
**Peri**, **Pergolesi**, **Sweelinck**, **J. C. Bach**, **W. F. Bach**,
**Schubert's Winterreise**, plus far deeper Beethoven (sonatas *and* the
quartets), Mozart sonatas and Bach suites.

Verified the same way as before, by decoding each annotation's chord tones
against its local tonic: **89.0%** of slot notes are chord tones across
1,850 built banks. The rest are sustained suspensions and pedal tones, which
for this repertoire is the flavour — it's lowest exactly where you'd expect
(Ravel 78%, Medtner 78%, Tristan 86%) and highest in Schütz and Frescobaldi
at 98–99%.

**OpenScore Lieder (CC0)** — 1,462 songs of MusicXML, reduced by `chordify`
exactly as the pre-Romantic banks are. This is where **Richard Strauss**
comes from, along with **Wolf**, **Brahms**, **Berg**, **Webern**,
**Schoenberg**, **Zemlinsky**, **Satie**, **Chausson**, **Boulanger**,
**Clara Schumann**, **Fanny Hensel**, **Gounod**, **Bizet**, **Delius**,
**Elgar**, **Quilter**, **Butterworth** and a couple of dozen more.

Verified by asking the original score what is sounding at the midpoint of every
slot: **98.6% match exactly.** The first run of that check said 69.7%, which
turned out to be my own offset arithmetic drifting every time a piece
contained a rest — the music was fine, the ruler wasn't.

**Two honest limits.** Wagner and Ravel are thin — 7 banks each — because that
is the whole of what has been annotated. Wagner's songs exist in OpenScore but
only as MuseScore files, which nothing here can read. And Strauss is 11 banks
of songs, not the tone poems; no orchestral Strauss is annotated anywhere I
could reach.

Long works are split into consecutive 128-slot banks — *Tristan und Isolde —
Prelude — part 1, 2, 3* — so you get the whole piece rather than the first two
minutes, and the parts are capped at four so one prelude doesn't crowd out
twenty songs.

## How it loads

The page would have been 3.6 MB with all of that inline. So the curated 248
stay in the file and the other 779 ride in **`banks-extra.json`** alongside the
audio, merged in as the desk opens. GitHub Pages compresses it, so it's about
600 KB over the wire and cached after the first visit.

If it never arrives — no network, a bad deploy — the desk opens on the
inline 248 and everything still plays. There's a test for exactly that.

## Everything still passes

Eight harnesses, all green against this build:

| | |
|---|---|
| `test-guide` | 13/13 — the scoring, on chords whose answer isn't in doubt |
| `test-library` | 11/11 — the merge, and the fallback when it can't be fetched |
| `test-attack` | 9/9 — one attack per press, no fade, taps that ring |
| `test-sampler` | 12/12 — every bundle, every slot, ensemble balance |
| `test-artic` | 14/14 — tap vs hold, the selector, two-finger tremolo |
| `test-play` | 22/22 — pads, record, exports, no stuck notes |
| `test-ribbon` | 7/7 — all 1,027 ribbons fit at three widths |
| `test-sections` | 5/5 — 3,992,399 note assignments, worst stretch 1 semitone |
| `test-offline` | 6/6 — 129,370 combinations with the network gone |

## Still outstanding

Transpose, voice-leading *mode* (re-voicing chords to move minimally, as
opposed to just showing you which ones would), finger-count density,
swipe-to-roll, the metronome, quantised recording, the per-section MusicXML
export, and MIDI note input.
