import {json,requireAdmin,cleanProject,projectRecord,publicOrigin} from '../../_shared.js'
export async function onRequestGet(ctx){
  const denied=await requireAdmin(ctx);if(denied)return denied
  try{const {results}=await ctx.env.DB.prepare(`SELECT * FROM projects ORDER BY sort_order ASC, CASE WHEN category='template' AND sort_order>=0 THEN id END ASC, CASE WHEN category='template' AND sort_order<0 THEN id END DESC, CASE WHEN category='custom' THEN id END DESC LIMIT 500`).all();return json({projects:results.map(r=>projectRecord(r,publicOrigin(ctx.env,ctx.request),true))})}
  catch{return json({error:'관리자 데이터를 불러오지 못했습니다.'},503)}
}
export async function onRequestPost(ctx){
  const denied=await requireAdmin(ctx);if(denied)return denied
  try{
    const data=cleanProject(await ctx.request.json())
    for(const key of [data.imageKey,data.detailImageKey]){
      if(key && !(await ctx.env.MEDIA.head(key)))return json({error:'업로드된 이미지가 없습니다.'},400)
    }
    // 기존 템플릿(0)은 등록 순서를 유지하고 신규 템플릿(-1)은 가장 위에 배치합니다.
    // 이후 등록되는 템플릿들도 -1 그룹에서 최신 등록순으로 정렬됩니다.
    const sortOrder = data.category === 'template' && data.sort === 0 ? -1 : data.sort
    const q='INSERT INTO projects(slug,title,category,industry,role,year,tech_json,summary,site_url,image_key,detail_image_key,published,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)'
    const result=await ctx.env.DB.prepare(q).bind(data.slug,data.title,data.category,data.industry,data.role,data.year,JSON.stringify(data.tech),data.summary,data.siteURL,data.imageKey,data.detailImageKey,+data.published,sortOrder).run()
    return json({id:result.meta.last_row_id,slug:data.slug},201)
  }catch(e){return json({error:String(e.message||'등록에 실패했습니다.').slice(0,200)},400)}
}
