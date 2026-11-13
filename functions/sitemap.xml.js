import {publicOrigin} from './_shared.js'
export async function onRequestGet({env,request}){
  const o=publicOrigin(env,request)
  let urls=[`${o}/`]
  try{const data=await env.DB.prepare('SELECT slug FROM projects WHERE published=1 ORDER BY sort_order LIMIT 2000').all();urls.push(...data.results.map(p=>`${o}/work/${encodeURIComponent(p.slug)}`))}catch{}
  const body=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`<url><loc>${u.replace(/&/g,'&amp;')}</loc></url>`).join('\n')}\n</urlset>`
  return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=300'}})
}
