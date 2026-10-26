(() => {
  'use strict';

  const validSlug = slug => /^[a-z0-9-]+$/.test(slug);

  async function posts() {
    const response = await fetch('posts.json');
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

  async function showIndex() {
    const target = document.querySelector('#posts');
    try {
      const entries = await posts();
      target.replaceChildren();
      entries.forEach(entry => {
        const card = document.createElement('a');
        card.className = 'post-card';
        card.href = 'read.html?post=' + encodeURIComponent(entry.slug);
        const date = document.createElement('time');
        date.dateTime = entry.date;
        date.textContent = entry.date;
        const content = document.createElement('div');
        const heading = document.createElement('h2');
        heading.textContent = entry.title;
        const description = document.createElement('p');
        description.textContent = entry.description || '';
        content.append(heading, description);
        const arrow = document.createElement('span');
        arrow.className = 'post-arrow';
        arrow.textContent = '↗';
        card.append(date, content, arrow);
        target.append(card);
      });
      if (!entries.length) target.textContent = 'No notes yet.';
    } catch (error) { target.textContent = error.message; }
  }

  async function showPost() {
    const slug = new URLSearchParams(location.search).get('post') || '';
    const target = document.querySelector('#postBody');
    if (!validSlug(slug)) { document.querySelector('#postTitle').textContent = 'Note not found.'; return; }
    try {
      const entry = (await posts()).find(item => item.slug === slug);
      if (!entry) throw new Error('Note not found.');
      const response = await fetch('posts/' + slug + '.md');
      if (!response.ok) throw new Error('Note not found.');
      document.title = entry.title + ' / Unnecessary Lore';
      document.querySelector('#postTitle').textContent = entry.title;
      document.querySelector('#postDate').textContent = entry.date;
      renderMarkdown(await response.text(), target);
    } catch (error) { document.querySelector('#postTitle').textContent = error.message; }
  }

  if (document.body.dataset.page === 'index') showIndex();
  else showPost();
})();
