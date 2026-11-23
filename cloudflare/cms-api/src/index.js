const ALLOWED_TYPES = new Set(['home_banner','practice','team','insight','conference_paper','newsletter','page','media']);
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'vary': 'Origin' } });
}
function claimsFromToken(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part));
  } catch { return null; }
}
function uidFromToken(token) {
  const claims = claimsFromToken(token);
  return claims && (claims.user_id || claims.sub) || null;
}
async function authorize(request, allowedRoles = ['cms_admin','public_admin']) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const claims = claimsFromToken(token);
  const uid = claims && (claims.user_id || claims.sub);
  if (!token || !uid || claims.email_verified !== true) return null;
  const url = 'https://firestore.googleapis.com/v1/projects/kuriakaratu-b5c90/databases/(default)/documents/users/' + encodeURIComponent(uid);
  const response = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  if (!response.ok) return null;
  const doc = await response.json();
  const role = doc.fields?.role?.stringValue || doc.fields?.userRole?.stringValue || '';
  if (!allowedRoles.includes(role)) return null;
  return { uid, role };
}
function cleanText(value, max) { return String(value ?? '').trim().slice(0, max); }
function validSlug(value) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value); }
function validPublicUrl(value) { if (!value) return true; try { return ['https:','http:'].includes(new URL(value).protocol); } catch { return false; } }

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '*';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-max-age': '86400', 'vary': 'Origin' } });
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'kuriakaratu-public-cms', storage: 'cloudflare-d1' }, 200, origin);
    if (url.pathname === '/api/content' && request.method === 'GET') {
      const type = url.searchParams.get('type');
      if (type && !ALLOWED_TYPES.has(type)) return json({ error: 'Invalid content type' }, 400, origin);
      const rows = type
        ? await env.CMS_DB.prepare('SELECT * FROM cms_content WHERE type = ? AND status = ? ORDER BY sort_order ASC, updated_at DESC').bind(type, 'published').all()
        : await env.CMS_DB.prepare('SELECT * FROM cms_content WHERE status = ? ORDER BY type ASC, sort_order ASC, updated_at DESC').bind('published').all();
      return json({ items: rows.results || [] }, 200, origin);
    }
    if (url.pathname === '/api/portal/verified' && request.method === 'POST') {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const claims = claimsFromToken(token);
      const uid = claims && (claims.user_id || claims.sub);
      if (!uid) return json({ error: 'Sign in again to verify your account.' }, 401, origin);
      if (claims.email_verified !== true || !claims.email) {
        return json({ error: 'Verify your email address before requesting automatic client linking.' }, 403, origin);
      }
      // Firestore validates the Firebase ID token and permits this user to read only
      // their own portal account document. No service-account credential is required.
      const profileResponse = await fetch('https://firestore.googleapis.com/v1/projects/kuriakaratu-b5c90/databases/(default)/documents/clientAccounts/' + encodeURIComponent(uid), {
        headers: { authorization: 'Bearer ' + token }
      });
      if (!profileResponse.ok) return json({ error: 'Could not verify your portal registration. Sign in again.' }, 401, origin);
      const profile = await profileResponse.json();
      const fields = profile.fields || {};
      const email = String(fields.email?.stringValue || '').trim().toLowerCase();
      const name = cleanText(fields.name?.stringValue, 180);
      const phone = cleanText(fields.phone?.stringValue, 40);
      if (email !== String(claims.email).trim().toLowerCase() || !name || !phone) {
        return json({ error: 'Your verified email and registration details do not match.' }, 403, origin);
      }
      const now = new Date().toISOString();
      await env.CMS_DB.prepare("INSERT INTO portal_link_queue (uid,email,name,phone,verified_at,status) VALUES (?,?,?,?,?,'pending') ON CONFLICT(uid) DO UPDATE SET email=excluded.email,name=excluded.name,phone=excluded.phone,verified_at=excluded.verified_at,status=CASE WHEN portal_link_queue.status='linked' THEN 'linked' ELSE 'pending' END")
        .bind(uid, email, name, phone, now).run();
      return json({ ok: true, status: 'verified_pending_link' }, 202, origin);
    }
    if (!url.pathname.startsWith('/api/admin/')) return json({ error: 'Not found' }, 404, origin);
    if (url.pathname === '/api/admin/portal-queue' && request.method === 'GET') {
      const portalActor = await authorize(request, ['admin','developer']);
      if (!portalActor) return json({ error: 'Only an authorised firm admin or developer may process portal linking.' }, 403, origin);
      const rows = await env.CMS_DB.prepare("SELECT uid,email,name,phone,verified_at,status FROM portal_link_queue WHERE status='pending' ORDER BY verified_at ASC").all();
      return json({ items: rows.results || [] }, 200, origin);
    }
    const queueParts = url.pathname.split('/');
    const queueUid = queueParts.length === 6 && queueParts[1] === 'api' && queueParts[2] === 'admin' && queueParts[3] === 'portal-queue' && queueParts[5] === 'complete' ? queueParts[4] : null;
    if (queueUid && request.method === 'POST') {
      const portalActor = await authorize(request, ['admin','developer']);
      if (!portalActor) return json({ error: 'Only an authorised firm admin or developer may process portal linking.' }, 403, origin);
      const now = new Date().toISOString();
      await env.CMS_DB.prepare("UPDATE portal_link_queue SET status='linked',processed_at=? WHERE uid=?").bind(now,queueUid).run();
      return json({ ok: true }, 200, origin);
    }
    const actor = await authorize(request);
    if (!actor) return json({ error: 'Unauthorized. Sign in with the separate public CMS administrator account.' }, 401, origin);
    if (url.pathname === '/api/admin/content' && request.method === 'GET') {
      const rows = await env.CMS_DB.prepare('SELECT * FROM cms_content ORDER BY updated_at DESC').all();
      return json({ items: rows.results || [] }, 200, origin);
    }
    if (url.pathname === '/api/admin/content' && request.method === 'POST') {
      const body = await request.json();
      const id = crypto.randomUUID();
      const type = cleanText(body.type, 40);
      const title = cleanText(body.title, 180);
      const slug = cleanText(body.slug, 180).toLowerCase();
      if (!ALLOWED_TYPES.has(type) || !title || !validSlug(slug)) return json({ error: 'Provide a valid type, title and URL slug.' }, 400, origin);
      if (!validPublicUrl(body.image_url) || !validPublicUrl(body.document_url)) return json({ error: 'Image and document URLs must use HTTP or HTTPS.' }, 400, origin);
      const now = new Date().toISOString();
      const status = body.status === 'published' ? 'published' : 'draft';
      try {
        await env.CMS_DB.prepare('INSERT INTO cms_content (id,type,title,slug,summary,body,image_url,document_url,status,sort_order,seo_title,seo_description,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id,type,title,slug,cleanText(body.summary,1000),cleanText(body.body,30000),cleanText(body.image_url,2000),cleanText(body.document_url,2000),status,Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,cleanText(body.seo_title,180),cleanText(body.seo_description,320),now,now,status === 'published' ? now : null).run();
      } catch (e) { return json({ error: 'Could not save content. Check that the URL slug is unique.' }, 409, origin); }
      await env.CMS_DB.prepare('INSERT INTO cms_audit (id,actor_uid,action,content_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor.uid,'create',id,now).run();
      return json({ ok: true, id }, 201, origin);
    }
    const match = url.pathname.match(/^\/api\/admin\/content\/([a-f0-9-]+)$/i);
    if (match && request.method === 'PUT') {
      const id = match[1], body = await request.json(), now = new Date().toISOString();
      const type = cleanText(body.type,40), title = cleanText(body.title,180), slug = cleanText(body.slug,180).toLowerCase();
      if (!ALLOWED_TYPES.has(type) || !title || !validSlug(slug)) return json({ error: 'Invalid content fields.' }, 400, origin);
      if (!validPublicUrl(body.image_url) || !validPublicUrl(body.document_url)) return json({ error: 'Image and document URLs must use HTTP or HTTPS.' }, 400, origin);
      const status = ['draft','published','archived'].includes(body.status) ? body.status : 'draft';
      const existing = await env.CMS_DB.prepare('SELECT published_at FROM cms_content WHERE id = ?').bind(id).first();
      if (!existing) return json({ error: 'Content not found.' }, 404, origin);
      try {
        await env.CMS_DB.prepare('UPDATE cms_content SET type=?,title=?,slug=?,summary=?,body=?,image_url=?,document_url=?,status=?,sort_order=?,seo_title=?,seo_description=?,updated_at=?,published_at=? WHERE id=?')
          .bind(type,title,slug,cleanText(body.summary,1000),cleanText(body.body,30000),cleanText(body.image_url,2000),cleanText(body.document_url,2000),status,Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,cleanText(body.seo_title,180),cleanText(body.seo_description,320),now,status === 'published' ? (existing.published_at || now) : null,id).run();
      } catch { return json({ error: 'Could not update content. Check that the URL slug is unique.' }, 409, origin); }
      await env.CMS_DB.prepare('INSERT INTO cms_audit (id,actor_uid,action,content_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor.uid,'update',id,now).run();
      return json({ ok: true, id }, 200, origin);
    }
    if (match && request.method === 'DELETE') {
      const now = new Date().toISOString();
      await env.CMS_DB.prepare("UPDATE cms_content SET status='archived',updated_at=? WHERE id=?").bind(now,match[1]).run();
      await env.CMS_DB.prepare('INSERT INTO cms_audit (id,actor_uid,action,content_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor.uid,'archive',match[1],now).run();
      return json({ ok: true }, 200, origin);
    }
    return json({ error: 'Not found' }, 404, origin);
  }
};