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
    print(f"{k:12} infiltr/jogo={a['dn']/a['n']:.1f} recebeu={a['dp']/n:.0%} outroNosso={a['dd']/n:.0%} perdeu={a['ds']/n:.0%} | V {a['w']/a['n']:.1%} gols {a['ga']/a['n']:.2f} x {a['gb']/a['n']:.2f} chutes {a['shotsA']/a['n']:.1f} x {a['shotsB']/a['n']:.1f}")
