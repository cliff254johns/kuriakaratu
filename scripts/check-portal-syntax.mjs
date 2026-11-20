import fs from 'node:fs';
import vm from 'node:vm';

const files = ['admin.js', 'admin-v2.js', 'generator.js', 'sw.js'];
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

for (const file of ['index.html', 'client.html', 'finance.html']) {
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
if (/whatsapp-float|home-whatsapp-float|request-float|apk-download-float|Download Our App/i.test(homepage)) {
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

if (failures) process.exit(1);
console.log('All static security/syntax checks passed.');
