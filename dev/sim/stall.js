const { chromium } = require((()=>{try{return require.resolve('playwright')}catch(e){return '/opt/node22/lib/node_modules/playwright'}})());
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(require('url').pathToFileURL(require('path').join(__dirname,'new','index.html')).href);await p.waitForSelector('#ldEnter',{state:'visible',timeout:90000});
await p.click('[data-ld-auth=login]');await p.waitForTimeout(200);await p.click('[data-ld-tab=create]');await p.fill('#ldUser','mickey');await p.fill('#ldPass','1234');await p.fill('#ldPass2','1234');await p.click('#ldSubmit');await p.waitForTimeout(300);
await p.fill('#startName','Mickey');await p.fill('#startTag','BLU');await p.dispatchEvent('#startTag','input');
await p.click('#roles button:nth-child(2)');await p.click('#roleConfirm');await p.waitForSelector('#revealOk',{timeout:30000});await p.click('#revealOk');await p.waitForTimeout(500);
const r=await p.evaluate(()=>{const G=BL.Game;let stalls=0,walls=0,goals=0,maxIdle=0,ended=0;
 for(let run=0;run<40;run++){G.startMatch();const m=G.match;m.onEvent=(t,d)=>{if(t==='log'&&/tabelou/.test(d.text))walls++;if(t==='goal')goals++;if(t==='end')ended++;};
  let idle=0;for(let i=0;i<60*240;i++){m.step(1/60);const bl=m.ball;if(!bl.owner&&Math.hypot(bl.vx,bl.vy)<3&&m.state==='play'){idle+=1/60;}else idle=0;if(idle>maxIdle)maxIdle=idle;if(idle>4){stalls++;break;}}
 }
 return {stalls,walls,goals,ended,maxIdle:+maxIdle.toFixed(2),training:G.match.training,clock:document.getElementById('sbClock').textContent};});
console.log(r,errs);await b.close()})();
