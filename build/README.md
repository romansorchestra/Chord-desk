# Sample pipeline

Rebuilds the 33 `.m4a` bundles and `SECTION_INDEX` from Virtual Playing
Orchestra 3. Needs a clone of `open-soundfonts/Virtual_Playing_Orchestra_3`
at `/home/claude/vpo3` (about 1.3 GB checked out), Python with
`numpy soundfile scipy`, and `ffmpeg`.

```
python3 calibrate.py     # measure the true pitch of all 595 source samples
python3 plan.py          # sfz -> render plan, applying the corrections
python3 build.py         # render, normalise, lay on the grid, encode AAC
python3 test_samples.py  # decode the shipped .m4a and check every slot's pitch
```

| File | |
|---|---|
| `sfz.py` | an .sfz reader that handles Battersby's files, including sample paths with spaces and the group/master/global inheritance |
| `audio.py` | wav loading, the RIFF `smpl` loop chunk, resampling, and a YIN pitch detector |
| `calibrate.py` | measures every source sample through four windows and only accepts a reading when they agree — a single window octave-errors on plucked and tongued attacks |
| `plan.py` | picks the velocity layer a mezzo-forte would trigger, thins the sampled pitches to a 3-semitone grid, keeps a second recording per pad for the short articulations, and applies the pitch corrections (refusing any that would push a sample outside the section's own range) |
| `render.py` | one note: resample to pitch, apply the sfz volume and half its pan, scale the loop points, trim, fade |
| `build.py` | assembles each bundle, normalises to the loudness of the old build, lays notes on the 8.0 s / 6.0 s / 1.8 s grids, encodes, and writes `index.json` |
| `test_samples.py` | the verification pass: decode the real `.m4a`, slice with the shipped index, measure every slot |
| `corrections.json` | the record of what VPO3 had mis-mapped — 111 re-keyed, 125 fine-tuned, 3 dropped, 1 correction refused |

`index.json` from `build.py` is what `patch/splice.py` inlines into the page as
`SECTION_INDEX`.
