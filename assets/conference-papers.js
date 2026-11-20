'use strict';
(async function(){
 const grid=document.getElementById('paperGrid'),empty=document.getElementById('paperEmpty'),error=document.getElementById('paperError');
 const search=document.getElementById('paperSearch'),orgFilter=document.getElementById('orgFilter'),yearFilter=document.getElementById('yearFilter'),count=document.getElementById('paperCount');
 let papers=[];
 const safeUrl=value=>{try{const u=new URL(value,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const makeCitation=p=>[p.authors?.join(', '),p.year,p.title,p.conference,p.publisher].filter(Boolean).join('. ')+(p.doi?' DOI: '+p.doi:'');
 function render(){
  const q=search.value.trim().toLowerCase(),org=orgFilter.value,year=yearFilter.value;
  const list=papers.filter(p=>{const hay=[p.title,p.abstract,p.publisher,p.conference,p.location,p.authors?.join(' '),p.keywords?.join(' ')].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!org||p.publisher===org)&&(!year||String(p.year)===year)});
  count.textContent=list.length+' of '+papers.length+' published paper'+(papers.length===1?'':'s');
  grid.innerHTML=list.map((p)=>{const pdf=safeUrl(p.pdfUrl),doi=p.doi?safeUrl(p.doi.startsWith('http')?p.doi:'https://doi.org/'+p.doi):null;const citation=esc(makeCitation(p));const key=esc(p.id);return '<article class="paper" data-paper-id="'+key+'"><span class="tag">'+esc(p.type||'Conference paper')+'</span><h3>'+esc(p.title)+'</h3><p class="meta">'+esc((p.authors||[]).join(', '))+'</p><p class="meta"><span class="publisher">'+esc(p.publisher)+'</span>'+(p.year?' · '+esc(p.year):'')+(p.conference?' · '+esc(p.conference):'')+(p.location?' · '+esc(p.location):'')+'</p><p class="abstract">'+esc(p.abstract)+'</p><p class="meta">'+esc((p.keywords||[]).join(' · '))+'</p><p class="meta">'+(p.peerReviewed?'Peer-reviewed':'Review status: '+esc(p.reviewStatus||'Not stated'))+(p.license?' · '+esc(p.license):'')+'</p><div class="paper-actions">'+(pdf?(new URL(pdf).origin===location.origin?'<a class="download" href="'+esc(pdf)+'" download>Download PDF</a>':'<a class="download" href="'+esc(pdf)+'" target="_blank" rel="noopener noreferrer">View PDF</a>'):'<span class="meta">PDF link pending</span>')+(doi?'<a href="'+esc(doi)+'" target="_blank" rel="noopener noreferrer">DOI / source</a>':'')+'<button type="button" data-share="'+key+'">Share</button><button type="button" data-cite="'+key+'">Copy citation</button></div></article>'}).join('');
  empty.hidden=list.length!==0;grid.hidden=list.length===0;
  const graph={'@context':'https://schema.org','@type':'CollectionPage','name':'Conference Papers & Research Library','url':location.href,'mainEntity':{'@type':'ItemList','itemListElement':list.map((p,i)=>({'@type':'ListItem','position':i+1,'item':{'@type':'ScholarlyArticle','headline':p.title,'author':(p.authors||[]).map(name=>({'@type':'Person','name':name})),'publisher':{'@type':'Organization','name':p.publisher},'datePublished':p.datePublished||String(p.year||''),'abstract':p.abstract,'url':location.origin+'/papers/#'+encodeURIComponent(p.id),'encoding':p.pdfUrl?{'@type':'MediaObject','contentUrl':p.pdfUrl,'encodingFormat':'application/pdf'}:undefined,'isPartOf':p.conference?{'@type':'Event','name':p.conference}:undefined}}))}};
  let schema=document.getElementById('paperCollectionSchema');if(!schema){schema=document.createElement('script');schema.type='application/ld+json';schema.id='paperCollectionSchema';document.head.appendChild(schema)}schema.textContent=JSON.stringify(graph);
 }
 try{
  const response=await fetch('/papers/catalog.json',{cache:'no-cache'});if(!response.ok)throw new Error('Catalogue request failed');
  const data=await response.json();papers=Array.isArray(data.papers)?data.papers:[];
  papers=papers.filter(p=>p&&p.id&&p.title&&p.publisher&&p.abstract&&Array.isArray(p.authors));
  [...new Set(papers.map(p=>p.publisher))].sort().forEach(v=>orgFilter.add(new Option(v,v)));
  [...new Set(papers.map(p=>String(p.year||'')).filter(Boolean))].sort((a,b)=>b.localeCompare(a)).forEach(v=>yearFilter.add(new Option(v,v)));
  render();
 }catch(e){count.textContent='Paper catalogue unavailable';error.hidden=false;grid.hidden=true;empty.hidden=true}
 [search,orgFilter,yearFilter].forEach(el=>el.addEventListener(el===search?'input':'change',render));
 grid.addEventListener('click',async event=>{
  const share=event.target.closest('[data-share]'),cite=event.target.closest('[data-cite]');if(!share&&!cite)return;
  const id=(share||cite).dataset[share?'share':'cite'],p=papers.find(item=>item.id===id);if(!p)return;
  const url=location.origin+'/papers/#'+encodeURIComponent(p.id),citation=makeCitation(p);
  if(cite){try{await navigator.clipboard.writeText(citation);cite.textContent='Citation copied'}catch{window.prompt('Copy this citation:',citation)}return}
  if(navigator.share){try{await navigator.share({title:p.title,text:citation,url})}catch(e){if(e.name!=='AbortError')window.prompt('Copy paper link:',url)}}
  else{try{await navigator.clipboard.writeText(url);share.textContent='Link copied'}catch{window.prompt('Copy paper link:',url)}}
 });
 const mail=document.getElementById('submitEmail');
 mail.addEventListener('click',()=>{const subject=encodeURIComponent('Conference paper publication submission');const body=encodeURIComponent('Please find attached our proposed conference paper PDF.\n\nPaper title:\nAuthor(s) and affiliation(s):\nPublishing organisation:\nConference and event dates:\nAbstract:\nKeywords:\nPublication date:\nDOI or permanent source URL:\nPeer-review / editorial status:\nPDF hosting and distribution permission / licence:\nContact person and email:\n');mail.href='mailto:info@kuriakaratuadvocates.com?subject='+subject+'&body='+body});
})();
