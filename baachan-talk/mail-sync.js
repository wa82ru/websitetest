/* No sender credentials are included in this public file. */
(() => {
  'use strict';
  const ENDPOINT=window.BT_MAIL_ENDPOINT||'';
  const config=()=>{try{return JSON.parse(localStorage.getItem('bt-mail-device')||'null');}catch{return null;}};
  let active=false,generation=0,stream=null,recorder=null,timer=null,busy=false,current=null;
  const dbp=new Promise((resolve,reject)=>{const r=indexedDB.open('baachan-talk-mail',1);r.onupgradeneeded=()=>r.result.createObjectStore('pending',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  dbp.catch(()=>{});
  function status(text){const e=document.getElementById('notice');if(e){e.textContent=text;e.classList.add('error');}}
  async function db(method,value){const database=await dbp;return new Promise((resolve,reject)=>{const tx=database.transaction('pending',method==='all'?'readonly':'readwrite'),store=tx.objectStore('pending');const r=method==='all'?store.getAll():method==='put'?store.put(value):store.delete(value);let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||r.error);});}
  function base64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
  async function flush(){
    if(busy||!navigator.onLine)return;
    const c=config();if(!c?.key||!ENDPOINT)return;
    busy=true;
    try {
      let items=await db('all');
      while(items.length){
        for(const item of items){
          const audio=item.blob?.size?await base64(item.blob):'';
          const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},redirect:'follow',
            body:JSON.stringify({key:c.key,item:{id:item.id,started:item.started,text:item.text,mime:item.mime,audio}})});
          if(!response.ok)throw new Error('通信を確認してください。記録はこの端末に残しています。');
          const result=await response.json();
          if(!result.ok)throw new Error(result.error==='unauthorized'?'この端末の接続設定を確認してください。':result.error==='daily_limit'?'本日の送信上限に達しました。記録は端末に残し、後で再送します。':'通信を確認してください。記録はこの端末に残しています。');
          await db('delete',item.id);
        }
        items=await db('all');
      }
    }catch(error){status(error.message);}finally{busy=false;}
  }
  function segment(){return{id:crypto.randomUUID(),started:new Date().toISOString(),text:[],mime:'',blob:null};}
  async function queue(item){item.text=item.text.join('\n');if(!item.text&&!item.blob?.size)return;await db('put',item);flush();}
  function save(item){queue(item).catch(()=>status('端末の空き容量を確認してください。記録を残せませんでした。'));}
  function rotate(){
    clearTimeout(timer);
    if(recorder?.state==='recording'){recorder.stop();return;}
    const item=current;current=active?segment():null;if(item)save(item);
    if(active)timer=setTimeout(rotate,300000);
  }
  function beginAudio(s,g){
    if(!active||g!==generation)return;
    const item=current;
    const type=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    const r=new MediaRecorder(s,{...(type?{mimeType:type}:{}),audioBitsPerSecond:64000});
    recorder=r;item.mime=r.mimeType||'audio/webm';const chunks=[];
    r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    r.onstop=()=>{
      item.blob=new Blob(chunks,{type:item.mime});save(item);
      if(recorder===r)recorder=null;
      if(active&&g===generation){current=segment();try{beginAudio(s,g);}catch{timer=setTimeout(rotate,300000);status('音声を記録できません。文字表示は続けます。');}}
    };
    r.onerror=()=>status('音声を記録できません。文字表示は続けます。');
    r.start();timer=setTimeout(()=>{if(r.state==='recording')r.stop();},300000);
  }
  function start(){
    if(active)return;active=true;const g=++generation;current=segment();timer=setTimeout(rotate,300000);
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return;
    navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}).then(s=>{
      if(!active||g!==generation){s.getTracks().forEach(t=>t.stop());return;}
      stream=s;clearTimeout(timer);try{beginAudio(s,g);}catch{timer=setTimeout(rotate,300000);status('音声を記録できません。文字表示は続けます。');}
    }).catch(()=>status('マイクの許可を確認してください。'));
  }
  function stop(){
    if(!active)return;active=false;generation++;clearTimeout(timer);
    const r=recorder;recorder=null;
    if(r&&r.state!=='inactive')r.stop();else if(current)save(current);
    current=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;
    flush();
  }
  window.BTMail={async prepare(){const c=config();if(!c?.key||!ENDPOINT){status('初回の端末登録が必要です。設定用ページで登録してください。');return false;}try{await dbp;flush();return true;}catch{status('このブラウザーでは記録を残せません。ブラウザーの設定を確認してください。');return false;}},
    start,stop,final(text){if(active&&current&&text)current.text.push(text);},flush};
  window.addEventListener('online',flush);window.addEventListener('pagehide',stop);
  setInterval(flush,30000);flush();
})();