import {openGame} from './games.js?v=20261003';
(() => {
  const shell=document.getElementById("shell"),card=document.getElementById("popCard"),loading=document.getElementById("loadingState"),links=document.getElementById("links"),avatar=document.getElementById("avatar");
  const open=document.getElementById("openPop");
  document.getElementById("closePop").addEventListener("click",()=>card.close());
  open.addEventListener("click",()=>card.showModal());
  card.addEventListener("close",()=>{open.hidden=false;open.focus();});
  card.addEventListener("click",e=>{if(e.target!==card)return;const r=card.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)card.close();});
  const icons={website:"↗",menu:"☰",instagram:"IG",facebook:"f",tiktok:"♪",whatsapp:"WA",maps:"⌖",custom:"↗",snake:"S",tetris:"T"};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const initials=v=>String(v||"AuraPop").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();

  function inactive(message="This AuraPop is not active yet."){
    if(card.open)card.close();open.hidden=true;loading.hidden=false;loading.innerHTML=`<h1>AuraPop is waiting for activation.</h1><p>${esc(message)}</p><a href="/aurapops">Open AuraPops Studio →</a>`;
  }
  async function load(){
    const m=location.pathname.match(/^\/pops\/([a-z0-9-]+)$/i);if(!m)return inactive("Invalid AuraPop address.");
    try{const r=await fetch("/api/aurapops/public/"+encodeURIComponent(m[1]));const data=await r.json().catch(()=>({}));if(!r.ok||!data.pop)return inactive(data.error);render(data.pop);}catch{inactive("AuraPop could not be loaded right now.");}
  }
  function render(pop){
    document.title=pop.title+" — AuraPop";
    shell.style.setProperty("--bg",pop.backgroundColor||"#0b1610");shell.style.setProperty("--card",pop.cardColor||"#111a16");shell.style.setProperty("--text",pop.textColor||"#fff");shell.style.setProperty("--accent",pop.accentColor||"#e1e100");
    shell.style.backgroundColor=pop.backgroundColor||"#0b1610";shell.style.backgroundImage=pop.backgroundMode==="image"&&pop.backgroundImageUrl?`linear-gradient(rgba(2,7,4,.12),rgba(2,7,4,.48)),url("${pop.backgroundImageUrl}")`:"none";
    avatar.innerHTML=pop.avatarUrl?`<img src="${esc(pop.avatarUrl)}" alt="${esc(pop.title)}">`:`<span>${esc(initials(pop.title))}</span>`;
    document.getElementById("title").textContent=pop.title||"AuraPop";document.getElementById("subtitle").textContent=pop.subtitle||"";
    links.innerHTML=(pop.links||[]).map(item=>{
      const type=item.type||"custom",game=type==="snake"||type==="tetris";
      if(game)return `<button class="link" type="button" data-game="${type}"><span class="icon">${icons[type]}</span><span>${esc(item.label||"Play")}</span><small>Play here</small></button>`;
      return `<a class="link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><span class="icon">${esc(icons[type]||"↗")}</span><span>${esc(item.label||"Open link")}</span><small>Open ↗</small></a>`;
    }).join("")||'<div class="link"><span class="icon">AP</span><span>No items yet</span></div>';
    links.querySelectorAll("[data-game]").forEach(b=>b.addEventListener("click",()=>openGame(b.dataset.game)));
    loading.hidden=true;open.hidden=false;card.showModal();
  }

  load();
})();
