import { handleMenuAccounts } from './menu-accounts.js';
import { CustomerError, ensureCustomers, customerSession, customerOwns, customerApi } from './customer.js';
const MAX_BODY = 1400 * 1024;
const IMAGE_BYTES = 420 * 1024;
const IMAGE_CHARS = Math.ceil((IMAGE_BYTES * 4) / 3) + 64;
const IMAGE_TYPES = new Set(["image/jpeg","image/png","image/webp"]);
const LINK_TYPES = new Set(["website","menu","instagram","facebook","tiktok","whatsapp","maps","custom","snake","tetris"]);
const POP_STATUS = new Set(["pending","approved","rejected"]);
const PAYMENT_STATUS = new Set(["unpaid","paid"]);
const ADMIN_COOKIE = "__Host-aura_admin";
const AURAPOPS_ADMIN_COOKIE = "__Host-aurapops_admin";
const AURAPOPS_PASSWORD_SALT = "aurapops-admin-v1-2026";
const AURAPOPS_PASSWORD_HASH = "d473e06ab31aa6aa510400377c67f8bd464cef619efbc76bd37ff63a305288c1";
const AURAPOPS_PASSWORD_ITERATIONS = 250000;
const AURAPOPS_SESSION_MAX_AGE = 60 * 60 * 24 * 14;
let schemaReady = false;

export default {
  async fetch(request, env) {
    try {
      const policy = await requestPolicy(request, env);
      if (policy) return secure(policy, request);

      const url = new URL(request.url);
      let response;
      const menuHost=['auramenu.space','www.auramenu.space'].includes(url.hostname);
      if(menuHost&&['/login','/login/','/account','/account/'].includes(url.pathname)) {
        response=await env.ASSETS.fetch(new Request(new URL('/menu-account.html',url),request));return secure(response,request);
      }
      if(menuHost&&url.pathname.startsWith('/api/auramenu/')){await ensureSchema(env.DB);response=await handleMenuAccounts(request,env);return secure(response,request);}
      const agencyHost = ["auradigitalworks.com", "www.auradigitalworks.com"].includes(url.hostname);
      if (agencyHost && ["/aurapops", "/aurapops/"].includes(url.pathname) && ["GET", "HEAD"].includes(request.method)) {
        response = await env.ASSETS.fetch(new Request(new URL("/showcase.html", url), request));
        return secure(response, request);
      }
      if (agencyHost && url.pathname.startsWith("/aurapops/") && !url.pathname.startsWith("/aurapops/showcase.")) {
        const target = new URL(url.pathname.slice("/aurapops".length) || "/", "https://aurapops.online");
        target.search = url.search;
        return secure(Response.redirect(target.toString(), 302), request);
      }
      if (agencyHost && url.pathname.startsWith("/pops/")) {
        return secure(Response.redirect("https://aurapops.online" + url.pathname + url.search, 301), request);
      }

      if (url.pathname === "/" || url.pathname === "/aurapops" || url.pathname === "/aurapops/") {
        response = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
        return secure(response, request);
      }
      if (['/login','/login/','/dashboard','/dashboard/'].includes(url.pathname)) {
        response = await env.ASSETS.fetch(new Request(new URL('/account.html',url),request));
        return secure(response,request);
      }
      if (["/admin","/admin/","/aurapops/admin","/aurapops/admin/"].includes(url.pathname)) {
        response = await env.ASSETS.fetch(new Request(new URL("/admin.html", url), request));
        return secure(response, request);
      }
      if (/^\/pops\/[a-z0-9-]+$/i.test(url.pathname)) {
        response = await env.ASSETS.fetch(new Request(new URL("/view.html", url), request));
        return secure(response, request);
      }
      if (url.pathname.startsWith("/api/aurapops/") || url.pathname === "/api/aurapops") {
        response = await api(request, env);
        return secure(response, request);
      }
      if (url.pathname.startsWith("/aurapops/")) {
        const assetUrl = new URL(url);
        assetUrl.pathname = url.pathname.slice("/aurapops".length) || "/index.html";
        response = await env.ASSETS.fetch(new Request(assetUrl, request));
        return secure(response, request);
      }

      response = await env.ASSETS.fetch(request);
      return secure(response, request);
    } catch (error) {
      console.error("aurapops_error", error?.name || "Error");
      if(new URL(request.url).pathname==='/api/aurapops/account/google/callback') {
        const message=error instanceof CustomerError?error.message:'Google sign-in could not be completed. Please try again.';
        return secure(Response.redirect(new URL('/login?error='+encodeURIComponent(message),request.url).toString(),302),request);
      }
      return secure(json({error: (error instanceof AppError || error instanceof CustomerError) ? error.message : "Server error."}, (error instanceof AppError || error instanceof CustomerError) ? error.status : 500), request);
    }
  }
};

