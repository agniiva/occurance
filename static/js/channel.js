/* Progressive navigation enhancement: ordinary links remain real links. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pauseKey = 'agniva:effects-paused';
  const entryKey = 'agniva:next-channel';
  const pathKey = path => path.replace(/\/+$/, '') || '/';
  const pageKey = url => pathKey(url.pathname) + url.search;
  const read = (storage, key) => { try { return window[storage].getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { window[storage].setItem(key, value); } catch { /* Storage is optional. */ } };
  const remove = (storage, key) => { try { window[storage].removeItem(key); } catch { /* Storage is optional. */ } };
  const paused = () => root.hasAttribute('data-effects-paused') || document.querySelector('#pause-effects')?.checked;
  let departureTimer;
  let busy = false;
  const soundKey = 'agniva:channel-sound';
  let soundEnabled = read('localStorage', soundKey) !== '0';
  let soundPersisted = true;
  const tuningSound = new Audio(new URL('../audio/channel-click.wav', document.currentScript.src).href);
  tuningSound.preload = 'auto';
  tuningSound.volume = 0.18;
  const syncSoundControl = () => {
    const button = document.querySelector('#channel-sound');
    if (!button) return;
    button.hidden = false;
    button.setAttribute('aria-pressed', String(soundEnabled));
    button.textContent = soundEnabled ? 'Sound on' : 'Sound off';
  };

  if (read('localStorage', pauseKey) === '1') root.setAttribute('data-effects-paused', '');
  const destination = read('sessionStorage', entryKey);
  remove('sessionStorage', entryKey);
  if (destination === pageKey(location) && !paused() && !reduceMotion.matches) {
    root.classList.add('channel-entering');
    // A bounded cleanup also works if animationend does not fire.
    setTimeout(() => root.classList.remove('channel-entering'), 360);
  }

  document.addEventListener('DOMContentLoaded', () => {
    syncSoundControl();
    document.querySelector('#channel-sound')?.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (!soundEnabled) tuningSound.pause();
      try {
        window.localStorage.setItem(soundKey, soundEnabled ? '1' : '0');
        soundPersisted = true;
      } catch {
        soundPersisted = false;
      }
      syncSoundControl();
    });
    const control = document.querySelector('#pause-effects');
    if (control) {
      control.checked = root.hasAttribute('data-effects-paused');
      control.addEventListener('change', () => {
        root.toggleAttribute('data-effects-paused', control.checked);
        write('localStorage', pauseKey, control.checked ? '1' : '0');
        if (control.checked) root.classList.remove('channel-entering');
      });
    }
  });

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    if (anchor.hasAttribute('data-no-transition')) return;
    const url = new URL(anchor.href, location.href);
    if (!['http:', 'https:'].includes(url.protocol)) return;
    // Fragment jumps, feeds, files and the separate CMS keep native behavior.
    if (url.origin === location.origin && pageKey(url) === pageKey(location)) return;
    if (/\.(?:xml|rss|atom|pdf|zip|png|jpe?g|gif|svg|webp|mp3|mp4)$/i.test(url.pathname)) return;
    if (url.origin === location.origin && /^\/(?:admin|api)(?:\/|$)/.test(url.pathname)) return;
    if (reduceMotion.matches || paused()) return;

    event.preventDefault();
    if (busy) return;
    busy = true;
    // Only a genuine click/keyboard activation may produce sound, never load.
    if (event.isTrusted && soundEnabled) {
      tuningSound.currentTime = 0;
      tuningSound.play().catch(() => { /* Audio restrictions never block navigation. */ });
    }
    root.classList.remove('channel-entering');
    document.querySelector('.page')?.style.setProperty('--channel-origin', `${scrollY + innerHeight / 2}px`);
    root.classList.add('channel-leaving');
    if (url.origin === location.origin) write('sessionStorage', entryKey, pageKey(url));
    // This runs regardless of CSS support; no dependency on animationend.
    departureTimer = setTimeout(() => location.assign(url.href), 280);
  });

  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    clearTimeout(departureTimer);
    busy = false;
    // Never replace an unpersisted preference with stale or unavailable storage.
    if (soundPersisted) {
      try { soundEnabled = window.localStorage.getItem(soundKey) !== '0'; }
      catch { /* Keep the in-memory preference when storage is unavailable. */ }
    }
    syncSoundControl();
    root.classList.remove('channel-leaving', 'channel-entering');
    const isPaused = read('localStorage', pauseKey) === '1';
    root.toggleAttribute('data-effects-paused', isPaused);
    const control = document.querySelector('#pause-effects');
    if (control) control.checked = isPaused;
  });
})();
