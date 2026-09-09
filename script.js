const revealItems = [...document.querySelectorAll('.reveal, .reveal-text')]
  .filter((item) => !item.closest('[data-static-section]'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ScrollReveal-style word animation for the homepage experience copy.
const scrollRevealCopies = [...document.querySelectorAll('#experience .experience-scroll-copy, #contact .closing-scroll-copy')]
  .filter((item) => !item.closest('[data-static-section]'));
const prepareScrollRevealCopy = (element) => {
  if (element.dataset.scrollRevealReady) return;
  element.dataset.scrollRevealReady = 'true';
  const text = element.textContent.trim();
  const fragment = document.createDocumentFragment();
  const parts = text.match(/[\u4e00-\u9fff]|[^\s\u4e00-\u9fff]+|\s+/g) || [];
  let wordIndex = 0;
  parts.forEach((part) => {
    if (/^\s+$/.test(part)) {
      fragment.appendChild(document.createTextNode(part));
      return;
    }
    const word = document.createElement('span');
    word.className = 'scroll-reveal-word';
    word.textContent = part;
    word.style.setProperty('--scroll-reveal-index', String(wordIndex));
    wordIndex += 1;
    word.style.setProperty('--scroll-reveal-progress', '0');
    word.style.setProperty('--scroll-reveal-blur', '6px');
    fragment.appendChild(word);
  });
  element.replaceChildren(fragment);
};

scrollRevealCopies.forEach(prepareScrollRevealCopy);

if (scrollRevealCopies.length) {
  const words = scrollRevealCopies.flatMap((copy) => [...copy.querySelectorAll('.scroll-reveal-word')]);
  const updateScrollReveal = () => {
    if (reduceMotion) {
      words.forEach((word) => {
        word.style.setProperty('--scroll-reveal-progress', '1');
        word.style.setProperty('--scroll-reveal-blur', '0px');
      });
      return;
    }
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    words.forEach((word) => {
      const rect = word.getBoundingClientRect();
      const center = rect.top + rect.height * 0.5;
      const progress = Math.max(0, Math.min(1, (viewportHeight * 0.88 - center) / (viewportHeight * 0.42)));
      word.style.setProperty('--scroll-reveal-progress', progress.toFixed(3));
      word.style.setProperty('--scroll-reveal-blur', `${((1 - progress) * 6).toFixed(2)}px`);
    });
  };
  let revealFrame = 0;
  const requestScrollRevealUpdate = () => {
    if (revealFrame) return;
    revealFrame = requestAnimationFrame(() => {
      revealFrame = 0;
      updateScrollReveal();
    });
  };
  updateScrollReveal();
  window.addEventListener('scroll', requestScrollRevealUpdate, { passive: true });
  window.addEventListener('resize', requestScrollRevealUpdate, { passive: true });
}

// Subtle hero parallax: pointer and scroll adjust only the background layer.
const hero = document.querySelector('#home.blue-ink-hero');
if (hero && !reduceMotion) {
  let pointerX = 0;
  let pointerY = 0;
  let heroFrame = 0;
  const updateHeroMotion = () => {
    heroFrame = 0;
    const rect = hero.getBoundingClientRect();
    const visibility = Math.max(0, Math.min(1, 1 - Math.abs(rect.top) / Math.max(1, window.innerHeight)));
    const scrollShift = Math.max(-18, Math.min(18, -rect.top * 0.018));
    hero.style.setProperty('--hero-parallax-x', `${(pointerX * 10 * visibility).toFixed(2)}px`);
    hero.style.setProperty('--hero-parallax-y', `${(pointerY * 8 * visibility).toFixed(2)}px`);
    hero.style.setProperty('--hero-scroll-shift', `${scrollShift.toFixed(2)}px`);
  };
  const requestHeroMotion = () => {
    if (heroFrame) return;
    heroFrame = requestAnimationFrame(updateHeroMotion);
  };
  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    requestHeroMotion();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    pointerX = 0;
    pointerY = 0;
    requestHeroMotion();
  }, { passive: true });
  window.addEventListener('scroll', requestHeroMotion, { passive: true });
  window.addEventListener('resize', requestHeroMotion, { passive: true });
  updateHeroMotion();
}

