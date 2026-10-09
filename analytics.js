/* Flight-distance records are local-only. Legacy reports are never converted to shots. */
function newId(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
function typeLabel(type){return type==="carry"?"キャリー":"ラン込み";}
function validDistance(shot,type){return typeof shot.distance==="number"&&Number.isFinite(shot.distance)&&shot.distance>=0&&shot.distance<=400&&["total","carry"].includes(shot.distanceType)&&(!type||shot.distanceType===type);}
function distanceStats(shots,type){
  const values=shots.filter(s=>validDistance(s,type)).map(s=>s.distance);
  const n=values.length;
  if(!n)return {n:0,avg:null,max:null,sd:null};
  const avg=values.reduce((a,b)=>a+b,0)/n;
  return {n,avg,max:Math.max(...values),sd:Math.sqrt(values.reduce((a,b)=>a+(b-avg)**2,0)/n)};
}
function fmt(value){return value===null?"—":(Math.round(value*10)/10).toFixed(1);}
function allShots(){
  const seen=new Map();
  const saved=history.filter(h=>!h.deletedAt&&h.sessionId!==state.sessionId).flatMap(h=>Array.isArray(h.shots)?h.shots:[]);
  [...saved,...state.shots].forEach(s=>{
    const key=s.id||JSON.stringify([s.ts,s.club,s.dir,s.contact,s.special,s.distance,s.distanceType]);
    seen.set(key,s);
  });
  return [...seen.values()].sort((a,b)=>a.ts-b.ts);
}
function recentClubShots(club,shots=allShots()){return shots.filter(s=>s.club===club).slice(-300);}
function distanceSummary(club,shots){
  return ["total","carry"].map(type=>{
    const s=distanceStats(shots.filter(x=>x.club===club),type);
    return s.n?`${typeLabel(type)}：平均 ${fmt(s.avg)}yd / 最大 ${s.max}yd（${s.n}球）`:"";
  }).filter(Boolean).join(" ・ ")||"飛距離：未記録";
}
function resetDistanceDraft(){
  const shots=recentClubShots(state.selectedClub);
  const s=distanceStats(shots,distanceType);
  distanceDraft=s.n?Math.min(300,Math.round(s.avg)):100;
  document.getElementById("distanceUnknown").checked=!s.n;
  document.getElementById("distanceType").value=distanceType;
  document.getElementById("distanceBaseline").textContent=s.n
    ?`直近${shots.length}球中 ${typeLabel(distanceType)} ${s.n}球の平均：${fmt(s.avg)}yd（ミス含む）`
    :"平均はまだありません。初期値100ydから調整してください（調整すると距離が記録されます）。";
  updateDistanceOutput();
}
function updateDistanceOutput(){
  const unknown=document.getElementById("distanceUnknown").checked;
  document.getElementById("distanceSlider").value=distanceDraft;
  document.getElementById("distanceValue").textContent=unknown?"距離不明":`${distanceDraft} yd`;
  document.getElementById("distanceSlider").setAttribute("aria-valuetext",`${distanceDraft}ヤード${unknown?"、距離不明として記録":""}`);
}
function setupDistanceControls(){
  document.getElementById("distanceType").onchange=e=>{distanceType=e.target.value;localStorage.setItem("golfDistanceType",distanceType);resetDistanceDraft();};
  document.getElementById("distanceSlider").oninput=e=>{distanceDraft=Number(e.target.value);document.getElementById("distanceUnknown").checked=false;updateDistanceOutput();};
  [-1,1].forEach(delta=>{document.getElementById(delta<0?"distanceMinus":"distancePlus").onclick=()=>{distanceDraft=Math.max(0,Math.min(300,distanceDraft+delta));document.getElementById("distanceUnknown").checked=false;updateDistanceOutput();};});
  document.getElementById("distanceAverage").onclick=resetDistanceDraft;
  document.getElementById("distanceUnknown").onchange=updateDistanceOutput;
  document.getElementById("trendClub").onchange=e=>{trendClub=e.target.value;renderDistancePage();};
  document.getElementById("trendType").onchange=renderDistancePage;
  document.getElementById("backupBtn").onclick=()=>{
    const data={version:6,exportedAt:new Date().toISOString(),state,clubs,history};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=`golf-backup-${dayKey(Date.now())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
}
function saveSession(){
  if(!state.shots.length){alert("記録がありません");return;}
  const index=history.findIndex(h=>h.sessionId===state.sessionId);
  const item={sessionId:state.sessionId,date:new Date().toLocaleString("ja-JP"),savedAt:Date.now(),total:state.shots.length,target:state.target,memo:state.memo,report:buildReport(),shots:state.shots.map(s=>({...s}))};
  if(index>=0)history[index]=item;else history.push(item);
  saveHistory();renderHistory();renderDistancePage();
  alert(index>=0?"この練習の保存内容を更新しました":"練習履歴に保存しました。次の練習を始める際は記録をリセットしてください。");
}
function renderHistoryDetails(){
  const el=document.getElementById("historyList");el.innerHTML="";
  renderDeletedHistory();
  const active=history.filter(h=>!h.deletedAt);
  if(!active.length){el.innerHTML='<p class="muted">保存済みの練習はありません</p>';return;}
  [...active].reverse().forEach(item=>{
    const details=document.createElement("details");details.className="history-item";
    const summary=document.createElement("summary");summary.textContent=`${item.date} ・ ${item.total}球　詳細を見る`;details.appendChild(summary);
    const meta=document.createElement("p");meta.className="hint";meta.textContent=`目標 ${item.target||"—"}球 ／ ${item.memo||"メモなし"}`;details.appendChild(meta);
    if(Array.isArray(item.shots)){
      const stats=document.createElement("div");renderStats(stats,item.shots,[...new Set(item.shots.map(s=>s.club))]);details.appendChild(stats);
      const rows=document.createElement("details");const label=document.createElement("summary");label.textContent="1球ごとの記録";rows.appendChild(label);
      const wrap=document.createElement("div");wrap.className="table-wrap";
      wrap.innerHTML=`<table><thead><tr><th>球</th><th>クラブ</th><th>結果</th><th>飛距離</th></tr></thead><tbody>${item.shots.map((s,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(s.club)}</td><td>${escapeHtml(s.special||`${s.dir}・${s.contact}`)}</td><td>${validDistance(s)?`${s.distance}yd（${typeLabel(s.distanceType)}）`:"不明"}</td></tr>`).join("")}</tbody></table>`;
      rows.appendChild(wrap);details.appendChild(rows);
    }else{
      const note=document.createElement("p");note.className="hint";note.textContent="旧版の履歴：1球単位のデータは未保存のため、保存済みレポートのクラブ別集計を表示します。飛距離は復元できません。";details.appendChild(note);
      const report=document.createElement("div");report.className="report";report.textContent=item.report||"この履歴には詳細データがありません。";details.appendChild(report);
    }
    const actions=document.createElement("div");actions.className="row";
    const edit=document.createElement("button");edit.className="small";edit.textContent="この履歴を編集";edit.onclick=()=>openHistoryEditor(item,details);
    const remove=document.createElement("button");remove.className="small danger";remove.textContent="この履歴を削除";remove.onclick=()=>deleteHistoryItem(item);
    actions.appendChild(edit);actions.appendChild(remove);details.appendChild(actions);el.appendChild(details);
  });
}
function dayKey(ts){const d=new Date(ts);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function distanceTrend(shots,type){
  const groups=new Map();shots.forEach(s=>{const key=dayKey(s.ts);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);});
  const window=[];const points=[];
  for(const [date,dayShots] of groups){
    window.push(...dayShots);if(window.length>300)window.splice(0,window.length-300);
    const rolling=distanceStats(window,type),daily=distanceStats(dayShots,type);
    if(rolling.n)points.push({date,ts:dayShots[dayShots.length-1].ts,...rolling,dailyAvg:daily.avg,dailyMax:daily.max,dailyN:daily.n});
  }
  return points;
}
function renderDistancePage(){
  const shots=allShots(),select=document.getElementById("trendClub");
  const names=[...new Set([...clubs,...shots.map(s=>s.club)])];
  if(!names.includes(trendClub))trendClub=names[0]||"";
  select.innerHTML="";names.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;select.appendChild(o);});select.value=trendClub;
  const type=document.getElementById("trendType").value;
  const clubShots=shots.filter(s=>s.club===trendClub),latest=distanceStats(clubShots.slice(-300),type),lifetime=distanceStats(clubShots,type);
  const points=distanceTrend(clubShots,type);
  document.getElementById("distanceMetrics").innerHTML=`<div class="metrics"><div class="metric">直近300球の平均<strong>${fmt(latest.avg)} <small>yd</small></strong><span class="hint">計算対象 ${latest.n}球</span></div><div class="metric">全記録の最大<strong>${lifetime.max===null?"—":lifetime.max} <small>yd</small></strong><span class="hint">距離記録 ${lifetime.n}球</span></div><div class="metric">直近300球の最大<strong>${latest.max===null?"—":latest.max} <small>yd</small></strong></div><div class="metric">距離のばらつき<strong>±${fmt(latest.sd)} <small>yd</small></strong><span class="hint">標準偏差・ミス含む</span></div></div>`;
  const chart=document.getElementById("distanceChart");
  if(!points.length)chart.innerHTML='<p class="muted">このクラブ・距離種別の飛距離記録がまだありません。記録画面のスライダーを調整して、打球結果をタップしてください。</p>';
  else chart.innerHTML=trendSvg(points,`${trendClub} ${typeLabel(type)}の直近300球平均の推移`);
  document.getElementById("distanceTable").innerHTML=points.length?`<table><thead><tr><th>日付</th><th>300球平均</th><th>対象球数</th><th>当日平均</th><th>当日最大</th></tr></thead><tbody>${[...points].reverse().map(p=>`<tr><td>${p.date}</td><td>${fmt(p.avg)}yd</td><td>${p.n}</td><td>${fmt(p.dailyAvg)}yd</td><td>${p.dailyMax===null?"—":p.dailyMax}yd</td></tr>`).join("")}</tbody></table>`:'<p class="hint">データなし</p>';
  const overview=document.getElementById("distanceOverview");overview.innerHTML="";
  names.forEach(c=>{
    const recent=recentClubShots(c,shots),s=distanceStats(recent,type);const d=document.createElement("div");d.className="stat";
    d.innerHTML=`<strong>${escapeHtml(c)}</strong><span>${fmt(s.avg)}yd</span><span class="hint">最大 ${s.max===null?"—":s.max}yd / ばらつき ±${fmt(s.sd)}yd</span><span class="hint">${s.n}/${recent.length}球</span>`;overview.appendChild(d);
  });
}
function trendSvg(points,label){
  const w=600,h=270,l=54,r=20,t=22,b=42;
  const values=points.map(p=>p.avg),low=Math.max(0,Math.floor((Math.min(...values)-10)/10)*10),high=Math.max(low+20,Math.ceil((Math.max(...values)+10)/10)*10);
  const first=points[0].ts,last=points[points.length-1].ts;
  const x=p=>first===last?(l+w-r)/2:l+(p.ts-first)/(last-first)*(w-l-r);
  const y=v=>h-b-(v-low)/(high-low)*(h-t-b);
  let svg=`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title><desc>${points.length}日分。最新平均${fmt(points[points.length-1].avg)}ヤード。日別の数値表も参照できます。</desc>`;
  for(let i=0;i<=4;i++){const v=low+(high-low)*i/4;svg+=`<line x1="${l}" y1="${y(v)}" x2="${w-r}" y2="${y(v)}" stroke="#e5e7eb"/><text x="${l-8}" y="${y(v)+4}" text-anchor="end" font-size="12" fill="#6b7280">${Math.round(v)}</text>`;}
  svg+=`<text x="${l}" y="14" font-size="12" fill="#6b7280">yd</text><polyline fill="none" stroke="#2563eb" stroke-width="3" points="${points.map(p=>`${x(p)},${y(p.avg)}`).join(" ")}"/>`;
  points.forEach(p=>{svg+=`<circle cx="${x(p)}" cy="${y(p.avg)}" r="4" fill="#2563eb"><title>${p.date}：${fmt(p.avg)}yd（${p.n}球）</title></circle>`;});
  svg+=`<text x="${l}" y="${h-12}" font-size="12" fill="#6b7280">${points[0].date}</text><text x="${w-r}" y="${h-12}" text-anchor="end" font-size="12" fill="#6b7280">${points[points.length-1].date}</text></svg>`;
  return svg;
}
