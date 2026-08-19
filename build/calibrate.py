"""Measure the real pitch of every source sample we might ship.

VPO3 inherits Sonatina's mislabelled files and ships a whole staccato
round-robin set a semitone sharp, so pitch_keycenter cannot be trusted.
But a pitch detector cannot be trusted either — plucked notes make YIN
lock onto the body resonance an octave or two out.  So every sample is
measured through four different windows and only accepted when they agree.
"""
import json, sys, numpy as np
sys.path.insert(0,'/home/claude/build')
import audio

WINDOWS = [(0.02,0.42),(0.05,0.75),(0.15,1.15),(0.30,1.80)]
AGREE   = 0.25          # semitones
NEEDED  = 3             # windows that must agree

def measure(path):
    x, sr, _ = audio.load_wav(path)
    m = x.mean(axis=1) if x.ndim > 1 else x
    a = np.abs(m); pk = a.max()
    if pk < 1e-5: return None, []
    nz = np.nonzero(a > pk*0.02)[0]
    on = int(nz[0]) if len(nz) else 0
    vals = []
    for w0, w1 in WINDOWS:
        seg = m[on+int(sr*w0): on+int(sr*w1)]
        if len(seg) < sr*0.08: continue
        f = audio.yin_f0(seg, sr)
        if f: vals.append(float(audio.f0_to_midi(f)))
    if len(vals) < NEEDED: return None, vals
    med = float(np.median(vals))
    agree = [v for v in vals if abs(v-med) <= AGREE]
    if len(agree) < NEEDED: return None, vals
    return round(float(np.mean(agree)), 3), vals

if __name__ == "__main__":
    wavs = [l for l in open('/home/claude/build/needed_wavs.txt').read().split('\n') if l.strip()]
    out, unread = {}, 0
    for i, w in enumerate(wavs):
        try: v, _ = measure(w)
        except Exception: v = None
        if v is None: unread += 1
        out[w] = v
        if i % 150 == 0: print(i, len(wavs), flush=True)
    json.dump(out, open('/home/claude/build/measured.json','w'))
    print(f"measured {len(out)-unread} of {len(out)}; {unread} too ambiguous to judge (left as the .sfz says)")
