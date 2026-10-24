/* Public OAuth client ID only. Tokens stay in memory; no client secret is used. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const CLIENT_ID = '167184417067-etmjiftgnlhull1bl38nr8l4uau8ru76.apps.googleusercontent.com';
  const state = {token:'', expires:0, folder:'', media:null, rec:null, busy:false,
    speechActive:false, starting:false, sessionId:'', generation:0, saved:0};
  let authPromise = null, rotateTimer = null, retryTimer = null;
  const msg = text => { $('driveStatus').textContent = text; };
  const access = () => !!state.token && Date.now() < state.expires - 60000;
  const dbp = new Promise((resolve,reject) => {
    const request = indexedDB.open('baachan-talk-uploads',1);
    request.onupgradeneeded = () => request.result.createObjectStore('pending',{keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // Attach a rejection handler immediately; report failure when saving is requested.
  dbp.catch(() => msg('このブラウザーでは一時保存できません。保存しない版をご利用ください。'));
  async function pending(method, value) {
    const db = await dbp;
    return new Promise((resolve,reject) => {
      const tx = db.transaction('pending', method === 'all' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('pending');
      const request = method === 'all' ? store.getAll() : method === 'put' ? store.put(value) : store.delete(value);
      let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error('一時保存が中断されました'));
    });
  }
  async function api(url, options = {}) {
    if (!access()) throw new Error('Googleに再接続してください');
    const response = await fetch(url, {...options, headers:{...options.headers, Authorization:'Bearer '+state.token}});
    if (!response.ok) {
      if (response.status === 401) { state.token=''; state.expires=0; }
      throw new Error('Driveへの保存に失敗しました（'+response.status+'）。未送信データはこの端末に残っています');
    }
    return response;
  }
  async function folder() {
    if (state.folder) return state.folder;
    const query = "name = 'ばあちゃんトーク' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    const response = await api('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(query)+'&fields=files(id,name)&pageSize=100');
    const found = (await response.json()).files || [];
    if (found.length) return state.folder=found[0].id;
    const created = await api('https://www.googleapis.com/drive/v3/files?fields=id', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:'ばあちゃんトーク',mimeType:'application/vnd.google-apps.folder'})
    });
    return state.folder=(await created.json()).id;
  }
  async function upload(item) {
    const parent = await folder();
    let existing = false;
    // Persist a Drive-generated ID before uploading, making retries idempotent.
    if (!item.driveId) {
      const response = await api('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive');
      item.driveId = (await response.json()).ids[0];
      await pending('put',item);
    } else {
      const response = await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(item.driveId)+'?fields=id,size', {headers:{Authorization:'Bearer '+state.token}});
      if (response.ok) {
        existing = true;
        if (Number((await response.json()).size) === item.blob.size) return;
      }
      if (!response.ok && response.status !== 404) throw new Error('保存状態を確認できません。再接続して再送してください');
    }
    const init = await api('https://www.googleapis.com/upload/drive/v3/files'+(existing?'/'+encodeURIComponent(item.driveId):'')+'?uploadType=resumable&fields=id', {
      method:existing?'PATCH':'POST', headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':item.mime},
      body:JSON.stringify(existing?{}:{id:item.driveId,name:item.filename,parents:[parent],description:'Baachan Talk private recording'})
    });
    const location = init.headers.get('Location');
    if (!location) throw new Error('アップロード先を取得できません');
    await api(location,{method:'PUT',headers:{'Content-Type':item.mime},body:item.blob});
  }
  async function flush() {
    if (state.busy) return;
    state.busy=true;
    try {
      let items = await pending('all');
      if (!items.length) { if (access()) msg(state.saved ? 'Google Driveに自動保存済み' : 'Google Drive接続済み。話しはじめると自動保存します'); return; }
      if (!access()) { msg('未送信データはこの端末に保存中です。「Googleに接続」で自動送信します'); return; }
      while (items.length && access()) {
        msg('Google Driveに自動保存しています…');
        for (const item of items) { await upload(item); await pending('delete',item.id); state.saved++; }
        items = await pending('all');
      }
      msg(items.length ? 'Googleに再接続してください。未送信データはこの端末に残っています' : 'Google Driveに自動保存済み');
    } catch (error) { msg(error.message); }
    finally { state.busy=false; }
  }
  async function enqueue(blob, extension, mime, session = state.sessionId) {
    if (!blob.size) return;
    const stamp = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'}).replace(/[ :]/g,'-');
    const id = session+'-'+Date.now()+'-'+crypto.randomUUID();
    await pending('put',{id,blob,mime,filename:stamp+'-'+id.slice(-8)+'.'+extension});
    await flush();
  }
  function connect() {
    if (access()) return Promise.resolve(true);
    if (authPromise) return authPromise;
    if (!window.google?.accounts?.oauth2) { msg('Google接続の準備中です。少し待ってもう一度押してください'); return Promise.resolve(false); }
    msg('Googleに接続しています…');
    authPromise = new Promise(resolve => {
      const finish = value => { authPromise=null; resolve(value); };
      try {
        google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:'https://www.googleapis.com/auth/drive.file',
          error_callback:() => { msg('接続を完了できませんでした。「Googleに接続」を押してください'); finish(false); },
          callback:response => {
            if (response.error || !response.access_token) { msg('Google接続が許可されませんでした'); finish(false); return; }
            if (!google.accounts.oauth2.hasGrantedAllScopes(response,'https://www.googleapis.com/auth/drive.file')) {
              msg('自動保存にはDriveへのアクセス許可が必要です'); finish(false); return;
            }
            state.token=response.access_token; state.expires=Date.now()+(response.expires_in||3600)*1000;
            state.folder=''; msg('Google Drive接続済み。自動保存が有効です'); finish(true); flush();
          }
        }).requestAccessToken({prompt:''});
      } catch (error) { msg('Googleに接続できませんでした。もう一度お試しください'); finish(false); }
    });
    // Synchronous SDK errors may resolve before the assignment above finishes.
    const current = authPromise; current.finally(() => { if (authPromise===current) authPromise=null; });
    return current;
  }
  function recordSegment(stream, generation, session) {
    if (!state.speechActive || generation !== state.generation) return;
    const types=['audio/mp4','audio/webm;codecs=opus','audio/webm'];
    const mime=types.find(type=>MediaRecorder.isTypeSupported(type))||'';
    const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
    state.rec=recorder;
    const contentType=recorder.mimeType||'audio/webm';
    const chunks=[];
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onstop=()=>{
      enqueue(new Blob(chunks,{type:contentType}),contentType.includes('mp4')?'m4a':'webm',contentType,session)
        .catch(()=>msg('音声を一時保存できませんでした。端末の空き容量を確認してください'));
      if(state.rec===recorder)state.rec=null;
      if(state.speechActive && generation===state.generation) {
        try { recordSegment(stream,generation,session); } catch { msg('録音が停止しました。文字は自動保存を続けます'); }
      }
    };
    recorder.onerror=()=>msg('録音エラー。文字は自動保存を続けます');
    // Each minute is a complete recording file, including its own media header.
    recorder.start();
    rotateTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},60000);
  }
  function start() {
    if(state.speechActive)return;
    state.speechActive=true; state.sessionId=new Date().toISOString().replace(/[:.]/g,'-');
    const generation=++state.generation, session=state.sessionId;
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { msg('このブラウザーでは音声録音に未対応です。文字は自動保存します'); return; }
    state.starting=true;
    navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}).then(stream=>{
      if(!state.speechActive || generation!==state.generation){stream.getTracks().forEach(track=>track.stop());return;}
      state.media=stream;
      try { recordSegment(stream,generation,session); msg('自動保存中：文字は話した区切りごと、音声は約1分ごとに保存します'); }
      catch { stream.getTracks().forEach(track=>track.stop()); state.media=null; msg('録音できません。文字は自動保存します'); }
    }).catch(()=>msg('録音できません。マイク許可を確認してください。文字は自動保存します'))
      .finally(()=>{state.starting=false;});
  }
  function stop() {
    state.speechActive=false; state.generation++; clearTimeout(rotateTimer);
    const recorder=state.rec; state.rec=null;
    if(recorder && recorder.state!=='inactive')recorder.stop();
    if(state.media)state.media.getTracks().forEach(track=>track.stop());
    state.media=null; flush();
  }
  $('driveLogin').onclick=connect;
  $('driveRetry').onclick=async()=>{if(await connect())await flush();};
  window.BTDrive={prepare:async()=>{if(!await connect())return false;try{await dbp;return true;}catch{msg('一時保存を利用できません。保存しない版をご利用ください');return false;}},
    start,stop,final(text){if(state.speechActive && text)enqueue(new Blob([text+'\n'],{type:'text/plain;charset=utf-8'}),'txt','text/plain').catch(()=>msg('文字を一時保存できませんでした。端末の空き容量を確認してください'));},flush};
  window.addEventListener('online',flush);
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden' && state.rec?.state==='recording') {clearTimeout(rotateTimer);state.rec.stop();}});
  retryTimer=setInterval(flush,30000);
  msg('自動保存版：「話しはじめる」でGoogleに接続し、自動保存を開始します');
})();