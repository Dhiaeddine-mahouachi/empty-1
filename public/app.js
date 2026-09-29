(() => {
  const form=document.getElementById("popBuilder");
  if(!form)return;
  const $=id=>document.getElementById(id);
  const linkList=$("linkList"), previewLinks=$("previewLinks"), preview=$("previewCard"), avatar=$("previewAvatar"), status=$("builderStatus"), activation=$("activationPanel");
  const STORE="aurapops:standalone:v1";
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
  async function fileData(file){
    if(!file)return "";
    if(file.size>420*1024)throw new Error("Image must be smaller than 420 KB.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use JPG, PNG or WebP.");
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(new Error("Could not read image."));r.readAsDataURL(file);});
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
    previewLinks.innerHTML=state.links.length?state.links.map(item=>`<div class="preview-link"><i>${esc(presets[item.type]?.[1]||"↗")}</i><span>${esc(item.label||"Open")}</span></div>`).join(""):'<div class="empty">Add your first item.</div>';
  }
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
    if(!url||!state.token)return "";
    const r=await fetch(url,{headers:{"X-AuraPop-Token":state.token}});if(!r.ok)return "";
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
    if(!saved?.id||!saved?.token)return;
    state.id=saved.id;state.token=saved.token;
    try{
      const r=await fetch("/api/pops/"+encodeURIComponent(state.id),{headers:{"X-AuraPop-Token":state.token}});
      if(!r.ok)throw new Error();
      const {pop}=await r.json();state.links=Array.isArray(pop.links)?pop.links:[];
      form.elements.title.value=pop.title||"";form.elements.slug.value=pop.slug||"";form.elements.slug.readOnly=true;form.elements.subtitle.value=pop.subtitle||"";
      form.elements.backgroundColor.value=pop.backgroundColor||"#0b1610";form.elements.cardColor.value=pop.cardColor||"#111a16";form.elements.textColor.value=pop.textColor||"#ffffff";form.elements.accentColor.value=pop.accentColor||"#e1e100";
      [...form.elements.backgroundMode].forEach(x=>x.checked=x.value===pop.backgroundMode);$("backgroundUploadWrap").hidden=pop.backgroundMode!=="image";
      revoke("avatarUrl");revoke("backgroundUrl");state.avatarUrl=await privateImage(pop.avatarUrl);state.backgroundUrl=await privateImage(pop.backgroundImageUrl);
      $("savePop").textContent="Save AuraPop changes";$("newPop").hidden=false;renderRows();renderPreview();showActivation(pop);notice("Draft restored.","success");
    }catch{localStorage.removeItem(STORE);state.id="";state.token="";}
  }

  $("addLink").addEventListener("click",()=>add($("linkPreset").value));
  form.addEventListener("input",e=>{if(e.target.name==="title"&&!state.id&&!form.elements.slug.dataset.touched)form.elements.slug.value=slug(e.target.value);renderPreview();});
  form.elements.slug.addEventListener("input",e=>{e.target.dataset.touched="1";e.target.value=slug(e.target.value);});
  form.querySelectorAll('input[name="backgroundMode"]').forEach(x=>x.addEventListener("change",()=>{$("backgroundUploadWrap").hidden=form.elements.backgroundMode.value!=="image";renderPreview();}));
  $("avatarInput").addEventListener("change",async e=>{try{state.avatarData=await fileData(e.target.files?.[0]);revoke("avatarUrl");if(e.target.files?.[0])state.avatarUrl=URL.createObjectURL(e.target.files[0]);renderPreview();}catch(err){e.target.value="";notice(err.message,"error");}});
  $("backgroundInput").addEventListener("change",async e=>{try{state.backgroundData=await fileData(e.target.files?.[0]);revoke("backgroundUrl");if(e.target.files?.[0])state.backgroundUrl=URL.createObjectURL(e.target.files[0]);renderPreview();}catch(err){e.target.value="";notice(err.message,"error");}});
  $("newPop").addEventListener("click",()=>{if(confirm("Start a new AuraPop? Your current AuraPop remains saved.")){localStorage.removeItem(STORE);location.reload();}});
  form.addEventListener("submit",async e=>{
    e.preventDefault();const btn=$("savePop");btn.disabled=true;notice(state.id?"Saving…":"Preparing…");
    try{
      validate();const headers={"Content-Type":"application/json"};if(state.id)headers["X-AuraPop-Token"]=state.token;
      const r=await fetch(state.id?"/api/pops/"+encodeURIComponent(state.id):"/api/pops",{method:state.id?"PATCH":"POST",headers,body:JSON.stringify(payload())});
      const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Could not save AuraPop.");
      if(!state.id){state.id=data.pop.id;state.token=data.token;localStorage.setItem(STORE,JSON.stringify({id:state.id,token:state.token}));form.elements.slug.value=data.pop.slug;form.elements.slug.readOnly=true;$("newPop").hidden=false;$("savePop").textContent="Save AuraPop changes";}
      state.avatarData=undefined;state.backgroundData=undefined;showActivation(data.pop);notice("Saved. Your QR is ready.","success");activation.scrollIntoView({behavior:"smooth",block:"nearest"});
    }catch(err){notice(err.message,"error");}finally{btn.disabled=false;}
  });

  renderRows();renderPreview();restore();
})();