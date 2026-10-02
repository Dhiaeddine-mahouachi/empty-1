const COOKIE='__Host-aurapops_user';
const AGE=14*24*60*60;
export class CustomerError extends Error { constructor(status,message){super(message);this.status=status;} }
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const bytes=v=>new TextEncoder().encode(v);
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async v=>hex(await crypto.subtle.digest('SHA-256',bytes(v)));
const cookie=(v,age=AGE)=>`${COOKIE}=${v}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const readCookie=(r,name)=>r.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
const publicUser=u=>({id:u.id,name:u.name,email:u.email,googleConnected:!!u.google_sub});
async function passwordHash(password,salt){const k=await crypto.subtle.importKey('raw',bytes(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations:100000},k,256));}
function equal(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function body(r){const t=await r.text();if(t.length>4096)throw new CustomerError(413,'Request too large.');try{return JSON.parse(t);}catch{throw new CustomerError(400,'Invalid request.');}}
function emailOf(v){const email=String(v||'').trim().toLowerCase();if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new CustomerError(400,'Enter a valid email address.');return email;}
function passwordOf(v){if(typeof v!=='string'||v.length<10||v.length>128)throw new CustomerError(400,'Use a password with 10–128 characters.');return v;}
export async function ensureCustomers(db){await db.batch([
 db.prepare("CREATE TABLE IF NOT EXISTS aurapops_customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT, password_salt TEXT, google_sub TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')) )"),
 db.prepare("CREATE TABLE IF NOT EXISTS aurapops_customer_sessions (token_hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES aurapops_customers(id), expires_at TEXT NOT NULL)"),
 db.prepare("CREATE TABLE IF NOT EXISTS aurapops_ownership (pop_id TEXT PRIMARY KEY REFERENCES aurapops(id), customer_id TEXT NOT NULL REFERENCES aurapops_customers(id))"),
 db.prepare("CREATE INDEX IF NOT EXISTS idx_aurapops_ownership_customer ON aurapops_ownership(customer_id)"),
 db.prepare("CREATE TABLE IF NOT EXISTS aurapops_auth_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL)"),
 db.prepare("CREATE TABLE IF NOT EXISTS aurapops_oauth_states (state_hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, nonce TEXT NOT NULL, customer_id TEXT, expires_at TEXT NOT NULL)")
]);}
export async function customerSession(request,db){const raw=readCookie(request,COOKIE);if(!/^[a-f0-9]{64}$/.test(raw))return null;return db.prepare("SELECT c.* FROM aurapops_customer_sessions s JOIN aurapops_customers c ON c.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>datetime('now')").bind(await digest(raw)).first();}
export async function customerOwns(request,db,id){const user=await customerSession(request,db);return user&&await db.prepare('SELECT pop_id FROM aurapops_ownership WHERE pop_id=? AND customer_id=?').bind(id,user.id).first();}
async function session(db,user){const raw=random();await db.batch([db.prepare("DELETE FROM aurapops_customer_sessions WHERE expires_at<=datetime('now')"),db.prepare("INSERT INTO aurapops_customer_sessions VALUES (?,?,datetime('now','+14 days'))").bind(await digest(raw),user.id)]);return cookie(raw);}
async function limit(request,db,kind,email=''){const key=await digest(kind+':'+(request.headers.get('CF-Connecting-IP')||'local')+':'+email);await db.prepare("INSERT INTO aurapops_auth_limits VALUES (?,1,datetime('now','+15 minutes')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=datetime('now') THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=datetime('now') THEN datetime('now','+15 minutes') ELSE expires_at END").bind(key).run();const row=await db.prepare('SELECT count FROM aurapops_auth_limits WHERE key=?').bind(key).first();if(row.count>15)throw new CustomerError(429,'Too many attempts. Please try again in 15 minutes.');}
export async function customerApi(request,env,mapPop){
 const url=new URL(request.url),path=url.pathname.replace('/api/aurapops/account',''),db=env.DB;
 if(request.method!=='GET'&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)throw new CustomerError(403,'Invalid request origin.');
 if(path==='/config'&&request.method==='GET')return reply({googleEnabled:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET)});
 if(path==='/session'&&request.method==='GET'){const u=await customerSession(request,db);return reply({user:u?publicUser(u):null});}
 if((path==='/register'||path==='/login')&&request.method==='POST'){
  const data=await body(request),email=emailOf(data.email);await limit(request,db,'auth',email);await limit(request,db,'auth-ip');
  if(path==='/register'){
   const name=String(data.name||'').trim().slice(0,80);if(!name)throw new CustomerError(400,'Enter your name.');const password=passwordOf(data.password),salt=random(),id=crypto.randomUUID();
   if(await db.prepare('SELECT id FROM aurapops_customers WHERE email=?').bind(email).first())throw new CustomerError(409,'An account already uses this email. Please sign in.');
   await db.prepare('INSERT INTO aurapops_customers (id,name,email,password_hash,password_salt) VALUES (?,?,?,?,?)').bind(id,name,email,await passwordHash(password,salt),salt).run();
   const user={id,name,email};return reply({user:publicUser(user)},201,{'Set-Cookie':await session(db,user)});
  }
  const u=await db.prepare('SELECT * FROM aurapops_customers WHERE email=?').bind(email).first();const actual=await passwordHash(String(data.password||'').slice(0,128),u?.password_salt||'dummy-aurapops-password-salt');
  if(!u?.password_hash||!equal(actual,u.password_hash))throw new CustomerError(401,'Email or password is incorrect.');return reply({user:publicUser(u)},200,{'Set-Cookie':await session(db,u)});
 }
 if(path==='/logout'&&request.method==='POST'){await db.prepare('DELETE FROM aurapops_customer_sessions WHERE token_hash=?').bind(await digest(readCookie(request,COOKIE))).run();return reply({ok:true},200,{'Set-Cookie':cookie('',0)});}
 if(path==='/google'&&request.method==='GET'){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new CustomerError(503,'Google sign-in is not configured yet. Use email and password.');
  await limit(request,db,'google');const state=random(),verifier=random(),nonce=random(),u=await customerSession(request,db);
  await db.batch([db.prepare("DELETE FROM aurapops_oauth_states WHERE expires_at<=datetime('now')"),db.prepare("INSERT INTO aurapops_oauth_states VALUES (?,?,?,?,datetime('now','+10 minutes'))").bind(await digest(state),verifier,nonce,u?.id||null)]);
  const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:url.origin+'/api/aurapops/account/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
  return new Response(null,{status:302,headers:{Location:target.href,'Cache-Control':'no-store','Set-Cookie':`__Host-aurapops_oauth=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`}});
 }
 if(path==='/google/callback'&&request.method==='GET'){
  const state=url.searchParams.get('state')||'',code=url.searchParams.get('code');if(!state||!equal(state,readCookie(request,'__Host-aurapops_oauth'))||!code)throw new CustomerError(400,'Google sign-in was cancelled or expired. Please start again.');
  const saved=await db.prepare("DELETE FROM aurapops_oauth_states WHERE state_hash=? AND expires_at>datetime('now') RETURNING *").bind(await digest(state)).first();if(!saved)throw new CustomerError(400,'Google sign-in expired.');
  const exchanged=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:url.origin+'/api/aurapops/account/google/callback',grant_type:'authorization_code',code_verifier:saved.verifier})});
  const tokens=await exchanged.json();if(!exchanged.ok||!tokens.id_token)throw new CustomerError(401,'Google sign-in could not be completed.');
  // Tokens come directly from Google's TLS-protected token endpoint; validate OIDC claims before using identity.
  let claims;try{const segment=tokens.id_token.split('.')[1];claims=JSON.parse(atob(segment.replace(/-/g,'+').replace(/_/g,'/')));}catch{throw new CustomerError(401,'Invalid Google identity.');}
  if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==env.GOOGLE_CLIENT_ID||(typeof claims.exp!=='number'||claims.exp<=Date.now()/1000)||claims.nonce!==saved.nonce||!claims.email_verified||!claims.sub)throw new CustomerError(401,'Google identity could not be verified.');
  const email=emailOf(claims.email);let user=await db.prepare('SELECT * FROM aurapops_customers WHERE google_sub=?').bind(claims.sub).first();
  if(!user){
   const existing=await db.prepare('SELECT * FROM aurapops_customers WHERE email=?').bind(email).first();
   if(existing){const signed=await customerSession(request,db);if(!signed||signed.id!==existing.id||saved.customer_id!==signed.id)throw new CustomerError(409,'Sign in with your password first, then connect Google from your dashboard.');await db.prepare('UPDATE aurapops_customers SET google_sub=? WHERE id=?').bind(claims.sub,existing.id).run();user=existing;}
   else{user={id:crypto.randomUUID(),name:String(claims.name||email.split('@')[0]).slice(0,80),email};await db.prepare('INSERT INTO aurapops_customers (id,name,email,google_sub) VALUES (?,?,?,?)').bind(user.id,user.name,email,claims.sub).run();}
  }
  return new Response(null,{status:302,headers:{Location:'/dashboard','Cache-Control':'no-store','Set-Cookie':await session(db,user)}});
 }
 const user=await customerSession(request,db);if(!user)throw new CustomerError(401,'Please sign in to your account.');
 if(path==='/pops'&&request.method==='GET'){const rows=await db.prepare('SELECT p.* FROM aurapops p JOIN aurapops_ownership o ON o.pop_id=p.id WHERE o.customer_id=? ORDER BY p.created_at DESC').bind(user.id).all();return reply({items:rows.results.map(r=>mapPop(r,url.origin,true))});}
 if(path==='/claim'&&request.method==='POST'){
  const data=await body(request);const row=await db.prepare('SELECT id,owner_token_hash FROM aurapops WHERE id=?').bind(String(data.id||'')).first();
  if(!row||!/^[a-f0-9]{64}$/.test(data.token||'')||!equal(await digest(data.token),row.owner_token_hash))throw new CustomerError(403,'This saved page cannot be linked to your account.');
  await db.prepare('INSERT INTO aurapops_ownership (pop_id,customer_id) VALUES (?,?) ON CONFLICT(pop_id) DO NOTHING').bind(row.id,user.id).run();
  const owner=await db.prepare('SELECT customer_id FROM aurapops_ownership WHERE pop_id=?').bind(row.id).first();if(owner.customer_id!==user.id)throw new CustomerError(409,'This page belongs to another account.');return reply({ok:true});
 }
 if(path==='/password'&&request.method==='POST'){
  const data=await body(request);if(user.password_hash&&!equal(await passwordHash(String(data.currentPassword||''),user.password_salt),user.password_hash))throw new CustomerError(401,'Current password is incorrect.');const salt=random();await db.prepare('UPDATE aurapops_customers SET password_hash=?,password_salt=? WHERE id=?').bind(await passwordHash(passwordOf(data.password),salt),salt,user.id).run();await db.prepare('DELETE FROM aurapops_customer_sessions WHERE customer_id=?').bind(user.id).run();return reply({ok:true},200,{'Set-Cookie':await session(db,user)});
 }
 return reply({error:'Not found.'},404);
}
