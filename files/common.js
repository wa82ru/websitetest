// 共通ヘッダー・フッター注入（多言語対応版）
(function () {
  const path = location.pathname.split('/').pop() || 'index.html';

  const navLinks = [
    { href: 'index.html',   key: 'nav.home' },
    { href: 'kankou.html',  key: 'nav.kankou' },
    { href: 'alphard.html', key: 'nav.alphard' },
    { href: 'cruise.html',  key: 'nav.cruise' },
    { href: 'ryoukin.html', key: 'nav.ryoukin' },
    { href: 'service.html', key: 'nav.service' },
    { href: 'recruit.html', key: 'nav.recruit' },
    { href: 'contact.html', key: 'nav.contact' },
  ];

  const header = `
<header class="site-header">
  <div class="header-inner">
    <a href="index.html" class="header-logo">
      <img src="images/logo.png" alt="株式会社 山元交通" style="height:36px;width:auto;">
      <span class="header-logo-sub" data-i18n="header.logo.sub"></span>
    </a>
    <div class="header-right">
      <div class="lang-switcher">
        <button class="lang-btn-item" data-lang="ja" onclick="applyLang('ja')">JP</button>
        <button class="lang-btn-item" data-lang="en" onclick="applyLang('en')">EN</button>
        <button class="lang-btn-item" data-lang="zh" onclick="applyLang('zh')">中文</button>
        <button class="lang-btn-item" data-lang="ko" onclick="applyLang('ko')">한국어</button>
      </div>
      <div class="header-tel">
        <span class="header-tel-label" data-i18n="header.dispatch">配車</span>
        <a href="tel:0992555555" style="color:#fff" data-i18n="header.tel">099-255-5555</a>
      </div>
    </div>
  </div>
</header>
<nav class="site-nav">
  <div class="nav-inner">
    ${navLinks.map(l =>
      `<a href="${l.href}" class="${path === l.href ? 'active' : ''}" data-i18n="${l.key}"></a>`
    ).join('')}
  </div>
</nav>`;

  const footer = `
<footer class="site-footer">
  <div class="footer-inner">
    <div>
      <div class="footer-brand"><img src="images/logo.png" alt="株式会社 山元交通" style="height:28px;width:auto;filter:brightness(1.8);"></div>
      <div class="footer-info" data-i18n="footer.info">
        〒890-0073 鹿児島県鹿児島市南郡元町24-6<br>
        配車センター: <a href="tel:0992555555" style="color:rgba(255,255,255,0.5)">099-255-5555</a>（24時間）<br>
        観光・予約: <a href="tel:0992580085" style="color:rgba(255,255,255,0.5)">099-258-0085</a><br>
        Email: <a href="mailto:info@yamamoto-koutsuu.jp" style="color:rgba(255,255,255,0.5)">info@yamamoto-koutsuu.jp</a>
      </div>
    </div>
    <div class="footer-links">
      ${navLinks.map(l => `<a href="${l.href}" data-i18n="${l.key}"></a>`).join('')}
    </div>
  </div>
  <div class="footer-copy">Copyright © 2026 株式会社 山元交通 All Rights Reserved.</div>
</footer>`;

  document.getElementById('site-header').innerHTML = header;
  document.getElementById('site-footer').innerHTML = footer;

  // i18n初期化（DOM注入後に確実に実行）
  setTimeout(function() {
    if (typeof initI18n === 'function') initI18n();
  }, 0);
})();
