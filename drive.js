 'use strict';
const DRIVE_CLIENT_ID='518989825136-qus182hobh099blu9s6408ibe08sptbh.apps.googleusercontent.com';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
let driveToken='',driveExpires=0,driveBusy=false,drivePage='',driveFiles=[];
function driveStatus(s){$('drive-status').textContent=s;$('drive-status').hidden=false}
function driveLock(b){driveBusy=b;for(const id of ['drive-save','drive-load','drive-more'])$(id).disabled=b;for(const button of $('drive-files').querySelectorAll('button'))button.disabled=b}
function driveAuth(){
 if(driveToken&&Date.now()<driveExpires)return Promise.resolve();
 if(location.protocol==='file:')return Promise.reject(Error('http://localhost:8000에서 이용해 주세요.'));
 if(!globalThis.google?.accounts?.oauth2)return Promise.reject(Error('Google 로그인을 준비하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.'));
 return new Promise((resolve,reject)=>{
 const client=google.accounts.oauth2.initTokenClient({client_id:DRIVE_CLIENT_ID,scope:DRIVE_SCOPE,callback:r=>{
 if(r.error||!r.access_token){reject(Error('Google 연결이 취소되었거나 거부되었습니다.'));return}
 if(!google.accounts.oauth2.hasGrantedAllScopes(r,DRIVE_SCOPE)){reject(Error('드라이브 저장 권한을 허용해 주세요.'));return}
 driveToken=r.access_token;driveExpires=Date.now()+Math.max(0,Number(r.expires_in)-60)*1000;resolve();
 },error_callback:e=>reject(Error(e.type==='popup_closed'?'Google 로그인 창을 닫았습니다.':'로그인 팝업을 열 수 없습니다. 팝업을 허용해 주세요.'))});client.requestAccessToken({prompt:'select_account'});
 });
}
async function driveRequest(path,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch('https://www.googleapis.com/'+path,{...options,headers:{...options.headers,Authorization:`Bearer ${driveToken}`},signal:controller.signal});
 if(response.status===401){driveToken='';driveExpires=0;throw Error('Google 연결이 만료되었습니다. 버튼을 다시 눌러 주세요.')}
 if(!response.ok){if(response.status===403)throw Error('접근이 거부되었습니다. Google Drive API 활성화와 계정 권한을 확인해 주세요.');if(response.status===404)throw Error('파일을 찾을 수 없습니다. 목록을 다시 불러와 주세요.');throw Error(`드라이브 요청 실패 (${response.status}). 잠시 후 다시 시도해 주세요.`)}return response;
 }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('네트워크 응답이 없습니다. 저장 요청이었다면 백업 목록을 먼저 확인해 주세요.');throw e}finally{clearTimeout(timer)}
}
async function driveRun(action){if(driveBusy)return;$('drive-menu').open=false;$('settings-dialog').close();driveLock(true);try{await driveAuth();await action()}catch(e){driveStatus(e.message);toast(e.message)}finally{driveLock(false)}}
async function saveDrive(){
 const snapshot=JSON.stringify({version:1,exportedAt:new Date().toISOString(),records},null,2),count=records.length;
 if(!validRecords(records))throw Error('기록을 확인한 후 다시 저장해 주세요.');
 if(new Blob([snapshot]).size>5000000)throw Error('드라이브 백업은 5MB 이하만 지원합니다. 백업할 기록의 용량을 줄여 주세요.');
 if(!count&&!confirm('현재 기록이 없습니다. 빈 백업을 저장할까요?'))return;
 driveStatus('드라이브에 저장 중…');
 const name=`운행노트-${localDate()}-${new Date().toTimeString().slice(0,8).replaceAll(':','')}.json`;
 const boundary='ledger_'+Date.now()+'_'+Math.random().toString(36).slice(2);
 const metadata={name,mimeType:'application/json',appProperties:{application:'driver-ledger',version:'1'}};
 const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${snapshot}\r\n--${boundary}--`;
 await driveRequest('upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
 driveStatus(`${count}건 저장 완료 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`);toast('드라이브에 새 JSON 백업을 저장했습니다.');
}
async function listDrive(append=false){
 driveStatus('백업 목록을 불러오는 중…');
 const params=new URLSearchParams({q:"trashed = false and appProperties has { key='application' and value='driver-ledger' }",fields:'nextPageToken,files(id,name,modifiedTime,size)',orderBy:'modifiedTime desc',pageSize:'30',spaces:'drive'});
 if(append&&drivePage)params.set('pageToken',drivePage);
 const data=await(await driveRequest('drive/v3/files?'+params)).json();driveFiles=append?driveFiles.concat(data.files||[]):data.files||[];drivePage=data.nextPageToken||'';$('drive-files').replaceChildren();
 for(const file of driveFiles){const button=document.createElement('button'),title=document.createElement('strong'),date=document.createElement('small');button.className='drive-file';title.textContent=file.name;date.textContent=new Date(file.modifiedTime).toLocaleString('ko-KR');button.append(title,date);button.onclick=()=>driveRun(()=>restoreDrive(file));$('drive-files').append(button)}
 if(!driveFiles.length)$('drive-files').textContent='백업이 없습니다. 먼저 드라이브에 저장해 주세요.';
 $('drive-more').hidden=!drivePage;if(!$('drive-picker').open)$('drive-picker').showModal();driveStatus('Google 연결됨 · 이 앱에서 저장한 백업입니다.');
}
async function restoreDrive(file){
 if(Number(file.size)>20000000)throw Error('20MB 이하의 백업만 불러올 수 있습니다.');driveStatus('백업을 확인하는 중…');
 const response=await driveRequest(`drive/v3/files/${encodeURIComponent(file.id)}?alt=media`);let data;try{data=await response.json()}catch{throw Error('올바른 JSON 백업이 아닙니다.')}
 if(!data||data.version!==1||!validRecords(data.records))throw Error('올바른 운행노트 백업이 아닙니다. 현재 기록은 유지됩니다.');
 if(!confirm(`${file.name}\n백업 ${data.records.length}건으로 현재 기록 ${records.length}건을 교체할까요?\n필요하면 취소 후 현재 기록을 먼저 저장하세요.`)){driveStatus('불러오기를 취소했습니다.');return}
 if(!commit(data.records))throw Error('브라우저에 저장하지 못했습니다. 현재 기록은 유지됩니다.');$('drive-picker').close();driveStatus(`${records.length}건 불러오기 완료`);toast('드라이브 백업을 불러왔습니다.');
}
$('drive-save').onclick=()=>driveRun(saveDrive);$('drive-load').onclick=()=>driveRun(()=>listDrive());$('drive-more').onclick=()=>driveRun(()=>listDrive(true));$('drive-close').onclick=()=>$('drive-picker').close();
