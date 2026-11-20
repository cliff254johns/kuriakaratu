/* Shared responsive navigation for public content pages. */
(function(){'use strict';const nested=/\/(practices|insights|locations|blog|newsletter)\//.test(location.pathname),root=nested?'../':'',home=root+'index.html',path=location.pathname;
const links=[['Home',home,'home'],['About',home+'#about','about'],['Practice Areas',root+'practices/index.html','practices'],['Legal Knowledge',root+'insights/index.html','knowledge'],['Blog',root+'blog/','blog'],['Monthly Newsletter',root+'newsletter/','newsletter'],['Our Team',home+'#team','team'],['Request Consultation',root+'consultation.html','consultation']];
const header=document.createElement('header');header.id='mainHeader';header.className='kk-practice-header';
header.innerHTML='<div class="nav-container"><a class="logo" href="'+home+'" aria-label="Kuria Karatu and Company Advocates homepage"><img src="'+root+'logo%20(1).jpg" alt="" width="64" height="48"><span class="text-group"><span class="brand-name">Kuria Karatu &amp; Company</span><span class="brand-sub">ADVOCATES</span></span></a><button class="hamburger" type="button" aria-label="Open navigation" aria-controls="kkNavLinks" aria-expanded="false"><span></span><span></span><span></span></button><ul class="nav-links" id="kkNavLinks" aria-label="Main navigation">'+links.map(([label,href,key])=>'<li><a href="'+href+'" class="'+(key==='consultation'?'btn-nav':'')+'" data-nav="'+key+'">'+label+'</a></li>').join('')+'</ul></div>';
const main=document.querySelector('main')||document.querySelector('h1');if(main&&!main.id)main.id='main-content';const skip=document.createElement('a');skip.className='kk-skip-link';skip.href='#main-content';skip.textContent='Skip to main content';document.body.prepend(skip);
const old=document.querySelector('header.head,header');if(old)old.replaceWith(header);else document.body.prepend(header);
let active='';if(path.includes('/practices/'))active='practices';else if(path.includes('/insights/'))active='knowledge';else if(path.endsWith('/consultation.html'))active='consultation';else if(path.includes('/locations/'))active='about';else if(path.includes('/blog/'))active='blog';else if(path.includes('/newsletter/'))active='newsletter';const current=active?header.querySelector('[data-nav="'+active+'"]'):null;if(current)current.setAttribute('aria-current','page');
const toggle=header.querySelector('.hamburger'),menu=header.querySelector('.nav-links');function closeMenu(){menu.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation')}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');menu.classList.toggle('is-open',open)});
menu.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});document.addEventListener('click',e=>{if(!header.contains(e.target))closeMenu()});
function enrichPublicSeo(){
 const title=document.title||'Kuria Karatu & Company Advocates';
 const desc=document.querySelector('meta[name="description"]')?.content||(document.querySelector('main h1,h1')?.textContent||'Legal services and practical legal information from Kuria Karatu & Company Advocates in Kenya.').trim();
 const canonical=document.querySelector('link[rel="canonical"]')?.href||new URL(location.pathname,location.origin).href;\n let canonicalLink=document.head.querySelector('link[rel="canonical"]');if(!canonicalLink){canonicalLink=document.createElement('link');canonicalLink.rel='canonical';document.head.appendChild(canonicalLink)}canonicalLink.href=canonical;\n if(!document.head.querySelector('link[hreflang="en-KE"]')){const alternate=document.createElement('link');alternate.rel='alternate';alternate.hreflang='en-KE';alternate.href=canonical;document.head.appendChild(alternate)}
 const setMeta=(selector,key,value)=>{let el=document.head.querySelector(selector);if(!el){el=document.createElement('meta');const pair=key.split('=');el.setAttribute(pair[0],pair[1]);document.head.appendChild(el)}el.content=value};
 if(!document.documentElement.lang||document.documentElement.lang==='en')document.documentElement.lang='en-KE';
 setMeta('meta[name="robots"]','name=robots','index,follow,max-image-preview:large');
 setMeta('meta[name="author"]','name=author','Kuria Karatu & Company Advocates');
 setMeta('meta[property="og:type"]','property=og:type',/\/(blog|newsletter|insights)\//.test(location.pathname)?'article':'website');
 setMeta('meta[property="og:site_name"]','property=og:site_name','Kuria Karatu & Company Advocates');
 setMeta('meta[property="og:url"]','property=og:url',canonical);
 setMeta('meta[property="og:title"]','property=og:title',title);
 setMeta('meta[property="og:description"]','property=og:description',desc);
 setMeta('meta[property="og:image"]','property=og:image',location.origin+'/android-chrome-512x512.png');
 setMeta('meta[property="og:locale"]','property=og:locale','en_KE');
 setMeta('meta[name="twitter:card"]','name=twitter:card','summary_large_image');
 setMeta('meta[name="twitter:title"]','name=twitter:title',title);
 setMeta('meta[name="twitter:description"]','name=twitter:description',desc);
 setMeta('meta[name="twitter:image"]','name=twitter:image',location.origin+'/android-chrome-512x512.png');\n setMeta('meta[name="twitter:url"]','name=twitter:url',canonical);
 if(!document.head.querySelector('script[data-kk-webpage-schema]')){
  const parts=location.pathname.split('/').filter(Boolean);
  const items=[{name:'Home',url:location.origin+'/'}];let path='';
  parts.forEach((part,index)=>{path+='/'+part;items.push({name:index===parts.length-1?title.replace(/\s*[|–-]\s*Kuria Karatu.*$/i,''):decodeURIComponent(part.replace(/\.html$/,'').replace(/[-_]/g,' ')).replace(/\b\w/g,c=>c.toUpperCase()),url:location.origin+path+(part.includes('.')?'':'/')})});
  const graph={'@context':'https://schema.org','@graph':[{'@type':'WebPage','name':title,'description':desc,'url':canonical,'inLanguage':'en-KE','isPartOf':{'@type':'WebSite','name':'Kuria Karatu & Company Advocates','url':location.origin+'/'},'publisher':{'@type':'Organization','name':'Kuria Karatu & Company Advocates','url':location.origin+'/'}},{'@type':'BreadcrumbList','itemListElement':items.map((item,i)=>({'@type':'ListItem','position':i+1,'name':item.name,'item':item.url}))}]};\n  if(location.pathname.includes('/insights/')&&!location.pathname.endsWith('/index.html'))graph['@graph'].push({'@type':'BlogPosting','headline':title,'description':desc,'author':{'@type':'Organization','name':'Kuria Karatu & Company Advocates'},'publisher':{'@type':'Organization','name':'Kuria Karatu & Company Advocates'},'mainEntityOfPage':canonical,'inLanguage':'en-KE'});
  const schema=document.createElement('script');schema.type='application/ld+json';schema.dataset.kkWebpageSchema='true';schema.textContent=JSON.stringify(graph);document.head.appendChild(schema);
 }
}
enrichPublicSeo();
})();