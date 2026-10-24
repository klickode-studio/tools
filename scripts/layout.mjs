// Shared HTML shell: <head> SEO tags, header, footer. Every page is built per language (en, th).
import { categoryIcon } from './categories.mjs';
import { COMPANY, CONTACT_URL, BRAND_NOTICE } from './legal.mjs';
import { LANGS, UI } from './i18n.mjs';

export const SITE_NAME = 'Klickode Tools';
export const STUDIO_URL = 'https://www.klickode.com/';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A path in the given language: /tools/x/ → /th/tools/x/
export const localPath = (lang, path) => `${LANGS[lang].prefix}${path}`;

const NAV = [
  ['/business-tools/', 'business'],
  ['/image-tools/', 'images'],
  ['/pdf-tools/', 'pdf'],
  ['/json-tools/', 'json'],
  ['/seo-tools/', 'seo'],
  ['/text-tools/', 'text'],
  ['/encoding-tools/', 'encoding'],
];

// One id for Klickode across klickode.com and this site, so search engines and AI answers treat
// both as the same studio.
export const ORG_ID = `${STUDIO_URL}#organization`;

// Tells search engines who is behind the site and which logo is the brand's.
const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID,
  name: COMPANY,
  alternateName: ['Klickode', 'Klickode Studio'],
  url: STUDIO_URL,
  logo: 'https://www.klickode.com/icon-192.png',
  email: 'klickode@gmail.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Bangkok', addressCountry: 'TH' },
  brand: { '@type': 'Brand', name: 'Klickode' },
};

// Switched-off tools and categories left with none of their tools on (tools.config.json).
// The build calls hideFromLayout before rendering any page.
const hidden = { tools: new Set(), categories: new Set() };
export function hideFromLayout({ tools = [], categories = [] }) {
  hidden.tools = new Set(tools);
  hidden.categories = new Set(categories);
}
const navItems = () => NAV.filter(([, id]) => !hidden.categories.has(id));

const POPULAR = [
  ['image-converter', { en: 'Image Converter', th: 'แปลงไฟล์รูป' }],
  ['image-compressor', { en: 'Image Compressor', th: 'ย่อขนาดรูป' }],
  ['qr-code-generator', { en: 'QR Code Generator', th: 'สร้าง QR Code' }],
  ['promptpay-qr', { en: 'PromptPay QR', th: 'สร้าง QR พร้อมเพย์' }],
  ['shop-card-maker', { en: 'Shop Card Maker', th: 'สร้างการ์ดร้านค้า' }],
];

function footerColumns(lang, categoryNames) {
  const u = UI[lang];
  return [
    [u.footerCols.categories, navItems().map(([href, id]) => [localPath(lang, href), categoryNames[id] ?? u.nav[id]])],
    [u.footerCols.popular, POPULAR.filter(([slug]) => !hidden.tools.has(slug)).map(([slug, names]) => [localPath(lang, `/tools/${slug}/`), names[lang]])],
    [u.footerCols.company, [[STUDIO_URL, 'Klickode Studio'], [CONTACT_URL, u.contact], ['mailto:klickode@gmail.com', 'klickode@gmail.com']]],
    [u.footerCols.legal, [['/terms/', u.legal.terms], ['/privacy/', u.legal.privacy], ['/disclaimer/', u.legal.disclaimer], ['/copyright/', u.legal.copyright]]],
  ];
}

const THEME_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>';
const SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/**
 * @param {object} o
 * @param {'en'|'th'} [o.lang]
 * @param {{ en?: string, th?: string }} [o.alternates] the same page in each language (paths)
 * @param {Record<string,string>} [o.strings] runtime translations for this page's scripts
 * @param {Record<string,string>} [o.categoryNames] category names in this language, by id
 */
