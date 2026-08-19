# Chord Desk — the sound work from section 6

What follows is what changed, what was found on the way, and the two things
that need a decision from you.

---

## 1. What now plays

Thirteen orchestral sections plus two chorus sections, rebuilt from Virtual
Playing Orchestra 3's sample choices rather than from Sonatina alone.

| Section | Now plays | Change |
|---|---|---|
| Violas | Mattias Westlund + VSCO-2 CE | upgraded |
| Celli | No Budget Orchestra | upgraded |
| Horns | Mattias Westlund | upgraded |
| Trumpets | No Budget Orchestra 2 | upgraded |
| Trombones | No Budget Orchestra 2 | upgraded |
| Flutes | No Budget Orchestra | upgraded |
| Clarinets | No Budget Orchestra | upgraded |
| Bassoons | No Budget Orchestra | upgraded |
| 1st violins | Sonatina | unchanged — see below |
| 2nd violins | Sonatina | unchanged |
| Basses | Sonatina | unchanged |
| **Oboes** | **Sonatina** | **unchanged — the brief expected an upgrade here** |
| **Tuba** | **Sonatina** | **unchanged** |
| Chorus (men, women) | Sonatina | unchanged |

**Two corrections to the brief.** The brief said "all woodwinds
(NoBudgetOrch)". VPO's own oboe mapping uses Sonatina, not No Budget
Orchestra — there is no other oboe section in the bundle. Same for tuba.
So eight sections improve, five stay as they were.

**The violin layer can't be done as described.** The brief said to layer
Sonatina with No Budget Orchestra 2's ViolinSect, 11 notes, for a second
ensemble on the same note. Those 11 files are the *tremolo* set — there is
no NBO2 violin-section sustain, and across all nine bundled libraries there
is no violin-section sustain at all except Sonatina's own. Checked every
directory; the only other violin-section material anywhere in VPO3 is
tremolo, spiccato and pizzicato.

What is shipped instead does the same job with what exists: the 1st and 2nd
violin sections are genuinely different recordings of different desks, so
each violin line now plays its own section *plus* the other one underneath
at about a third of the level, pushed 8 cents the other way and 15–19 ms
late. Two different sets of players on one note, real phase variation, no
extra download.

## 2. Articulations

Strings get pizzicato, staccato, tremolo and accent. Brass and woodwind get
staccato. The chorus has sustains only, as expected — no short chorus
material exists.

- **A tap plays the short articulation. A hold plays it and then brings the
  sustain in underneath at 160 ms.** The short fires on the *press*, so
  there is no waiting to find out whether a press was a tap — it is a
  detaché that turns into a held bow, which is what the instrument actually
  does.
- **Pizzicato is the exception.** A held pizz rings and stops. It never
  grows into a bowed note.
- **A `Tap` selector** by the hall slider chooses staccato / pizzicato /
  accent for strings. It hides itself for brass, woodwind and chorus, which
  have only one choice or none.
- **Two fingers on the same pad crosses into tremolo**, with a red outline
  on the pad. Not tied to tap length, as agreed.
- If an articulation hasn't finished downloading, that section plays its
  sustain rather than dropping out of the chord. Sustains load first and the
  articulations arrive behind them, so the first press never waits.

## 3. Breaking the static loop

Judged the biggest win in the brief, and it is the part with the most in it.

- **Random loop entry per note.** Every sustained voice enters the loop at a
  different point inside the first 55% of the loop region, so the tail never
  repeats the same way twice.
- **Three independent slow drifts per voice** — pitch, level and brightness
  — drawn from a pool of twelve very slow oscillators (0.061–0.473 Hz) at
  random depth and sign. No two voices breathe together.
- **Paul Battersby's values, lifted from the .sfz files, not guessed:**
  `pitch_random` ±12 cents, `amp_random` ±1.5 dB, `delay_random` 0–12 ms,
  `ampeg_attack` 0.40 s, `ampeg_release` 1.90 s.
- **Two alternate recordings per pad** for short articulations wherever the
  library has them, chosen at random on each press.

The harness proves this rather than asserting it: two presses of the same
pad produce different loop entry points and sixteen distinct detunings, and
no two players in a chord start on the same instant.

## 4. A real hall

The modelled hall is gone from the signal path. In its place is a
sine-sweep impulse response of the **Spokane Woman's Club hall** — 84 × 42
feet, curved ceiling, RT60 2.29 s, EDT 1.87 s, with the warm tilt of a real
room (lows decay about eleven times slower than highs). From OpenAIR at the
University of York, **Creative Commons Attribution** — the only plain CC BY
hall in that set, and the only one that is both commercially usable and the
right size. Perth City Hall, which would also have fitted, is
non-commercial; the cathedral-length ones are share-alike.

It is 469 KB, normalised to unit energy so the 0–100% send means the same
thing it did. The modelled hall is still in the file as the fallback if the
IR can't be fetched.

## 5. A plain press is a mezzo

Level now drives both gain and brightness: a plain press sits at 0.62,
which is quieter *and* darker rather than a quiet fortissimo. This is the
hook the dynamics work in the "Playing" section will drive — vertical
position, swell and touch radius all just move that one number.

## 6. Pitch was measured, not trusted

The flute-octave lesson generalised. Every one of the 595 source samples was
measured with YIN through four different windows, and only accepted where
the windows agreed with each other.

- **111 samples were mapped to the wrong pitch by VPO3 and were re-keyed.**
  The largest group: all 45 Sonatina staccato round-robin-2 files across
  the string sections sound **a semitone sharp**. In a normal sampler that
  is an alternating semitone wobble on repeated staccato notes.
- **125 more were pulled back into tune** where they sat between 12 and 50
  cents off.
- **3 were dropped** because no window could agree on their pitch — a
  handful of VSCO-2 cello pizzicati where the body resonance swamps the
  fundamental.
- **1 correction was refused** because it would have put a 2nd-violin sample
  an octave below the violin's range: that was the detector being wrong, not
  the library.

After all that, every one of the 954 shipped slots was decoded from the
actual .m4a, sliced with the shipped index, and measured again: **median
error 2 cents, worst 15 cents, nothing silent.**

---

## Two things that need you

**1. Licensing changed shape.** Today's build is all Sonatina — CC Sampling
Plus 1.0, attribution, commercial use fine, no strings. The new sections
bring in **CC BY-SA 4.0** (No Budget Orchestra 1 and 2) and **CC BY-SA 3.0**
(Mattias Westlund). Share-alike attaches to the *sample bundles*, which are
adaptations, so the .m4a files in the repo have to be offered on the same
terms with credit — there is now a Credits panel in the footer that does
this. It does **not** reach your music: Battersby's own licence page is
explicit that music made with the library can be sold commercially. But it
does mean the bundles must stay free and credited. If you would rather not
take that on, say so and I will rebuild from Sonatina and VSCO-2 CE (CC0)
only — you would keep the humanisation, the articulations and the hall, and
lose the eight upgraded sections.

**2. I can't push.** The session's git proxy refuses `romansorchestra/Chord-desk`
because it isn't in the authorised repository set. Add it as a source and I
will push; otherwise the zip drops straight into the repo root.
