const $ = id => document.getElementById(id)
const list = $('project-list')
const status = $('status')
const form = $('form')
let projects = []
let selectedTech = new Set()
let aiRequestNumber = 0
let aiDebounceTimer
let keywordSuggestions = []
let keywordRequestNumber = 0
let editingImageUrl = ''

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]))
const read = id => $(id).value.trim()
const ROLE_ORDER = ['Planning', 'Design', 'Publishing', 'Maintenance']
const roleInputs = [...document.querySelectorAll('#role-options input[name="role"]')]
const normalizeRole = value => {
    const raw = String(value || '').trim()
    if (!raw) return []
    const values = raw.split(/\s*(?:[·,|/&+]|\band\b)\s*/i).filter(Boolean)
    const selected = new Set()
    for (const part of values) {
        const token = part.toLowerCase().replace(/\s+/g, '')
        if (/^(planning|기획|웹기획|사이트기획)$/.test(token)) selected.add('Planning')
        else if (/^(design|webdesign|웹디자인|디자인|웹디자이너)$/.test(token)) selected.add('Design')
        else if (/^(publishing|webpublishing|퍼블리싱|웹퍼블리싱|웹퍼블리셔|퍼블리셔)$/.test(token)) selected.add('Publishing')
        else if (/^(maintenance|유지보수|운영|사이트운영|웹사이트유지보수)$/.test(token)) selected.add('Maintenance')
    }
    return ROLE_ORDER.filter(role => selected.has(role))
}
function getRole() {
    return ROLE_ORDER.filter(role => roleInputs.some(input => input.value === role && input.checked)).join(' · ')
}
function setRole(value) {
    const selected = normalizeRole(value)
    roleInputs.forEach(input => {input.checked = selected.includes(input.value)})
    const raw = String(value || '').trim()
    const parts = raw.split(/\s*(?:[·,|/&+]|\band\b)\s*/i).filter(Boolean)
    const note = $('role-legacy')
    note.hidden = !raw || selected.length >= parts.length
    note.textContent = note.hidden ? '' : `이전 담당 업무: ${raw} — 일부 항목은 자동 변환하지 못했습니다. 저장 전 선택을 확인해 주세요.`
    updateRolePreview()
}
function updateRolePreview() {
    $('role-preview').textContent = getRole() || '담당 업무를 선택해 주세요.'
}
roleInputs.forEach(input => input.addEventListener('change', () => {
    $('role-legacy').hidden = true
    updateRolePreview()
}))

async function api(url, options = {}) {
    const response = await fetch(url, {...options, headers:{...(options.headers || {}), Accept:'application/json'}})
    const data = await response.json().catch(() => ({error:`HTTP ${response.status}`}))
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
    return data
}

function setPreview(id, url) {
    const element = $(id)
    if (element.dataset.objectUrl) URL.revokeObjectURL(element.dataset.objectUrl)
    delete element.dataset.objectUrl
    element.style.display = url ? 'block' : 'none'
    if (url) element.src = url
    else element.removeAttribute('src')
}

function clearForm() {
    aiRequestNumber++
    keywordRequestNumber++
    clearTimeout(aiDebounceTimer)
    form.reset()
    setTech([])
    setRole('')
    $('ai-feedback').textContent = ''
    $('keyword-feedback').textContent = ''
    keywordSuggestions = []
    editingImageUrl = ''
    $('keyword-extra').value = ''
    $('ai-style').value = 'balanced'
    renderKeywords()
    $('project-id').value = ''
    $('image-key').value = ''
    $('detail-image-key').value = ''
    setPreview('preview', '')
    setPreview('detail-preview', '')
    $('form-title').textContent = '프로젝트 등록'
    $('submit').textContent = '프로젝트 등록'
    $('sort-order').value = '0'
}

function editProject(id) {
    const project = projects.find(item => item.id === id)
    if (!project) return
    clearForm()
    $('project-id').value = project.id
    $('image-key').value = project.image_key || ''
    $('detail-image-key').value = project.detail_image_key || ''

    for (const field of ['name', 'category', 'industry', 'year', 'slug', 'summary', 'url']) {
        $(field).value = project[field] ?? ''
    }
    setRole(project.role || '')
    editingImageUrl = project.detail_image_url || project.image_url || ''
    restoreKeywordDraft(project)
    $('sort-order').value = project.sort_order ?? 0
    setTech(project.tech || [])
    $('published').checked = Boolean(project.published)
    setPreview('preview', project.image_url)
    setPreview('detail-preview', project.detail_image_key ? project.detail_image_url : '')
    $('form-title').textContent = '프로젝트 수정'
    $('submit').textContent = '변경사항 저장'
    status.textContent = ''
    window.scrollTo({top:0, behavior:'smooth'})
}

