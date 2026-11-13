import {escapeHtml, publicOrigin, normalizeRole} from '../_shared.js'

export async function onRequestGet({params, request, env}) {
    const slug = params.slug
    if (!/^[a-z0-9][a-z0-9-]{2,90}$/.test(slug)) return new Response('Not found', {status:404})

    let project
    try {
        project = await env.DB.prepare('SELECT * FROM projects WHERE slug=? AND published=1 LIMIT 1').bind(slug).first()
    } catch {
        return new Response('Unavailable', {status:503})
    }
    if (!project) return new Response('Not found', {status:404})

    const origin = publicOrigin(env, request)
    const title = escapeHtml(project.title)
    const rawSummary = project.summary || `${project.title} 프로젝트를 소개합니다.`
    const summary = escapeHtml(rawSummary)
    const url = `${origin}/work/${slug}`
    const detailKey = project.detail_image_key || project.image_key
    const image = detailKey ? `${origin}/media/${detailKey}` : `${origin}/og-image.png`
    const thumbnail = project.image_key ? `${origin}/media/${project.image_key}` : image
    const safeSite = project.site_url && /^https?:\/\//i.test(project.site_url) ? project.site_url : null
    const tech = JSON.parse(project.tech_json || '[]')
    const meta = [
        project.industry ? `<span><b>INDUSTRY</b> ${escapeHtml(project.industry)}</span>` : '',
        project.year ? `<span><b>YEAR</b> ${project.year}</span>` : '',
        project.role ? `<span><b>ROLE</b> ${escapeHtml(normalizeRole(project.role))}</span>` : ''
    ].filter(Boolean).join('')
    const jsonld = JSON.stringify({
        '@context':'https://schema.org', '@type':'CreativeWork', name:project.title,
        description:rawSummary, url, image, creator:{'@type':'Person', name:'주송'},
        dateCreated:project.year ? String(project.year) : undefined
    }).replace(/</g, '\u003c')

    const html = `<!doctype html>
<html lang="ko">
    <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="any">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/site.webmanifest">
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title} | JOO SONG PORTFOLIO</title>
        <meta name="description" content="${escapeHtml(rawSummary.slice(0,160))}">
        <link rel="canonical" href="${url}">
        <meta property="og:type" content="article">
        <meta property="og:title" content="${title} | JOO SONG PORTFOLIO">
        <meta property="og:description" content="${escapeHtml(rawSummary.slice(0,160))}">
        <meta property="og:url" content="${url}">
        <meta property="og:image" content="${thumbnail}">
        <meta name="twitter:card" content="summary_large_image">
        <script type="application/ld+json">${jsonld}</script>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/remixicon@4.6.0/fonts/remixicon.css" rel="stylesheet">
        <link rel="stylesheet" href="/assets/css/work.css">
        <script src="/assets/js/work.js" defer></script>
    </head>
    <body>
        <header class="work-header">
            <div class="work-wrap work-header-inner">
                <a class="work-brand" href="/">JOO SONG <span>PORTFOLIO</span></a>
                <a class="work-back" href="/#portfolio" data-project-back>← 뒤로가기</a>
            </div>
        </header>
        <main class="work-wrap">
            <section class="work-hero" aria-labelledby="work-title">
                <p class="work-kicker">${project.category === 'custom' ? 'CUSTOM PROJECT' : 'TEMPLATE PROJECT'}</p>
                <h1 class="work-title" id="work-title">${title}</h1>
                ${meta ? `<div class="work-meta">${meta}</div>` : ''}
            </section>
            <section class="work-description" aria-labelledby="work-description-title">
                <h2 id="work-description-title">프로젝트 소개</h2>
                <div class="work-description-body">
                    <p class="work-summary">${summary}</p>
                    ${tech.length ? `<div class="work-tags">${tech.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
                    ${safeSite ? `<a class="work-button" target="_blank" rel="noopener noreferrer" href="${escapeHtml(safeSite)}">실제 사이트 보기 ↗</a>` : ''}
                </div>
            </section>
            ${detailKey ? `<figure class="work-capture"><img src="${image}" alt="${title} 웹사이트 전체 디자인" width="1100" loading="lazy"></figure>` : ''}
            <nav class="work-project-nav" aria-label="프로젝트 목록 이동">
                <a class="work-project-list" href="/#portfolio"><i class="ri-layout-grid-line" aria-hidden="true"></i><span>모든 프로젝트 보기</span></a>
            </nav>
        </main>
        <footer class="work-wrap work-footer"><span>© JOO SONG PORTFOLIO</span></footer>
    </body>
</html>`

    return new Response(html, {headers:{'content-type':'text/html; charset=utf-8', 'cache-control':'public,max-age=60', 'x-content-type-options':'nosniff'}})
}
