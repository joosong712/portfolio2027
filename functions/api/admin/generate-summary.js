import {json, requireAdmin} from '../../_shared.js'

const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'

export async function onRequestPost(context) {
    const denied = await requireAdmin(context)
    if (denied) return denied
    if (!context.env.AI) return json({error:'Workers AI 바인딩 AI가 연결되지 않았습니다.'}, 503)

    try {
        const form = await context.request.formData()
        const name = String(form.get('name') || '').trim().slice(0, 120)
        const industry = String(form.get('industry') || '').trim().slice(0, 100)
        const role = String(form.get('role') || '').trim().slice(0, 180)
        const workTags = String(form.get('work_tags') || '').trim().slice(0, 400)
        if (!name) return json({error:'프로젝트명을 입력하세요.'}, 400)

        const image = form.get('image')
        let imageUrl = null
        if (image instanceof File && image.size) {
            if (image.type !== 'image/jpeg' || image.size > 2 * 1024 * 1024) return json({error:'AI 분석 이미지는 JPEG 2MB 이하로 전송해야 합니다.'}, 400)
            const bytes = new Uint8Array(await image.arrayBuffer())
            if (!(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)) return json({error:'이미지 데이터가 유효하지 않습니다.'}, 400)
            let binary = ''
            for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
            imageUrl = `data:image/jpeg;base64,${btoa(binary)}`
        }

        const instructions = [
            '당신은 한국어 웹디자인·퍼블리싱 포트폴리오의 프로젝트 소개 편집자입니다.',
            '사용자가 제공한 프로젝트명, 업종, 담당업무, 선택한 작업 분야와 이미지에 실제 보이는 요소만 활용해 3~5문장의 자연스럽고 절제된 한국어 프로젝트 소개를 작성하세요.',
            '이미지에서 관찰되는 레이아웃, 색상, 타이포그래피, 콘텐츠 구조를 구체적으로 언급할 수 있습니다.',
            '사용하지 않았다고 명시된 기술이나 관찰 불가능한 구현 기술, 성과 수치, 실제 사용자 반응, 제작 의도는 추측하거나 만들어내지 마세요.',
            '브랜드 과장, 인공지능 같은 문체, 이모지, 소제목, 불릿, 마크다운을 쓰지 마세요. 250~400자 이내의 자연스러운 소개 문단만 출력하세요.',
            `프로젝트명: ${name}`,
            `업종: ${industry || '미입력'}`,
            `담당업무: ${role || '미입력'}`,
            `선택한 작업 분야: ${workTags || '미선택'}`,
            imageUrl ? '함께 전달한 이미지를 시각적으로 분석해서 설명에 반영하세요.' : '이미지는 제공되지 않았습니다. 화면 특징을 임의로 만들어내지 마세요.'
        ].join('\n')

        const content = imageUrl ? [
            {type:'text', text:instructions},
            {type:'image_url', image_url:{url:imageUrl}}
        ] : instructions
        const result = await context.env.AI.run(MODEL, {
            messages:[{role:'user', content}], max_tokens:480, temperature:0.35
        })
        const output = typeof result?.response === 'string' ? result.response : result?.choices?.[0]?.message?.content
        const summary = String(output || '').trim().replace(/^```(?:text)?\s*|\s*```$/g,'').slice(0, 2000)
        if (!summary) return json({error:'AI가 소개글을 생성하지 못했습니다. 다시 시도해 주세요.'}, 502)
        return json({summary, analyzed_image: Boolean(imageUrl)})
    } catch (error) {
        return json({error:'AI 분석 요청에 실패했습니다. 모델 이용 가능 여부와 요금제, AI 바인딩을 확인해 주세요.'}, 502)
    }
}