async function deleteProject(id) {
    const project = projects.find(item => item.id === id)
    if (!project || !confirm(`'${project.name}' 프로젝트를 삭제할까요?`)) return
    try {
        await api(`/api/admin/projects/${id}`, {method:'DELETE'})
        if (Number($('project-id').value) === id) clearForm()
        await loadProjects()
        status.textContent = '프로젝트를 삭제했습니다.'
    } catch (error) {
        status.textContent = `삭제 실패: ${error.message}`
    }
}

function renderProjects() {
    if (!projects.length) {
        list.textContent = '아직 등록된 프로젝트가 없습니다.'
        return
    }
    list.innerHTML = projects.map(project => `
        <article class="item">
            <img src="${escapeHTML(project.image_url || '/og-image.png')}" alt="${escapeHTML(project.name)} 썸네일">
            <div>
                <strong>${escapeHTML(project.name)}</strong>
                <span class="meta">${project.category === 'custom' ? '제작형' : '템플릿'} · ${escapeHTML(project.industry)} · ${project.published ? '공개' : '비공개'}</span>
            </div>
            <div class="actions">
                <button class="ghost" type="button" data-edit="${project.id}">수정</button>
                <button class="danger" type="button" data-delete="${project.id}">삭제</button>
            </div>
        </article>
    `).join('')
}

async function loadProjects() {
    try {
        const data = await api('/api/admin/projects')
        projects = data.projects || []
        renderProjects()
    } catch (error) {
        list.textContent = `${error.message} Cloudflare Access와 D1 설정을 확인하세요.`
    }
}

async function uploadImage(file, kind) {
    if (!file) return null
    const payload = new FormData()
    payload.append('file', file)
    payload.append('kind', kind)
    const result = await api('/api/admin/upload', {method:'POST', body:payload})
    return result.image_key
}

function bindPreview(inputId, previewId) {
    $(inputId).addEventListener('change', event => {
        const file = event.target.files?.[0]
        if (!file) return
        const url = URL.createObjectURL(file)
        setPreview(previewId, url)
        $(previewId).dataset.objectUrl = url
    })
}

list.addEventListener('click', event => {
    const button = event.target.closest('button')
    if (!button) return
    if (button.dataset.edit) editProject(Number(button.dataset.edit))
    if (button.dataset.delete) deleteProject(Number(button.dataset.delete))
})

bindPreview('file', 'preview')
bindPreview('detail-file', 'detail-preview')
$('clear-form').addEventListener('click', () => {
    clearForm()
    status.textContent = ''
})

form.addEventListener('submit', async event => {
    event.preventDefault()
    $('submit').disabled = true
    status.textContent = '저장 중...'
    try {
        // 기존 이미지는 보존하고, 새 파일을 선택한 경우에만 교체합니다.
        const thumbnailKey = await uploadImage($('file').files?.[0], 'thumbnail') || read('image-key')
        const detailKey = await uploadImage($('detail-file').files?.[0], 'detail') || read('detail-image-key')
        if (!getRole()) throw new Error('담당 업무를 하나 이상 선택해 주세요.')
        const body = {
            name:read('name'), category:read('category'), slug:read('slug'),
            industry:read('industry'), role:getRole(), year:read('year'),
            summary:read('summary'), url:read('url'),
            sort_order:Number(read('sort-order') || 0),
            tech:getTech(),
            image_key:thumbnailKey, detail_image_key:detailKey,
            published:$('published').checked
        }
        const id = Number($('project-id').value)
        const saved = await api(id ? `/api/admin/projects/${id}` : '/api/admin/projects', {
            method:id ? 'PUT' : 'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(body)
        })
        saveKeywordDraft(id || saved.id || 0, body.slug)
        clearForm()
        await loadProjects()
        status.textContent = '프로젝트가 저장되었습니다.'
    } catch (error) {
        status.textContent = `저장 실패: ${error.message}`
        await loadProjects()
    } finally {
        $('submit').disabled = false
    }
})

loadProjects()

