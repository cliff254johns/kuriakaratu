/* Static-site SEO enrichment for the homepage; shared public-page scripts apply the same metadata pattern elsewhere. */
(function(){
 'use strict';
 const title=document.title||'Kuria Karatu & Company Advocates';
 const desc=document.querySelector('meta[name="description"]')?.content||'Legal services and practical legal information from Kuria Karatu & Company Advocates in Kenya.';
 const canonical=document.querySelector('link[rel="canonical"]')?.href||location.origin+'/';
 const ensure=(selector,key,value)=>{let el=document.head.querySelector(selector);if(!el){el=document.createElement('meta');const p=key.split('=');el.setAttribute(p[0],p[1]);document.head.appendChild(el)}el.content=value};
 ensure('meta[name="robots"]','name=robots','index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
 ensure('meta[property="og:url"]','property=og:url',canonical);
 ensure('meta[property="og:title"]','property=og:title',title);
 ensure('meta[property="og:description"]','property=og:description',desc);
 ensure('meta[property="og:image"]','property=og:image',location.origin+'/android-chrome-512x512.png');
 ensure('meta[name="twitter:card"]','name=twitter:card','summary_large_image');
 ensure('meta[name="twitter:title"]','name=twitter:title',title);
 ensure('meta[name="twitter:description"]','name=twitter:description',desc);
 ensure('meta[name="twitter:image"]','name=twitter:image',location.origin+'/android-chrome-512x512.png');
 if(!document.head.querySelector('link[hreflang="en-KE"]')){const l=document.createElement('link');l.rel='alternate';l.hreflang='en-KE';l.href=canonical;document.head.appendChild(l)}
 if(!document.head.querySelector('script[data-kk-home-schema]')){const s=document.createElement('script');s.type='application/ld+json';s.dataset.kkHomeSchema='true';s.textContent=JSON.stringify({'@context':'https://schema.org','@type':'WebPage','name':title,'description':desc,'url':canonical,'inLanguage':'en-KE','isPartOf':{'@type':'WebSite','name':'Kuria Karatu & Company Advocates','url':location.origin+'/'}});document.head.appendChild(s)}
})();
