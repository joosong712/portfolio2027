const $=id=>document.getElementById(id)
const list=$('project-list'),status=$('status')
let projects=[]
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]))
async function api(url,options={}){
  const response=await fetch(url,{...options,headers:{...(options.headers||{}),'Accept':'application/json'}})
  const data=await response.json().catch(()=>({error:`HTTP ${response.status}`}))
  if(!response.ok)throw Error(data.error||`HTTP ${response.status}`)
  return data
}
const read=id=>$(id).value.trim()
const currentImage=()=>read('image-key')
function clear(){ $('form').reset();$('project-id').value='';$('image-key').value='';$('preview').style.display='none';$('preview').removeAttribute('src');$('form-title').textContent='프로젝트 등록';$('submit').textContent='프로젝트 등록';status.textContent='';$('sort-order').value='0' }
function edit(id){
  const p=projects.find(p=>p.id===id);if(!p)return
  $('project-id').value=p.id;$('image-key').value=p.image_key||''
  for(const field of ['name','category','industry','role','year','slug','summary','url'])$(field).value=p[field]??''
  $('sort-order').value=p.sort_order??0;$('tech').value=(p.tech||[]).join(', ');$('published').checked=!!p.published
  $('preview').src=p.image_url||'';$('preview').style.display=p.image_url?'block':'none'
  $('form-title').textContent='프로젝트 수정';$('submit').textContent='변경사항 저장'
  window.scrollTo({top:0,behavior:'smooth'})
}
async function remove(id){
  const p=projects.find(p=>p.id===id)
  if(!p||!confirm(`'${p.name}' 프로젝트를 삭제할까요?`))return
  try{await api('/api/admin/projects/'+id,{method:'DELETE'});status.textContent='삭제했습니다.';if(Number($('project-id').value)===id)clear();await load()}
  catch(e){status.textContent=e.message}
}
function draw(){
  list.innerHTML=projects.length?projects.map(p=>`<article class="item"><img src="${esc(p.image_url||'/og-image.png')}" alt=""><div><strong>${esc(p.name)}</strong><span class="meta">${p.category==='custom'?'제작형':'템플릿'} · ${esc(p.industry)} · ${p.published?'공개':'비공개'}</span></div><div class="actions"><button class="ghost" type="button" data-edit="${p.id}">수정</button><button class="danger" type="button" data-delete="${p.id}">삭제</button></div></article>`).join(''):'아직 등록된 프로젝트가 없습니다.'
}
async function load(){try{const data=await api('/api/admin/projects');projects=data.projects||[];draw()}catch(e){list.textContent=e.message+' Cloudflare Access와 D1 설정을 확인하세요.'}}
list.addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target)return
  if(target.dataset.edit)edit(Number(target.dataset.edit))
  if(target.dataset.delete)remove(Number(target.dataset.delete))
})
$('file').addEventListener('change',e=>{
  const f=e.target.files?.[0]
  if(f){$('preview').src=URL.createObjectURL(f);$('preview').style.display='block'}
})
$('reset').addEventListener('click',clear)
$('form').addEventListener('submit',async e=>{
  e.preventDefault();$('submit').disabled=true;status.textContent='저장 중...'
  try{
    let imageKey=currentImage();const file=$('file').files?.[0]
    if(file){const form=new FormData();form.append('file',file);const img=await api('/api/admin/upload',{method:'POST',body:form});imageKey=img.image_key}
    const body={name:read('name'),category:read('category'),slug:read('slug'),industry:read('industry'),role:read('role'),year:read('year'),summary:read('summary'),url:read('url'),sort_order:Number(read('sort-order')||0),tech:read('tech').split(',').map(s=>s.trim()).filter(Boolean),image_key:imageKey,published:$('published').checked}
    const id=Number($('project-id').value)
    await api(id?'/api/admin/projects/'+id:'/api/admin/projects',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    clear();status.textContent='프로젝트가 저장되었습니다.';await load()
  }catch(e){status.textContent='저장 실패: '+e.message}
  finally{$('submit').disabled=false}
})
load()
