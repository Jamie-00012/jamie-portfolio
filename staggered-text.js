(function initStaggeredTextModule(globalScope) {
  const DEFAULTS = Object.freeze({
    segmentBy: 'words',
    delay: 80,
    duration: 0.6,
    threshold: 0.1,
    rootMargin: '0px',
    direction: 'top',
    blur: true,
    staggerDirection: 'forward',
    respectReducedMotion: true,
    exitOnScrollOut: false,
  });

  function segmentText(text, language = 'en') {
    const chunks = text.split(/(\s+)/u).filter(Boolean);
    const hasChinese = /[\u3400-\u9fff]/u.test(text);

    if (!hasChinese || typeof Intl === 'undefined' || !Intl.Segmenter) return chunks;

    const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
    return chunks.flatMap((chunk) => {
      if (/^\s+$/u.test(chunk) || !/[\u3400-\u9fff]/u.test(chunk)) return [chunk];
      return [...segmenter.segment(chunk)].map(({ segment }) => segment);
    });
  }

  function getSegmentDelay(index) {
    return index * DEFAULTS.delay;
  }

  function enhanceDocument(documentRef) {
    const roots = [...documentRef.querySelectorAll('.global-site-header, #main')];
    if (!roots.length) return [];

    const containers = new Map();
    const ignoredSelector = 'script, style, noscript, template, [aria-hidden="true"], .visually-hidden';
    const containerSelector = 'h1, h2, h3, h4, p, a, button, span, time, small, strong, b, figcaption, li, dt, dd, label';

    roots.forEach((root) => {
      const walker = documentRef.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          if (node.parentElement?.closest('[data-static-section]')
            && !node.parentElement?.closest('[data-staggered-copy]')) return NodeFilter.FILTER_REJECT;
          if (node.parentElement?.closest(ignoredSelector)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach((node) => {
        const container = node.parentElement.closest(containerSelector) || node.parentElement;
        if (!containers.has(container)) containers.set(container, []);
        containers.get(container).push(node);
      });
    });

    containers.forEach((textNodes, container) => {
      let segmentIndex = 0;
      container.dataset.staggeredText = '';

      textNodes.forEach((textNode) => {
        const fragment = documentRef.createDocumentFragment();
        segmentText(textNode.textContent, documentRef.documentElement.lang || 'en').forEach((part) => {
          if (/^\s+$/u.test(part)) {
            fragment.append(documentRef.createTextNode(part));
            return;
          }
          const segment = documentRef.createElement('span');
          segment.className = 'staggered-text-segment';
          segment.textContent = part;
          segment.style.setProperty('--stagger-delay', getSegmentDelay(segmentIndex) + 'ms');
          segmentIndex += 1;
          fragment.append(segment);
        });
        textNode.replaceWith(fragment);
      });
    });

    const elements = [...containers.keys()];
    const reduceMotion = DEFAULTS.respectReducedMotion
      && globalScope.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    documentRef.documentElement.classList.add('staggered-text-enabled');
    if (reduceMotion || !('IntersectionObserver' in globalScope)) {
      elements.forEach((element) => element.classList.add('is-staggered-visible'));
      return elements;
    }

    const observer = new globalScope.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-staggered-visible');
        if (!DEFAULTS.exitOnScrollOut) observer.unobserve(entry.target);
      });
    }, { threshold: DEFAULTS.threshold, rootMargin: DEFAULTS.rootMargin });

    elements.forEach((element) => observer.observe(element));
    return elements;
  }

  const api = { DEFAULTS, segmentText, getSegmentDelay, enhanceDocument };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (globalScope.document) {
    globalScope.JamieStaggeredText = api;
    const start = () => enhanceDocument(globalScope.document);
    if (globalScope.document.readyState === 'loading' && !globalScope.document.body) {
      globalScope.document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
}(typeof window !== 'undefined' ? window : globalThis));
