const { chromium } = require((()=>{try{return require.resolve('playwright')}catch(e){return '/opt/node22/lib/node_modules/playwright'}})());
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(require('url').pathToFileURL(require('path').join(__dirname,'new','index.html')).href);await p.waitForSelector('#ldEnter',{state:'visible',timeout:90000});
await p.click('[data-ld-auth=login]');await p.waitForTimeout(200);await p.click('[data-ld-tab=create]');
await p.fill('#ldUser','mickey');await p.fill('#ldPass','1234');await p.fill('#ldPass2','1234');await p.click('#ldSubmit');await p.waitForTimeout(400);
await p.fill('#startName','Mickey');await p.fill('#startTag','BLU');await p.dispatchEvent('#startTag','input');
await p.click('#roles button:nth-child(4)');await p.click('#roleConfirm');await p.waitForSelector('#revealOk',{timeout:30000});await p.click('#revealOk');await p.waitForTimeout(300);
const r=await p.evaluate(([SIZE,N])=>{const G=BL.Game,C=BL.CONFIG;clearTimeout(G.nextT);G.match=null;
 const neu=BL.NATURES.find(n=>!n.up).name;const ids=BL.CHARACTERS.map(c=>c.id);const gk=G.keeper();const T=C.TACTICS[SIZE];const W=BL.FIELD.W;
 const S={};const st=(id)=>S[id]||(S[id]={games:0,possS:0,pass:0,fwd:0,side:0,back:0,gkBack:0,long:0,thru:0,chains:0,chainPass:0,chainShot:0,shotChainPass:0,shots:0,drib:0,gf:0,ga:0,blockN:0,blockSum:0,spreadSum:0,carryS:0,wins:0});
 for(const A of T)for(const B of T)for(let n=0;n<N;n++){const ch=[...ids].sort(()=>Math.random()-.5).slice(0,SIZE);
  const mk=()=>ch.map(id=>BL.makePlayer(id,{rarity:'comum',stats:Object.fromEntries(C.STATS.map(k=>[k,16])),nature:neu,level:100}));
  const tacs=[A,B],teams=[mk(),mk()],four=SIZE===4;let curTeam=-1,chainPasses=0;const sA=st(A.id);
  const m=new BL.Match({teams,roles:[G.rolesFor(teams[0],A),G.rolesFor(teams[1],B)],mods:four?G.formationMods(A,B):[{},{}],shapes:[A.shape||null,B.shape||null],kickShapes:[four&&A.kickShape||null,four&&B.kickShape||null],gkShapes:[null,null],oppGkShapes:[null,null],styles:[four?A.style:null,four?B.style:null],edge:four?[C.FORMATION_BEATS[A.type]===B.type,C.FORMATION_BEATS[B.type]===A.type]:[false,false],gk:[gk,gk],speed:1,
   onEvent:(ty,d)=>{if(d&&d.team===0){if(ty==='shot'){sA.shots++;if(curTeam===0){sA.chainShot++;sA.shotChainPass+=chainPasses;}}if(ty==='dribble')sA.drib++;}}});
  const kt=m.kickTo.bind(m);m.kickTo=(e,x,y,sp,err,pass)=>{if(e.team===0&&pass&&pass.kind==='pass'&&!pass.wall){if(e.gk)sA.gkBack+=0;else{const dx=(x-e.x)*m.dir(0);sA.pass++;chainPasses++;if(pass.to&&pass.to.gk)sA.back++;else if(dx>40)sA.fwd++;else if(dx<-40)sA.back++;else sA.side++;if(pass.lob)sA.long++;}}return kt(e,x,y,sp,err,pass);};
  for(let i=0;i<60*400&&m.state!=='ended';i++){const pre=m.ball.pass;m.step(1/60);const bo=m.ball.owner;
   if(bo&&bo.team!==curTeam){if(curTeam===0){sA.chains++;sA.chainPass+=chainPasses;}curTeam=bo.team;chainPasses=0;}
   if(m.state==='play'&&curTeam===0){const f=m.field(0);const xs=f.map(e=>e.x/W);const mean=xs.reduce((a,b)=>a+b,0)/xs.length;sA.blockSum+=mean;sA.spreadSum+=Math.max(...xs)-Math.min(...xs);sA.blockN++;sA.possS+=1/60;if(bo&&!bo.gk&&bo.team===0&&bo.mode==='carry')sA.carryS+=1/60;}
   if(m.ball.pass&&m.ball.pass.thru&&m.ball.pass!==pre&&m.ball.pass.team===0)sA.thru++;}
  sA.games++;sA.gf+=m.score[0];sA.ga+=m.score[1];if(m.score[0]>m.score[1])sA.wins++;}
 const out={};for(const t of T){const s=S[t.id];const pm=s.possS/60;out[t.name+' ('+t.id+')']={passesPorMinPosse:+(s.pass/pm).toFixed(1),frente:Math.round(s.fwd/s.pass*100)+'%',lado:Math.round(s.side/s.pass*100)+'%',tras:Math.round(s.back/s.pass*100)+'%',lancamento:Math.round(s.long/s.pass*100)+'%',passesPorJogada:+(s.chainPass/s.chains).toFixed(2),jogadasComChute:Math.round(s.chainShot/s.chains*100)+'%',passesAntesDoChute:+(s.shotChainPass/Math.max(1,s.chainShot)).toFixed(2),conducaoPct:Math.round(s.carryS/s.possS*100)+'%',blocoComBola:+(s.blockSum/s.blockN).toFixed(2),distanciaLinhas:+(s.spreadSum/s.blockN).toFixed(2),dribles:+(s.drib/s.games).toFixed(1),chutes:+(s.shots/s.games).toFixed(1),gols:+(s.gf/s.games).toFixed(2)+' x '+(s.ga/s.games).toFixed(2),vit:Math.round(s.wins/s.games*100)+'%',n:s.games};}
 return out;},[+process.argv[2],+process.argv[3]]);
console.log(JSON.stringify(r,null,1),errs);await b.close()})();
