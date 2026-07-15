const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const mdPath = path.join(__dirname, 'graphics_physics_math_physics_handbook.md');
const htmlPath = path.join(__dirname, 'index.html');
const robotsPath = path.join(__dirname, 'robots.txt');
const sitemapPath = path.join(__dirname, 'sitemap.xml');

const SITE = {
  url: 'https://dev-math.log-trace.net/',
  title: '수학·물리 핸드북 — 그래픽스/물리엔진 개발자를 위한 게임 수학 정리',
  description:
    '게임 그래픽스와 물리엔진 개발에 필요한 벡터, 내적, 외적, 행렬, 쿼터니언, 충돌 판정, 물리 시뮬레이션 공식을 "왜 이 공식이 나오는지"부터 그림과 인터랙티브 시각화로 정리한 무료 한국어 핸드북입니다.',
  keywords: [
    '게임 수학', '게임 물리', '그래픽스 수학', '물리엔진',
    '벡터', '내적', '외적', '정규화', '행렬', '쿼터니언',
    '충돌 판정', '선형대수', '게임 개발 수학', 'game math', 'game physics'
  ].join(', '),
  author: 'Cheongha Kim',
  datePublished: '2026-07-10',
  ogImage: 'images/og-image.png',
  locale: 'ko_KR'
};

const mdContent = fs.readFileSync(mdPath, 'utf8');
const lastMod = fs.statSync(mdPath).mtime.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Markdown -> HTML (build time)
//
// The viewer used to ship the raw markdown inside a JS string and parse it in
// the browser, which left the served HTML empty of text — crawlers saw a blank
// page. Everything below renders to real HTML here so index.html is crawlable
// and paints without waiting on JS.
// ---------------------------------------------------------------------------

// Math is pulled out before marked runs and put back afterwards, so marked
// never mangles TeX (e.g. underscores turning into <em>). MathJax picks the
// delimiters back up on the client.
const mathBlocks = [];
let processedText = mdContent
  .replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    const id = `%%BLOCK_MATH_${mathBlocks.length}%%`;
    mathBlocks.push({ id, math, display: true });
    return id;
  })
  .replace(/\$([^$\n]+?)\$/g, (_, math) => {
    const id = `%%INLINE_MATH_${mathBlocks.length}%%`;
    mathBlocks.push({ id, math, display: false });
    return id;
  });

const toc = [];
const renderer = new marked.Renderer();

renderer.blockquote = function (token) {
  const body = this.parser.parse(token.tokens);
  if (body.includes('[!NOTE]')) {
    return '<div class="alert alert-note">' + body.replace('[!NOTE]', '<strong>NOTE:</strong>') + '</div>';
  }
  if (body.includes('[!WARNING]')) {
    return '<div class="alert alert-warning">' + body.replace('[!WARNING]', '<strong>WARNING:</strong>') + '</div>';
  }
  return '<blockquote>' + body + '</blockquote>';
};

// h2 anchors keep the historical `heading-N` scheme so existing deep links and
// bookmarks still resolve.
renderer.heading = function (token) {
  const depth = token.depth;
  const inner = this.parser.parseInline(token.tokens);
  if (depth !== 2) {
    return `<h${depth}>${inner}</h${depth}>\n`;
  }
  const id = `heading-${toc.length}`;
  toc.push({ id, text: token.text });
  return `<h2 id="${id}">${inner}</h2>\n`;
};

marked.setOptions({ renderer, gfm: true, breaks: true });

let contentHtml = marked.parse(processedText);
mathBlocks.forEach(({ id, math, display }) => {
  const delimiter = display ? '$$' : '$';
  // The replacement must be a function: as a string, `$$` is the escape for a
  // literal `$`, which would silently downgrade every display equation to inline.
  contentHtml = contentHtml.replace(id, () => delimiter + math + delimiter);
});