// 공통 작업 분야 태그: 버튼은 접근 가능한 토글, 직접 입력은 선택 항목과 중복 제거.
function setTech(items) {
    const known = new Set([...document.querySelectorAll('[data-tech]')].map(button => button.dataset.tech))
    selectedTech = new Set(items.filter(item => known.has(item)))
    $('tech-extra').value = items.filter(item => !known.has(item)).join(', ')
    for (const button of document.querySelectorAll('[data-tech]')) {
        const active = selectedTech.has(button.dataset.tech)
        button.classList.toggle('is-active', active)
        button.setAttribute('aria-pressed', String(active))
    }
}
function getTech() {
    const custom = read('tech-extra').split(',').map(item => item.trim()).filter(Boolean)
    return [...new Set([...selectedTech, ...custom])].slice(0, 15)
}
$('tech-options').addEventListener('click', event => {
    const button = event.target.closest('button[data-tech]')
    if (!button) return
    if (selectedTech.has(button.dataset.tech)) selectedTech.delete(button.dataset.tech)
    else selectedTech.add(button.dataset.tech)
    button.classList.toggle('is-active', selectedTech.has(button.dataset.tech))
    button.setAttribute('aria-pressed', String(selectedTech.has(button.dataset.tech)))
})

// 긴 웹사이트 캡처를 상단·중단·하단으로 분할하여 주요 섹션을 선명하게 분석합니다.
// 등록용 원본 이미지는 그대로 유지합니다.
async function analysisImages(file) {
    if (!file) return []
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('지원하지 않는 이미지 형식입니다.')
    const image = await createImageBitmap(file)
    try {
        const ratio = image.height / image.width
        const sections = ratio > 2.4 ? [0, 0.5, 1] : ratio > 1.4 ? [0, 1] : [0]
        const cropHeight = Math.min(image.height, Math.round(image.width * 0.95))
        const result = []
        for (let i = 0; i < sections.length; i++) {
            const top = Math.round((image.height - cropHeight) * sections[i])
            const scale = Math.min(1, 1024 / image.width, 900 / cropHeight)
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(image.width * scale))
            canvas.height = Math.max(1, Math.round(cropHeight * scale))
            canvas.getContext('2d').drawImage(image, 0, top, image.width, cropHeight, 0, 0, canvas.width, canvas.height)
            const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('이미지 분석 사본 생성 실패')), 'image/jpeg', 0.78))
            result.push(blob)
        }
        return result
    } finally {
        image.close()
    }
}
// 키워드 초안은 DB 변경 없이 현재 브라우저에만 저장합니다.
const draftKey = (id, slug) => `portfolio-ai-keywords:${id || slug || 'new'}`
function saveKeywordDraft(id, slug) {
    if (!id && !slug) return
    try {localStorage.setItem(draftKey(id, slug), JSON.stringify({suggestions:keywordSuggestions, extra:read('keyword-extra'), style:read('ai-style')}))} catch {}
}
function restoreKeywordDraft(project) {
    try {
        const saved = JSON.parse(localStorage.getItem(draftKey(project.id, project.slug)) || 'null')
        if (!saved) return
        keywordSuggestions = Array.isArray(saved.suggestions) ? saved.suggestions.filter(isValidKeyword).slice(0, 8) : []
        $('keyword-extra').value = String(saved.extra || '').slice(0, 400)
        $('ai-style').value = ['balanced','design','planning'].includes(saved.style) ? saved.style : 'balanced'
        renderKeywords()
        $('keyword-feedback').textContent = '이 브라우저에 보관된 키워드를 불러왔습니다. 이미지 재분석도 가능합니다.'
    } catch {}
}
const isValidKeyword = item => item && typeof item.text === 'string' && item.text.length <= 45 && ['visual','concept'].includes(item.type)
function selectedKeywords() {
    const selected = keywordSuggestions.filter(item => item.selected).map(item => item.text)
    const extra = read('keyword-extra').split(',').map(item => item.trim()).filter(Boolean)
    return [...new Set([...selected, ...extra])].slice(0, 12)
}
function renderKeywords() {
    $('keyword-panel').hidden = keywordSuggestions.length === 0
    for (const type of ['visual','concept']) {
        const parent = $(type === 'visual' ? 'visual-keywords' : 'concept-keywords')
        parent.replaceChildren()
        const items = keywordSuggestions.filter(item => item.type === type)
        if (!items.length) {
            const empty = document.createElement('span')
            empty.className = 'ai-note'
            empty.textContent = type === 'visual' ? '확인 가능한 시각적 키워드가 없습니다.' : '제안된 콘셉트 키워드가 없습니다.'
            parent.append(empty)
        }
        for (const item of items) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = `ai-keyword${item.selected ? ' is-active' : ''}`
            button.setAttribute('aria-pressed', String(Boolean(item.selected)))
            button.textContent = `${item.selected ? '✓ ' : '+ '}${item.text}`
            button.addEventListener('click', () => {
                item.selected = !item.selected
                renderKeywords()
            })
            parent.append(button)
        }
    }
    const words = selectedKeywords()
    $('selected-keywords').textContent = words.length ? `선택 ${words.length}개 · ${words.join(' · ')}` : '선택한 키워드 없음'
}
$('keyword-extra').addEventListener('input', renderKeywords)

