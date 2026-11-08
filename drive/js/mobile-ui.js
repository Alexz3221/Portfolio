/* Touch/browser UI, isolated from the simulation so browser lifecycles are testable. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DriveMobileUI = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function setup({document, window, canvas, controls, releaseControls, resize}) {
    // Safari's native long-press selection/callout can start independently of
    // pointer events. Reserve only gameplay touches, never forms or the page.
    const reserveTouch = event => { if (event.cancelable) event.preventDefault(); };
    for (const element of [canvas, ...controls]) {
      for (const name of ['touchstart', 'touchmove', 'touchend']) {
        element.addEventListener(name, reserveTouch, {passive:false});
      }
    }

    const button = document.querySelector('#fullscreenButton');
    const help = document.querySelector('#screenHelp');
    const helpMessage = document.querySelector('#screenHelpMessage');
    const close = document.querySelector('#screenHelpClose');
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    const supported = !!(request && exit && document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false);
    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
    const standalone = () => !!(window.navigator?.standalone || standaloneQuery?.matches);
    const fullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    let pending = false;
    function sync() {
      const active = fullscreen(), installed = standalone();
      button.hidden = false;
      button.disabled = pending || (installed && !active);
      button.textContent = active ? 'EXIT FULL SCREEN' : installed || !supported ? 'APP VIEW' : 'FULL SCREEN';
      button.setAttribute('aria-pressed', String(active || installed));
      button.title = active ? 'Exit full screen' : installed ? 'Already running in app view' : supported ? 'Enter full screen' : 'Show app-view instructions';
    }
    function showHelp(message) {
      helpMessage.textContent = message;
      help.hidden = false;
      button.setAttribute('aria-expanded','true');
      close.focus();
    }
    function closeHelp() {
      help.hidden = true;
      button.setAttribute('aria-expanded','false');
      button.focus();
    }
    close.addEventListener('click', closeHelp);
    help.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeHelp(); }
    });
    button.addEventListener('click', async () => {
      if (pending || (standalone() && !fullscreen())) return;
      releaseControls();
      if (!supported) {
        if (!help.hidden) { closeHelp(); return; }
        showHelp('This browser cannot put the game in full screen. You can use app view on supported phones.');
        return;
      }
      help.hidden = true; button.setAttribute('aria-expanded','false');
      pending = true; sync();
      try {
        if (fullscreen()) await exit.call(document);
        else await request.call(root, {navigationUI:'hide'});
      } catch (_) {
        showHelp('Full screen was unavailable or declined. You can keep playing here or try app view.');
      } finally {
        pending = false; sync(); resize();
      }
    });
    const changed = () => { releaseControls(); sync(); resize(); };
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('webkitfullscreenchange', changed);
    standaloneQuery?.addEventListener?.('change', changed);
    sync();
  }
  return {setup};
});