if (reduceMotion) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

// Variable-proximity lettering for every page-level H1 and H2. The individual
// letters stay in their original layout; only their local width/weight
// responds to the pointer.
if (!reduceMotion) {
  const titleLetters = [];
  const h1Titles = [...document.querySelectorAll('h1, h2')]
    .filter((title) => !title.closest('[data-static-section]'));

  h1Titles.forEach((title) => {
    if (title.dataset.proximityReady) return;
    title.dataset.proximityReady = 'true';
    title.classList.add('variable-proximity-title');
    title.setAttribute('aria-label', title.innerText.replace(/\s+/g, ' ').trim());

    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const textNodes = [];
    let currentNode;
    while ((currentNode = walker.nextNode())) textNodes.push(currentNode);

    textNodes.forEach((textNode) => {
      const fragment = document.createDocumentFragment();
      [...textNode.nodeValue].forEach((character) => {
        if (/\s/.test(character)) {
          fragment.appendChild(document.createTextNode(character));
          return;
        }
        const letter = document.createElement('span');
        letter.className = 'vp-letter';
        letter.setAttribute('aria-hidden', 'true');
        letter.textContent = character;
        fragment.appendChild(letter);
        titleLetters.push(letter);
      });
      textNode.replaceWith(fragment);
    });
  });

  let pointer = { x: -1000, y: -1000 };
  let framePending = false;
  const radius = 120;
  const updateLetters = () => {
    framePending = false;
    titleLetters.forEach((letter) => {
      const rect = letter.getBoundingClientRect();
      const distance = Math.hypot(pointer.x - (rect.left + rect.width / 2), pointer.y - (rect.top + rect.height / 2));
      const influence = Math.max(0, 1 - distance / radius);
      const eased = influence * influence * (3 - 2 * influence);
      letter.style.setProperty('--vp-weight', `${650 + eased * 220}`);
      letter.style.setProperty('--vp-width', `${100 + eased * 11}`);
      letter.style.setProperty('--vp-scale', `${1 + eased * 0.08}`);
      letter.style.setProperty('--vp-lift', `${eased * -1.5}px`);
    });
  };
  window.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (!framePending) {
      framePending = true;
      requestAnimationFrame(updateLetters);
    }
  }, { passive: true });
}

const studioLab = document.querySelector('.studio-lab');
if (studioLab) {
  const composer = studioLab.querySelector('[data-lab-composer]');
  const visual = studioLab.querySelector('[data-lab-visual]');
  const input = studioLab.querySelector('[data-lab-input]');
  const image = studioLab.querySelector('[data-lab-image]');
  const status = studioLab.querySelector('[data-lab-status]');
  const index = studioLab.querySelector('[data-lab-index]');
  const caption = studioLab.querySelector('[data-lab-caption]');
  const note = studioLab.querySelector('[data-lab-note]');
  const materials = {
    woven: { image: 'assets/mate-x6-sunset-product.png', alt: '日落渐变中的芳纶纤维手机壳视觉实验', caption: 'Woven light / quiet warmth', note: 'Kevlar fiber · sunset gradient', index: '01' },
    aluminum: { image: 'assets/aluminum-precision/3.webp', alt: '航空级铝材的精密结构视觉实验', caption: 'Precision metal / clear balance', note: 'Aerospace aluminum · smooth hover', index: '02' },
    soft: { image: 'assets/concept-scene.jpg', alt: '亲肤材质与柔和光线的产品视觉实验', caption: 'Soft touch / measured calm', note: 'Soft-touch surface · tactile light', index: '03' }
  };

  studioLab.querySelectorAll('[data-material]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = materials[button.dataset.material];
      if (!selected) return;
      studioLab.querySelectorAll('[data-material]').forEach((item) => item.classList.toggle('is-active', item === button));
      visual.dataset.material = button.dataset.material;
      image.src = selected.image;
      image.alt = selected.alt;
      caption.textContent = selected.caption;
      note.textContent = selected.note;
      index.textContent = selected.index;
      status.textContent = 'Direction selected';
      visual.classList.remove('is-rendering');
    });
  });

  studioLab.querySelectorAll('[data-lab-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.labAction === 'tone' ? 'Warm contrast' : 'Structural clarity';
      status.textContent = mode;
      composer.dataset.mode = button.dataset.labAction;
      visual.classList.remove('is-rendering');
    });
  });

  input.addEventListener('input', () => {
    status.textContent = input.value.trim() ? 'Draft updated' : 'Ready to compose';
  });

  studioLab.querySelector('[data-lab-render]').addEventListener('click', () => {
    status.textContent = 'Rendering direction';
    visual.classList.remove('is-rendering');
    requestAnimationFrame(() => visual.classList.add('is-rendering'));
    window.setTimeout(() => {
      visual.classList.remove('is-rendering');
      status.textContent = 'Direction rendered';
    }, 1200);
  });

  visual.addEventListener('pointermove', (event) => {
    const rect = visual.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    image.style.transform = `scale(1.04) translate(${x * -8}px, ${y * -8}px)`;
  });
  visual.addEventListener('pointerleave', () => { image.style.transform = ''; });
}

