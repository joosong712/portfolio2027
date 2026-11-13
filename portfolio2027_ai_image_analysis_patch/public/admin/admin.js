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

    for (const field of ['name', 'category', 'industry', 'role', 'year', 'slug', 'summary', 'url']) {
        $(field).value = project[field] ?? ''
    }
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
        const body = {
            name:read('name'), category:read('category'), slug:read('slug'),
            industry:read('industry'), role:read('role'), year:read('year'),
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

// 풀 캡처는 전체를 작게 줄이지 않고, 주요 구간을 잘라 AI가 읽을 수 있는 크기로 전달합니다.
async function analysisImages(source) {
    const bitmap = await createImageBitmap(source)
    try {
        const width = bitmap.width
        const height = bitmap.height
        const cropHeight = Math.min(height, Math.max(1, Math.round(width * 0.9)))
        const positions = height > width * 1.8
            ? [0, Math.round((height - cropHeight) / 2), height - cropHeight]
            : [0]
        const blobs = []

        for (const top of positions) {
            const scale = Math.min(1, 1100 / width, 1100 / cropHeight)
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(width * scale))
            canvas.height = Math.max(1, Math.round(cropHeight * scale))
            canvas.getContext('2d').drawImage(bitmap, 0, top, width, cropHeight, 0, 0, canvas.width, canvas.height)
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(result => result ? resolve(result) : reject(new Error('이미지 분석용 변환 실패')), 'image/jpeg', 0.85)
            })
            blobs.push(blob)
        }

        return blobs
    } finally {
        bitmap.close()
    }
}

// 수정 중인 프로젝트의 저장된 이미지도 다시 불러와 분석할 수 있게 합니다.
async function imageForAnalysis() {
    const detailFile = $('detail-file').files?.[0]
    const thumbnailFile = $('file').files?.[0]
    if (detailFile || thumbnailFile) return detailFile || thumbnailFile

    const project = projects.find(item => item.id === Number($('project-id').value))
    const url = project?.detail_image_url || project?.image_url
    if (!url) return null

    const response = await fetch(url, {credentials:'same-origin'})
    if (!response.ok) throw new Error('저장된 프로젝트 이미지를 불러오지 못했습니다.')
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) throw new Error('저장된 이미지 형식을 확인할 수 없습니다.')
    return blob
}

async function generateSummary() {
    const name = read('name')
    const requestNumber = ++aiRequestNumber
    if (!name) {
        $('ai-feedback').textContent = '프로젝트명을 먼저 입력해 주세요.'
        return
    }

    const button = $('generate-summary')
    button.disabled = true
    $('ai-feedback').textContent = '이미지를 확인하고 AI 소개글 초안을 만들고 있습니다...'
    try {
        const payload = new FormData()
        payload.append('name', name)
        payload.append('industry', read('industry'))
        payload.append('role', read('role'))
        payload.append('work_tags', getTech().join(', '))

        const source = await imageForAnalysis()
        let imageCount = 0
        if (source) {
            const blobs = await analysisImages(source)
            blobs.forEach((blob, index) => payload.append('images', blob, `analysis-${index + 1}.jpg`))
            imageCount = blobs.length
        }

        const result = await api('/api/admin/generate-summary', {method:'POST', body:payload})
        if (requestNumber !== aiRequestNumber) return
        if ($('summary').value.trim() && !confirm('기존 소개글을 AI 초안으로 교체할까요?')) return
        $('summary').value = result.summary
        $('ai-feedback').textContent = imageCount
            ? `이미지 ${imageCount}개 구간을 분석한 AI 초안입니다. 실제 내용과 일치하는지 확인해 주세요.`
            : '이미지 없이 입력 정보만 참고했습니다. 이미지를 등록하면 더 구체적으로 작성할 수 있습니다.'
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
        if ($(id).files?.length) $('ai-feedback').textContent = '이미지가 선택되었습니다. AI 소개글 생성 버튼을 누르면 이미지를 분석합니다.'
    })
}
