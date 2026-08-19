import struct, numpy as np, soundfile as sf, os
from scipy.signal import resample_poly
from fractions import Fraction

VPO = "/home/claude/vpo3"

def read_smpl_loops(path):
    """Return [(start,end)] sample-frame loop points from the RIFF smpl chunk."""
    loops = []
    with open(path,'rb') as f:
        if f.read(4) != b'RIFF': return loops
        f.read(4)
        if f.read(4) != b'WAVE': return loops
        while True:
            hdr = f.read(8)
            if len(hdr) < 8: break
            cid, sz = struct.unpack('<4sI', hdr)
            data = f.read(sz + (sz & 1))
            if cid == b'smpl' and len(data) >= 36:
                n = struct.unpack('<I', data[28:32])[0]
                for i in range(n):
                    off = 36 + i*24
                    if off+24 > len(data): break
                    _id, _ty, st, en, _fr, _pc = struct.unpack('<6I', data[off:off+24])
                    loops.append((st, en))
    return loops

_cache = {}
def load_wav(rel, maxcache=140):
    if rel in _cache: return _cache[rel]
    p = os.path.join(VPO, rel)
    x, sr = sf.read(p, dtype='float32', always_2d=True)
    loops = read_smpl_loops(p)
    if len(_cache) > maxcache: _cache.clear()
    _cache[rel] = (x, sr, loops)
    return _cache[rel]

def resample_to(x, sr_in, sr_out):
    if sr_in == sr_out: return x
    fr = Fraction(sr_out, sr_in).limit_denominator(2000)
    return resample_poly(x, fr.numerator, fr.denominator, axis=0).astype(np.float32)

def pitch_shift_resample(x, ratio):
    """Speed-change by `ratio` (>1 = higher/shorter). Returns new array."""
    if abs(ratio - 1.0) < 1e-9: return x
    n_out = max(1, int(round(len(x) / ratio)))
    src = np.arange(n_out, dtype=np.float64) * ratio
    src = np.clip(src, 0, len(x)-1)
    i0 = src.astype(np.int64); i1 = np.minimum(i0+1, len(x)-1)
    fr = (src - i0)[:, None].astype(np.float32)
    return (x[i0]*(1-fr) + x[i1]*fr).astype(np.float32)

def to_stereo(x):
    if x.shape[1] == 1: return np.repeat(x, 2, axis=1)
    return x[:, :2]

def apply_pan(x, pan):
    """pan in [-100,100] sfz units."""
    if abs(pan) < 1e-6: return x
    p = max(-1.0, min(1.0, pan/100.0))
    a = (p + 1) * np.pi / 4
    g = np.array([np.cos(a), np.sin(a)], dtype=np.float32) * np.float32(np.sqrt(2))
    return x * g

def db(v): return float(10.0 ** (v/20.0))

# ---------- YIN pitch detection (octave-robust) ----------
def yin_f0(x, sr, fmin=27.5, fmax=2200.0, thresh=0.12):
    if x.ndim > 1: x = x.mean(axis=1)
    x = np.asarray(x, dtype=np.float64)
    W = int(sr / fmin * 2)
    if len(x) < W*2: W = len(x)//2
    if W < 64: return None
    # take a window from a stable part of the note
    start = min(len(x)-2*W, int(0.25*len(x)))
    if start < 0: start = 0
    fr = x[start:start+2*W]
    if len(fr) < 2*W: return None
    tau_max = min(W, int(sr/fmin))
    tau_min = max(2, int(sr/fmax))
    d = np.empty(tau_max)
    f = fr[:W]
    for tau in range(tau_max):
        diff = f - fr[tau:tau+W]
        d[tau] = np.dot(diff, diff)
    cum = np.cumsum(d[1:])
    dp = np.ones(tau_max)
    idx = np.arange(1, tau_max)
    with np.errstate(divide='ignore', invalid='ignore'):
        dp[1:] = d[1:] * idx / np.where(cum == 0, 1e-12, cum)
    tau = -1
    t = tau_min
    while t < tau_max:
        if dp[t] < thresh:
            while t+1 < tau_max and dp[t+1] < dp[t]: t += 1
            tau = t; break
        t += 1
    if tau < 0:
        seg = dp[tau_min:tau_max]
        if not len(seg): return None
        tau = tau_min + int(np.argmin(seg))
        if dp[tau] > 0.6: return None
    # parabolic interpolation
    if 1 <= tau < tau_max-1:
        a, b, c = dp[tau-1], dp[tau], dp[tau+1]
        den = (a - 2*b + c)
        if abs(den) > 1e-12: tau = tau + 0.5*(a - c)/den
    if tau <= 0: return None
    return sr / tau

def f0_to_midi(f):
    return 69 + 12*np.log2(f/440.0)
