// ===== Theme switch: explicit selection saved locally (default = light) =====
const themeButton = document.getElementById('themeToggle')
const themeMeta = document.querySelector('meta[name="theme-color"]')
function setTheme(mode) {
    const dark = mode === 'dark'
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    themeButton.setAttribute('aria-pressed', String(dark))
    themeButton.setAttribute('aria-label', dark ? '라이트 모드로 변경' : '다크 모드로 변경')
    themeButton.title = dark ? '라이트 모드로 변경' : '다크 모드로 변경'
    themeButton.querySelector('i').className = dark ? 'ri-sun-line' : 'ri-moon-line'
    themeButton.querySelector('.theme-toggle-text').textContent = dark ? 'Light' : 'Dark'
    if(themeMeta) themeMeta.content = dark ? '#15171d' : '#ffffff'
    try {localStorage.setItem('joo-song-theme', dark ? 'dark' : 'light')} catch(e) {}
}
let savedTheme = 'light'
try {savedTheme = localStorage.getItem('joo-song-theme') === 'dark' ? 'dark' : 'light'} catch(e) {}
setTheme(savedTheme)
themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'))
// ===== 데이터: 아래 값을 실제 정보로 교체하세요 (url이 null이면 링크가 만들어지지 않습니다) =====
const BRAND = "JOO SONG PORTFOLIO"
const CONTACT = {email:"",phone:"",resume:null,profiles:[]} // 실제 이메일을 입력하면 연락 기능이 활성화됩니다
const CATEGORY_DESC = {custom:"프로젝트별 요구사항에 맞춰 개별 디자인과 퍼블리싱을 수행한 웹사이트",template:"기존 템플릿 또는 공통 구조를 활용해 디자인·콘텐츠·레이아웃을 수정하고 구현한 웹사이트"}
const PAGE_SIZE = 6
const hues = [[217,91],[200,80],[250,70],[170,60],[330,65],[28,85],[145,55],[280,60],[190,70]]
let PROJECTS = []
async function loadProjects(){
    try {
        const res = await fetch('/api/projects',{headers:{Accept:'application/json'}})
        if(!res.ok) throw new Error('프로젝트를 불러오지 못했습니다')
        const data = await res.json()
        PROJECTS = (data.projects||[]).map((p,i)=>({
            ...p,tech:Array.isArray(p.tech)?p.tech:[],hue:hues[i%hues.length],
            detail:'/work/'+encodeURIComponent(p.slug),thumb:p.image_url||null
        }))
    } catch(e) {
        PROJECTS = []
        console.error('프로젝트 목록 로드 실패:',e)
        document.getElementById('projectStatus').textContent='프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
    selectTab(tabs[0])
}

// ===== 마키 =====
const KEYWORDS = ["Web Design","Publishing","Interactive","Responsive","Creative"]
const marquee = document.getElementById("marquee")
const group = `<div class="marquee-group">${KEYWORDS.map(k => `<span>${k}</span>`).join("")}</div>`
marquee.innerHTML = group + group.replace('class="marquee-group"','class="marquee-group" aria-hidden="true"')

// ===== 탭 + 그리드 =====
const state = {cat:"custom",shown:{custom:PAGE_SIZE,template:PAGE_SIZE}}
const grid = document.getElementById("grid")
const moreBtn = document.getElementById("more")
const tabs = [...document.querySelectorAll(".tab")]
const io = new IntersectionObserver(es => es.forEach(e => {if (e.isIntersecting) {e.target.classList.add("in");io.unobserve(e.target)}}),{rootMargin:"0px 0px -8% 0px"})

function escapeHTML(v) {return String(v).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeURL(v) {if (!v) return null;try {const u = new URL(v,location.href);return ['https:','http:'].includes(u.protocol) || (!/^[a-z]+:/i.test(v) && !v.startsWith('//')) ? escapeHTML(v) : null}catch {return null}}
function cardHTML(p) {
    const href = safeURL(p.detail || p.url)
    const tag = href ? "a" : "div"
    const attrs = href ? ` href="${href}" target="_blank" rel="noopener noreferrer"` : ""
    const [h,s] = p.hue || [210,60]
    const art = p.thumb ? `<img class="thumb-art" src="${escapeHTML(p.thumb)}" alt="${escapeHTML(p.name)} 썸네일" loading="lazy" width="800" height="600">` : `<div class="thumb-art thumb-art-demo" style="background:linear-gradient(135deg,hsl(${h} ${s}% 58%),hsl(${h + 25} ${s}% 42%))"><div class="demo-browser" aria-hidden="true"><div class="demo-browser-bar"><i></i><i></i><i></i></div><div class="demo-browser-body"><strong></strong><em></em></div></div><span class="demo-caption">${escapeHTML(p.industry)} · WEB EXPERIENCE</span></div>`
    const meta = [p.industry, p.year, ...(Array.isArray(p.tech) ? p.tech : [])]
        .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
        .map(escapeHTML)
    const role = p.role ? `<p class="card-role">${escapeHTML(p.role)}</p>` : ''
    const details = meta.length ? `<p class="card-meta">${meta.join(' · ')}</p>` : ''
    return `<${tag} class="card"${attrs}><div class="thumb">${art}${p.thumb ? "" : '<span class="sample">샘플</span>'}<div class="overlay"><strong>${escapeHTML(p.name)}</strong><span>View Project</span></div></div><div class="card-info"><h3 class="card-title">${escapeHTML(p.name)}</h3>${role}${details}</div></${tag}>`
}

function render(animate) {
    const list = PROJECTS.filter(p => p.category === state.cat)
    const n = state.shown[state.cat]
    const prev = animate === "more" ? grid.children.length : 0
    grid.innerHTML = list.length ? list.slice(0,n).map(cardHTML).join("") : '<p class="project-empty">아직 공개된 프로젝트가 없습니다.</p>'
    ;[...grid.children].forEach((el,i) => {
        if (i < prev) {el.classList.add("in");return}
        el.style.transitionDelay = `${Math.min(i - prev,5) * 70}ms`
        io.observe(el)
    })
    moreBtn.hidden = n >= list.length
    document.getElementById("tabDesc").textContent = CATEGORY_DESC[state.cat]
}

function selectTab(tab,focus) {
    state.cat = tab.dataset.cat
    tabs.forEach(t => {const on = t === tab;t.setAttribute("aria-selected",on);t.tabIndex = on ? 0 : -1})
    document.getElementById("panel").setAttribute("aria-labelledby",tab.id)
    if (focus) tab.focus()
    render()
}
tabs.forEach(t => t.addEventListener("click",() => selectTab(t)))
document.getElementById("tabs").addEventListener("keydown",e => {
    const i = tabs.indexOf(document.activeElement)
    if (i < 0) return
    const map = {ArrowRight:i + 1,ArrowLeft:i - 1,Home:0,End:tabs.length - 1}
    if (!(e.key in map)) return
    e.preventDefault()
    selectTab(tabs[(map[e.key] + tabs.length) % tabs.length],true)
})
moreBtn.addEventListener("click",() => {state.shown[state.cat] += 3;render("more")})

// ===== Contact: 실제 연락처를 입력한 항목만 표시 =====
const list = document.getElementById("contactList")
const items = []
if (CONTACT.email) items.push(`<div class="contact-item"><dt>Email</dt><dd><a href="mailto:${escapeHTML(CONTACT.email)}">${escapeHTML(CONTACT.email)}</a></dd><button class="copy" type="button" id="copyMail">이메일 복사</button></div>`)
if (CONTACT.phone) items.push(`<div class="contact-item"><dt>Phone</dt><dd><a href="tel:${CONTACT.phone.replace(/[^\d+]/g,"")}">${escapeHTML(CONTACT.phone)}</a></dd></div>`)
if (safeURL(CONTACT.resume)) items.push(`<div class="contact-item"><dt>Resume</dt><dd><a href="${safeURL(CONTACT.resume)}" target="_blank" rel="noopener noreferrer">PDF 보기 ↗</a></dd></div>`)
CONTACT.profiles.forEach(p => {if (safeURL(p.url)) items.push(`<div class="contact-item"><dt>${escapeHTML(p.label)}</dt><dd><a href="${safeURL(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(p.label)} 바로가기 ↗</a></dd></div>`)})
if (!items.length) items.push('<div class="contact-item"><dt>Contact</dt><dd>연락처 등록 예정</dd><small>assets/js/main.js의 CONTACT 데이터에 이메일 등을 입력해 주세요.</small></div>')
list.innerHTML = items.join("")
const cta = []
if (CONTACT.email) cta.push(`<a class="btn btn-primary" href="mailto:${escapeHTML(CONTACT.email)}">이메일 보내기 ↗</a>`)
if (safeURL(CONTACT.resume)) cta.push(`<a class="btn btn-ghost" href="${safeURL(CONTACT.resume)}" target="_blank" rel="noopener noreferrer">이력서 보기 ↗</a>`)
document.getElementById("cta").innerHTML = cta.join("")
const toast = document.getElementById("toast")
function notify(msg) {toast.textContent = msg;toast.classList.add("show");clearTimeout(notify.t);notify.t = setTimeout(() => toast.classList.remove("show"),2200)}
const copyMail = document.getElementById("copyMail")
if (copyMail) copyMail.addEventListener("click",async () => {
    try {await navigator.clipboard.writeText(CONTACT.email);notify("이메일 주소를 복사했어요")}
    catch (e) {const r = document.createRange();r.selectNodeContents(list.querySelector("dd a"));const sel = getSelection();sel.removeAllRanges();sel.addRange(r);notify("주소를 선택했어요. 복사해 주세요")}
})

// ===== Footer =====
document.getElementById("copyright").textContent = `© ${new Date().getFullYear()} ${BRAND}. All rights reserved.`
document.getElementById("backToTop").addEventListener("click",() => window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth"}))

loadProjects()
