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
        const mode = form.get('mode') === 'keywords' ? 'keywords' : 'summary'
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

        if (mode === 'keywords') {
            if (!imageUrls.length) return json({error:'이미지 선택 후 키워드를 분석해 주세요.'},400)
            const prompt = [
                '당신은 웹디자인 포트폴리오 이미지 분석가입니다.',
                '제공된 웹사이트 캡처에서 직접 관찰할 수 있는 시각적 특징과, 업종에 맞는 디자인 콘셉트 제안을 구분하세요.',
                '시각적 특징(visual): 실제 화면에서 확인되는 색조, 레이아웃, 섹션 구성, 이미지 활용, 타이포 스타일 등 구체적인 사실만 작성하세요.',
                '콘셉트 제안(concept): 화면 분위기와 업종을 결합한 해석적 키워드입니다. 객관적 사실이 아니라 제안이라는 전제하에 작성하세요.',
                '각 키워드는 한국어 2~12자 정도의 짧은 명사구로 작성하고, 의미가 겹치는 표현은 제거하세요.',
                '확인 불가능한 기능(온라인 상담, 예약, 모션, 반응형 등), 구체적인 성과, 고객 의도는 절대로 추정하지 마세요.',
                '근거가 없으면 키워드를 적게 제시하세요. visual 3~5개, concept 1~3개, 총 최대 8개.',
                '반드시 JSON만 출력하세요. 예시 형식: {"keywords":[{"text":"관찰한 디자인 특징","type":"visual"},{"text":"제안하는 콘셉트","type":"concept"}]}',
                `프로젝트명(참고): ${name}`,`업종(참고): ${industry || '미입력'}`,`종류: ${category}`,
                '첨부 이미지는 한 웹사이트의 여러 구간일 수 있습니다.'
            ].join('\n')
            const content = [{type:'text',text:prompt},...imageUrls.map(url=>({type:'image_url',image_url:{url}}))]
            const result = await context.env.AI.run(MODEL, {messages:[{role:'user',content}],max_tokens:350,temperature:0.2})
            const output = typeof result?.response === 'string' ? result.response : result?.choices?.[0]?.message?.content
            const raw = String(output || '').replace(/^```(?:json)?\s*|\s*```$/g,'').trim()
            let parsed
            try {parsed = JSON.parse(raw)} catch {
                const match = raw.match(/\{[\s\S]*\}/)
                if (match) {try {parsed=JSON.parse(match[0])} catch {}}
            }
            if (!Array.isArray(parsed?.keywords)) return json({error:'AI 키워드 형식이 올바르지 않습니다. 다시 분석해 주세요.'},502)
            const seen = new Set()
            const keywords = parsed.keywords.filter(item => {
                const word=String(item?.text||'').trim()
                if (!word || word.length > 45 || !['visual','concept'].includes(item?.type) || seen.has(word)) return false
                seen.add(word);return true
            }).slice(0,8).map(item=>({text:String(item.text).trim(),type:item.type}))
            return json({keywords,analyzed_image:true})
        }
        let suppliedKeywords = []
        try {suppliedKeywords = JSON.parse(String(form.get('keywords')||'[]'))} catch {}
        if (!Array.isArray(suppliedKeywords)) suppliedKeywords=[]
        suppliedKeywords = [...new Set(suppliedKeywords.filter(item=>typeof item==='string').map(item=>item.trim()).filter(Boolean).slice(0,12).map(item=>item.slice(0,45)))]
        if (!suppliedKeywords.length) return json({error:'키워드를 하나 이상 선택하거나 입력해 주세요.'},400)
        const style = ['design','planning','balanced'].includes(form.get('style')) ? form.get('style') : 'balanced'
        const styleLabel = {balanced:'기획 의도와 디자인 특징을 균형 있게',design:'시각적 디자인 선택을 중심으로',planning:'콘텐츠 구성과 업종별 정보 전달 목적을 중심으로'}[style]
        const projectType = category === 'template' ? '업종별 웹사이트 디자인 템플릿' : '개별 맞춤 웹사이트 프로젝트'
        const instructions = [
            '역할: 웹디자이너가 자신의 포트폴리오에 직접 작성하는 한국어 프로젝트 소개문을 다듬는 전문 에디터.',
            '소개글의 목적은 디자인을 칭찬하거나 평가하는 것이 아니라, 작업자가 어떤 업종 특성을 고려했고 화면에서 어떤 디자인 선택을 했는지 설명하는 것입니다.',
            '작성 시 우선순위: (1) 사용자가 직접 선택한 키워드 (2) 이미지에서 실제 관찰할 수 있는 특징 (3) 업종별 정보 전달 목적.',
            '선택된 키워드가 실제 관찰과 모순되면 해당 사실을 만들어내지 말고, 모순되는 표현은 제외하세요.',
            '콘셉트 키워드는 사용자가 선택한 기획 방향이며 이미지에서 객관적으로 관찰한 사실처럼 단정하지 마세요.',
            '온라인 상담, 예약, 의료진 소개, 연락처 위치 등 실제 이미지에 확실히 보이지 않는 서비스·기능은 쓰지 마세요.',
            '같은 명사를 반복하거나 구성·배치·고려 등의 단어를 어색하게 이어 쓰지 마세요.',
            '1인칭 대명사(저는/제가)는 사용하지 말고, 디자이너의 작업 설명처럼 「~을 중심으로 구성했습니다」「~을 고려해 배치했습니다」「~에 중점을 두었습니다」 형태로 작성하세요.',
            '첫 문장은 업종이나 사용 맥락에 따른 디자인 방향 또는 화면 구성 의도로 시작하세요. 프로젝트명 자체나 「~웹사이트에서는」으로 시작하지 마세요.',
            '두 번째 문장은 이미지에서 실제로 보이는 색채, 이미지의 사용 방식, 섹션 배치, 타이포그래피 또는 정보 위계를 구체적으로 연결하세요.',
            '세 번째 문장은 새롭게 설명할 사실이 있을 때만 추가하세요. 앞선 문장과 같은 의미를 반복하면 2문장으로 끝내세요.',
            '이미지가 여러 장이면 같은 웹사이트의 서로 다른 구간입니다. 실제로 눈에 띄는 특징을 우선 선택하고, 눈에 보이지 않는 세부 특징은 추측하지 마세요.',
            '프로젝트명·업종·담당 업무·작업 태그는 참고 정보일 뿐입니다. 제목을 그대로 복사하거나 태그와 기능을 목록처럼 나열하지 마세요.',
            '디자인 의도는 입력 정보와 눈에 보이는 화면으로 합리적으로 설명할 수 있을 때만 표현하세요. 고객 유치, 계약, 수치 성과, 인터랙션, 반응형, 접근성 등 미확인 사실을 만들어내지 마세요.',
            '템플릿이라도 「템플릿은 ~」 또는 「업종의 니즈를 고려」 같은 소개서 문구는 사용하지 마세요. 맞춤 제작도 프로젝트 유형 자체를 문장에 넣지 마세요.',
            '평가자 시점 문구 금지: 「~에 부합합니다」「~이 돋보입니다」「~을 보여줍니다」「~로 평가됩니다」「자연스럽습니다」「인상적입니다」.',
            '상투적 수식어 금지: 「깔끔한」「세련된」「적절한」「감각적인」「프리미엄」「차별화된」「최적화된」. 관찰한 사실을 대신 설명하세요.',
            '모호한 표현 금지: 「전문성과 신뢰감을 전달」「사용자 편의성을 고려」「타이포그래피 위계와 적절한 여백」「정보 흐름이 자연스럽습니다」.',
            '문장마다 새로운 정보가 있어야 합니다. 같은 명사나 의미를 반복하거나 「~을 통해」「~을 강조」를 연속 사용하지 마세요.',
            '결과: 완성된 한국어 소개글만 2~3문장, 대략 95~155자로 작성하세요. 이미지 근거가 부족하면 짧게 작성하고 구체적인 디자인 요소를 지어내지 마세요.',
            '제목, 번호, 해설, 따옴표, 마크다운, 자체평가 문구는 출력하지 마세요.',
            `프로젝트 유형: ${projectType}`,
            `프로젝트명(본문에 복사 금지): ${name}`,
            `업종: ${industry || '미입력'}`,
            `담당 업무(나열 금지): ${role || '미입력'}`,
            `작업 항목(나열 금지): ${workTags || '미선택'}`,
            `사용자가 선택한 핵심 키워드(최우선): ${suppliedKeywords.join(', ')}`,
            `작성 방향: ${styleLabel}`,
            '키워드는 문장에 전부 나열하지 말고, 실질적인 설명이 가능한 2~4개만 자연스럽게 엮으세요.',
            imageUrls.length ? '첨부한 이미지는 실제 프로젝트 화면입니다. 보이는 시각 요소만 근거로 쓰세요.' : '분석 이미지가 없습니다. 특정 색과 섹션 구성을 추정하지 마세요.'
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
        const genericPhrases = [
            '이 프로젝트는','이 템플릿은','업종의 니즈','테마로 합니다','모션그래픽을 포함',
            'UI/UX 디자인과','디자인 템플릿 프로젝트','프로젝트인',
            '전문성과 신뢰감을 전달','사용자 편의성을 고려',
            '에 부합합니다','이 돋보입니다','을 보여줍니다','로 평가됩니다',
            '정보 흐름이 자연스럽습니다','타이포그래피 위계와 적절한 여백',
            '깔끔한','세련된','적절한','감각적인','차별화된','최적화된'
        ]
        const summaryPenalty = summary => {
            if (!summary) return 100
            let penalty = 0
            if (name.length >= 8 && summary.includes(name)) penalty += 8
            for (const word of genericPhrases) if (summary.includes(word)) penalty += 3
            if (/^(산부인과|병원|피부과|기업|대학교)?\s*(웹사이트|홈페이지)(에서는|는|의)/.test(summary)) penalty += 3
            if ((summary.match(/웹사이트|홈페이지/g) || []).length >= 3) penalty += 3
            if (summary.length < 65 || summary.length > 215) penalty += 2
            return penalty
        }
        let summary = await runAI(content)
        if (summaryPenalty(summary) > 0) {
            const feedback = `\n\n[수정 요청] 이전 글: ${summary}\n위 글은 외부 평가자의 설명처럼 보이거나 상투적 표현·제목 반복이 포함되어 부적합합니다. 실제 화면에서 관찰 가능한 디자인 선택을 중심으로, 디자이너가 직접 설명하듯 2~3문장으로 완전히 새로 써주세요. 이전 문장 구조와 추상적 수식어는 재사용하지 마세요.`
            const revisedContent = imageUrls.length ? [
                {type:'text',text:instructions+feedback},
                ...imageUrls.map(url=>({type:'image_url',image_url:{url}}))
            ] : instructions+feedback
            const revised = await runAI(revisedContent)
            // 재생성 결과가 더 나쁘면 기존의 상대적으로 나은 문장을 유지합니다.
            if (revised && summaryPenalty(revised) <= summaryPenalty(summary)) summary = revised
        }
        if (!summary) return json({error:'AI가 소개글을 생성하지 못했습니다. 다시 시도해 주세요.'}, 502)
        return json({summary, analyzed_image: imageUrls.length > 0})
    } catch (error) {
        return json({error:'AI 분석 요청에 실패했습니다. 모델 이용 가능 여부와 요금제, AI 바인딩을 확인해 주세요.'}, 502)
    }
}
