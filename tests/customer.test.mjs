import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';
const sql=new DatabaseSync(':memory:');
const db={prepare(query){return {args:[],bind(...args){this.args=args.map(x=>x instanceof ArrayBuffer?new Uint8Array(x):x);return this;},async first(){return sql.prepare(query).get(...this.args)||null;},async all(){return {results:sql.prepare(query).all(...this.args)};},async run(){return sql.prepare(query).run(...this.args);}};},async batch(statements){return Promise.all(statements.map(x=>x.run()));}};
const sent=[];globalThis.fetch=async(url,options)=>{if(String(url)==='https://api.resend.com/emails'){const d=JSON.parse(options.body);sent.push(d);return new Response(JSON.stringify({id:'test-mail'}),{status:200});}if(String(url).startsWith('https://auradigitalworks.com/api/auramenu/')){const id=String(url).match(/dashboard\/([a-f0-9-]+)/)?.[1];if(id){const access=sql.prepare('SELECT * FROM auramenu_edit_access WHERE menu_id=?').get(id);const isActive=access.access_until&&Date.parse(access.access_until)>Date.now();if(options.method==='PATCH'&&!isActive)return new Response(JSON.stringify({error:'Editing locked.'}),{status:403});return new Response(JSON.stringify({menu:{id,editAccess:{active:!!isActive}}}),{status:200});}return new Response(JSON.stringify({request:{id:'test-menu',email:JSON.parse(options.body).email}}),{status:201});}throw new Error('Unexpected test fetch '+url);};
const env={DB:db,RESEND_API_KEY:'test-only-key',ASSETS:{fetch:async()=>new Response('asset')}};
async function call(path,method='GET',data=null,cookie='',headers={}){return worker.fetch(new Request('https://aurapops.online'+path,{method,headers:{Origin:'https://aurapops.online',Cookie:cookie,'Content-Type':'application/json',...headers},body:data?JSON.stringify(data):undefined}),env);}
const register=async(name,email)=>{const r=await call('/api/aurapops/account/register','POST',{name,email,password:'a-strong-password-123',confirmPassword:'a-strong-password-123'});assert.equal(r.status,202);const pending=r.headers.get('set-cookie').split(';')[0];const code=sent.at(-1).text.match(/code is (\d{6})/)[1];const verified=await call('/api/aurapops/account/verification/confirm','POST',{code},pending);assert.equal(verified.status,200);return verified.headers.get('set-cookie').split(';')[0];};
test('customer registration, ownership, legacy claim and payment activation remain isolated',async()=>{
 const a=await register('Alice','alice@example.com'),b=await register('Bob','bob@example.com');
 const anon=await call('/api/aurapops/account/pops');assert.equal(anon.status,401);
 const popBody={title:'Alice café',slug:'alice-cafe',links:[{type:'website',label:'Visit',url:'https://example.com'}]};
 const create=await call('/api/aurapops/pops','POST',popBody,a);assert.equal(create.status,201);const {pop,token}=await create.json();
 assert.equal((await (await call('/api/aurapops/account/pops','GET',null,a)).json()).items.length,1);
 assert.equal((await (await call('/api/aurapops/account/pops','GET',null,b)).json()).items.length,0);
 assert.equal((await call('/api/aurapops/pops/'+pop.id,'GET',null,b)).status,401);
 assert.equal((await call('/api/aurapops/pops/'+pop.id,'PATCH',{title:'Stolen'},b)).status,401);
 assert.equal(token,null);
 assert.equal((await call('/api/aurapops/account/claim','POST',{id:pop.id,token:'b'.repeat(64)},b)).status,403);
 assert.equal((await call('/api/aurapops/pops/'+pop.id,'PATCH',{title:'Updated',paymentStatus:'paid',status:'approved'},a)).status,200);
 assert.equal((await call('/api/aurapops/public/'+pop.slug)).status,404);
 const adminRaw='a'.repeat(64);const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(adminRaw))).toString('hex');sql.prepare("INSERT INTO aurapops_admin_sessions VALUES (?,datetime('now','+1 day'),datetime('now'))").run(digest);const admin='__Host-aurapops_admin='+adminRaw;
 assert.equal((await call('/api/aurapops/admin/pops/'+pop.id,'PATCH',{status:'approved'},admin)).status,409);
 assert.equal((await call('/api/aurapops/admin/pops/'+pop.id,'PATCH',{status:'approved',paymentStatus:'paid'},admin)).status,200);
 assert.equal((await call('/api/aurapops/public/'+pop.slug)).status,200);
 const oldRaw='e'.repeat(64),oldHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(oldRaw))).toString('hex'),oldId=crypto.randomUUID();sql.prepare("INSERT INTO aurapops (id,slug,owner_token_hash,title) VALUES (?,?,?,?)").run(oldId,'old-draft',oldHash,'Old draft');const legacy={pop:{id:oldId},token:oldRaw};
 assert.equal((await call('/api/aurapops/account/claim','POST',{id:legacy.pop.id,token:'f'.repeat(64)},a)).status,403);
 assert.equal((await call('/api/aurapops/account/claim','POST',{id:legacy.pop.id,token:legacy.token},a)).status,200);
 assert.equal((await call('/api/aurapops/pops/'+legacy.pop.id,'GET',null,'',{'X-AuraPop-Token':legacy.token})).status,401);
 assert.equal((await call('/api/aurapops/account/claim','POST',{id:legacy.pop.id,token:legacy.token},b)).status,409);
 assert.equal((await (await call('/api/aurapops/account/pops','GET',null,a)).json()).items.length,2);
 const login=await call('/api/aurapops/account/login','POST',{email:'alice@example.com',password:'wrong'});assert.equal(login.status,401);
 const correct=await call('/api/aurapops/account/login','POST',{email:'alice@example.com',password:'a-strong-password-123'});assert.equal(correct.status,200);assert.match(correct.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await call('/api/aurapops/account/password','POST',{currentPassword:'wrong',password:'new-password-123',confirmPassword:'new-password-123'},a)).status,401);
 assert.equal((await call('/api/aurapops/account/password','POST',{currentPassword:'a-strong-password-123',password:'new-password-123',confirmPassword:'new-password-123'},a)).status,200);
 assert.equal((await (await call('/api/aurapops/account/session','GET',null,a)).json()).user,null);
 const cross=await worker.fetch(new Request('https://aurapops.online/api/aurapops/account/login',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),env);assert.equal(cross.status,403);
 assert.equal((await call('/api/aurapops/account/google')).status,503);
 assert.equal((await call('/api/aurapops/account/google/callback?state=forged&code=fake')).status,302);
 const fresh=await call('/api/aurapops/account/login','POST',{email:'alice@example.com',password:'new-password-123',confirmPassword:'new-password-123'});assert.equal(fresh.status,200);const freshCookie=fresh.headers.get('set-cookie').split(';')[0];assert.equal((await call('/api/aurapops/account/logout','POST',{},freshCookie)).status,200);assert.equal((await (await call('/api/aurapops/account/session','GET',null,freshCookie)).json()).user,null);
});

