const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(`${__dirname}/index.html`,'utf8');
const elements=new Map();
class Element{
  constructor(){this.value='';this.checked=false;this.children=[];this.textContent='';this.innerHTML='';this.style={};this.dataset={};this.classList={add(){},remove(){}};}
  appendChild(el){this.children.push(el);}
  setAttribute(){} addEventListener(){} scrollIntoView(){} click(){}
  querySelectorAll(){return [new Element(),new Element(),new Element()];}
}
const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(){return new Element();},querySelectorAll(){return [];}};
document.getElementById('trendType').value='total';
const storage=new Map();
const context=vm.createContext({document,console,Date,Math,JSON,Number,Set,Map,Blob,URL,setTimeout,crypto:require('node:crypto').webcrypto,navigator:{},window:{scrollTo(){}},alert(){},confirm(){return true;},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
vm.runInContext(fs.readFileSync(`${__dirname}/analytics.js`,'utf8'),context);
vm.runInContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1],context);
const run=s=>vm.runInContext(s,context);
assert.equal(run('distanceStats([{distance:0,distanceType:"total"},{distance:100,distanceType:"total"},{distance:200,distanceType:"carry"},{distance:null,distanceType:"total"}],"total").avg'),50);
assert.equal(run('distanceStats([{distance:100,distanceType:"total"}],"carry").n'),0);
run('state.shots=Array.from({length:301},(_,i)=>({id:`t${i}`,ts:Date.UTC(2026,9,1)+i*1000,club:"7I",distance:i,distanceType:"total",dir:"中央",contact:"良"}));');
assert.equal(run('recentClubShots("7I").length'),300);
assert.equal(run('distanceStats(recentClubShots("7I"),"total").avg'),150.5);
run('saveSession();saveSession();');
assert.equal(run('history.length'),1);
assert.equal(run('allShots().length'),301);
run('state.shots.pop();');
assert.equal(run('allShots().length'),300);
run('saveSession();state.shots=[];state.sessionId=newId();');
assert.equal(run('allShots().length'),300);
run('state.shots=[{id:"new",ts:Date.UTC(2026,9,2),club:"7I",distance:200,distanceType:"total",special:"シャンク"}];resetDistanceDraft();');
assert.equal(run('distanceDraft'),150);
const points=JSON.parse(run('JSON.stringify(distanceTrend(allShots().filter(s=>s.club==="7I"),"total"))'));
assert.equal(points.length,2);
assert.equal(points[1].n,300);
assert.equal(points[1].max,299);
run('renderAll();');
assert.ok(document.getElementById('distanceChart').innerHTML.includes('<svg'));
assert.ok(run('buildReport()').includes('200.0yd'));
document.getElementById('distanceUnknown').checked=false;
run('distanceDraft=0;addShot("","","トップ");');
assert.equal(run('state.shots.at(-1).distance'),0);
run('history.push({date:"旧記録",total:5,report:"7I 5球\\n中央 3 / 左 1 / 右 1"});renderHistory();');
assert.ok(document.getElementById('historyList').children.at(-1));
const legacy=run('history.at(-1).report');
assert.ok(document.getElementById('historyList').children.at(-1).children.some(c=>c.textContent===legacy)||document.getElementById('historyList').children.some(d=>d.children.some(c=>c.textContent===legacy)));
assert.ok(storage.get('golfState'));
console.log('PASS: boot, zero/unknown, metric separation, last 300, dedup/upsert, reset persistence, daily rolling trend, graph, report, legacy history');
