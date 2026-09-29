(() => {
  const shell=document.getElementById("shell"),card=document.getElementById("popCard"),loading=document.getElementById("loadingState"),links=document.getElementById("links"),avatar=document.getElementById("avatar");
  const layer=document.getElementById("gameLayer"),canvas=document.getElementById("gameCanvas"),ctx=canvas.getContext("2d"),scoreEl=document.getElementById("gameScore"),controls=document.getElementById("gameControls");
  const close=document.getElementById("closeGame"),restart=document.getElementById("restartGame");
  const icons={website:"↗",menu:"☰",instagram:"IG",facebook:"f",tiktok:"♪",whatsapp:"WA",maps:"⌖",custom:"↗",snake:"S",tetris:"T"};
  let current="",stop=null;

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const initials=v=>String(v||"AuraPop").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();

  function inactive(message="This AuraPop is not active yet."){
    card.hidden=true;loading.hidden=false;loading.innerHTML=`<h1>AuraPop is waiting for activation.</h1><p>${esc(message)}</p><a href="/">Open AuraPops Studio →</a>`;
  }
  async function load(){
    const m=location.pathname.match(/^\/p\/([a-z0-9-]+)$/i);if(!m)return inactive("Invalid AuraPop address.");
    try{const r=await fetch("/api/public/"+encodeURIComponent(m[1]));const data=await r.json().catch(()=>({}));if(!r.ok||!data.pop)return inactive(data.error);render(data.pop);}catch{inactive("AuraPop could not be loaded right now.");}
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
    loading.hidden=true;card.hidden=false;
  }

  function stopGame(){if(typeof stop==="function")stop();stop=null;}
  function openGame(type){
    stopGame();current=type;layer.classList.add("open");layer.setAttribute("aria-hidden","false");document.getElementById("gameTitle").textContent=type==="snake"?"Snake":"Tetris";
    controls.className="controls"+(type==="tetris"?" tetris":"");
    controls.innerHTML=type==="snake"?'<button data-action="up">↑</button><button data-action="left">←</button><button data-action="down">↓</button><button data-action="right">→</button>':'<button data-action="rotate">↻</button><button data-action="left">←</button><button data-action="right">→</button><button data-action="down">↓</button>';
    type==="snake"?startSnake():startTetris();
  }
  function closeGame(){stopGame();layer.classList.remove("open");layer.setAttribute("aria-hidden","true");}
  close.addEventListener("click",closeGame);layer.addEventListener("click",e=>{if(e.target===layer)closeGame();});restart.addEventListener("click",()=>current==="snake"?startSnake():startTetris());
  function bind(handler){controls.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("pointerdown",e=>{e.preventDefault();handler(b.dataset.action);}));}

  function startSnake(){
    stopGame();canvas.width=300;canvas.height=300;const grid=15,cell=20;let snake=[{x:7,y:7},{x:6,y:7},{x:5,y:7}],dir={x:1,y:0},next={...dir},score=0,ended=false;
    function foodPlace(){let p;do{p={x:Math.floor(Math.random()*grid),y:Math.floor(Math.random()*grid)}}while(snake.some(s=>s.x===p.x&&s.y===p.y));return p}let food=foodPlace();
    function action(name){const m={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}},w=m[name];if(!w||w.x===-dir.x&&w.y===-dir.y)return;next=w}
    function key(e){const m={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"};if(m[e.key]){e.preventDefault();action(m[e.key]);}}
    document.addEventListener("keydown",key);bind(action);
    function draw(){ctx.fillStyle="#050a07";ctx.fillRect(0,0,300,300);ctx.fillStyle="#e1e100";ctx.fillRect(food.x*cell+2,food.y*cell+2,cell-4,cell-4);snake.forEach((p,i)=>{ctx.fillStyle=i===0?"#fff":"#8fbf8f";ctx.fillRect(p.x*cell+1,p.y*cell+1,cell-2,cell-2)});if(ended){ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(0,0,300,300);ctx.fillStyle="#fff";ctx.font="700 24px system-ui";ctx.textAlign="center";ctx.fillText("Game over",150,145)}}
    function step(){if(ended)return;dir=next;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(h.x<0||h.x>=grid||h.y<0||h.y>=grid||snake.some(p=>p.x===h.x&&p.y===h.y)){ended=true;draw();return}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score+=10;scoreEl.textContent="Score: "+score;food=foodPlace()}else snake.pop();draw()}
    scoreEl.textContent="Score: 0";draw();const timer=setInterval(step,125);stop=()=>{clearInterval(timer);document.removeEventListener("keydown",key)};
  }

  const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
  function startTetris(){
    stopGame();const cols=10,rows=20,cell=20;canvas.width=cols*cell;canvas.height=rows*cell;let board=Array.from({length:rows},()=>Array(cols).fill(0)),score=0,ended=false,last=0,raf=0,dropEvery=520,piece=spawn();
    function spawn(){const matrix=SHAPES[Math.floor(Math.random()*SHAPES.length)].map(r=>r.slice());return{matrix,x:Math.floor((cols-matrix[0].length)/2),y:0}}
    const rotate=m=>m[0].map((_,i)=>m.map(r=>r[i]).reverse());
    function collision(t=piece){for(let y=0;y<t.matrix.length;y++)for(let x=0;x<t.matrix[y].length;x++)if(t.matrix[y][x]){const bx=t.x+x,by=t.y+y;if(bx<0||bx>=cols||by>=rows||(by>=0&&board[by][bx]))return true}return false}
    function merge(){piece.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v&&piece.y+y>=0)board[piece.y+y][piece.x+x]=1}));let cleared=0;board=board.filter(r=>{if(r.every(Boolean)){cleared++;return false}return true});while(board.length<rows)board.unshift(Array(cols).fill(0));if(cleared){score+=[0,100,300,500,800][cleared]||cleared*200;scoreEl.textContent="Score: "+score;dropEvery=Math.max(180,520-Math.floor(score/500)*35)}piece=spawn();if(collision())ended=true}
    function drop(){if(ended)return;const t={...piece,y:piece.y+1};collision(t)?merge():piece=t}
    function action(name){if(ended)return;if(name==="left"||name==="right"){const t={...piece,x:piece.x+(name==="left"?-1:1)};if(!collision(t))piece=t}else if(name==="down")drop();else if(name==="rotate"){const t={...piece,matrix:rotate(piece.matrix)};if(!collision(t))piece=t}draw()}
    function key(e){const m={ArrowLeft:"left",ArrowRight:"right",ArrowDown:"down",ArrowUp:"rotate"," ":"rotate"};if(m[e.key]){e.preventDefault();action(m[e.key])}}document.addEventListener("keydown",key);bind(action);
    function block(x,y,fill){ctx.fillStyle=fill;ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2)}function draw(){ctx.fillStyle="#050a07";ctx.fillRect(0,0,canvas.width,canvas.height);board.forEach((r,y)=>r.forEach((v,x)=>{if(v)block(x,y,"#718d73")}));piece.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v)block(piece.x+x,piece.y+y,"#e1e100")}));if(ended){ctx.fillStyle="rgba(0,0,0,.72)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#fff";ctx.font="700 20px system-ui";ctx.textAlign="center";ctx.fillText("Game over",canvas.width/2,canvas.height/2)}}
    function loop(t){if(t-last>dropEvery){drop();last=t}draw();if(!ended)raf=requestAnimationFrame(loop)}scoreEl.textContent="Score: 0";draw();raf=requestAnimationFrame(loop);stop=()=>{cancelAnimationFrame(raf);document.removeEventListener("keydown",key)};
  }
  load();
})();