if (!reduceMotion) {
  document.querySelectorAll('.benefits-accordion, .strategy-accordion').forEach((accordion) => {
    const panels = Array.from(accordion.children);
    const isStrategyAccordion = accordion.classList.contains('strategy-accordion');
    const defaultLabel = isStrategyAccordion ? '视觉策略' : '产品卖点';

    const activatePanel = (index) => {
      accordion.classList.add('is-interacting');
      panels.forEach((panel, panelIndex) => {
        const isActive = panelIndex === index;
        panel.classList.toggle('is-active', isActive);
        panel.setAttribute('aria-expanded', String(isActive));
      });
    };

    panels.forEach((panel, index) => {
      const image = panel.querySelector('img');
      const label = panel.querySelector('h3, figcaption')?.textContent?.trim() || image?.alt || `${defaultLabel} ${index + 1}`;
      panel.classList.add('accordion-panel');
      panel.tabIndex = 0;
      panel.setAttribute('role', 'button');
      panel.setAttribute('aria-label', label);
      panel.setAttribute('aria-expanded', 'false');
      if (isStrategyAccordion) {
        // Pointer movement makes the strategy gallery deliberate, so scroll arrival keeps its original four-up layout.
        panel.addEventListener('pointermove', () => activatePanel(index), { once: true });
      } else {
        panel.addEventListener('pointerenter', () => activatePanel(index));
      }
      panel.addEventListener('focus', () => activatePanel(index));
      panel.addEventListener('click', () => activatePanel(index));
      panel.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          panels[(index + 1) % panels.length].focus();
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          panels[(index - 1 + panels.length) % panels.length].focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activatePanel(index);
        }
      });
    });
  });
}

// Keep the selected-work position when a project detail returns to the homepage.
const worksScrollKey = 'jamie-portfolio:works-scroll-y';
document.querySelectorAll('#works a[href], #works-secondary a[href]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    try { sessionStorage.setItem(worksScrollKey, String(window.scrollY)); } catch { /* Anchor navigation remains available without storage. */ }
  });
});

const restoreWorksPosition = () => {
  if (!['#works', '#works-secondary'].includes(location.hash)) return;
  let storedValue;
  try {
    storedValue = sessionStorage.getItem(worksScrollKey);
    sessionStorage.removeItem(worksScrollKey);
  } catch { return; }
  if (storedValue === null) return;
  const storedPosition = Number(storedValue);
  if (!Number.isFinite(storedPosition)) return;
  requestAnimationFrame(() => window.scrollTo({ top: storedPosition, behavior: 'instant' }));
};

restoreWorksPosition();
window.addEventListener('pageshow', restoreWorksPosition);
