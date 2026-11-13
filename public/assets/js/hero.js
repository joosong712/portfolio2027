// Scroll-driven folder interaction; native requestAnimationFrame (no GSAP dependency).
function setupCollectMotion() {
    const hero=document.querySelector('.hero-scroll')
    const tools=['ps','ai','figma','vs'].map(id=>document.querySelector('[data-tool="'+id+'"]'))
    const visual=document.querySelector('.hero-visual')
    const heading=document.querySelector('.hero-heading')
    const finish=document.querySelector('.hero-finish')
    const hint=document.querySelector('.hero-scrollhint')
    const progress=document.querySelector('.hero-step')
    const stepMark=document.querySelector('.step-mark')
    const stepName=document.querySelector('.step-name')
    const titles=['Photoshop','Illustrator','Figma','Visual Studio']
    const capsules=['ps','ai','figma','vs'].map(id=>document.querySelector('[data-capsule="'+id+'"]'))
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches
    const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x))
    const smooth=x=>{x=clamp(x);return x*x*(3-2*x)}
    const mix=(a,b,t)=>a+(b-a)*t
    const from=[[-145,-155,-25,.65],[155,-145,22,.65],[160,100,24,.65],[-145,-180,-20,.65]]
    const dest=[[-8,-4,-12,1],[2,-3,8,1],[8,-1,12,1],[1,-6,-5,1]]
    if(reduced){tools.forEach((el,i)=>{el.style.opacity='1';el.style.transform=`translate(${dest[i][0]}%,${dest[i][1]}%) rotate(${dest[i][2]}deg)`});capsules.forEach(el=>{el.style.opacity='1';el.style.transform='translateY(0) scale(1)'});return}
    let running=false
    function update(){
        const p=clamp(-hero.getBoundingClientRect().top/Math.max(1,hero.offsetHeight-innerHeight))
        hint.style.opacity=String(1-smooth(p/.075))
        const headOn=smooth((p-.035)/.065)*(1-smooth((p-.85)/.07))
        heading.style.opacity=String(headOn)
        heading.style.transform=`translateY(${mix(20,0,smooth(p/.11))}px)`
        let current=0
        tools.forEach((el,i)=>{
            const begin=.11+i*.175
            const t=smooth((p-begin)/.16)
            const appear=smooth((p-begin)/.045)
            const f=from[i],to=dest[i]
            // An arc is added before the icon slots behind the folder front panel.
            const arc=-17*Math.sin(Math.PI*t)
            const x=mix(f[0],to[0],t)
            const y=mix(f[1],to[1],t)+arc
            const rot=mix(f[2],to[2],t)
            const scale=mix(f[3],to[3],t)
            el.style.opacity=String(appear)
            el.style.transform=`translate(${x}%,${y}%) rotate(${rot}deg) scale(${scale})`
            // Capsule follows the completion of its corresponding tool's collection.
            const reveal=smooth((p-(begin+.105))/.095)*(1-smooth((p-.86)/.11))
            capsules[i].style.opacity=String(reveal)
            capsules[i].style.transform=`translateY(${mix(12,0,reveal)}px) scale(${mix(.94,1,reveal)})`
            if(p>begin)current=i+1
        })
        const inProgress=smooth((p-.1)/.05)*(1-smooth((p-.83)/.05))
        progress.style.opacity=String(inProgress)
        if(current){stepMark.textContent=String(current).padStart(2,'0')+' / 04';stepName.textContent=titles[current-1]}
        const ft=smooth((p-.86)/.12)
        visual.style.transform=`translate(-50%,-50%) translateY(${ft*28}px) scale(${1-.19*ft})`
        finish.style.opacity=String(ft)
        finish.style.transform=`translateY(${mix(25,0,ft)}px)`
        running=false
    }
    function request(){if(!running){running=true;requestAnimationFrame(update)}}
    addEventListener('scroll',request,{passive:true})
    addEventListener('resize',request)
    update()
}
window.addEventListener('load',setupCollectMotion)
