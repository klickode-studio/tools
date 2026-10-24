// End-to-end checks in a real browser. Run with `npm run test:e2e` (tests/e2e/run.mjs builds the
// site, serves it with the production Content-Security-Policy and runs this file).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let failures = 0;
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  const errors = []; const external = [];
  page.on('pageerror', e => errors.push(page.url() + ' ' + e.message));
  page.on('console', m => (m.type() === 'error' || /Content Security Policy/.test(m.text())) && errors.push(page.url() + ' console: ' + m.text()));
  const B = process.env.BASE_URL || 'http://localhost:4173';
  page.on('request', r => { if (!r.url().startsWith(B) && !/^(blob|data):/.test(r.url())) external.push(r.url()); });
  const txt = s => page.locator(s).textContent();
  const val = s => page.locator(s).inputValue();
  const check = (name, cond, extra = '') => { if (!cond) failures++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + extra)); };

  await page.goto(B + '/'); const toolCount = (await (await page.request.get(B + '/assets/tools-index.json')).json()).filter((t) => !t.variant).length;
  check('home cards', (await page.locator('.tool-card').count()) === toolCount, toolCount);
  await page.fill('#tool-search', 'webp'); check('home search', (await page.locator('.tool-card:visible').count()) >= 1 && (await page.locator('.tool-card:visible').count()) < 6, await page.locator('.tool-card:visible').count());
  await page.fill('#tool-search', 'zzzz'); check('home search empty', await page.isVisible('#no-results'));
  await page.goto(B + '/image-tools/'); check('category hub', (await page.locator('.tool-card').count()) >= 6);
  const ld = JSON.parse(await (await page.goto(B + '/tools/json-formatter/'), page.locator('script[type="application/ld+json"]').last().textContent()));
  check('jsonld faq+breadcrumb', ld['@graph'].some(g => g['@type'] === 'FAQPage') && ld['@graph'].some(g => g['@type'] === 'BreadcrumbList'));
  check('og image per tool', (await page.getAttribute('meta[property="og:image"]', 'content')) === 'https://example.com/tools/json-formatter/og.png');

  await page.goto(B + '/tools/json-formatter/');
  await page.fill('#input', '{\n  "a": 1,\n}'); await page.click('#format');
  check('json error', /line 3, column 1/.test(await txt('#status')), await txt('#status'));
  await page.click('#sample'); check('json format', (await val('#output')).includes('\n  "id": 42'));
  await page.click('#minify'); check('json minify', (await val('#output')).startsWith('{"id":42'));
  await page.check('#sort'); await page.selectOption('#indent', '4'); await page.reload(); check('json persisted', (await val('#input')).includes('Ada') && await page.isChecked('#sort') && (await val('#indent')) === '4');
  await page.goto(B + '/tools/regex-tester/'); await page.fill('#flags', 'gim'); await page.reload(); check('regex flags persisted', (await val('#flags')) === 'gim');

  await page.goto(B + '/tools/json-diff/'); await page.click('#sample');
  check('json diff', await page.locator('#result li').count() === 4, await txt('#result'));

  await page.goto(B + '/tools/csv-to-json/'); await page.click('#sample');
  const j = JSON.parse(await val('#output')); check('csv->json', j[1].name === 'Hopper, Grace' && j[2].name === 'Alan "AT" Turing' && j[0].active === true, JSON.stringify(j));
  await page.goto(B + '/tools/json-to-csv/'); await page.click('#sample');
  check('json->csv', (await val('#output')).startsWith('id,name,address.city,address.zip,tags'), await val('#output'));

  await page.goto(B + '/tools/json-schema-generator/'); await page.click('#sample');
  const sc = JSON.parse(await val('#output')); check('schema', sc.properties.email.format === 'email' && sc.properties.orders.items.required.join() === 'sku,qty,price');

  await page.goto(B + '/tools/regex-tester/'); await page.click('#sample'); await page.waitForTimeout(400);
  check('regex sample no trailing dot', !(await txt('#replaced')).includes('org. ') && (await txt('#replaced')).includes('example.org.'));
  check('regex matches', /^2 matches/.test(await txt('#status')), await txt('#status'));
  check('regex replace', (await txt('#replaced')).includes('ada [at] example.com'));
  check('regex named', (await txt('#details')).includes('<domain>'));
  await page.fill('#pattern', '(a+)+$'); await page.fill('#flags', ''); await page.fill('#input', 'a'.repeat(40) + '!');
  await page.waitForTimeout(2200); check('regex timeout', /Gave up/.test(await txt('#status')), await txt('#status'));
  await page.fill('#pattern', 'a'); await page.waitForTimeout(500); check('regex recovers', /match/.test(await txt('#status')), await txt('#status'));
  await page.click('#share'); const shared = page.url();
  await page.evaluate(() => localStorage.clear()); await page.goto(B + '/'); await page.goto(shared);
  await page.waitForTimeout(300); check('regex share link', (await val('#pattern')) === 'a', shared);

  await page.goto(B + '/tools/text-diff/'); await page.click('#sample');
  check('text diff', /2 lines added, 2 removed/.test(await txt('#status')), await txt('#status'));

  await page.goto(B + '/tools/case-converter/'); await page.fill('#input', 'parseHTTPResponse code');
  check('case', (await txt('#cases')).includes('parse_http_response_code'));

  await page.goto(B + '/tools/base64/'); await page.fill('#input', 'héllo ✓'); await page.click('#encode');
  check('b64 enc', (await val('#output')) === 'aMOpbGxvIOKckw=='); await page.click('#swap'); await page.click('#decode'); check('b64 dec', (await val('#output')) === 'héllo ✓');
  await page.fill('#input', '/w=='); await page.click('#decode'); check('b64 binary msg', /UTF-8/.test(await txt('#status')), await txt('#status'));

  await page.goto(B + '/tools/url-encoder/'); await page.fill('#input', 'https://x.com/?q=a%20b&n=1'); await page.click('#decode');
  check('url dec', (await val('#output')) === 'https://x.com/?q=a b&n=1' && (await page.locator('#params tr').count()) === 2);
  await page.fill('#input', '%E0%A4%A'); await page.click('#decode'); check('url bad', /Malformed/.test(await txt('#status')));

  await page.goto(B + '/tools/jwt-decoder/');
  await page.fill('#input', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  check('jwt', (await txt('#payload')).includes('John Doe') && (await txt('#times')).includes('2018-01-18'));
  await page.reload(); check('jwt not persisted', (await val('#input')) === '');

  await page.goto(B + '/tools/uuid-generator/'); check('uuid', (await val('#output')).split('\n').length === 5);
  await page.selectOption('#version', '7'); await page.fill('#check', (await val('#output')).split('\n')[0]);
  check('uuid v7 inspect', /version 7/.test(await txt('#status')), await txt('#status'));

  await page.goto(B + '/tools/timestamp-converter/'); await page.fill('#input', '1700000000000');
  check('timestamp', (await txt('#result')).includes('2023-11-14T22:13:20.000Z') && /milliseconds/.test(await txt('#status')));

  // ---- image tools ----
  const png = fs.readFileSync(path.join(ROOT, 'assets/brand/og.png'));
  await page.goto(B + '/tools/image-converter/');
  await page.setInputFiles('#files', [{ name: 'card.png', mimeType: 'image/png', buffer: png }, { name: 'card.png', mimeType: 'image/png', buffer: png }]);
  await page.waitForFunction(() => /2 files ready/.test(document.querySelector('#status').textContent), null, { timeout: 15000 }).catch(() => {});
  check('img convert', /2 files ready/.test(await txt('#status')), await txt('#status'));
  check('img convert webp', (await txt('#results')).includes('1200×630'), await txt('#results'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download-all')]);
  const zp = await dl.path(); const zb = fs.readFileSync(zp);
  check('img zip', zb.readUInt32LE(0) === 0x04034b50 && dl.suggestedFilename().endsWith('.zip'), dl.suggestedFilename());
  await page.selectOption('#resize-mode', 'width'); await page.fill('#width', '600');
  await page.waitForFunction(() => document.querySelector('#results').textContent.includes('600×315'), null, { timeout: 15000 }).catch(() => {});
  check('img resize rerun', (await txt('#results')).includes('600×315'), await txt('#results'));

  await page.goto(B + '/tools/image-compressor/');
  await page.setInputFiles('#files', [{ name: 'card.png', mimeType: 'image/png', buffer: png }]);
  await page.selectOption('#format', 'image/jpeg'); await page.fill('#target-kb', '30');
  await page.waitForFunction(() => /Quality \d+ to fit/.test(document.querySelector('#results').textContent), null, { timeout: 20000 }).catch(() => {});
  check('img target size', /Quality \d+ to fit 30 KB/.test(await txt('#results')), await txt('#results'));

  // JPEG with a GPS EXIF segment spliced in after SOI.
  const jpg = await page.screenshot({ type: 'jpeg', clip: { x: 0, y: 0, width: 200, height: 100 } });
  const entry = (tag) => [tag & 255, tag >> 8, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  const ifd = [0x49,0x49,0x2a,0,8,0,0,0, 2,0, ...entry(0x010f), ...entry(0x8825), 0,0,0,0];
  const payload = [...Buffer.from('Exif\0\0', 'binary'), ...ifd];
  const seg = Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload]);
  const withExif = Buffer.concat([jpg.subarray(0, 2), seg, jpg.subarray(2)]);
  await page.goto(B + '/tools/exif-remover/');
  await page.setInputFiles('#files', [{ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: withExif }]);
  await page.waitForFunction(() => /ready/.test(document.querySelector('#status').textContent), null, { timeout: 10000 }).catch(() => {});
  const ex = await txt('#results');
  check('exif detect+lossless', ex.includes('GPS location') && ex.includes('Removed losslessly'), ex);
  const [d2] = await Promise.all([page.waitForEvent('download'), page.click('[data-dl]')]);
  const cleaned = fs.readFileSync(await d2.path());
  check('exif stripped bytes', cleaned.length === jpg.length && !cleaned.includes(Buffer.from('Exif')) && d2.suggestedFilename() === 'photo-clean.jpg', cleaned.length + ' vs ' + jpg.length);

  // HEIC: Chromium can't open it, so this exercises our own decoder (WebAssembly, needs the CSP's 'wasm-unsafe-eval').
  await page.goto(B + '/tools/heic-to-jpg/');
  await page.setInputFiles('#files', path.join(__dirname, 'fixtures', 'sample.heic'));
  await page.waitForFunction(() => /ready|failed/.test(document.querySelector('#status').textContent), null, { timeout: 30000 }).catch(() => {});
  check('heic to jpg', /1 file ready/.test(await txt('#status')) && (await txt('#results')).includes('640×480'), await txt('#status'));

  // ---- SEO tools ----
  await page.goto(B + '/tools/meta-tag-analyzer/'); await page.click('#sample'); await page.waitForTimeout(300);
  const mt = await txt('#checks');
  check('meta analyzer', mt.includes('Missing meta description') && mt.includes('skips from h1 to h3') && mt.includes('no alt'), mt.slice(0, 300));
  await page.goto(B + '/tools/serp-preview/'); await page.fill('#title', 'An extremely long page title that will certainly be truncated by Google in results pages');
  check('serp truncation', (await txt('#preview')).includes(' ...') && (await page.locator('#title-meter.over').count()) === 1);
  await page.goto(B + '/tools/robots-txt-tester/'); await page.click('#sample'); await page.waitForTimeout(300);
  check('robots tester', /3 allowed · 3 blocked/.test(await txt('#status')), await txt('#status'));
  await page.fill('#ua', 'GPTBot'); await page.waitForTimeout(300);
  check('robots gptbot', /0 allowed · 6 blocked/.test(await txt('#status')), await txt('#status'));
  await page.goto(B + '/tools/keyword-density/'); await page.fill('#input', 'image converter image converter best image converter online tool'); await page.waitForTimeout(400);
  check('keyword density', (await txt('#result')).includes('image converter'));

  await page.click('#theme-toggle'); await page.reload(); check('theme persisted', await page.evaluate(() => !!document.documentElement.dataset.theme));

  await page.setViewportSize({ width: 375, height: 800 });
  for (const p of ['/', '/tools/shop-card-maker/', '/business-tools/', '/image-tools/', '/tools/regex-tester/', '/tools/json-formatter/', '/tools/csv-to-json/', '/tools/image-converter/', '/tools/meta-tag-analyzer/', '/tools/serp-preview/', '/tools/robots-txt-tester/', '/tools/keyword-density/']) {
    await page.goto(B + p); const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check('no h-scroll ' + p, w <= 375, w);
  }
  await page.goto(B + '/tools/json-formatter/'); await page.click('#sample'); 
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(B + '/tools/regex-tester/'); await page.click('#sample'); await page.waitForTimeout(300);
  await page.emulateMedia({ colorScheme: 'dark' }); await page.evaluate(() => localStorage.clear()); await page.goto(B + '/'); 

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });

  // ---- site-wide features ----
  await page.goto(B + '/tools/json-formatter/');
  await page.keyboard.press('Control+k');
  check('palette opens', await page.locator('dialog.palette[open]').isVisible());
  await page.keyboard.type('csv'); await page.waitForTimeout(150);
  check('palette filters', (await page.locator('.palette-list li[id]').count()) === 2);
  await page.keyboard.press('Escape');
  await page.fill('#input', '[{"a":1,"b":{"c":2}}]'); await page.focus('#input'); await page.keyboard.press('Control+Enter');
  check('ctrl+enter runs the tool', (await val('#output')).includes('\n'));
  await page.click('.send-to > button'); await page.click('.send-menu [data-slug="json-to-csv"]');
  await page.waitForURL(/json-to-csv/); await page.waitForTimeout(300);
  check('send to another tool', (await val('#output')).startsWith('a,b.c'), await val('#output'));
  await page.goto(B + '/tools/text-diff/');
  const dt = await page.evaluateHandle(() => { const d = new DataTransfer(); d.items.add(new File(['hello\nworld'], 'a.txt', { type: 'text/plain' })); return d; });
  const ta = page.locator('textarea:not([readonly])').first();
  await ta.dispatchEvent('dragover', { dataTransfer: dt }); await ta.dispatchEvent('drop', { dataTransfer: dt }); await page.waitForTimeout(100);
  check('drop a text file', (await ta.inputValue()) === 'hello\nworld');
  await page.goto(B + '/');
  check('recently used tools', (await page.locator('.recent-list a').count()) >= 2);
  await page.keyboard.press('/'); check('/ focuses search', await page.evaluate(() => document.activeElement.id === 'tool-search'));
  check('manifest', (await (await page.request.get(B + '/manifest.webmanifest')).json()).icons.length === 3);
  check('service worker', (await page.request.get(B + '/sw.js')).ok());

  // ---- QR and PromptPay ----
  await page.goto(B + '/tools/qr-code-generator/');
  await page.click('#types [data-v="wifi"]'); await page.fill('#f-ssid', 'Cafe; Guest'); await page.fill('#f-pass', 'secret'); await page.waitForTimeout(200);
  check('qr wifi payload', (await txt('#payload')) === 'WIFI:T:WPA;S:Cafe\\; Guest;P:secret;;', await txt('#payload'));
  check('qr preview', (await page.locator('#preview svg').count()) === 1);
  await page.goto(B + '/tools/promptpay-qr/');
  await page.fill('#target', '0812345678'); await page.fill('#amount', '350'); await page.waitForTimeout(300);
  check('promptpay detect', /Mobile number 081-234-5678/.test(await txt('#detect')), await txt('#detect'));
  await page.click('#copy');

  // ---- Thai business tools ----
  await page.goto(B + '/th/tools/thai-baht-text/'); await page.fill('#amount', '1,250');
  check('baht text', (await txt('#thai')) === 'หนึ่งพันสองร้อยห้าสิบบาทถ้วน', await txt('#thai'));
  await page.goto(B + '/tools/vat-calculator/'); await page.fill('#amount', '10700'); await page.selectOption('#mode', 'remove'); await page.selectOption('#wht', '3');
  check('vat breakdown', /10,000\.00.*700\.00.*10,700\.00.*300\.00.*10,400\.00/s.test(await txt('#table')), await txt('#table'));
  await page.goto(B + '/tools/thai-id-checker/'); await page.fill('#input', '1-1037-00012-34-6\n1103700012345');
  check('thai id', (await page.locator('#results li.ok').count()) === 1 && /should be 6/.test(await txt('#results')), await txt('#results'));

  await page.goto(B + '/th/tools/compress-image-to-50kb/');
  check('size page preset', (await page.inputValue('#target-kb')) === '50' && (await page.inputValue('#format')) === 'image/jpeg');
  check('size page links', (await page.locator('.variant-links a').count()) === 5 && (await page.locator('.variant-links [aria-current]').innerText()) === '50 KB');

  // ---- PDF tools (test PDFs are made with the same pdf-lib the site ships) ----
  const { PDFDocument, StandardFonts } = await import(path.join(ROOT, 'assets/vendor/pdf-lib/pdf-lib.esm.min.js'));
  const makePdf = async (pages) => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= pages; i++) doc.addPage([595, 842]).drawText(`Page ${i}`, { x: 60, y: 760, size: 24, font });
    return Buffer.from(await doc.save());
  };
  const pdfA = { name: 'a.pdf', mimeType: 'application/pdf', buffer: await makePdf(2) };
  const pdfB = { name: 'b.pdf', mimeType: 'application/pdf', buffer: await makePdf(3) };
  await page.goto(B + '/tools/merge-pdf/');
  await page.setInputFiles('#files', [pdfA, pdfB]); await page.waitForTimeout(500);
  const [merged] = await Promise.all([page.waitForEvent('download'), page.click('#run')]);
  const mergedBytes = fs.readFileSync(await merged.path());
  check('merge pdf', (await PDFDocument.load(mergedBytes)).getPageCount() === 5, await txt('#status'));
  await page.goto(B + '/th/tools/pdf-to-jpg/');
  await page.setInputFiles('#files', pdfB);
  await page.waitForFunction(() => document.querySelectorAll('[data-page]').length === 3, null, { timeout: 30000 }).catch(() => {});
  check('pdf to jpg', (await page.locator('[data-page]').count()) === 3, await txt('#status'));
  await page.goto(B + '/tools/compress-pdf/');
  await page.setInputFiles('#files', pdfA);
  await page.waitForSelector('#list [data-dl]:not([disabled])', { timeout: 30000 }).catch(() => {});
  check('compress pdf', await page.locator('#list [data-dl]').isEnabled(), await txt('#list'));
  await page.goto(B + '/tools/jpg-to-pdf/');
  await page.setInputFiles('#files', path.join(ROOT, 'assets/brand/icon-192.png')); await page.waitForTimeout(300);
  const [made] = await Promise.all([page.waitForEvent('download'), page.click('#run')]);
  check('jpg to pdf', (await PDFDocument.load(fs.readFileSync(await made.path()))).getPageCount() === 1, await txt('#status'));

  await page.goto(B + '/tools/passport-photo-maker/');
  await page.setInputFiles('#files', path.join(ROOT, 'assets/brand/og.png')); await page.waitForTimeout(300);
  check('passport photo', /413 × 531 pixels/.test(await txt('#out-info')) && (await page.locator('#editor').isVisible()), await txt('#out-info'));
  await page.goto(B + '/tools/link-in-bio/');
  await page.click('[data-tab="links"]'); await page.fill('[data-pay="id"]', '0812345678');
  check('link in bio promptpay', /kb-pay/.test(await page.inputValue('#html-out')));

  // ---- explore: floating canvas ----
  await page.goto(B + '/explore/'); await page.waitForTimeout(400);
  const exCount = await page.locator('.ex-item').count();
  const first = () => page.evaluate(() => document.querySelector('.ex-item').style.transform);
  const t0 = await first();
  await page.mouse.move(700, 450); await page.mouse.down(); await page.mouse.move(400, 300, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(200);
  check('explore floats every tool', exCount === toolCount, exCount);
  check('explore drags', (await first()) !== t0);
  await page.fill('#ex-q', 'json formatter'); await page.waitForTimeout(100);
  check('explore search', (await page.locator('.ex-item.ex-match').count()) === 1);

  // ---- tool switchboard (its GitHub calls are covered by hand; the strict test CSP blocks them) ----
  await page.goto(B + '/admin/');
  check('admin lists every tool', (await page.locator('[role="switch"]').count()) === (await page.request.get(B + '/assets/tools-index.json').then((r) => r.json())).length);
  check('admin is noindex', (await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'));
  check('admin needs a token', await page.locator('#save').isDisabled());

  // ---- accessibility: axe-core on every page in the sitemap, light and dark ----
  const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  const sitemap = await (await page.request.get(B + '/sitemap.xml')).text();
  const pages = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g)].map((m) => m[1]).concat(['/explore/', '/th/explore/', '/admin/']);
  await page.setViewportSize({ width: 1280, height: 900 });
  const a11y = new Map();
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const p of pages) {
      await page.goto(B + p);
      if (p.includes('/explore/')) await page.waitForTimeout(2000); // let the cards finish fading in
      await page.addScriptTag({ content: axe });
      const found = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => `${v.id} (${v.impact}) ${v.nodes[0]?.target.join(' ')}`));
      for (const v of found) a11y.set(v, `${scheme} ${p}`);
    }
  }
  check(`accessibility (${pages.length} pages × 2 themes)`, a11y.size === 0, [...a11y].map(([v, where]) => `${where}: ${v}`).join('\n  '));

  console.log('errors:', errors); console.log('external requests:', external);
  if (errors.length || external.length) failures++;
  await b.close();
  console.log(failures ? `${failures} failed` : 'All passed');
  process.exit(failures ? 1 : 0);
})();
