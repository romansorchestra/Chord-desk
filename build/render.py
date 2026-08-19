import json, os, sys, math, subprocess, numpy as np
sys.path.insert(0,'/home/claude/build')
import audio

SR = 44100
OUT = "/home/claude/out"
SUS_SLOT, SUS_LEAD, SUS_MAX = 8.0, 0.35, 7.30
TRM_SLOT, TRM_LEAD, TRM_MAX = 6.0, 0.30, 5.40
SHT_SLOT, SHT_LEAD, SHT_MAX = 1.80, 0.12, 1.55
SHORT_ARTS = ("staccato","pizzicato","accent")
PAN_BAKE = 0.5                      # keep some intra-section spread, leave seating to the app

def find_loop(x, sr, f0=None):
    """Fallback loop finder: match a window in the tail against earlier audio."""
    m = x.mean(axis=1) if x.ndim > 1 else x
    n = len(m)
    win = int(sr*0.30)
    hi = n - win - int(sr*0.05)
    lo = int(sr*0.9)
    if hi <= lo + win: return None
    end = hi
    tgt = m[end:end+win]
    tn = np.linalg.norm(tgt) + 1e-9
    best, bestc = None, -2
    for st in range(lo, end-win, max(1, int(sr*0.002))):
        seg = m[st:st+win]
        c = float(np.dot(seg, tgt) / ((np.linalg.norm(seg)+1e-9)*tn))
        if c > bestc: bestc, best = c, st
    if best is None or bestc < 0.5: return None
    return (best, end)

def render_note(rr, target_midi, kind):
    """One rendered note: stereo float32 at SR, plus loop points in seconds."""
    x, sr, loops = audio.load_wav(rr['sample'])
    x = audio.to_stereo(x)
    if sr != SR:
        x = audio.resample_to(x, sr, SR)
        if loops: loops = [(int(a*SR/sr), int(b*SR/sr)) for a, b in loops]
        sr = SR
    semis = target_midi - rr['src']          # src = the pitch the file really sounds
    ratio = 2.0 ** (semis/12.0)
    y = audio.pitch_shift_resample(x, ratio)
    y = y * np.float32(audio.db(rr['volume']))
    y = audio.apply_pan(y, rr['pan']*PAN_BAKE)

    lp = None
    if kind in ("sustain","tremolo"):
        if loops:
            a, b = loops[0]
            lp = (a/ratio/SR, b/ratio/SR)
        else:
            fl = find_loop(y, SR)
            if fl: lp = (fl[0]/SR, fl[1]/SR)
    return y.astype(np.float32), lp

def trim(y, lp, kind):
    cap = {"sustain":SUS_MAX, "tremolo":TRM_MAX}.get(kind, SHT_MAX)
    n = int(cap*SR)
    if lp:
        a, b = lp
        if b > cap:                       # pull the loop back so it fits the slot
            span = b - a
            b = cap - 0.02
            a = max(0.15, b - min(span, cap*0.55))
            if b - a < 0.25: return None, None
            lp = (a, b)
        n = min(len(y), int((lp[1]+0.02)*SR))
    else:
        # short note: cut at the point the decay falls below -62 dB of peak
        m = np.abs(y).max(axis=1)
        pk = m.max()
        if pk <= 0: return None, None
        thr = pk * (10**(-62/20))
        idx = np.nonzero(m > thr)[0]
        n = min(int(cap*SR), (idx[-1]+1 if len(idx) else int(cap*SR)) + int(0.01*SR))
    y = y[:max(1, min(len(y), n))]
    # 6 ms fade in / 12 ms fade out so slices never click
    fi = min(len(y), int(0.006*SR)); fo = min(len(y), int(0.012*SR))
    if fi: y[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
    if fo: y[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None]
    return y, lp

def rms(y):
    if y is None or not len(y): return 0.0
    a = y.mean(axis=1)
    k = a[int(len(a)*0.2):int(len(a)*0.8)] if len(a) > 20 else a
    return float(np.sqrt(np.mean(k*k)) + 1e-12)

if __name__ == "__main__":
    print("module")
