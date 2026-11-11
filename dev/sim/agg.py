import json,glob,sys,math
agg={}
for f in glob.glob(sys.argv[1]):
    t=open(f).read()
    try: d=json.loads(t[t.index('{'):t.rindex('}')+1])
    except Exception as e: print("ERR",f,t[:200]); continue
    for k,v in d.items():
        a=agg.setdefault(k,{})
        for q,x in v.items():
            if q!='w': a[q]=a.get(q,0)+x
for k,a in agg.items():
    n=a['n']; w=n-a['l']-a['d']
    print(f"{k:12} n={n} V {w/n*100:.1f}% D {a['l']/n*100:.1f}% gols {a['ga']/n:.2f} x {a['gb']/n:.2f} gg {a['gg']/n*100:.0f}% perdMarcou {a['loserScored']/max(1,a['decided'])*100:.0f}%")
