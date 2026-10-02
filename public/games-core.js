const directions={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
export class SnakeGame {
  constructor(random=Math.random){this.random=random;this.cols=18;this.rows=18;this.snake=[{x:8,y:9},{x:7,y:9},{x:6,y:9}];this.previous=this.snake.map(p=>({...p}));this.dir=directions.right;this.queue=[];this.score=0;this.ended=false;this.won=false;this.food=this.placeFood();}
  get interval(){return Math.max(85,150-Math.floor(this.score/50)*5);}
  placeFood(){const free=[];for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++)if(!this.snake.some(p=>p.x===x&&p.y===y))free.push({x,y});return free.length?free[Math.floor(this.random()*free.length)]:null;}
  action(name){const d=directions[name],last=this.queue.at(-1)||this.dir;if(!d||this.ended||this.queue.length>=2||(d.x===-last.x&&d.y===-last.y)||(d.x===last.x&&d.y===last.y))return;this.queue.push(d);}
  step(){if(this.ended)return;this.previous=this.snake.map(p=>({...p}));this.dir=this.queue.shift()||this.dir;const head={x:this.snake[0].x+this.dir.x,y:this.snake[0].y+this.dir.y};const eats=head.x===this.food.x&&head.y===this.food.y;const body=eats?this.snake:this.snake.slice(0,-1);if(head.x<0||head.y<0||head.x>=this.cols||head.y>=this.rows||body.some(p=>p.x===head.x&&p.y===head.y)){this.ended=true;return;}this.snake.unshift(head);if(eats){this.score+=10;this.food=this.placeFood();if(!this.food){this.won=true;this.ended=true;}}else this.snake.pop();}
}
const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
export class TetrisGame {
  constructor(random=Math.random){this.random=random;this.cols=10;this.rows=20;this.board=Array.from({length:20},()=>Array(10).fill(0));this.score=0;this.lines=0;this.ended=false;this.bag=[];this.piece=this.spawn();}
  get interval(){return Math.max(120,600-Math.floor(this.lines/5)*45);}
  spawn(){if(!this.bag.length){this.bag=[0,1,2,3,4,5,6];for(let i=6;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}const id=this.bag.pop(),matrix=shapes[id].map(r=>r.slice());return{matrix,x:Math.floor((10-matrix[0].length)/2),y:0,color:id+1};}
  collision(piece){return piece.matrix.some((row,y)=>row.some((v,x)=>v&&(piece.x+x<0||piece.x+x>=10||piece.y+y>=20||(piece.y+y>=0&&this.board[piece.y+y][piece.x+x]))));}
  lock(){const p=this.piece;p.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v&&p.y+y>=0)this.board[p.y+y][p.x+x]=p.color;}));const remaining=this.board.filter(r=>!r.every(Boolean)),cleared=20-remaining.length;this.lines+=cleared;this.score+=[0,100,300,500,800][cleared];while(remaining.length<20)remaining.unshift(Array(10).fill(0));this.board=remaining;this.piece=this.spawn();if(this.collision(this.piece))this.ended=true;}
  step(){if(this.ended)return;const next={...this.piece,y:this.piece.y+1};if(this.collision(next))this.lock();else this.piece=next;}
  ghost(){let p={...this.piece};while(!this.collision({...p,y:p.y+1}))p={...p,y:p.y+1};return p;}
  action(name){if(this.ended)return;if(name==='down'){this.step();return;}if(name==='drop'){const p=this.ghost();this.score+=(p.y-this.piece.y)*2;this.piece=p;this.lock();return;}if(name==='left'||name==='right'){const p={...this.piece,x:this.piece.x+(name==='left'?-1:1)};if(!this.collision(p))this.piece=p;}if(name==='rotate'){const matrix=this.piece.matrix[0].map((_,i)=>this.piece.matrix.map(r=>r[i]).reverse());for(const dx of [0,-1,1,-2,2]){const p={...this.piece,matrix,x:this.piece.x+dx};if(!this.collision(p)){this.piece=p;break;}}}}
}
