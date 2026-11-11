const { chromium } = require((()=>{try{return require.resolve('playwright')}catch(e){return '/opt/node22/lib/node_modules/playwright'}})());
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(require('url').pathToFileURL(require('path').join(__dirname,process.argv[2],'index.html')).href);await p.waitForSelector('#ldEnter',{state:'visible',timeout:90000});
if(await p.$('#ldUser')){await p.click('[data-ld-auth=login]');await p.waitForTimeout(200);await p.click('[data-ld-tab=create]');await p.fill('#ldUser','mickey');await p.fill('#ldPass','1234');await p.fill('#ldPass2','1234');await p.click('#ldSubmit');await p.waitForTimeout(300);}
await p.fill('#startName','Mickey');await p.fill('#startTag','BLU');await p.dispatchEvent('#startTag','input');
await p.click('#roles button:nth-child(2)');await p.click('#roleConfirm');await p.waitForSelector('#revealOk',{timeout:30000});await p.click('#revealOk');await p.waitForTimeout(500);
const r=await p.evaluate(()=>{const G=BL.Game;const out={};
 for(const mode of ['fase']){let wins=0,gf=0,ga=0,walls=0,goals=0,passes=0,secs=0,stalls=0;
  for(let run=0;run<30;run++){if(mode==='fase'&&G.state.training)G.playStage(1);G.startMatch();const m=G.match;m.onEvent=(t,d)=>{if(t==='log'&&/tabelou/.test(d.text))walls++;if(t==='goal')goals++;};
   let idle=0;for(let i=0;i<60*150&&m.state!=='ended';i++){m.step(1/60);secs+=1/60;const bl=m.ball;if(!bl.owner&&Math.hypot(bl.vx,bl.vy)<3&&m.state==='play')idle+=1/60;else idle=0;if(idle>4){stalls++;break;}}
   passes+=m.passes[0]+m.passes[1];gf+=m.score[0];ga+=m.score[1];if(m.result&&m.result.win)wins++;}
  out[mode]={tabelasPorMin:+(walls/secs*60).toFixed(1),golsPorMin:+(goals/secs*60).toFixed(1),passesPorMin:+(passes/secs*60).toFixed(1),stalls,wins,gf,ga};}
 return out;});
console.log(process.argv[2],JSON.stringify(r),errs);await b.close()})();