class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(value, status=200, headers={}) {
  return new Response(JSON.stringify(value), {status, headers:{"Content-Type":"application/json; charset=utf-8",...headers}});
}

function clean(value, max=500) {
  return typeof value === "string" ? value.trim().slice(0,max) : "";
}
function color(value, fallback) {
  const text=clean(value,16);
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
}
function slugify(value) {
  return clean(value,80).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,54);
}
function safeUrl(value) {
  const text=clean(value,1000); if(!text) return "";
  try { const u=new URL(text); return ["http:","https:","mailto:","tel:"].includes(u.protocol) ? u.toString() : ""; } catch { return ""; }
}
async function readJson(request, max=MAX_BODY) {
  const length=Number(request.headers.get("Content-Length")||0);
  if(length>max) throw new AppError(413,"Request is too large.");
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>max) throw new AppError(413,"Request is too large.");
  try { return JSON.parse(text||"{}"); } catch { throw new AppError(400,"Invalid JSON."); }
}
async function hash(value) {
  const data=new TextEncoder().encode(String(value||""));
  const digest=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function hashAdminToken(value) {
  const data=new TextEncoder().encode(String(value||""));
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",data));
  let binary="";
  for(const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
async function verifyAuraPopsPassword(value) {
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",encoder.encode(String(value||"")),{name:"PBKDF2"},false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:encoder.encode(AURAPOPS_PASSWORD_SALT),iterations:AURAPOPS_PASSWORD_ITERATIONS},key,256);
  const actual=[...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,"0")).join("");
  if(actual.length!==AURAPOPS_PASSWORD_HASH.length) return false;
  let diff=0;
  for(let i=0;i<actual.length;i++) diff|=actual.charCodeAt(i)^AURAPOPS_PASSWORD_HASH.charCodeAt(i);
  return diff===0;
}
function token() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function sameOrigin(request) {
  const origin=request.headers.get("Origin");
  if(!origin) return true;
  try { return new URL(origin).origin===new URL(request.url).origin; } catch { return false; }
}
function parseCookies(request) {
  const out={}; const raw=request.headers.get("Cookie")||"";
  for(const pair of raw.split(";")) { const i=pair.indexOf("="); if(i>0) out[pair.slice(0,i).trim()]=decodeURIComponent(pair.slice(i+1).trim()); }
  return out;
}
function secure(response, request) {
  const h=new Headers(response.headers);
  h.set("Strict-Transport-Security","max-age=31536000; includeSubDomains");
  h.set("X-Content-Type-Options","nosniff");
  h.set("X-Frame-Options","DENY");
  h.set("Referrer-Policy","no-referrer");
  h.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  if((h.get("Content-Type")||"").includes("text/html")) {
    h.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://api.qrserver.com https://auradigitalworks.com https://images.unsplash.com; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests");
  } else if(!h.has("Content-Security-Policy")) {
    h.set("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  }
  if(new URL(request.url).pathname.startsWith("/api/")) h.set("Cache-Control","no-store");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
async function requestPolicy(request, env) {
  const url=new URL(request.url);
  if(url.protocol!=="https:" && !["localhost","127.0.0.1"].includes(url.hostname)) {
    if(!["GET","HEAD"].includes(request.method)) return json({error:"HTTPS required."},400);
    url.protocol="https:"; return Response.redirect(url.toString(),308);
  }
  let path; try { path=decodeURIComponent(url.pathname); } catch { return json({error:"Invalid path."},400); }
  if(path.includes("\\") || /[\x00-\x1f]/.test(path) || path.split("/").includes("..")) return json({error:"Invalid path."},400);
  if(!["GET","HEAD","POST","PATCH","OPTIONS"].includes(request.method)) return json({error:"Method not allowed."},405);
  if((url.pathname.startsWith("/api/aurapops/") || url.pathname === "/api/aurapops") && !env.DB) return json({error:"Service unavailable."},503);
  return null;
}

async function ensureSchema(db) {
  if(schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS aurapops (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL UNIQUE, owner_token_hash TEXT NOT NULL, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', background_mode TEXT NOT NULL DEFAULT 'color' CHECK (background_mode IN ('color','image')), background_color TEXT NOT NULL DEFAULT '#0b1610', card_color TEXT NOT NULL DEFAULT '#111a16', text_color TEXT NOT NULL DEFAULT '#ffffff', accent_color TEXT NOT NULL DEFAULT '#e1e100', avatar_image_id TEXT, background_image_id TEXT, links_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')), payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')), admin_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), approved_at TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS aurapop_images (id TEXT PRIMARY KEY NOT NULL, pop_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('avatar','background')), content_type TEXT NOT NULL, image_bytes BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (pop_id) REFERENCES aurapops(id) ON DELETE CASCADE)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_aurapops_status_created ON aurapops(status, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_aurapop_images_pop ON aurapop_images(pop_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS aurapops_admin_sessions (token_hash TEXT PRIMARY KEY NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_aurapops_admin_sessions_expiry ON aurapops_admin_sessions(expires_at)")
  ]);
  await ensureCustomers(db);
  schemaReady=true;
}

function decodeImage(dataUrl) {
  const text=String(dataUrl||"").trim(); if(!text) return null;
  const m=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/i.exec(text);
  if(!m) throw new AppError(400,"Only JPG, PNG or WebP images are supported.");
  const contentType=m[1].toLowerCase(), encoded=m[2];
  if(!IMAGE_TYPES.has(contentType)||!encoded||encoded.length%4!==0||encoded.length>IMAGE_CHARS) throw new AppError(400,"Image is invalid or too large.");
  let binary; try { binary=atob(encoded); } catch { throw new AppError(400,"Image is invalid."); }
  if(!binary.length||binary.length>IMAGE_BYTES) throw new AppError(400,"Image is too large.");
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const ok=(contentType==="image/jpeg"&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff) ||
    (contentType==="image/png"&&[0x89,0x50,0x4e,0x47].every((v,i)=>bytes[i]===v)) ||
    (contentType==="image/webp"&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP");
  if(!ok) throw new AppError(400,"Image content is invalid.");
  return {contentType,bytes:bytes.buffer};
}
function normalizeLinks(value) {
  if(!Array.isArray(value)) return [];
  if(value.length>12) throw new AppError(400,"You can add up to 12 items.");
  return value.map((item,index)=>{
    const type=clean(item?.type,30).toLowerCase();
    if(!LINK_TYPES.has(type)) throw new AppError(400,`Item ${index+1} has an unsupported type.`);
    const isGame=type==="snake"||type==="tetris";
    const label=clean(item?.label,60)||(type==="snake"?"Play Snake":type==="tetris"?"Play Tetris":"Open link");
    const url=isGame?"":safeUrl(item?.url);
    if(!isGame&&!url) throw new AppError(400,`Add a valid link for "${label}".`);
    return {type,label,url};
  });
}
function normalizePop(body,current=null) {
  const title=clean(body.title??current?.title,80);
  if(!title) throw new AppError(400,"Add a popup name.");
  return {
    title,
    subtitle:clean(body.subtitle??current?.subtitle,180),
    backgroundMode:["color","image"].includes(body.backgroundMode)?body.backgroundMode:(current?.background_mode||"color"),
    backgroundColor:color(body.backgroundColor??current?.background_color,"#0b1610"),
    cardColor:color(body.cardColor??current?.card_color,"#111a16"),
    textColor:color(body.textColor??current?.text_color,"#ffffff"),
    accentColor:color(body.accentColor??current?.accent_color,"#e1e100"),
    links:normalizeLinks(body.links??(current?JSON.parse(current.links_json||"[]"):[])),
    avatarData:Object.prototype.hasOwnProperty.call(body,"avatarData")?body.avatarData:undefined,
    backgroundData:Object.prototype.hasOwnProperty.call(body,"backgroundData")?body.backgroundData:undefined
  };
}
function mapPop(row,origin,includeState=false) {
  let links=[]; try { links=JSON.parse(row.links_json||"[]"); } catch {}
  const pop={
    id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle,
    backgroundMode:row.background_mode,backgroundColor:row.background_color,cardColor:row.card_color,
    textColor:row.text_color,accentColor:row.accent_color,links,
    avatarUrl:row.avatar_image_id?`${origin}/api/aurapops/images/${row.avatar_image_id}`:"",
    backgroundImageUrl:row.background_image_id?`${origin}/api/aurapops/images/${row.background_image_id}`:"",
    publicUrl:`https://aurapops.online/pops/${row.slug}`,updatedAt:row.updated_at
  };
  if(includeState){pop.status=row.status;pop.paymentStatus=row.payment_status;pop.adminNote=row.admin_note||"";}
  return pop;
}
async function replaceImage(db,popId,kind,dataUrl,currentId) {
  if(dataUrl===undefined) return currentId||null;
  if(!dataUrl){if(currentId) await db.prepare("DELETE FROM aurapop_images WHERE id=? AND pop_id=?").bind(currentId,popId).run(); return null;}
  const image=decodeImage(dataUrl), id=crypto.randomUUID();
  const statements=[db.prepare("INSERT INTO aurapop_images (id,pop_id,kind,content_type,image_bytes) VALUES (?,?,?,?,?)").bind(id,popId,kind,image.contentType,image.bytes)];
  if(currentId) statements.push(db.prepare("DELETE FROM aurapop_images WHERE id=? AND pop_id=?").bind(currentId,popId));
  await db.batch(statements); return id;
}
async function ownerRow(request,db,id) {
  if(await customerOwns(request,db,id)) return db.prepare("SELECT * FROM aurapops WHERE id=? LIMIT 1").bind(id).first();
  if(await db.prepare("SELECT pop_id FROM aurapops_ownership WHERE pop_id=?").bind(id).first()) return null;
  const value=request.headers.get("X-AuraPop-Token")||"";
  if(!/^[a-f0-9]{64}$/i.test(value)) return null;
  const row=await db.prepare("SELECT * FROM aurapops WHERE id=? LIMIT 1").bind(id).first();
  return row&&await hash(value)===row.owner_token_hash?row:null;
}
async function adminSession(request,db) {
  const cookies=parseCookies(request);
  const auraPopsValue=cookies[AURAPOPS_ADMIN_COOKIE]||"";
  if(/^[a-f0-9]{64}$/i.test(auraPopsValue)) {
    const own=await db.prepare("SELECT token_hash FROM aurapops_admin_sessions WHERE token_hash=? AND expires_at>datetime('now') LIMIT 1").bind(await hash(auraPopsValue)).first();
    if(own) return {id:"aurapops-owner",username:"owner",displayName:"AuraPops Owner",role:"owner"};
  }

  const value=cookies[ADMIN_COOKIE]||"";
  if(!/^[A-Za-z0-9_-]{40,50}$/.test(value)) return null;
  const row=await db.prepare(
    "SELECT u.id,u.username,u.display_name,u.role FROM admin_sessions s " +
    "JOIN admin_users u ON u.id=s.user_id " +
    "WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.active=1 LIMIT 1"
  ).bind(await hashAdminToken(value)).first();
  if(!row || !["owner","manager","viewer"].includes(row.role)) return null;
  return {id:row.id,username:row.username,displayName:row.display_name,role:row.role};
}

async function api(request,env) {
  await ensureSchema(env.DB);
  const url=new URL(request.url);

  if(url.pathname==="/api/aurapops/account/menus") return handleMenuAccounts(request,env);
  if(url.pathname.startsWith("/api/aurapops/account/")) return customerApi(request,env,mapPop);

  if(url.pathname==="/api/aurapops/health"&&request.method==="GET") return json({ok:true,service:"aurapops"});

  if(url.pathname==="/api/aurapops/admin/login"&&request.method==="POST") {
    if(!sameOrigin(request)) return json({error:"Invalid request origin."},403,{"Cache-Control":"no-store"});
    const body=await readJson(request,2048);
    if(!(await verifyAuraPopsPassword(body.password))) return json({error:"Incorrect password."},401,{"Cache-Control":"no-store"});
    const raw=token();
    await env.DB.prepare("DELETE FROM aurapops_admin_sessions WHERE expires_at<=datetime('now')").run();
    await env.DB.prepare("INSERT INTO aurapops_admin_sessions (token_hash,expires_at) VALUES (?,datetime('now','+14 days'))").bind(await hash(raw)).run();
    return json({authenticated:true,user:{id:"aurapops-owner",username:"owner",displayName:"AuraPops Owner",role:"owner"}},200,{
      "Cache-Control":"no-store",
      "Set-Cookie":`${AURAPOPS_ADMIN_COOKIE}=${raw}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${AURAPOPS_SESSION_MAX_AGE}`
    });
  }

  if(url.pathname==="/api/aurapops/admin/logout"&&request.method==="POST") {
    if(!sameOrigin(request)) return json({error:"Invalid request origin."},403,{"Cache-Control":"no-store"});
    const raw=parseCookies(request)[AURAPOPS_ADMIN_COOKIE]||"";
    if(/^[a-f0-9]{64}$/i.test(raw)) await env.DB.prepare("DELETE FROM aurapops_admin_sessions WHERE token_hash=?").bind(await hash(raw)).run();
    return json({ok:true},200,{
      "Cache-Control":"no-store",
      "Set-Cookie":`${AURAPOPS_ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    });
  }

  if(url.pathname==="/api/aurapops/admin/session"&&request.method==="GET") {
    const user=await adminSession(request,env.DB);
    return json({authenticated:Boolean(user),user},200,{"Cache-Control":"no-store"});
  }

  if(url.pathname.startsWith("/api/aurapops/admin/")) {
    const admin=await adminSession(request,env.DB);
    if(!admin) return json({error:"Unauthorized."},401,{"Cache-Control":"no-store"});

    if(url.pathname==="/api/aurapops/admin/pops"&&request.method==="GET") {
      const rows=await env.DB.prepare("SELECT * FROM aurapops ORDER BY created_at DESC LIMIT 200").all();
      return json({items:(rows.results||[]).map(r=>mapPop(r,url.origin,true))},200,{"Cache-Control":"no-store"});
    }

    const m=url.pathname.match(/^\/api\/aurapops\/admin\/pops\/([a-f0-9-]+)$/i);
    if(m&&request.method==="PATCH") {
      if(admin.role==="viewer") return json({error:"Read-only account."},403,{"Cache-Control":"no-store"});
      if(!sameOrigin(request)) return json({error:"Invalid request origin."},403);

      const current=await env.DB.prepare("SELECT * FROM aurapops WHERE id=? LIMIT 1").bind(m[1]).first();
      if(!current) return json({error:"AuraPop not found."},404);

      const body=await readJson(request,8192);
      const status=body.status===undefined?current.status:clean(body.status,20);
      const payment=body.paymentStatus===undefined?current.payment_status:clean(body.paymentStatus,20);
      if(!POP_STATUS.has(status)||!PAYMENT_STATUS.has(payment)) throw new AppError(400,"Invalid status.");
      if(status==="approved"&&payment!=="paid") throw new AppError(409,"Confirm payment before activation.");

      const note=body.adminNote===undefined?current.admin_note:clean(body.adminNote,500);
      const approvedAt=status==="approved"?(current.approved_at||new Date().toISOString()):null;

      await env.DB.prepare("UPDATE aurapops SET status=?,payment_status=?,admin_note=?,approved_at=?,updated_at=datetime('now') WHERE id=?")
        .bind(status,payment,note,approvedAt,m[1]).run();

      const updated=await env.DB.prepare("SELECT * FROM aurapops WHERE id=? LIMIT 1").bind(m[1]).first();
      return json({pop:mapPop(updated,url.origin,true)},200,{"Cache-Control":"no-store"});
    }

    return json({error:"Not found."},404);
  }

  const imageMatch=url.pathname.match(/^\/api\/aurapops\/images\/([a-f0-9-]+)$/i);
  if(imageMatch&&["GET","HEAD"].includes(request.method)) {
    const image=await env.DB.prepare("SELECT i.*,p.status,p.payment_status,p.owner_token_hash FROM aurapop_images i JOIN aurapops p ON p.id=i.pop_id WHERE i.id=? LIMIT 1").bind(imageMatch[1]).first();
    if(!image) return new Response("Not found.",{status:404});
    let allowed=image.status==="approved"&&image.payment_status==="paid";
    if(!allowed) {
      allowed=await adminSession(request,env.DB);
      if(!allowed) allowed=await customerOwns(request,env.DB,image.pop_id);
      if(!allowed) {
        const owner=request.headers.get("X-AuraPop-Token")||"";
        const linked=await env.DB.prepare("SELECT pop_id FROM aurapops_ownership WHERE pop_id=?").bind(image.pop_id).first();
        allowed=!linked&&/^[a-f0-9]{64}$/i.test(owner)&&await hash(owner)===image.owner_token_hash;
      }
    }
    if(!allowed) return new Response("Not found.",{status:404});
    return new Response(request.method==="HEAD"?null:image.image_bytes,{status:200,headers:{"Content-Type":image.content_type,"Cache-Control":allowed&&image.status==="approved"?"public, max-age=3600":"no-store"}});
  }

  const publicMatch=url.pathname.match(/^\/api\/aurapops\/public\/([a-z0-9-]+)$/i);
  if(publicMatch&&request.method==="GET") {
    const row=await env.DB.prepare("SELECT * FROM aurapops WHERE slug=? AND status='approved' AND payment_status='paid' LIMIT 1").bind(publicMatch[1]).first();
    return row?json({pop:mapPop(row,url.origin)},200,{"Cache-Control":"public, max-age=60"}):json({error:"This AuraPop is not active yet."},404,{"Cache-Control":"no-store"});
  }

  if(url.pathname==="/api/aurapops/pops"&&request.method==="POST") {
    if(!sameOrigin(request)) return json({error:"Invalid request origin."},403);
    const customer=await customerSession(request,env.DB);
    if(!customer?.emailVerified) return json({error:'Sign in and verify your email before saving a page.'},403);
    const body=await readJson(request);
    const p=normalizePop(body);
    let slug=slugify(body.slug||p.title);
    if(slug.length<3) throw new AppError(400,"Choose an address with at least 3 characters.");
    const existing=await env.DB.prepare("SELECT id FROM aurapops WHERE slug=? LIMIT 1").bind(slug).first();
    if(existing) slug += "-" + crypto.randomUUID().slice(0,4);
    const id=crypto.randomUUID(), raw=token();
    await env.DB.prepare("INSERT INTO aurapops (id,slug,owner_token_hash,title,subtitle,background_mode,background_color,card_color,text_color,accent_color,links_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id,slug,await hash(raw),p.title,p.subtitle,p.backgroundMode,p.backgroundColor,p.cardColor,p.textColor,p.accentColor,JSON.stringify(p.links)).run();
    try {
      const avatar=await replaceImage(env.DB,id,"avatar",p.avatarData,null);
      const background=await replaceImage(env.DB,id,"background",p.backgroundData,null);
      await env.DB.prepare("UPDATE aurapops SET avatar_image_id=?,background_image_id=? WHERE id=?").bind(avatar,background,id).run();
    } catch(error) { await env.DB.prepare("DELETE FROM aurapops WHERE id=?").bind(id).run(); throw error; }
    if(customer) await env.DB.prepare("INSERT INTO aurapops_ownership (pop_id,customer_id) VALUES (?,?)").bind(id,customer.id).run();
    const row=await env.DB.prepare("SELECT * FROM aurapops WHERE id=? LIMIT 1").bind(id).first();
    return json({pop:mapPop(row,url.origin,true),token:customer?null:raw},201,{"Cache-Control":"no-store"});
  }

  const ownerMatch=url.pathname.match(/^\/api\/aurapops\/pops\/([a-f0-9-]+)$/i);
  if(ownerMatch) {
    const row=await ownerRow(request,env.DB,ownerMatch[1]);
    if(!row) return json({error:"AuraPop access denied."},401,{"Cache-Control":"no-store"});
    if(request.method==="GET") return json({pop:mapPop(row,url.origin,true)},200,{"Cache-Control":"no-store"});
    if(request.method==="PATCH") {
      if(!sameOrigin(request)) return json({error:"Invalid request origin."},403);
      const body=await readJson(request), p=normalizePop(body,row);
      const avatar=await replaceImage(env.DB,row.id,"avatar",p.avatarData,row.avatar_image_id);
      const background=await replaceImage(env.DB,row.id,"background",p.backgroundData,row.background_image_id);
      await env.DB.prepare("UPDATE aurapops SET title=?,subtitle=?,background_mode=?,background_color=?,card_color=?,text_color=?,accent_color=?,avatar_image_id=?,background_image_id=?,links_json=?,updated_at=datetime('now') WHERE id=?").bind(p.title,p.subtitle,p.backgroundMode,p.backgroundColor,p.cardColor,p.textColor,p.accentColor,avatar,background,JSON.stringify(p.links),row.id).run();
      const updated=await env.DB.prepare("SELECT * FROM aurapops WHERE id=? LIMIT 1").bind(row.id).first();
      return json({pop:mapPop(updated,url.origin,true)},200,{"Cache-Control":"no-store"});
    }
  }

  return json({error:"Not found."},404);
}
