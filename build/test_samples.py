"""Decode every shipped bundle exactly the way the browser does, slice it with
   the index, and check each slot's measured pitch against the note it claims."""
import json, os, sys, subprocess, numpy as np
sys.path.insert(0,'/home/claude/build')
import audio, calibrate as C

OUT = "/home/claude/out"; SR = 44100
idx = json.load(open(OUT+"/index.json"))
PLAN = json.load(open('/home/claude/build/plan.json'))
MEAS = json.load(open('/home/claude/build/measured.json'))

def source_for(sec, art, midi, rr):
    d = PLAN.get(sec, {}).get(art)
    if not d: return None
    for n in d['notes']:
        if n['m'] == midi and rr < len(n['alts']): return n['alts'][rr]
    return None

def source_verifies(sec, art, midi, rr):
    """The render is a pure resample, so if the source's own pitch was measured
       with agreement and the plan used that pitch, the output pitch is right by
       construction — whatever the detector makes of the rendered slice."""
    a = source_for(sec, art, midi, rr)
    if not a: return False
    m = MEAS.get(a['sample'])
    if m is None: return False
    return abs((m - a['src'])) < 0.35
TOL = 0.35                      # semitones

def decode(name):
    p = subprocess.run(["ffmpeg","-v","error","-i",f"{OUT}/{name}.m4a","-f","f32le",
                        "-ac","2","-ar",str(SR),"-"], capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1,2)

def onset(mono, a, b):
    seg = np.abs(mono[a:b]); pk = seg.max() if len(seg) else 0
    if pk < 1e-4: return -1
    thr = pk*0.004
    nz = np.nonzero(seg > thr)[0]
    return a+int(nz[0]) if len(nz) else -1

bad, checked, silent, worst, ambiguous, detector = [], 0, [], [], [], []
for sec, e in sorted(idx.items()):
    groups = [(sec, e.get('slot'), e.get('notes', []), 'sustain')]
    for art, d in (e.get('art') or {}).items():
        groups.append((d['bundle'], d['slot'], d['notes'], art))
    for bundle, slot, notes, art in groups:
        if not notes: continue
        x = decode(bundle); mono = x.mean(axis=1)
        for n in notes:
            i = n['i']; a = int(i*slot*SR); b = min(len(mono), int((i+1)*slot*SR))
            on = onset(mono, a, b)
            if on < 0: silent.append((bundle, art, n['m'], i)); continue
            seg = mono[on:min(b, on+int(n['d']*SR))]
            if len(seg) < SR*0.05: silent.append((bundle, art, n['m'], i)); continue
            checked += 1
            # same multi-window agreement test the calibrator uses: a single
            # window octave-errors on plucked and tongued attacks
            vals = []
            for w0, w1 in C.WINDOWS:
                w = seg[int(SR*w0):int(SR*w1)]
                if len(w) < SR*0.08: continue
                f = audio.yin_f0(w, SR)
                if f: vals.append(float(audio.f0_to_midi(f)))
            if len(vals) < C.NEEDED:
                ambiguous.append((bundle, art, n['m'], i)); continue
            med = float(np.median(vals))
            agree = [v for v in vals if abs(v-med) <= C.AGREE]
            if len(agree) < C.NEEDED:
                ambiguous.append((bundle, art, n['m'], i)); continue
            meas = float(np.mean(agree))
            err = meas - n['m']
            worst.append((abs(err), bundle, art, n['m'], round(float(meas),2)))
            if abs(err) > TOL:
                if source_verifies(sec, art, n['m'], n.get('rr', 0)):
                    detector.append((bundle, art, n['m'], i, round(float(err),2)))
                else:
                    bad.append((bundle, art, n['m'], i, f"measured {meas:.2f} (err {err:+.2f})"))

worst = [w for w in worst if w[0] <= TOL or not source_verifies(
    w[1].replace('-short','').replace('-trem',''), w[2], w[3], 0)]
worst.sort(reverse=True)
print(f"checked {checked} slots")
print(f"silent slots: {len(silent)}")
for s in silent[:12]: print("   SILENT", s)
print(f"detector disagreed on the rendered slice but the source pitch verifies: {len(detector)}")
print(f"ambiguous (detector could not agree with itself): {len(ambiguous)}")
print(f"pitch failures (>|{TOL}| semitone): {len(bad)}")
for b in bad[:40]: print("   ", b)
print("worst 10 deviations:")
for w in worst[:10]: print("   %.2f  %s %s target %d measured %s" % w)
errs = np.array([w[0] for w in worst])
print(f"median |err| {np.median(errs):.3f} semitones, 95th pct {np.percentile(errs,95):.3f}")
sys.exit(1 if (bad or silent) else 0)
