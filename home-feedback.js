(() => {
  const header = document.querySelector('.global-site-header');
  const links = [...header.querySelectorAll('nav a')];
  const sections = ['home', 'about', 'works', 'works-secondary', 'contact']
    .map(id => document.getElementById(id)).filter(Boolean);
  let pending = false;
  const updateNavigation = () => {
    pending = false;
    const line = header.getBoundingClientRect().bottom + 32;
    let current = sections[0]?.id;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) current = section.id;
    }
    if (current === 'works-secondary') current = 'works';
    for (const link of links) {
      if (link.hash === `#${current}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  const schedule = () => {
    if (!pending) { pending = true; requestAnimationFrame(updateNavigation); }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  updateNavigation();

  const phoneButton = document.querySelector('.copy-phone');
  const phoneStatus = document.querySelector('.copy-phone-status');
  let phoneTimer;
  phoneButton.addEventListener('click', async () => {
    clearTimeout(phoneTimer);
    phoneButton.disabled = true;
    phoneStatus.textContent = '';
    try {
      await navigator.clipboard.writeText(phoneButton.dataset.phone);
      phoneStatus.textContent = '号码已复制（含空格）';
    } catch {
      phoneStatus.textContent = '请选中号码手动复制';
    } finally {
      phoneButton.disabled = false;
      phoneTimer = setTimeout(() => { phoneStatus.textContent = ''; }, 5000);
    }
  });

  const button = document.querySelector('.copy-email');
  const status = document.querySelector('.copy-email-status');
  let resetTimer;
  button.addEventListener('click', async () => {
    clearTimeout(resetTimer);
    button.disabled = true;
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(button.dataset.email);
      button.textContent = '已复制';
      status.textContent = '邮箱已复制，可以粘贴到邮件或聊天中。';
    } catch {
      button.textContent = '重新复制';
      status.textContent = '复制未成功，请长按或选中上方邮箱手动复制。';
    } finally {
      button.disabled = false;
      resetTimer = setTimeout(() => { button.textContent = '复制邮箱'; status.textContent = ''; }, 5000);
    }
  });
})();
