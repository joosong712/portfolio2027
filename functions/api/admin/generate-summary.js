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
        const category = form.get('category') === 'template' ? 'template' : 'custom'
        const role = String(form.get('role') || '').trim().slice(0, 180)
        const workTags = String(form.get('work_tags') || '').trim().slice(0, 400)
        if (!name) return json({error:'프로젝트명을 입력하세요.'}, 400)

        const images = form.getAll('image').filter(image => image instanceof File && image.size)
        if (images.length > 3) return json({error:'분석 이미지는 최대 3장까지 가능합니다.'}, 400)
        const imageUrls = []
        for (const file of images) {
            if (file.type !== 'image/jpeg' || file.size > 2 * 1024 * 1024) return json({error:'AI 분석 이미지는 각각 JPEG 2MB 이하여야 합니다.'}, 400)
            const bytes = new Uint8Array(await file.arrayBuffer())
            if (!(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)) return json({error:'이미지 데이터가 유효하지 않습니다.'}, 400)
            let binary = ''
            for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
            imageUrls.push(`data:image/jpeg;base64,${btoa(binary)}`)
        }

        const projectType = category === 'template' ? '업종별 웹사이트 디자인 템플릿' : '개별 맞춤 웹사이트 프로젝트'
        const instructions = [
            '역할: 채용 담당자가 읽는 웹디자인·퍼블리싱 포트폴리오의 전문 에디터.',
            '아래 프로젝트 정보와 제공된 화면 이미지만 근거로 한국어 소개글을 작성하세요.',
            '먼저 내부적으로 화면의 구체적인 특징을 찾으세요: 실제 보이는 메뉴/섹션, 비주얼 구성, 컬러 대비, 타이포 위계, 여백, 카드 배치, 정보 흐름. 서로 다른 화면 컷은 같은 웹사이트의 상·중·하단일 수 있습니다.',
            '그중 실제로 눈에 보이는 차별점 1~2가지를 선택하여 업종 특성과 연결해 설명하세요. 화면에 없는 사실은 상상하지 마세요.',
            '담당 업무가 Planning이면 정보 배치·콘텐츠 구성 등 확인 가능한 기획 결과를, Design이면 시각적 선택을, Publishing이면 사용자가 명시한 구현 정보만 기술하세요.',
            '템플릿 프로젝트는 업종의 니즈를 고려한 구성과 비주얼을 중심으로, 맞춤 제작은 개별 프로젝트의 목적과 화면 특징을 중심으로 소개하세요.',
            '성과, 계약, 고객 만족도, 반응형·애니메이션 구현, SEO, 사용 기술, 디자인 의도는 주어진 자료에서 확인되지 않으면 주장하지 마세요.',
            '잘 보이지 않는 색이나 요소를 특정하지 마세요. 증거가 부족하면 관찰한 범위의 서술로 제한하세요.',
            '금지 표현: 전문성과 신뢰감을 전달, 사용자 편의성을 고려, 감각적인 디자인, 최적화된 경험, 차별화된 솔루션, 깔끔하고 세련된, 한눈에, 효과적으로 전달.',
            '결과 형식: 자연스러운 한국어 2~3문장, 약 110~190자. 프로젝트명을 반복해서 시작하지 말고, 광고 문구나 평가·과장은 피하세요.',
            '마크다운·해시태그·불릿·제목·따옴표 없이 소개 문장만 출력하세요.',
            `프로젝트 유형: ${projectType}`,
            `프로젝트명: ${name}`,
            `업종: ${industry || '미입력'}`,
            `담당 업무: ${role || '미입력'}`,
            `작업 항목: ${workTags || '미선택'}`,
            imageUrls.length ? '첨부 순서대로 상단·중간·하단 화면 컷을 확인하세요. 이미지의 글자는 읽히는 것만 참고하세요.' : '첨부 이미지가 없으므로 실제 화면을 묘사하지 말고 입력된 사실만으로 소개하세요.'
        ].join('\n')
        const content = imageUrls.length ? [
            {type:'text', text:instructions},
            ...imageUrls.map((url, index) => ({type:'image_url', image_url:{url}}))
        ] : instructions
        const result = await context.env.AI.run(MODEL, {
            messages:[{role:'user', content}], max_tokens:480, temperature:0.5
        })
        const output = typeof result?.response === 'string' ? result.response : result?.choices?.[0]?.message?.content
        const summary = String(output || '').trim().replace(/^```(?:text)?\s*|\s*```$/g,'').slice(0, 2000)
        if (!summary) return json({error:'AI가 소개글을 생성하지 못했습니다. 다시 시도해 주세요.'}, 502)
        return json({summary, analyzed_image: imageUrls.length > 0})
    } catch (error) {
        return json({error:'AI 분석 요청에 실패했습니다. 모델 이용 가능 여부와 요금제, AI 바인딩을 확인해 주세요.'}, 502)
    }
}
