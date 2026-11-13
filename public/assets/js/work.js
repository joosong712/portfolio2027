// 상세 페이지에 직접 접속한 경우에는 프로젝트 목록으로 이동합니다.
const backLink = document.querySelector('[data-project-back]')

if (backLink) {
    backLink.addEventListener('click', event => {
        const referrer = document.referrer

        if (!referrer || history.length <= 1) return

        try {
            const previous = new URL(referrer)
            const cameFromPortfolio = previous.origin === location.origin && previous.pathname === '/'

            if (!cameFromPortfolio) return

            event.preventDefault()
            history.back()
        } catch {
            // 유효하지 않은 이전 주소이면 기본 링크(/#portfolio)로 이동합니다.
        }
    })
}
