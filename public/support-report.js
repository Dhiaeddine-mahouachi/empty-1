(() => {
  if (window.auraSupportInstalled) return;
  window.auraSupportInstalled = true;
  function boot() {
    const lang = (document.documentElement.lang || 'en').split('-')[0];
    const translations = {
      en: ['Report a problem','Your email','Describe the problem','Send report','Close','Sending…','Report received. We’re processing it. A confirmation email will follow.','Please try again or email info@auradigitalworks.com.'],
      tr: ['Sorun bildir','E-posta adresiniz','Sorunu açıklayın','Gönder','Kapat','Gönderiliyor…','Bildiriminizi aldık, işleme alıyoruz. Onay e-postası gönderilecek.','Tekrar deneyin veya info@auradigitalworks.com adresine yazın.'],
      ar: ['الإبلاغ عن مشكلة','بريدك الإلكتروني','صف المشكلة','إرسال','إغلاق','جارٍ الإرسال…','تم استلام بلاغك وجارٍ معالجته. ستصلك رسالة تأكيد.','حاول مجدداً أو راسل info@auradigitalworks.com.'],
      fr: ['Signaler un problème','Votre e-mail','Décrivez le problème','Envoyer','Fermer','Envoi…','Votre signalement a été reçu et est en cours de traitement. Un e-mail de confirmation suivra.','Réessayez ou écrivez à info@auradigitalworks.com.']
    };
    const c = translations[lang] || translations.en;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'aura-support-trigger'; button.textContent = c[0];
    button.setAttribute('aria-haspopup','dialog');
    let footer = document.querySelector('footer, [role="contentinfo"], .footer');
    if (!footer) { footer = document.createElement('footer'); footer.className='aura-support-footer'; document.body.append(footer); }
    footer.append(button);
    const dialog = document.createElement('dialog'); dialog.className='aura-support-dialog';
    dialog.setAttribute('aria-labelledby','aura-support-title');
    dialog.innerHTML = `<form class="aura-support-form"><button type="button" class="aura-support-close" aria-label="${c[4]}">×</button><p class="aura-support-brand">AuraDigital support</p><h2 id="aura-support-title">${c[0]}</h2><label for="aura-support-email">${c[1]}</label><input id="aura-support-email" name="email" type="email" autocomplete="email" maxlength="254" required><label for="aura-support-problem">${c[2]}</label><textarea id="aura-support-problem" name="problem" minlength="10" maxlength="4000" rows="5" required></textarea><div class="aura-support-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><p class="aura-support-status" role="status" aria-live="polite"></p><button type="submit" class="aura-support-submit">${c[3]}</button></form>`;
    document.body.append(dialog);
    const form=dialog.querySelector('form'), submit=form.querySelector('[type="submit"]'),status=form.querySelector('[role="status"]');
    button.addEventListener('click',()=>{status.textContent='';dialog.showModal();form.elements.email.focus();});
    dialog.querySelector('.aura-support-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    dialog.addEventListener('close',()=>button.focus());
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(submit.disabled)return;
      submit.disabled=true;submit.textContent=c[5];status.textContent='';
      try {
        const page=new URL(location.href);page.search='';page.hash='';
        const response=await fetch('https://auradigitalworks.com/api/support/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,problem:form.elements.problem.value,website:form.elements.website.value,page:page.href}),signal:AbortSignal.timeout(20000)});
        const data=await response.json();if(!response.ok)throw new Error(data.error||c[7]);
        form.reset();status.textContent=c[6]+' '+data.reference;status.dataset.success='true';
      }catch(error){status.textContent=error.name==='TimeoutError'?c[7]:error.message||c[7];delete status.dataset.success;}
      finally {submit.disabled=false;submit.textContent=c[3];}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
