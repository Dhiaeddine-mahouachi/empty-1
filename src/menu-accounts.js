import { customerSession, CustomerError } from './customer.js';
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,'0')).join('');
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function handleMenuAccounts(request,env){
 const url=new URL(request.url),path=url.pathname;
 const user=await customerSession(request,env.DB);
 if(path==='/api/aurapops/account/menus'){
  if(!user?.emailVerified)throw new CustomerError(403,'Sign in and verify your email to open your menus.');
  const rows=await env.DB.prepare('SELECT id,slug,business_name,status,payment_status,updated_at FROM auramenu_requests WHERE lower(trim(email))=? ORDER BY created_at DESC').bind(user.email).all();
  return json({items:rows.results.map(r=>({id:r.id,slug:r.slug,title:r.business_name,status:r.status,paymentStatus:r.payment_status,publicUrl:'https://auramenu.space/'+r.slug,updatedAt:r.updated_at}))});
 }
 if(!path.startsWith('/api/auramenu/'))return null;
 if(request.method==='OPTIONS')return new Response(null,{status:204});
 if(request.method!=='GET'&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)throw new CustomerError(403,'Invalid request origin.');
 const target=new URL(path+url.search,'https://auradigitalworks.com'),headers=new Headers(request.headers);headers.delete('Cookie');headers.delete('Content-Length');headers.delete('Host');headers.delete('X-Aura-Menu-Token');let payload;
 if(path==='/api/auramenu/requests'&&request.method==='POST'){
  if(!user?.emailVerified)throw new CustomerError(403,'Verify your email before submitting your menu.');
  const text=await request.text();if(text.length>5*1024*1024)throw new CustomerError(413,'Request too large.');let data;try{data=JSON.parse(text);}catch{throw new CustomerError(400,'Invalid request.');}data.email=user.email;payload=JSON.stringify(data);headers.set('Content-Type','application/json');
 }
 const match=path.match(/^\/api\/auramenu\/dashboard\/([a-f0-9-]+)(?:\/(?:claim|access-request))?$/i);
 if(match){
  if(!user?.emailVerified)throw new CustomerError(403,'Sign in and verify your email to open your menu.');
  const row=await env.DB.prepare('SELECT id,email FROM auramenu_requests WHERE id=?').bind(match[1]).first();
  if(!row||String(row.email||'').trim().toLowerCase()!==user.email)throw new CustomerError(403,'This menu does not belong to your account.');
  const secret=env.RESEND_API_KEY||env.GOOGLE_CLIENT_SECRET;if(!secret)throw new CustomerError(503,'Account services are not configured yet.');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const raw=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('auramenu-account-bridge:'+row.id))),x=>x.toString(16).padStart(2,'0')).join('');
  // Only the server holds this bridge credential; existing paid editing rules remain enforced upstream.
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS auramenu_edit_access (menu_id TEXT PRIMARY KEY,token_hash TEXT NOT NULL DEFAULT '',request_status TEXT NOT NULL DEFAULT 'none',requested_at TEXT,requested_days INTEGER NOT NULL DEFAULT 0,requested_amount INTEGER NOT NULL DEFAULT 0,access_until TEXT,paid_amount INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await env.DB.prepare("INSERT OR IGNORE INTO auramenu_edit_access (menu_id) VALUES (?)").bind(row.id).run();
  await env.DB.prepare("UPDATE auramenu_edit_access SET token_hash=?,updated_at=datetime('now') WHERE menu_id=?").bind(await hash(raw),row.id).run();
  headers.set('X-Aura-Menu-Token',raw);
  if(path.endsWith('/claim')){target.pathname=path.replace(/\/claim$/,'');return fetch(target,{headers,signal:AbortSignal.timeout(15000)});}
 }
 if(!['GET','HEAD'].includes(request.method)&&payload===undefined)payload=await request.text();
 return fetch(target,{method:request.method,headers,body:payload,redirect:'manual',signal:AbortSignal.timeout(15000)});
}
