import {openGame} from './games.js?v=20261003';
(() => {
  const form=document.getElementById("popBuilder");
  if(!form)return;
  const $=id=>document.getElementById(id);
  const linkList=$("linkList"), previewLinks=$("previewLinks"), preview=$("previewCard"), avatar=$("previewAvatar"), status=$("builderStatus"), activation=$("activationPanel");
  const STORE="aurapops:path-app:v2";
  const API="/api/aurapops";
  const presets={
    website:["Website","↗"],menu:["Menu","☰"],instagram:["Instagram","IG"],facebook:["Facebook","f"],
    tiktok:["TikTok","♪"],whatsapp:["WhatsApp","WA"],maps:["Google Maps","⌖"],custom:["Link","↗"],
    snake:["Play Snake","S"],tetris:["Play Tetris","T"]
  };
  const state={id:"",token:"",links:[],avatarData:undefined,backgroundData:undefined,avatarUrl:"",backgroundUrl:""};

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const isGame=t=>t==="snake"||t==="tetris";
  const slug=v=>String(v||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,54);
  function notice(text,kind=""){status.textContent=text;status.className=kind;}
  function revoke(key){if(state[key])URL.revokeObjectURL(state[key]);state[key]="";}
  let pendingImages=0;
  async function fileData(file,maxDimension=1920){
    if(!file)return "";
    if(file.size>20*1024*1024)throw new Error("Choose an image smaller than 20 MB.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use JPG, PNG or WebP.");
    const read=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(new Error("Could not read image."));r.readAsDataURL(blob);});
    if(file.size<=420*1024)return read(file);
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("Could not open this image. Try another JPG, PNG or WebP."));i.src=url;});
      const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
      if(!ctx)throw new Error("Image processing is unavailable in this browser.");
      let edge=maxDimension;
      for(let attempt=0;attempt<10;attempt++){
        const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",Math.max(.55,.9-attempt*.05)));
        if(!blob)throw new Error("Could not optimize this image.");
        if(blob.size<=420*1024)return read(blob);
        edge=Math.round(edge*.8);
      }
      throw new Error("Could not optimize this image. Try a smaller picture.");
    }finally{URL.revokeObjectURL(url);}
  }
  function imageUpload(input,dataKey,urlKey,maxDimension){
    input.addEventListener("change",async e=>{
      const file=e.target.files?.[0];if(!file)return;
      pendingImages++;input.disabled=true;
      const help=input.parentElement.querySelector("small");if(help)help.textContent="Optimizing image…";
      try{
        const data=await fileData(file,maxDimension);
        state[dataKey]=data;revoke(urlKey);state[urlKey]=data;renderPreview();
        if(help)help.textContent="Image ready · JPG, PNG or WebP · max 20 MB";
      }catch(err){input.value="";if(help)help.textContent=err.message;notice(err.message,"error");}
      finally{pendingImages--;input.disabled=false;}
    });
  }
  function add(type,label="",url=""){
    if(state.links.length>=12)return notice("Maximum 12 items.","error");
    state.links.push({type,label:label||presets[type]?.[0]||"Link",url:isGame(type)?"":url});
    renderRows();renderPreview();
  }
  function renderRows(){
    if(!state.links.length){linkList.innerHTML='<div class="empty">No items yet. Add a link or a game above.</div>';return;}
    linkList.innerHTML=state.links.map((item,i)=>`<div class="link-row" data-i="${i}">
      <select class="link-type">${Object.keys(presets).map(t=>`<option value="${t}" ${t===item.type?"selected":""}>${esc(presets[t][0])}</option>`).join("")}</select>
      <input class="link-label" maxlength="60" value="${esc(item.label)}" aria-label="Label">
      ${isGame(item.type)?'<input class="link-url" value="Runs inside AuraPop" disabled>':`<input class="link-url" maxlength="1000" value="${esc(item.url)}" placeholder="https://...">`}
      <button class="remove" type="button" aria-label="Remove">×</button>
    </div>`).join("");
    linkList.querySelectorAll(".link-row").forEach(row=>{
      const i=Number(row.dataset.i);
      row.querySelector(".link-type").addEventListener("change",e=>{const t=e.target.value;state.links[i]={type:t,label:presets[t][0],url:""};renderRows();renderPreview();});
      row.querySelector(".link-label").addEventListener("input",e=>{state.links[i].label=e.target.value;renderPreview();});
      row.querySelector(".link-url")?.addEventListener("input",e=>{if(!isGame(state.links[i].type))state.links[i].url=e.target.value;});
      row.querySelector(".remove").addEventListener("click",()=>{state.links.splice(i,1);renderRows();renderPreview();});
    });
  }
  function renderPreview(){
    const d=new FormData(form), title=String(d.get("title")||"Your Business"), subtitle=String(d.get("subtitle")||"");
    const mode=String(d.get("backgroundMode")||"color"), bg=String(d.get("backgroundColor")||"#0b1610"), card=String(d.get("cardColor")||"#111a16"), text=String(d.get("textColor")||"#fff"), accent=String(d.get("accentColor")||"#e1e100");
    $("previewTitle").textContent=title;$("previewSubtitle").textContent=subtitle;
    preview.style.setProperty("--pbg",bg);preview.style.setProperty("--pcard",card);preview.style.setProperty("--ptext",text);preview.style.setProperty("--paccent",accent);
    preview.style.backgroundColor=bg;preview.style.backgroundImage=mode==="image"&&state.backgroundUrl?`linear-gradient(rgba(2,8,4,.14),rgba(2,8,4,.46)),url("${state.backgroundUrl}")`:"none";
    if(state.avatarUrl)avatar.innerHTML=`<img src="${state.avatarUrl}" alt="">`;
    else {const ini=title.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"AP";avatar.innerHTML=`<span>${esc(ini)}</span>`;}
    previewLinks.innerHTML=state.links.length?state.links.map(item=>`<button type="button" class="preview-link" data-preview-type="${esc(item.type)}"><i>${esc(presets[item.type]?.[1]||"↗")}</i><span>${esc(item.label||"Open")}</span></button>`).join(""):'<div class="empty">Add your first item.</div>';
  }
  previewLinks.addEventListener("click",e=>{const type=e.target.closest("[data-preview-type]")?.dataset.previewType;if(isGame(type))openGame(type);});
  function validate(){
    if(!String(form.elements.title.value||"").trim())throw new Error("Add a name.");
    if(!state.id&&slug(form.elements.slug.value).length<3)throw new Error("Choose a longer AuraPop address.");
    for(let i=0;i<state.links.length;i++){
      const item=state.links[i];if(isGame(item.type))continue;
      let u;try{u=new URL(String(item.url||"").trim());}catch{u=null;}
      if(!u||!["http:","https:","mailto:","tel:"].includes(u.protocol)){linkList.querySelector(`[data-i="${i}"] .link-url`)?.focus();throw new Error(`Add a valid link for "${item.label}".`);}
    }
  }
  function payload(){
    const d=new FormData(form), body={
      title:String(d.get("title")||"").trim(),subtitle:String(d.get("subtitle")||"").trim(),
      backgroundMode:String(d.get("backgroundMode")||"color"),backgroundColor:String(d.get("backgroundColor")||"#0b1610"),
      cardColor:String(d.get("cardColor")||"#111a16"),textColor:String(d.get("textColor")||"#ffffff"),accentColor:String(d.get("accentColor")||"#e1e100"),
      links:state.links.map(x=>({type:x.type,label:String(x.label||"").trim(),url:String(x.url||"").trim()}))
    };
    if(!state.id)body.slug=slug(d.get("slug")||d.get("title"));
    if(state.avatarData!==undefined)body.avatarData=state.avatarData;
    if(state.backgroundData!==undefined)body.backgroundData=state.backgroundData;
    return body;
  }
  async function privateImage(url){
    if(!url)return "";
    const resolved=new URL(url,location.origin);
    if(!/^\/api\/aurapops\/images\/[a-f0-9-]+$/i.test(resolved.pathname))throw new Error("Invalid saved image address.");
    const headers={};if(state.token)headers["X-AuraPop-Token"]=state.token;
    const r=await fetch(resolved.pathname,{headers,credentials:"same-origin",cache:"no-store"});if(!r.ok)throw new Error("Your saved picture could not load. Refresh to try again.");
    return URL.createObjectURL(await r.blob());
  }
  function showActivation(pop){
    activation.classList.add("show");$("publicLink").textContent=pop.publicUrl;$("publicLink").href=pop.publicUrl;
    $("popQr").src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data="+encodeURIComponent(pop.publicUrl);
    const active=pop.status==="approved"&&pop.paymentStatus==="paid";
    $("activationStatus").textContent=active?"Active":pop.paymentStatus==="paid"?"Payment confirmed":"Pending";
    $("activationStatus").classList.toggle("active",active);
    $("activationText").textContent=active?"AuraPop is live.":pop.paymentStatus==="paid"?"Waiting for final activation.":"Complete payment to activate it.";
  }
  async function restore(){
    let saved;try{saved=JSON.parse(localStorage.getItem(STORE)||"null");}catch{}
    const requested=new URLSearchParams(location.search).get("id");
    if(requested) saved={id:requested,token:""};
    if(!saved?.id)return;
    state.id=saved.id;state.token=saved.token;
    try{
      const r=await fetch(API+"/pops/"+encodeURIComponent(state.id),{headers:{"X-AuraPop-Token":state.token}});
      if(!r.ok)throw new Error();
      const {pop}=await r.json();state.links=Array.isArray(pop.links)?pop.links:[];
      form.elements.title.value=pop.title||"";form.elements.slug.value=pop.slug||"";form.elements.slug.readOnly=true;form.elements.subtitle.value=pop.subtitle||"";
      form.elements.backgroundColor.value=pop.backgroundColor||"#0b1610";form.elements.cardColor.value=pop.cardColor||"#111a16";form.elements.textColor.value=pop.textColor||"#ffffff";form.elements.accentColor.value=pop.accentColor||"#e1e100";
      [...form.elements.backgroundMode].forEach(x=>x.checked=x.value===pop.backgroundMode);$("backgroundUploadWrap").hidden=pop.backgroundMode!=="image";
      revoke("avatarUrl");revoke("backgroundUrl");const images=await Promise.allSettled([privateImage(pop.avatarUrl),privateImage(pop.backgroundImageUrl)]);
      state.avatarUrl=images[0].status==='fulfilled'?images[0].value:'';state.backgroundUrl=images[1].status==='fulfilled'?images[1].value:'';
      const imageError=images.some(result=>result.status==='rejected');
      $("savePop").textContent="Save AuraPop changes";$("savePop").disabled=false;$("newPop").hidden=false;renderRows();renderPreview();showActivation(pop);notice(imageError?"Draft restored, but a saved picture could not load. Refresh to retry.":"Draft restored.",imageError?"error":"success");
    }catch{localStorage.removeItem(STORE);state.id="";state.token="";if(requested){notice("Sign in to edit this page.","error");$("savePop").disabled=true;}}
  }

  $("addLink").addEventListener("click",()=>add($("linkPreset").value));
  form.addEventListener("input",e=>{if(e.target.name==="title"&&!state.id&&!form.elements.slug.dataset.touched)form.elements.slug.value=slug(e.target.value);renderPreview();});
  form.elements.slug.addEventListener("input",e=>{e.target.dataset.touched="1";e.target.value=slug(e.target.value);});
  form.querySelectorAll('input[name="backgroundMode"]').forEach(x=>x.addEventListener("change",()=>{$("backgroundUploadWrap").hidden=form.elements.backgroundMode.value!=="image";renderPreview();}));
  imageUpload($("avatarInput"),"avatarData","avatarUrl",1024);
  imageUpload($("backgroundInput"),"backgroundData","backgroundUrl",1920);
  $("newPop").addEventListener("click",()=>{if(confirm("Start a new AuraPop? Your current AuraPop remains saved.")){localStorage.removeItem(STORE);location.href="/builder.html";}});
  form.addEventListener("submit",async e=>{
    e.preventDefault();const btn=$("savePop");btn.disabled=true;notice(state.id?"Saving…":"Preparing…");
    try{
      if(pendingImages)throw new Error("Wait for your images to finish optimizing, then save.");
      validate();
      let account=await (await fetch(API+"/account/session")).json();
      if(account.verificationRequired){$("builderVerification").hidden=false;throw new Error("Enter the email verification code before saving your page.");}
      if(!account.user){
        if($("customerPassword").value!==$("customerConfirmPassword").value)throw new Error("Passwords do not match.");
        const r=await fetch(API+"/account/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmPassword:$("customerConfirmPassword").value,name:$("customerName").value,email:$("customerEmail").value,password:$("customerPassword").value})});
        const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not create your account.");account=d;$("customerPassword").value="";$("customerConfirmPassword").value="";
        if(d.verificationRequired){$("builderVerification").hidden=false;$("customerAccountFields").hidden=true;$("builderVerificationEmail").textContent="Enter the code sent to "+d.email+". Your design stays here.";throw new Error("Code sent. Verify your email below, then prepare your QR.");}
      }
      if(!account.user?.emailVerified){$("builderVerification").hidden=false;const r=await fetch(API+"/account/verification/send",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});const d=await r.json();throw new Error(r.ok?"Code sent. Verify your email below, then save your page.":d.error);}
      $("customerAccountFields").hidden=true;$("signedInCustomer").hidden=false;$("signedInCustomer").textContent="Saving to "+account.user.name+"’s account.";
      if(state.id&&state.token){const claim=await fetch(API+"/account/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:state.id,token:state.token})});if(!claim.ok)throw new Error("This page could not be linked to your account.");state.token="";localStorage.removeItem(STORE);}
      const headers={"Content-Type":"application/json"};if(state.id)headers["X-AuraPop-Token"]=state.token;
      const r=await fetch(state.id?API+"/pops/"+encodeURIComponent(state.id):API+"/pops",{method:state.id?"PATCH":"POST",headers,body:JSON.stringify(payload())});
      const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Could not save AuraPop.");
      if(!state.id){state.id=data.pop.id;state.token=data.token||"";localStorage.removeItem(STORE);history.replaceState(null,"","/builder.html?id="+encodeURIComponent(state.id));form.elements.slug.value=data.pop.slug;form.elements.slug.readOnly=true;$("newPop").hidden=false;$("savePop").textContent="Save AuraPop changes";}
      state.avatarData=undefined;state.backgroundData=undefined;showActivation(data.pop);notice("Saved. Your QR is ready.","success");activation.scrollIntoView({behavior:"smooth",block:"nearest"});
    }catch(err){notice(err.message,"error");}finally{btn.disabled=false;}
  });

  $("verifyBuilderEmail").onclick=async()=>{const b=$("verifyBuilderEmail");b.disabled=true;try{const r=await fetch(API+"/account/verification/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:$("builderVerificationCode").value})});const d=await r.json();if(!r.ok)throw new Error(d.error);$("builderVerification").hidden=true;$("signedInCustomer").hidden=false;$("signedInCustomer").textContent="Email verified · "+d.user.email;await restore();notice("Email verified. Now save your page to prepare the QR.","success");}catch(e){notice(e.message,"error");}finally{b.disabled=false;}};
  $("resendBuilderCode").onclick=async()=>{const b=$("resendBuilderCode");b.disabled=true;try{const r=await fetch(API+"/account/verification/send",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});const d=await r.json();if(!r.ok)throw new Error(d.error);notice("New code sent. Use the latest email.","success");}catch(e){notice(e.message,"error");}finally{b.disabled=false;}};
  renderRows();renderPreview();restore();
  let sessionCheck;
  function refreshAccount(){
    if(sessionCheck)return sessionCheck;
    sessionCheck=(async()=>{
      try{
        const r=await fetch(API+"/account/session",{cache:"no-store",credentials:"same-origin"});
        if(!r.ok)throw new Error("Could not check your account.");
        const d=await r.json(), signedIn=!!d.user, verifying=!!d.verificationRequired;
        $("customerAccountFields").hidden=signedIn||verifying;
        $("signedInCustomer").hidden=!signedIn;
        $("builderVerification").hidden=!verifying;
        if(signedIn){
          $("signedInCustomer").textContent="Signed in as "+d.user.name+" · Your AuraPop will be saved to your account.";
          $("customerPassword").value="";$("customerConfirmPassword").value="";
        }
        if(verifying)$("builderVerificationEmail").textContent="Enter the code sent to "+(d.email||"your email")+" before saving your page.";
        $("accountCheckStatus").hidden=true;
      }catch{
        $("customerAccountFields").hidden=true;
        $("accountCheckStatus").hidden=false;
        $("accountCheckStatus").textContent="Could not check your sign-in. Return to this tab or refresh to try again.";
      }finally{sessionCheck=null;}
    })();
    return sessionCheck;
  }
  refreshAccount();
  window.addEventListener("focus",refreshAccount);
  window.addEventListener("pageshow",refreshAccount);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshAccount();});
})();