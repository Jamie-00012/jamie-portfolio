(() => {
  const hero = document.querySelector('#home.blue-ink-hero');
  const video = hero?.querySelector('video');
  if (!video || video.dataset.initialized) return;
  video.dataset.initialized = 'true';
  video.muted = true;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  let visible = true;
  const sync = () => {
    if (document.hidden || !visible || motion.matches) video.pause();
    else video.play()?.catch(() => {});
  };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  observer.observe(hero);
  document.addEventListener('visibilitychange', sync, { signal: controller.signal });
  motion.addEventListener('change', sync, { signal: controller.signal });
  video.addEventListener('loadeddata', sync, { signal: controller.signal });
  window.addEventListener('pageshow', sync, { signal: controller.signal });
  window.addEventListener('pagehide', (event) => {
    video.pause();
    if (!event.persisted) { observer.disconnect(); controller.abort(); }
  }, { signal: controller.signal });
  sync();
})();
