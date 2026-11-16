/* Shared responsive navigation for public content pages outside the homepage. */
(function(){
 const nested=/\/(practices|insights|locations)\//.test(location.pathname);
 const root=nested?'../':'';
 const home=root+'index.html';
 const path=location.pathname;
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
 header.innerHTML='<div class="nav-container"><a class="logo" href="'+home+'" aria-label="Kuria Karatu and Company Advocates homepage"><img src="'+root+'logo%20(1).jpg" alt="" width="64" height="48"><span class="text-group"><span class="brand-name">Kuria Karatu &amp; Company</span><span class="brand-sub">ADVOCATES</span></span></a><button class="hamburger" type="button" aria-label="Toggle navigation" aria-controls="kkNavLinks" aria-expanded="false"><span></span><span></span><span></span></button><ul class="nav-links" id="kkNavLinks">'+links.map(([label,href,key])=>'<li><a href="'+href+'" data-nav="'+key+'">'+label+'</a></li>').join('')+'</ul></div>';
 const old=document.querySelector('header.head,header');
 if(old)old.replaceWith(header);else document.body.prepend(header);
 let active='';
 if(path.includes('/insights/')) active='knowledge';
 else if(path.includes('/locations/')) active='about';
 else if(path.endsWith('/consultation.html')) active='consultation';
 else if(path.includes('/practices/')) active='all-services';
 const activeLink=active?header.querySelector('[data-nav="'+active+'"]'):null;
 if(activeLink)activeLink.setAttribute('aria-current','page');
 const button=header.querySelector('.hamburger'),nav=header.querySelector('.nav-links');
 button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open)});
 nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('is-open');button.setAttribute('aria-expanded','false')}});
})();
