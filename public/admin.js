(() => {
  const $=id=>document.getElementById(id);
  const API="/api/aurapops/admin";
  const login=$("loginView"),dash=$("dashboardView"),notice=$("loginNotice"),content=$("content"),metrics=$("metrics");
  async function api(path,options={}){
    const r=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(data.error||"Request failed.");e.status=r.status;throw e}
    return data;
  }
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  async function check(){
    try{const d=await api(API+"/session");if(d.authenticated){login.hidden=true;dash.hidden=false;await load();return}}catch{}
    login.hidden=false;dash.hidden=true;
  }
  async function load(){
    content.innerHTML='<div class="empty">Loading…</div>';
    try{
      const d=await api(API+"/pops"),items=d.items||[];
      const pending=items.filter(x=>x.status==="pending").length,unpaid=items.filter(x=>x.paymentStatus!=="paid").length,active=items.filter(x=>x.status==="approved"&&x.paymentStatus==="paid").length;
      metrics.innerHTML=`<div class="metric warn"><span>Pending</span><strong>${pending}</strong></div><div class="metric warn"><span>Waiting payment</span><strong>${unpaid}</strong></div><div class="metric good"><span>Active</span><strong>${active}</strong></div>`;
      if(!items.length){content.innerHTML='<div class="empty">No AuraPops yet.</div>';return;}
      const rows=items.map(item=>{
        const live=item.status==="approved"&&item.paymentStatus==="paid";
        return `<tr>
          <td><span class="pill ${live?"ok":item.status==="rejected"?"bad":""}">${live?"active":esc(item.status)}</span></td>
          <td><strong>${esc(item.title)}</strong><span class="sub">/p/${esc(item.slug)}</span></td>
          <td><span class="pill ${item.paymentStatus==="paid"?"ok":""}">${esc(item.paymentStatus)}</span></td>
          <td>${Array.isArray(item.links)?item.links.length:0}</td>
          <td><span class="sub">${esc(item.updatedAt||"")}</span></td>
          <td><div class="actions">
            <a href="${esc(item.publicUrl)}" target="_blank" rel="noopener">Open ↗</a>
            <button data-pay="${esc(item.id)}">${item.paymentStatus==="paid"?"Mark unpaid":"Payment received"}</button>
            <button class="activate" data-activate="${esc(item.id)}" ${item.paymentStatus!=="paid"||live?"disabled":""}>Activate</button>
            <button class="danger" data-hold="${esc(item.id)}" ${item.status==="pending"?"disabled":""}>Pause</button>
          </div></td>
        </tr>`;
      }).join("");
      content.innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Status</th><th>AuraPop</th><th>Payment</th><th>Items</th><th>Updated</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
      document.querySelectorAll("[data-pay]").forEach(b=>b.addEventListener("click",async()=>{
        const item=items.find(x=>x.id===b.dataset.pay);if(!item)return;b.disabled=true;
        try{const next=item.paymentStatus==="paid"?"unpaid":"paid";await api(API+"/pops/"+encodeURIComponent(item.id),{method:"PATCH",body:JSON.stringify({paymentStatus:next,status:next==="unpaid"&&item.status==="approved"?"pending":item.status})});await load()}catch(e){alert(e.message)}finally{b.disabled=false}
      }));
      document.querySelectorAll("[data-activate]").forEach(b=>b.addEventListener("click",async()=>{
        b.disabled=true;try{await api(API+"/pops/"+encodeURIComponent(b.dataset.activate),{method:"PATCH",body:JSON.stringify({status:"approved",paymentStatus:"paid"})});await load()}catch(e){alert(e.message)}finally{b.disabled=false}
      }));
      document.querySelectorAll("[data-hold]").forEach(b=>b.addEventListener("click",async()=>{
        b.disabled=true;try{await api(API+"/pops/"+encodeURIComponent(b.dataset.hold),{method:"PATCH",body:JSON.stringify({status:"pending"})});await load()}catch(e){alert(e.message)}finally{b.disabled=false}
      }));
    }catch(e){if(e.status===401)return check();content.innerHTML=`<div class="empty">${esc(e.message)}</div>`;}
  }
  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault();notice.textContent="Signing in…";
    try{await api(API+"/login",{method:"POST",body:JSON.stringify({password:$("password").value})});notice.textContent="";await check()}catch(err){notice.textContent=err.message;}
  });
  $("logout").addEventListener("click",async()=>{try{await api(API+"/logout",{method:"POST",body:"{}"})}catch{}location.reload()});
  $("refresh").addEventListener("click",load);
  check();
})();