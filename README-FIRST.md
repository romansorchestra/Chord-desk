# Drop-in

**Everything in `site/` goes in the repo root**, replacing what is there.
That is `index.html`, 33 `.m4a` bundles and `hall-spokane.wav`.

**Delete these from the repo** — they are Finder duplicates of older builds and
GitHub Pages is serving them for no reason:

```
chord-desk.html
chord-desk 2.html
chord-desk 3.html
chord-desk 5.html
choir-men 2.m4a
choirmen 2.m4a
choirwomen 2.m4a
```

`choir-women.m4a` was missing from the repo entirely while the page was asking
for it, so the women's chorus has been falling back silently. It is in `site/`.

`qa/` and `build/` should go in the repo too — the test harnesses were never
committed, which is why they had to be rewritten.

Read `SOUND-BUILD.md` next. `HANDOVER.md` is the brief, updated.

## The demo

`chord-desk-sound-demo.m4a` — the same eight chords from the Chopin Op. 17
No. 1 bank, rendered through the actual engine, old build first.

```
0:00  Strings as they are today
0:21  Strings now — held
0:42  Strings now — tapped, staccato
0:51  Strings now — tapped, pizzicato
1:01  Strings now — two fingers, tremolo
1:22  Brass now
1:43  Woodwind now
2:04  Chorus now
```

Both string passes go through a hall at the same 40% send — the first through
the modelled one, the second through the Spokane impulse response — so the
comparison is the whole change, samples and room together.
