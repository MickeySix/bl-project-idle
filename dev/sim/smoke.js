const { chromium } = require((()=>{try{return require.resolve('playwright')}catch(e){return '/opt/node22/lib/node_modules/playwright'}})());
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(require('url').pathToFileURL(require('path').join(__dirname,'new','index.html')).href);await p.waitForSelector('#ldEnter',{state:'visible',timeout:90000});
await p.click('[data-ld-auth=login]');await p.waitForTimeout(200);await p.click('[data-ld-tab=create]');await p.fill('#ldUser','mickey');await p.fill('#ldPass','1234');await p.fill('#ldPass2','1234');await p.click('#ldSubmit');await p.waitForTimeout(300);
await p.fill('#startName','Mickey');await p.fill('#startTag','BLU');await p.dispatchEvent('#startTag','input');
await p.click('#roles button:nth-child(1)');await p.click('#roleConfirm');await p.waitForSelector('#revealOk',{timeout:30000});await p.click('#revealOk');await p.waitForTimeout(300);
await p.click('.dock-map');await p.waitForTimeout(200);await p.click('button.sm-node[data-play="1"]');
// mede os textos de efeito numa partida acelerada (todos os modos)
const r=await p.evaluate(()=>{const C=BL.CONFIG,out={};const neu=BL.NATURES.find(n=>!n.up).name;const ids=BL.CHARACTERS.map(c=>c.id);const G=BL.Game;clearTimeout(G.nextT);G.match=null;const gk=G.keeper();
 for(const size of [1,2,4]){const tacs=G.tactics(size);const cnt={};let curl=0,lob=0;
  for(let n=0;n<6;n++){const mk=(iv)=>[...ids].sort(()=>Math.random()-.5).slice(0,size).map(id=>BL.makePlayer(id,{rarity:'comum',stats:Object.fromEntries(C.STATS.map(k=>[k,iv])),nature:neu,level:50}));
   const teams=[mk(31),mk(10)];const A=tacs[0],B=tacs[tacs.length-1];
   const m=new BL.Match({teams,roles:[G.rolesFor(teams[0],A),G.rolesFor(teams[1],B)],mods:G.formationMods(A,B),shapes:[A.shape,B.shape],styles:[A.style,B.style],edge:[false,false],gk:[gk,gk],speed:1,onEvent:()=>{}});
   for(let i=0;i<60*400&&m.state!=='ended';i++){m.step(1/60);if(m.ball.curl)curl++;if(m.ball.pass&&m.ball.pass.lob)lob++;m.fx.forEach(f=>{if(f.kind==='text'&&!f._c){f._c=1;cnt[f.text]=(cnt[f.text]||0)+1;}});}
   cnt['_score']=(cnt['_score']||'')+m.score.join('-')+' ';cnt['_en']=(cnt['_en']||'')+m.ents.filter(e=>!e.gk).map(e=>Math.round(e.energy)).join('/')+' ';}
  cnt._curlFrames=curl;cnt._lobFrames=lob;out[size]=cnt;}
 return out;});
console.log(JSON.stringify(r,null,1));
await p.waitForTimeout(500);await p.screenshot({path:'smoke.png'});console.log('errors',errs);await b.close()})();
