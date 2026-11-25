(function(){
'use strict';
const API='https://kuriakaratu-cms-api.cliff254johns.workers.dev';
const path=location.pathname;
const isGallery=/\/gallery\.html$/.test(path),isVideos=/\/videos\.html$/.test(path),isTeam=/\/team\.html$/.test(path);
const pageTypes=()=>isTeam?[['team','Our team']]:isGallery||isVideos?[['media',isGallery?'Gallery':'Videos']]:path.includes('/practices/')?[['practice','Practice areas']]:path.includes('/insights/')?[['insight','Insights']]:path.includes('/papers/')?[['conference_paper','Conference papers']]:path.includes('/newsletter/')?[['newsletter','Newsletters']]:[['home_banner','Latest updates'],['practice','Practice areas'],['team','Our team'],['insight','Insights'],['conference_paper','Conference papers'],['newsletter','Newsletters'],['page','More information'],['media','Media gallery']];
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
function videoId(value){try{const u=new URL(value);if(u.hostname==='youtu.be')return u.pathname.slice(1);if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop();}catch{}return null}
function renderItem(item){
 const card=el('article','cms-card');card.dataset.contentId=item.id||'';
 const vid=videoId(item.document_url||'');
 if(item.image_url){const img=el('img','cms-image');img.src=item.image_url;img.alt=item.title||'Website image';img.loading='lazy';img.decoding='async';card.append(img)}
 if(vid){const wrap=el('div','cms-video');const frame=el('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(vid);frame.title=item.title||'Kuria Karatu video';frame.loading='lazy';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;wrap.append(frame);card.append(wrap)}
 card.append(el('h3','',item.title||''));
 if(item.summary)card.append(el('p','cms-summary',item.summary));
 if(item.body)card.append(el('p','cms-body',item.body));
 if(item.type==='practice'&&item.slug){const a=el('a','cms-link','Explore practice area');a.href=(path.includes('/practices/')?'':'practices/')+encodeURIComponent(item.slug)+'.html';card.append(a)}else if(item.document_url&&!vid){const a=el('a','cms-link','Open media / document');a.href=item.document_url;a.target='_blank';a.rel='noopener noreferrer';card.append(a)}
 return card;
}
function targetFor(type){
 if(isGallery||isVideos)return null;
 if(path==='/'||path.endsWith('/index.html')&&!path.includes('/practices/')&&!path.includes('/insights/')&&!path.includes('/papers/')&&!path.includes('/newsletter/')){
  return ({practice:document.querySelector('#practices .practice-grid'),team:document.querySelector('#team .team-grid'),media:null,insight:document.querySelector('#insights .insight-grid'),home_banner:document.querySelector('#home .hero-content')})[type]||null;
 }
 if(type==='practice')return document.querySelector('main .grid');
 if(type==='insight')return document.querySelector('main .insight-grid,main .grid');
 return null;
}
function makeSection(title,items){
 const root=el('section','cms-section');root.append(el('h2','',title));const grid=el('div','cms-grid');items.forEach(i=>grid.append(renderItem(i)));root.append(grid);return root;
}
async function init(){
 try{
  const response=await fetch(API+'/api/content',{headers:{accept:'application/json'}});
  if(!response.ok)return;
  const data=await response.json();const items=(data.items||[]).slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
  const root=document.querySelector('[data-public-cms]')||(()=>{const n=el('div','public-cms-content');n.dataset.publicCms='';const main=document.querySelector('main');if(main)main.append(n);else document.body.append(n);return n})();
  if(isGallery||isVideos||isTeam){
   const media=isTeam?items.filter(i=>i.type==='team'&&i.status==='published'):items.filter(i=>i.type==='media'&&i.status==='published'&&(isVideos?!!videoId(i.document_url||''):!videoId(i.document_url||'')));
   const h=document.querySelector('[data-cms-heading]');if(h)h.textContent=isTeam?'Meet the team':isGallery?'Gallery':'Videos';
   const fallback=root.querySelector('[data-gallery-fallback]');
   if(media.length){if(fallback)fallback.remove();const grid=el('div','cms-grid cms-full-grid');media.forEach(i=>grid.append(renderItem(i)));root.append(grid)}
   else if(!fallback){root.append(el('p','cms-empty',isTeam?'Team profiles will be updated here.':isGallery?'The gallery is being updated. Please check back soon.':'New videos will appear here soon.'))}
   return;
  }
  const visible=pageTypes().map(x=>x[0]);
  const seo=items.find(i=>visible.includes(i.type)&&(i.seo_title||i.seo_description));
  if(seo){if(seo.seo_title)document.title=seo.seo_title;const meta=document.querySelector('meta[name="description"]');if(meta&&seo.seo_description)meta.content=seo.seo_description}
  const home=path==='/'||path.endsWith('/index.html')&&!/\/(practices|insights|papers|newsletter)\//.test(path);
  const types=home?['home_banner','practice','team','media','insight','page']:visible;
  const pageSlots={'home-about':'#about','home-values':'#values','home-practices':'#practices','home-approach':'#approach','home-team':'#team','home-gallery':'#gallery','home-videos':'#videos','home-insights':'#insights'};
  const pageItems=items.filter(i=>i.type==='page'&&i.status==='published');
  pageItems.forEach(item=>{const selector=pageSlots[item.slug];if(!selector)return;const section=document.querySelector(selector);if(!section)return;const heading=section.querySelector('h1,h2,h3');if(heading&&item.title)heading.textContent=item.title;const copy=section.querySelector('.section-subtitle,p');if(copy&&item.summary)copy.textContent=item.summary;if(item.body){let body=section.querySelector('.cms-managed-copy');if(!body){body=el('p','cms-managed-copy');const container=section.querySelector('.container')||section;container.append(body)}body.textContent=item.body}if(item.image_url)section.style.backgroundImage='linear-gradient(rgba(10,26,47,.78),rgba(10,26,47,.78)),url("'+item.image_url.replace(/["\\\\]/g,'')+'")';});
  types.forEach(type=>{
   const group=items.filter(i=>i.type===type&&i.status==='published');if(!group.length)return;
   if(type==='page')return;
   if(home&&type==='media'){const images=group.filter(i=>!videoId(i.document_url||''));const videos=group.filter(i=>!!videoId(i.document_url||''));const gallery=document.querySelector('#gallery .gallery-grid');const videoGrid=document.querySelector('#videos .video-grid');if(gallery&&images.length){gallery.replaceChildren();gallery.classList.add('cms-grid');images.forEach(i=>gallery.append(renderItem(i)))}if(videoGrid&&videos.length){videoGrid.replaceChildren();videoGrid.classList.add('cms-grid');videos.forEach(i=>videoGrid.append(renderItem(i)))}return}
   const target=targetFor(type);
   if(target){group.forEach(i=>target.append(renderItem(i)));return}
   if(home)return;
   const section=makeSection(({practice:'Practice areas',insight:'Insights',conference_paper:'Conference papers',newsletter:'Newsletters',team:'Our team',media:'Media gallery',page:'More information'}[type]||type),group);root.append(section);
  });
 }catch(e){console.warn('Public CMS content unavailable',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();