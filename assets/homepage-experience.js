/* Accessible public-homepage interactions. No case details are collected or transmitted. */
(function(){
 'use strict';
 const input=document.getElementById('practiceSearch');
 const grid=document.getElementById('practiceResults');
 const status=document.getElementById('practiceSearchStatus');
 if(!input||!grid||!status)return;
 const cards=Array.from(grid.querySelectorAll('.practice-card'));
 const empty=document.createElement('div');
 empty.className='practice-empty';
 empty.hidden=true;
 empty.setAttribute('role','status');
 empty.innerHTML='<strong>No matching practice area found</strong><span>Try a broader term or view the complete practice-area directory.</span><p><a href="practices/index.html">Browse all practice areas</a></p>';
 grid.appendChild(empty);
 function normalize(value){return String(value||'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
 function filter(){
  const query=normalize(input.value);
  const terms=query.split(/\s+/).filter(Boolean);
  let visible=0;
  cards.forEach(card=>{
   const haystack=normalize((card.dataset.practiceTitle||'')+' '+card.textContent+' '+(card.dataset.practiceDesc||''));
   const matches=!terms.length||terms.every(term=>haystack.includes(term));
   card.hidden=!matches;
   if(matches)visible++;
  });
  empty.hidden=visible!==0;
  if(!query)status.textContent='Search across our '+cards.length+' practice areas.';
  else status.textContent=visible+' matching practice area'+(visible===1?'':'s')+' found.';
 }
 input.addEventListener('input',filter);
 input.addEventListener('search',filter);
})();
