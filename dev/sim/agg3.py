import json,glob,sys
T={}
for f in glob.glob(sys.argv[1]):
    try: r=json.loads(open(f).read().strip().splitlines()[-1])
    except Exception: print('ERR',f); continue
    for k,v in r.items():
        a=T.setdefault(k,{})
        for kk,vv in v.items():
            if isinstance(vv,(int,float)): a[kk]=a.get(kk,0)+vv
for k,a in T.items():
    n=a['dn'] or 1
    print(f"{k:12} dec={a['dn']} parceiro={a['dp']/n:.0%} zagueiro={a['dd']/n:.0%} goleiro={a['dg']/n:.0%} chute={a['ds']/n:.0%} conduz={a['dc']/n:.0%} | V {a.get('w',0)/a['n']:.1%} gols {a['ga']/a['n']:.2f} x {a['gb']/a['n']:.2f} chutes {a['shotsA']/a['n']:.1f} x {a['shotsB']/a['n']:.1f}")
