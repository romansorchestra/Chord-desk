import re, os, sys, json

VPO = "/home/claude/vpo3"
NOTE = {'c':0,'d':2,'e':4,'f':5,'g':7,'a':9,'b':11}

def key2midi(tok):
    tok = tok.strip()
    if re.fullmatch(r'-?\d+', tok): return int(tok)
    m = re.fullmatch(r'([a-gA-G])([#b]*)(-?\d+)', tok)
    if not m: raise ValueError("key "+tok)
    v = NOTE[m.group(1).lower()]
    for c in m.group(2): v += 1 if c=='#' else -1
    return v + (int(m.group(3))+1)*12

def parse(path):
    """Return (global_opcodes, [region dicts]) with inheritance."""
    txt = open(path, encoding='utf-8', errors='replace').read()
    txt = re.sub(r'//[^\n]*', '', txt)
    # tokenise headers and opcodes in order
    # sample= may contain spaces; it runs until the next opcode or header
    toks = re.findall(r'<(\w+)>|(sample)=(.+?)(?=\s*(?:[a-zA-Z0-9_]+=|<\w+>|$))|([a-zA-Z0-9_]+)=([^\s<]+)', txt, re.S)
    toks = [(h, k1 or k2, (v1 if k1 else v2)) for (h, k1, v1, k2, v2) in toks]
    cur = {'global':{}, 'master':{}, 'group':{}, 'region':{}}
    scope = 'global'
    regions = []
    def flush():
        if cur['region']:
            d = {}
            for s in ('global','master','group','region'): d.update(cur[s])
            regions.append(d)
            cur['region'] = {}
    for hdr, k, v in toks:
        if hdr:
            flush()
            h = hdr.lower()
            if h in ('global','master','group','region'):
                # entering a new scope clears deeper scopes
                order = ['global','master','group','region']
                for deeper in order[order.index(h):]:
                    cur[deeper] = {}
                scope = h
            else:
                scope = 'ignore'
        else:
            if scope == 'ignore': continue
            cur[scope][k.lower()] = v
    flush()
    return regions

def resolve(sfz_path, sample):
    p = sample.replace('\\','/').strip()
    base = os.path.dirname(sfz_path)
    full = os.path.normpath(os.path.join(base, p))
    return os.path.relpath(full, VPO)

def load(rel):
    path = os.path.join(VPO, rel)
    out = []
    for r in parse(path):
        if 'sample' not in r: continue
        try:
            kc = key2midi(r.get('pitch_keycenter', r.get('key','60')))
            lo = key2midi(r.get('lokey', r.get('key', str(kc))))
            hi = key2midi(r.get('hikey', r.get('key', str(kc))))
        except Exception as e:
            continue
        out.append(dict(
            sample = resolve(path, r['sample']),
            keycenter = kc, lokey = lo, hikey = hi,
            tune = float(r.get('tune', 0)),
            volume = float(r.get('volume', 0)),
            pan = float(r.get('pan', 0)),
            loop_mode = r.get('loop_mode',''),
            loop_start = r.get('loop_start'), loop_end = r.get('loop_end'),
            ampeg_attack = float(r.get('ampeg_attack', 0)),
            ampeg_release = float(r.get('ampeg_release', 0)),
            pitch_random = float(r.get('pitch_random', 0)),
            amp_random = float(r.get('amp_random', 0)),
            delay_random = float(r.get('delay_random', 0)),
            lovel = int(r.get('lovel', 0)), hivel = int(r.get('hivel', 127)),
            seq_length = int(r.get('seq_length', 1)),
            seq_position = int(r.get('seq_position', 1)),
            lorand = float(r.get('lorand', 0)), hirand = float(r.get('hirand', 1)),
        ))
    return out

if __name__ == "__main__":
    for rel in sys.argv[1:]:
        rs = load(rel)
        print(f"--- {rel}: {len(rs)} regions")
        for r in rs[:4]: print("   ", r['keycenter'], r['lokey'], r['hikey'], r['sample'], 'tune',r['tune'],'vol',r['volume'])
