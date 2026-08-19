import json, os, sys, subprocess, numpy as np
sys.path.insert(0,'/home/claude/build')
import render as R, audio

OUT = "/home/claude/out"
os.makedirs(OUT, exist_ok=True)
TARGET_RMS = 10**(-17/20)          # match the loudness of the existing bundles
PEAK_CEIL  = 0.89

PLAN = json.load(open('/home/claude/build/plan.json'))
SHORT = R.SHORT_ARTS

def bundle_defs(sec, arts):
    """(bundle-suffix, slot, lead, [(articulation, kind)]) for this section."""
    out = []
    if 'sustain' in arts:  out.append(("",       R.SUS_SLOT, R.SUS_LEAD, [("sustain","sustain")]))
    if 'tremolo' in arts:  out.append(("-trem",  R.TRM_SLOT, R.TRM_LEAD, [("tremolo","tremolo")]))
    sh = [(a,"short") for a in SHORT if a in arts]
    if sh:                 out.append(("-short", R.SHT_SLOT, R.SHT_LEAD, sh))
    return out

def build_bundle(sec, suffix, slot, lead, arts, bitrate):
    items = []        # (art, midi, rrIndex, audio, loop)
    for art, kind in arts:
        d = PLAN[sec][art]
        for n in d['notes']:
            for ri, alt in enumerate(n['alts']):
                y, lp = R.render_note(alt, n['m'], kind)
                y, lp = R.trim(y, lp, kind)
                if y is None or len(y) < int(0.05*R.SR): continue
                items.append([art, n['m'], ri, y, lp])
    if not items: return None
    levels = np.array([R.rms(it[3]) for it in items])
    med = float(np.median(levels[levels > 0])) if (levels > 0).any() else 1.0
    g = TARGET_RMS / med
    peak = max(float(np.abs(it[3]).max()) for it in items) * g
    if peak > PEAK_CEIL: g *= PEAK_CEIL / peak
    total = int(len(items) * slot * R.SR) + R.SR
    buf = np.zeros((total, 2), dtype=np.float32)
    notes = []
    for i, (art, m, ri, y, lp) in enumerate(items):
        off = int(i*slot*R.SR) + int(lead*R.SR)
        y = (y*g).astype(np.float32)
        buf[off:off+len(y)] += y
        e = dict(i=i, m=m, d=round(len(y)/R.SR, 4))
        if lp: e['l'] = [round(lp[0], 4), round(lp[1], 4)]
        if ri: e['rr'] = ri
        notes.append((art, e))
    wav = os.path.join(OUT, f"_{sec}{suffix}.wav")
    m4a = os.path.join(OUT, f"{sec}{suffix}.m4a")
    import soundfile as sf
    sf.write(wav, buf, R.SR, subtype='PCM_16')
    subprocess.run(["ffmpeg","-y","-v","error","-i",wav,"-c:a","aac","-b:a",bitrate,
                    "-movflags","+faststart", m4a], check=True)
    os.remove(wav)
    return dict(slot=slot, lead=lead, gain=g, notes=notes,
                bytes=os.path.getsize(m4a), seconds=total/R.SR)

if __name__ == "__main__":
    only = sys.argv[1:] or list(PLAN)
    index = {}
    if os.path.exists(OUT+"/index.json"): index = json.load(open(OUT+"/index.json"))
    for sec in only:
        arts = PLAN[sec]
        entry = index.get(sec, {})
        for suffix, slot, lead, alist in bundle_defs(sec, arts):
            br = "128k" if suffix != "-short" else "112k"
            res = build_bundle(sec, suffix, slot, lead, alist, br)
            if not res: continue
            if suffix == "":
                entry.update(slot=slot, lead=lead,
                             notes=[e for a, e in res['notes']])
            else:
                entry.setdefault('art', {})
                by = {}
                for a, e in res['notes']: by.setdefault(a, []).append(e)
                for a, ns in by.items():
                    entry['art'][a] = dict(bundle=f"{sec}{suffix}", slot=slot, lead=lead, notes=ns)
            print(f"{sec+suffix:22s} {res['bytes']/1e6:6.2f} MB  {res['seconds']:6.1f}s  "
                  f"{len(res['notes']):3d} slots  gain x{res['gain']:.2f}")
            sys.stdout.flush()
        index[sec] = entry
        json.dump(index, open(OUT+"/index.json","w"))
    tot = sum(os.path.getsize(OUT+"/"+f) for f in os.listdir(OUT) if f.endswith(".m4a"))
    print(f"\nTOTAL {tot/1e6:.1f} MB across {len([f for f in os.listdir(OUT) if f.endswith('.m4a')])} files")
