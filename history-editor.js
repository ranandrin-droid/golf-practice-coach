const SHOT_RESULTS=["左・良","中央・良","右・良","左・普通","中央・普通","右・普通","左・悪","中央・悪","右・悪","トップ","ダフリ","シャンク"];
function historyDay(item){
  if(item.shots?.length)return dayKey(item.shots[0].ts);
  const m=String(item.date||"").match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:dayKey(item.savedAt||Date.now());
}
function historyReport(item){
  let text=`${item.date} ゴルフ練習\n総球数 ${item.total}球 / 目標 ${item.target}球\n\n`;
  [...new Set(item.shots.map(s=>s.club))].forEach(c=>{
    const s=clubStats(c,item.shots);
    text+=`${c} ${s.n}球\n中央 ${s.center} / 左 ${s.left} / 右 ${s.right}\n良い当たり ${s.good}/${s.n} (${pct(s.good,s.n)}%)\nトップ ${s.top} / ダフリ ${s.fat} / シャンク ${s.shank}\n${distanceSummary(c,item.shots)}\n\n`;
  });
  return text+`感覚メモ\n${item.memo||"なし"}`;
}
function createEditedHistory(item,form){
  const day=new Date(`${form.day}T00:00:00`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(form.day)||!Number.isFinite(day.getTime())||dayKey(day.getTime())!==form.day)throw Error("練習日を正しく入力してください。");
  const target=Number(form.target);
  if(!Number.isInteger(target)||target<1||target>999)throw Error("目標球数は1〜999球で入力してください。");
  const next={...item,date:form.day,target,memo:String(form.memo),updatedAt:Date.now()};
  if(Array.isArray(item.shots)){
    const shift=day.getTime()-new Date(`${historyDay(item)}T00:00:00`).getTime();
    next.shots=form.shots.flatMap((row,index)=>{
      if(row.remove)return [];
      const original=item.shots[index];if(!original)throw Error("記録が一致しません。編集を開き直してください。");
      const club=String(row.club).trim();
      if(!club||club.length>60)throw Error(`${index+1}球目のクラブ名を1〜60文字で入力してください。`);
      if(!SHOT_RESULTS.includes(row.result))throw Error(`${index+1}球目の打球結果を選んでください。`);
      if(!["total","carry"].includes(row.type))throw Error("距離種別を選んでください。");
      let distance=null;
      if(!row.unknown){
        distance=Number(row.distance);
        const preserved=distance===original.distance&&row.type===original.distanceType&&distance>300&&distance<=400;
        if(String(row.distance).trim()===""||!Number.isInteger(distance)||distance<0||(distance>300&&!preserved))throw Error(`${index+1}球目の飛距離は0〜300ydの整数で入力してください。`);
      }
      const special=["トップ","ダフリ","シャンク"].includes(row.result)?row.result:"";
      const [dir,contact]=special?["",""]:row.result.split("・");
      return [{...original,club,dir,contact,special,distance,distanceType:row.type,ts:original.ts+shift}];
    });
    if(!next.shots.length)throw Error("1球以上残してください。全体を消す場合は履歴の削除を使ってください。");
    next.total=next.shots.length;next.report=historyReport(next);
  }else{
    next.total=Number(form.total);
    if(!Number.isInteger(next.total)||next.total<0||next.total>9999)throw Error("総球数は0〜9999球で入力してください。");
    next.report=String(form.report||"");
  }
  return next;
}
function commitHistoryEdit(item,next){
  const index=history.indexOf(item);if(index<0)throw Error("履歴が見つかりません。");
  const oldState={...state,shots:state.shots};
  history[index]=next;
  const isCurrent=item.sessionId===state.sessionId&&Array.isArray(next.shots);
  try{
    if(isCurrent){state.shots=next.shots.map(s=>({...s}));state.memo=next.memo;state.target=next.target;save();}
    saveHistory();
  }catch(error){history[index]=item;Object.assign(state,oldState);try{save();}catch{}throw Error("保存できませんでした。端末の空き容量を確認してください。");}
  renderAll();
}
function openHistoryEditor(item,details){
  if(details.querySelector(".history-editor"))return;
  const editor=document.createElement("div");editor.className="history-editor";
  const current=item.sessionId===state.sessionId;
  editor.innerHTML=`<strong>履歴を編集</strong><p class="hint">${current?"この履歴は現在の練習と同じです。保存すると記録画面の内容も更新します。":"保存するとクラブ別集計・飛距離の推移も更新します。"}</p>
    <label>練習日 <input class="edit-day" type="date" value="${historyDay(item)}" /></label>
    <label>目標球数 <input class="edit-target" type="number" min="1" max="999" value="${Number(item.target)||100}" /></label>
    <label>感覚メモ <textarea class="edit-memo">${escapeHtml(item.memo||"")}</textarea></label>`;
  if(Array.isArray(item.shots)){
    const records=document.createElement("details");records.innerHTML='<summary>1球ごとの記録を編集</summary><p class="hint">除外にチェックすると、その球は保存後の集計から外れます。既存の300yd超の距離は変更しない限り保持します。</p>';
    item.shots.forEach((shot,i)=>{
      const row=document.createElement("div");row.className="edit-shot";
      row.innerHTML=`<strong>${i+1}球目</strong><div class="edit-fields"><label>クラブ<input class="edit-club" type="text" maxlength="60" value="${escapeHtml(shot.club)}" /></label><label>打球結果<select class="edit-result">${SHOT_RESULTS.map(result=>`<option value="${result}" ${result===(shot.special||`${shot.dir}・${shot.contact}`)?"selected":""}>${result}</option>`).join("")}</select></label><label>飛距離（yd）<input class="edit-distance" type="number" min="0" max="300" step="1" value="${validDistance(shot)?shot.distance:""}" /></label><label>距離種別<select class="edit-type"><option value="total" ${shot.distanceType!=="carry"?"selected":""}>ラン込み</option><option value="carry" ${shot.distanceType==="carry"?"selected":""}>キャリー</option></select></label></div><div class="row"><label><input class="edit-unknown" type="checkbox" ${!validDistance(shot)?"checked":""} /> 距離不明</label><label><input class="edit-remove" type="checkbox" /> この球を除外</label></div>`;
      const input=row.querySelector(".edit-distance"),unknown=row.querySelector(".edit-unknown");
      input.oninput=()=>{unknown.checked=input.value.trim()==="";};records.appendChild(row);
    });editor.appendChild(records);
  }else{
    const legacy=document.createElement("div");legacy.innerHTML=`<p class="hint">旧版の履歴は1球単位で編集できません。保存済みレポート内の集計を直接修正できます。</p><label>総球数 <input class="edit-total" type="number" min="0" max="9999" value="${Number(item.total)||0}" /></label><label>保存済みレポート<textarea class="edit-report" style="min-height:220px">${escapeHtml(item.report||"")}</textarea></label>`;editor.appendChild(legacy);
  }
  const actions=document.createElement("div");actions.className="row";actions.style.marginTop="12px";
  const apply=document.createElement("button");apply.className="primary";apply.textContent="変更を保存";
  const cancel=document.createElement("button");cancel.textContent="キャンセル";cancel.onclick=()=>editor.remove();
  const error=document.createElement("p");error.className="hint";error.style.color="#991b1b";error.setAttribute("role","alert");
  apply.onclick=()=>{
    try{
      const form={day:editor.querySelector(".edit-day").value,target:editor.querySelector(".edit-target").value,memo:editor.querySelector(".edit-memo").value};
      if(Array.isArray(item.shots))form.shots=[...editor.querySelectorAll(".edit-shot")].map(row=>({club:row.querySelector(".edit-club").value,result:row.querySelector(".edit-result").value,distance:row.querySelector(".edit-distance").value,type:row.querySelector(".edit-type").value,unknown:row.querySelector(".edit-unknown").checked,remove:row.querySelector(".edit-remove").checked}));
      else{form.total=editor.querySelector(".edit-total").value;form.report=editor.querySelector(".edit-report").value;}
      const next=createEditedHistory(item,form);commitHistoryEdit(item,next);alert("履歴を更新しました。");
    }catch(e){error.textContent=e.message;}
  };
  actions.appendChild(apply);actions.appendChild(cancel);editor.appendChild(actions);editor.appendChild(error);details.appendChild(editor);editor.scrollIntoView({behavior:"smooth",block:"start"});
}
function deleteHistoryItem(item){
  if(!confirm(`「${item.date}・${item.total}球」を削除済みに移動しますか？復元できます。${item.sessionId===state.sessionId?"現在の練習記録は残ります。":"飛距離の集計からも外れます。"}`))return;
  item.deletedAt=Date.now();try{saveHistory();}catch{delete item.deletedAt;alert("削除を保存できませんでした。");return;}renderAll();
}
function renderDeletedHistory(){
  const el=document.getElementById("deletedHistoryList");el.innerHTML="";
  const deleted=history.filter(h=>h.deletedAt);
  if(!deleted.length){el.textContent="削除済みの履歴はありません。";return;}
  [...deleted].reverse().forEach(item=>{
    const row=document.createElement("div");row.className="history-item";
    const title=document.createElement("p");title.textContent=`${item.date} ・ ${item.total}球`;
    const restore=document.createElement("button");restore.className="small";restore.textContent="この履歴を復元";
    restore.onclick=()=>{const previous=item.deletedAt;delete item.deletedAt;try{saveHistory();}catch{item.deletedAt=previous;alert("復元を保存できませんでした。");return;}renderAll();};
    row.appendChild(title);row.appendChild(restore);el.appendChild(row);
  });
}
