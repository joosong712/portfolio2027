const $ = id => document.getElementById(id)
const list = $('project-list')
const status = $('status')
const form = $('form')
let projects = []
let selectedTech = new Set()
let aiRequestNumber = 0
let aiDebounceTimer

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
    clearTimeout(aiDebounceTimer)
    form.reset()
    setTech([])
    setRole('')
    $('ai-feedback').textContent = ''
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
        await api(id ? `/api/admin/projects/${id}` : '/api/admin/projects', {
            method:id ? 'PUT' : 'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(body)
        })
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
async function generateSummary() {
    const file = $('detail-file').files?.[0] || $('file').files?.[0]
    const name = read('name')
    const requestNumber = ++aiRequestNumber
    if (!name) {
        $('ai-feedback').textContent = '프로젝트명을 먼저 입력해 주세요.'
        return
    }
    const button = $('generate-summary')
    button.disabled = true
    $('ai-feedback').textContent = '프로젝트 소개 초안을 생성하고 있습니다...'
    try {
        const payload = new FormData()
        payload.append('name', name)
        payload.append('category', read('category'))
        payload.append('industry', read('industry'))
        payload.append('role', getRole())
        payload.append('work_tags', getTech().join(', '))
        if (file) {
            const images = await analysisImages(file)
            images.forEach((image, index) => payload.append('image', image, `analysis-${index + 1}.jpg`))
        }
        const result = await api('/api/admin/generate-summary', {method:'POST', body:payload})
        if (requestNumber !== aiRequestNumber) return
        if ($('summary').value.trim() && !confirm('기존 소개글을 AI 초안으로 교체할까요?')) return
        $('summary').value = result.summary
        $('ai-feedback').textContent = file ? '화면의 상·중·하단과 작업 정보를 참고한 초안입니다. 실제 기획·구현 내용은 확인해 주세요.' : '입력 정보를 기반으로 생성된 AI 초안입니다. 이미지를 선택하면 디자인 분석이 가능합니다.'
    } catch (error) {
        if (requestNumber === aiRequestNumber) $('ai-feedback').textContent = `AI 생성 실패: ${error.message}`
    } finally {
        if (requestNumber === aiRequestNumber) button.disabled = false
    }
}
$('generate-summary').addEventListener('click', generateSummary)
for (const id of ['file', 'detail-file']) {
    $(id).addEventListener('change', () => {
        clearTimeout(aiDebounceTimer)
        if (!$(id).files?.length) return
        aiDebounceTimer = setTimeout(generateSummary, 600)
    })
}
