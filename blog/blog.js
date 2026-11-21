(() => {
  'use strict';

  const validSlug = slug => typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug);
  const isReview = entry => entry.kind === 'review';
  const reviewMedium = entry => isReview(entry) && typeof entry.medium === 'string' ? entry.medium.trim() : '';

  async function posts() {
    const response = await fetch('posts.json?v=2', {cache: 'no-store'});
    if (!response.ok) throw new Error('Could not load the notes.');
    const entries = await response.json();
    return entries.filter(entry => entry && validSlug(entry.slug));
  }

  function appendInline(target, text) {
    const links = /\[([^\]]+)\]\(([^)]+)\)/g;
    let cursor = 0;
    for (const match of text.matchAll(links)) {
      target.append(document.createTextNode(text.slice(cursor, match.index)));
      const url = match[2];
      if (/^https?:\/\//.test(url) || /^(\.\.?\/|\/)[^/]/.test(url)) {
        const link = document.createElement('a');
        link.href = url;
        link.textContent = match[1];
        target.append(link);
      } else {
        target.append(document.createTextNode(match[0]));
      }
      cursor = match.index + match[0].length;
    }
    target.append(document.createTextNode(text.slice(cursor)));
  }

  function renderMarkdown(markdown, target) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    let paragraph = [];
    let list = null;
    const flush = () => {
      if (paragraph.length) {
        const element = document.createElement('p');
        appendInline(element, paragraph.join(' '));
        target.append(element);
        paragraph = [];
      }
      list = null;
    };
    lines.forEach(raw => {
      const line = raw.trim();
      if (!line) { flush(); return; }
      const heading = /^(#{2,3})\s+(.+)$/.exec(line);
      if (heading) {
        flush();
        const element = document.createElement(heading[1].length === 2 ? 'h2' : 'h3');
        appendInline(element, heading[2]);
        target.append(element);
      } else if (line.startsWith('- ')) {
        if (paragraph.length) flush();
        if (!list) { list = document.createElement('ul'); target.append(list); }
        const item = document.createElement('li');
        appendInline(item, line.slice(2));
        list.append(item);
      } else if (line.startsWith('> ')) {
        flush();
        const quote = document.createElement('blockquote');
        appendInline(quote, line.slice(2));
        target.append(quote);
      } else {
        if (list) list = null;
        paragraph.push(line);
      }
    });
    flush();
  }

  function setListMessage(target, text) {
    const message = document.createElement('p');
    message.className = 'blog-muted';
    message.textContent = text;
    target.replaceChildren(message);
  }

  function postCard(entry) {
    const card = document.createElement('a');
    card.className = 'post-card';
    card.href = 'read.html?post=' + encodeURIComponent(entry.slug);

    const meta = document.createElement('div');
    meta.className = 'post-meta';
    const date = document.createElement('time');
    date.dateTime = entry.date;
    date.textContent = entry.date;
    meta.append(date);
    const medium = reviewMedium(entry);
    if (medium) {
      const type = document.createElement('span');
      type.className = 'post-medium';
      type.textContent = medium;
      meta.append(type);
    }

    const content = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = entry.title;
    content.append(heading);
    if (entry.description) {
      const description = document.createElement('p');
      description.textContent = entry.description;
      content.append(description);
    }
    const arrow = document.createElement('span');
    arrow.className = 'post-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    card.append(meta, content, arrow);
    return card;
  }

  async function showIndex() {
    const reviews = new URLSearchParams(location.search).get('section') === 'reviews';
    const selected = reviews ? 'reviews' : 'posts';
    const target = document.querySelector('#posts');
    for (const link of document.querySelectorAll('[data-blog-section]')) {
      if (link.dataset.blogSection === selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (reviews) {
      document.title = 'Media Reviews / Alex Zhou';
      document.querySelector('#blogTitle').textContent = 'Media Reviews';
      document.querySelector('.blog-intro').hidden = true;
      target.setAttribute('aria-label', 'Media Reviews');
      setListMessage(target, 'Loading reviews…');
    }
    try {
      const entries = (await posts()).filter(entry => isReview(entry) === reviews);
      if (entries.length) target.replaceChildren(...entries.map(postCard));
      else setListMessage(target, reviews ? 'No reviews yet.' : 'No posts yet.');
    } catch {
      setListMessage(target, reviews ? 'Could not load reviews.' : 'Could not load posts.');
    } finally {
      target.setAttribute('aria-busy', 'false');
    }
  }

  async function showPost() {
    const slug = new URLSearchParams(location.search).get('post') || '';
    const target = document.querySelector('#postBody');
    if (!validSlug(slug)) { document.querySelector('#postTitle').textContent = 'Note not found.'; return; }
    try {
      const entry = (await posts()).find(item => item.slug === slug);
      if (!entry) throw new Error('Note not found.');
      const response = await fetch('posts/' + slug + '.md', {cache: 'no-store'});
      if (!response.ok) throw new Error('Note not found.');
      document.title = entry.title + ' / Unnecessary Lore';
      document.querySelector('#postTitle').textContent = entry.title;
      const date = document.querySelector('#postDate');
      date.dateTime = entry.date;
      date.textContent = entry.date;
      if (isReview(entry)) {
        const back = document.querySelector('#blogBack');
        back.href = './?section=reviews';
        back.textContent = '← All reviews';
        const medium = reviewMedium(entry);
        if (medium) {
          const type = document.querySelector('#postMedium');
          type.textContent = medium;
          type.hidden = false;
        }
      }
      renderMarkdown(await response.text(), target);
    } catch (error) { document.querySelector('#postTitle').textContent = error.message; }
  }

  if (document.body.dataset.page === 'index') showIndex();
  else showPost();
})();
