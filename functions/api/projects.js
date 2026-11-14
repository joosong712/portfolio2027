import {json,publicOrigin,projectRecord} from '../_shared.js'
export async function onRequestGet({request,env}) {
  try {
    const rows=await env.DB.prepare('SELECT * FROM projects WHERE published=1 ORDER BY sort_order ASC, CASE WHEN category='template' THEN id END ASC, CASE WHEN category='custom' THEN id END DESC LIMIT 300').all()
    const origin=publicOrigin(env,request)
    return json({projects:rows.results.map(row=>projectRecord(row,origin))})
  } catch {return json({error:'프로젝트 목록을 불러올 수 없습니다.'},503)}
}
