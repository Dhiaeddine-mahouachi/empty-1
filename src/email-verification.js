import { CustomerError } from './customer.js';
const enc=v=>new TextEncoder().encode(v);
export const verificationHash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc(v))),x=>x.toString(16).padStart(2,'0')).join('');
export const verificationCookie=(value,age=86400)=>`__Host-aurapops_verify=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export const verificationToken=r=>r.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-aurapops_verify='))?.slice('__Host-aurapops_verify='.length)||'';
const code=()=>{const a=new Uint32Array(1),limit=4294000000;do{crypto.getRandomValues(a);}while(a[0]>=limit);return String(a[0]%1000000).padStart(6,'0');};
export async function ensureVerification(db){await db.batch([
 db.prepare("CREATE TABLE IF NOT EXISTS aurapops_verified_emails (customer_id TEXT PRIMARY KEY REFERENCES aurapops_customers(id), verified_at TEXT NOT NULL DEFAULT (datetime('now')))"),
 db.prepare("CREATE TABLE IF NOT EXISTS aurapops_email_challenges (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, password_hash TEXT, password_salt TEXT, customer_id TEXT, code_hash TEXT, code_expires_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, sent_at TEXT, expires_at TEXT NOT NULL)")
]);}
export async function verificationPending(request,db){const raw=verificationToken(request);if(!/^[a-f0-9]{64}$/.test(raw))return null;return db.prepare("SELECT * FROM aurapops_email_challenges WHERE token_hash=? AND expires_at>datetime('now')").bind(await verificationHash(raw)).first();}
export async function sendVerification(env,pending){
 if(!env.RESEND_API_KEY)throw new CustomerError(503,'Email verification is not configured yet. Please contact AuraDigital.');
 const now=Date.now();if(pending.sent_at&&now-Date.parse(pending.sent_at.replace(' ','T')+'Z')<60000)throw new CustomerError(429,'Please wait 60 seconds before requesting another code.');
 const value=code(),hash=await verificationHash(pending.token_hash+':'+value),db=env.DB;
 const reservation=await db.prepare("UPDATE aurapops_email_challenges SET code_hash=?,code_expires_at=datetime('now','+10 minutes'),attempts=0,sent_at=datetime('now') WHERE token_hash=? AND (sent_at IS NULL OR sent_at<=datetime('now','-60 seconds')) RETURNING token_hash").bind(hash,pending.token_hash).first();
 if(!reservation)throw new CustomerError(429,'Please wait 60 seconds before requesting another code.');
 let r;try{r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'aurapops-verify/'+crypto.randomUUID()},body:JSON.stringify({from:env.AURAPOPS_EMAIL_FROM||'AuraPops <noreply@auradigitalworks.com>',to:[pending.email],subject:'Your AuraPops verification code',text:`Your AuraPops verification code is ${value}.\n\nThis code expires in 10 minutes. If you did not request it, ignore this email. Never share this code.`,html:`<div style="font-family:Arial,sans-serif;background:#101911;color:white;padding:36px;border-radius:16px"><h1 style="color:#e1e100">Verify your email.</h1><p>Enter this code in AuraPops to finish creating your account:</p><p style="font-size:36px;letter-spacing:8px;font-weight:bold">${value}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>`}),signal:AbortSignal.timeout(10000)});}catch{r=null;}
 if(!r?.ok){await db.prepare('UPDATE aurapops_email_challenges SET code_hash=NULL,code_expires_at=NULL,sent_at=NULL WHERE token_hash=? AND code_hash=?').bind(pending.token_hash,hash).run();console.warn('aurapops_verification_delivery_failed',r?.status||'network');throw new CustomerError(503,'The verification email could not be sent. Please try again shortly or contact AuraDigital.');}
 return {verificationRequired:true,email:pending.email,resendAfter:60,expiresIn:600};
}
