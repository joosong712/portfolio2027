export async function onRequestGet({env,params,request}) {
  const key=params.key
  if(!/^[a-f0-9-]{36}\.(webp|png|jpg)$/.test(key))return new Response('Not found',{status:404})
  try {
    const object=await env.MEDIA.get(key)
    if(!object)return new Response('Not found',{status:404})
    const headers=new Headers({'content-type':object.httpMetadata?.contentType||'application/octet-stream','cache-control':'public,max-age=86400','x-content-type-options':'nosniff','etag':object.httpEtag})
    if(request.headers.get('If-None-Match')===object.httpEtag)return new Response(null,{status:304,headers})
    return new Response(object.body,{headers})
  }catch{return new Response('Unavailable',{status:503})}
}
