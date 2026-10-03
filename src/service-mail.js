const ORIGINS = new Set(['https://auradigitalworks.com','https://www.auradigitalworks.com','https://aurapops.online','https://www.aurapops.online','https://auramenu.space','https://www.auramenu.space']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function ensureMail(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS aura_mail_outbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt TEXT NOT NULL DEFAULT (datetime('now')), sent_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))") ,
    db.prepare("CREATE TABLE IF NOT EXISTS aura_support_reports (id TEXT PRIMARY KEY, email TEXT NOT NULL, problem TEXT NOT NULL, page_url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))") ,
    db.prepare("CREATE TABLE IF NOT EXISTS aura_support_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL)")
  ]);
}
const insertMail = (db,id,payload) => db.prepare('INSERT OR IGNORE INTO aura_mail_outbox (id,payload) VALUES (?,?)').bind(id,JSON.stringify(payload));
function mail(to,subject,text,link,label='Open dashboard') {
  return {from:'AuraDigital <noreply@auradigitalworks.com>',to:[to],reply_to:'info@auradigitalworks.com',subject,text,
    html:`<div style="background:#10231b;color:#fff;padding:32px;font-family:Arial,sans-serif;border-radius:18px;max-width:620px"><p style="color:#e1e100;font-weight:bold">AuraDigital</p><h1 style="font-size:26px">${esc(subject)}</h1><p style="white-space:pre-wrap;line-height:1.7">${esc(text)}</p>${link?`<p><a href="${esc(link)}" style="display:inline-block;background:#e1e100;color:#10231b;padding:14px 22px;border-radius:30px;font-weight:bold;text-decoration:none">${esc(label)}</a></p>`:''}<p style="font-size:12px;color:#c6cfc9">Automatic notification · info@auradigitalworks.com</p></div>`};
}
export async function activationMail(db,kind,current,updated) {
  if(updated.status!=='approved'||updated.payment_status!=='paid'||(current.status==='approved'&&current.payment_status==='paid')) return null;
  await ensureMail(db);
  let email=String(updated.email||'').trim().toLowerCase();
  if(kind==='pop') {
    const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='aurapops_ownership'").first();
    if(exists) { const owner=await db.prepare('SELECT c.email FROM aurapops_ownership o JOIN aurapops_customers c ON c.id=o.customer_id WHERE o.pop_id=?').bind(updated.id).first(); email=owner?.email||''; }
  }
  if(!EMAIL.test(email)) return null;
  const brand=kind==='pop'?'AuraPops':'AuraMenu', title=updated.title||updated.business_name;
  const dashboard=kind==='pop'?'https://aurapops.online/dashboard':'https://auramenu.space/account';
  const live=kind==='pop'?'https://aurapops.online/pops/'+encodeURIComponent(updated.slug):'https://auramenu.space/'+encodeURIComponent(updated.slug);
  return insertMail(db,`activation/${kind}/${updated.id}/${updated.approved_at}`,mail(email,`Your ${brand} is active`,`${title} is now active and ready to share.\n\nView your live page: ${live}\n\nSign in with your account email to manage it in your dashboard.\n${dashboard}`,dashboard));
}
export async function deliverMail(env) {
  if(!env.DB||!env.RESEND_API_KEY) return;
  await ensureMail(env.DB);
  const rows=await env.DB.prepare("SELECT id FROM aura_mail_outbox WHERE sent_at IS NULL AND next_attempt<=datetime('now') ORDER BY created_at LIMIT 10").all();
  for(const row of rows.results||[]) {
    const claimed=await env.DB.prepare("UPDATE aura_mail_outbox SET attempts=attempts+1,next_attempt=datetime('now','+2 minutes') WHERE id=? AND sent_at IS NULL AND next_attempt<=datetime('now') RETURNING *").bind(row.id).first();
    if(!claimed)continue;
    try {
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:claimed.payload,signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('provider_rejected');
      await env.DB.prepare("UPDATE aura_mail_outbox SET sent_at=datetime('now') WHERE id=?").bind(row.id).run();
    }catch {console.error('aura_notification_delivery_failed',row.id);}
  }
}
export async function handleSupport(request,env) {
  const url=new URL(request.url);if(url.pathname!=='/api/support/report')return null;
  const origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&ORIGINS.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'});
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!origin||!ORIGINS.has(origin))return reply({error:'Invalid request origin.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
  if(!env.DB||!env.RESEND_API_KEY)return reply({error:'Support is temporarily unavailable. Please email info@auradigitalworks.com.'},503);
  if(Number(request.headers.get('Content-Length')||0)>12000)return reply({error:'Report is too long.'},413);
  const raw=await request.text();if(raw.length>12000)return reply({error:'Report is too long.'},413);
  let data;try{data=JSON.parse(raw);}catch{return reply({error:'Invalid report.'},400);}
  const email=typeof data.email==='string'?data.email.trim().toLowerCase():'',problem=typeof data.problem==='string'?data.problem.trim():'';
  if(email.length>254||!EMAIL.test(email))return reply({error:'Enter a valid email address.'},400);
  if(problem.length<10||problem.length>4000)return reply({error:'Describe the problem in 10–4,000 characters.'},400);
  let page;try{page=new URL(data.page);if(!ORIGINS.has(page.origin)||page.origin!==origin)throw new Error();page.search='';page.hash='';}catch{return reply({error:'Invalid website page.'},400);}
  await ensureMail(env.DB);
  const keyBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('CF-Connecting-IP')||email));
  const key=Array.from(new Uint8Array(keyBytes),b=>b.toString(16).padStart(2,'0')).join('');
  const rate=await env.DB.prepare("INSERT INTO aura_support_limits VALUES (?,1,datetime('now','+1 hour')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=datetime('now') THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=datetime('now') THEN datetime('now','+1 hour') ELSE expires_at END RETURNING count").bind(key).first();
  if(rate.count>5)return reply({error:'Too many reports. Please try again in one hour.'},429);
  if(data.website)return reply({error:'Invalid report.'},400);
  const id=crypto.randomUUID();
  const owner=mail('info@auradigitalworks.com',`Website problem report — ${page.hostname}`,`Reference: ${id}\nEmail: ${email}\nWebsite: ${page.origin}\nPage: ${page.href}\n\nProblem:\n${problem}`);owner.reply_to=email;
  const ack=mail(email,'We received your problem report',`Thank you. We received your report and are processing it. Our team will review the problem and contact you if we need more details.\n\nReference: ${id}\nPage: ${page.href}\n\nYour report:\n${problem}`);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO aura_support_reports (id,email,problem,page_url) VALUES (?,?,?,?)').bind(id,email,problem,page.href),
    insertMail(env.DB,'support/team/'+id,owner),insertMail(env.DB,'support/customer/'+id,ack)
  ]);
  return reply({ok:true,reference:id,message:'Report received. We are processing it; your confirmation email is queued.'},202);
}
