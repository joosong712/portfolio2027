export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})
}
export function escapeHtml(input='') {
  return String(input??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}
export function publicOrigin(env, request) {
  try {return new URL(env.SITE_URL||request.url).origin} catch {return new URL(request.url).origin}
}
export function projectRecord(row, origin, admin=false) {
  const p={id:row.id,slug:row.slug,name:row.title,category:row.category,industry:row.industry||'',role:row.role||'',year:row.year||null,tech:JSON.parse(row.tech_json||'[]'),summary:row.summary||'',url:row.site_url||null,image_url:row.image_key?`${origin}/media/${row.image_key}`:null,detail_image_url:(row.detail_image_key||row.image_key)?`${origin}/media/${row.detail_image_key||row.image_key}`:null,sort_order:row.sort_order||0}
  if(admin) {p.published=!!row.published;p.image_key=row.image_key||null;p.detail_image_key=row.detail_image_key||null}
  return p
}
function decodeBase64Url(str){const base=str.replace(/-/g,'+').replace(/_/g,'/');const binary=atob(base.padEnd(Math.ceil(base.length/4)*4,'='));return Uint8Array.from(binary,c=>c.charCodeAt(0))}
export async function requireAdmin(context){
  const {request,env}=context
  if(!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD || !env.ADMIN_EMAIL)return json({error:'관리자 인증 환경변수가 설정되지 않았습니다.'},503)
  const token=request.headers.get('Cf-Access-Jwt-Assertion')
  if(!token)return json({error:'Cloudflare Access 로그인이 필요합니다.'},401)
  const chunks=token.split('.')
  if(chunks.length!==3)return json({error:'인증 토큰 형식 오류'},401)
  try {
    const header=JSON.parse(new TextDecoder().decode(decodeBase64Url(chunks[0])))
    const payload=JSON.parse(new TextDecoder().decode(decodeBase64Url(chunks[1])))
    const domain=env.CF_ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//,'').replace(/\/$/,'')
    if(header.alg!=='RS256' || !header.kid)return json({error:'허용되지 않은 인증 알고리즘'},401)
    const aud=Array.isArray(payload.aud)?payload.aud:[payload.aud]
    const now=Math.floor(Date.now()/1000)
    if(payload.iss!==`https://${domain}` || !aud.includes(env.CF_ACCESS_AUD) || payload.exp<=now || payload.nbf>now+60 || String(payload.email||'').toLowerCase()!==env.ADMIN_EMAIL.toLowerCase())return json({error:'관리자 권한이 없습니다.'},403)
    const keys=await fetch(`https://${domain}/cdn-cgi/access/certs`,{cf:{cacheTtl:300}}).then(r=>{if(!r.ok)throw Error('JWKS fetch failed');return r.json()})
    const jwk=(keys.keys||[]).find(k=>k.kid===header.kid && k.kty==='RSA')
    if(!jwk)return json({error:'인증키를 찾을 수 없습니다.'},401)
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify'])
    const verified=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,decodeBase64Url(chunks[2]),new TextEncoder().encode(chunks[0]+'.'+chunks[1]))
    if(!verified)return json({error:'인증 서명 오류'},401)
    const origin=request.headers.get('Origin')
    if(!['GET','HEAD','OPTIONS'].includes(request.method) && origin && origin!==new URL(request.url).origin)return json({error:'요청 출처가 올바르지 않습니다.'},403)
    return null
  }catch(e){return json({error:'관리자 인증을 확인하지 못했습니다.'},401)}
}
export function cleanProject(input){
  if(!input || typeof input!=='object' || Array.isArray(input))throw Error('프로젝트 데이터가 올바르지 않습니다.')
  const title=String(input.name||'').trim(), category=input.category
  if(title.length<1||title.length>120)throw Error('프로젝트명은 1~120자로 입력하세요.')
  if(!['custom','template'].includes(category))throw Error('카테고리를 확인하세요.')
  const industry=String(input.industry||'').trim(),role=String(input.role||'').trim(),summary=String(input.summary||'').trim()
  if(industry.length>100||role.length>180||summary.length>2000)throw Error('입력 가능한 글자 수를 초과했습니다.')
  const year=input.year==null||input.year===''?null:Number(input.year)
  if(year!==null && (!Number.isInteger(year)||year<1990||year>2100))throw Error('제작 연도를 확인하세요.')
  let siteURL=null
  if(input.url){const u=new URL(input.url);if(!['http:','https:'].includes(u.protocol))throw Error('외부 링크는 http 또는 https만 가능합니다.');siteURL=u.toString()}
  const tech=Array.isArray(input.tech)?input.tech.map(x=>String(x).trim()).filter(Boolean):[]
  if(tech.length>15 || tech.some(t=>t.length>45))throw Error('기술 태그를 확인하세요.')
  const imageKey=String(input.image_key||'').trim()||null
  const detailImageKey=String(input.detail_image_key||'').trim()||null
  if([imageKey,detailImageKey].some(key=>key&&!/^[a-f0-9-]{36}\.(webp|png|jpg)$/.test(key)))throw Error('이미지 키가 올바르지 않습니다.')
  const slug=String(input.slug||'').trim()||('project-'+crypto.randomUUID().slice(0,12))
  if(!/^[a-z0-9][a-z0-9-]{2,90}$/.test(slug))throw Error('슬러그는 영문 소문자·숫자·하이픈으로 입력하세요.')
  const sort=Number(input.sort_order||0)
  if(!Number.isInteger(sort)||Math.abs(sort)>100000)throw Error('정렬 순서가 올바르지 않습니다.')
  return {title,category,industry,role,summary,year,siteURL,tech,imageKey,detailImageKey,slug,sort,published:input.published===true}
}
