/* Privacy-conscious public consultation form. It opens a draft; it never sends automatically. */
(function(){
 'use strict';
 const form=document.querySelector('#enquiry');
 if(!form)return;
 const summary=form.querySelector('#summary');
 const counter=document.querySelector('#summaryCount');
 if(summary&&counter){
  const updateCount=()=>{counter.textContent=summary.value.length+' / '+(summary.maxLength||500)+' characters';};
  summary.addEventListener('input',updateCount);
  updateCount();
 }
 form.addEventListener('submit',function(event){
  event.preventDefault();
  if(!form.reportValidity())return;
  const data=new FormData(form);
  const value=key=>String(data.get(key)||'').trim();
  const lines=[
   'Consultation enquiry for Kuria Karatu & Company Advocates',
   'Name: '+value('name'),
   'Phone: '+value('phone'),
   'Email: '+value('email'),
   'Preferred contact: '+value('contact'),
   'Practice area: '+(value('practice')||'Not specified'),
   'Preferred date: '+(value('date')||'Not specified'),
   'Preferred time: '+(value('time')||'Not specified'),
   'Brief non-confidential summary: '+value('summary')
  ];
  const message=encodeURIComponent(lines.join('\n'));
  const status=document.querySelector('#status');
  if(status)status.textContent='Review the prepared WhatsApp message and press Send. Nothing has been sent by this website.';
  window.open('https://wa.me/254725799752?text='+message,'_blank','noopener,noreferrer');
 });
})();
