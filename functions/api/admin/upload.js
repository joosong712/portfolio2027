import {json,requireAdmin} from '../../_shared.js'
export async function onRequestPost(ctx){
  const denied=await requireAdmin(ctx);if(denied)return denied
  try{
    const form=await ctx.request.formData(),file=form.get('file')
    if(!(file instanceof File))return json({error:'이미지 파일이 필요합니다.'},400)
    if(file.size<1 || file.size>5*1024*1024)return json({error:'이미지는 5MB 이하만 가능합니다.'},400)
    const bytes=new Uint8Array(await file.arrayBuffer())
    const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255
    const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13
    const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'
    let ext,mime
    if(jpg){ext='jpg';mime='image/jpeg'}else if(png){ext='png';mime='image/png'}else if(webp){ext='webp';mime='image/webp'}else return json({error:'JPG, PNG, WebP 파일만 가능합니다.'},400)
    const key=`${crypto.randomUUID()}.${ext}`
    await ctx.env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:'public,max-age=86400'}})
    return json({image_key:key,image_url:`/media/${key}`},201)
  }catch{return json({error:'이미지 업로드에 실패했습니다.'},503)}
}
