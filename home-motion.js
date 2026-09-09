(() => {
  const root = document.documentElement;
  const body = document.body;
  if (!body || body.dataset.build !== 'four-case-1' || root.dataset.homeMotionInitialized) return;

  root.dataset.homeMotionInitialized = 'true';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallScreen = window.matchMedia('(max-width: 640px)');
  const controller = new AbortController();
  const observers = [];
  const cleanupCallbacks = [];
  const timers = [];
  let curtain;
  let scrollFrame = 0;

  const storage = {
    get(key) {
      try { return sessionStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { sessionStorage.setItem(key, value); } catch { /* Storage can be unavailable in privacy modes. */ }
    }
  };

  const introKey = 'jamie-portfolio:home-intro-played';
  const navigationType = performance.getEntriesByType('navigation')[0]?.type;
  const shouldPlayIntro = !reducedMotion && navigationType !== 'back_forward' && storage.get(introKey) !== '1';

  const prepareHeroLines = () => {
    const title = document.querySelector('#home h1');
    if (!title || title.querySelector('.home-hero-line')) return [];

    const nodes = [...title.childNodes];
    const breakIndex = nodes.findIndex((node) => node.nodeName === 'BR');
    if (breakIndex < 0) return [];

    const accessibleTitle = title.getAttribute('aria-label') || title.innerText.replace(/\s+/g, ' ').trim();
    title.setAttribute('aria-label', accessibleTitle);

    const topLine = document.createElement('span');
    topLine.className = 'home-hero-line home-hero-line--top';
    topLine.setAttribute('aria-hidden', 'true');
    nodes.slice(0, breakIndex).forEach((node) => topLine.appendChild(node));

    const breakNode = nodes[breakIndex];
    const lowerNodes = nodes.slice(breakIndex + 1);
    const bottomLine = lowerNodes.length === 1 && lowerNodes[0].nodeType === Node.ELEMENT_NODE
      ? lowerNodes[0]
      : document.createElement('span');
    if (bottomLine !== lowerNodes[0]) lowerNodes.forEach((node) => bottomLine.appendChild(node));
    bottomLine.classList.add('home-hero-line', 'home-hero-line--bottom');
    bottomLine.setAttribute('aria-hidden', 'true');

    title.replaceChildren(topLine, breakNode, bottomLine);
    return [topLine, bottomLine];
  };

  const prepareHeroPhrase = () => {
    const copy = document.querySelector('#home .hero-statement p');
    if (!copy || copy.querySelector('.home-phrase')) return;

    const text = copy.textContent.trim();
    const punctuationIndex = text.indexOf('，');
    if (punctuationIndex < 0) return;
    const phrases = [text.slice(0, punctuationIndex + 1), text.slice(punctuationIndex + 1)];
    copy.setAttribute('aria-label', text);
    copy.replaceChildren(...phrases.map((phrase, index) => {
      const span = document.createElement('span');
      span.className = 'home-phrase';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--home-phrase-delay', `${420 + index * 75}ms`);
      span.textContent = phrase;
      return span;
    }));
  };

  const createVideoBackground = () => {
    if (document.body.dataset.auroraProvider === 'react-b') return;

    const hero = document.querySelector('#home');
    if (!hero || hero.querySelector('.home-video-background')) return;

    const background = document.createElement('div');
    background.className = 'home-video-background';
    background.setAttribute('aria-hidden', 'true');

    const video = document.createElement('video');
    video.className = 'home-video-background__source';
    video.autoplay = true;
    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.src = '/assets/home-fluid-sand.mp4';

    const canvas = document.createElement('canvas');
    canvas.className = 'home-video-background__canvas';
    canvas.dataset.videoFrame = '0';
    canvas.dataset.videoState = 'loading';
    canvas.dataset.videoPointer = '0.000,0.000,0.000';

    background.append(video, canvas);
    hero.insertBefore(background, hero.querySelector('.topline'));

    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) {
      background.dataset.videoState = 'native';
      background.classList.add('is-ready');
      canvas.remove();
      const playback = video.play();
      if (playback?.catch) playback.catch(() => {});
      return;
    }

    let cssWidth = 1;
    let cssHeight = 1;
    let renderScale = 1;
    let frameHandle = 0;
    let resizeFrame = 0;
    let lastDrawTime = 0;
    let renderedFrames = 0;
    let heroVisible = true;
    let running = false;
    let pointerInside = false;
    let lastPointerTime = 0;
    let previousPointerX = 0;
    let previousPointerY = 0;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      velocityX: 0,
      velocityY: 0,
      targetVelocityX: 0,
      targetVelocityY: 0,
      energy: 0,
      targetEnergy: 0
    };

    if (motionPreference.matches) {
      video.autoplay = false;
      video.pause();
      canvas.dataset.videoState = 'static';
      background.dataset.videoState = 'static';
      background.classList.add('is-ready');
    }

    const updateProfile = () => {
      const mobile = smallScreen.matches;
      const dprCap = mobile ? 1 : 1.35;
      renderScale = Math.min(window.devicePixelRatio || 1, dprCap) * (mobile ? .82 : 1);
      canvas.dataset.videoFpsTarget = String(mobile ? 25 : 60);
      canvas.dataset.videoResolution = renderScale.toFixed(2);
      canvas.dataset.videoQuality = mobile ? 'native-mobile' : 'distorted-desktop';
    };

    const coverRect = () => {
      const videoWidth = Math.max(1, video.videoWidth);
      const videoHeight = Math.max(1, video.videoHeight);
      const videoRatio = videoWidth / videoHeight;
      const canvasRatio = cssWidth / cssHeight;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = videoWidth;
      let sourceHeight = videoHeight;
      if (videoRatio > canvasRatio) {
        sourceWidth = videoHeight * canvasRatio;
        sourceX = (videoWidth - sourceWidth) * .5;
      } else {
        sourceHeight = videoWidth / canvasRatio;
        sourceY = (videoHeight - sourceHeight) * .5;
      }
      return { sourceX, sourceY, sourceWidth, sourceHeight };
    };

    const drawFrame = (time = 0) => {
      if (video.readyState < 2 || !video.videoWidth) return;
      const source = coverRect();
      context.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      context.clearRect(0, 0, cssWidth, cssHeight);
      context.drawImage(
        video,
        source.sourceX,
        source.sourceY,
        source.sourceWidth,
        source.sourceHeight,
        0,
        0,
        cssWidth,
        cssHeight
      );

      if (!smallScreen.matches && pointer.energy > .012) {
        const radiusX = Math.min(cssWidth * .38, 550) * (.78 + pointer.energy * .3);
        const radiusY = Math.min(cssHeight * .42, 420) * (.8 + pointer.energy * .25);
        const top = Math.max(0, pointer.y - radiusY);
        const bottom = Math.min(cssHeight, pointer.y + radiusY);
        const stripHeight = 8;
        const timeWave = time * .008;

        context.save();
        context.beginPath();
        context.ellipse(pointer.x, pointer.y, radiusX, radiusY, 0, 0, Math.PI * 2);
        context.clip();
        for (let destinationY = top; destinationY < bottom; destinationY += stripHeight) {
          const normalizedY = (destinationY + stripHeight * .5 - pointer.y) / radiusY;
          const falloff = Math.max(0, 1 - normalizedY * normalizedY);
          const ripple = Math.sin(normalizedY * Math.PI * 5.2 + timeWave) * 46 * pointer.energy * falloff;
          const pushX = pointer.velocityX * .34 * falloff + ripple;
          const pushY = pointer.velocityY * .12 * falloff;
          const sourceY = source.sourceY + destinationY / cssHeight * source.sourceHeight;
          const sourceHeight = Math.max(1, stripHeight / cssHeight * source.sourceHeight);
          context.drawImage(
            video,
            source.sourceX,
            sourceY,
            source.sourceWidth,
            sourceHeight,
            pushX,
            destinationY + pushY,
            cssWidth,
            stripHeight + 1
          );
        }
        context.restore();
      }

      renderedFrames += 1;
      canvas.dataset.videoFrame = String(renderedFrames);
      canvas.dataset.videoPointer = `${pointer.x.toFixed(3)},${pointer.y.toFixed(3)},${pointer.energy.toFixed(3)}`;
      background.classList.add('is-canvas-ready');
      const frameState = motionPreference.matches ? 'static' : running ? 'running' : 'ready';
      canvas.dataset.videoState = frameState;
      background.dataset.videoState = frameState;
    };

    const resize = () => {
      const bounds = hero.getBoundingClientRect();
      cssWidth = Math.max(1, Math.round(bounds.width));
      cssHeight = Math.max(1, Math.round(bounds.height));
      updateProfile();
      canvas.width = Math.round(cssWidth * renderScale);
      canvas.height = Math.round(cssHeight * renderScale);
      if (!pointerInside) {
        pointer.x = cssWidth * .5;
        pointer.y = cssHeight * .5;
        pointer.targetX = pointer.x;
        pointer.targetY = pointer.y;
      }
      drawFrame(performance.now());
    };

    const scheduleResize = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resize();
      });
    };

    const stop = (state = 'paused') => {
      running = false;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      video.pause();
      canvas.dataset.videoState = state;
      background.dataset.videoState = state;
    };

    const animate = (time) => {
      if (!running) return;
      frameHandle = requestAnimationFrame(animate);
      const targetFps = smallScreen.matches ? 25 : 60;
      if (time - lastDrawTime < 1000 / targetFps - 1) return;
      lastDrawTime = time;

      if (time - lastPointerTime > 620) {
        pointer.targetVelocityX *= .84;
        pointer.targetVelocityY *= .84;
        pointer.targetEnergy *= .89;
      }
      pointer.x += (pointer.targetX - pointer.x) * .16;
      pointer.y += (pointer.targetY - pointer.y) * .16;
      pointer.velocityX += (pointer.targetVelocityX - pointer.velocityX) * .13;
      pointer.velocityY += (pointer.targetVelocityY - pointer.velocityY) * .13;
      pointer.energy += (pointer.targetEnergy - pointer.energy) * .14;
      drawFrame(time);
    };

    const safePlay = () => {
      const playback = video.play();
      if (playback?.catch) playback.catch(() => {
        background.dataset.videoState = 'awaiting-play';
      });
    };

    const start = () => {
      if (motionPreference.matches || running || !heroVisible || document.hidden || video.readyState < 2) return;
      safePlay();
      if (smallScreen.matches) {
        canvas.dataset.videoState = 'native-mobile';
        background.dataset.videoState = 'running';
        return;
      }
      running = true;
      canvas.dataset.videoState = 'running';
      background.dataset.videoState = 'running';
      lastDrawTime = 0;
      frameHandle = requestAnimationFrame(animate);
    };

    const handlePointer = (event) => {
      if (smallScreen.matches) return;
      const bounds = hero.getBoundingClientRect();
      const nextX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
      const nextY = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
      if (!pointerInside) {
        pointer.x = nextX;
        pointer.y = nextY;
        previousPointerX = nextX;
        previousPointerY = nextY;
        pointerInside = true;
      }
      const velocityX = nextX - previousPointerX;
      const velocityY = nextY - previousPointerY;
      const velocity = Math.hypot(velocityX, velocityY);
      pointer.targetX = nextX;
      pointer.targetY = nextY;
      pointer.targetVelocityX = Math.max(-92, Math.min(92, velocityX * 1.8));
      pointer.targetVelocityY = Math.max(-72, Math.min(72, velocityY * 1.45));
      pointer.targetEnergy = Math.min(1, .72 + velocity / 90);
      previousPointerX = nextX;
      previousPointerY = nextY;
      lastPointerTime = performance.now();
    };

    const resetPointer = () => {
      pointerInside = false;
      pointer.targetVelocityX = 0;
      pointer.targetVelocityY = 0;
      pointer.targetEnergy = 0;
      lastPointerTime = 0;
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const handleReady = () => {
      resize();
      background.classList.add('is-ready');
      if (motionPreference.matches) {
        video.pause();
        drawFrame(0);
        canvas.dataset.videoState = 'static';
        background.dataset.videoState = 'static';
      } else {
        start();
      }
    };

    video.addEventListener('loadeddata', handleReady, { once: true, signal: controller.signal });
    video.addEventListener('error', () => {
      background.dataset.videoState = 'fallback';
      hero.dataset.videoFallback = 'true';
    }, { signal: controller.signal });
    hero.addEventListener('pointermove', handlePointer, { passive: true, signal: controller.signal });
    hero.addEventListener('pointerleave', resetPointer, { signal: controller.signal });
    document.addEventListener('visibilitychange', handleVisibility, { signal: controller.signal });
    window.addEventListener('pageshow', start, { signal: controller.signal });
    smallScreen.addEventListener('change', () => {
      stop();
      scheduleResize();
      start();
    }, { signal: controller.signal });

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(hero);
      observers.push(resizeObserver);
    } else {
      window.addEventListener('resize', scheduleResize, { passive: true, signal: controller.signal });
    }

    if (!motionPreference.matches && 'IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible) start();
        else stop();
      }, { threshold: 0.02 });
      visibilityObserver.observe(hero);
      observers.push(visibilityObserver);
    }

    if (video.readyState >= 2) handleReady();
    else video.load();

    cleanupCallbacks.push(() => {
      stop('stopped');
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      context.clearRect(0, 0, canvas.width, canvas.height);
      video.removeAttribute('src');
      video.load();
      canvas.width = 1;
      canvas.height = 1;
    });
  };

  const addMotionItems = (section, selectors) => {
    const items = [];
    const seen = new Set();
    selectors.forEach((selector) => {
      section.querySelectorAll(selector).forEach((item) => {
        if (!seen.has(item)) {
          seen.add(item);
          items.push(item);
        }
      });
    });

    section.dataset.homeSequence = 'true';
    items.forEach((item, index) => {
      item.classList.add('home-motion-item');
      item.style.setProperty('--home-delay', `${Math.min(index * 80, 720)}ms`);
      if (item.matches('.project-card')) item.dataset.homeCard = 'true';
    });
    return items;
  };

  const prepareSections = () => {
    const splitProfileScreens = document.querySelector('#about > .about-profile-screen');
    const profilePlans = splitProfileScreens ? [
      ['#about > .about-experience-screen', [
        ':scope > .section-head', ':scope > .profile-main .profile-title',
        ':scope > .profile-main .profile-copy', '.profile-experience > .section-head',
        '.experience-title', '.timeline article'
      ]],
      ['#about > .expertise-tools-screen', [
        ':scope > .section-head', ':scope > .profile-main .profile-title',
        ':scope > .profile-main .profile-copy', '.expertise-list article',
        '.core-skills', '.about-tools > *'
      ]]
    ] : [
      ['#about', [
        ':scope > .section-head', '.profile-title', '.profile-copy', '.skills article',
        '.profile-experience > .section-head', '.experience-title', '.timeline article',
        '.footer', '.about-tools > *'
      ]]
    ];
    const plans = [
      ...profilePlans,
      ['#works', [':scope > .section-head', '.works-title h2', '.works-title p', '.project-card']],
      ['#contact', [
        ':scope > .section-head', '.closing-copy .eyebrow', '.closing-copy h2',
        '.closing-copy > p:not(.eyebrow)', '.closing-mail', '.closing-footer > *'
      ]]
    ];

    return plans.map(([selector, itemSelectors]) => {
      const section = document.querySelector(selector);
      if (!section) return null;
      if (section.hasAttribute('data-static-section')) return null;
      addMotionItems(section, itemSelectors);
      return section;
    }).filter(Boolean);
  };

  const prepareButtons = () => {
    const targets = [...document.querySelectorAll('.contact-pill, #works .project-copy > span, .footer a[href="#home"], .closing-footer a[href="#home"]')]
      .filter((target) => !target.closest('[data-static-section]'));
    targets.forEach((target) => {
      target.classList.add('home-motion-button');
      const textNode = [...target.childNodes].reverse().find((node) => node.nodeType === Node.TEXT_NODE && /[↗↑]/.test(node.textContent));
      if (!textNode) return;
      const match = textNode.textContent.match(/([↗↑])\s*$/);
      if (!match) return;
      const beforeArrow = textNode.textContent.slice(0, match.index);
      textNode.textContent = beforeArrow;
      const arrow = document.createElement('span');
      arrow.className = 'home-button-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = match[1];
      textNode.after(arrow);
    });
  };

  const playCurtain = () => {
    if (!shouldPlayIntro) return;
    curtain = document.createElement('div');
    curtain.className = 'home-curtain';
    curtain.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 5; index += 1) {
      const strip = document.createElement('div');
      strip.className = 'home-curtain__strip';
      strip.style.setProperty('--home-strip-index', index);
      curtain.appendChild(strip);
    }
    body.appendChild(curtain);
    root.classList.add('home-intro-running');
    storage.set(introKey, '1');

    requestAnimationFrame(() => requestAnimationFrame(() => curtain?.classList.add('is-revealing')));
    timers.push(window.setTimeout(() => {
      curtain?.remove();
      curtain = null;
      root.classList.remove('home-intro-running');
    }, smallScreen.matches ? 980 : 1180));
  };

  const observeSections = (sections) => {
    const enter = (section) => { section.dataset.homeEntered = 'true'; };
    if (reducedMotion || !('IntersectionObserver' in window)) {
      sections.forEach(enter);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        enter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    sections.forEach((section) => observer.observe(section));
    observers.push(observer);
  };

  const bindHeroScroll = (lines) => {
    if (reducedMotion || lines.length !== 2) return;
    const hero = document.querySelector('#home');
    if (!hero) return;

    const update = () => {
      scrollFrame = 0;
      const progress = Math.max(0, Math.min(1, window.scrollY / Math.max(hero.offsetHeight, 1)));
      const travel = progress * (smallScreen.matches ? 6 : 18);
      lines[0].style.setProperty('--home-hero-drift', `${travel.toFixed(2)}px`);
      lines[1].style.setProperty('--home-hero-drift', `${(-travel).toFixed(2)}px`);
    };

    const requestUpdate = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', requestUpdate, { passive: true, signal: controller.signal });
    smallScreen.addEventListener('change', requestUpdate, { signal: controller.signal });
    update();
  };

  const cleanup = (event) => {
    if (event.persisted) return;
    controller.abort();
    observers.forEach((observer) => observer.disconnect());
    cleanupCallbacks.forEach((callback) => callback());
    timers.forEach((timer) => clearTimeout(timer));
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    curtain?.remove();
  };

  try {
    const heroLines = prepareHeroLines();
    prepareHeroPhrase();
    createVideoBackground();
    const sections = prepareSections();
    prepareButtons();
    root.classList.add('home-motion-ready');
    if (reducedMotion) root.classList.add('home-reduced-motion');
    observeSections(sections);
    bindHeroScroll(heroLines);
    playCurtain();
    window.addEventListener('pagehide', cleanup, { once: true });
  } catch (error) {
    root.classList.remove('home-motion-ready', 'home-intro-running');
    delete root.dataset.homeMotionInitialized;
    curtain?.remove();
    console.warn('Homepage motion enhancement was skipped.', error);
  }
})();
