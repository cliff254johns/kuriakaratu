/* Homepage-matched shared navigation for every practice-area page. */
(function(){
 const current=location.pathname;
 const inPractice=/\/practices\//.test(current);
 const root=inPractice?'../':'';
 const home=root+'index.html';
 const links=[
  ['About',home+'#about','about'],
  ['Values',home+'#values','values'],
  ['Practices',root+'practices/index.html','practices'],
  ['All Services',root+'practices/index.html','all-services'],
  ['Legal Knowledge',root+'insights/index.html','knowledge'],
  ['Team',home+'#team','team'],
  ['Videos',home+'#videos','videos'],
  ['Insights',home+'#insights','insights'],
  ['Request Consultation',root+'consultation.html','consultation']
 ];
 const header=document.createElement('header');
 header.id='mainHeader';header.className='kk-practice-header';
 header.innerHTML='<div class="nav-container"><a class="logo" href="'+home+'" aria-label="Kuria Karatu and Company Advocates homepage"><img src="'+root+'logo%20(1).jpg" alt="" width="64" height="48"><span class="text-group"><span class="brand-name">Kuria Karatu &amp; Company</span><span class="brand-sub">ADVOCATES</span></span></a><button class="hamburger" type="button" aria-label="Toggle navigation" aria-controls="kkNavLinks" aria-expanded="false"><span></span><span></span><span></span></button><ul class="nav-links" id="kkNavLinks">'+links.map(([label,href,key])=>'<li><a href="'+href+'" class="'+(key==='consultation'?'btn-nav':'')+'" data-nav="'+key+'">'+label+'</a></li>').join('')+'</ul></div>';
 const target=document.querySelector('main')||document.querySelector('h1');
 if(target&&!target.id)target.id='main-content';
 const skip=document.createElement('a');skip.className='kk-skip-link';skip.href='#main-content';skip.textContent='Skip to main content';
 document.body.prepend(skip);
 const old=document.querySelector('header.head,header');
 if(old)old.replaceWith(header);else document.body.prepend(header);
 const active=inPractice?'practices':(current.endsWith('/index.html')||current.endsWith('/')?'about':'');
 const activeLink=header.querySelector('[data-nav="'+(current.includes('/practices/')?'all-services':active)+'"]');
 if(activeLink)activeLink.setAttribute('aria-current','page');
 const button=header.querySelector('.hamburger'),nav=header.querySelector('.nav-links');
 button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open)});
 nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('is-open');button.setAttribute('aria-expanded','false')}});
})();