async function currentAnalysisImages() {
    const file = $('detail-file').files?.[0] || $('file').files?.[0]
    if (file) return analysisImages(file)
    if (editingImageUrl) {
        const url = new URL(editingImageUrl, location.origin)
        if (url.origin !== location.origin) throw Error('등록된 이미지의 출처를 확인할 수 없습니다. 이미지를 다시 선택해 주세요.')
        const response = await fetch(url.href)
        if (!response.ok) throw Error('기존 이미지 불러오기에 실패했습니다. 이미지를 다시 선택해 주세요.')
        const image = await response.blob()
        return analysisImages(image)
    }
    return []
}
async function buildPayload(mode) {
    const payload = new FormData()
    payload.append('mode', mode)
    payload.append('name', read('name'))
    payload.append('category', read('category'))
    payload.append('industry', read('industry'))
    payload.append('role', getRole())
    payload.append('work_tags', getTech().join(', '))
    if (mode === 'summary') {
        payload.append('keywords', JSON.stringify(selectedKeywords()))
        payload.append('style', read('ai-style'))
    }
    const images = await currentAnalysisImages()
    images.forEach((image, index) => payload.append('image', image, `analysis-${index + 1}.jpg`))
    return {payload, imageCount:images.length}
}
async function analyzeKeywords() {
    const requestNumber = ++keywordRequestNumber
    if (!read('name')) {
        $('keyword-feedback').textContent = '프로젝트명을 입력한 뒤 이미지를 분석해 주세요.'
        return
    }
    $('analyze-keywords').disabled = true
    $('keyword-feedback').textContent = '이미지에서 컬러·레이아웃·콘텐츠 특징을 분석하고 있습니다...'
    try {
        const {payload,imageCount} = await buildPayload('keywords')
        if (!imageCount) throw Error('분석할 이미지를 선택해 주세요.')
        const result = await api('/api/admin/generate-summary', {method:'POST',body:payload})
        if (requestNumber !== keywordRequestNumber) return
        if (!Array.isArray(result.keywords)) throw Error('추천 키워드를 가져오지 못했습니다.')
        keywordSuggestions = result.keywords.filter(isValidKeyword).slice(0,8).map(item => ({text:item.text.trim(),type:item.type,selected:true}))
        renderKeywords()
        $('keyword-feedback').textContent = keywordSuggestions.length ? '추천 키워드를 확인하고 필요 없는 항목은 제외하세요. 콘셉트 키워드는 직접 검토해 주세요.' : '화면에서 확실하게 추출한 키워드가 없습니다. 직접 입력할 수 있습니다.'
    } catch (error) {
        if (requestNumber === keywordRequestNumber) $('keyword-feedback').textContent = `키워드 분석 실패: ${error.message}`
    } finally {
        if (requestNumber === keywordRequestNumber) $('analyze-keywords').disabled = false
    }
}
async function generateSummary() {
    const requestNumber = ++aiRequestNumber
    if (!read('name')) {
        $('ai-feedback').textContent = '프로젝트명을 먼저 입력해 주세요.'
        return
    }
    if (!selectedKeywords().length) {
        $('ai-feedback').textContent = '추천 키워드를 선택하거나 직접 키워드를 입력해 주세요.'
        return
    }
    const button = $('generate-summary')
    button.disabled = true
    $('ai-feedback').textContent = '선택한 키워드로 소개글을 작성하고 있습니다...'
    try {
        const {payload} = await buildPayload('summary')
        const result = await api('/api/admin/generate-summary', {method:'POST',body:payload})
        if (requestNumber !== aiRequestNumber) return
        if ($('summary').value.trim() && !confirm('기존 소개글을 AI 초안으로 교체할까요?')) return
        $('summary').value = result.summary
        $('ai-feedback').textContent = '선택한 키워드를 반영한 초안입니다. 실제 디자인 의도와 구현 사실을 확인한 뒤 저장하세요.'
    } catch (error) {
        if (requestNumber === aiRequestNumber) $('ai-feedback').textContent = `AI 생성 실패: ${error.message}`
    } finally {
        if (requestNumber === aiRequestNumber) button.disabled = false
    }
}
$('analyze-keywords').addEventListener('click', analyzeKeywords)
$('generate-summary').addEventListener('click', generateSummary)
for (const id of ['file', 'detail-file']) {
    $(id).addEventListener('change', () => {
        aiRequestNumber++
        keywordRequestNumber++
        keywordSuggestions = []
        renderKeywords()
        clearTimeout(aiDebounceTimer)
        if (!$(id).files?.length) return
        aiDebounceTimer = setTimeout(analyzeKeywords, 650)
    })
}
