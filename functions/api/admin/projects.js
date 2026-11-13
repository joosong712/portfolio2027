import {json,requireAdmin,cleanProject,projectRecord,publicOrigin} from '../../_shared.js'
export async function onRequestGet(ctx){
  const denied=await requireAdmin(ctx);if(denied)return denied
  try{const {results}=await ctx.env.DB.prepare('SELECT * FROM projects ORDER BY sort_order ASC,id DESC LIMIT 500').all();return json({projects:results.map(r=>projectRecord(r,publicOrigin(ctx.env,ctx.request),true))})}
  catch{return json({error:'관리자 데이터를 불러오지 못했습니다.'},503)}
}
export async function onRequestPost(ctx){
  const denied=await requireAdmin(ctx);if(denied)return denied
  try{
    const data=cleanProject(await ctx.request.json())
    if(data.imageKey && !(await ctx.env.MEDIA.head(data.imageKey)))return json({error:'업로드된 이미지가 없습니다.'},400)
    const q='INSERT INTO projects(slug,title,category,industry,role,year,tech_json,summary,site_url,image_key,published,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'
    const result=await ctx.env.DB.prepare(q).bind(data.slug,data.title,data.category,data.industry,data.role,data.year,JSON.stringify(data.tech),data.summary,data.siteURL,data.imageKey,+data.published,data.sort).run()
    return json({id:result.meta.last_row_id,slug:data.slug},201)
  }catch(e){return json({error:String(e.message||'등록에 실패했습니다.').slice(0,200)},400)}
}
