(function () {
  'use strict';
  const grid = document.getElementById('insightsGrid');
  const empty = document.getElementById('insightsEmpty');
  const toolbar = document.getElementById('insightsToolbar');
  const search = document.getElementById('insightsSearch');
  const category = document.getElementById('insightsCategory');
  if (!grid || !empty) return;

  const safeText = value => typeof value === 'string' ? value.trim() : '';
  const validDate = value => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-KE', { dateStyle: 'long' }).format(date);
  };

  function render(items) {
    const query = safeText(search && search.value).toLowerCase();
    const selected = safeText(category && category.value).toLowerCase();
    const filtered = items.filter(item => {
      const haystack = [item.title, item.excerpt, item.category, item.author, ...(Array.isArray(item.tags) ? item.tags : [])].join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (!selected || safeText(item.category).toLowerCase() === selected);
    });
    grid.replaceChildren();
    filtered.forEach(item => {
      const article = document.createElement('article');
      article.className = 'card';
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = safeText(item.category) || 'Insight';
      const heading = document.createElement('h3');
      heading.textContent = safeText(item.title);
      const excerpt = document.createElement('p');
      excerpt.textContent = safeText(item.excerpt);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = [safeText(item.author), validDate(item.publishedAt)].filter(Boolean).join(' · ');
      const link = document.createElement('a');
      link.textContent = 'Read insight →';
      const href = safeText(item.url);
      if (/^(https:\/\/|\/)/i.test(href) && !href.startsWith('//')) {
        link.href = href;
        if (/^https:\/\//i.test(href) && !href.startsWith(location.origin + '/')) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } else {
        return;
      }
      article.append(tag, heading, excerpt, meta, link);
      grid.append(article);
    });
    empty.hidden = filtered.length > 0 || items.length > 0;
    if (items.length > 0 && filtered.length === 0) {
      empty.hidden = false;
      empty.querySelector('h2').textContent = 'No matching insights';
      empty.querySelector('p').textContent = 'Try another search term or choose a different category.';
    } else if (items.length === 0) {
      empty.hidden = false;
      empty.querySelector('h2').textContent = 'Insights are coming soon';
      empty.querySelector('p').innerHTML = 'This section is ready for publication. The firm will add its first articles here as they are approved for release. In the meantime, explore the <a href="/blog/">legal blog</a>, browse the <a href="/newsletter/">monthly newsletter</a> or view the <a href="/papers/">conference papers library</a>.';
    }
  }

  fetch('/insights-library/catalog.json', { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error('Insights catalogue unavailable');
      return response.json();
    })
    .then(data => {
      const items = Array.isArray(data.insights) ? data.insights.filter(item =>
        item && safeText(item.title) && safeText(item.excerpt) && safeText(item.url)
      ) : [];
      const categories = [...new Set(items.map(item => safeText(item.category)).filter(Boolean))].sort();
      categories.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        category.append(option);
      });
      toolbar.hidden = items.length === 0;
      if (search) search.addEventListener('input', () => render(items));
      if (category) category.addEventListener('change', () => render(items));
      render(items);
    })
    .catch(() => {
      grid.replaceChildren();
      empty.hidden = false;
      empty.querySelector('h2').textContent = 'Insights are temporarily unavailable';
      empty.querySelector('p').textContent = 'Please try again later or use the legal blog for published guides.';
    });
})();
