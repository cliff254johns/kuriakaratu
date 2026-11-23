import fs from 'node:fs';
import vm from 'node:vm';

const files = ['admin.js', 'admin-v2.js', 'practice-areas.js', 'generator.js', 'sw.js', 'assets/homepage-experience.js', 'assets/site-enhancements.js', 'assets/public-navigation.js', 'assets/practice-navigation.js', 'assets/seo-meta.js', 'assets/conference-papers.js'];
let failures = 0;
for (const file of files) {
  try {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    console.log('PASS JavaScript:', file);
  } catch (error) {
    failures++;
    console.error('FAIL JavaScript:', file, error.message);
  }
}

for (const file of ['index.html', 'client.html', 'finance.html', 'track.html', 'blog/index.html', 'newsletter/index.html', 'newsletter/2026-12/index.html', 'papers/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let checked = 0;
  for (const [, attrs, body] of tags) {
    if (/\bsrc\s*=/.test(attrs) || /application\/ld\+json|application\/json/i.test(attrs)) continue;
    if (!body.trim()) continue;
    try {
      new vm.Script(body, { filename: file + '#inline-' + (++checked) });
    } catch (error) {
      failures++;
      console.error('FAIL inline JavaScript:', file, error.stack || error.message);
    }
  }
  console.log('PASS inline script parsing:', file, '(' + checked + ' scripts)');
}

const admin = fs.readFileSync('admin.js', 'utf8');
const finance = fs.readFileSync('finance.html', 'utf8');
const client = fs.readFileSync('client.html', 'utf8');
if (/admin123|clerk123|dev123/.test(admin + finance)) {
  failures++;
  console.error('FAIL: default staff passwords remain in admin/finance sources');
} else console.log('PASS: no embedded default staff passwords');
if (/matchedClient|auto-match-|signupCaseRef/.test(client)) {
  failures++;
  console.error('FAIL: client self-linking or case-reference matching remains');
} else console.log('PASS: no public client auto-linking identifiers');

if (!client.includes('id="signupPhone" placeholder="+254 712 345 678" autocomplete="tel" required')) {
  failures++;
  console.error('FAIL: client portal registration must require a phone number for identity matching');
} else console.log('PASS: client portal registration requires a phone number');

if (!admin.includes('function findExactPortalClientMatch')
    || !admin.includes('normalizeText(client && client.name) === name')
    || !admin.includes("String(client && client.email || '').trim().toLowerCase() === email")
    || !admin.includes('normalizePhone(client && client.phone) === phone')
    || admin.includes('let matchedClient = clientsData.find(c => (c.email')) {
  failures++;
  console.error('FAIL: portal suggestions must require one exact name, email and phone match');
} else console.log('PASS: portal suggestions require an exact name, email and normalized phone match');

if (!admin.includes('Administrator approval is still required.')
    || !admin.includes("if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }")) {
  failures++;
  console.error('FAIL: portal account linking must remain behind authorised administrator approval');
} else console.log('PASS: portal linking remains an explicit administrator action');

const matchStart = admin.indexOf('function findExactPortalClientMatch(');
const matchEnd = admin.indexOf('\n}\n', matchStart);
const matchFunction = matchStart >= 0 && matchEnd >= 0 ? admin.slice(matchStart, matchEnd + 2) : '';
if (!matchFunction) {
  failures++;
  console.error('FAIL: exact portal identity matcher could not be extracted for behavior tests');
} else {
  const normalizePortalName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizePortalPhone = value => {
    if (!value) return '';
    let clean = String(value).replace(/\s/g, '').replace(/^\+/, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('254')) clean = '254' + clean;
    return clean;
  };
  const matcher = vm.runInNewContext('(' + matchFunction + ')', {
    normalizeText: normalizePortalName,
    normalizePhone: normalizePortalPhone,
    clientsData: []
  });
  const clientFixture = { id: 'client-1', name: 'Jane Doe', email: 'jane@example.com', phone: '+254 712 345 678' };
  const exact = matcher({ name: ' Jane Doe ', email: 'JANE@example.com', phone: '0712345678' }, [clientFixture]);
  const mismatch = matcher({ name: 'Jane Doe', email: 'jane@example.com', phone: '0712345679' }, [clientFixture]);
  const incomplete = matcher({ name: 'Jane Doe', email: 'jane@example.com', phone: '' }, [clientFixture]);
  const ambiguous = matcher({ name: 'Jane Doe', email: 'jane@example.com', phone: '0712345678' }, [clientFixture, { ...clientFixture, id: 'client-2' }]);
  if (exact.reason !== 'exact' || exact.client?.id !== 'client-1'
      || mismatch.reason !== 'none' || incomplete.reason !== 'incomplete'
      || ambiguous.reason !== 'ambiguous' || ambiguous.client !== null) {
    failures++;
    console.error('FAIL: exact portal identity matcher behavior tests');
  } else console.log('PASS: exact, mismatched, incomplete and ambiguous portal identity cases');
}



const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const homepage = fs.readFileSync('index.html', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const ownerEmail = 'admin@kuriakaratu.com';
if (manifest.display !== 'standalone' || manifest.scope !== '/') {
  failures++;
  console.error('FAIL: PWA manifest must use standalone display and root scope');
} else console.log('PASS: PWA manifest is installable and root-scoped');
for (const icon of manifest.icons || []) {
  if (!fs.existsSync(icon.src.replace(/^\//, ''))) {
    failures++;
    console.error('FAIL: PWA icon is missing:', icon.src);
  }
}
if (!homepage.includes('rel="manifest"') || !homepage.includes("navigator.serviceWorker.register('/sw.js'")) {
  failures++;
  console.error('FAIL: homepage is missing its manifest link or service-worker registration');
} else console.log('PASS: homepage links the PWA manifest and registers its service worker');
if (/home-whatsapp-float|request-float|apk-download-float|Download Our App/i.test(homepage) || (homepage.match(/class="kk-whatsapp-float"/g) || []).length !== 1) {
  failures++;
  console.error('FAIL: duplicate floating contact/download actions remain on the homepage');
} else console.log('PASS: duplicate homepage floating actions removed');
if (!fs.readFileSync('admin.js', 'utf8').includes("const OWNER_ADMIN_EMAIL = '" + ownerEmail + "';")
    || !rules.includes("request.auth.token.email == '" + ownerEmail + "'")
    || /cliff254johns@gmail\.com/.test(fs.readFileSync('admin.js', 'utf8') + rules)) {
  failures++;
  console.error('FAIL: owner administrator identity is inconsistent');
} else console.log('PASS: owner administrator identity is consistently configured');


const teamCards = (homepage.match(/class="team-card animate-on-scroll delay-/g) || []).length;
if (teamCards !== 3 || !homepage.includes('display: flex;') || !homepage.includes('justify-content: center;')) {
  failures++;
  console.error('FAIL: homepage team section must contain three centered team cards');
} else console.log('PASS: three-person team layout is centered');
if (!homepage.includes('id="prepChecklist"')
    || !homepage.includes('id="printPrepChecklist"')
    || !homepage.includes('id="copyPrepChecklist"')
    || !homepage.includes('id="prepProgressText"')) {
  failures++;
  console.error('FAIL: consultation preparation checklist is missing a required interactive control');
} else console.log('PASS: consultation preparation checklist controls are present');


if (!homepage.includes('id="readingProgressFill"') || !homepage.includes('id="shareSiteButton"') || !homepage.includes('navigator.share')) {
  failures++;
  console.error('FAIL: homepage reading progress or native sharing controls are missing');
} else console.log('PASS: reading progress and native sharing controls are present');
if (!homepage.includes("const sections = ['home', 'practices', 'insights', 'contact']")) {
  failures++;
  console.error('FAIL: mobile navigation active-section targets are inconsistent');
} else console.log('PASS: mobile navigation uses the correct section targets');
const consultation = fs.readFileSync('consultation.html', 'utf8');
const enquiryScript = fs.readFileSync('assets/site-enhancements.js', 'utf8');
if (!consultation.includes('id="summaryCount"') || !enquiryScript.includes("value('contact')") || !enquiryScript.includes("value('date')") || !enquiryScript.includes("value('time')")) {
  failures++;
  console.error('FAIL: consultation form character count or appointment preferences are missing');
} else console.log('PASS: consultation form includes character count and preferred contact/date/time');
if (!fs.readFileSync('assets/public-navigation.js', 'utf8').includes('kk-whatsapp-float') || !fs.readFileSync('assets/practice-navigation.css', 'utf8').includes('.kk-whatsapp-float')) {
  failures++;
  console.error('FAIL: public subpages are missing the WhatsApp contact shortcut');
} else console.log('PASS: public subpages include the WhatsApp contact shortcut');


const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const blogPage = fs.readFileSync('blog/index.html', 'utf8');
const newsletterPage = fs.readFileSync('newsletter/index.html', 'utf8');
const firstIssue = fs.readFileSync('newsletter/2026-12/index.html', 'utf8');
const publicNav = fs.readFileSync('assets/public-navigation.js', 'utf8');
const practiceNav = fs.readFileSync('assets/practice-navigation.js', 'utf8');
if (!blogPage.includes('<title>') || !blogPage.includes('rel="canonical"') || !blogPage.includes('name="description"') || !blogPage.includes('id="blogSearch"')) {
  failures++;
  console.error('FAIL: legal blog is missing SEO metadata or search');
} else console.log('PASS: searchable legal blog and core SEO metadata are present');
if (!newsletterPage.includes('<title>') || !newsletterPage.includes('rel="canonical"') || !newsletterPage.includes('id="subscribe"') || !newsletterPage.includes('mailto:info@kuriakaratuadvocates.com')) {
  failures++;
  console.error('FAIL: newsletter archive or email subscription information is missing');
} else console.log('PASS: newsletter archive and email subscription route are present');
const newsletterPages = (firstIssue.match(/class="newsletter-page"/g) || []).length;
if (newsletterPages < 6 || !firstIssue.includes('window.print()') || !firstIssue.includes('datePublished')) {
  failures++;
  console.error('FAIL: first newsletter edition must contain at least six printable pages and publication metadata');
} else console.log('PASS: first monthly newsletter edition contains ' + newsletterPages + ' printable editorial pages');
if (!homepage.includes('href="blog/"') || !homepage.includes('href="newsletter/"')
    || !manifest.shortcuts?.some?.(shortcut => shortcut.url === '/blog/')
    || !manifest.shortcuts?.some?.(shortcut => shortcut.url === '/newsletter/')) {
  failures++;
  console.error('FAIL: homepage or PWA shortcuts do not expose the blog and newsletter');
} else console.log('PASS: homepage and PWA expose blog and newsletter');
if (!sitemap.includes('/blog/') || !sitemap.includes('/newsletter/') || !sitemap.includes('/newsletter/2026-12/')) {
  failures++;
  console.error('FAIL: blog and newsletter URLs are missing from the XML sitemap');
} else console.log('PASS: blog and newsletter are discoverable in the XML sitemap');
if (!publicNav.includes('enrichPublicSeo') || !practiceNav.includes('enrichPublicSeo')
    || !publicNav.includes('BreadcrumbList') || !practiceNav.includes('BlogPosting')
    || !fs.readFileSync('assets/seo-meta.js', 'utf8').includes('og:description')) {
  failures++;
  console.error('FAIL: shared public-page SEO metadata and structured data are incomplete');
} else console.log('PASS: shared public pages receive canonical, social and structured SEO metadata');
function collectHtml(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = dir === '.' ? entry.name : dir + '/' + entry.name;
    if (entry.isDirectory()) return collectHtml(full);
    return entry.isFile() && full.endsWith('.html') ? [full] : [];
  });
}
const seoPages = collectHtml('.').filter(file => !/^(admin|admin-v2|client|finance|generator|track|offline)\.html$/.test(file) && !file.startsWith('google'));
for (const file of seoPages) {
  const html = fs.readFileSync(file, 'utf8');
  if (!/<title>[^<]{5,}<\/title>/i.test(html) || !/<meta\s+name=["']description["']\s+content=["'][^"']{40,}/i.test(html) || !/<link\s+rel=["']canonical["']/i.test(html)) {
    failures++;
    console.error('FAIL: public page needs a unique title, description and canonical URL:', file);
  }
}
if (seoPages.length) console.log('PASS: static SEO title, description and canonical checks completed for ' + seoPages.length + ' public HTML pages');


const papersPage = fs.readFileSync('papers/index.html', 'utf8');
const paperCatalog = JSON.parse(fs.readFileSync('papers/catalog.json', 'utf8'));
const papersScript = fs.readFileSync('assets/conference-papers.js', 'utf8');
if (!papersPage.includes('rel="canonical"') || !papersPage.includes('name="description"') || !papersPage.includes('id="paperGrid"') || !papersPage.includes('id="submit"')) {
  failures++;
  console.error('FAIL: conference papers page needs SEO metadata, catalogue and submission route');
} else console.log('PASS: conference papers public library and submission route are present');
if (!Array.isArray(paperCatalog.papers) || paperCatalog.schemaVersion !== 1) {
  failures++;
  console.error('FAIL: conference papers catalogue schema is invalid');
} else console.log('PASS: conference papers catalogue schema is valid');
if (!papersScript.includes('navigator.share') || !papersScript.includes('clipboard.writeText') || !papersScript.includes('Download PDF') || !papersScript.includes('ScholarlyArticle')) {
  failures++;
  console.error('FAIL: paper PDF download, citation, share or structured-data capability is missing');
} else console.log('PASS: paper sharing, citations, PDF links and scholarly structured data are implemented');
if (!homepage.includes('href="papers/"') || !manifest.shortcuts.some(shortcut => shortcut.url === '/papers/')) {
  failures++;
  console.error('FAIL: homepage or PWA does not link to conference papers');
} else console.log('PASS: homepage and PWA expose the conference papers library');
if (!sitemap.includes('/papers/') || !fs.readFileSync('robots.txt', 'utf8').includes('Allow: /papers/')) {
  failures++;
  console.error('FAIL: conference papers library is missing from sitemap or robots rules');
} else console.log('PASS: conference papers library is discoverable to search engines');


const sharedPractices = fs.readFileSync('practice-areas.js', 'utf8');
const tracker = fs.readFileSync('track.html', 'utf8');
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const adminJs = fs.readFileSync('admin.js', 'utf8');
const expectedPracticeAreas = ['ELCs', 'Criminal', 'Succession', 'Civil', 'Tribunal', 'Divorce', 'Conveyancing', 'Running Down', 'Children', 'Employment', 'Kadhi'];
const categoryList = sharedPractices.match(/root\.KK_PRACTICE_AREAS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
const actualPracticeAreas = categoryList ? [...categoryList[1].matchAll(/'([^']+)'/g)].map(match => match[1]) : [];
if (JSON.stringify(actualPracticeAreas) !== JSON.stringify(expectedPracticeAreas)) {
  failures++;
  console.error('FAIL: shared practice catalogue does not exactly match the main management system');
} else console.log('PASS: one shared practice catalogue contains the exact 11 main-system practice areas');
if (!adminHtml.includes('<script src="practice-areas.js"></script>') || adminHtml.indexOf('<script src="practice-areas.js"></script>') > adminHtml.indexOf('<script src="admin.js"></script>') || !adminJs.includes('const PRACTICE_AREAS = window.KK_PRACTICE_AREAS;')) {
  failures++;
  console.error('FAIL: admin system is not loading the shared practice catalogue before admin.js');
} else console.log('PASS: main management system consumes the shared practice catalogue');
if (!tracker.includes('projectId:"kuriakaratu-b5c90"') || tracker.includes('kuriatrack') || tracker.includes('G-SB7XB7RX05')) {
  failures++;
  console.error('FAIL: tracker is not fully switched to the firm Firebase project');
} else console.log('PASS: tracker uses the same Firebase project as the main system');
const trackerCatalogueScript = tracker.indexOf('<script src="/practice-areas.js"></script>');
const trackerApplicationScript = tracker.indexOf('<script>', trackerCatalogueScript + 1);
if (trackerCatalogueScript < 0 || trackerApplicationScript < 0 || trackerCatalogueScript > trackerApplicationScript) {
  failures++;
  console.error('FAIL: tracker must load the shared practice catalogue before its application code');
} else console.log('PASS: tracker loads the shared practice catalogue before application code');

if (!tracker.includes('window.KK_PRACTICE_AREAS') || !tracker.includes("db.collection('settings').doc('practiceTracker')") || !tracker.includes("auth.signInWithEmailAndPassword") || !tracker.includes("profile.data().role")) {
  failures++;
  console.error('FAIL: tracker must use shared practice names, protected Firebase login and the authorised tracker settings document');
} else console.log('PASS: tracker uses shared categories, authenticated access and the existing protected settings document');
if (/SAMPLE_PRACTICES|seedPracticesIfEmpty|addPractice\(|deletePractice\(|PRACTICES_COLL\s*=\s*['"]practices/.test(tracker)) {
  failures++;
  console.error('FAIL: legacy sample practice seeding or independent practice CRUD remains in the tracker');
} else console.log('PASS: legacy tracker practice records and sample seeding have been removed from the application');


if (!adminHtml.includes('id="changePasswordBtn"') || !adminHtml.includes('id="changeOwnPasswordForm"') || !adminJs.includes('reauthenticateWithCredential') || !adminJs.includes('updatePassword(next)')) {
  failures++;
  console.error('FAIL: admin self-service password change must reauthenticate and update the Firebase Auth password');
} else console.log('PASS: admin can securely change their password after reauthentication');
const financePasswordPage = fs.readFileSync('finance.html', 'utf8');
if (!financePasswordPage.includes('id="changePasswordBtn"') || !financePasswordPage.includes('id="changePasswordForm"') || !financePasswordPage.includes('reauthenticateWithCredential') || !financePasswordPage.includes('updatePassword(next)')) {
  failures++;
  console.error('FAIL: finance self-service password change must reauthenticate and update the Firebase Auth password');
} else console.log('PASS: finance users can securely change their password after reauthentication');
if (!client.includes('reauthenticateWithCredential') || !client.includes('updatePassword(newPwd)') || !tracker.includes('reauthenticateWithCredential') || !tracker.includes('updatePassword(next)')) {
  failures++;
  console.error('FAIL: client portal and practice tracker password-change flows are incomplete');
} else console.log('PASS: client portal and practice tracker include reauthenticated password changes');

if (failures) process.exit(1);
console.log('All static security/syntax checks passed.');
