const { chromium } = require((()=>{try{return require.resolve('playwright')}catch(e){return '/opt/node22/lib/node_modules/playwright'}})());
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(require('url').pathToFileURL(require('path').join(__dirname,(process.env.DIR||'new'),'index.html')).href);await p.waitForSelector('#ldEnter',{state:'visible',timeout:90000});
await p.click('[data-ld-auth=login]');await p.waitForTimeout(200);await p.click('[data-ld-tab=create]');await p.fill('#ldUser','mickey');await p.fill('#ldPass','1234');await p.fill('#ldPass2','1234');await p.click('#ldSubmit');await p.waitForTimeout(300);
await p.fill('#startName','Mickey');await p.fill('#startTag','BLU');await p.dispatchEvent('#startTag','input');
await p.click('#roles button:nth-child(4)');await p.click('#roleConfirm');await p.waitForSelector('#revealOk',{timeout:30000});await p.click('#revealOk');await p.waitForTimeout(300);
await p.click('.dock-map');await p.waitForTimeout(200);await p.click('button.sm-node[data-play="1"]');await p.waitForTimeout(300);
const N=+(process.argv[2]||20);
const r=await p.evaluate(([N,OV,PAIRS])=>{const G=BL.Game,C=BL.CONFIG;for(const k in OV){const ks=k.split('.');let o=C;for(let i=0;i<ks.length-1;i++)o=o[ks[i]];o[ks[ks.length-1]]=OV[k];}clearTimeout(G.nextT);G.match=null;
 const neu=BL.NATURES.find(n=>!n.up).name;const ids=BL.CHARACTERS.map(c=>c.id);
 const gk=G.keeper();const T=Object.fromEntries(C.TACTICS[4].map(t=>[t.id,t]));const out={};
 const pairs=PAIRS.split(';').map(x=>x.split('/'));
 for(const [a,bb] of pairs){const A=T[a],B=T[bb];const R={gkp:0,lost2:0,tk2:0,dist:0,distN:0,gg:0,mercy:0,d:0,l:0,ga:0,gb:0,loserScored:0,decided:0,shotsA:0,shotsB:0,w:0,l:0,d:0,dn:0,dp:0,dg:0,dd:0,ds:0,dc:0};
  for(let n=0;n<N;n++){const ch=[...ids].sort(()=>Math.random()-.5).slice(0,4);
   const mk=()=>ch.map(id=>BL.makePlayer(id,{rarity:'comum',stats:Object.fromEntries(C.STATS.map(k=>[k,16])),nature:neu,level:100}));
   const flip=n%2;const tacs=flip?[B,A]:[A,B];const teams=[mk(),mk()];
   const m=new BL.Match({teams,roles:[G.rolesFor(teams[0],tacs[0]),G.rolesFor(teams[1],tacs[1])],mods:G.formationMods(tacs[0],tacs[1]),shapes:[tacs[0].shape,tacs[1].shape],kickShapes:[tacs[0].kickShape||null,tacs[1].kickShape||null],gkShapes:[tacs[0].gkShape||null,tacs[1].gkShape||null],oppGkShapes:[tacs[0].oppGkShape||null,tacs[1].oppGkShape||null],styles:[tacs[0].style,tacs[1].style],edge:[C.FORMATION_BEATS[tacs[0].type]===tacs[1].type,C.FORMATION_BEATS[tacs[1].type]===tacs[0].type],gk:[gk,gk],speed:1,onEvent:(ty,d)=>{if(ty==='shot'){if((d.team===0)!==!!flip)R.shotsA++;else R.shotsB++;}}});
   const od=m.decide.bind(m);m.decide=(e)=>{const du=m.duoMate?m.duoMate(e):(()=>{const t=e.team,d=m.dir(t),fr=m.field(t).filter(x=>x.role!=='def');if(e.role==='def'||fr.length!==2||(e.x-1079/2)*d<-60)return null;if(m.field(1-t).filter(x=>(x.x-e.x)*d>0).length>1)return null;return fr.find(x=>x!==e)})();od(e);if(!du)return;R.dn++;const p=m.ball.pass;if(p&&p.to){if(p.to===du)R.dp++;else if(p.to.gk)R.dg++;else if(p.to.role==='def')R.dd++;}else if(m.ball.shot)R.ds++;else R.dc++;};
   for(let i=0;i<60*600&&m.state!=='ended';i++)m.step(1/60);
   const sa=flip?m.score[1]:m.score[0],sb=flip?m.score[0]:m.score[1];R.ga+=sa;R.gb+=sb;
   if(m.result&&m.result.reason==='golden')R.gg++;if(m.result&&m.result.reason==='mercy')R.mercy++;if(sa>sb)R.w++;else if(sb>sa)R.l++;else R.d++;if(sa!==sb){R.decided++;if(Math.min(sa,sb)>0)R.loserScored++;}}
  R.n=N;out[a+' x '+bb]=R;}
 return out;},[N,JSON.parse(process.env.OV||'{}'),process.env.PAIRS||'2-2/3-1;3-1/1-3;1-3/2-2;2-2/2-2;3-1/3-1;1-3/1-3']);
console.log(JSON.stringify(r));await b.close()})();
