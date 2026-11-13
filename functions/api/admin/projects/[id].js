import {json,requireAdmin,cleanProject} from '../../../_shared.js'
export async function onRequestPut(ctx){
  const denied=await requireAdmin(ctx);if(denied)return denied
  const id=Number(ctx.params.id)
  if(!Number.isSafeInteger(id)||id<1)return json({error:'잘못된 프로젝트 번호'},400)
  try{
    const data=cleanProject(await ctx.request.json())
    for(const key of [data.imageKey,data.detailImageKey]){
      if(key && !(await ctx.env.MEDIA.head(key)))return json({error:'업로드된 이미지가 없습니다.'},400)
    }
    const result=await ctx.env.DB.prepare('UPDATE projects SET slug=?,title=?,category=?,industry=?,role=?,year=?,tech_json=?,summary=?,site_url=?,image_key=?,detail_image_key=?,published=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(data.slug,data.title,data.category,data.industry,data.role,data.year,JSON.stringify(data.tech),data.summary,data.siteURL,data.imageKey,data.detailImageKey,+data.published,data.sort,id).run()
    return result.meta.changes?json({ok:true}):json({error:'프로젝트를 찾을 수 없습니다.'},404)
  }catch(e){return json({error:String(e.message||'수정에 실패했습니다.').slice(0,200)},400)}
}
export async function onRequestDelete(ctx){
  const denied=await requireAdmin(ctx);if(denied)return denied
  const id=Number(ctx.params.id)
  if(!Number.isSafeInteger(id)||id<1)return json({error:'잘못된 프로젝트 번호'},400)
  try{
    const r=await ctx.env.DB.prepare('DELETE FROM projects WHERE id=?').bind(id).run()
    return r.meta.changes?json({ok:true}):json({error:'프로젝트를 찾을 수 없습니다.'},404)
  }catch{return json({error:'삭제에 실패했습니다.'},503)}
}
