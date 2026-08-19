"""Turn VPO3's .sfz mappings into a render plan.

Three things this does that a naive reader would not:
  * measured pitch overrides pitch_keycenter (VPO3 ships a whole staccato
    round-robin set a semitone sharp, and some octave-labelled samples);
  * a correction that would push a sample outside the instrument's own
    sampled range is thrown away instead — that is a detector error, not a
    library error;
  * short articulations keep a second, genuinely different recording per pad
    so repeated taps are not identical.
"""
import json, sys, os
sys.path.insert(0,'/home/claude/build')
import sfz

SECS = json.load(open('/home/claude/build/sections.json'))['sections']
MEASURED = json.load(open('/home/claude/build/measured.json'))
SHORT_ARTS = ("staccato","pizzicato","accent")
STEP = {"choir-men":1, "choir-women":1}
TARGET_VEL = 100
ALTS = {"staccato":2, "pizzicato":2, "accent":2}     # alternates per pad
LOG = []

def calibrated(regions, sfz_name):
    """(regions with corrected keycenters, log rows)."""
    kcs = [r['keycenter'] for r in regions]
    lo_ok, hi_ok = min(kcs)-6, max(kcs)+6
    out = []
    for r in regions:
        meas = MEASURED.get(r['sample'])
        claimed = r['keycenter'] + r['tune']/100.0
        if meas is None:
            out.append(dict(r, src=claimed)); continue
        dev = meas - claimed
        if abs(dev) < 0.12:
            out.append(dict(r, src=claimed)); continue          # under 12 cents is character, not error
        if abs(dev) < 0.5:
            # section left slightly out of tune with itself — pull it in
            LOG.append([sfz_name, r['sample'], round(dev,3), "fine-tuned"])
            out.append(dict(r, src=meas)); continue
        snap = round(dev)
        new = r['keycenter'] + snap
        if abs(dev - snap) > 0.30 or abs(snap) > 24:
            LOG.append([sfz_name, r['sample'], round(dev,3), "dropped: pitch unreadable"]); continue
        if not (lo_ok <= new <= hi_ok):
            LOG.append([sfz_name, r['sample'], round(dev,3), "correction ignored: outside the section's range"])
            out.append(dict(r, src=claimed)); continue
        LOG.append([sfz_name, r['sample'], round(dev,3), f"re-keyed {snap:+d}"])
        out.append(dict(r, keycenter=new, src=meas))     # measured pitch, exactly
    return out

def pick_velocity(regions):
    """Collapse velocity layers to the one a solid mezzo-forte would trigger."""
    by = {}
    for r in regions: by.setdefault(r['keycenter'], []).append(r)
    out = {}
    for kc, rs in by.items():
        hit = [r for r in rs if r['lovel'] <= TARGET_VEL <= r['hivel']]
        if not hit:
            top = max(r['hivel'] for r in rs)
            hit = [r for r in rs if r['hivel'] == top]
        out[kc] = hit
    return out

def grid_from_keycenters(kcs, step):
    ks = sorted(set(kcs))
    if not ks: return []
    kept = [ks[0]]
    for k in ks[1:-1]:
        if k - kept[-1] >= step: kept.append(k)
    if len(ks) > 1 and ks[-1] - kept[-1] >= max(1, step-1): kept.append(ks[-1])
    out = []
    for i, k in enumerate(kept):
        out.append(k)
        if i+1 < len(kept):
            gap = kept[i+1] - k
            n = max(0, -(-gap // step) - 1)
            for j in range(1, n+1): out.append(k + round(gap*j/(n+1)))
    return sorted(set(out))

def build_plan():
    plan = {}
    for sec, arts in SECS.items():
        step = STEP.get(sec, 3)
        plan[sec] = {}
        for art, rel in arts.items():
            regions = calibrated(sfz.load(rel), rel)
            if not regions: continue
            by_kc = pick_velocity(regions)
            notes = []
            for m in grid_from_keycenters(list(by_kc), step):
                order = sorted(by_kc.items(), key=lambda kv: (abs(kv[0]-m), kv[0]))
                n_alt = ALTS.get(art, 1)
                chosen = []
                for kc, rs in order[:n_alt]:
                    if chosen and abs(kc-m) > step: break
                    for r in rs[:1 if len(order) > 1 else 2]:
                        chosen.append((kc, r))
                if not chosen: continue
                notes.append(dict(m=m, alts=[dict(
                    keycenter=kc, src=r['src'], sample=r['sample'], volume=r['volume'],
                    pan=r['pan']) for kc, r in chosen]))
            if not notes: continue
            plan[sec][art] = dict(sfz=rel, lo=min(n['m'] for n in notes),
                                  hi=max(n['m'] for n in notes), notes=notes,
                                  stretch=max(min(abs(a['keycenter']-n['m']) for a in n['alts']) for n in notes))
    return plan

if __name__ == "__main__":
    p = build_plan()
    json.dump(p, open('/home/claude/build/plan.json','w'))
    json.dump(LOG, open('/home/claude/build/corrections.json','w'), indent=0)
    rek = [l for l in LOG if l[3].startswith('re-keyed')]
    fine = [l for l in LOG if l[3] == 'fine-tuned']
    drop = [l for l in LOG if l[3].startswith('dropped')]
    ign = [l for l in LOG if l[3].startswith('correction ignored')]
    print(f"pitch calibration: {len(rek)} re-keyed, {len(fine)} fine-tuned, {len(drop)} dropped, {len(ign)} corrections ignored (out of range)\n")
    slots = 0
    for sec in p:
        for art, d in p[sec].items():
            n = sum(len(x['alts']) for x in d['notes']); slots += n
            print(f"{sec:12s} {art:10s} {d['lo']:3d}-{d['hi']:3d}  pads {len(d['notes']):3d}  slots {n:3d}  worst-stretch {d['stretch']}")
    print(f"\n{slots} rendered slots")
