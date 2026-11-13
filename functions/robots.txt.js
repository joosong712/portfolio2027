import {publicOrigin} from './_shared.js'
export function onRequestGet({env,request}){
  const o=publicOrigin(env,request)
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/admin/\nSitemap: ${o}/sitemap.xml\n`,{headers:{'content-type':'text/plain;charset=utf-8'}})
}
