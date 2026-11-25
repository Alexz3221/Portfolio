(() => {
  const link = document.querySelector('[data-destination]');
  if (!link) return;

  const url = new URL(link.href);
  if (link.hasAttribute('data-local-ai')) {
    if (location.hash === '#adventure' || location.hash === '#image') url.hash = location.hash;
  } else {
    if (location.search) url.search = location.search;
    if (location.hash) url.hash = location.hash;
  }

  link.href = url.href;
  location.replace(url.href);
})();
