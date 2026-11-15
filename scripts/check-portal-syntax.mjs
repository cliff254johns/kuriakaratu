import fs from 'node:fs';
import vm from 'node:vm';

const files = ['admin.js', 'admin-v2.js', 'generator.js'];
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

for (const file of ['client.html', 'finance.html']) {
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
if (failures) process.exit(1);
console.log('All static security/syntax checks passed.');
