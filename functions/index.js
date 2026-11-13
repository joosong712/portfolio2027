import {publicOrigin,escapeHtml} from './_shared.js'
function cards(rows,origin){return rows.map(p=>{
  const name=escapeHtml(p.title),role=escapeHtml(p.role||''),industry=escapeHtml(p.industry||''),year=p.year||''
  const thumb=p.image_key?`<img class="thumb-art" src="${origin}/media/${p.image_key}" alt="${name} 프로젝트 썸네일" width="800" height="600" loading="lazy" style="object-fit:cover;width:100%;height:100%;padding:0">`:'<div class="thumb-art thumb-art-demo">PROJECT</div>'
  return `<a href="/work/${encodeURIComponent(p.slug)}" class="card in"><div class="thumb">${thumb}<div class="overlay"><strong>${name}</strong><span>View Project</span></div></div><div class="card-info"><h3 class="card-title">${name}</h3><p class="card-role">${role}</p><p class="card-meta">${industry} · ${year}</p></div></a>`
}).join('')}
export async function onRequest(ctx){
  const {request,env}=ctx
  const response=await env.ASSETS.fetch(new URL('/index.html',request.url))
  if(!response.ok)return response
  let html=await response.text()
  const origin=publicOrigin(env,request)
  html=html.replaceAll('__SITE_URL__',origin)
  try{
    const data=await env.DB.prepare('SELECT * FROM projects WHERE published=1 AND category=? ORDER BY sort_order ASC, id DESC LIMIT 6').bind('custom').all()
    html=html.replace('<!--SSR_PROJECTS-->',cards(data.results,origin)||'<p class="project-empty">아직 공개된 프로젝트가 없습니다.</p>')
  }catch{html=html.replace('<!--SSR_PROJECTS-->','<p class="project-empty">프로젝트를 불러오지 못했습니다.</p>')}
  return new Response(html,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'public,max-age=60','x-content-type-options':'nosniff'}})
}
