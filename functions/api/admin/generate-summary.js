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
            '당신은 웹디자인 포트폴리오의 한국어 프로젝트 소개글을 전문적으로 편집합니다.',
            '목표: 채용 담당자가 화면에서 관찰 가능한 디자인 선택과 그 효과를 이해하도록 구체적이고 자연스러운 소개문을 작성합니다.',
            '프로젝트명, 업종, 담당 업무, 작업 항목은 참고용 메타데이터입니다. 이들을 하나의 문장으로 나열하거나 제목을 소개글에 복사하지 마세요.',
            '이미지가 있으면 먼저 주요 섹션 배치, 이미지와 텍스트 비율, 색의 대비, 타이포그래피 위계, 여백, 정보 흐름에서 실제 눈에 보이는 요소 2가지를 찾으세요.',
            '그 요소들을 문장 속에서 구체적으로 언급하고 업종의 특성과 자연스럽게 연결하세요. 이미지가 여러 장이면 동일 사이트의 다른 구간으로 해석하세요.',
            '이미지에서 확인되지 않는 기능, 모션그래픽, 반응형 구현, 제작 의도, 고객 유치·계약·성과, 기술 스택을 단정하지 마세요.',
            '기획은 제공된 정보 구조에 대한 선택을, 디자인은 실제 색과 레이아웃을, 퍼블리싱은 사용자가 명시적으로 입력한 구현 내용만 언급할 수 있습니다.',
            '템플릿은 업종에 맞춘 콘텐츠 배치와 표현 방식을 강조하되, \'템플릿은 업종의 니즈를 고려했습니다\' 같은 메타 설명을 절대 쓰지 마세요.',
            '첫 문장을 프로젝트명, \'~프로젝트는\', \'~홈페이지는\', \'~웹사이트는\'으로 시작하지 마세요.',
            'UI/UX 디자인, 모션그래픽 등 체크된 담당 항목을 나열하는 문장을 쓰지 마세요.',
            '금지: 전문성과 신뢰감을 전달, 사용자 편의성을 고려, 감각적인 디자인, 최적화된 경험, 업종의 니즈, 차별화된 솔루션, 깔끔하고 세련된, 이 프로젝트는, 이 템플릿은, 테마로 합니다.',
            '형식: 2~3개의 서로 다른 의미를 담은 완성형 한국어 문장, 총 100~170자 내외. 홍보 카피와 과장, 수동적이고 기계적인 문장 반복을 피하세요.',
            '이미지가 없거나 읽을 수 없으면 색·레이아웃을 추측하지 말고 제공된 사실만 활용해 간결하게 쓰세요.',
            '분석 과정과 마크다운, 제목, 번호, 인용부호 없이 최종 소개글만 출력하세요.',
            `프로젝트 유형: ${projectType}`,
            `프로젝트명(복사 금지): ${name}`,
            `업종: ${industry || '미입력'}`,
            `담당 업무(나열 금지): ${role || '미입력'}`,
            `작업 항목(나열 금지): ${workTags || '미선택'}`,
            imageUrls.length ? '첨부 이미지는 실제 웹사이트의 상·중·하단 캡처입니다. 확인되는 디자인 요소를 근거로 쓰세요.' : '분석 이미지 없음: 확인하지 못한 시각 요소를 만들지 마세요.'
        ].join('\n')
        const content = imageUrls.length ? [
            {type:'text', text:instructions},
            ...imageUrls.map((url, index) => ({type:'image_url', image_url:{url}}))
        ] : instructions
        const runAI = async promptContent => {
            const result = await context.env.AI.run(MODEL, {
                messages:[{role:'user', content:promptContent}], max_tokens:420, temperature:0.45
            })
            const output = typeof result?.response === 'string' ? result.response : result?.choices?.[0]?.message?.content
            return String(output || '').trim().replace(/^```(?:text)?\s*|\s*```$/g,'').replace(/^소개글\s*[:：]\s*/,'').replace(/^['"“”]+|['"“”]+$/g,'').trim().slice(0, 1000)
        }
        const looksGeneric = summary => {
            if (!summary) return true
            const bad = ['이 프로젝트는','이 템플릿은','업종의 니즈','테마로 합니다','모션그래픽을 포함','UI/UX 디자인과','디자인 템플릿 프로젝트','프로젝트인','전문성과 신뢰감을 전달','사용자 편의성을 고려']
            const titleRepeated = name.length >= 8 && summary.includes(name)
            const duplicate = (summary.match(/웹사이트|홈페이지/g) || []).length >= 4
            return titleRepeated || bad.some(word => summary.includes(word)) || duplicate || summary.length < 65
        }
        let summary = await runAI(content)
        if (looksGeneric(summary)) {
            const feedback = `\n\n[재작성 요청] 이전 답변: ${summary}\n이전 답변은 제목 반복 또는 추상적인 나열이 있어 부적합합니다. 프로젝트명과 작업 항목을 다시 쓰지 말고, 이미지에서 확인되는 두 가지 구성 요소를 바탕으로 새로운 2~3문장을 작성하세요. 근거 없는 표현은 제외하세요.`
            const revisedContent = imageUrls.length ? [
                {type:'text',text:instructions+feedback},
                ...imageUrls.map(url=>({type:'image_url',image_url:{url}}))
            ] : instructions+feedback
            const revised = await runAI(revisedContent)
            if (revised) summary = revised
        }
        if (!summary) return json({error:'AI가 소개글을 생성하지 못했습니다. 다시 시도해 주세요.'}, 502)
        return json({summary, analyzed_image: imageUrls.length > 0})
    } catch (error) {
        return json({error:'AI 분석 요청에 실패했습니다. 모델 이용 가능 여부와 요금제, AI 바인딩을 확인해 주세요.'}, 502)
    }
}
