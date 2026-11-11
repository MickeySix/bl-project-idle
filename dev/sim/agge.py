import json,glob,sys
for f in sorted(glob.glob(sys.argv[1])):
    t=open(f).read()
    try: d=json.loads(t[t.index('{'):t.rindex('}')+1])
    except Exception: print('ERR',f,t[:300]); continue
    for k,v in d.items():
        n=v['n']; w=n-v['l']-v['d']
        print(f"{k:10} n={n} V {w/n*100:.0f}% D {v['l']/n*100:.0f}% gols {v['ga']/n:.2f}x{v['gb']/n:.2f} gg {v['gg']/n*100:.0f}% HT {v['enHT']/n:.0f} fim {v['enEnd']/n:.0f} min {v['enMin']/n:.0f} dur {v['dur']/n:.0f} chutes {v['shotsA']/n:.1f}x{v['shotsB']/n:.1f}")