export function layout({ siteUrl, path, title, description, body, robots, scripts = [], styles = [], bodyAttrs = '', jsonLd, ogImage = '/assets/brand/og.png', active = '', lang = 'en', alternates = {}, strings = null, categoryNames = {} }) {
  const abs = (p) => (siteUrl ? `${siteUrl}${p}` : p);
  const u = UI[lang];
  const other = lang === 'en' ? 'th' : 'en';
  const switchHref = alternates[other] ?? localPath(other, '/');
  const year = new Date().getFullYear();
  const hreflang = Object.entries(alternates)
    .map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${abs(p)}">`)
    .concat(alternates.en ? [`<link rel="alternate" hreflang="x-default" href="${abs(alternates.en)}">`] : [])
    .join('\n  ');
  const brand = `<a class="brand" href="${localPath(lang, '/')}" aria-label="${SITE_NAME} ${u.home}">
        <img src="/assets/brand/mark.svg" alt="" width="36" height="36">
        <span class="brand-text"><span class="brand-name">Klickode</span><span class="brand-tag">Tools</span></span>
      </a>`;
  return `<!doctype html>
<!-- ${BRAND_NOTICE} -->
<html lang="${LANGS[lang].htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${robots ? `<meta name="robots" content="${robots}">` : ''}
  ${siteUrl ? `<link rel="canonical" href="${abs(path)}">` : ''}
  ${hreflang}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="${LANGS[lang].ogLocale}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  ${siteUrl ? `<meta property="og:url" content="${abs(path)}">` : ''}
  <meta property="og:image" content="${abs(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#E03131">
  <meta name="copyright" content="© ${year} ${COMPANY} All rights reserved.">
  <meta name="author" content="${COMPANY}">
  <script type="application/ld+json">${JSON.stringify(ORGANIZATION).replace(/</g, '\\u003c')}</script>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  ${lang === 'th' ? '<link rel="preload" href="/assets/fonts/noto-sans-thai-thai-wght-normal.woff2" as="font" type="font/woff2" crossorigin>' : ''}
  <link rel="stylesheet" href="/assets/css/style.css">
${styles.map((h) => `  <link rel="stylesheet" href="${h}">\n`).join('')}  <script>try{var t=localStorage.getItem('kt-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
  ${strings && Object.keys(strings).length ? `<script type="application/json" id="kt-strings">${JSON.stringify(strings).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body${bodyAttrs}>
<!-- Same frame as klickode.com: the site sits in a rounded panel that scrolls inside the window. -->
<div class="app-viewport"><div class="app-frame"><div class="app-scroll" id="scroller" tabindex="-1">
<a class="skip" href="#main">${u.skip}</a>
<header class="site-header"><div class="wrap wrap-wide">
  ${brand}
  <nav aria-label="${u.navLabel}">
    ${navItems().map(([href, id]) => `<a href="${localPath(lang, href)}"${active === href ? ' aria-current="page"' : ''}>${u.nav[id]}</a>`).join('\n    ')}
  </nav>
  <div class="header-actions">
    <span class="search-slot"><button class="search-btn" type="button" data-palette aria-label="${u.findToolLabel}">${SEARCH_ICON}<span class="search-more">${u.findTool}</span></button></span>
    <a class="lang-btn" href="${switchHref}" hreflang="${other}" lang="${other}" title="${esc(UI[lang].switchTo)}">${LANGS[other].short}</a>
    <button class="icon-btn" id="theme-toggle" aria-label="${u.themeToggle}" title="${u.themeToggle}">${THEME_ICON}</button>
    <a class="header-cta" href="${STUDIO_URL}">Klickode Studio <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
  </div>
</div></header>
<main id="main"><div class="wrap">
${body}
</div></main>
<footer class="site-footer"><div class="wrap">
  <div class="footer-grid">
    <div class="footer-about">
      ${brand}
      <p>${u.footerAbout}</p>
      <a class="footer-studio" href="${STUDIO_URL}">${u.footerStudio} <span aria-hidden="true">↗</span></a>
    </div>
    ${footerColumns(lang, categoryNames).map(([title, links]) => `<nav class="footer-col" aria-label="${title}"><h2>${title}</h2><ul>${links.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul></nav>`).join('\n    ')}
  </div>
  <div class="footer-bottom">
    <span>© ${year} ${COMPANY} ${u.rights}</span>
    <span>${u.noCopy}</span>
  </div>
</div></footer>
</div></div></div>
${(scripts.length ? scripts : ['/assets/js/ui.js']).map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
</body>
</html>
`;
}

export const breadcrumbs = (items) =>
  `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([href, label], i) => (i === items.length - 1 ? `<li aria-current="page">${esc(label)}</li>` : `<li><a href="${href}">${esc(label)}</a></li>`)).join('')}</ol></nav>`;

// A tool's own icon.svg, sized for inline use; the category icon if it has none.
export const toolIcon = (t, cat, size = 20) =>
  t.icon ? t.icon.replace('<svg ', `<svg width="${size}" height="${size}" aria-hidden="true" `) : cat ? categoryIcon(cat, size) : '';

// Tool card: an illustration of what the tool does (tools/<slug>/preview.html), then its name.
// t is already in the page's language; t.href says where it lives (the Thai page, or English if
// it hasn't been translated yet).
export const toolCard = (t, cat) =>
  `<a class="tool-card" href="${t.href ?? `/tools/${t.slug}/`}" data-slug="${t.slug}" data-category="${t.category}" data-search="${esc(`${t.name} ${t.short} ${t.slug} ${cat?.name ?? ''} ${(t.keywords || []).join(' ')} ${t.searchExtra ?? ''}`.toLowerCase())}">${
    t.preview ? `<div class="tc-preview" aria-hidden="true">${t.preview}</div>` : ''
  }<div class="tc-body"><span class="tc-title"><span class="tool-icon">${toolIcon(t, cat, 16)}</span><strong>${esc(t.name)}</strong></span><span class="desc">${esc(t.short)}</span></div></a>`;

export const toolGrid = (list, catOf) => `<div class="tool-grid">${list.map((t) => toolCard(t, catOf(t))).join('')}</div>`;

// A short note at the end of tool pages pointing to the studio.
export const studioCta = (lang) => {
  const u = UI[lang];
  return `<aside class="studio-cta"><div><h2>${u.ctaTitle}</h2><p>${u.ctaBody}</p></div><a class="btn primary" href="${STUDIO_URL}">${u.ctaButton} <span aria-hidden="true">↗</span></a></aside>`;
};