test('email codes expire, cannot be reused, have attempt limits, and password confirmation is enforced',async()=>{
 const password='secure-password-123',email='verification@example.com';
 const mismatch=await call('/api/aurapops/account/register','POST',{name:'Test',email,password,confirmPassword:'different'});assert.equal(mismatch.status,400);
 const noEmail=await worker.fetch(new Request('https://aurapops.online/api/aurapops/account/register',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'no-email'},body:JSON.stringify({name:'Test',email:'not-configured@example.com',password,confirmPassword:password})}),{...env,RESEND_API_KEY:undefined});assert.equal(noEmail.status,503);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM aurapops_customers WHERE email=?').get('not-configured@example.com').n,0);
 const registration=await call('/api/aurapops/account/register','POST',{name:'Test',email,password,confirmPassword:password});assert.equal(registration.status,202);const pending=registration.headers.get('set-cookie').split(';')[0],code=sent.at(-1).text.match(/code is (\d{6})/)[1];
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM aurapops_customers WHERE email=?').get(email).n,0);
 assert.equal((await call('/api/aurapops/pops','POST',{title:'Unverified',slug:'unverified',links:[]},pending)).status,403);
 assert.equal((await call('/api/aurapops/account/verification/send','POST',{},pending)).status,429);
 const wrong=String((Number(code)+1)%1000000).padStart(6,'0');for(let i=0;i<5;i++)assert.equal((await call('/api/aurapops/account/verification/confirm','POST',{code:wrong},pending)).status,400);
 assert.equal((await call('/api/aurapops/account/verification/confirm','POST',{code},pending)).status,410);
 sql.prepare("UPDATE aurapops_email_challenges SET sent_at=datetime('now','-61 seconds') WHERE email=?").run(email);assert.equal((await call('/api/aurapops/account/verification/send','POST',{},pending)).status,200);
 const latest=sent.at(-1).text.match(/code is (\d{6})/)[1];sql.prepare("UPDATE aurapops_email_challenges SET code_expires_at=datetime('now','-1 second') WHERE email=?").run(email);assert.equal((await call('/api/aurapops/account/verification/confirm','POST',{code:latest},pending)).status,410);
 sql.prepare("UPDATE aurapops_email_challenges SET sent_at=datetime('now','-61 seconds') WHERE email=?").run(email);assert.equal((await call('/api/aurapops/account/verification/send','POST',{},pending)).status,200);const final=sent.at(-1).text.match(/code is (\d{6})/)[1];assert.equal((await call('/api/aurapops/account/verification/confirm','POST',{code:final},pending)).status,200);assert.equal((await call('/api/aurapops/account/verification/confirm','POST',{code:final},pending)).status,410);
 const login=await call('/api/aurapops/account/login','POST',{email,password});assert.equal(login.status,200);const signed=login.headers.get('set-cookie').split(';')[0];assert.equal((await call('/api/aurapops/account/password','POST',{currentPassword:password,password:'different-new-password',confirmPassword:'mismatch'},signed)).status,400);
});

