const { chromium } = require((()=>{try{return require.resolve('playwright')}catch(e){return '/opt/node22/lib/node_modules/playwright'}})());
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(require('url').pathToFileURL(require('path').join(__dirname,process.argv[2],'index.html')).href);await p.waitForSelector('#ldEnter',{state:'visible',timeout:90000});
if(await p.$('#ldUser')){await p.click('[data-ld-auth=login]');await p.waitForTimeout(200);await p.click('[data-ld-tab=create]');await p.fill('#ldUser','mickey');await p.fill('#ldPass','1234');await p.fill('#ldPass2','1234');await p.click('#ldSubmit');await p.waitForTimeout(300);}
await p.fill('#startName','Mickey');await p.fill('#startTag','BLU');await p.dispatchEvent('#startTag','input');
await p.click('#roles button:nth-child(2)');await p.click('#roleConfirm');await p.waitForSelector('#revealOk',{timeout:30000});await p.click('#revealOk');await p.waitForTimeout(500);
const r=await p.evaluate((N)=>{const G=BL.Game;const c={};const inc=(k,v=1)=>c[k]=(c[k]||0)+v;let wins=0,secs=0,goals=0,carryT=[],carryD=[],fieldN=0;
 for(let run=0;run<N;run++){if(G.state.training)G.playStage(1);G.startMatch();const m=G.match;fieldN=m.ents.filter(e=>!e.gk).length;
  m.onEvent=(t,d)=>{inc(t);if(t==='log'){if(/tabelou/.test(d.text))inc('wall');if(/trave/.test(d.text))inc('post');}if(t==='tackle'&&!m.ball.owner)inc('slideWin');};
  let own=null,t0=0,x0=0,y0=0,dist=0;
  for(let i=0;i<60*150&&m.state!=='ended';i++){m.step(1/60);if(m.state==='play')secs+=1/60;const bo=m.ball.owner;
   if(bo!==own){if(own&&!own.gk){carryT.push(m.time-t0);carryD.push(dist);}own=bo;t0=m.time;dist=0;x0=bo?bo.x:0;y0=bo?bo.y:0;}
   else if(bo){dist+=Math.hypot(bo.x-x0,bo.y-y0);x0=bo.x;y0=bo.y;}}
  if(m.result&&m.result.win)wins++;
  }
 const pm=k=>+(((c[k]||0)/secs)*60).toFixed(2);const avg=a=>+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(2);
 const long=carryT.filter(x=>x>3).length/carryT.length;
 return {wins,fieldN,min:+(secs/60).toFixed(1),perMin:{dribble:pm('dribble'),tackle:pm('tackle'),shot:pm('shot'),save:pm('save'),goal:pm('goal'),wall:pm('wall'),pass:pm('pass'),post:pm('post'),slideWin:pm('slideWin')},carryAvgS:avg(carryT),carryAvgPx:avg(carryD),carryOver3s:+long.toFixed(2)};},+(process.argv[3]||20));
console.log(process.argv[2],JSON.stringify(r),errs);await b.close()})();
