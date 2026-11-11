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
    print(f"{k:12} passes/jogo={a['p']/a['n']:.0f} trás={a['b']/max(1,a['p']):.0%} | comOpçãoLivre: trás={a['fb']/max(1,a['fp']):.0%} ({a['fb']/a['n']:.1f}/jogo, perdidos {a['fbl']/max(1,a['fb']):.0%}) | semOpção: trás={a['nb']/max(1,a['np']):.0%} | V {a['w']/a['n']:.1%} gols {a['ga']/a['n']:.2f} x {a['gb']/a['n']:.2f}")