test('AuraMenu verified ownership and paid editing rules stay intact',async()=>{
 sql.exec("CREATE TABLE auramenu_requests (id TEXT PRIMARY KEY,email TEXT,slug TEXT,business_name TEXT,status TEXT,payment_status TEXT,updated_at TEXT,created_at TEXT)");
 const owner=await register('Menu owner','menu-owner@example.com');const other=await register('Other owner','other-owner@example.com');const id=crypto.randomUUID();
 sql.prepare("INSERT INTO auramenu_requests VALUES (?,?,?,'My café','approved','paid',datetime('now'),datetime('now'))").run(id,'menu-owner@example.com','my-cafe');
 async function menuCall(path,method='GET',data=null,cookie=''){return worker.fetch(new Request('https://auramenu.space'+path,{method,headers:{Cookie:cookie,Origin:'https://auramenu.space','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),env);}
 const list=await menuCall('/api/aurapops/account/menus','GET',null,owner);assert.equal(list.status,200);assert.equal((await list.json()).items.length,1);
 assert.equal((await (await menuCall('/api/aurapops/account/menus','GET',null,other)).json()).items.length,0);
 assert.equal((await menuCall('/api/auramenu/dashboard/'+id,'GET',null,other)).status,403);
 assert.equal((await menuCall('/api/auramenu/dashboard/'+id,'GET',null,owner)).status,200);
 assert.equal((await menuCall('/api/auramenu/dashboard/'+id,'PATCH',{businessName:'New'},owner)).status,403);
 sql.prepare("UPDATE auramenu_edit_access SET access_until=datetime('now','+1 day'),paid_amount=100 WHERE menu_id=?").run(id);
 assert.equal((await menuCall('/api/auramenu/dashboard/'+id,'PATCH',{businessName:'New'},owner)).status,200);
 const create=await menuCall('/api/auramenu/requests','POST',{email:'forged@example.com'},owner);assert.equal(create.status,201);assert.equal((await create.json()).request.email,'menu-owner@example.com');
 assert.equal((await menuCall('/api/auramenu/requests','POST',{email:'anonymous@example.com'})).status,403);
});