// `breaks: true` turns the newline between two stacked display equations into a
// <br>, which then prints as an empty line between two block-level formulas.
contentHtml = contentHtml.replace(/\$\$\s*<br>\s*\$\$/g, () => '$$\n$$');

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const tocHtml = toc
  .map((h) => `      <li class="toc-item"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
  .join('\n');

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': SITE.url + '#website',
      url: SITE.url,
      name: SITE.title,
      description: SITE.description,
      inLanguage: 'ko'
    },
    {
      '@type': 'Book',
      '@id': SITE.url + '#book',
      name: '그래픽스/물리엔진 개발자를 위한 수학·물리 핸드북',
      url: SITE.url,
      description: SITE.description,
      inLanguage: 'ko',
      bookFormat: 'https://schema.org/EBook',
      isAccessibleForFree: true,
      image: SITE.url + SITE.ogImage,
      datePublished: SITE.datePublished,
      dateModified: lastMod,
      author: { '@type': 'Person', name: SITE.author },
      publisher: { '@type': 'Person', name: SITE.author },
      about: ['게임 수학', '컴퓨터 그래픽스', '물리 시뮬레이션', '선형대수'],
      hasPart: toc.slice(0, 40).map((h) => ({
        '@type': 'Chapter',
        name: h.text,
        url: SITE.url + '#' + h.id
      }))
    }
  ]
};

const htmlTemplate = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- SEO -->
  <title>${escapeHtml(SITE.title)}</title>
  <meta name="description" content="${escapeHtml(SITE.description)}">
  <meta name="keywords" content="${escapeHtml(SITE.keywords)}">
  <meta name="author" content="${escapeHtml(SITE.author)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="#0f172a">
  <link rel="canonical" href="${SITE.url}">

  <!-- Open Graph -->
  <meta property="og:type" content="book">
  <meta property="og:site_name" content="수학·물리 핸드북">
  <meta property="og:locale" content="${SITE.locale}">
  <meta property="og:url" content="${SITE.url}">
  <meta property="og:title" content="${escapeHtml(SITE.title)}">
  <meta property="og:description" content="${escapeHtml(SITE.description)}">
  <meta property="og:image" content="${SITE.url}${SITE.ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(SITE.title)}">
  <meta name="twitter:description" content="${escapeHtml(SITE.description)}">
  <meta name="twitter:image" content="${SITE.url}${SITE.ogImage}">

  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- MathJax for rendering math formulas -->
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']],
        processEscapes: true
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      }
    };
  </script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>

  <!-- Prism.js for syntax highlighting -->
  <link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>

  <style>
    :root {
      --bg-base: #0f172a;
      --bg-surface: #1e293b;
      --bg-sidebar: #0b0f19;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-title: 'Outfit', var(--font-sans);
      --font-mono: 'Fira Code', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      /* Firefox scrollbar */
      scrollbar-width: thin;
      scrollbar-color: #334155 var(--bg-sidebar);
    }

    /* Custom Webkit Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-sidebar);
    }

    ::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 4px;
      border: 1px solid var(--bg-sidebar);
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--accent);
    }

    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.7;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar (Table of Contents) */
    .sidebar {
      width: 320px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      height: 100%;
      overflow-y: auto;
      padding: 2rem 1.5rem;
    }

    .sidebar-title {
      font-family: var(--font-title);
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .toc-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .toc-item a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      transition: all 0.2s ease;
      display: block;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .toc-item a:hover {
      color: var(--accent-hover);
      background-color: rgba(59, 130, 246, 0.1);
      padding-left: 0.8rem;
    }

    .toc-item.active a {
      color: #fff;
      background-color: var(--accent);
      font-weight: 600;
    }

    /* Main Content Area */
    .main-container {
      flex-grow: 1;
      height: 100%;
      overflow-y: auto;
      scroll-behavior: smooth;
      display: flex;
      justify-content: center;
      padding: 3rem 2rem;
      position: relative;
    }

    .content-wrapper {
      max-width: 850px;
      width: 100%;
    }

    /* Markdown Styling */
    .markdown-body h1 {
      font-family: var(--font-title);
      font-size: 2.2rem;
      margin-top: 2.5rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
      color: #fff;
    }

    .markdown-body h2 {
      font-family: var(--font-title);
      font-size: 1.6rem;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #e2e8f0;
      scroll-margin-top: 2rem;
    }

    .markdown-body h3 {
      font-family: var(--font-title);
      font-size: 1.25rem;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #cbd5e1;
    }

    .markdown-body p {
      margin-bottom: 1.25rem;
      color: #cbd5e1;
    }

    .markdown-body a {
      color: var(--accent-hover);
      text-decoration: none;
    }

    .markdown-body a:hover {
      text-decoration: underline;
    }

    /* SVG Diagram wrapper */
    .markdown-body img {
      max-width: 100%;
      height: auto;
      background-color: #fff;
      border-radius: 12px;
      padding: 1rem;
      margin: 1.5rem 0;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      display: block;
      transition: transform 0.3s ease;
    }

    .markdown-body img:hover {
      transform: scale(1.02);
      cursor: zoom-in;
    }

    .markdown-body code {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      background-color: #1e293b;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #38bdf8;
    }

    .markdown-body pre {
      margin-bottom: 1.5rem;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid var(--border);
    }

    .markdown-body pre code {
      background-color: transparent;
      padding: 0;
      color: inherit;
    }

    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.5rem;
      font-size: 0.95rem;
    }

    .markdown-body th, .markdown-body td {
      border: 1px solid var(--border);
      padding: 0.75rem 1rem;
      text-align: left;
    }

    .markdown-body th {
      background-color: #1e293b;
      color: #fff;
      font-weight: 600;
    }

    .markdown-body tr:nth-child(even) {
      background-color: rgba(255, 255, 255, 0.02);
    }

    .markdown-body blockquote {
      border-left: 4px solid var(--accent);
      padding-left: 1.5rem;
      color: var(--text-muted);
      font-style: italic;
      margin: 1.5rem 0;
    }

    /* GitHub style alerts */
    .markdown-body .alert {
      padding: 1rem;
      border-left: 4px solid;
      border-radius: 4px;
      margin: 1.5rem 0;
      background-color: rgba(255, 255, 255, 0.02);
    }

    .markdown-body .alert-note {
      border-left-color: #3b82f6;
      background-color: rgba(59, 130, 246, 0.05);
    }

    .markdown-body .alert-warning {
      border-left-color: #f59e0b;
      background-color: rgba(245, 158, 11, 0.05);
    }

    /* Modal for zoom */
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(15, 23, 42, 0.95);
      justify-content: center;
      align-items: center;
      cursor: zoom-out;
    }

    .modal-content {
      position: relative;
      max-width: 90%;
      max-height: 90%;
      background-color: #fff;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    .modal-content img {
      max-width: 100%;
      max-height: 80vh;
      display: block;
    }

    .modal-close {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 2.5rem;
      height: 2.5rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--text-main);
      background: var(--bg-surface);
      font-size: 1.35rem;
      cursor: pointer;
    }

    .modal-close:focus-visible {
      outline: 3px solid var(--accent-hover);
      outline-offset: 2px;
    }

    /* Interactive Widget Styles */
    .widget-container {
      background-color: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin: 2rem 0;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .widget-title {
      font-family: var(--font-title);
      font-size: 1.1rem;
      font-weight: 600;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .widget-canvas {
      background-color: #0b0f19;
      border-radius: 8px;
      border: 1px solid var(--border);
      cursor: crosshair;
      max-width: 100%;
      touch-action: none;
    }

    .widget-info {
      font-size: 0.9rem;
      color: var(--text-muted);
      text-align: center;
      line-height: 1.5;
      font-family: var(--font-mono);
      background-color: rgba(15, 23, 42, 0.5);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      width: 100%;
    }

    .widget-info strong {
      color: #fff;
    }

    .widget-slider-container {
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
    }

    .widget-slider {
      flex-grow: 1;
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      outline: none;
      -webkit-appearance: none;
    }

    .widget-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .widget-slider::-webkit-slider-thumb:hover {
      background: var(--accent-hover);
    }

    /* Long display equations must not widen the page. */
    mjx-container[display] {
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0.25rem 0;
    }

    /* Mobile header + off-canvas drawer. Hidden on desktop, where the sidebar
       is a permanent column. */
    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 150;
      align-items: center;
      gap: 0.75rem;
      height: 56px;
      padding: 0 1rem;
      background-color: var(--bg-sidebar);
      border-bottom: 1px solid var(--border);
    }

    .menu-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      font-size: 1.25rem;
      color: var(--text-main);
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
    }

    .menu-toggle:hover {
      border-color: var(--accent);
      color: var(--accent-hover);
    }

    .mobile-title {
      font-family: var(--font-title);
      font-weight: 700;
      font-size: 1rem;
      color: #fff;
    }

    .sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 190;
      background-color: rgba(15, 23, 42, 0.7);
    }

    .sidebar-backdrop.open {
      display: block;
    }

    @media (max-width: 900px) {
      .mobile-header {
        display: flex;
      }

      /* The drawer leaves the flow, so the article gets the full width. The
         body stays a fixed-height flex box so .main-container remains the
         scroll container the scroll-spy listens to. */
      .sidebar {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        z-index: 200;
        width: min(85vw, 320px);
        padding: 1.5rem 1.25rem;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .main-container {
        padding: calc(56px + 1.5rem) 1.25rem 3rem;
      }

      .markdown-body h1 {
        font-size: 1.7rem;
        margin-top: 2rem;
      }

      .markdown-body h2 {
        font-size: 1.35rem;
        scroll-margin-top: 1rem;
      }

      .markdown-body h3 {
        font-size: 1.1rem;
      }

      /* Wide tables scroll inside themselves rather than stretching the page. */
      .markdown-body table {
        display: block;
        overflow-x: auto;
        white-space: nowrap;
      }

      .markdown-body img {
        padding: 0.5rem;
      }

      .markdown-body img:hover {
        transform: none;
      }

      .widget-container {
        padding: 1rem;
      }

      .modal-content {
        max-width: 95%;
        padding: 1rem;
      }
    }

    /* Printable handbook layout. The screen viewer intentionally uses a
       fixed viewport with an independently scrolling article; printing must
       restore normal document flow or Chromium only emits one page. */
    @media print {
      @page {
        size: A4;
        margin: 14mm 13mm 16mm;
      }

      html, body {
        width: auto;
        height: auto;
        overflow: visible;
        display: block;
        background: #fff;
        color: #111827;
      }

      .sidebar,
      .mobile-header,
      .sidebar-backdrop,
      .widget-slider-container {
        display: none !important;
      }

      .main-container {
        display: block;
        height: auto;
        overflow: visible;
        padding: 0;
      }

      .content-wrapper {
        max-width: none;
        width: auto;
      }

      .markdown-body,
      .markdown-body p,
      .markdown-body li,
      .markdown-body td,
      .markdown-body th {
        color: #111827;
      }

      .markdown-body h1,
      .markdown-body h2,
      .markdown-body h3,
      .markdown-body h4 {
        color: #0f172a;
        break-after: avoid-page;
      }

      .markdown-body h1:not(:first-child) {
        break-before: page;
      }

      .markdown-body pre,
      .markdown-body blockquote,
      .markdown-body table,
      .markdown-body img,
      .interactive-widget {
        break-inside: avoid-page;
      }

      .markdown-body pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
      }

      .markdown-body code {
        color: #0f172a;
      }

      .markdown-body a {
        color: #1d4ed8;
        text-decoration: none;
      }

      .markdown-body img,
      .markdown-body svg,
      .markdown-body canvas {
        max-width: 100%;
        height: auto;
      }
    }
  </style>
</head>
<body>

  <header class="mobile-header">
    <button class="menu-toggle" id="menu-toggle" aria-label="목차 열기" aria-expanded="false" aria-controls="sidebar">☰</button>
    <span class="mobile-title">📐 수학·물리 핸드북</span>
  </header>

  <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

  <nav class="sidebar" id="sidebar" aria-label="목차">
    <div class="sidebar-title">📐 수학·물리 핸드북</div>
    <ul class="toc-list" id="toc">
${tocHtml}
    </ul>
  </nav>

  <main class="main-container">
    <div class="content-wrapper">
      <article class="markdown-body" id="content">
${contentHtml}
      </article>
    </div>
  </main>

  <div class="modal" id="modal" role="dialog" aria-modal="true" aria-label="확대된 다이어그램" aria-hidden="true">
    <div class="modal-content">
      <button class="modal-close" id="modal-close" type="button" aria-label="확대 이미지 닫기">×</button>
      <img id="modal-img" src="" alt="">
    </div>
  </div>

  <script>
    // Content is pre-rendered at build time (generate_viewer.js); this script
    // only wires up the interactive layer.
    const headings = document.querySelectorAll('#content h2');

    // Code highlighting setup
    Prism.highlightAll();

    // Modal view for SVGs
    const images = document.querySelectorAll('.markdown-body img');
    const modal = document.getElementById('modal');
    const modalImg = document.getElementById('modal-img');
    const modalClose = document.getElementById('modal-close');
    let modalTrigger = null;

    function openModal(img) {
      modalTrigger = img;
      modalImg.src = img.src;
      modalImg.alt = img.alt;
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      modalClose.focus();
    }

    images.forEach(img => {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-haspopup', 'dialog');
      img.addEventListener('click', () => openModal(img));
      img.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openModal(img);
        }
      });
    });

    function closeModal() {
      if (modal.getAttribute('aria-hidden') === 'true') return;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      modalImg.src = '';
      modalTrigger?.focus();
      modalTrigger = null;
    }

    modal.addEventListener('click', closeModal);
    modal.querySelector('.modal-content').addEventListener('click', (event) => event.stopPropagation());
    modalClose.addEventListener('click', closeModal);

    // Mobile drawer
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const menuToggle = document.getElementById('menu-toggle');

    function setDrawer(open) {
      sidebar.classList.toggle('open', open);
      backdrop.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? '목차 닫기' : '목차 열기');
    }

    menuToggle.addEventListener('click', () => setDrawer(!sidebar.classList.contains('open')));
    backdrop.addEventListener('click', () => setDrawer(false));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setDrawer(false);
        closeModal();
      } else if (e.key === 'Tab' && modal.getAttribute('aria-hidden') === 'false') {
        e.preventDefault();
        modalClose.focus();
      }
    });

    // Scroll spy for active TOC item
    const tocLinks = document.querySelectorAll('.toc-item a');
    const mainContainer = document.querySelector('.main-container');

    // Picking a section should reveal it, not leave the drawer covering it.
    tocLinks.forEach(link => link.addEventListener('click', () => setDrawer(false)));

    mainContainer.addEventListener('scroll', () => {
      let currentActive = '';
      headings.forEach(heading => {
        const top = heading.getBoundingClientRect().top;
        if (top < 150) {
          currentActive = heading.id;
        }
      });

      tocLinks.forEach(link => {
        const li = link.parentElement;
        if (link.getAttribute('href') === '#' + currentActive) {
          li.classList.add('active');
        } else {
          li.classList.remove('active');
        }
      });
    });

    // Initialize Interactive Canvases
    initWidgets();

    function initWidgets() {
      // --- 1. DOT PRODUCT WIDGET ---
      const dotDiv = document.getElementById('interactive-dot-product');
      if (dotDiv) {
        dotDiv.className = 'widget-container';
        dotDiv.innerHTML = \`
          <div class="widget-title">🔵 내적 (Dot Product) 실시간 시각화</div>
          <canvas class="widget-canvas" width="400" height="300"></canvas>
          <div class="widget-info">마우스나 터치로 주황색 벡터의 끝점을 드래그해보세요.</div>
        \`;
        const canvas = dotDiv.querySelector('canvas');
        const info = dotDiv.querySelector('.widget-info');
        setupDotProduct(canvas, info);
      }

      // --- 2. CROSS PRODUCT WIDGET ---
      const crossDiv = document.getElementById('interactive-cross-product');
      if (crossDiv) {
        crossDiv.className = 'widget-container';
        crossDiv.innerHTML = \`
          <div class="widget-title">🟢 2D 외적 (Cross Product) 실시간 시각화</div>
          <canvas class="widget-canvas" width="400" height="300"></canvas>
          <div class="widget-info">마우스나 터치로 주황색 벡터의 끝점을 드래그해보세요.</div>
        \`;
        const canvas = crossDiv.querySelector('canvas');
        const info = crossDiv.querySelector('.widget-info');
        setupCrossProduct(canvas, info);
      }

      // --- 3. LERP WIDGET ---
      const lerpDiv = document.getElementById('interactive-lerp');
      if (lerpDiv) {
        lerpDiv.className = 'widget-container';
        lerpDiv.innerHTML = \`
          <div class="widget-title">🟠 LERP (선형 보간) 실시간 시각화</div>
          <div class="widget-slider-container">
            <span style="font-size:0.9rem; font-weight:600;">t = 0.0</span>
            <input type="range" min="0" max="1" step="0.01" value="0.5" class="widget-slider" aria-label="선형 보간 비율 t">
            <span style="font-size:0.9rem; font-weight:600;">t = 1.0</span>
          </div>
          <canvas class="widget-canvas" width="400" height="150"></canvas>
          <div class="widget-info">슬라이더를 조절하여 t 값을 변화시켜보세요.</div>
        \`;
        const canvas = lerpDiv.querySelector('canvas');
        const slider = lerpDiv.querySelector('input');
        const info = lerpDiv.querySelector('.widget-info');
        setupLerp(canvas, slider, info);
      }
    }

    // Helper to draw an arrow on Canvas
    function drawArrow(ctx, fromX, fromY, toX, toY, color, width = 3) {
      const headlen = 10;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.fill();
    }

    function setupDotProduct(canvas, info) {
      const ctx = canvas.getContext('2d');
      const origin = { x: 200, y: 150 };
      const vecA = { x: 120, y: 0 };
      const vecB = { x: 80, y: -80 };

      let isDragging = false;

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y);
        ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height);
        ctx.stroke();

        const ax = vecA.x;
        const ay = vecA.y;
        const bx = vecB.x;
        const by = vecB.y;

        const lenA = Math.sqrt(ax*ax + ay*ay);
        const lenB = Math.sqrt(bx*bx + by*by);

        const dot = ax * bx + ay * by;
        const projMag = lenB > 0 ? dot / lenA : 0;
        const projX = origin.x + (ax / lenA) * projMag;
        const projY = origin.y + (ay / lenA) * projMag;

        // Draw projection line (dotted)
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(origin.x + bx, origin.y + by);
        ctx.lineTo(projX, projY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw projection vector (green)
        if (projMag !== 0) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(origin.x, origin.y);
          ctx.lineTo(projX, projY);
          ctx.stroke();
        }

        drawArrow(ctx, origin.x, origin.y, origin.x + ax, origin.y + ay, '#3b82f6', 3);
        drawArrow(ctx, origin.x, origin.y, origin.x + bx, origin.y + by, '#f97316', 3);

        ctx.fillStyle = '#3b82f6';
        ctx.font = '12px sans-serif';
        ctx.fillText('Vector A', origin.x + ax + 10, origin.y + 5);

        ctx.fillStyle = '#f97316';
        ctx.fillText('Vector B', origin.x + bx + 10, origin.y + by - 5);

        const cosTheta = lenA * lenB > 0 ? dot / (lenA * lenB) : 0;
        const angleDeg = Math.round(Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180 / Math.PI);
        let relationship = '';
        if (dot > 0.01) {
          relationship = '<span style="color:#60a5fa">같은 방향 성분 (θ &lt; 90°)</span>';
        } else if (dot < -0.01) {
          relationship = '<span style="color:#ef4444">반대 방향 성분 (θ &gt; 90°)</span>';
        } else {
          relationship = '<span style="color:#10b981">수직 관계 (θ = 90°)</span>';
        }

        info.innerHTML = \`
          A = (\${Math.round(ax)}, \${Math.round(-ay)}) | B = (\${Math.round(bx)}, \${Math.round(-by)})<br/>
          내적 a · b = ax*bx + ay*by = <strong>\${Math.round(dot)}</strong><br/>
          각도 θ = <strong>\${angleDeg}°</strong> | 상태: <strong>\${relationship}</strong>
        \`;
      }

      function updateVectorB(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * canvas.width / rect.width;
        const mouseY = (e.clientY - rect.top) * canvas.height / rect.height;
        vecB.x = mouseX - origin.x;
        vecB.y = mouseY - origin.y;
        draw();
      }

      canvas.addEventListener('pointerdown', (e) => {
        isDragging = true;
        canvas.setPointerCapture(e.pointerId);
        updateVectorB(e);
      });

      canvas.addEventListener('pointermove', (e) => {
        if (isDragging) updateVectorB(e);
      });

      const stopDragging = () => {
        isDragging = false;
      };
      canvas.addEventListener('pointerup', stopDragging);
      canvas.addEventListener('pointercancel', stopDragging);

      draw();
    }

    function setupCrossProduct(canvas, info) {
      const ctx = canvas.getContext('2d');
      const origin = { x: 200, y: 150 };
      const vecA = { x: 120, y: 0 };
      const vecB = { x: 80, y: -60 };

      let isDragging = false;

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y);
        ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height);
        ctx.stroke();

        const ax = vecA.x;
        const ay = vecA.y;
        const bx = vecB.x;
        const by = vecB.y;

        const math_ay = -ay;
        const math_by = -by;
        const cross = ax * math_by - math_ay * bx;

        drawArrow(ctx, origin.x, origin.y, origin.x + ax, origin.y + ay, '#3b82f6', 3);
        drawArrow(ctx, origin.x, origin.y, origin.x + bx, origin.y + by, '#f97316', 3);

        ctx.strokeStyle = cross > 0 ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const radius = 35;
        const angleA = Math.atan2(ay, ax);
        const angleB = Math.atan2(by, bx);
        ctx.arc(origin.x, origin.y, radius, angleA, angleB, cross > 0);
        ctx.stroke();

        ctx.fillStyle = '#3b82f6';
        ctx.fillText('Vector A', origin.x + ax + 10, origin.y + 5);
        ctx.fillStyle = '#f97316';
        ctx.fillText('Vector B', origin.x + bx + 10, origin.y + by - 5);

        let side = '';
        if (cross > 0.01) {
          side = '<span style="color:#10b981">b가 a의 왼쪽 (반시계 / CCW)</span>';
        } else if (cross < -0.01) {
          side = '<span style="color:#ef4444">b가 a의 오른쪽 (시계 / CW)</span>';
        } else {
          side = '<span style="color:#94a3b8">일직선 상에 위치</span>';
        }

        info.innerHTML = \`
          A = (\${Math.round(ax)}, \${Math.round(math_ay)}) | B = (\${Math.round(bx)}, \${Math.round(math_by)})<br/>
          외적 크기(z값) a × b = ax*by - ay*bx = <strong>\${Math.round(cross)}</strong><br/>
          방향 판정: <strong>\${side}</strong>
        \`;
      }

      function updateVectorB(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * canvas.width / rect.width;
        const mouseY = (e.clientY - rect.top) * canvas.height / rect.height;
        vecB.x = mouseX - origin.x;
        vecB.y = mouseY - origin.y;
        draw();
      }

      canvas.addEventListener('pointerdown', (e) => {
        isDragging = true;
        canvas.setPointerCapture(e.pointerId);
        updateVectorB(e);
      });

      canvas.addEventListener('pointermove', (e) => {
        if (isDragging) updateVectorB(e);
      });

      const stopDragging = () => {
        isDragging = false;
      };
      canvas.addEventListener('pointerup', stopDragging);
      canvas.addEventListener('pointercancel', stopDragging);

      draw();
    }

    function setupLerp(canvas, slider, info) {
      const ctx = canvas.getContext('2d');
      const ptA = { x: 60, y: 75 };
      const ptB = { x: 340, y: 75 };

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const t = parseFloat(slider.value);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ptA.x, ptA.y);
        ctx.lineTo(ptB.x, ptB.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const px = ptA.x + (ptB.x - ptA.x) * t;
        const py = ptA.y + (ptB.y - ptA.y) * t;

        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(ptA.x, ptA.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('A (60, 0)', ptA.x - 20, ptA.y - 15);

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(ptB.x, ptB.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('B (340, 0)', ptB.x - 20, ptB.y - 15);

        ctx.fillStyle = '#f97316';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillText('P (Lerp)', px - 20, py + 25);

        info.innerHTML = \`
          시작점 A = 60, 종료점 B = 340, 보간 비중 t = <strong>\${t.toFixed(2)}</strong><br/>
          P.x = A + (B - A) * t = 60 + (340 - 60) * \${t.toFixed(2)} = <strong>\${Math.round(px)}</strong>
        \`;
      }

      slider.addEventListener('input', draw);
      draw();
    }
  </script>
</body>
</html>
`;

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE.url}sitemap.xml
`;

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE.url}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

fs.writeFileSync(htmlPath, htmlTemplate, 'utf8');
fs.writeFileSync(robotsPath, robotsTxt, 'utf8');
fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');

console.log(`Successfully generated index.html (${toc.length} sections, ${mathBlocks.length} math blocks pre-rendered)`);
console.log('Successfully generated robots.txt and sitemap.xml');
