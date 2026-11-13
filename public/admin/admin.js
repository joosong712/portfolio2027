const $ = id => document.getElementById(id)
const list = $('project-list')
const status = $('status')
const form = $('form')
let projects = []

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
    form.reset()
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
    $('tech').value = (project.tech || []).join(', ')
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
            tech:read('tech').split(',').map(value => value.trim()).filter(Boolean),
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
