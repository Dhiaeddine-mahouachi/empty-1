import {SnakeGame,TetrisGame} from './games-core.js?v=20261003';
let activeClose=null;
export function openGame(type){
  if(!['snake','tetris'].includes(type))return;
  activeClose?.();
  const previousFocus=document.activeElement,abort=new AbortController(),signal=abort.signal;
  const dialog=document.createElement('dialog');dialog.className='ap-game';dialog.setAttribute('aria-labelledby','ap-game-title');
  const actions=type==='snake'?[['up','↑','Up'],['left','←','Left'],['down','↓','Down'],['right','→','Right']]:[['left','←','Move left'],['rotate','↻','Rotate'],['right','→','Move right'],['down','↓','Soft drop'],['drop','⇓','Drop']];
  dialog.innerHTML=`<header class="ap-game-head"><div><span class="ap-game-kicker">AURAPOPS ARCADE</span><h2 id="ap-game-title">${type==='snake'?'Snake':'Tetris'}</h2></div><button class="ap-game-close" aria-label="Close game">×</button></header><div class="ap-game-meta"><output class="ap-game-score">Score: 0</output><button class="ap-game-pause">Pause</button></div><div class="ap-game-board"><canvas aria-label="${type} game board"></canvas></div><p class="ap-game-help">${type==='snake'?'Swipe on the board or use the arrows.':'Swipe to move · tap to rotate · ⇓ to drop.'}</p><div class="ap-game-controls ${type}">${actions.map(([action,icon,label])=>`<button type="button" data-action="${action}" aria-label="${label}">${icon}</button>`).join('')}</div><button class="ap-game-restart" type="button">Restart game</button><p class="ap-game-status" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),score=dialog.querySelector('output'),pause=dialog.querySelector('.ap-game-pause'),status=dialog.querySelector('.ap-game-status');
  let game,paused=false,raf=0,last=null,elapsed=0,held=null,gesture=null,announced=false;
  const cell=24,width=type==='snake'?432:240,height=type==='snake'?432:480,dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);canvas.style.aspectRatio=`${width} / ${height}`;
  const colors=['','#dfff69','#c9dfcf','#73c5a5','#a1bfff','#d1acff','#ffce8d','#f398aa'];
  function block(x,y,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x*cell+2,y*cell+2,cell-4,cell-4,4);ctx.fill();ctx.globalAlpha=1;}
  function draw(){ctx.fillStyle='#07130e';ctx.fillRect(0,0,width,height);ctx.strokeStyle='rgba(210,235,216,.04)';ctx.lineWidth=1;for(let x=0;x<=width;x+=cell){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}for(let y=0;y<=height;y+=cell){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
    if(type==='snake'){if(game.food)block(game.food.x,game.food.y,'#dfff69');const blend=game.ended?1:Math.min(1,elapsed/game.interval);game.snake.forEach((p,i)=>{const old=game.previous[i]||game.previous.at(-1)||p;block(old.x+(p.x-old.x)*blend,old.y+(p.y-old.y)*blend,i?'#85bca0':'#f3fff6');});}
    else{game.board.forEach((r,y)=>r.forEach((v,x)=>{if(v)block(x,y,colors[v]);}));const ghost=game.ghost();ghost.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v)block(ghost.x+x,ghost.y+y,colors[ghost.color],.18);}));game.piece.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v)block(game.piece.x+x,game.piece.y+y,colors[game.piece.color]);}));}
    if(paused||game.ended){ctx.fillStyle='rgba(3,12,7,.82)';ctx.fillRect(0,0,width,height);ctx.textAlign='center';ctx.fillStyle='#f3fff6';ctx.font='700 23px system-ui';ctx.fillText(paused?'Paused':game.won?'You win!':'Game over',width/2,height/2-6);ctx.font='14px system-ui';ctx.fillStyle='#b4c7b9';ctx.fillText(paused?'Tap Resume to play':'Tap Restart to play again',width/2,height/2+22);}
    score.textContent=`Score: ${game.score}${type==='tetris'?` · Lines: ${game.lines}`:''}`;
    if(game.ended&&!announced){announced=true;held=null;status.textContent=`${game.won?'You win!':'Game over.'} Score: ${game.score}.`;pause.disabled=true;}
  }
  function action(name){if(paused||game.ended)return;game.action(name);if(type==='tetris'&&(name==='down'||name==='drop'))elapsed=0;draw();}
  function frame(now){const dt=last===null?0:Math.min(50,now-last);last=now;if(!paused&&!game.ended){elapsed+=dt;if(held){held.elapsed+=dt;if(held.elapsed>=held.next){action(held.name);held.next=held.elapsed+75;}}while(elapsed>=game.interval&&!game.ended){elapsed-=game.interval;game.step();}}draw();raf=requestAnimationFrame(frame);}
  function reset(){game=type==='snake'?new SnakeGame():new TetrisGame();elapsed=0;last=null;paused=false;held=null;gesture=null;announced=false;pause.disabled=false;pause.textContent='Pause';status.textContent='';draw();}
  function togglePause(force){if(game.ended)return;paused=typeof force==='boolean'?force:!paused;held=null;gesture=null;last=null;pause.textContent=paused?'Resume':'Pause';draw();}
  function close(){cancelAnimationFrame(raf);abort.abort();dialog.close();dialog.remove();if(activeClose===close)activeClose=null;previousFocus?.focus();}
  activeClose=close;
  dialog.querySelector('.ap-game-close').addEventListener('click',close,{signal});dialog.addEventListener('cancel',e=>{e.preventDefault();close();},{signal});
  dialog.querySelector('.ap-game-restart').addEventListener('click',reset,{signal});pause.addEventListener('click',()=>togglePause(),{signal});
  const controls=dialog.querySelector('.ap-game-controls');
  controls.addEventListener('pointerdown',e=>{const button=e.target.closest('[data-action]');if(!button)return;e.preventDefault();button.setPointerCapture(e.pointerId);action(button.dataset.action);if(type==='tetris'&&['left','right','down'].includes(button.dataset.action))held={name:button.dataset.action,elapsed:0,next:260};},{signal});
  controls.addEventListener('click',e=>{if(e.detail===0){const button=e.target.closest('[data-action]');if(button)action(button.dataset.action);}},{signal});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])controls.addEventListener(name,()=>{held=null;},{signal});
  canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);gesture={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};},{signal});
  canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;action(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':type==='snake'?'up':'rotate');gesture.x=e.clientX;gesture.y=e.clientY;gesture.moved=true;},{signal});
  canvas.addEventListener('pointerup',e=>{if(gesture?.id===e.pointerId&&type==='tetris'&&!gesture.moved)action('rotate');gesture=null;},{signal});canvas.addEventListener('pointercancel',()=>{gesture=null;},{signal});
  document.addEventListener('keydown',e=>{const keys={ArrowUp:type==='snake'?'up':'rotate',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',' ':type==='tetris'?'drop':null};if(e.key==='p'||e.key==='P'){e.preventDefault();togglePause();}else if(keys[e.key]){e.preventDefault();action(keys[e.key]);}},{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)togglePause(true);},{signal});window.addEventListener('blur',()=>togglePause(true),{signal});
  reset();dialog.showModal();dialog.querySelector('.ap-game-close').focus();raf=requestAnimationFrame(frame);
}
