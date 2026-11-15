
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(function(reg) { console.log('Service Worker registered:', reg.scope); })
            .catch(function(err) { console.warn('Service Worker registration failed:', err); });
    });
}

let deferredPrompt = null;
const pwaBanner = document.getElementById('pwaInstallBanner');
const pwaInstallBtn = document.getElementById('pwaInstallBtn');
const pwaDismissBtn = document.getElementById('pwaDismissBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!localStorage.getItem('kk_pwa_dismissed')) { if (pwaBanner) pwaBanner.classList.add('show'); }
});

if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('PWA install outcome:', outcome);
        deferredPrompt = null;
        if (pwaBanner) pwaBanner.classList.remove('show');
    });
}

if (pwaDismissBtn) {
    pwaDismissBtn.addEventListener('click', () => {
        if (pwaBanner) pwaBanner.classList.remove('show');
        localStorage.setItem('kk_pwa_dismissed', '1');
    });
}

window.addEventListener('appinstalled', () => {
    console.log('PWA installed');
    if (pwaBanner) pwaBanner.classList.remove('show');
    deferredPrompt = null;
});

(function initKKApp() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK failed to load.');
        alert('Failed to load Firebase. Please refresh or check your connection.');
        return;
    }
   

    const firebaseConfig = {
        apiKey: "AIzaSyAv35HANTesz9EqroXt3QaHpYvZwk2fa3o",
        authDomain: "kuriakaratu-b5c90.firebaseapp.com",
        databaseURL: "https://kuriakaratu-b5c90-default-rtdb.firebaseio.com",
        projectId: "kuriakaratu-b5c90",
        storageBucket: "kuriakaratu-b5c90.firebasestorage.app",
        messagingSenderId: "14852374326",
        appId: "1:14852374326:web:b171bd36719d8700953d97"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        if (err.code === 'failed-precondition') console.warn('Persistence failed: multiple tabs open');
        else if (err.code === 'unimplemented') console.warn('Persistence not available');
    });
    
    // ============================================================
// SAFE DOM HELPERS — prevents "Cannot read properties of null" crashes
// ============================================================
const $  = (id) => document.getElementById(id);
const el = (id) => document.getElementById(id);
const bindClick  = (id, fn) => { const n = $(id); if (n) n.addEventListener('click', fn); };
const bindSubmit = (id, fn) => { const n = $(id); if (n) n.addEventListener('submit', fn); };
const bindInput  = (id, fn) => { const n = $(id); if (n) n.addEventListener('input', fn); };
const bindChange = (id, fn) => { const n = $(id); if (n) n.addEventListener('change', fn); };
const setText    = (id, val) => { const n = $(id); if (n) n.textContent = val; };
const setHtml    = (id, val) => { const n = $(id); if (n) n.innerHTML = val; };
const setVal     = (id, val) => { const n = $(id); if (n) n.value = val; };
const getVal     = (id) => { const n = $(id); return n ? n.value : ''; };
const getChecked = (id) => { const n = $(id); return n ? n.checked : false; };

    const IDB_NAME = 'KKFiles';
    const IDB_STORE = 'files';
    const fileStore = {};

    function openIDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const idb = e.target.result;
                if (!idb.objectStoreNames.contains(IDB_STORE)) { idb.createObjectStore(IDB_STORE, { keyPath: 'fileId' }); }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function saveFileToIndexedDB(fileId, dataUrl) {
        try {
            const idb = await openIDB();
            return new Promise((resolve) => {
                const tx = idb.transaction(IDB_STORE, 'readwrite');
                tx.objectStore(IDB_STORE).put({ fileId, dataUrl });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (err) { console.warn('IndexedDB save error:', err); return false; }
    }

    async function deleteFileFromIndexedDB(fileId) {
        try {
            const idb = await openIDB();
            return new Promise((resolve) => {
                const tx = idb.transaction(IDB_STORE, 'readwrite');
                tx.objectStore(IDB_STORE).delete(fileId);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (err) { console.warn('IndexedDB delete error:', err); return false; }
    }

    async function restoreFileStoreFromPersistence() {
        try {
            const idb = await openIDB();
            return new Promise((resolve) => {
                const tx = idb.transaction(IDB_STORE, 'readonly');
                const req = tx.objectStore(IDB_STORE).getAll();
                req.onsuccess = () => {
                    (req.result || []).forEach(item => { if (item && item.fileId && item.dataUrl) fileStore[item.fileId] = item.dataUrl; });
                    console.log(`Restored ${(req.result || []).length} files from IndexedDB.`);
                    resolve();
                };
                req.onerror = () => resolve();
            });
        } catch (err) { console.warn('Could not restore file store:', err); }
    }

let portalRequestsData = [];
let portalAccountsData = [];
let portalRequestsUnsub = null;
let portalAccountsUnsub = null;

function renderPortalRequests() {
    const tbody = document.getElementById('portalRequestsBody');
    const countLabel = document.getElementById('portalCountLabel');
    const statusFilter = document.getElementById('portalStatusFilter')?.value || 'pending';
    let filtered = portalRequestsData;
    if (statusFilter !== 'all') filtered = filtered.filter(r => (r.status || 'pending') === statusFilter);
    filtered.sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
    if (countLabel) countLabel.textContent = `${filtered.length} request${filtered.length !== 1 ? 's' : ''}`;
    if (!tbody) return;
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:1.5rem;">No ${statusFilter === 'all' ? '' : statusFilter} requests.</td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map(r => {
        const statusClass = r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow';
        const isPending = !r.status || r.status === 'pending';
        return `<tr>
            <td><strong>${r.name || '—'}</strong></td>
            <td>${r.email || '—'}</td>
            <td>${r.phone || '—'}</td>
            <td>${r.caseRef || '—'}</td>
            <td>${(r.requestedAt || '').slice(0, 16)}</td>
            <td><span class="badge ${statusClass}">${r.status || 'pending'}</span></td>
            <td style="text-align:center;white-space:nowrap;">
                ${isPending ? `<button class="btn btn-success btn-sm" onclick="openApprovePortalModal('${r.uid}')"><i class="fas fa-check"></i> Approve</button>` : ''}
                ${isPending ? `<button class="btn btn-danger btn-sm" onclick="rejectPortalRequest('${r.uid}')"><i class="fas fa-times"></i></button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="deletePortalRequest('${r.uid}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function renderPortalAccounts() {
    const tbody = document.getElementById('portalAccountsBody');
    if (!tbody) return;
    const approved = portalAccountsData.filter(a => a.approved);
    if (!approved.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:1.5rem;">No approved portal accounts yet.</td></tr>`;
        return;
    }
    approved.sort((a, b) => (b.approvedAt || '').localeCompare(a.approvedAt || ''));
    tbody.innerHTML = approved.map(a => {
        const linkedClient = clientsData.find(c => c.id === a.clientId);
        return `<tr>
            <td><strong>${a.name || '—'}</strong></td>
            <td>${a.email || '—'}</td>
            <td>${linkedClient ? `<span class="badge blue">${linkedClient.name}</span>` : '<span class="badge red">Unlinked</span>'}</td>
            <td>${(a.approvedAt || '').slice(0, 16)}</td>
            <td>${(a.lastSignIn || '—').slice(0, 16)}</td>
            <td style="text-align:center;white-space:nowrap;">
                <button class="btn btn-warning btn-sm" onclick="openChangePortalLinkModal('${a.uid}')"><i class="fas fa-link"></i></button>
                <button class="btn btn-danger btn-sm" onclick="revokePortalAccess('${a.uid}')"><i class="fas fa-ban"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function updatePortalBadge() {
    const badge = document.getElementById('portalRequestsBadge');
    if (!badge) return;
    const pendingCount = portalRequestsData.filter(r => !r.status || r.status === 'pending').length;
    if (pendingCount > 0) { badge.textContent = pendingCount; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
}

function listenPortalRequests() {
    if (portalRequestsUnsub) portalRequestsUnsub();
    portalRequestsUnsub = db.collection('portalRequests').onSnapshot(snap => {
        portalRequestsData = [];
        snap.forEach(doc => { const d = doc.data(); d.uid = doc.id; portalRequestsData.push(d); });
        if (currentPage === 'portal') renderPortalRequests();
        updatePortalBadge();
    });
}

function listenPortalAccounts() {
    if (portalAccountsUnsub) portalAccountsUnsub();
    portalAccountsUnsub = db.collection('clientAccounts').onSnapshot(snap => {
        portalAccountsData = [];
        snap.forEach(doc => { const d = doc.data(); d.uid = doc.id; portalAccountsData.push(d); });
        if (currentPage === 'portal') renderPortalAccounts();
    });
}

async function loadPortalRequests() {
    if (!isFullAccess()) { showToast('Access denied.', 'warning'); return; }
    renderPortalRequests();
    renderPortalAccounts();
}

function openApprovePortalModal(uid) {
    if (!isFullAccess()) { showToast('Only admins and developers can approve.', 'warning'); return; }
    const req = portalRequestsData.find(r => r.uid === uid);
    if (!req) { showToast('Request not found.', 'error'); return; }
    let matchedClient = clientsData.find(c => (c.email || '').toLowerCase() === (req.email || '').toLowerCase());
    if (!matchedClient && req.phone) matchedClient = clientsData.find(c => (c.phone || '').replace(/\s/g, '') === req.phone.replace(/\s/g, ''));
    const existing = document.getElementById('approvePortalModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'approvePortalModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal" style="max-width: 550px;">
            <div class="modal-header">
                <h2><i class="fas fa-user-check"></i> Approve Portal Access</h2>
                <button class="modal-close" onclick="closeModal('approvePortalModal')">&times;</button>
            </div>
            <div class="permission-note" style="margin-bottom:1rem;">
                <i class="fas fa-info-circle"></i>
                Link this portal user to an existing <strong>client record</strong>. The client will immediately see all cases, invoices, documents, payments, and appointments tied to that client record.
            </div>
            <div style="background:#f8fafc;padding:0.75rem;border-radius:0.5rem;border:1px solid #e9edf2;margin-bottom:1rem;font-size:0.85rem;">
                <div><strong>Name:</strong> ${req.name || '—'}</div>
                <div><strong>Email:</strong> ${req.email || '—'}</div>
                <div><strong>Phone:</strong> ${req.phone || '—'}</div>
                <div><strong>Case Ref:</strong> ${req.caseRef || '—'}</div>
            </div>
            <div class="form-group">
                <label>Link to Client Record *</label>
                <select id="approvePortalClientSelect" required style="width:100%;padding:0.5rem;border:1px solid #d1d9e6;border-radius:0.5rem;">
                    <option value="">— Select a client —</option>
                    ${clientsData.map(c => `<option value="${c.id}" ${matchedClient && matchedClient.id === c.id ? 'selected' : ''}>${c.name} ${c.email ? '• ' + c.email : ''} ${c.phone ? '• ' + c.phone : ''}</option>`).join('')}
                </select>
                ${matchedClient ? `<div class="fs-small" style="color:#22c55e;margin-top:0.3rem;"><i class="fas fa-check-circle"></i> Auto-matched to <strong>${matchedClient.name}</strong></div>` : ''}
            </div>
            <div class="form-group">
                <label style="display:flex;align-items:center;gap:0.4rem;">
                    <input type="checkbox" id="approveCreateNewClient" style="width:auto;"> 
                    <span>Or create a new client from this request</span>
                </label>
            </div>
            <div id="newClientFields" style="display:none;background:#f0f7ff;padding:0.75rem;border-radius:0.5rem;border:1px solid #dbeafe;margin-bottom:0.75rem;">
                <div class="form-group"><label>Client Name *</label><input type="text" id="approveNewClientName" value="${req.name || ''}"></div>
                <div class="form-group"><label>Client Email</label><input type="email" id="approveNewClientEmail" value="${req.email || ''}"></div>
                <div class="form-group"><label>Client Phone</label><input type="tel" id="approveNewClientPhone" value="${req.phone || ''}"></div>
            </div>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;flex-wrap:wrap;">
                <button type="button" class="btn btn-outline" onclick="closeModal('approvePortalModal')">Cancel</button>
                <button type="button" class="btn btn-success" onclick="confirmApprovePortal('${uid}')"><i class="fas fa-check"></i> Approve & Link</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const createNewCheckbox = document.getElementById('approveCreateNewClient');
    const newFields = document.getElementById('newClientFields');
    const clientSelect = document.getElementById('approvePortalClientSelect');
    createNewCheckbox.addEventListener('change', function() {
        newFields.style.display = this.checked ? 'block' : 'none';
        clientSelect.disabled = this.checked;
        if (this.checked) clientSelect.value = '';
    });
}

async function confirmApprovePortal(uid) {
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const req = portalRequestsData.find(r => r.uid === uid);
    if (!req) { showToast('Request not found.', 'error'); return; }
    const createNewEl = $('approveCreateNewClient');
    if (!createNewEl) { showToast('Approval modal not loaded.', 'error'); return; }
    const createNew = createNewEl.checked;
    let clientId = null;
    let clientName = '';
    if (createNew) {
        const name = getVal('approveNewClientName').trim();
        if (!name) { showToast('Client name is required.', 'warning'); return; }
        const newClient = {
            name: name,
            email: getVal('approveNewClientEmail').trim(),
            phone: getVal('approveNewClientPhone').trim(),
            address: '', notes: 'Created from client portal signup.',
            createdAt: getToday(),
            expenses: [], documents: [], docRequests: [],
            feeAgreement: emptyFeeAgreement()
        };
        clientId = await addClientToFirestore(newClient);
        if (!clientId) { showToast('Failed to create client.', 'error'); return; }
        clientName = name;
    } else {
               clientId = getVal('approvePortalClientSelect');
        if (!clientId) { showToast('Please select a client record.', 'warning'); return; }
        const c = clientsData.find(x => x.id === clientId);
        clientName = c ? c.name : '';
    }
    try {
        await db.collection('clientAccounts').doc(uid).update({ approved: true, clientId: clientId, approvedAt: getDateTime(), approvedBy: currentUserEmail });
        await db.collection('portalRequests').doc(uid).update({ status: 'approved', clientId: clientId, reviewedAt: getDateTime(), reviewedBy: currentUserEmail });
        await logActivity('Approved Portal Access', `${req.name || req.email} → Client: ${clientName}`);
        showToast(`Portal access approved for ${req.name || req.email}.`, 'info');
        closeModal('approvePortalModal');
    } catch (e) { showToast('Failed to approve: ' + e.message, 'error'); }
}

async function rejectPortalRequest(uid) {
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const req = portalRequestsData.find(r => r.uid === uid);
    if (!req) return;
    if (!confirm(`Reject portal access for ${req.name || req.email}?`)) return;
    try {
        await db.collection('portalRequests').doc(uid).update({ status: 'rejected', reviewedAt: getDateTime(), reviewedBy: currentUserEmail });
        await db.collection('clientAccounts').doc(uid).update({ approved: false, rejected: true, rejectedAt: getDateTime() });
        await logActivity('Rejected Portal Access', req.email || uid);
        showToast('Request rejected.', 'info');
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

async function deletePortalRequest(uid) {
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    if (!confirm('Delete this portal request record permanently?')) return;
    try { await db.collection('portalRequests').doc(uid).delete(); showToast('Request record deleted.', 'info'); }
    catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

function openChangePortalLinkModal(uid) {
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const account = portalAccountsData.find(a => a.uid === uid);
    if (!account) return;
    const existing = document.getElementById('changePortalLinkModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'changePortalLinkModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal" style="max-width: 500px;">
            <div class="modal-header">
                <h2><i class="fas fa-link"></i> Change Linked Client</h2>
                <button class="modal-close" onclick="closeModal('changePortalLinkModal')">&times;</button>
            </div>
            <div style="background:#f8fafc;padding:0.75rem;border-radius:0.5rem;border:1px solid #e9edf2;margin-bottom:1rem;font-size:0.85rem;">
                <div><strong>Portal User:</strong> ${account.name || '—'}</div>
                <div><strong>Email:</strong> ${account.email || '—'}</div>
            </div>
            <div class="form-group">
                <label>Link to Client Record *</label>
                <select id="changeLinkClientSelect" style="width:100%;padding:0.5rem;border:1px solid #d1d9e6;border-radius:0.5rem;">
                    <option value="">— Select a client —</option>
                    ${clientsData.map(c => `<option value="${c.id}" ${account.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button type="button" class="btn btn-outline" onclick="closeModal('changePortalLinkModal')">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="confirmChangePortalLink('${uid}')"><i class="fas fa-save"></i> Save</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function confirmChangePortalLink(uid) {
       const clientId = getVal('changeLinkClientSelect');
    if (!clientId) { showToast('Please select a client.', 'warning'); return; }
    try {
        await db.collection('clientAccounts').doc(uid).update({ clientId: clientId, updatedAt: getDateTime(), updatedBy: currentUserEmail });
        await db.collection('portalRequests').doc(uid).update({ clientId: clientId }).catch(() => {});
        await logActivity('Changed Portal Link', `User: ${uid} → Client: ${clientId}`);
        showToast('Portal link updated.', 'info');
        closeModal('changePortalLinkModal');
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

async function revokePortalAccess(uid) {
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const account = portalAccountsData.find(a => a.uid === uid);
    if (!account) return;
    if (!confirm(`Revoke portal access for ${account.name || account.email}?`)) return;
    try {
        await db.collection('clientAccounts').doc(uid).update({ approved: false, clientId: null, revokedAt: getDateTime(), revokedBy: currentUserEmail });
        await logActivity('Revoked Portal Access', account.email || uid);
        showToast('Access revoked.', 'info');
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

const LOGO_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
    '<circle cx="60" cy="60" r="56" fill="#0f172a"/>' +
    '<text x="60" y="58" font-size="30" text-anchor="middle" fill="#60a5fa" font-family="Georgia,serif" font-weight="700">KK</text>' +
    '<text x="60" y="82" font-size="11" text-anchor="middle" fill="#e2e8f0" font-family="Arial,sans-serif">ADVOCATES</text>' +
    '</svg>');
let companyLogoBase64 = '';
const LOGO_LS_KEY = 'kk_company_logo_b64';

async function loadCompanyLogoFromFirestore() {
    try {
        const cached = localStorage.getItem(LOGO_LS_KEY);
        if (cached && cached.length > 50) companyLogoBase64 = cached;
        const doc = await db.collection('settings').doc('company').get();
        if (doc.exists && doc.data().logoBase64) {
            companyLogoBase64 = doc.data().logoBase64;
            localStorage.setItem(LOGO_LS_KEY, companyLogoBase64);
        }
                updateLogoPreview();
        applyCompanyLogoEverywhere();
    } catch (e) { console.warn('Could not load logo from Firestore:', e); }
}

function updateLogoPreview() {
    const img = document.getElementById('logoPreviewImg');
    const empty = document.getElementById('logoPreviewEmpty');
    if (!img) return;
    if (companyLogoBase64) { img.src = companyLogoBase64; img.style.display = 'block'; if (empty) empty.style.display = 'none'; }
    else { img.style.display = 'none'; if (empty) empty.style.display = 'block'; }
}

function logoImgTag(extraStyle) {
    const src = companyLogoBase64 || LOGO_FALLBACK;
    const style = extraStyle || 'height:70px;width:auto;object-fit:contain;';
    return '<img src="' + src + '" alt="Kuria Karatu" class="invoice-logo" style="' + style + '">';
}

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(err => console.warn('Persistence error:', err));

let isSeeding = false;

const DEFAULT_USERS = [
    { email: 'admin@kuriakaratu.com', password: 'admin123', role: 'admin' },
   
    { email: 'clerk@kuriakaratu.com', password: 'clerk123', role: 'clerk' }
];

let authStateReady = false;
auth.onAuthStateChanged(user => {
    if (isSeeding) return;
    if (!authStateReady) return;  // wait until seeding is done
    const overlay = document.getElementById('loginOverlay');
    const app = document.getElementById('mainApp');
    if (user) {
        auth.signOut().catch(err => console.warn('SignOut error:', err));
    } else {
        if (overlay) overlay.classList.remove('hidden');
        if (app) app.style.display = 'none';
    }
});
// Start seeding immediately after handler is attached
seedDefaultUsers().catch(err => console.error('seedDefaultUsers failed:', err));

// Watchdog: never leave the user stuck on "loading users"
setTimeout(() => {
    const loadingEl = document.getElementById('loginLoading');
    if (loadingEl && loadingEl.style.display !== 'none') {
        loadingEl.style.display = 'none';
    }
    const sel = document.getElementById('loginEmailSelect');
    if (sel && (!sel.options.length || sel.options.length <= 1)) {
        usersData = DEFAULT_USERS.map(u => ({ id: u.email, email: u.email, role: u.role }));
        populateLoginDropdown();
    }
}, 8000);
async function seedDefaultUsers() {
    isSeeding = true;
    const loadingEl = document.getElementById('loginLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
        // 1. Try to read existing users (may be blocked by rules — that's OK)
        const existing = new Set();
        try {
            const snap = await db.collection('users').get();
            snap.forEach(d => { const e = d.data().email; if (e) existing.add(e); });
        } catch (e) {
            console.warn('Cannot read users collection (rules?):', e.code || e.message);
        }

        // 2. Create only the ones that are missing
        for (const u of DEFAULT_USERS) {
            if (existing.has(u.email)) continue;
            try {
                const cred = await auth.createUserWithEmailAndPassword(u.email, u.password);
                await db.collection('users').doc(cred.user.uid).set({
                    email: u.email, role: u.role,
                    createdAt: getDateTime(), lastLogin: null
                });
                await auth.signOut();
            } catch (err) {
                console.warn('Seed skipped for', u.email, err.code || err.message);
            }
        }
    } catch (err) {
        console.error('Error seeding users:', err);
    } finally {
        try { if (auth.currentUser) await auth.signOut(); } catch (e) {}
        isSeeding = false;

        if (loadingEl) loadingEl.style.display = 'none';

        await loadUsersForLogin();
        const overlay = document.getElementById('loginOverlay');
        const app = document.getElementById('mainApp');
        if (overlay) overlay.classList.remove('hidden');
        if (app) app.style.display = 'none';
    }
}

/* ============================================================
   GLOBAL LOGO PROPAGATION
   Applies the saved company logo to every location that
   shows a brand mark: login, sidebar, PWA banner, favicon,
   apple-touch-icon, and any element with [data-brand-logo].
   ============================================================ */
function applyCompanyLogoEverywhere() {
    const src = companyLogoBase64 || LOGO_FALLBACK;

    /* ---- 1. Login screen ---- */
    const loginImg  = document.getElementById('loginLogoImg');
    const loginIcon = document.getElementById('loginLogoIcon');
    if (loginImg) {
        if (companyLogoBase64) {
            loginImg.src = companyLogoBase64;
            loginImg.style.display = 'inline-block';
            if (loginIcon) loginIcon.style.display = 'none';
        } else {
            loginImg.style.display = 'none';
            if (loginIcon) loginIcon.style.display = 'inline-block';
        }
    }

    /* ---- 2. Sidebar brand ---- */
    const sideImg  = document.getElementById('sidebarLogoImg');
    const sideIcon = document.getElementById('sidebarLogoIcon');
    if (sideImg) {
        if (companyLogoBase64) {
            sideImg.src = companyLogoBase64;
            sideImg.style.display = 'inline-block';
            if (sideIcon) sideIcon.style.display = 'none';
        } else {
            sideImg.style.display = 'none';
            if (sideIcon) sideIcon.style.display = 'inline-block';
        }
    }

    /* ---- 3. PWA install banner ---- */
    const pwaImg  = document.getElementById('pwaLogoImg');
    const pwaIcon = document.getElementById('pwaLogoIcon');
    if (pwaImg) {
        if (companyLogoBase64) {
            pwaImg.src = companyLogoBase64;
            pwaImg.style.display = 'inline-block';
            if (pwaIcon) pwaIcon.style.display = 'none';
        } else {
            pwaImg.style.display = 'none';
            if (pwaIcon) pwaIcon.style.display = 'inline-block';
        }
    }

    /* ---- 4. Favicon + Apple touch icon ---- */
    if (companyLogoBase64) {
        const fav32  = document.getElementById('favicon32');
        const fav16  = document.getElementById('favicon16');
        const apple  = document.getElementById('appleTouchIcon');
        if (fav32)  fav32.href  = companyLogoBase64;
        if (fav16)  fav16.href  = companyLogoBase64;
        if (apple)  apple.href  = companyLogoBase64;

        // Also set a dynamic favicon in case the HTML ones are missing
        let dynFav = document.getElementById('dynamicFavicon');
        if (!dynFav) {
            dynFav = document.createElement('link');
            dynFav.id = 'dynamicFavicon';
            dynFav.rel = 'icon';
            document.head.appendChild(dynFav);
        }
        dynFav.href = companyLogoBase64;
    }

    /* ---- 5. Any element marked with data-brand-logo ---- */
    document.querySelectorAll('[data-brand-logo]').forEach(img => {
        img.src = src;
    });

    /* ---- 6. Update the browser tab title icon cache ---- */
    // (Chrome caches the tab icon; re-inserting forces a refresh)
    if (companyLogoBase64) {
        document.querySelectorAll('link[rel="icon"]').forEach(l => {
            const href = l.href;
            l.href = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
            setTimeout(() => { l.href = companyLogoBase64; }, 20);
        });
    }
}
window.applyCompanyLogoEverywhere = applyCompanyLogoEverywhere;

async function loadUsersForLogin() {
    usersData = [];
    try {
        const snap = await db.collection('users').get();
        snap.forEach(doc => {
            const d = doc.data();
            d.id = doc.id;
            if (d.email && d.email !== 'user@kuriakaratu.com') usersData.push(d);
        });
    } catch (e) {
        console.warn('Failed to load users from Firestore:', e.code || e.message);
    }

    // Fallback: if Firestore gave us nothing, still let the admin in.
    if (!usersData.length) {
        usersData = DEFAULT_USERS.map(u => ({ id: u.email, email: u.email, role: u.role }));
        console.warn('Using DEFAULT_USERS fallback for the login dropdown.');
    }

    populateLoginDropdown();
}

function populateLoginDropdown() {
    const list = document.getElementById('loginEmailOptions');
    if (!list) return;
    const sorted = [...usersData]
        .filter(u => (u.email || '').toLowerCase() !== 'developer@kuriakaratu.com')
        .sort((a, b) => a.email.localeCompare(b.email));
    list.innerHTML = sorted.map(u =>
        `<option value="${u.email}"></option>`
    ).join('');
}

let casesData = [];
let documentsData = [];
let tasksData = [];
let clientsData = [];
let invoicesData = [];
let receiptsData = [];
let targetsData = {};
let activityLogs = [];
let usersData = [];
let accidentClientsData = [];
let accidentClientsUnsubscribe = null;
let fileStoreId = 0;
let currentPage = 'dashboard';
let currentCaseFilter = '';
let currentCaseSubFilter = '';
let currentDocFilter = '';
let currentDocSubFilter = '';

// Legacy aliases kept for compatibility with existing calls
let currentFilter = '';
let currentSubfilter = '';
let selectedCaseId = null;
let selectedClientId = null;
let selectedInvoiceId = null;
let selectedAccClientId = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let currentUser = null;
let currentUserRole = 'clerk';
let currentUserEmail = '';
let taskReminderInterval = null;
let feeReminderInterval = null;
let reminderInterval = null;

const PRACTICE_AREAS = ['ELCs', 'Criminal', 'Succession', 'Civil', 'Tribunal',
    'Divorce', 'Conveyancing', 'Running Down', 'Children', 'Employment', 'Kadhi'];
    // Default document sections tree (used only if Firestore empty)
const DEFAULT_DOC_SECTIONS = [
    { name: 'Agreements', subSections: [] },
    { name: 'Affidavits', subSections: ['Names', 'Customary Marriages', 'Lost Document', 'Forced Transfer', 'Land Transfer'] },
    { name: 'Demand', subSections: ['Debt', 'Eviction', 'Statutory Notice', 'Demand Notice'] },
    { name: 'Consent', subSections: [] },
    { name: 'Authorities', subSections: ['Interlocutory Orders', 'ELCs', 'Criminal', 'Succession', 'Civil', 'Tribunal', 'Divorce', 'Conveyancing', 'Running Down', 'Children', 'Employment'] },
    { name: 'Land', subSections: ['Transfer Documents', 'Caution', 'Application for Registration', 'Application for Land Control Board'] },
    { name: 'Acknowledgement Receipts', subSections: [] },
    { name: 'Retainer', subSections: [] },
    { name: 'General', subSections: [] }
];

let docSections = JSON.parse(JSON.stringify(DEFAULT_DOC_SECTIONS));
let docSectionsUnsub = null;
let folderPendingFiles = []; // [{ file, detectedSection, detectedSub, overrideSub }]

function isAdminOrDeveloper() { return currentUserRole === 'admin' || currentUserRole === 'developer'; }
function isFullAccess() { return isAdminOrDeveloper(); }
function isClerk() { return currentUserRole === 'clerk'; }
const CLERK_VIEWABLE_PAGES = ['documents', 'calendar', 'invoices', 'cases', 'clients'];
function canViewPage(page) { return isFullAccess() ? true : CLERK_VIEWABLE_PAGES.includes(page); }
function canDeleteDocuments() { return isFullAccess(); }
function canRecordPayments() { return isFullAccess(); }
/* ============================================================
   DOCUMENT SECTIONS — dynamic, user-editable
   ============================================================ */

function normalizeText(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function listenDocSections() {
    if (docSectionsUnsub) docSectionsUnsub();
    docSectionsUnsub = db.collection('settings').doc('docSections').onSnapshot(snap => {
        if (snap.exists && Array.isArray(snap.data().sections) && snap.data().sections.length) {
            docSections = snap.data().sections;
        } else {
            // Seed defaults on first run
            db.collection('settings').doc('docSections').set({ sections: DEFAULT_DOC_SECTIONS, updatedAt: getDateTime() }, { merge: true }).catch(() => {});
            docSections = JSON.parse(JSON.stringify(DEFAULT_DOC_SECTIONS));
        }
        renderSidebarDocumentsMenu();
        populateDocCategoryDropdowns();
        if (currentPage === 'documents') renderDocuments(currentFilter);
    }, err => {
        console.warn('docSections listener error:', err);
    });
}

async function saveDocSections() {
    try {
        await db.collection('settings').doc('docSections').set({ sections: docSections, updatedAt: getDateTime(), updatedBy: currentUserEmail }, { merge: true });
        await logActivity('Updated Document Sections', `${docSections.length} sections`);
        return true;
    } catch (e) { showToast('Failed to save sections: ' + e.message, 'error'); return false; }
}

function renderSidebarDocumentsMenu() {
    const wrap = document.getElementById('docsDrop');
    if (!wrap) return;
    wrap.innerHTML = docSections.map(sec => {
        const subs = Array.isArray(sec.subSections) ? sec.subSections : [];
        if (subs.length === 0) {
            return `<button class="nav-item" data-page="documents" data-filter="${sec.name}">${sec.name}</button>`;
        }
        const id = 'dynsub_' + normalizeText(sec.name).replace(/ /g, '_');
        return `<button class="nav-item has-dropdown" data-dropdown="${id}"><span>${sec.name}</span><span class="arrow"><i class="fas fa-chevron-right"></i></span></button>
            <div class="dropdown-wrap" id="${id}">
                <button class="nav-item" data-page="documents" data-filter="${sec.name}">All ${sec.name}</button>
                ${subs.map(sub => `<button class="nav-item" data-page="documents" data-filter="${sec.name}" data-subfilter="${sub}">${sub}</button>`).join('')}
            </div>`;
    }).join('');
    // Rebind click handlers on the new nav items
    wrap.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            if (this.dataset.dropdown) { toggleDropdown(this); return; }
            const page = this.dataset.page, filter = this.dataset.filter || '', subfilter = this.dataset.subfilter || '';
            if (page) {
                document.getElementById('globalSearchInput').value = '';
                document.getElementById('clearSearchBtn').style.display = 'none';
                document.getElementById('searchResultsDropdown').classList.remove('show');
                currentDocSubFilter = subfilter;
                navigate(page, filter, subfilter);
                document.querySelectorAll('#sidebarNav .dropdown-wrap').forEach(w => w.classList.remove('open'));
                document.querySelectorAll('#sidebarNav .has-dropdown .arrow').forEach(a => a.classList.remove('open'));
            }
        });
    });
}


function populateDocCategoryDropdowns() {
    const catSel = document.getElementById('docCategory');
    if (catSel) {
        const cur = catSel.value;
        catSel.innerHTML = '<option value="">Select...</option>' + docSections.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        if (cur) catSel.value = cur;
        onDocCategoryChange();
    }
    const folderCatSel = document.getElementById('folderCategory');
    if (folderCatSel) {
        const cur = folderCatSel.value;
        folderCatSel.innerHTML = docSections.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        if (cur) folderCatSel.value = cur;
    }
}

function onDocCategoryChange() {
    const cat = document.getElementById('docCategory')?.value || '';
    const subSel = document.getElementById('docSubCategory');
    if (!subSel) return;
    subSel.innerHTML = '<option value="">General</option>';
    const found = docSections.find(s => s.name === cat);
    if (found && Array.isArray(found.subSections)) {
        found.subSections.forEach(sub => {
            const o = document.createElement('option');
            o.value = sub;
            o.textContent = sub;
            subSel.appendChild(o);
        });
    }
}

/* ============================================================
   MANAGE SECTIONS MODAL
   ============================================================ */

function openManageSectionsModal() {
    if (!isFullAccess()) { showToast('Only admins/developers can manage sections.', 'warning'); return; }
    renderSectionsEditor();
    openModal('manageSectionsModal');
}

function renderSectionsEditor() {
    const wrap = document.getElementById('sectionsEditorList');
    if (!wrap) return;
    if (!docSections.length) { wrap.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem;">No sections yet. Add one above.</p>'; return; }
    wrap.innerHTML = docSections.map((sec, i) => {
        const subs = Array.isArray(sec.subSections) ? sec.subSections : [];
        return `<div class="section-editor-row">
            <span class="section-name">${sec.name}</span>
            <div class="section-actions">
                <button class="btn btn-outline btn-sm" onclick="moveSection(${i}, -1)" title="Move up" ${i === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                <button class="btn btn-outline btn-sm" onclick="moveSection(${i}, 1)" title="Move down" ${i === docSections.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                <button class="btn btn-primary btn-sm" onclick="renameSection(${i})"><i class="fas fa-pen"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteSection(${i})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="subs-wrap">
                ${subs.map((sub, j) => `<div class="sub-editor-row">
                    <span class="sub-name">↳ ${sub}</span>
                    <button class="btn btn-outline btn-sm" onclick="renameSubSection(${i},${j})"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-outline btn-sm" onclick="moveSubSection(${i},${j},-1)" ${j === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                    <button class="btn btn-outline btn-sm" onclick="moveSubSection(${i},${j},1)" ${j === subs.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSubSection(${i},${j})"><i class="fas fa-times"></i></button>
                </div>`).join('')}
                <div style="display:flex;gap:0.3rem;margin-top:0.35rem;">
                    <input type="text" id="newSub_${i}" placeholder="New sub-section..." style="flex:1;padding:0.3rem 0.5rem;border:1px solid #d1d9e6;border-radius:0.4rem;font-size:0.8rem;">
                    <button class="btn btn-primary btn-sm" onclick="addSubSection(${i})"><i class="fas fa-plus"></i> Add</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function addTopSection() {
    const inp = document.getElementById('newSectionName');
    const name = (inp.value || '').trim();
    if (!name) { showToast('Enter a section name.', 'warning'); return; }
    if (docSections.some(s => s.name.toLowerCase() === name.toLowerCase())) { showToast('Section already exists.', 'warning'); return; }
    docSections.push({ name: name, subSections: [] });
    await saveDocSections();
    inp.value = '';
    renderSectionsEditor();
    showToast(`Section "${name}" added.`, 'info');
}

async function renameSection(i) {
    const cur = docSections[i].name;
    const name = prompt('Rename section:', cur);
    if (!name || !name.trim() || name.trim() === cur) return;
    docSections[i].name = name.trim();
    await saveDocSections();
    renderSectionsEditor();
}

async function deleteSection(i) {
    if (!confirm(`Delete section "${docSections[i].name}" and all its sub-sections? Existing documents keep their labels.`)) return;
    docSections.splice(i, 1);
    await saveDocSections();
    renderSectionsEditor();
}

async function moveSection(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= docSections.length) return;
    const tmp = docSections[i]; docSections[i] = docSections[j]; docSections[j] = tmp;
    await saveDocSections();
    renderSectionsEditor();
}

async function addSubSection(i) {
    const inp = document.getElementById('newSub_' + i);
    const name = (inp.value || '').trim();
    if (!name) { showToast('Enter a sub-section name.', 'warning'); return; }
    if (!Array.isArray(docSections[i].subSections)) docSections[i].subSections = [];
    if (docSections[i].subSections.some(s => s.toLowerCase() === name.toLowerCase())) { showToast('Sub-section already exists.', 'warning'); return; }
    docSections[i].subSections.push(name);
    await saveDocSections();
    renderSectionsEditor();
    showToast(`Sub-section "${name}" added.`, 'info');
}

async function renameSubSection(i, j) {
    const cur = docSections[i].subSections[j];
    const name = prompt('Rename sub-section:', cur);
    if (!name || !name.trim() || name.trim() === cur) return;
    docSections[i].subSections[j] = name.trim();
    await saveDocSections();
    renderSectionsEditor();
}

async function deleteSubSection(i, j) {
    if (!confirm(`Delete sub-section "${docSections[i].subSections[j]}"?`)) return;
    docSections[i].subSections.splice(j, 1);
    await saveDocSections();
    renderSectionsEditor();
}

async function moveSubSection(i, j, delta) {
    const k = j + delta;
    const subs = docSections[i].subSections;
    if (k < 0 || k >= subs.length) return;
    const tmp = subs[j]; subs[j] = subs[k]; subs[k] = tmp;
    await saveDocSections();
    renderSectionsEditor();
}

/* ============================================================
   FOLDER UPLOAD
   ============================================================ */

function openFolderUploadModal() {
    if (!isFullAccess()) { showToast('Only admins/developers can bulk upload.', 'warning'); return; }
    folderPendingFiles = [];
    document.getElementById('folderFileInput').value = '';
    document.getElementById('folderReviewWrap').style.display = 'none';
    document.getElementById('folderProgressWrap').style.display = 'none';
    document.getElementById('folderProgressBar').style.width = '0%';
    document.getElementById('folderUploadCommitBtn').disabled = true;
    document.getElementById('folderUploadedDate').value = getToday();
    // Matter dropdown
    const matSel = document.getElementById('folderMatter');
    matSel.innerHTML = '<option value="">Select case...</option>';
    casesData.forEach(c => { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; matSel.appendChild(o); });
    const genOpt = document.createElement('option'); genOpt.value = 'General'; genOpt.textContent = 'General (No Case)'; matSel.appendChild(genOpt);
    populateDocCategoryDropdowns();
    openModal('folderUploadModal');
}

function autoDetectForFilename(fname) {
    const norm = normalizeText(fname.replace(/\.[^.]+$/, ''));
    const tokens = norm.split(' ');
    let best = { section: '', sub: '', score: 0 };
    // Option B: search ALL sections and subsections
    for (const sec of docSections) {
        const secNorm = normalizeText(sec.name);
        const secScore = scoreMatch(norm, tokens, secNorm);
        if (secScore > best.score) best = { section: sec.name, sub: '', score: secScore };
        for (const sub of (sec.subSections || [])) {
            const subNorm = normalizeText(sub);
            const subScore = scoreMatch(norm, tokens, subNorm) + 1; // slight bias to sub-section
            if (subScore > best.score) best = { section: sec.name, sub: sub, score: subScore };
        }
    }
    return best.score > 0 ? best : { section: '', sub: '', score: 0 };
}

function scoreMatch(haystack, tokens, needle) {
    if (!needle) return 0;
    if (haystack.includes(needle)) return 100 + needle.length;
    // token overlap
    const needleTokens = needle.split(' ').filter(Boolean);
    let hits = 0;
    needleTokens.forEach(nt => { if (tokens.includes(nt)) hits++; });
    if (hits === needleTokens.length && needleTokens.length > 0) return 50 + needleTokens.length * 5;
    return 0;
}

function handleFolderSelection(files) {
    folderPendingFiles = [];
    const defaultCat = document.getElementById('folderCategory').value || 'General';
    Array.from(files).forEach(f => {
        const relPath = f.webkitRelativePath || f.relativePath || f.name;
        const parts = relPath.split('/').filter(Boolean);
        // parts: e.g. ["MyFolder","Agreements","lease_001.pdf"]
        // parent folder name = parts[parts.length - 2] (undefined if file is at root)
        const parentFolder = parts.length >= 2 ? parts[parts.length - 2] : '';

        // 1) Try to match parent folder name against sections/sub-sections
        const det = detectFromFolderName(parentFolder);

        // 2) Fallback to filename-based detection
        let finalSection = det.section;
        let finalSub = det.sub;
        let source = det.source; // 'folder-section' | 'folder-subsection' | 'filename' | 'default'
        if (!finalSection && !finalSub) {
            const fnDet = autoDetectForFilename(f.name);
            if (fnDet.section || fnDet.sub) {
                finalSection = fnDet.section;
                finalSub = fnDet.sub;
                source = 'filename';
            }
        }

        // 3) Last fallback — use default section + parent folder name as sub-section
        if (!finalSection) {
            finalSection = defaultCat;
            // If there IS a parent folder name, use it as the sub-section (to be auto-created)
            finalSub = parentFolder || '';
            source = parentFolder ? 'folder-subsection-new' : 'default';
        } else if (!finalSub && parentFolder && source === 'filename') {
            // We matched a filename but there's also a folder name; prefer folder name as sub
            // (keeps files grouped logically by folder)
            finalSub = '';
        }

        folderPendingFiles.push({
            file: f,
            parentFolder: parentFolder,
            detectedSection: finalSection,
            detectedSub: finalSub,
            detectionSource: source,
            overrideSection: '',
            overrideSub: ''
        });
    });
    renderFolderReview();
}

/* Match a folder name against existing sections and sub-sections */
function detectFromFolderName(folderName) {
    if (!folderName) return { section: '', sub: '', source: '' };
    const norm = normalizeText(folderName);
    if (!norm) return { section: '', sub: '', source: '' };

    // Exact section match?
    const secMatch = docSections.find(s => normalizeText(s.name) === norm);
    if (secMatch) return { section: secMatch.name, sub: '', source: 'folder-section' };

    // Exact sub-section match (across all sections)?
    for (const s of docSections) {
        const subs = Array.isArray(s.subSections) ? s.subSections : [];
        const subMatch = subs.find(sub => normalizeText(sub) === norm);
        if (subMatch) return { section: s.name, sub: subMatch, source: 'folder-subsection' };
    }

    // Fuzzy: folder name contains section or sub-section name (or vice-versa)
    const secFuzzy = docSections.find(s => {
        const n = normalizeText(s.name);
        return n && (norm.includes(n) || n.includes(norm));
    });
    if (secFuzzy) return { section: secFuzzy.name, sub: '', source: 'folder-section' };

    for (const s of docSections) {
        const subs = Array.isArray(s.subSections) ? s.subSections : [];
        const subFuzzy = subs.find(sub => {
            const n = normalizeText(sub);
            return n && (norm.includes(n) || n.includes(norm));
        });
        if (subFuzzy) return { section: s.name, sub: subFuzzy, source: 'folder-subsection' };
    }

    return { section: '', sub: '', source: '' };
}

function renderFolderReview() {
    const wrap = document.getElementById('folderReviewWrap');
    const body = document.getElementById('folderReviewBody');
    const count = document.getElementById('folderReviewCount');
    if (!folderPendingFiles.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    count.textContent = `${folderPendingFiles.length} file${folderPendingFiles.length !== 1 ? 's' : ''} ready`;

    const sectionNames = docSections.map(s => s.name);

    body.innerHTML = folderPendingFiles.map((f, i) => {
        const effectiveSection = f.overrideSection || f.detectedSection || (sectionNames[0] || 'General');
        const sec = docSections.find(s => s.name === effectiveSection);
        const existingSubs = (sec && Array.isArray(sec.subSections)) ? sec.subSections : [];
        const effectiveSub = f.overrideSub !== undefined && f.overrideSub !== ''
            ? f.overrideSub
            : (f.detectedSub || '');

        // ---- Section dropdown ----
        const sectionSelect = `<select class="row-select" onchange="onFolderRowSectionChange(${i}, this.value)">
            ${sectionNames.map(s => `<option value="${s}" ${s === effectiveSection ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        ${f.overrideSection
            ? `<div class="fs-small" style="color:#f59e0b;margin-top:0.15rem;"><i class="fas fa-pen"></i> Manually set</div>`
            : (f.detectionSource === 'folder-section' || f.detectionSource === 'folder-subsection')
                ? `<div class="fs-small" style="color:#22c55e;margin-top:0.15rem;"><i class="fas fa-folder"></i> From folder name</div>`
                : f.detectionSource === 'filename'
                    ? `<div class="fs-small" style="color:#22c55e;margin-top:0.15rem;"><i class="fas fa-wand-magic-sparkles"></i> From filename</div>`
                    : ''}`;

        // ---- Sub-Section dropdown ----
        const isNewSub = !!effectiveSub && !existingSubs.includes(effectiveSub);
        const subOptions = ['<option value="">— General —</option>']
            .concat(existingSubs.map(s => `<option value="${s}" ${s === effectiveSub ? 'selected' : ''}>${s}</option>`))
            .concat(isNewSub ? `<option value="${effectiveSub}" selected>${effectiveSub} (NEW)</option>` : [])
            .concat('<option value="__NEW__">➕ Add new sub-section…</option>')
            .join('');
        const subBadge = (() => {
            if (isNewSub) return `<div class="fs-small" style="color:#8b5cf6;margin-top:0.15rem;"><i class="fas fa-plus-circle"></i> Will be created</div>`;
            if (f.overrideSub) return `<div class="fs-small" style="color:#f59e0b;margin-top:0.15rem;"><i class="fas fa-pen"></i> Manually set</div>`;
            if (f.detectionSource === 'folder-subsection' || f.detectionSource === 'folder-section') {
                return `<div class="fs-small" style="color:#22c55e;margin-top:0.15rem;"><i class="fas fa-folder"></i> From folder name</div>`;
            }
            if (f.detectionSource === 'filename') {
                return `<div class="fs-small" style="color:#22c55e;margin-top:0.15rem;"><i class="fas fa-wand-magic-sparkles"></i> From filename</div>`;
            }
            return '';
        })();
        const subSelect = `<select class="row-select" onchange="onFolderRowSubChange(${i}, this.value)">
            ${subOptions}
        </select>
        <input type="text" class="row-newsub-input" id="newSub_${i}" placeholder="Type new sub-section name..." onchange="onFolderRowNewSubTyped(${i}, this.value)" onblur="onFolderRowNewSubTyped(${i}, this.value)">
        ${subBadge}`;

        return `<tr>
            <td style="max-width:280px;word-break:break-all;font-size:0.75rem;"><i class="fas fa-file" style="color:#3b82f6;margin-right:0.3rem;"></i>${f.file.name}</td>
            <td>${sectionSelect}</td>
            <td>${subSelect}</td>
        </tr>`;
    }).join('');

    document.getElementById('folderUploadCommitBtn').disabled = false;
}

/* Row-level change handlers */
function onFolderRowSectionChange(index, newSection) {
    if (!folderPendingFiles[index]) return;
    const f = folderPendingFiles[index];
    f.overrideSection = (newSection === f.detectedSection) ? '' : newSection;
    // Reset sub override because sub-sections belong to a specific section
    f.overrideSub = '';
    // If detected sub doesn't belong to the new section, clear it too
    const sec = docSections.find(s => s.name === newSection);
    if (sec && Array.isArray(sec.subSections)) {
        if (f.detectedSub && !sec.subSections.includes(f.detectedSub)) {
            f.detectedSub = '';
        }
    } else {
        f.detectedSub = '';
    }
    renderFolderReview();
}

function onFolderRowSubChange(index, newSub) {
    if (!folderPendingFiles[index]) return;
    const f = folderPendingFiles[index];
    if (newSub === '__NEW__') {
        // Reveal the inline new-sub input
        const inp = document.getElementById('newSub_' + index);
        if (inp) { inp.classList.add('show'); inp.focus(); }
        // Reset select value to previous in case user cancels
        return;
    }
    f.overrideSub = (newSub === f.detectedSub) ? '' : newSub;
    renderFolderReview();
}

function onFolderRowNewSubTyped(index, value) {
    if (!folderPendingFiles[index]) return;
    const f = folderPendingFiles[index];
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    f.overrideSub = trimmed;
    renderFolderReview();
}

/* Bulk-set section for ALL rows */
function bulkAssignSectionPrompt() {
    if (!folderPendingFiles.length) return;
    const current = folderPendingFiles[0].overrideSection || folderPendingFiles[0].detectedSection || '';
    const picked = prompt('Set Section for ALL files:\n' + docSections.map(s => '• ' + s.name).join('\n') + '\n\nType the exact section name:', current);
    if (!picked) return;
    const match = docSections.find(s => s.name.toLowerCase() === picked.trim().toLowerCase());
    if (!match) { showToast('Section not found: ' + picked, 'warning'); return; }
    folderPendingFiles.forEach(f => {
        f.overrideSection = match.name;
        f.overrideSub = '';
        // Reset detected sub if it doesn't exist in this section
        const sec = docSections.find(s => s.name === match.name);
        if (!(sec && Array.isArray(sec.subSections) && sec.subSections.includes(f.detectedSub))) {
            f.detectedSub = '';
        }
    });
    renderFolderReview();
    showToast(`All files set to section "${match.name}".`, 'info');
}

/* Bulk-set sub-section for ALL rows in the same section */
function bulkAssignSubPrompt() {
    if (!folderPendingFiles.length) return;
    const firstSec = folderPendingFiles[0].overrideSection || folderPendingFiles[0].detectedSection;
    const sec = docSections.find(s => s.name === firstSec);
    const opts = sec && Array.isArray(sec.subSections) ? sec.subSections : [];
    const picked = prompt('Set Sub-Section for ALL files currently in section "' + firstSec + '":\n' + opts.map(s => '• ' + s).join('\n') + '\n\n(Type an existing name, or type a NEW name to create it):');
    if (!picked) return;
    const trimmed = picked.trim();
    if (!trimmed) return;
    folderPendingFiles.forEach(f => {
        const fSec = f.overrideSection || f.detectedSection;
        if (fSec === firstSec) f.overrideSub = trimmed;
    });
    renderFolderReview();
    showToast(`Sub-section "${trimmed}" applied to files in ${firstSec}.`, 'info');
}

function reAutoDetectAll() {
    const defaultCat = document.getElementById('folderCategory').value || 'General';
    folderPendingFiles.forEach(f => {
        const parentFolder = f.parentFolder || '';
        const det = detectFromFolderName(parentFolder);
        let finalSection = det.section;
        let finalSub = det.sub;
        let source = det.source;
        if (!finalSection && !finalSub) {
            const fnDet = autoDetectForFilename(f.file.name);
            if (fnDet.section || fnDet.sub) {
                finalSection = fnDet.section;
                finalSub = fnDet.sub;
                source = 'filename';
            }
        }
        if (!finalSection) {
            finalSection = defaultCat;
            finalSub = parentFolder || '';
            source = parentFolder ? 'folder-subsection-new' : 'default';
        }
        f.detectedSection = finalSection;
        f.detectedSub = finalSub;
        f.detectionSource = source;
        f.overrideSection = '';
        f.overrideSub = '';
    });
    renderFolderReview();
    showToast('Re-detected all files from folder names.', 'info');
}

async function commitFolderUpload() {
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    if (!folderPendingFiles.length) { showToast('No files selected.', 'warning'); return; }
    const matter = document.getElementById('folderMatter').value || 'General';
    const defaultCat = document.getElementById('folderCategory').value || 'General';
    const uploaded = document.getElementById('folderUploadedDate').value || getToday();
    const progressWrap = document.getElementById('folderProgressWrap');
    const progressBar = document.getElementById('folderProgressBar');
    const progressText = document.getElementById('folderProgressText');
    progressWrap.style.display = 'block';
    document.getElementById('folderUploadCommitBtn').disabled = true;

    // ---- STEP 1: Collect all new sub-sections that need to be created ----
    // Map: sectionName -> Set of newSubNames
    const newSubsBySection = {};
    const total = folderPendingFiles.length;
    folderPendingFiles.forEach(item => {
        const finalSection = item.overrideSection || item.detectedSection || defaultCat;
        const finalSub = item.overrideSub || item.detectedSub || '';
        if (!finalSub) return;
        const sec = docSections.find(s => s.name === finalSection);
        const existingSubs = (sec && Array.isArray(sec.subSections)) ? sec.subSections : [];
        if (!existingSubs.includes(finalSub)) {
            if (!newSubsBySection[finalSection]) newSubsBySection[finalSection] = new Set();
            newSubsBySection[finalSection].add(finalSub);
        }
    });

    // ---- STEP 2: Auto-create missing sub-sections in docSections & Firestore ----
    let created = 0;
    for (const sectionName in newSubsBySection) {
        let sec = docSections.find(s => s.name === sectionName);
        if (!sec) {
            // Section itself doesn't exist — create it too (edge case)
            sec = { name: sectionName, subSections: [] };
            docSections.push(sec);
        }
        if (!Array.isArray(sec.subSections)) sec.subSections = [];
        newSubsBySection[sectionName].forEach(sub => {
            if (!sec.subSections.includes(sub)) {
                sec.subSections.push(sub);
                created++;
            }
        });
    }
    if (created > 0) {
        await saveDocSections();
        showToast(`${created} new sub-section(s) auto-created from folder names.`, 'info');
    }

    // ---- STEP 3: Upload each file ----
    let done = 0;
    for (const item of folderPendingFiles) {
        const fileId = 'f' + (++fileStoreId);
        const finalSection = item.overrideSection || item.detectedSection || defaultCat;
        const finalSub = item.overrideSub || item.detectedSub || '';
        const dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.onerror = reject;
            r.readAsDataURL(item.file);
        }).catch(() => null);
        if (dataUrl) {
            fileStore[fileId] = dataUrl;
            await saveFileToIndexedDB(fileId, dataUrl);
            await addDocumentToFirestore({
                name: item.file.name,
                category: finalSection,
                subCategory: finalSub,
                matter: matter,
                uploaded: uploaded,
                size: (item.file.size / 1024).toFixed(1) + ' KB',
                fileId: fileId,
                downloadUrl: '',
                base64: dataUrl
            });
        }
        done++;
        const pct = Math.round((done / total) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = `Uploading ${done} of ${total}...`;
    }
    progressText.textContent = `Done — ${total} file(s) uploaded.`;
    await logActivity('Folder Upload', `${total} files to ${matter}${created ? ` (+${created} new sub-sections)` : ''}`);
    showToast(`${total} document(s) uploaded.`, 'info');
    setTimeout(() => { closeModal('folderUploadModal'); }, 800);
}

/* ============================================================
   EDIT DOCUMENT CLASSIFICATION (post-upload)
   ============================================================ */

function openEditDocClassify(docId) {
    if (!isFullAccess()) { showToast('Only admins/developers can re-classify.', 'warning'); return; }
    const d = documentsData.find(x => x.id === docId);
    if (!d) { showToast('Document not found.', 'error'); return; }
    document.getElementById('editDocClassifyId').value = docId;
    document.getElementById('editDocClassifyName').value = d.name || '';
    const secSel = document.getElementById('editDocClassifySection');
    secSel.innerHTML = docSections.map(s => `<option value="${s.name}" ${s.name === (d.category || '') ? 'selected' : ''}>${s.name}</option>`).join('');
    onEditDocSectionChange();
    const subSel = document.getElementById('editDocClassifySub');
    if (subSel) subSel.value = d.subCategory || '';
    openModal('editDocClassifyModal');
}

function onEditDocSectionChange() {
    const sec = document.getElementById('editDocClassifySection').value;
    const subSel = document.getElementById('editDocClassifySub');
    if (!subSel) return;
    const found = docSections.find(s => s.name === sec);
    subSel.innerHTML = '<option value="">General</option>' +
        ((found && found.subSections) ? found.subSections.map(sub => `<option value="${sub}">${sub}</option>`).join('') : '');
}

async function saveEditedDocClassify() {
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const id = document.getElementById('editDocClassifyId').value;
    const category = document.getElementById('editDocClassifySection').value;
    const subCategory = document.getElementById('editDocClassifySub').value || '';
    if (!id || !category) { showToast('Please choose a section.', 'warning'); return; }
    try {
        await db.collection('documents').doc(id).update({ category: category, subCategory: subCategory });
        await logActivity('Re-classified Document', `${id} → ${category} / ${subCategory || 'General'}`);
        showToast('Document classification updated.', 'info');
        closeModal('editDocClassifyModal');
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

/* ============================================================
   eFILING IFRAME
   ============================================================ */

function openEfilingModal() {
    const iframe = document.getElementById('efilingIframe');
    const fallback = document.getElementById('efilingFallback');
    fallback.style.display = 'none';
    iframe.style.display = 'block';
    try {
        iframe.src = 'https://efiling.court.go.ke';
    } catch (e) { fallback.style.display = 'block'; iframe.style.display = 'none'; }
    // Detect X-Frame-Options block: if iframe stays blank after 4s, show fallback
    setTimeout(() => {
        try {
            // If cross-origin blocked, contentWindow still accessible but contentDocument throws
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (!doc || !doc.body || (doc.body.innerHTML === '' && iframe.src !== 'about:blank')) {
                // might just be slow — leave it
            }
        } catch (e) {
            // Cross-origin security error = actually loaded (or tried to). Don't fallback.
        }
    }, 4000);
    openModal('efilingModal');
}

function emptyFeeAgreement() {
    return { totalFees: 0, deposit: 0, depositDate: '', depositPaid: true, depositRef: '', installments: [], payments: [] };
}

function getClientExpenses(client) {
    const list = Array.isArray(client && client.expenses) ? client.expenses : [];
    let clientTotal = 0, firmTotal = 0, courtTotal = 0;
    list.forEach(e => {
        const amt = parseInt(e.amount) || 0;
        if (e.type === 'court' || (e.category && e.category === 'Court Fee')) courtTotal += amt;
        else if (e.type === 'firm') firmTotal += amt;
        else clientTotal += amt;
    });
    return { list, clientTotal, firmTotal, courtTotal, total: clientTotal + firmTotal + courtTotal };
}

function getClientEarnedFees(client) {
    if (!client) return 0;
    const clientCases = casesData.filter(c => c.client === client.name || c.clientId === client.id);
    return clientCases.filter(c => c.filed === true).reduce((s, c) => s + (parseInt(c.caseFee) || 0), 0);
}

function getClientPendingFees(client) {
    const total = parseInt(client && client.feeAgreement && client.feeAgreement.totalFees) || 0;
    const earned = getClientEarnedFees(client);
    return Math.max(0, total - earned);
}

function getCaseFirmNetFee(c) {
    const fee = parseInt(c.caseFee) || 0;
    const court = parseInt(c.courtFees) || 0;
    return Math.max(0, fee - court);
}

function getClientFeeBalance(client) {
    const fa = client && client.feeAgreement ? client.feeAgreement : null;
    const expenses = getClientExpenses(client);
    const earned = getClientEarnedFees(client);
    if (!fa || !fa.totalFees) {
        return { total: 0, paid: 0, balance: 0, nextDue: null, pct: 0, installments: [], payments: [], deposit: 0, earned, pending: 0, expenses };
    }
    const total = parseInt(fa.totalFees) || 0;
    const deposit = (fa.depositPaid !== false) ? (parseInt(fa.deposit) || 0) : 0;
    const installments = Array.isArray(fa.installments) ? fa.installments : [];
    const payments = Array.isArray(fa.payments) ? fa.payments : [];
    const paymentsSum = payments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
    const instPaidLegacy = installments.filter(i => i.paid).reduce((s, i) => s + (parseInt(i.amount) || 0), 0);
    let paid = (payments.length > 0) ? (deposit + paymentsSum) : (deposit + instPaidLegacy);
    const balance = Math.max(0, total - paid);
    const pending = installments.filter(i => !i.paid && i.date).sort((a, b) => a.date.localeCompare(b.date));
    const nextDue = pending.length ? pending[0] : null;
    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    return { total, paid, balance, nextDue, pct, installments, payments, deposit, earned, pending: Math.max(0, total - earned), expenses };
}

function getAllPayments() {
    const all = [];
    clientsData.forEach(c => {
        const fa = c.feeAgreement;
        if (!fa || !Array.isArray(fa.payments)) return;
        fa.payments.forEach(p => { all.push({ ...p, clientId: c.id, clientName: c.name, clientPhone: c.phone || '', clientEmail: c.email || '' }); });
    });
    return all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function generatePaymentId() { return 'pay_' + Date.now() + '_' + Math.floor(Math.random() * 10000); }
function generateExpenseId() { return 'exp_' + Date.now() + '_' + Math.floor(Math.random() * 10000); }
function generateDocRequestId() { return 'dr_' + Date.now() + '_' + Math.floor(Math.random() * 10000); }
function generateAdvanceId() { return 'adv_' + Date.now() + '_' + Math.floor(Math.random() * 10000); }

function collectInstallments(prefix) {
    const container = document.getElementById(prefix + 'InstallmentsContainer');
    const arr = [];
    if (!container) return arr;
    const dates = container.querySelectorAll('.inst-date');
    const amounts = container.querySelectorAll('.inst-amount');
    dates.forEach((d, i) => { arr.push({ date: d.value, amount: parseInt(amounts[i] ? amounts[i].value : 0) || 0 }); });
    return arr;
}

function renderInstallmentRows(prefix, count, existing) {
    const container = document.getElementById(prefix + 'InstallmentsContainer');
    if (!container) return;
    existing = existing || [];
    count = Math.max(0, Math.min(24, parseInt(count) || 0));
    let html = '';
    for (let i = 0; i < count; i++) {
        const ex = existing[i] || { date: '', amount: '' };
        html += `<div class="inline-add" style="align-items:center;margin-bottom:0.35rem;">
            <span class="text-muted fs-small" style="min-width:80px;">Installment ${i + 1}</span>
            <input type="date" class="inst-date" value="${ex.date || ''}" style="flex:1;">
            <input type="number" class="inst-amount" placeholder="Amount (KES)" min="0" value="${ex.amount || ''}" style="flex:1;">
        </div>`;
    }
    container.innerHTML = html || '<p class="text-muted fs-small">No installments scheduled.</p>';
    container.querySelectorAll('input').forEach(inp => { inp.addEventListener('input', () => updateFeeSummary(prefix)); });
    updateFeeSummary(prefix);
}

function updateFeeSummary(prefix) {
    const totalEl = document.getElementById(prefix + 'TotalFees');
    const depositEl = document.getElementById(prefix + 'Deposit');
    const summaryEl = document.getElementById(prefix + 'FeeSummary');
    if (!summaryEl) return;
    const total = parseInt(totalEl ? totalEl.value : 0) || 0;
    const deposit = parseInt(depositEl ? depositEl.value : 0) || 0;
    const insts = collectInstallments(prefix);
    const instTotal = insts.reduce((s, i) => s + (parseInt(i.amount) || 0), 0);
    const unallocated = total - deposit - instTotal;
    summaryEl.innerHTML = `Total: <strong>${formatCurrency(total)}</strong> · Deposit: <strong>${formatCurrency(deposit)}</strong> · Installments: <strong>${formatCurrency(instTotal)}</strong> · <span style="color:${unallocated === 0 ? '#22c55e' : '#ef4444'};">Unallocated: <strong>${formatCurrency(unallocated)}</strong></span>`;
}

function setClientFeeFormValues(prefix, feeAgreement) {
    const fa = feeAgreement || emptyFeeAgreement();
    const totalEl = document.getElementById(prefix + 'TotalFees');
    const depositEl = document.getElementById(prefix + 'Deposit');
    const depositDateEl = document.getElementById(prefix + 'DepositDate');
    const depositRefEl = document.getElementById(prefix + 'DepositRef');
    const countEl = document.getElementById(prefix + 'InstallmentCount');
    if (totalEl) totalEl.value = fa.totalFees || '';
    if (depositEl) depositEl.value = fa.deposit || '';
    if (depositDateEl) depositDateEl.value = fa.depositDate || '';
    if (depositRefEl) depositRefEl.value = fa.depositRef || '';
    const insts = Array.isArray(fa.installments) ? fa.installments : [];
    if (countEl) countEl.value = insts.length;
    renderInstallmentRows(prefix, insts.length, insts);
}

function buildFeeAgreementFromForm(prefix, existing) {
    const total = parseInt(document.getElementById(prefix + 'TotalFees').value) || 0;
    const deposit = parseInt(document.getElementById(prefix + 'Deposit').value) || 0;
    const depositDate = document.getElementById(prefix + 'DepositDate').value || '';
    const depositRefEl = document.getElementById(prefix + 'DepositRef');
    const depositRef = depositRefEl ? depositRefEl.value.trim() : '';
    const existingInstallments = (existing && existing.installments) ? existing.installments : [];
    const existingPayments = (existing && existing.payments) ? existing.payments : [];
    const collected = collectInstallments(prefix);
    const installments = collected.map((item, idx) => {
        const prev = existingInstallments[idx] || {};
        return { date: item.date || '', amount: parseInt(item.amount) || 0, paid: !!prev.paid, paidDate: prev.paidDate || null, remindedToday: prev.remindedToday || null, overdueNotified: prev.overdueNotified || false };
    });
    return { totalFees: total, deposit: deposit, depositDate: depositDate, depositRef: depositRef, depositPaid: existing && existing.depositPaid === false ? false : true, installments: installments, payments: existingPayments };
}

function checkFeeReminders() {
    if (!currentUser || !isFullAccess()) return;
    const today = getToday();
    let changed = false;
    clientsData.forEach(c => {
        const fa = c.feeAgreement;
        if (!fa || !Array.isArray(fa.installments)) return;
        fa.installments.forEach((inst, idx) => {
            if (inst.paid) return;
            if (!inst.date) return;
            if (inst.date === today) {
                if (inst.remindedToday !== today) {
                    const msg = `Dear ${c.name}, this is a friendly reminder that your agreed fee installment of ${formatCurrency(inst.amount)} is due TODAY (${inst.date}). Kindly settle your account. - Kuria Karatu & Company Advocates`;
                    showToast(`Fee due today: ${c.name} – ${formatCurrency(inst.amount)}`, 'warning', 12000);
                    fireBrowserNotification('Kuria Karatu – Fee Installment Due', `${c.name}: ${formatCurrency(inst.amount)} due today`);
                    if (c.phone) { try { sendWhatsApp(c.phone, c.name, msg); } catch (e) {} }
                    if (c.email) { try { sendEmail(c.email, 'Fee Installment Due Today', msg); } catch (e) {} }
                    inst.remindedToday = today;
                    changed = true;
                    logActivity('Fee Reminder Sent', `${c.name} – ${formatCurrency(inst.amount)} due ${inst.date}`);
                }
            } else if (inst.date < today && !inst.overdueNotified) {
                inst.overdueNotified = true;
                changed = true;
                const msg = `Dear ${c.name}, your agreed fee installment of ${formatCurrency(inst.amount)} was due on ${inst.date} and is now OVERDUE. Kindly settle your account to avoid further action. - Kuria Karatu & Company Advocates`;
                showToast(`Overdue fee installment: ${c.name} – ${formatCurrency(inst.amount)}`, 'error', 12000);
                fireBrowserNotification('Kuria Karatu – Overdue Fee Installment', `${c.name}: ${formatCurrency(inst.amount)} overdue since ${inst.date}`);
                logActivity('Fee Overdue Notified', `${c.name} – ${formatCurrency(inst.amount)} due ${inst.date}`);
            }
        });
    });
    if (changed) {
        clientsData.forEach(c => { if (c.feeAgreement) db.collection('clients').doc(c.id).update({ feeAgreement: c.feeAgreement }).catch(() => {}); });
        if (currentPage === 'fees') renderFees();
    }
}

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'error' ? 'fa-circle-exclamation' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-check-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span><span class="toast-close" onclick="this.parentElement.remove()">&times;</span>`;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
}

function getAge(filingDate) {
    const filed = new Date(filingDate);
    const now = new Date();
    const diff = now - filed;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 30) return days + ' days';
    if (days < 365) return Math.floor(days / 30) + ' months';
    return Math.floor(days / 365) + ' years';
}

function formatCurrency(amount) { return 'KES ' + Number(amount || 0).toLocaleString(); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function getToday() { return new Date().toISOString().slice(0, 10); }
function getDateTime() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

function getMonthName(m) {
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return names[m];
}

function generateReceiptNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const count = receiptsData.length + 1;
    return `RCP-${y}${m}${d}-${String(count).padStart(4, '0')}`;
}

function generateInvoiceNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const count = invoicesData.length + 1;
    return `INV-${y}${m}${d}-${String(count).padStart(4, '0')}`;
}

function getAccidentClientTotals(client) {
    const advances = Array.isArray(client.advances) ? client.advances : [];
    const advancesTotal = advances.reduce((s, a) => s + (parseInt(a.amount) || 0), 0);
    const settlementAmount = parseInt(client.settlementAmount) || 0;
    const firmFee = parseInt(client.firmFee) || 0;
    const estimatedSettlement = parseInt(client.estimatedSettlement) || 0;
    const netToClient = settlementAmount > 0 ? (settlementAmount - firmFee) : 0;
    const balance = settlementAmount > 0 ? (netToClient - advancesTotal) : 0;
    const maxAdvance = Math.floor(firmFee * 0.5);
    const advanceRoom = Math.max(0, maxAdvance - advancesTotal);
    return { advancesTotal, settlementAmount, firmFee, estimatedSettlement, netToClient, balance, advanceCount: advances.length, maxAdvance, advanceRoom };
}

function getDaysBetween(date1, date2) { return Math.ceil((new Date(date1) - new Date(date2)) / (1000 * 60 * 60 * 24)); }

function normalizePhone(phone) {
    if (!phone) return '';
    let clean = String(phone).replace(/\s/g, '').replace(/^\+/, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('254')) clean = '254' + clean;
    return clean;
}

function sendWhatsApp(phone, clientName, message) {
    if (!phone) { showToast('Client has no phone number on record.', 'warning'); return; }
    const clean = normalizePhone(phone);
    const msg = message || `Hello ${clientName || 'Client'}, this is Kuria Karatu & Company Advocates.`;
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
}

function sendEmail(to, subject, body) {
    if (!to) { showToast('Client has no email address on record.', 'warning'); return; }
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function logActivity(action, detail = '') {
    if (!currentUserEmail) return;
    try {
        await db.collection('activityLogs').add({ user: currentUserEmail, role: currentUserRole, action: action, detail: detail, timestamp: getDateTime(), date: getToday() });
    } catch (e) { console.warn('Failed to log activity:', e); }
}

function renderActivityLog() {
    if (!isFullAccess()) return;
    const container = document.getElementById('activityLogContainer');
    if (!container) return;
    const filter = document.getElementById('activityFilter')?.value?.toLowerCase() || '';
    let filtered = activityLogs;
    if (filter) filtered = filtered.filter(log => log.user.toLowerCase().includes(filter) || log.action.toLowerCase().includes(filter) || (log.detail && log.detail.toLowerCase().includes(filter)));
    if (!filtered.length) {
        container.innerHTML = `<p class="text-muted" style="padding:1rem 0;text-align:center;">${filter ? 'No matching activity.' : 'No activity logged yet.'}</p>`;
        return;
    }
    container.innerHTML = filtered.map(log => `<div class="activity-log-entry"><div><span class="log-user">${log.user}</span><span class="log-action">${log.action}</span>${log.detail ? `<span class="log-detail">${log.detail}</span>` : ''}</div><span class="log-time">${log.timestamp}</span></div>`).join('');
}

async function addCaseToFirestore(data) {
    try { const ref = await db.collection('cases').add(data); await logActivity('Added Case', `${data.caseNo} - ${data.name}`); return ref.id; }
    catch (e) { console.error(e); return null; }
}
async function updateCaseInFirestore(id, updates) {
    try { await db.collection('cases').doc(id).update(updates); await logActivity('Updated Case', `ID: ${id}`); }
    catch (e) { console.error(e); }
}
async function deleteCaseFromFirestore(id) {
    try { const c = casesData.find(c => c.id === id); await db.collection('cases').doc(id).delete(); await logActivity('Deleted Case', c ? `${c.caseNo} - ${c.name}` : id); }
    catch (e) { console.error(e); }
}
async function addDocumentToFirestore(data) {
    try { const ref = await db.collection('documents').add(data); await logActivity('Added Document', data.name); return ref.id; }
    catch (e) { console.error(e); return null; }
}
async function deleteDocFromFirestore(docId) {
    try { const d = documentsData.find(d => d.id === docId); await db.collection('documents').doc(docId).delete(); await logActivity('Deleted Document', d ? d.name : docId); }
    catch (e) { console.error(e); }
}
async function addTaskToFirestore(data) {
    try { const ref = await db.collection('tasks').add(data); await logActivity('Added Task', data.title); return ref.id; }
    catch (e) { console.error(e); return null; }
}
async function updateTaskInFirestore(id, updates) {
    try { await db.collection('tasks').doc(id).update(updates); } catch (e) { console.error(e); }
}
async function deleteTaskFromFirestore(id) {
    try { const t = tasksData.find(t => t.id === id); await db.collection('tasks').doc(id).delete(); await logActivity('Deleted Task', t ? t.title : id); }
    catch (e) { console.error(e); }
}
async function addClientToFirestore(data) {
    try { const ref = await db.collection('clients').add(data); await logActivity('Added Client', data.name); return ref.id; }
    catch (e) { console.error(e); return null; }
}
async function updateClientInFirestore(id, updates) {
    try { await db.collection('clients').doc(id).update(updates); await logActivity('Updated Client', `ID: ${id}`); }
    catch (e) { console.error(e); }
}
async function deleteClientFromFirestore(id) {
    try { const c = clientsData.find(c => c.id === id); await db.collection('clients').doc(id).delete(); await logActivity('Deleted Client', c ? c.name : id); }
    catch (e) { console.error(e); }
}
async function addInvoiceToFirestore(data) {
    try { const ref = await db.collection('invoices').add(data); await logActivity('Added Invoice', `${data.invoiceNumber} - ${formatCurrency(data.amount)}`); return ref.id; }
    catch (e) { console.error(e); return null; }
}
async function updateInvoiceInFirestore(id, updates) {
    try { await db.collection('invoices').doc(id).update(updates); await logActivity('Updated Invoice', `ID: ${id}`); }
    catch (e) { console.error(e); }
}
async function deleteInvoiceFromFirestore(id) {
    try { const inv = invoicesData.find(i => i.id === id); await db.collection('invoices').doc(id).delete(); await logActivity('Deleted Invoice', inv ? inv.invoiceNumber : id); }
    catch (e) { console.error(e); }
}
async function addReceiptToFirestore(data) {
    try { const ref = await db.collection('receipts').add(data); await logActivity('Generated Receipt', data.receiptNumber); return ref.id; }
    catch (e) { console.error(e); return null; }
}
async function deleteReceiptFromFirestore(id) {
    try { const r = receiptsData.find(r => r.id === id); await db.collection('receipts').doc(id).delete(); await logActivity('Deleted Receipt', r ? r.receiptNumber : id); }
    catch (e) { console.error(e); }
}
async function saveTargetToFirestore(practice, data) {
    try {
        await db.collection('targets').doc(practice).set({ practice: practice, revenue: parseInt(data.revenue) || 0, won: parseInt(data.won) || 0, filed: parseInt(data.filed) || 0, active: parseInt(data.active) || 0, updatedAt: getToday() }, { merge: true });
        await logActivity('Updated Targets', practice);
        return true;
    } catch (e) { console.error(e); return false; }
}
async function addAccidentClientToFirestore(data) {
    try { const ref = await db.collection('accidentClients').add(data); await logActivity('Added Accident Client', `${data.name} – ${data.claimNumber}`); return ref.id; }
    catch (e) { console.error(e); return null; }
}
async function updateAccidentClientInFirestore(id, updates) {
    try { await db.collection('accidentClients').doc(id).update(updates); await logActivity('Updated Accident Client', `ID: ${id}`); return true; }
    catch (e) { console.error(e); return false; }
}
async function deleteAccidentClientFromFirestore(id) {
    try { const c = accidentClientsData.find(x => x.id === id); await db.collection('accidentClients').doc(id).delete(); await logActivity('Deleted Accident Client', c ? `${c.name} – ${c.claimNumber}` : id); return true; }
    catch (e) { console.error(e); return false; }
}

function showPurgeProgress(show, text, pct) {
    const wrap = document.getElementById('purgeProgress');
    const txt = document.getElementById('purgeProgressText');
    const bar = document.getElementById('purgeProgressBar');
    if (!wrap) return;
    wrap.style.display = show ? 'block' : 'none';
    if (text) txt.textContent = text;
    if (typeof pct === 'number') bar.style.width = pct + '%';
}

async function deleteAllDocsInCollection(colName, onProgress) {
    let total = 0;
    while (true) {
        const snap = await db.collection(colName).limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        total += snap.size;
        if (onProgress) onProgress(total);
        if (snap.size < 400) break;
    }
    return total;
}

async function purgePortalRequests() {
    if (!isFullAccess()) { showToast('Admin only.', 'warning'); return; }
    if (!confirm('Delete ALL portal requests? This cannot be undone.')) return;
    if (!confirm('Are you REALLY sure?')) return;
    showPurgeProgress(true, 'Deleting portal requests...', 20);
    try {
        const count = await deleteAllDocsInCollection('portalRequests', n => showPurgeProgress(true, `Deleted ${n} requests...`, Math.min(90, 20 + n)));
        showPurgeProgress(true, `Done. Deleted ${count} request(s).`, 100);
        await logActivity('Purged Portal Requests', `${count} deleted`);
        showToast(`Deleted ${count} portal request(s).`, 'info');
        setTimeout(() => showPurgeProgress(false), 2500);
    } catch (e) { showPurgeProgress(false); showToast('Purge failed: ' + e.message, 'error'); }
}

async function purgeClientAccounts() {
    if (!isFullAccess()) { showToast('Admin only.', 'warning'); return; }
    if (!confirm('Delete ALL client portal accounts?')) return;
    if (!confirm('Are you REALLY sure?')) return;
    showPurgeProgress(true, 'Collecting client accounts...', 5);
    try {
        const snap = await db.collection('clientAccounts').get();
        const uids = [];
        snap.forEach(doc => uids.push(doc.id));
        if (!uids.length) { showPurgeProgress(true, 'No client accounts to delete.', 100); setTimeout(() => showPurgeProgress(false), 2000); return; }
        showPurgeProgress(true, `Deleting ${uids.length} Firestore records...`, 15);
        let done = 0;
        while (true) {
            const chunk = await db.collection('clientAccounts').limit(400).get();
            if (chunk.empty) break;
            const batch = db.batch();
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            done += chunk.size;
            showPurgeProgress(true, `Deleted ${done}/${uids.length}...`, Math.min(70, 15 + Math.round((done / uids.length) * 55)));
            if (chunk.size < 400) break;
        }
        showPurgeProgress(true, `Done.`, 100);
        await logActivity('Purged Client Accounts', `${uids.length} Firestore docs deleted`);
        showToast(`Deleted ${uids.length} clientAccount docs.`, 'warning', 12000);
        try { await navigator.clipboard.writeText(uids.join('\n')); showToast('UIDs copied to clipboard.', 'info', 9000); } catch (e) {}
        setTimeout(() => showPurgeProgress(false), 4000);
    } catch (e) { showPurgeProgress(false); showToast('Purge failed: ' + e.message, 'error'); }
}

async function purgeStaffUsers() {
    if (!isFullAccess()) { showToast('Admin only.', 'warning'); return; }
    if (!confirm(`Delete ALL staff users EXCEPT ${currentUserEmail}?`)) return;
    if (!confirm('Are you REALLY sure?')) return;
    showPurgeProgress(true, 'Collecting staff users...', 10);
    try {
        const snap = await db.collection('users').get();
        const toDelete = [];
        snap.forEach(doc => { const d = doc.data(); if (d.email !== currentUserEmail) toDelete.push({ id: doc.id, email: d.email }); });
        if (!toDelete.length) { showPurgeProgress(true, 'No other staff users.', 100); setTimeout(() => showPurgeProgress(false), 2000); return; }
        const batch = db.batch();
        toDelete.forEach(u => batch.delete(db.collection('users').doc(u.id)));
        await batch.commit();
        showPurgeProgress(true, `Deleted ${toDelete.length} staff record(s).`, 100);
        await logActivity('Purged Staff Users', `${toDelete.length} deleted`);
        showToast(`Deleted ${toDelete.length} staff record(s).`, 'warning', 12000);
        try { await navigator.clipboard.writeText(toDelete.map(u => u.email).join('\n')); showToast('Emails copied to clipboard.', 'info', 9000); } catch (e) {}
        setTimeout(() => showPurgeProgress(false), 4000);
    } catch (e) { showPurgeProgress(false); showToast('Purge failed: ' + e.message, 'error'); }
}

async function purgeAuthOnly() {
    if (!isFullAccess()) { showToast('Admin only.', 'warning'); return; }
    if (!confirm('Delete ALL clientAccounts + portalRequests + other staff users?')) return;
    if (!confirm('Are you ABSOLUTELY sure?')) return;
    showPurgeProgress(true, 'Purging everything...', 5);
    try {
        const r1 = await deleteAllDocsInCollection('portalRequests', n => showPurgeProgress(true, `Requests: ${n} deleted...`, 20));
        const r2 = await deleteAllDocsInCollection('clientAccounts', n => showPurgeProgress(true, `ClientAccounts: ${n} deleted...`, 50));
        const snap = await db.collection('users').get();
        const batch = db.batch();
        let r3 = 0;
        snap.forEach(doc => { const d = doc.data(); if (d.email !== currentUserEmail) { batch.delete(doc.ref); r3++; } });
        if (r3) await batch.commit();
        showPurgeProgress(true, `Done. Requests: ${r1} · ClientAccounts: ${r2} · Staff: ${r3}.`, 100);
        await logActivity('Full Auth Purge', `r=${r1}, ca=${r2}, u=${r3}`);
        showToast('Purge complete.', 'warning', 12000);
        setTimeout(() => showPurgeProgress(false), 5000);
    } catch (e) { showPurgeProgress(false); showToast('Purge failed: ' + e.message, 'error'); }
}

window.purgePortalRequests = purgePortalRequests;
window.purgeClientAccounts = purgeClientAccounts;
window.purgeStaffUsers = purgeStaffUsers;
window.purgeAuthOnly = purgeAuthOnly;

function renderUsers() {
    if (!isFullAccess()) return;
    const tbody = document.getElementById('usersBody');
    if (!tbody) return;
    if (!usersData.length) { tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center" style="padding:1rem;">No users found.</td></tr>`; return; }
    const isDeveloperViewer = (currentUserEmail || '').toLowerCase() === 'developer@kuriakaratu.com';
    const visibleUsers = usersData.filter(u => {
        const isDevAccount = (u.email || '').toLowerCase() === 'developer@kuriakaratu.com';
        if (isDevAccount && !isDeveloperViewer) return false;   
        return true;
    });

    tbody.innerHTML = visibleUsers.map(u => {
        const isCurrent = u.email === currentUserEmail;
        const roleClass = u.role === 'admin' ? 'admin' : u.role === 'developer' ? 'developer' : 'clerk';
        const canManage = isAdminOrDeveloper();
        return `<tr>
            <td>${u.email} ${isCurrent ? '<span class="badge blue">You</span>' : ''}</td>
            <td><span class="role-chip ${roleClass}">${u.role}</span></td>
            <td>${u.createdAt || '—'}</td>
            <td>${u.lastLogin || '—'}</td>
            <td style="text-align:center;">
                ${canManage && !isCurrent ? `<button class="btn btn-primary btn-sm" onclick="editUser('${u.id}')"><i class="fas fa-edit"></i></button>` : ''}
                ${canManage && !isCurrent ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>` : ''}
                ${isCurrent ? '<span class="text-muted fs-small">Current</span>' : ''}
            </td>
        </tr>`;
    }).join('');
}

async function createUser(email, password, role) {
    try {
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCred.user.uid).set({ email: email, role: role, createdAt: getDateTime(), lastLogin: getDateTime() });
        await logActivity('Created User', email);
        showToast(`User ${email} created successfully!`, 'info');
        return true;
    } catch (e) { showToast(e.message, 'error'); return false; }
}

async function updateUserRole(uid, role, password) {
    try {
        const updates = { role: role };
        if (password && password.length >= 6) {
            await auth.currentUser.updatePassword(password);
            await logActivity('Changed Password', `User: ${uid}`);
        }
        await db.collection('users').doc(uid).update(updates);
        await logActivity('Updated User Role', `User: ${uid} -> ${role}`);
        showToast('User updated successfully!', 'info');
        return true;
    } catch (e) { showToast(e.message, 'error'); return false; }
}

async function deleteUserAccount(uid) {
    try {
        const user = usersData.find(u => u.id === uid);
        await db.collection('users').doc(uid).delete();
        await logActivity('Deleted User', user ? user.email : uid);
        showToast('User deleted successfully!', 'info');
        return true;
    } catch (e) { showToast(e.message, 'error'); return false; }
}

async function updateLastLogin(email) {
    try {
        const users = await db.collection('users').where('email', '==', email).get();
        users.forEach(doc => { db.collection('users').doc(doc.id).update({ lastLogin: getDateTime() }); });
    } catch (e) { console.warn('Failed to update last login:', e); }
}

function applyRoleGating() {
    const isFull = isFullAccess();

    // Admin/developer-only nav items
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isFull ? 'flex' : 'none';
    });

    // Top-level sidebar nav items
    document.querySelectorAll('#sidebarNav > .nav-item').forEach(el => {
        const page = el.dataset.page;
        const dropdown = el.dataset.dropdown;
        if (!isFull) {
            if (dropdown === 'docsDrop' || dropdown === 'casesDrop') el.style.display = '';
            else if (page && CLERK_VIEWABLE_PAGES.includes(page)) el.style.display = '';
            else el.style.display = 'none';
        } else {
            el.style.display = '';
        }
    });

    // Top-level dropdown wrappers
    document.querySelectorAll('#sidebarNav > .dropdown-wrap').forEach(el => {
        if (!isFull) {
            if (el.id === 'docsDrop' || el.id === 'casesDrop') el.style.display = '';
            else el.style.display = 'none';
        } else {
            el.style.display = '';
        }
    });

    // Hide folder upload + manage sections buttons for clerks
    const msBtn = document.getElementById('manageSectionsBtn');
    if (msBtn) msBtn.style.display = isFull ? '' : 'none';

    const ufBtn = document.getElementById('uploadFolderBtn');
    if (ufBtn) ufBtn.style.display = isFull ? '' : 'none';

    // Hide "add" buttons for clerks
    const addBtns = [
        'addClientBtn',
        'addCaseBtn',
        'addGlobalInvoiceBtn',
        'generateReceiptBtn',
        'addUserBtn',
        'refreshTargetsBtn',
        'sendAllDueRemindersBtn'
    ];
    addBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn && !isFull) btn.style.display = 'none';
    });

    // Add Document button is available to clerks too
    const addDocBtn = document.getElementById('addDocBtn');
    if (addDocBtn) addDocBtn.style.display = '';

    // Task creation form is only for admin/developer
    const addTaskFormContainer = document.getElementById('addTaskFormContainer');
    if (addTaskFormContainer) {
        addTaskFormContainer.style.display = isFull ? '' : 'none';
    }

    // Global search is only for admin/developer
    const searchWrap = document.getElementById('globalSearchWrap');
    if (searchWrap) searchWrap.style.display = isFull ? '' : 'none';
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    // ----- Grab the form values and the error element -----
    const errorEl  = document.getElementById('loginError');
   const email = document.getElementById('loginEmailInput').value.trim();
    const password = document.getElementById('loginPassword').value;

    // ----- Basic validation -----
    if (!email) {
        if (errorEl) errorEl.textContent = 'Please select a user.';
        return;
    }
    if (!password) {
        if (errorEl) errorEl.textContent = 'Please enter your password.';
        return;
    }

    // ----- Grab the animation targets -----
    const submitBtn = document.getElementById('loginSubmitBtn');
    const loginBox  = document.querySelector('.login-box');
    const overlay   = document.getElementById('loginOverlay');
    const curtain   = document.getElementById('loginCurtain');
    const mainApp   = document.getElementById('mainApp');

    // ① Button morphs to spinner
    if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
    }
    if (errorEl) errorEl.textContent = '';

    try {
        // ----- Firebase sign-in -----
        const userCred = await auth.signInWithEmailAndPassword(email, password);
        const user = userCred.user;

        // ----- Load or create the user profile in Firestore -----
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists) {
            await db.collection('users').doc(user.uid).set({
                email: email,
                role: 'clerk',
                createdAt: getDateTime(),
                lastLogin: getDateTime()
            });
            currentUserRole = 'clerk';
        } else {
            currentUserRole = doc.data().role || 'clerk';
            await db.collection('users').doc(user.uid).update({
                lastLogin: getDateTime()
            });
        }

        currentUser = user;
        currentUserEmail = email;
        await updateLastLogin(email);

        // ② Login box lifts away
        if (loginBox) loginBox.classList.add('is-exiting');
        await new Promise(r => setTimeout(r, 380));

        // Fade the dark overlay
        if (overlay) overlay.classList.add('is-fading');
        await new Promise(r => setTimeout(r, 180));

        // ③ Curtain sweep
        if (curtain) curtain.classList.add('active');

        // Prepare the app in the background (hidden for now)
        if (mainApp) mainApp.style.display = 'flex';

        // Hide the login overlay completely once faded
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }

        // ----- Set topbar user info -----
        const avatarEl = document.getElementById('userAvatar');
        const nameEl   = document.getElementById('userNameDisplay');
        const roleEl   = document.getElementById('userRoleDisplay');
        if (avatarEl) avatarEl.textContent = email.charAt(0).toUpperCase();
        if (nameEl)   nameEl.textContent   = email.split('@')[0];
        if (roleEl)   roleEl.textContent   = currentUserRole;

        // ----- Apply role-based UI, log the login, load the logo, start listeners -----
        applyRoleGating();
        await logActivity('User Login', `Logged in as ${currentUserRole}`);
        await loadCompanyLogoFromFirestore();
        initApp();

        // ④ Remove curtain, reveal app with entrance animations
        await new Promise(r => setTimeout(r, 620));
        if (curtain) curtain.classList.remove('active');
        if (mainApp) mainApp.classList.add('app-entering');

        // Remove the entering class after animations finish so future
        // navigations don't replay the entrance
        setTimeout(() => {
            if (mainApp) mainApp.classList.remove('app-entering');
        }, 2200);

        // Toast — delayed so it lands after the app has settled
        setTimeout(() => {
            showToast(`Welcome, ${email.split('@')[0]}!`, 'info');
        }, 1400);

    } catch (error) {
        // ----- Reset the button and box on failure -----
        if (submitBtn) {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
        }
        if (loginBox) loginBox.classList.remove('is-exiting');
        if (overlay) overlay.classList.remove('is-fading');
        if (errorEl) errorEl.textContent = error.message;
        console.error('Login error:', error);
    }
});

const logoutBtnEl = $('logoutBtn');
if (logoutBtnEl) logoutBtnEl.addEventListener('click', async function() {
    if (confirm('Logout?')) {
        await logActivity('User Logout', 'Logged out');
        await auth.signOut();
        currentUser = null;
        currentUserEmail = '';
        currentUserRole = 'clerk';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('loginError').textContent = '';
        document.getElementById('loginPassword').value = '';
        if (taskReminderInterval) { clearInterval(taskReminderInterval); taskReminderInterval = null; }
        if (feeReminderInterval) { clearInterval(feeReminderInterval); feeReminderInterval = null; }
        if (reminderInterval) { clearInterval(reminderInterval); reminderInterval = null; }
        await loadUsersForLogin();
        showToast('Logged out successfully.', 'info');
    }
});

const safeAddListener = (id, event, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(event, fn); };

safeAddListener('manageSectionsBtn', 'click', openManageSectionsModal);
document.getElementById('uploadFolderBtn').addEventListener('click', openFolderUploadModal);
document.getElementById('folderFileInput').addEventListener('change', function() {
    if (this.files && this.files.length) handleFolderSelection(this.files);
});
document.getElementById('folderCategory').addEventListener('change', function() {
    if (folderPendingFiles.length) {
        folderPendingFiles.forEach(f => { f.detectedSection = this.value; f.overrideSub = ''; });
        renderFolderReview();
    }
});

document.getElementById('addUserBtn').addEventListener('click', function() {
    if (!isAdminOrDeveloper()) { showToast('Only admins and developers can manage users.', 'warning'); return; }
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserRole').value = 'clerk';
    openModal('addUserModal');
});

document.getElementById('addUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    if (!email || !password) { showToast('Please fill all fields.', 'warning'); return; }
    await createUser(email, password, role);
    closeModal('addUserModal');
    this.reset();
});

function editUser(uid) {
    if (!isAdminOrDeveloper()) { showToast('Only admins and developers can edit users.', 'warning'); return; }
    const user = usersData.find(u => u.id === uid);
    if (!user) return;
    document.getElementById('editUserId').value = uid;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserRole').value = user.role || 'clerk';
    document.getElementById('editUserPassword').value = '';
    openModal('editUserModal');
}

document.getElementById('editUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const uid = document.getElementById('editUserId').value;
    const role = document.getElementById('editUserRole').value;
    const password = document.getElementById('editUserPassword').value;
    await updateUserRole(uid, role, password);
    closeModal('editUserModal');
});

async function deleteUser(uid) {
    if (!isAdminOrDeveloper()) { showToast('Only admins and developers can delete users.', 'warning'); return; }
    if (!confirm('Delete this user permanently?')) return;
    await deleteUserAccount(uid);
}

function checkAndSendReminders() {
    if (!isFullAccess()) return;
    const now = new Date();
    const unpaid = invoicesData.filter(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');
    unpaid.forEach(inv => {
        const client = clientsData.find(c => c.id === inv.clientId);
        if (!client || !client.phone) return;
        const invDate = new Date(inv.date);
        const terms = parseInt(inv.terms) || 30;
        const dueDate = new Date(invDate);
        dueDate.setDate(dueDate.getDate() + terms);
        const dueStr = dueDate.toISOString().slice(0, 10);
        const daysSinceInvoice = getDaysBetween(now, invDate);
        if (daysSinceInvoice % 14 === 0 && daysSinceInvoice > 0) {
            const msg = `REMINDER: Invoice ${inv.invoiceNumber || '#'} of ${formatCurrency(inv.amount)} is due on ${dueStr}. Please settle your account. - Kuria Karatu & Co. Advocates`;
            sendWhatsApp(client.phone, client.name, msg);
            logActivity('Sent Reminder', `To ${client.name} for invoice ${inv.invoiceNumber}`);
            showToast(`Reminder sent to ${client.name}`, 'warning');
        }
        if (inv.status === 'Unpaid' && now > dueDate) updateInvoiceInFirestore(inv.id, { status: 'Overdue' });
    });
}

function requestNotificationPermission() {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
    catch (e) { console.warn('Notification permission error:', e); }
}

function fireBrowserNotification(title, body) {
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body: body, icon: companyLogoBase64 || undefined }); }
    catch (e) { console.warn('Browser notification failed:', e); }
}

function checkTaskReminders() {
    if (!currentUser || !isFullAccess()) return;
    const now = new Date();
    tasksData.forEach(t => {
        if (t.status !== 'Scheduled') return;
        if (t.reminderSent) return;
        if (!t.reminderDate || !t.reminderTime) return;
        let rem;
        try { rem = new Date(t.reminderDate + 'T' + (t.reminderTime.length === 5 ? t.reminderTime : '09:00')); } catch (e) { return; }
        if (isNaN(rem.getTime())) return;
        if (rem <= now) {
            const msg = `⏰ ${t.priority} priority task "${t.title}" is due ${t.date} at ${t.time}${t.caseName ? ' (' + t.caseName + ')' : ''}`;
            showToast(msg, 'warning', 12000);
            fireBrowserNotification('Kuria Karatu – Task Reminder', msg);
            updateTaskInFirestore(t.id, { reminderSent: true });
            logActivity('Task Reminder Fired', t.title);
        }
    });
}

function buildFeeReminderMessage(client, inst, isOverdue) {
    if (isOverdue) return `Dear ${client.name}, your agreed fee installment of ${formatCurrency(inst.amount)} was due on ${inst.date} and is now OVERDUE. Kindly settle your account to avoid further action. - Kuria Karatu & Company Advocates`;
    return `Dear ${client.name}, this is a friendly reminder that your agreed fee installment of ${formatCurrency(inst.amount)} is due on ${inst.date}. Kindly settle your account. - Kuria Karatu & Company Advocates`;
}

function sendFeeReminderWhatsApp(clientId, idx) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client || !client.feeAgreement) return;
    const inst = (client.feeAgreement.installments || [])[idx];
    if (!inst) return;
    if (!client.phone) { showToast('Client has no phone number.', 'warning'); return; }
    const isOverdue = inst.date < getToday();
    sendWhatsApp(client.phone, client.name, buildFeeReminderMessage(client, inst, isOverdue));
    logActivity('Sent Fee Reminder (WhatsApp)', `${client.name} – ${formatCurrency(inst.amount)} due ${inst.date}`);
}

function sendFeeReminderEmail(clientId, idx) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client || !client.feeAgreement) return;
    const inst = (client.feeAgreement.installments || [])[idx];
    if (!inst) return;
    if (!client.email) { showToast('Client has no email.', 'warning'); return; }
    const isOverdue = inst.date < getToday();
    sendEmail(client.email, (isOverdue ? 'OVERDUE: ' : 'REMINDER: ') + 'Fee Installment – Kuria Karatu & Company Advocates', buildFeeReminderMessage(client, inst, isOverdue));
    logActivity('Sent Fee Reminder (Email)', `${client.name} – ${formatCurrency(inst.amount)} due ${inst.date}`);
}

function sendAllDueFeeReminders() {
    if (!isFullAccess()) { showToast('Only admins and developers can send fee reminders.', 'warning'); return; }
    const today = getToday();
    let count = 0;
    clientsData.forEach(c => {
        const fa = c.feeAgreement;
        if (!fa || !Array.isArray(fa.installments)) return;
        fa.installments.forEach((inst, idx) => {
            if (inst.paid) return;
            if (!inst.date) return;
            if (inst.date <= today) {
                if (c.phone) { sendFeeReminderWhatsApp(c.id, idx); count++; }
                if (c.email) { sendFeeReminderEmail(c.id, idx); count++; }
            }
        });
    });
    if (count === 0) showToast('No due or overdue installments.', 'info');
    else showToast(`Dispatched ${count} fee reminder(s).`, 'info');
}

// ============================================================
// DOCUMENT GENERATOR — SLIDE-OVER
// ============================================================
(function setupDocGeneratorPanel() {
    const openBtn     = document.getElementById('openDocGeneratorBtn');
    const panel       = document.getElementById('docGenPanel');
    const backdrop    = document.getElementById('docGenBackdrop');
    const closeBtn    = document.getElementById('docGenClosePanel');
    const backBtn     = document.getElementById('docGenBackBtn'); 
    const standalone  = document.getElementById('docGenOpenStandalone');
    const frame       = document.getElementById('docGenFrame');

    if (!openBtn || !panel || !frame) return;

    function openPanel() {
        // Lazy-load the generator only the first time
        if (frame.src === 'about:blank') {
            // Pass shared session hints so the generator can auto-connect
            const params = new URLSearchParams({
                embedded: '1',
                firm: 'kuriakaratu-b5c90'
            });
            frame.src = 'generator.html?' + params.toString();
        }
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closePanel() {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

        openBtn.addEventListener('click', openPanel);
    closeBtn?.addEventListener('click', closePanel);
    backdrop?.addEventListener('click', closePanel);

    // "Back to AI Tools" — closes the panel and returns to the AI Tools page
    backBtn?.addEventListener('click', () => {
        closePanel();
        if (typeof navigate === 'function') navigate('ai', '', '');
    });
    standalone?.addEventListener('click', () => {
        window.open('generator.html', '_blank', 'noopener');
    });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) {
            closePanel();
            if (typeof navigate === 'function') navigate('ai', '', '');
        }
    });

    // Listen for save requests from the generator iframe
    window.addEventListener('message', (ev) => {
        if (!ev.data || ev.data.source !== 'kk-docgen') return;
        if (ev.data.action === 'saved' && ev.data.doc) {
            showToast(`Generated "${ev.data.doc.name}" saved to Documents.`, 'info');
        }
        if (ev.data.action === 'close') closePanel();
    });
})();

async function markInstallmentPaid(clientId, idx) {
    if (!isFullAccess()) { showToast('Read-only users cannot modify fee records.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client || !client.feeAgreement) return;
    const inst = (client.feeAgreement.installments || [])[idx];
    if (!inst) return;
    if (inst.paid) { showToast('Already marked as paid.', 'info'); return; }
    if (!confirm(`Mark installment ${idx + 1} (${formatCurrency(inst.amount)}) as paid for ${client.name}?`)) return;
    inst.paid = true;
    inst.paidDate = getToday();
    await updateClientInFirestore(clientId, { feeAgreement: client.feeAgreement });
    await logActivity('Fee Installment Paid', `${client.name} – ${formatCurrency(inst.amount)}`);
    showToast('Installment marked as paid.', 'info');
    if (currentPage === 'fees') renderFees();
    if (selectedClientId === clientId) showClientDetail(clientId);
}

function openRecordPaymentModal(clientId) {
    if (!canRecordPayments()) { showToast('Your role does not permit recording payments.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client) { showToast('Client not found.', 'error'); return; }
    if (!client.feeAgreement || !client.feeAgreement.totalFees) { showToast('No fee agreement set for this client. Please set one first.', 'warning'); return; }
    const fee = getClientFeeBalance(client);
    document.getElementById('paymentClientId').value = client.id;
    document.getElementById('paymentClientName').value = client.name;
    document.getElementById('paymentTotalFees').textContent = formatCurrency(fee.total);
    document.getElementById('paymentAlreadyPaid').textContent = formatCurrency(fee.paid);
    document.getElementById('paymentBalance').textContent = formatCurrency(fee.balance);
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentAmount').max = fee.balance;
    document.getElementById('paymentDate').value = getToday();
    document.getElementById('paymentMethod').value = 'M-PESA';
    document.getElementById('paymentReference').value = '';
    document.getElementById('paymentNotes').value = '';
    document.getElementById('paymentLinkInstallment').checked = fee.nextDue !== null;
    openModal('recordPaymentModal');
}

function fillFullBalance() {
    const balText = document.getElementById('paymentBalance').textContent;
    const bal = parseInt(balText.replace(/[^0-9]/g, '')) || 0;
    document.getElementById('paymentAmount').value = bal;
}

document.getElementById('recordPaymentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!canRecordPayments()) { showToast('Permission denied.', 'warning'); return; }
    const clientId = document.getElementById('paymentClientId').value;
    const client = clientsData.find(c => c.id === clientId);
    if (!client) { showToast('Client not found.', 'error'); return; }
    const amount = parseInt(document.getElementById('paymentAmount').value) || 0;
    if (amount <= 0) { showToast('Please enter a valid payment amount.', 'warning'); return; }
    const fee = getClientFeeBalance(client);
    if (amount > fee.balance) { if (!confirm(`The amount entered (${formatCurrency(amount)}) exceeds the outstanding balance (${formatCurrency(fee.balance)}). Record anyway?`)) return; }
    const date = document.getElementById('paymentDate').value || getToday();
    const method = document.getElementById('paymentMethod').value;
    const reference = document.getElementById('paymentReference').value.trim();
    const notes = document.getElementById('paymentNotes').value.trim();
    const linkInstallment = document.getElementById('paymentLinkInstallment').checked;
    const paymentRecord = { id: generatePaymentId(), amount: amount, date: date, method: method, reference: reference, notes: notes, recordedBy: currentUserEmail, recordedAt: getDateTime() };
    if (!client.feeAgreement) client.feeAgreement = emptyFeeAgreement();
    if (!Array.isArray(client.feeAgreement.payments)) client.feeAgreement.payments = [];
    client.feeAgreement.payments.push(paymentRecord);
    if (linkInstallment && Array.isArray(client.feeAgreement.installments)) {
        const nextIdx = client.feeAgreement.installments.findIndex(i => !i.paid && i.date);
        if (nextIdx >= 0) {
            client.feeAgreement.installments[nextIdx].paid = true;
            client.feeAgreement.installments[nextIdx].paidDate = date;
            client.feeAgreement.installments[nextIdx].linkedPaymentId = paymentRecord.id;
        }
    }
    await updateClientInFirestore(clientId, { feeAgreement: client.feeAgreement });
    await logActivity('Recorded Fee Payment', `${client.name} – ${formatCurrency(amount)} via ${method}`);
    closeModal('recordPaymentModal');
    showToast(`Payment of ${formatCurrency(amount)} recorded for ${client.name}.`, 'info');
    if (currentPage === 'fees') renderFees();
    if (currentPage === 'clients') renderClients();
    if (selectedClientId === clientId) showClientDetail(clientId);
});

async function deletePayment(clientId, paymentId) {
    if (!isFullAccess()) { showToast('Read-only users cannot delete payments.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client || !client.feeAgreement || !Array.isArray(client.feeAgreement.payments)) return;
    const payment = client.feeAgreement.payments.find(p => p.id === paymentId);
    if (!payment) { showToast('Payment not found.', 'error'); return; }
    if (!confirm(`Delete this payment of ${formatCurrency(payment.amount)} dated ${payment.date}?`)) return;
    client.feeAgreement.payments = client.feeAgreement.payments.filter(p => p.id !== paymentId);
    if (Array.isArray(client.feeAgreement.installments)) {
        client.feeAgreement.installments.forEach(inst => {
            if (inst.linkedPaymentId === paymentId) { inst.paid = false; inst.paidDate = null; delete inst.linkedPaymentId; }
        });
    }
    await updateClientInFirestore(clientId, { feeAgreement: client.feeAgreement });
    await logActivity('Deleted Fee Payment', `${client.name} – ${formatCurrency(payment.amount)}`);
    showToast('Payment deleted.', 'info');
    if (currentPage === 'fees') renderFees();
    if (selectedClientId === clientId) showClientDetail(clientId);
}

function openAddChargeModal(clientId) {
    if (!isFullAccess()) { showToast('Only admin/developer can add charges.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    document.getElementById('chargeClientId').value = client.id;
    document.getElementById('chargeClientName').value = client.name;
    document.getElementById('chargeDescription').value = '';
    document.getElementById('chargeAmount').value = '';
    document.getElementById('chargeDate').value = getToday();
    const caseSel = document.getElementById('chargeCase');
    caseSel.innerHTML = '<option value="">None / General</option>';
    casesData.filter(c => c.client === client.name).forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.caseNo + ' - ' + c.name;
        caseSel.appendChild(o);
    });
    document.getElementById('chargeAddToFeeTotal').checked = false;
    openModal('addChargeModal');
}

document.getElementById('addChargeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const clientId = document.getElementById('chargeClientId').value;
    const client = clientsData.find(c => c.id === clientId);
    if (!client) { showToast('Client not found.', 'error'); return; }
    const description = document.getElementById('chargeDescription').value.trim();
    const amount = parseInt(document.getElementById('chargeAmount').value) || 0;
    const date = document.getElementById('chargeDate').value || getToday();
    const caseId = document.getElementById('chargeCase').value || null;
    const caseData = caseId ? casesData.find(c => c.id === caseId) : null;
    const addToTotal = document.getElementById('chargeAddToFeeTotal').checked;
    if (!description || amount <= 0) { showToast('Please enter a valid description and amount.', 'warning'); return; }
    const invData = { clientId: client.id, clientName: client.name, caseId: caseId, caseName: caseData ? caseData.name : null, amount: amount, date: date, terms: 30, status: 'Unpaid', description: description, invoiceNumber: generateInvoiceNumber(), paidDate: null };
    const invId = await addInvoiceToFirestore(invData);
    if (!invId) { showToast('Failed to create charge invoice.', 'error'); return; }
    if (addToTotal) {
        if (!client.feeAgreement) client.feeAgreement = emptyFeeAgreement();
        client.feeAgreement.totalFees = (parseInt(client.feeAgreement.totalFees) || 0) + amount;
        await updateClientInFirestore(client.id, { feeAgreement: client.feeAgreement });
    }
    await logActivity('Added Charge', `${client.name} – ${formatCurrency(amount)}: ${description}`);
    closeModal('addChargeModal');
    showToast(`Charge of ${formatCurrency(amount)} added for ${client.name}.`, 'info');
    if (currentPage === 'fees') renderFees();
    if (currentPage === 'clients') renderClients();
    if (currentPage === 'invoices') renderAllInvoices();
    if (selectedClientId === clientId) showClientDetail(clientId);
});

function openAddExpenseModal(clientId) {
    if (!isFullAccess()) { showToast('Only admin/developer can add expenses.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    document.getElementById('expenseClientId').value = client.id;
    document.getElementById('expenseClientName').value = client.name;
    document.getElementById('expenseTitle').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseType').value = 'client';
    document.getElementById('expenseCategory').value = 'General';
    document.getElementById('expenseDate').value = getToday();
    document.getElementById('expenseNotes').value = '';
    const sel = document.getElementById('expenseCase');
    sel.innerHTML = '<option value="">None / General</option>';
    casesData.filter(c => c.client === client.name || c.clientId === client.id).forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.caseNo + ' - ' + c.name;
        sel.appendChild(o);
    });
    openModal('addExpenseModal');
}

document.getElementById('addExpenseForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const clientId = document.getElementById('expenseClientId').value;
    const client = clientsData.find(c => c.id === clientId);
    if (!client) { showToast('Client not found.', 'error'); return; }
    const title = document.getElementById('expenseTitle').value.trim();
    const amount = parseInt(document.getElementById('expenseAmount').value) || 0;
    if (!title || amount <= 0) { showToast('Please enter title and valid amount.', 'warning'); return; }
    const type = document.getElementById('expenseType').value;
    const category = document.getElementById('expenseCategory').value;
    const date = document.getElementById('expenseDate').value || getToday();
    const caseId = document.getElementById('expenseCase').value || null;
    const notes = document.getElementById('expenseNotes').value.trim();
    const exp = { id: generateExpenseId(), title: title, amount: amount, type: type, category: category, date: date, caseId: caseId, notes: notes, recordedBy: currentUserEmail, recordedAt: getDateTime() };
    if (!Array.isArray(client.expenses)) client.expenses = [];
    client.expenses.push(exp);
    await updateClientInFirestore(clientId, { expenses: client.expenses });
    if ((type === 'court' || category === 'Court Fee') && caseId) {
        const c = casesData.find(x => x.id === caseId);
        if (c) await updateCaseInFirestore(caseId, { courtFees: (parseInt(c.courtFees) || 0) + amount });
    }
    await logActivity('Added Expense', `${client.name} – ${formatCurrency(amount)}: ${title} (${type})`);
    closeModal('addExpenseModal');
    showToast(`Expense of ${formatCurrency(amount)} recorded.`, 'info');
    if (selectedClientId === clientId) showClientDetail(clientId);
    if (currentPage === 'clients') renderClients();
});

async function deleteExpense(clientId, expenseId) {
    if (!isFullAccess()) { showToast('Read-only.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client || !Array.isArray(client.expenses)) return;
    const exp = client.expenses.find(x => x.id === expenseId);
    if (!exp) return;
    if (!confirm(`Delete expense "${exp.title}" (${formatCurrency(exp.amount)})?`)) return;
    client.expenses = client.expenses.filter(x => x.id !== expenseId);
    await updateClientInFirestore(clientId, { expenses: client.expenses });
    if ((exp.type === 'court' || exp.category === 'Court Fee') && exp.caseId) {
        const c = casesData.find(x => x.id === exp.caseId);
        if (c) await updateCaseInFirestore(exp.caseId, { courtFees: Math.max(0, (parseInt(c.courtFees) || 0) - (parseInt(exp.amount) || 0)) });
    }
    await logActivity('Deleted Expense', `${client.name} – ${formatCurrency(exp.amount)}: ${exp.title}`);
    showToast('Expense deleted.', 'info');
    if (selectedClientId === clientId) showClientDetail(clientId);
    if (currentPage === 'clients') renderClients();
}

function openRequestDocumentModal(clientId) {
    if (!isFullAccess()) { showToast('Only admin/developer.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    document.getElementById('requestDocClientId').value = client.id;
    document.getElementById('requestDocClientName').value = client.name;
    document.getElementById('requestDocTitle').value = '';
    document.getElementById('requestDocDescription').value = '';
    document.getElementById('requestDocDueDate').value = '';
    openModal('requestDocumentModal');
}

document.getElementById('requestDocumentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const clientId = document.getElementById('requestDocClientId').value;
    const client = clientsData.find(c => c.id === clientId);
    if (!client) { showToast('Client not found.', 'error'); return; }
    const title = document.getElementById('requestDocTitle').value.trim();
    if (!title) { showToast('Document title required.', 'warning'); return; }
    const req = { id: generateDocRequestId(), title: title, description: document.getElementById('requestDocDescription').value.trim(), dueDate: document.getElementById('requestDocDueDate').value || '', requestedAt: getDateTime(), requestedBy: currentUserEmail, status: 'pending', fileId: '', fileName: '' };
    if (!Array.isArray(client.docRequests)) client.docRequests = [];
    client.docRequests.push(req);
    await updateClientInFirestore(clientId, { docRequests: client.docRequests });
    await logActivity('Requested Document', `${client.name}: ${title}`);
    try {
        const accounts = portalAccountsData.filter(a => a.clientId === clientId && a.approved);
        for (const acc of accounts) {
            await db.collection('clientNotifications').add({ uid: acc.uid, clientId: clientId, type: 'docRequest', title: 'Document Requested', message: `Please upload: ${title}`, reqId: req.id, createdAt: getDateTime(), read: false });
        }
    } catch (e) {}
    closeModal('requestDocumentModal');
    showToast('Document request sent.', 'info');
    if (selectedClientId === clientId) showClientDetail(clientId);
});

function openUploadRequestedDocModal(clientId, reqId) {
    if (!isFullAccess()) { showToast('Only admin/developer.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    const req = (client.docRequests || []).find(r => r.id === reqId);
    if (!req) return;
    document.getElementById('uploadReqClientId').value = clientId;
    document.getElementById('uploadReqId').value = reqId;
    document.getElementById('uploadReqTitle').value = req.title;
    document.getElementById('uploadReqFile').value = '';
    document.getElementById('uploadReqNotes').value = '';
    openModal('uploadRequestedDocModal');
}

document.getElementById('uploadRequestedDocForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const clientId = document.getElementById('uploadReqClientId').value;
    const reqId = document.getElementById('uploadReqId').value;
    const file = document.getElementById('uploadReqFile').files[0];
    const notes = document.getElementById('uploadReqNotes').value.trim();
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    const req = (client.docRequests || []).find(r => r.id === reqId);
    if (!req) return;
    if (!file) { showToast('Please select a file.', 'warning'); return; }
    const fileId = 'f' + (++fileStoreId);
    const reader = new FileReader();
    reader.onload = async function(ev) {
        const dataUrl = ev.target.result;
        fileStore[fileId] = dataUrl;
        await saveFileToIndexedDB(fileId, dataUrl);
        await addDocumentToFirestore({ name: file.name, category: 'Client Upload', matter: client.name, uploaded: getToday(), size: (file.size / 1024).toFixed(1) + ' KB', fileId: fileId, downloadUrl: '', base64: dataUrl });
        req.status = 'received';
        req.fileId = fileId;
        req.fileName = file.name;
        req.receivedAt = getDateTime();
        req.notes = notes;
        await updateClientInFirestore(clientId, { docRequests: client.docRequests });
        await logActivity('Received Requested Document', `${client.name}: ${req.title}`);
        closeModal('uploadRequestedDocModal');
        showToast('Document received.', 'info');
        if (selectedClientId === clientId) showClientDetail(clientId);
    };
    reader.readAsDataURL(file);
});

async function cancelDocRequest(clientId, reqId) {
    if (!isFullAccess()) return;
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    const req = (client.docRequests || []).find(r => r.id === reqId);
    if (!req) return;
    if (!confirm(`Cancel request "${req.title}"?`)) return;
    req.status = 'cancelled';
    req.cancelledAt = getDateTime();
    await updateClientInFirestore(clientId, { docRequests: client.docRequests });
    showToast('Request cancelled.', 'info');
    if (selectedClientId === clientId) showClientDetail(clientId);
}

function openAttachClientDocModal(clientId) {
    if (!isFullAccess()) { showToast('Only admin/developer.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    document.getElementById('attachDocClientId').value = client.id;
    document.getElementById('attachDocClientName').value = client.name;
    document.getElementById('attachDocFile').value = '';
    document.getElementById('attachDocDescription').value = '';
    openModal('attachClientDocModal');
}

document.getElementById('attachClientDocForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const clientId = document.getElementById('attachDocClientId').value;
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    const file = document.getElementById('attachDocFile').files[0];
    const desc = document.getElementById('attachDocDescription').value.trim();
    if (!file) { showToast('Please select a file.', 'warning'); return; }
    const fileId = 'f' + (++fileStoreId);
    const reader = new FileReader();
    reader.onload = async function(ev) {
        const dataUrl = ev.target.result;
        fileStore[fileId] = dataUrl;
        await saveFileToIndexedDB(fileId, dataUrl);
        await addDocumentToFirestore({ name: file.name, category: 'Client File', matter: client.name, uploaded: getToday(), size: (file.size / 1024).toFixed(1) + ' KB', fileId: fileId, downloadUrl: '', base64: dataUrl, description: desc });
        if (!Array.isArray(client.documents)) client.documents = [];
        client.documents.push({ name: file.name, fileId: fileId, uploaded: getToday(), size: (file.size / 1024).toFixed(1) + ' KB', description: desc });
        await updateClientInFirestore(clientId, { documents: client.documents });
        await logActivity('Attached Client Document', `${client.name}: ${file.name}`);
        closeModal('attachClientDocModal');
        showToast('Document attached.', 'info');
        if (selectedClientId === clientId) showClientDetail(clientId);
    };
    reader.readAsDataURL(file);
});

async function deleteClientDocument(clientId, fileId) {
    if (!isFullAccess()) { showToast('Read-only.', 'warning'); return; }
    const client = clientsData.find(c => c.id === clientId);
    if (!client || !Array.isArray(client.documents)) return;
    const doc = client.documents.find(x => x.fileId === fileId);
    if (!doc) return;
    if (!confirm(`Delete "${doc.name}" from client's file?`)) return;
    client.documents = client.documents.filter(x => x.fileId !== fileId);
    await updateClientInFirestore(clientId, { documents: client.documents });

    const referencedElsewhere =
        clientsData.some(c => c.id !== clientId && Array.isArray(c.documents) && c.documents.some(d => d.fileId === fileId)) ||
        casesData.some(c => Array.isArray(c.documents) && c.documents.some(d => d.fileId === fileId));

    if (!referencedElsewhere) {
        if (fileStore[fileId]) { delete fileStore[fileId]; await deleteFileFromIndexedDB(fileId); }
        const master = documentsData.find(d => d.fileId === fileId);
        if (master) await deleteDocFromFirestore(master.id);
    }
    showToast('Document deleted.', 'info');
    if (selectedClientId === clientId) showClientDetail(clientId);
}

function openMarkCaseFiledModal(caseId) {
    if (!isFullAccess()) { showToast('Only admin/developer.', 'warning'); return; }
    const c = casesData.find(x => x.id === caseId);
    if (!c) return;
    document.getElementById('markFiledCaseId').value = caseId;
    document.getElementById('markFiledCaseName').value = c.name;
    document.getElementById('markFiledCaseFee').value = c.caseFee || 0;
    document.getElementById('markFiledCourtFees').value = c.courtFees || 0;
    document.getElementById('markFiledDate').value = getToday();
    openModal('markCaseFiledModal');
}

document.getElementById('markCaseFiledForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const caseId = document.getElementById('markFiledCaseId').value;
    const caseFee = parseInt(document.getElementById('markFiledCaseFee').value) || 0;
    const courtFees = parseInt(document.getElementById('markFiledCourtFees').value) || 0;
    const filedDate = document.getElementById('markFiledDate').value || getToday();
    await updateCaseInFirestore(caseId, { filed: true, filedDate: filedDate, caseFee: caseFee, courtFees: courtFees });
    await logActivity('Marked Case as Filed', `${caseId} — Fee ${formatCurrency(caseFee)}`);
    closeModal('markCaseFiledModal');
    showToast('Case marked as filed. Earned revenue updated.', 'info');
});

async function deleteDocument(docId, caseId = null, fileId = null, docName = '') {
    if (!canDeleteDocuments()) { showToast('Your role does not permit deleting documents.', 'warning'); return; }
    if (docId) {
        const doc = documentsData.find(d => d.id === docId);
        if (!doc) { showToast('Document not found.', 'error'); return; }
        if (!confirm(`Delete "${doc.name}" from the system?`)) return;
        if (doc.fileId) { delete fileStore[doc.fileId]; await deleteFileFromIndexedDB(doc.fileId); }
        for (const c of casesData) {
            if (c.documents && c.documents.some(d => d.fileId === doc.fileId)) {
                const updatedDocs = c.documents.filter(d => d.fileId !== doc.fileId);
                await updateCaseInFirestore(c.id, { documents: updatedDocs });
            }
        }
        await deleteDocFromFirestore(docId);
        showToast(`Document "${doc.name}" deleted.`, 'info');
        return;
    }
    if (caseId && fileId) {
        const caseData = casesData.find(c => c.id === caseId);
        if (!caseData) { showToast('Case not found.', 'error'); return; }
        const docInCase = caseData.documents?.find(d => d.fileId === fileId);
        if (!docInCase) { showToast('Document not linked to this case.', 'warning'); return; }
        if (!confirm(`Remove "${docInCase.name}" from this case?`)) return;
        const updatedDocs = caseData.documents.filter(d => d.fileId !== fileId);
        await updateCaseInFirestore(caseId, { documents: updatedDocs });
        const masterDoc = documentsData.find(d => d.fileId === fileId);
        if (masterDoc) {
            let linkedElsewhere = false;
            for (const c of casesData) {
                if (c.id !== caseId && c.documents?.some(d => d.fileId === fileId)) { linkedElsewhere = true; break; }
            }
            if (!linkedElsewhere) {
                if (fileStore[fileId]) { delete fileStore[fileId]; await deleteFileFromIndexedDB(fileId); }
                await deleteDocFromFirestore(masterDoc.id);
                showToast(`Document "${masterDoc.name}" removed and deleted.`, 'info');
            } else showToast(`Document "${masterDoc.name}" removed from this case.`, 'info');
        } else {
            if (fileStore[fileId]) { delete fileStore[fileId]; await deleteFileFromIndexedDB(fileId); }
            showToast('Document removed from case.', 'info');
        }
        return;
    }
    showToast('Unable to delete document.', 'error');
}

let casesUnsubscribe, docsUnsubscribe, tasksUnsubscribe, clientsUnsubscribe, invoicesUnsubscribe,
    targetsUnsubscribe, receiptsUnsubscribe, activityUnsubscribe, usersUnsubscribe;

function listenCases() {
    if (casesUnsubscribe) casesUnsubscribe();
    casesUnsubscribe = db.collection('cases').onSnapshot(snap => {
        casesData = [];
        snap.forEach(doc => { const d = doc.data(); d.id = doc.id; casesData.push(d); });
        if (currentPage === 'cases') renderCases(currentFilter, currentSubfilter);
        updateDashboardStats();
        renderCalendar();
        populateTaskCaseDropdown();
        populateTaskClientDropdown();
        populateTaskFilters();
        checkNotifications();
        updateCharts();
        if (selectedClientId) showClientDetail(selectedClientId);
        populateCaseClientDropdowns();
        renderAllInvoices();
        if (currentPage === 'documents') renderDocuments(currentFilter);
        if (currentPage === 'targets') renderTargets();
        if (currentPage === 'payments') renderPayments();
    });
}

function listenDocuments() {
    if (docsUnsubscribe) docsUnsubscribe();
    docsUnsubscribe = db.collection('documents').onSnapshot(snap => {
        documentsData = [];
        snap.forEach(doc => { const d = doc.data(); d.id = doc.id; documentsData.push(d); });
        if (currentPage === 'documents') renderDocuments(currentFilter);
        if (selectedCaseId) { const c = casesData.find(c => c.id === selectedCaseId); if (c) showCaseDetail(selectedCaseId); }
        if (selectedClientId) showClientDetail(selectedClientId);
        if (currentPage === 'targets') renderTargets();
    });
}

function listenTasks() {
    if (tasksUnsubscribe) tasksUnsubscribe();
    tasksUnsubscribe = db.collection('tasks').onSnapshot(snap => {
        tasksData = [];
        snap.forEach(doc => { const d = doc.data(); d.id = doc.id; tasksData.push(d); });
        if (currentPage === 'calendar') renderTasks();
        renderUpcomingTasks();
        renderCalendar();
        updateTaskPriorityStats();
        checkNotifications();
        populateTaskFilters();
        updateDashboardStats();
        checkTaskReminders();
        if (selectedClientId) showClientDetail(selectedClientId);
        if (currentPage === 'targets') renderTargets();
    });
}

function listenClients() {
    if (clientsUnsubscribe) clientsUnsubscribe();
    clientsUnsubscribe = db.collection('clients').onSnapshot(snap => {
        clientsData = [];
        snap.forEach(doc => {
            const d = doc.data();
            d.id = doc.id;
            if (!d.expenses) d.expenses = [];
            if (!d.documents) d.documents = [];
            if (!d.docRequests) d.docRequests = [];
            clientsData.push(d);
        });
        if (currentPage === 'clients') renderClients();
        populateCaseClientDropdowns();
        populateInvoiceClientDropdown();
        populateTaskClientDropdown();
        updateDashboardStats();
        if (selectedClientId) showClientDetail(selectedClientId);
        renderAllInvoices();
        if (currentPage === 'targets') renderTargets();
        if (currentPage === 'payments') renderPayments();
        if (currentPage === 'fees') renderFees();
        checkFeeReminders();
    });
}

function listenInvoices() {
    if (invoicesUnsubscribe) invoicesUnsubscribe();
    invoicesUnsubscribe = db.collection('invoices').onSnapshot(snap => {
        invoicesData = [];
        snap.forEach(doc => { const d = doc.data(); d.id = doc.id; invoicesData.push(d); });
        if (currentPage === 'clients') renderClients();
        if (selectedClientId) showClientDetail(selectedClientId);
        updateDashboardStats();
        renderAllInvoices();
        if (currentPage === 'targets') renderTargets();
        if (currentPage === 'payments') renderPayments();
        populateUnpaidInvoiceDropdown();
        checkAndSendReminders();
    });
}

function listenReceipts() {
    if (receiptsUnsubscribe) receiptsUnsubscribe();
    receiptsUnsubscribe = db.collection('receipts').onSnapshot(snap => {
        receiptsData = [];
        snap.forEach(doc => { const d = doc.data(); d.id = doc.id; receiptsData.push(d); });
        if (currentPage === 'payments') renderPayments();
        populateUnpaidInvoiceDropdown();
    });
}

function listenTargets() {
    if (targetsUnsubscribe) targetsUnsubscribe();
    targetsUnsubscribe = db.collection('targets').onSnapshot(snap => {
        const result = {};
        snap.forEach(doc => {
            const d = doc.data();
            result[doc.id] = { revenue: parseInt(d.revenue) || 0, won: parseInt(d.won) || 0, filed: parseInt(d.filed) || 0, active: parseInt(d.active) || 0, updatedAt: d.updatedAt || '' };
        });
        targetsData = result;
        if (currentPage === 'targets') renderTargets();
    });
}

function listenActivity() {
    if (activityUnsubscribe) activityUnsubscribe();
    activityUnsubscribe = db.collection('activityLogs').orderBy('timestamp', 'desc').limit(200).onSnapshot(snap => {
        activityLogs = [];
        snap.forEach(doc => { const d = doc.data(); d.id = doc.id; activityLogs.push(d); });
        if (currentPage === 'activity') renderActivityLog();
    });
}

function listenAccidentClients() {
    if (accidentClientsUnsubscribe) accidentClientsUnsubscribe();
    accidentClientsUnsubscribe = db.collection('accidentClients').onSnapshot(snap => {
        accidentClientsData = [];
        snap.forEach(doc => {
            const d = doc.data();
            d.id = doc.id;
            if (!Array.isArray(d.advances)) d.advances = [];
            accidentClientsData.push(d);
        });
        if (currentPage === 'accidentClients') renderAccidentClients();
        if (selectedAccClientId) {
            const stillExists = accidentClientsData.find(x => x.id === selectedAccClientId);
            if (stillExists) showAccidentClientDetail(selectedAccClientId);
        }
        updateAccidentSummary();
    });
}

function listenUsers() {
    if (usersUnsubscribe) usersUnsubscribe();
    usersUnsubscribe = db.collection('users').onSnapshot(snap => {
        usersData = [];
        snap.forEach(doc => {
            const d = doc.data();
            d.id = doc.id;
            if (d.email !== 'user@kuriakaratu.com') usersData.push(d);
        });
        if (currentPage === 'users') renderUsers();
        populateLoginDropdown();
    });
}

function getPracticeMetrics(practice) {
    const practiceCases = casesData.filter(c => c.area === practice);
    let revenue = 0;
    const caseIds = practiceCases.map(c => c.id);
    invoicesData.forEach(inv => { if (inv.caseId && caseIds.includes(inv.caseId)) revenue += parseInt(inv.amount) || 0; });
    const won = practiceCases.filter(c => c.decision === 'In our favour').length;
    const filed = practiceCases.filter(c => c.filed === true).length;
    const active = practiceCases.filter(c => c.status === 'Active').length;
    return { revenue, won, filed, active };
}

function renderTargets() {
    if (!isFullAccess()) return;
    const grid = document.getElementById('practiceTargetGrid');
    const year = new Date().getFullYear();
       setText('targetsYearBadge', year);
    let totalRevenueTarget = 0, totalRevenueCurrent = 0;
    let totalWonTarget = 0, totalWonCurrent = 0;
    let totalFiledTarget = 0, totalFiledCurrent = 0;
    let practicesWithTargets = 0;
    const cards = [];
    for (const practice of PRACTICE_AREAS) {
        const metrics = getPracticeMetrics(practice);
        const target = targetsData[practice] || { revenue: 0, won: 0, filed: 0, active: 0 };
        const hasTarget = target.revenue > 0 || target.won > 0 || target.filed > 0 || target.active > 0;
        if (hasTarget) practicesWithTargets++;
        totalRevenueTarget += target.revenue; totalRevenueCurrent += metrics.revenue;
        totalWonTarget += target.won; totalWonCurrent += metrics.won;
        totalFiledTarget += target.filed; totalFiledCurrent += metrics.filed;
        const pctRevenue = target.revenue > 0 ? Math.min(100, Math.round((metrics.revenue / target.revenue) * 100)) : 0;
        const pctWon = target.won > 0 ? Math.min(100, Math.round((metrics.won / target.won) * 100)) : 0;
        const pctFiled = target.filed > 0 ? Math.min(100, Math.round((metrics.filed / target.filed) * 100)) : 0;
        const pctActive = target.active > 0 ? Math.min(100, Math.round((metrics.active / target.active) * 100)) : 0;
        const avgPct = Math.round((pctRevenue + pctWon + pctFiled + pctActive) / 4);
        let statusClass = 'on-track', statusLabel = 'On Track';
        if (avgPct < 30 && hasTarget) { statusClass = 'behind'; statusLabel = 'Behind'; }
        else if (avgPct < 60 && hasTarget) { statusClass = 'at-risk'; statusLabel = 'At Risk'; }
        else if (avgPct >= 100) { statusClass = 'exceeded'; statusLabel = 'Exceeded'; }
        else if (!hasTarget) { statusClass = 'gray'; statusLabel = 'No Targets'; }
        const hasAnyTarget = target.revenue > 0 || target.won > 0 || target.filed > 0 || target.active > 0;
        let metricsHtml = '';
        if (hasAnyTarget) {
            const renderMetric = (label, current, tgt, pct, unit = '') => {
                if (tgt === 0) return '';
                const pctClass = pct >= 100 ? 'exceed' : pct >= 60 ? 'good' : pct >= 30 ? 'warn' : 'danger';
                const barClass = pctClass;
                const displayCurrent = unit === 'KES' ? formatCurrency(current) : current;
                const displayTarget = unit === 'KES' ? formatCurrency(tgt) : tgt;
                return `<div class="pt-metric"><div class="pt-metric-row"><span class="pt-metric-label">${label}</span><span class="pt-metric-values"><span class="current-val">${displayCurrent}</span><span class="target-val">/ ${displayTarget}</span><span class="pct ${pctClass}">${pct}%</span></span></div><div class="pt-progress"><div class="pt-progress-bar ${barClass}" style="width:${Math.min(100, pct)}%;"></div></div></div>`;
            };
            metricsHtml += renderMetric('Revenue', metrics.revenue, target.revenue, pctRevenue, 'KES');
            metricsHtml += renderMetric('Cases Won', metrics.won, target.won, pctWon);
            metricsHtml += renderMetric('Cases Filed', metrics.filed, target.filed, pctFiled);
            metricsHtml += renderMetric('Active Cases', metrics.active, target.active, pctActive);
        } else {
            metricsHtml = `<div class="pt-no-target">No targets set. Click Edit to set targets.</div>`;
        }
        cards.push(`<div class="practice-target-card" data-practice="${practice}"><div class="pt-header"><div class="pt-name"><span class="pt-icon"><i class="fas fa-gavel"></i></span>${practice}</div><div><span class="pt-status ${statusClass}">${statusLabel}</span>${isFullAccess() ? `<button class="target-edit-btn" onclick="openEditTargets('${practice}')"><i class="fas fa-pen"></i></button>` : ''}</div></div>${metricsHtml}</div>`);
    }
    grid.innerHTML = cards.join('');
    document.getElementById('ovTotalRevenue').textContent = formatCurrency(totalRevenueTarget);
    const revPct = totalRevenueTarget > 0 ? Math.min(100, Math.round((totalRevenueCurrent / totalRevenueTarget) * 100)) : 0;
    document.getElementById('ovRevenueProgress').textContent = `${revPct}% achieved`;
    document.getElementById('ovTotalWon').textContent = totalWonTarget;
    const wonPct = totalWonTarget > 0 ? Math.min(100, Math.round((totalWonCurrent / totalWonTarget) * 100)) : 0;
    document.getElementById('ovWonProgress').textContent = `${wonPct}% achieved`;
    document.getElementById('ovTotalFiled').textContent = totalFiledTarget;
    const filedPct = totalFiledTarget > 0 ? Math.min(100, Math.round((totalFiledCurrent / totalFiledTarget) * 100)) : 0;
    document.getElementById('ovFiledProgress').textContent = `${filedPct}% achieved`;
    document.getElementById('ovActivePractices').textContent = PRACTICE_AREAS.filter(p => { const t = targetsData[p] || {}; return t.revenue > 0 || t.won > 0 || t.filed > 0 || t.active > 0; }).length;
    document.getElementById('ovPracticesWithTargets').textContent = `${practicesWithTargets} with targets set`;
}

function openEditTargets(practice) {
    if (!isFullAccess()) { showToast('Only admins and developers can edit targets.', 'warning'); return; }
    const target = targetsData[practice] || { revenue: 0, won: 0, filed: 0, active: 0 };
    document.getElementById('targetModalPracticeId').value = practice;
    document.getElementById('targetModalPracticeName').textContent = practice;
    document.getElementById('targetRevenue').value = target.revenue || '';
    document.getElementById('targetWon').value = target.won || '';
    document.getElementById('targetFiled').value = target.filed || '';
    document.getElementById('targetActive').value = target.active || '';
    openModal('editTargetsModal');
}

document.getElementById('editTargetsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const practice = document.getElementById('targetModalPracticeId').value;
    const data = { revenue: parseInt(document.getElementById('targetRevenue').value) || 0, won: parseInt(document.getElementById('targetWon').value) || 0, filed: parseInt(document.getElementById('targetFiled').value) || 0, active: parseInt(document.getElementById('targetActive').value) || 0 };
    const success = await saveTargetToFirestore(practice, data);
    if (success) { closeModal('editTargetsModal'); showToast(`Targets for ${practice} saved!`, 'info'); }
    else showToast('Failed to save targets.', 'error');
});

document.getElementById('refreshTargetsBtn').addEventListener('click', function() { if (!isFullAccess()) return; showToast('Targets refreshed.', 'info'); });

function invoiceActionsHTML(inv) {
    const client = clientsData.find(c => c.id === inv.clientId);
    const hasPhone = !!(client && client.phone);
    const hasEmail = !!(client && client.email);
    return `
        <button class="btn btn-outline btn-sm" onclick="viewInvoice('${inv.id}')" title="View"><i class="fas fa-eye"></i></button>
        ${isFullAccess() ? `<button class="btn btn-primary btn-sm" onclick="editInvoice('${inv.id}')" title="Edit"><i class="fas fa-edit"></i></button>` : ''}
        ${isFullAccess() ? `<button class="btn btn-danger btn-sm" onclick="deleteInvoice('${inv.id}')" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="printInvoice('${inv.id}')" title="Print / Preview"><i class="fas fa-print"></i></button>
        <button class="btn btn-sm" style="background:#25D366;color:#fff;" onclick="shareInvoiceWhatsApp('${inv.id}')" title="Share via WhatsApp" ${hasPhone ? '' : 'disabled'}><i class="fab fa-whatsapp"></i></button>
        <button class="btn btn-sm" style="background:#ea4335;color:#fff;" onclick="shareInvoiceEmail('${inv.id}')" title="Share via Email" ${hasEmail ? '' : 'disabled'}><i class="fas fa-envelope"></i></button>
        <button class="btn btn-sm" style="background:#0f172a;color:#fff;" onclick="downloadInvoice('${inv.id}')" title="Download invoice"><i class="fas fa-download"></i></button>
    `;
}

function renderPayments() {
    if (!isFullAccess()) return;
    const tbody = $('paymentsBody');
    if (!tbody) return;
    const paidInvoices = invoicesData.filter(inv => inv.status === 'Paid');
    const unpaidInvoices = invoicesData.filter(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + parseInt(inv.amount), 0);
    const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + parseInt(inv.amount), 0);
    const overdueCount = invoicesData.filter(inv => inv.status === 'Overdue').length;
      setText('psTotalPaid', formatCurrency(totalPaid));
    setText('psTotalOutstanding', formatCurrency(totalOutstanding));
    setText('psOverdueCount', overdueCount);
    const now = new Date();
    const reminders = invoicesData.filter(inv => { if (inv.status === 'Paid') return false; const invDate = new Date(inv.date); return getDaysBetween(now, invDate) > 14; });
      setText('psRemindersCount', reminders.length);
    const allInvoices = [...invoicesData].sort((a, b) => b.date.localeCompare(a.date));
    if (!allInvoices.length) { tbody.innerHTML = `<tr><td colspan="8" class="text-muted text-center" style="padding:1rem;">No invoices found.</td></tr>`; }
    else {
        tbody.innerHTML = allInvoices.map(inv => {
            const client = clientsData.find(c => c.id === inv.clientId);
            const clientName = client ? client.name : inv.clientName || 'Unknown';
            const statusClass = inv.status === 'Paid' ? 'green' : inv.status === 'Overdue' ? 'red' : 'yellow';
            const balance = inv.status === 'Paid' ? 0 : parseInt(inv.amount);
            return `<tr>
                <td><strong>${clientName}</strong></td>
                <td>${inv.invoiceNumber || '#'}</td>
                <td>${formatCurrency(inv.amount)}</td>
                <td>${inv.date}</td>
                <td><span class="badge ${statusClass}">${inv.status || 'Unpaid'}</span></td>
                <td>${inv.paidDate || '—'}</td>
                <td><span class="badge ${balance === 0 ? 'green' : 'red'}">${formatCurrency(balance)}</span></td>
                <td style="text-align:center;white-space:nowrap;">
                    <button class="btn btn-outline btn-sm" onclick="viewInvoice('${inv.id}')" title="View"><i class="fas fa-eye"></i></button>
                    ${inv.status !== 'Paid' ? `<button class="btn btn-success btn-sm" onclick="markInvoicePaid('${inv.id}')" title="Mark Paid"><i class="fas fa-check"></i></button>` : ''}
                    ${inv.status !== 'Paid' ? `<button class="btn btn-warning btn-sm" onclick="sendPaymentReminder('${inv.id}')" title="Send Reminder"><i class="fas fa-bell"></i></button>` : ''}
                    <button class="btn btn-primary btn-sm" onclick="editInvoice('${inv.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${inv.id}')"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-outline btn-sm" onclick="printInvoice('${inv.id}')"><i class="fas fa-print"></i></button>
                    <button class="btn btn-sm" style="background:#25D366;color:#fff;" onclick="shareInvoiceWhatsApp('${inv.id}')" title="Share via WhatsApp"><i class="fab fa-whatsapp"></i></button>
                    <button class="btn btn-sm" style="background:#ea4335;color:#fff;" onclick="shareInvoiceEmail('${inv.id}')" title="Share via Email"><i class="fas fa-envelope"></i></button>
                    <button class="btn btn-sm" style="background:#0f172a;color:#fff;" onclick="downloadInvoice('${inv.id}')" title="Download"><i class="fas fa-download"></i></button>
                </td>
            </tr>`;
        }).join('');
    }
    const receiptsBody = $('receiptsBody');
    if (!receiptsBody) return;
    if (!receiptsData.length) { receiptsBody.innerHTML = `<tr><td colspan="7" class="text-muted text-center" style="padding:1rem;">No receipts generated yet.</td></tr>`; return; }
    receiptsBody.innerHTML = receiptsData.sort((a, b) => b.date.localeCompare(a.date)).map(r => {
        const client = clientsData.find(c => c.id === r.clientId);
        const clientName = client ? client.name : r.clientName || 'Unknown';
        return `<tr>
            <td><strong>${r.receiptNumber}</strong></td>
            <td>${clientName}</td>
            <td>${r.invoiceNumber || '#'}</td>
            <td>${formatCurrency(r.amount)}</td>
            <td>${r.date}</td>
            <td><span class="digital-stamp" style="padding:0.2rem 0.5rem;font-size:0.6rem;"><i class="fas fa-stamp"></i> ${r.stamp || 'Verified'}</span></td>
            <td style="text-align:center;">
                <button class="btn btn-outline btn-sm" onclick="viewReceipt('${r.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteReceipt('${r.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function populateUnpaidInvoiceDropdown() {
    if (!isFullAccess()) return;
    const select = document.getElementById('receiptInvoiceSelect');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Select an unpaid invoice...</option>';
    const unpaid = invoicesData.filter(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');
    unpaid.forEach(inv => {
        const client = clientsData.find(c => c.id === inv.clientId);
        const clientName = client ? client.name : inv.clientName || 'Unknown';
        const opt = document.createElement('option');
        opt.value = inv.id;
        opt.textContent = `${clientName} - ${formatCurrency(inv.amount)} (${inv.date})`;
        select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
}

document.getElementById('generateReceiptBtn').addEventListener('click', function() {
    if (!isFullAccess()) { showToast('Read-only users cannot generate receipts.', 'warning'); return; }
    populateUnpaidInvoiceDropdown();
    document.getElementById('receiptDate').value = getToday();
    document.getElementById('receiptRef').value = '';
    document.getElementById('receiptNotes').value = '';
    openModal('generateReceiptModal');
});

document.getElementById('generateReceiptForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const invoiceId = document.getElementById('receiptInvoiceSelect').value;
    if (!invoiceId) { showToast('Please select an invoice.', 'warning'); return; }
    const invoice = invoicesData.find(inv => inv.id === invoiceId);
    if (!invoice) { showToast('Invoice not found.', 'error'); return; }
    const client = clientsData.find(c => c.id === invoice.clientId);
    const receiptNumber = generateReceiptNumber();
    const stamp = `Verified ${new Date().toISOString().slice(0,10)}`;
    const receiptData = {
        receiptNumber: receiptNumber, invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber || 'INV-' + invoice.id.slice(0, 6),
        clientId: invoice.clientId, clientName: client ? client.name : invoice.clientName || 'Unknown',
        amount: parseInt(invoice.amount) || 0,
        date: document.getElementById('receiptDate').value || getToday(),
        ref: document.getElementById('receiptRef').value.trim() || 'N/A',
        notes: document.getElementById('receiptNotes').value.trim() || '',
        stamp: stamp, createdAt: getToday()
    };
    const receiptId = await addReceiptToFirestore(receiptData);
    if (receiptId) {
        await updateInvoiceInFirestore(invoice.id, { status: 'Paid', paidDate: receiptData.date });
        closeModal('generateReceiptModal');
        showToast(`Receipt ${receiptNumber} generated!`, 'info');
        this.reset();
    } else showToast('Failed to generate receipt.', 'error');
});

async function markInvoicePaid(invoiceId) {
    if (!isFullAccess()) { showToast('Read-only users cannot modify invoices.', 'warning'); return; }
    if (!confirm('Mark this invoice as paid?')) return;
    const invoice = invoicesData.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    await updateInvoiceInFirestore(invoiceId, { status: 'Paid', paidDate: getToday() });
    showToast('Invoice marked as paid.', 'info');
}

function sendPaymentReminder(invoiceId) {
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const invoice = invoicesData.find(inv => inv.id === invoiceId);
    if (!invoice) { showToast('Invoice not found.', 'error'); return; }
    const client = clientsData.find(c => c.id === invoice.clientId);
    if (!client || !client.phone) { showToast('Client has no phone.', 'warning'); return; }
    const dueDate = new Date(invoice.date);
    dueDate.setDate(dueDate.getDate() + (parseInt(invoice.terms) || 30));
    const msg = `PAYMENT REMINDER: Invoice ${invoice.invoiceNumber || '#'} of ${formatCurrency(invoice.amount)} is due on ${dueDate.toISOString().slice(0,10)}. Please settle your account. - Kuria Karatu & Co. Advocates`;
    sendWhatsApp(client.phone, client.name, msg);
    logActivity('Sent Payment Reminder', `To ${client.name} for invoice ${invoice.invoiceNumber}`);
    showToast(`Reminder sent to ${client.name}`, 'info');
}

function viewReceipt(receiptId) {
    const receipt = receiptsData.find(r => r.id === receiptId);
    if (!receipt) { showToast('Receipt not found.', 'error'); return; }
    const invoice = invoicesData.find(inv => inv.id === receipt.invoiceId);
    const content = document.getElementById('printInvoiceContent');
    content.innerHTML = `
        <div class="invoice-header">
            <div style="display:flex;align-items:center;gap:1rem;">
                ${logoImgTag('height:70px;width:auto;object-fit:contain;')}
                <div>
                    <h2 style="margin:0;">ELECTRONIC RECEIPT</h2>
                    <div style="font-size:0.8rem;color:#475569;">Kuria Karatu &amp; Company Advocates</div>
                </div>
            </div>
            <div class="company-details">
                <strong>Kuria Karatu &amp; Company Advocates</strong><br>
                Ntugi House, 1st flr rm 10, Meru Town<br>
                Tel: 0725799752 / 0726780451
            </div>
        </div>
        <div style="text-align:center;margin-bottom:0.5rem;">
            <span class="digital-stamp" style="font-size:0.9rem;padding:0.5rem 1.5rem;"><i class="fas fa-stamp"></i> ${receipt.stamp || 'Verified'}</span>
        </div>
        <div class="invoice-meta">
            <div><strong>Receipt #:</strong> ${receipt.receiptNumber}</div>
            <div><strong>Date:</strong> ${receipt.date}</div>
            <div><strong>Client:</strong> ${receipt.clientName || 'Unknown'}</div>
            <div><strong>Invoice:</strong> ${receipt.invoiceNumber || '#'}</div>
            <div><strong>Reference:</strong> ${receipt.ref || 'N/A'}</div>
        </div>
        <table>
            <tr><th>Description</th><th>Amount (KES)</th></tr>
            <tr><td>${invoice?.description || 'Legal services'} ${receipt.notes ? `<br><span class="text-muted fs-small">${receipt.notes}</span>` : ''}</td><td>${Number(receipt.amount).toLocaleString()}</td></tr>
        </table>
        <div class="total-row">Total Paid: KES ${Number(receipt.amount).toLocaleString()}</div>
        <div class="footer">This is a computer-generated receipt. Payment confirmed on ${receipt.date}.</div>`;
    openModal('printInvoiceModal');
}

async function deleteReceipt(receiptId) {
    if (!isFullAccess()) { showToast('Read-only users cannot delete receipts.', 'warning'); return; }
    if (!confirm('Delete this receipt? This will not change the invoice status.')) return;
    await deleteReceiptFromFirestore(receiptId);
    showToast('Receipt deleted.', 'info');
}

function renderFees() {
    if (!isFullAccess()) return;
    const feesBody = document.getElementById('feesBody');
    const instBody = document.getElementById('installmentsBody');
    const paymentHistoryBody = document.getElementById('paymentHistoryBody');
    if (!feesBody || !instBody) return;
    let totalAll = 0, paidAll = 0, dueCount = 0;
    const today = getToday();
    const clientsWithFees = clientsData.filter(c => c.feeAgreement && (parseInt(c.feeAgreement.totalFees) || 0) > 0);
    clientsWithFees.forEach(c => { const s = getClientFeeBalance(c); totalAll += s.total; paidAll += s.paid; });
    const outstandingAll = Math.max(0, totalAll - paidAll);
    const paidPct = totalAll > 0 ? Math.round((paidAll / totalAll) * 100) : 0;
    setText('feeTotalAll', formatCurrency(totalAll));
    setText('feePaidAll', formatCurrency(paidAll));
    setText('feePaidPct', `${paidPct}% of total`);
    setText('feeOutstandingAll', formatCurrency(outstandingAll));
    setText('feeDueCount', dueCount);
    if (!clientsWithFees.length) { feesBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:1.5rem;">No fee agreements recorded.</td></tr>`; }
    else {
        feesBody.innerHTML = clientsWithFees.map(c => {
            const s = getClientFeeBalance(c);
            const nextDue = s.nextDue ? `${s.nextDue.date} <span class="badge ${s.nextDue.date < today ? 'red' : 'yellow'}">${formatCurrency(s.nextDue.amount)}</span>` : '<span class="text-muted">—</span>';
            const overdue = s.nextDue && s.nextDue.date < today;
            const payCount = (s.payments || []).length;
            return `<tr>
                <td><strong>${c.name}</strong> ${payCount > 0 ? `<span class="badge blue" title="${payCount} payment(s) recorded">${payCount} pmt${payCount > 1 ? 's' : ''}</span>` : ''}</td>
                <td>${formatCurrency(s.total)}</td>
                <td>${formatCurrency(s.paid)}</td>
                <td><span class="badge ${s.balance > 0 ? 'red' : 'green'}">${formatCurrency(s.balance)}</span></td>
                <td style="min-width:120px;"><div class="fee-progress"><div class="fee-progress-bar" style="width:${s.pct}%;"></div></div><span class="text-muted fs-small">${s.pct}%</span></td>
                <td>${nextDue} ${overdue ? '<span class="badge red">Overdue</span>' : ''}</td>
                <td>
                    ${c.phone ? `<button class="btn btn-whatsapp btn-whatsapp-sm" onclick="sendWhatsApp('${c.phone}','${c.name}',null)" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>` : ''}
                    ${c.email ? `<a class="btn btn-outline btn-sm" href="mailto:${c.email}" title="Email"><i class="fas fa-envelope"></i></a>` : ''}
                </td>
                <td style="text-align:center;white-space:nowrap;">
                    <button class="btn btn-teal btn-sm" onclick="openRecordPaymentModal('${c.id}')" title="Record Payment"><i class="fas fa-money-bill-wave"></i> Pay</button>
                    <button class="btn btn-warning btn-sm" onclick="openAddChargeModal('${c.id}')" title="Add Charge / Invoice Line"><i class="fas fa-plus"></i> Charge</button>
                    <button class="btn btn-outline btn-sm" onclick="showClientDetail('${c.id}')" title="View client"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-primary btn-sm" onclick="editClient('${c.id}')" title="Edit fee agreement"><i class="fas fa-edit"></i></button>
                </td>
            </tr>`;
        }).join('');
    }
    const allInst = [];
    clientsWithFees.forEach(c => { (c.feeAgreement.installments || []).forEach((inst, idx) => { allInst.push({ client: c, inst: inst, idx: idx }); }); });
    allInst.sort((a, b) => (a.inst.date || '').localeCompare(b.inst.date || ''));
    if (!allInst.length) { instBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:1.5rem;">No installments scheduled.</td></tr>`; }
    else {
        instBody.innerHTML = allInst.map(row => {
            const c = row.client;
            const inst = row.inst;
            const isOverdue = !inst.paid && inst.date && inst.date < today;
            const isDueToday = !inst.paid && inst.date === today;
            let statusBadge = '<span class="badge green">Paid</span>';
            if (!inst.paid) {
                if (isOverdue) statusBadge = '<span class="badge red">Overdue</span>';
                else if (isDueToday) statusBadge = '<span class="badge yellow">Due Today</span>';
                else statusBadge = '<span class="badge gray">Scheduled</span>';
            }
            return `<tr>
                <td><strong>${c.name}</strong></td>
                <td>Installment ${row.idx + 1} of ${(c.feeAgreement.installments || []).length}</td>
                <td>${inst.date || '—'}</td>
                <td>${formatCurrency(inst.amount)}</td>
                <td>${statusBadge} ${inst.paidDate ? `<span class="text-muted fs-small">(${inst.paidDate})</span>` : ''}</td>
                <td style="text-align:center;white-space:nowrap;">
                    <button class="btn btn-teal btn-sm" onclick="openRecordPaymentModal('${c.id}')" title="Record Payment"><i class="fas fa-money-bill-wave"></i> Pay</button>
                    ${!inst.paid ? `<button class="btn btn-success btn-sm" onclick="markInstallmentPaid('${c.id}', ${row.idx})" title="Mark Paid"><i class="fas fa-check"></i></button>` : ''}
                    ${!inst.paid ? `<button class="btn btn-whatsapp btn-whatsapp-sm" onclick="sendFeeReminderWhatsApp('${c.id}', ${row.idx})" title="WhatsApp reminder"><i class="fab fa-whatsapp"></i></button>` : ''}
                    ${!inst.paid ? `<button class="btn btn-sm" style="background:#ea4335;color:#fff;" onclick="sendFeeReminderEmail('${c.id}', ${row.idx})" title="Email reminder"><i class="fas fa-envelope"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('');
    }
    if (paymentHistoryBody) {
        const allPayments = getAllPayments();
        const badge = document.getElementById('paymentHistoryBadge');
        if (badge) badge.textContent = `${allPayments.length} payment${allPayments.length !== 1 ? 's' : ''}`;
        if (!allPayments.length) { paymentHistoryBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:1.5rem;">No payments recorded yet.</td></tr>`; }
        else {
            paymentHistoryBody.innerHTML = allPayments.map(p => `<tr>
                <td>${p.date}</td>
                <td><strong>${p.clientName}</strong></td>
                <td><span class="badge green">${formatCurrency(p.amount)}</span></td>
                <td><span class="badge blue">${p.method || 'N/A'}</span></td>
                <td>${p.reference || '—'}</td>
                <td><span class="text-muted fs-small">${p.notes || '—'}</span></td>
                <td><span class="text-muted fs-small">${p.recordedBy || 'System'}</span></td>
                <td style="text-align:center;white-space:nowrap;">
                    <button class="btn btn-outline btn-sm" onclick="showClientDetail('${p.clientId}')" title="View client"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deletePayment('${p.clientId}','${p.id}')" title="Delete payment"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
        }
    }
}

document.getElementById('sendAllDueRemindersBtn').addEventListener('click', function() {
    if (!isFullAccess()) { showToast('Read-only users cannot send reminders.', 'warning'); return; }
    sendAllDueFeeReminders();
});

function updateAccidentSummary() {
    const el1 = document.getElementById('accTotalClients');
    if (!el1) return;
    let totalAdvances = 0, totalSettled = 0, totalRecoverable = 0;
    accidentClientsData.forEach(c => {
        const t = getAccidentClientTotals(c);
        totalAdvances += t.advancesTotal;
        totalSettled += t.settlementAmount;
        if (t.settlementAmount > 0) totalRecoverable += Math.max(0, t.advancesTotal - t.netToClient);
        else totalRecoverable += t.advancesTotal;
    });
    document.getElementById('accTotalClients').textContent = accidentClientsData.length;
    document.getElementById('accTotalAdvances').textContent = formatCurrency(totalAdvances);
    document.getElementById('accTotalSettled').textContent = formatCurrency(totalSettled);
    document.getElementById('accTotalRecoverable').textContent = formatCurrency(totalRecoverable);
}

function renderAccidentClients() {
    updateAccidentSummary();
    const tbody = document.getElementById('accClientsBody');
    const countLabel = document.getElementById('accCountLabel');
    if (!tbody) return;
    const term = (document.getElementById('globalSearchInput')?.value || '').trim().toLowerCase();
    let filtered = accidentClientsData;
    if (term) {
        filtered = filtered.filter(c =>
            (c.name && c.name.toLowerCase().includes(term)) ||
            (c.claimNumber && c.claimNumber.toLowerCase().includes(term)) ||
            (c.insurer && c.insurer.toLowerCase().includes(term)) ||
            (c.phone && c.phone.toLowerCase().includes(term)) ||
            (c.email && c.email.toLowerCase().includes(term))
        );
    }
    if (countLabel) countLabel.textContent = `${filtered.length} client${filtered.length !== 1 ? 's' : ''}`;
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:1.5rem;">${term ? 'No accident clients match your search.' : 'No accident clients on record yet.'}</td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map(c => {
        const t = getAccidentClientTotals(c);
        const statusClass = (c.claimStatus || 'Ongoing').toLowerCase();
        const balanceDisplay = t.settlementAmount > 0
            ? `<span class="badge ${t.balance >= 0 ? 'green' : 'red'}">${formatCurrency(t.balance)}</span>`
            : `<span class="badge yellow">Pending Settlement</span>`;
        const roomBadge = t.firmFee > 0 ? `<br><span class="text-muted fs-small">Room: ${formatCurrency(t.advanceRoom)}</span>` : '';
        return `<tr class="clickable-row" data-accid="${c.id}">
            <td><strong>${c.name}</strong>${c.phone ? `<br><span class="text-muted fs-small">${c.phone}</span>` : ''}</td>
            <td>${c.claimNumber || '—'}</td>
            <td>${c.insurer || '—'}</td>
            <td><span class="acc-claim-badge ${statusClass}">${c.claimStatus || 'Ongoing'}</span></td>
            <td><span class="badge blue">${formatCurrency(t.advancesTotal)}</span> <span class="text-muted fs-small">(${t.advanceCount})</span>${roomBadge}</td>
            <td>${t.estimatedSettlement > 0 ? formatCurrency(t.estimatedSettlement) : '—'}</td>
            <td>${t.netToClient > 0 ? formatCurrency(t.netToClient) : '—'}</td>
            <td>${balanceDisplay}</td>
            <td style="text-align:center;white-space:nowrap;">
                <button class="btn btn-teal btn-sm acc-advance-btn" data-accid="${c.id}" title="Record Advance"><i class="fas fa-money-bill-transfer"></i> Advance</button>
                <button class="btn btn-outline btn-sm acc-view-btn" data-accid="${c.id}" title="View Details"><i class="fas fa-eye"></i></button>
                <button class="btn btn-primary btn-sm acc-statement-btn" data-accid="${c.id}" title="View Statement"><i class="fas fa-file-invoice-dollar"></i></button>
                ${isFullAccess() ? `<button class="btn btn-warning btn-sm acc-edit-btn" data-accid="${c.id}" title="Edit"><i class="fas fa-edit"></i></button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-danger btn-sm acc-delete-btn" data-accid="${c.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('.clickable-row').forEach(r => {
        r.addEventListener('click', function(e) { if (e.target.closest('button')) return; showAccidentClientDetail(this.dataset.accid); });
    });
    tbody.querySelectorAll('.acc-view-btn').forEach(b => b.addEventListener('click', function(e) { e.stopPropagation(); showAccidentClientDetail(this.dataset.accid); }));
    tbody.querySelectorAll('.acc-advance-btn').forEach(b => b.addEventListener('click', function(e) { e.stopPropagation(); openAddAdvanceModal(this.dataset.accid); }));
    tbody.querySelectorAll('.acc-statement-btn').forEach(b => b.addEventListener('click', function(e) { e.stopPropagation(); openStatementModal(this.dataset.accid); }));
    tbody.querySelectorAll('.acc-edit-btn').forEach(b => b.addEventListener('click', function(e) { e.stopPropagation(); editAccidentClient(this.dataset.accid); }));
    tbody.querySelectorAll('.acc-delete-btn').forEach(b => b.addEventListener('click', function(e) { e.stopPropagation(); deleteAccidentClient(this.dataset.accid); }));
}

function showAccidentClientDetail(accId) {
    selectedAccClientId = accId;
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) return;
    document.getElementById('accListView').style.display = 'none';
    document.getElementById('accDetailView').style.display = 'block';
    const container = document.getElementById('accDetailContainer');
    const t = getAccidentClientTotals(c);
    const statusClass = (c.claimStatus || 'Ongoing').toLowerCase();
    const advancesHtml = c.advances.length ? c.advances.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(a => `
        <tr>
            <td>${a.date || '—'}</td>
            <td><strong>${formatCurrency(a.amount)}</strong></td>
            <td><span class="badge blue">${a.purpose || '—'}</span></td>
            <td>${a.receivedBy || '—'}</td>
            <td>${a.witness || '—'}</td>
            <td><span class="badge" style="background:#dcfce7;color:#166534;">${a.method || 'M-PESA'}</span></td>
            <td>${a.reference || '—'}</td>
            <td style="text-align:center;white-space:nowrap;">
                ${isFullAccess() ? `<button class="btn btn-warning btn-sm" onclick="editAdvance('${c.id}','${a.advanceId}')" title="Edit"><i class="fas fa-edit"></i></button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-danger btn-sm" onclick="deleteAdvance('${c.id}','${a.advanceId}')" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:1rem;">No advances recorded yet.</td></tr>`;
    const balanceText = t.settlementAmount === 0 ? 'Awaiting Settlement' : formatCurrency(t.balance);
    const balanceColor = t.settlementAmount === 0 ? '#64748b' : (t.balance >= 0 ? '#22c55e' : '#ef4444');
    const balanceSub = t.settlementAmount === 0 ? 'Advances recoverable: ' + formatCurrency(t.advancesTotal) : (t.balance >= 0 ? 'Payable to client on finalization' : 'Advance exceeds net settlement');
    container.innerHTML = `
        <div class="case-detail-header">
            <div>
                <div class="case-title">${c.name} <span class="acc-claim-badge ${statusClass}">${c.claimStatus || 'Ongoing'}</span></div>
                <div class="case-meta">
                    <span><i class="fas fa-hashtag"></i> Claim: ${c.claimNumber || '—'}</span>
                    <span><i class="fas fa-building"></i> Insurer: ${c.insurer || '—'}</span>
                    <span><i class="fas fa-id-card"></i> Policy: ${c.policyNumber || '—'}</span>
                    <span><i class="fas fa-user-tie"></i> Advocate: ${c.advocate || '—'}</span>
                    <span><i class="fas fa-phone"></i> ${c.phone || 'No phone'}</span>
                    <span><i class="fas fa-envelope"></i> ${c.email || 'No email'}</span>
                </div>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                <button class="btn btn-teal btn-sm" onclick="openAddAdvanceModal('${c.id}')"><i class="fas fa-money-bill-transfer"></i> Record Advance</button>
                <button class="btn btn-outline btn-sm" onclick="openStatementModal('${c.id}')"><i class="fas fa-file-invoice-dollar"></i> Statement</button>
                <button class="btn btn-success btn-sm" onclick="printAccidentClientReport('${c.id}')"><i class="fas fa-print"></i> Print Report</button>
                ${isFullAccess() ? `<button class="btn btn-primary btn-sm" onclick="editAccidentClient('${c.id}')"><i class="fas fa-edit"></i> Edit</button>` : ''}
                ${c.phone ? `<button class="btn btn-whatsapp btn-sm" onclick="sendWhatsApp('${c.phone}','${c.name}',null)"><i class="fab fa-whatsapp"></i></button>` : ''}
            </div>
        </div>
        <div class="case-detail-body">
            <div class="acc-summary-grid">
                <div class="acc-summary-card"><div class="as-label">Estimated Settlement</div><div class="as-value">${t.estimatedSettlement > 0 ? formatCurrency(t.estimatedSettlement) : '—'}</div></div>
                <div class="acc-summary-card"><div class="as-label">Actual Settlement</div><div class="as-value">${t.settlementAmount > 0 ? formatCurrency(t.settlementAmount) : 'Pending'}</div></div>
                <div class="acc-summary-card"><div class="as-label">Firm Fee</div><div class="as-value">${t.firmFee > 0 ? formatCurrency(t.firmFee) : '—'}</div><div class="as-sub">Max 50% advance: ${formatCurrency(t.maxAdvance)}</div></div>
                <div class="acc-summary-card"><div class="as-label">Net to Client</div><div class="as-value">${t.netToClient > 0 ? formatCurrency(t.netToClient) : 'Pending'}</div></div>
                <div class="acc-summary-card"><div class="as-label">Total Advances Paid</div><div class="as-value" style="color:#f59e0b;">${formatCurrency(t.advancesTotal)}</div><div class="as-sub">${t.advanceCount} disbursement${t.advanceCount !== 1 ? 's' : ''} · Room: ${formatCurrency(t.advanceRoom)}</div></div>
                <div class="acc-summary-card"><div class="as-label">Balance on Finalization</div><div class="as-value" style="color:${balanceColor};">${balanceText}</div><div class="as-sub">${balanceSub}</div></div>
            </div>
            <div style="padding:0;">
                <h4 style="margin-bottom:0.75rem;"><i class="fas fa-circle-info"></i> Claim Details</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.85rem;">
                    <div><strong>ID Number:</strong> ${c.idNumber || '—'}</div>
                    <div><strong>Address:</strong> ${c.address || '—'}</div>
                    <div><strong>Accident Date:</strong> ${c.accidentDate || '—'}</div>
                    <div><strong>Accident Location:</strong> ${c.accidentLocation || '—'}</div>
                    <div><strong>Date of Settlement:</strong> ${c.dateOfSettlement || '—'}</div>
                    <div><strong>Created:</strong> ${c.createdAt || '—'}</div>
                </div>
                ${c.notes ? `<div style="margin-top:0.75rem;padding:0.75rem;background:#fef9c3;border-radius:0.5rem;border:1px solid #fef08a;"><strong>Notes:</strong> ${c.notes}</div>` : ''}
            </div>
            <div class="table-wrap" style="margin-top:1.5rem;">
                <div class="flex-between mb-1">
                    <h4 style="margin:0;"><i class="fas fa-hand-holding-dollar"></i> Advances Handed to Client (${t.advanceCount})</h4>
                    <button class="btn btn-teal btn-sm" onclick="openAddAdvanceModal('${c.id}')"><i class="fas fa-plus"></i> Record Advance</button>
                </div>
                <div style="overflow-x:auto;">
                    <table class="acc-advance-table">
                        <thead><tr><th>Date</th><th>Amount</th><th>Purpose</th><th>Received By</th><th>Witness</th><th>Method</th><th>M-PESA Ref</th><th style="text-align:center;">Actions</th></tr></thead>
                        <tbody>${advancesHtml}</tbody>
                        ${t.advancesTotal > 0 ? `<tfoot><tr style="background:#f1f5f9;font-weight:700;"><td>TOTAL</td><td colspan="7">${formatCurrency(t.advancesTotal)}</td></tr></tfoot>` : ''}
                    </table>
                </div>
            </div>
        </div>`;
}

function buildAccidentStatementHTML(c) {
    const t = getAccidentClientTotals(c);
    const sorted = c.advances.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    let rows = sorted.map((a, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${a.date || '—'}</td>
            <td>${a.purpose || '—'}</td>
            <td>${a.receivedBy || '—'}</td>
            <td>${a.witness || '—'}</td>
            <td>${a.method || 'M-PESA'}${a.reference ? '<br><span class="text-muted fs-small">' + a.reference + '</span>' : ''}</td>
            <td style="text-align:right;">${formatCurrency(a.amount)}</td>
        </tr>`).join('');
    if (!sorted.length) rows = `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:1rem;">No advances recorded.</td></tr>`;
    const settlementLine = t.settlementAmount > 0
        ? `<div class="acc-statement-line"><span>Settlement Amount</span><span>${formatCurrency(t.settlementAmount)}</span></div>
           <div class="acc-statement-line"><span>Less: Firm Fee</span><span>(${formatCurrency(t.firmFee)})</span></div>
           <div class="acc-statement-line total"><span>Net Payable to Client</span><span>${formatCurrency(t.netToClient)}</span></div>
           <div class="acc-statement-line"><span>Less: Total Advances Paid</span><span>(${formatCurrency(t.advancesTotal)})</span></div>
           <div class="acc-statement-line total balance ${t.balance >= 0 ? 'clear' : ''}"><span>${t.balance >= 0 ? 'Balance Payable to Client' : 'Advance Exceeds Net (Recoverable from Client)'}</span><span>${formatCurrency(Math.abs(t.balance))}</span></div>`
        : `<div class="acc-statement-line"><span>Estimated Settlement</span><span>${formatCurrency(t.estimatedSettlement)}</span></div>
           <div class="acc-statement-line"><span>Actual Settlement</span><span>Pending finalization</span></div>
           <div class="acc-statement-line total"><span>Total Advances Paid to Date</span><span>${formatCurrency(t.advancesTotal)}</span></div>
           <div class="acc-statement-line balance"><span>Recoverable from Final Settlement</span><span>${formatCurrency(t.advancesTotal)}</span></div>`;
    return `
        <div class="invoice-header">
            <div style="display:flex;align-items:center;gap:1rem;">
                ${logoImgTag('height:70px;width:auto;object-fit:contain;')}
                <div><h2 style="margin:0;">STATEMENT OF ADVANCES</h2><div style="font-size:0.8rem;color:#475569;">Accident Claim Client Statement</div></div>
            </div>
            <div class="company-details"><strong>Kuria Karatu &amp; Company Advocates</strong><br>Ntugi House, 1st flr rm 10, Meru Town<br>Tel: 0725799752 / 0726780451</div>
        </div>
        <div class="invoice-meta">
            <div><strong>Client:</strong> ${c.name}</div>
            <div><strong>Claim No:</strong> ${c.claimNumber || '—'}</div>
            <div><strong>Insurer:</strong> ${c.insurer || '—'}</div>
            <div><strong>Policy No:</strong> ${c.policyNumber || '—'}</div>
            <div><strong>Advocate:</strong> ${c.advocate || '—'}</div>
            <div><strong>Status:</strong> ${c.claimStatus || 'Ongoing'}</div>
            <div><strong>Date Generated:</strong> ${getToday()}</div>
        </div>
        <h4 style="margin-top:1rem;">Advances Handed Over to Client</h4>
        <table>
            <thead><tr><th>#</th><th>Date</th><th>Purpose</th><th>Received By</th><th>Witness</th><th>Method / Ref</th><th style="text-align:right;">Amount (KES)</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="background:#f1f5f9;font-weight:700;"><td colspan="6" style="text-align:right;">TOTAL ADVANCES</td><td style="text-align:right;">${formatCurrency(t.advancesTotal)}</td></tr></tfoot>
        </table>
        <div class="acc-statement-box"><h4 style="margin-bottom:0.5rem;"><i class="fas fa-calculator"></i> Summary</h4>${settlementLine}</div>
        <div style="margin-top:1rem;font-size:0.85rem;">
            <strong>Claim Progress:</strong> ${c.claimStatus || 'Ongoing'}${c.dateOfSettlement ? ' (settled on ' + c.dateOfSettlement + ')' : ''}<br>
            ${c.accidentDate ? '<strong>Accident Date:</strong> ' + c.accidentDate + '<br>' : ''}
            ${c.accidentLocation ? '<strong>Accident Location:</strong> ' + c.accidentLocation + '<br>' : ''}
            ${c.notes ? '<strong>Notes:</strong> ' + c.notes : ''}
        </div>
        <div style="margin-top:2rem;display:flex;justify-content:space-between;font-size:0.85rem;flex-wrap:wrap;gap:1rem;">
            <div><div style="border-top:1px solid #0f172a;width:200px;margin-top:2rem;"></div><div>Client Signature / Thumbprint</div></div>
            <div><div style="border-top:1px solid #0f172a;width:200px;margin-top:2rem;"></div><div>Firm Representative</div></div>
        </div>
        <div class="footer">This is a computer-generated statement of advances. Kindly retain a copy for your records.<br>Kuria Karatu &amp; Company Advocates — Ntugi House, 1st flr rm 10, Meru Town</div>`;
}

function openStatementModal(accId) {
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) { showToast('Client not found.', 'error'); return; }
    selectedAccClientId = accId;
    const content = document.getElementById('accStatementContent');
    content.innerHTML = buildAccidentStatementHTML(c);
    openModal('viewAccStatementModal');
}

function printAccStatementModal() {
    const c = accidentClientsData.find(x => x.id === selectedAccClientId);
    if (!c) { showToast('Client not found.', 'error'); return; }
    printAccStatement(c);
}

function printAccStatement(c) {
    const innerHtml = buildAccidentStatementHTML(c);
    const win = window.open('', '_blank');
    if (!win) { showToast('Please allow popups to print.', 'warning'); return; }
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Statement of Advances - ' + c.name + '</title><style>body{font-family:Segoe UI,Roboto,sans-serif;padding:2rem;color:#1e293b;background:#fff;}.invoice-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:.5rem;margin-bottom:1rem;gap:1rem;flex-wrap:wrap;}.invoice-header h2{font-size:1.5rem;font-weight:700;color:#0f172a;margin:0;}.invoice-header .company-details{text-align:right;font-size:.85rem;color:#475569;}.invoice-logo{height:70px;width:auto;max-width:140px;object-fit:contain;}.invoice-meta{display:flex;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:.5rem;}.invoice-meta div{font-size:.9rem;}table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.85rem;}table th{background:#f1f5f9;padding:.5rem;text-align:left;border-bottom:1px solid #d1d9e6;}table td{padding:.5rem;border-bottom:1px solid #e9edf2;}.acc-statement-box{background:#f8fafc;border:1px solid #e9edf2;border-radius:.5rem;padding:1rem;margin:.75rem 0;}.acc-statement-line{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px dashed #e9edf2;font-size:.85rem;}.acc-statement-line.total{font-weight:700;font-size:1rem;border-top:2px solid #0f172a;border-bottom:none;padding-top:.6rem;margin-top:.3rem;}.acc-statement-line.balance{font-weight:700;color:#ef4444;}.acc-statement-line.balance.clear{color:#22c55e;}.footer{margin-top:2rem;text-align:center;color:#64748b;font-size:.75rem;border-top:1px solid #e9edf2;padding-top:1rem;}</style></head><body>' + innerHtml + '<script>setTimeout(function(){window.print();},400);<\/script></body></html>');
    win.document.close();
}

function printAccidentClientReport(accId) {
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) { showToast('Client not found.', 'error'); return; }
    const t = getAccidentClientTotals(c);
    const sorted = c.advances.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const advanceRows = sorted.length ? sorted.map((a, i) => `
        <tr><td>${i + 1}</td><td>${a.date || '—'}</td><td>${a.purpose || '—'}</td>
        <td>${a.receivedBy || '—'}</td><td>${a.witness || '—'}</td>
        <td>${a.method || 'M-PESA'}${a.reference ? '<br><small style="color:#64748b;">' + a.reference + '</small>' : ''}</td>
        <td style="text-align:right;">${formatCurrency(a.amount)}</td></tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;">No advances</td></tr>`;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Accident Claim Report — ${c.name}</title><style>
        body{font-family:'Segoe UI',sans-serif;padding:2rem;color:#1e293b;max-width:1000px;margin:auto;}
        h1{color:#0f172a;border-bottom:3px solid #3b82f6;padding-bottom:.5rem;}
        h2{color:#0f172a;margin-top:2rem;font-size:1.1rem;border-bottom:1px solid #e2e8f0;padding-bottom:.3rem;}
        .header{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;background:#f8fafc;padding:1rem;border-radius:.5rem;border:1px solid #e2e8f0;margin:1rem 0;}
        .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1rem 0;}
        .card{background:#f8fafc;padding:1rem;border-radius:.5rem;border:1px solid #e2e8f0;}
        .card .l{font-size:.7rem;text-transform:uppercase;color:#64748b;font-weight:600;}
        .card .v{font-size:1.3rem;font-weight:700;margin-top:.2rem;}
        table{width:100%;border-collapse:collapse;margin:.75rem 0;font-size:.85rem;}
        th{background:#f1f5f9;text-align:left;padding:.5rem;font-size:.72rem;text-transform:uppercase;color:#475569;}
        td{padding:.5rem;border-bottom:1px solid #f1f5f9;}
        .footer{margin-top:2rem;text-align:center;color:#64748b;font-size:.75rem;border-top:1px solid #e2e8f0;padding-top:1rem;}
        .badge{display:inline-block;padding:.15rem .6rem;border-radius:20px;font-size:.7rem;font-weight:600;background:#dbeafe;color:#1e40af;}
    </style></head><body>
    <h1>⚖ Kuria Karatu &amp; Company Advocates — Accident Claim Report</h1>
    <p style="color:#64748b;">Generated ${new Date().toLocaleString()} by ${currentUserEmail}</p>
    <div class="header">
        <div>
            <div style="font-size:1.3rem;font-weight:700;">${c.name}</div>
            <div style="font-size:.85rem;color:#475569;">Claim No: <strong>${c.claimNumber || '—'}</strong> · <span class="badge">${c.claimStatus || 'Ongoing'}</span></div>
            <div style="font-size:.85rem;color:#475569;">Phone: ${c.phone || '—'} · Email: ${c.email || '—'}</div>
            <div style="font-size:.85rem;color:#475569;">ID No: ${c.idNumber || '—'} · Address: ${c.address || '—'}</div>
        </div>
        <div style="text-align:right;font-size:.8rem;color:#475569;">
            <strong>Ntugi House, 1st flr rm 10, Meru Town</strong><br>Tel: 0725799752 / 0726780451
        </div>
    </div>
    <div class="summary">
        <div class="card"><div class="l">Estimated Settlement</div><div class="v">${t.estimatedSettlement > 0 ? formatCurrency(t.estimatedSettlement) : '—'}</div></div>
        <div class="card"><div class="l">Actual Settlement</div><div class="v">${t.settlementAmount > 0 ? formatCurrency(t.settlementAmount) : 'Pending'}</div></div>
        <div class="card"><div class="l">Firm Fee</div><div class="v">${t.firmFee > 0 ? formatCurrency(t.firmFee) : '—'}</div></div>
        <div class="card"><div class="l">Net to Client</div><div class="v">${t.netToClient > 0 ? formatCurrency(t.netToClient) : '—'}</div></div>
        <div class="card"><div class="l">Total Advances Paid</div><div class="v" style="color:#f59e0b;">${formatCurrency(t.advancesTotal)}</div></div>
        <div class="card"><div class="l">Balance on Finalization</div><div class="v" style="color:${t.balance >= 0 ? '#22c55e' : '#ef4444'};">${t.settlementAmount > 0 ? formatCurrency(t.balance) : 'Pending'}</div></div>
    </div>
    <h2>Claim Details</h2>
    <table>
        <tr><th>Field</th><th>Value</th></tr>
        <tr><td>Insurer</td><td>${c.insurer || '—'}</td></tr>
        <tr><td>Policy Number</td><td>${c.policyNumber || '—'}</td></tr>
        <tr><td>Accident Date</td><td>${c.accidentDate || '—'}</td></tr>
        <tr><td>Accident Location</td><td>${c.accidentLocation || '—'}</td></tr>
        <tr><td>Advocate Handling</td><td>${c.advocate || '—'}</td></tr>
        <tr><td>Claim Status</td><td>${c.claimStatus || 'Ongoing'}</td></tr>
        <tr><td>Date of Settlement</td><td>${c.dateOfSettlement || '—'}</td></tr>
        <tr><td>Created</td><td>${c.createdAt || '—'}</td></tr>
        <tr><td>Notes</td><td>${c.notes || '—'}</td></tr>
    </table>
    <h2>Advances Handed to Client (${t.advanceCount})</h2>
    <table>
        <thead><tr><th>#</th><th>Date</th><th>Purpose</th><th>Received By</th><th>Witness</th><th>Method / Ref</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${advanceRows}</tbody>
        <tfoot><tr style="background:#f1f5f9;font-weight:700;"><td colspan="6" style="text-align:right;">TOTAL ADVANCES</td><td style="text-align:right;">${formatCurrency(t.advancesTotal)}</td></tr></tfoot>
    </table>
    <div class="footer">This is a computer-generated accident claim report.<br>Kuria Karatu &amp; Company Advocates — Ntugi House, 1st flr rm 10, Meru Town</div>
    <script>setTimeout(()=>window.print(),400);<\/script>
    </body></html>`);
    win.document.close();
}

function openAddAccidentClientModal() {
    if (!isFullAccess()) { showToast('Read-only users cannot add accident clients.', 'warning'); return; }
    const form = document.getElementById('addAccidentClientForm');
    if (form) form.reset();
    const statusSel = document.getElementById('accClaimStatus');
    if (statusSel) statusSel.value = 'Ongoing';
    openModal('addAccidentClientModal');
}

document.getElementById('addAccidentClientBtn').addEventListener('click', openAddAccidentClientModal);

document.getElementById('addAccidentClientForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const data = {
        name: document.getElementById('accName').value.trim(),
        phone: document.getElementById('accPhone').value.trim(),
        email: document.getElementById('accEmail').value.trim(),
        idNumber: document.getElementById('accIdNumber').value.trim(),
        address: document.getElementById('accAddress').value.trim(),
        claimNumber: document.getElementById('accClaimNumber').value.trim(),
        insurer: document.getElementById('accInsurer').value.trim(),
        policyNumber: document.getElementById('accPolicyNumber').value.trim(),
        accidentDate: document.getElementById('accAccidentDate').value || '',
        accidentLocation: document.getElementById('accAccidentLocation').value.trim(),
        advocate: document.getElementById('accAdvocate').value.trim(),
        claimStatus: document.getElementById('accClaimStatus').value,
        estimatedSettlement: parseInt(document.getElementById('accEstimatedSettlement').value) || 0,
        dateOfSettlement: document.getElementById('accDateOfSettlement').value || '',
        settlementAmount: parseInt(document.getElementById('accSettlementAmount').value) || 0,
        firmFee: parseInt(document.getElementById('accFirmFee').value) || 0,
        netToClient: 0,
        notes: document.getElementById('accNotes').value.trim(),
        advances: [],
        createdAt: getToday()
    };
    if (!data.name || !data.claimNumber) { showToast('Name and Claim Number are required.', 'warning'); return; }
    data.netToClient = data.settlementAmount > 0 ? (data.settlementAmount - data.firmFee) : 0;
    const id = await addAccidentClientToFirestore(data);
    if (id) { closeModal('addAccidentClientModal'); this.reset(); showToast('Accident client added.', 'info'); }
    else showToast('Failed to add accident client.', 'error');
});

function editAccidentClient(accId) {
    if (!isFullAccess()) { showToast('Read-only users cannot edit.', 'warning'); return; }
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) { showToast('Client not found.', 'error'); return; }
    document.getElementById('editAccId').value = c.id;
    document.getElementById('editAccName').value = c.name || '';
    document.getElementById('editAccPhone').value = c.phone || '';
    document.getElementById('editAccEmail').value = c.email || '';
    document.getElementById('editAccIdNumber').value = c.idNumber || '';
    document.getElementById('editAccAddress').value = c.address || '';
    document.getElementById('editAccClaimNumber').value = c.claimNumber || '';
    document.getElementById('editAccInsurer').value = c.insurer || '';
    document.getElementById('editAccPolicyNumber').value = c.policyNumber || '';
    document.getElementById('editAccAccidentDate').value = c.accidentDate || '';
    document.getElementById('editAccAccidentLocation').value = c.accidentLocation || '';
    document.getElementById('editAccAdvocate').value = c.advocate || '';
    document.getElementById('editAccClaimStatus').value = c.claimStatus || 'Ongoing';
    document.getElementById('editAccEstimatedSettlement').value = c.estimatedSettlement || '';
    document.getElementById('editAccDateOfSettlement').value = c.dateOfSettlement || '';
    document.getElementById('editAccSettlementAmount').value = c.settlementAmount || '';
    document.getElementById('editAccFirmFee').value = c.firmFee || '';
    document.getElementById('editAccNotes').value = c.notes || '';
    openModal('editAccidentClientModal');
}

document.getElementById('editAccidentClientForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const id = document.getElementById('editAccId').value;
    const settlementAmount = parseInt(document.getElementById('editAccSettlementAmount').value) || 0;
    const firmFee = parseInt(document.getElementById('editAccFirmFee').value) || 0;
    const updates = {
        name: document.getElementById('editAccName').value.trim(),
        phone: document.getElementById('editAccPhone').value.trim(),
        email: document.getElementById('editAccEmail').value.trim(),
        idNumber: document.getElementById('editAccIdNumber').value.trim(),
        address: document.getElementById('editAccAddress').value.trim(),
        claimNumber: document.getElementById('editAccClaimNumber').value.trim(),
        insurer: document.getElementById('editAccInsurer').value.trim(),
        policyNumber: document.getElementById('editAccPolicyNumber').value.trim(),
        accidentDate: document.getElementById('editAccAccidentDate').value || '',
        accidentLocation: document.getElementById('editAccAccidentLocation').value.trim(),
        advocate: document.getElementById('editAccAdvocate').value.trim(),
        claimStatus: document.getElementById('editAccClaimStatus').value,
        estimatedSettlement: parseInt(document.getElementById('editAccEstimatedSettlement').value) || 0,
        dateOfSettlement: document.getElementById('editAccDateOfSettlement').value || '',
        settlementAmount: settlementAmount,
        firmFee: firmFee,
        netToClient: settlementAmount > 0 ? (settlementAmount - firmFee) : 0,
        notes: document.getElementById('editAccNotes').value.trim()
    };
    const ok = await updateAccidentClientInFirestore(id, updates);
    if (ok) { closeModal('editAccidentClientModal'); showToast('Accident client updated.', 'info'); }
    else showToast('Failed to update.', 'error');
});

async function deleteAccidentClient(accId) {
    if (!isFullAccess()) { showToast('Read-only users cannot delete.', 'warning'); return; }
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) return;
    if (!confirm(`Delete accident client "${c.name}" and all their advance records? This cannot be undone.`)) return;
    const ok = await deleteAccidentClientFromFirestore(accId);
    if (ok) {
        showToast('Accident client deleted.', 'info');
        if (selectedAccClientId === accId) {
            selectedAccClientId = null;
            document.getElementById('accDetailView').style.display = 'none';
            document.getElementById('accListView').style.display = 'block';
            renderAccidentClients();
        }
    } else showToast('Failed to delete.', 'error');
}

function openAddAdvanceModal(accId) {
    if (!isFullAccess()) { showToast('Read-only users cannot record advances.', 'warning'); return; }
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) { showToast('Client not found.', 'error'); return; }
    const t = getAccidentClientTotals(c);
    if (t.firmFee <= 0) { showToast('Set a Firm Fee for this claim first — the 50% advance cap requires it.', 'warning', 7000); }
    document.getElementById('advanceClientId').value = c.id;
    document.getElementById('advanceClientName').value = c.name + ' — ' + (c.claimNumber || '');
    document.getElementById('advanceAmount').value = '';
    document.getElementById('advanceDate').value = getToday();
    document.getElementById('advancePurpose').value = 'Medical Expenses';
    document.getElementById('advanceReceivedBy').value = c.name || '';
    document.getElementById('advanceWitness').value = currentUserEmail || '';
    document.getElementById('advanceMethod').value = 'M-PESA';
    document.getElementById('advanceReference').value = '';
    document.getElementById('advanceNotes').value = '';
    document.getElementById('advanceRoomText').textContent = formatCurrency(t.advanceRoom);
    document.getElementById('advanceAmount').max = t.advanceRoom;
    openModal('addAdvanceModal');
}

document.getElementById('addAdvanceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const accId = document.getElementById('advanceClientId').value;
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) { showToast('Client not found.', 'error'); return; }
    const amount = parseInt(document.getElementById('advanceAmount').value) || 0;
    if (amount <= 0) { showToast('Please enter a valid amount.', 'warning'); return; }
    const method = document.getElementById('advanceMethod').value;
    if (method !== 'M-PESA') { showToast('Advances are M-PESA only.', 'error'); return; }
    const reference = document.getElementById('advanceReference').value.trim();
    if (!reference) { showToast('M-PESA reference is required.', 'error'); return; }
    const t = getAccidentClientTotals(c);
    if (t.firmFee <= 0) { showToast('Cannot record advance: Firm Fee is not set.', 'error'); return; }
    if (amount > t.advanceRoom) { showToast(`Amount exceeds available room. Max: ${formatCurrency(t.advanceRoom)} (50% of firm fee = ${formatCurrency(t.maxAdvance)}, already advanced ${formatCurrency(t.advancesTotal)}).`, 'error', 8000); return; }
    const advance = {
        advanceId: generateAdvanceId(),
        amount: amount,
        date: document.getElementById('advanceDate').value || getToday(),
        purpose: document.getElementById('advancePurpose').value,
        receivedBy: document.getElementById('advanceReceivedBy').value.trim(),
        witness: document.getElementById('advanceWitness').value.trim(),
        method: 'M-PESA',
        reference: reference,
        notes: document.getElementById('advanceNotes').value.trim(),
        recordedBy: currentUserEmail,
        recordedAt: getDateTime()
    };
    const advances = [...(c.advances || []), advance];
    const ok = await updateAccidentClientInFirestore(accId, { advances: advances });
    if (ok) {
        await logActivity('Recorded Advance', `${c.name} — ${formatCurrency(amount)} (M-PESA ${reference})`);
        closeModal('addAdvanceModal');
        this.reset();
        showToast(`Advance of ${formatCurrency(amount)} recorded for ${c.name}.`, 'info');
    } else showToast('Failed to record advance.', 'error');
});

function editAdvance(accId, advanceId) {
    if (!isFullAccess()) { showToast('Read-only users cannot edit advances.', 'warning'); return; }
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) return;
    const a = (c.advances || []).find(x => x.advanceId === advanceId);
    if (!a) { showToast('Advance not found.', 'error'); return; }
    const t = getAccidentClientTotals(c);
    const otherAdvancesTotal = t.advancesTotal - (parseInt(a.amount) || 0);
    const room = Math.max(0, t.maxAdvance - otherAdvancesTotal);
    document.getElementById('editAdvanceClientId').value = c.id;
    document.getElementById('editAdvanceId').value = advanceId;
    document.getElementById('editAdvanceClientName').value = c.name + ' — ' + (c.claimNumber || '') + ` (max: ${formatCurrency(room)})`;
    document.getElementById('editAdvanceAmount').value = a.amount || '';
    document.getElementById('editAdvanceAmount').max = room;
    document.getElementById('editAdvanceDate').value = a.date || '';
    document.getElementById('editAdvancePurpose').value = a.purpose || 'Medical Expenses';
    document.getElementById('editAdvanceReceivedBy').value = a.receivedBy || '';
    document.getElementById('editAdvanceWitness').value = a.witness || '';
    document.getElementById('editAdvanceMethod').value = 'M-PESA';
    document.getElementById('editAdvanceReference').value = a.reference || '';
    document.getElementById('editAdvanceNotes').value = a.notes || '';
    openModal('editAdvanceModal');
}

document.getElementById('editAdvanceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const accId = document.getElementById('editAdvanceClientId').value;
    const advanceId = document.getElementById('editAdvanceId').value;
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) { showToast('Client not found.', 'error'); return; }
    const amount = parseInt(document.getElementById('editAdvanceAmount').value) || 0;
    if (amount <= 0) { showToast('Please enter a valid amount.', 'warning'); return; }
    const reference = document.getElementById('editAdvanceReference').value.trim();
    if (!reference) { showToast('M-PESA reference is required.', 'error'); return; }
    const t = getAccidentClientTotals(c);
    const old = (c.advances || []).find(x => x.advanceId === advanceId);
    const otherTotal = t.advancesTotal - (parseInt(old.amount) || 0);
    if (otherTotal + amount > t.maxAdvance) { showToast(`Total advances would exceed 50% cap (${formatCurrency(t.maxAdvance)}).`, 'error', 7000); return; }
    const advances = (c.advances || []).map(a => {
        if (a.advanceId !== advanceId) return a;
        return {
            ...a,
            amount: amount,
            date: document.getElementById('editAdvanceDate').value || a.date,
            purpose: document.getElementById('editAdvancePurpose').value,
            receivedBy: document.getElementById('editAdvanceReceivedBy').value.trim(),
            witness: document.getElementById('editAdvanceWitness').value.trim(),
            method: 'M-PESA',
            reference: reference,
            notes: document.getElementById('editAdvanceNotes').value.trim(),
            updatedBy: currentUserEmail,
            updatedAt: getDateTime()
        };
    });
    const ok = await updateAccidentClientInFirestore(accId, { advances: advances });
    if (ok) { await logActivity('Updated Advance', `${c.name} — ${formatCurrency(amount)}`); closeModal('editAdvanceModal'); showToast('Advance updated.', 'info'); }
    else showToast('Failed to update.', 'error');
});

async function deleteAdvance(accId, advanceId) {
    if (!isFullAccess()) { showToast('Read-only users cannot delete advances.', 'warning'); return; }
    const c = accidentClientsData.find(x => x.id === accId);
    if (!c) return;
    const a = (c.advances || []).find(x => x.advanceId === advanceId);
    if (!a) return;
    if (!confirm(`Delete advance of ${formatCurrency(a.amount)} dated ${a.date}?`)) return;
    const advances = (c.advances || []).filter(x => x.advanceId !== advanceId);
    const ok = await updateAccidentClientInFirestore(accId, { advances: advances });
    if (ok) { await logActivity('Deleted Advance', `${c.name} — ${formatCurrency(a.amount)}`); showToast('Advance deleted.', 'info'); }
    else showToast('Failed to delete.', 'error');
}

function navigate(page, filter, subfilter) {
    // Track document sub-filter separately
    if (page === 'documents') {
        currentDocSubFilter = subfilter || '';
    } else {
        currentDocSubFilter = '';
    }
    if (!canViewPage(page)) {
        showToast('Access denied. Your role does not permit this page.', 'warning');
        if (isClerk()) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-documents').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Documents';
            currentPage = 'documents';
            renderDocuments(filter || '');
        }
        return;
    }
    if (page === 'users' && !isFullAccess()) { showToast('Access Denied.', 'warning'); return; }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    const titleMap = {
        'dashboard': 'Dashboard', 'clients': 'Clients', 'invoices': 'Invoices',
        'cases': 'Cases', 'documents': 'Documents', 'calendar': 'Calendar', 'targets': 'Practice Targets',
        'payments': 'Payments & Receipts', 'fees': 'Client Fees & Installments',
        'accidentClients': 'Accident Clients', 'activity': 'Activity Log', 'users': 'User Management',
        'portal': 'Portal Requests', 'ai': 'AI Tools', 'integrations': 'Integration',
        'reports': 'Reports', 'settings': 'Settings'
    };
    document.getElementById('pageTitle').textContent = titleMap[page] || page;
    currentPage = page;
    currentFilter = filter || '';
    currentSubfilter = subfilter || '';
    if ((page === 'users' || page === 'activity' || page === 'targets' || page === 'fees' || page === 'payments' || page === 'settings' || page === 'portal' || page === 'accidentClients') && !isFullAccess()) {
        showToast('This page is restricted.', 'warning');
        setTimeout(() => {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-documents').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Documents';
            currentPage = 'documents';
        }, 100);
        return;
    }
    if (page === 'portal') { renderPortalRequests(); renderPortalAccounts(); }
    if (page === 'clients') { document.getElementById('clientsListView').style.display = 'block'; document.getElementById('clientDetailView').style.display = 'none'; renderClients(); }
    if (page === 'invoices') renderAllInvoices();
    if (page === 'cases') { document.getElementById('casesListView').style.display = 'block'; document.getElementById('casesDetailView').style.display = 'none'; renderCases(filter, subfilter); }
    if (page === 'documents') renderDocuments(filter);
    if (page === 'calendar') { renderCalendar(); renderTasks(); populateTaskFilters(); }
    if (page === 'targets') { renderTargets(); }
    if (page === 'payments') { renderPayments(); populateUnpaidInvoiceDropdown(); }
    if (page === 'fees') { renderFees(); }
    if (page === 'accidentClients') { document.getElementById('accListView').style.display = 'block'; document.getElementById('accDetailView').style.display = 'none'; renderAccidentClients(); }
    if (page === 'activity') renderActivityLog();
    if (page === 'users') renderUsers();
        if (page === 'settings') { updateLogoPreview(); applyCompanyLogoEverywhere(); }
    if (page === 'dashboard') { updateDashboardStats(); renderUpcomingTasks(); checkNotifications(); }
    closeSidebar();
    const contentEl = document.getElementById('mainContent');
    if (contentEl) contentEl.scrollTop = 0;
    document.querySelectorAll('#sidebarNav .nav-item').forEach(el => {
        el.classList.remove('active');
        const p = el.dataset.page, f = el.dataset.filter || '', sf = el.dataset.subfilter || '';
        if (p === page && f === (filter || '') && sf === (subfilter || '')) el.classList.add('active');
    });
}

function toggleDropdown(trigger) {
    const targetId = trigger.dataset.dropdown;
    if (!targetId) return;
    const wrap = document.getElementById(targetId);
    if (!wrap) return;
    const isOpen = wrap.classList.contains('open');
    const parent = trigger.parentElement;
    parent.querySelectorAll('.dropdown-wrap').forEach(w => { if (w.id !== targetId) w.classList.remove('open'); });
    parent.querySelectorAll('.has-dropdown .arrow').forEach(a => { if (a.closest('.nav-item') !== trigger) a.classList.remove('open'); });
    if (isOpen) { wrap.classList.remove('open'); trigger.querySelector('.arrow')?.classList.remove('open'); }
    else { wrap.classList.add('open'); trigger.querySelector('.arrow')?.classList.add('open'); }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

document.getElementById('clientInstallmentCount').addEventListener('input', function() {
    const count = Math.max(0, Math.min(24, parseInt(this.value) || 0));
    const existing = collectInstallments('client');
    renderInstallmentRows('client', count, existing);
});
document.getElementById('editClientInstallmentCount').addEventListener('input', function() {
    const count = Math.max(0, Math.min(24, parseInt(this.value) || 0));
    const existing = collectInstallments('editClient');
    renderInstallmentRows('editClient', count, existing);
});
['clientTotalFees', 'clientDeposit'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => updateFeeSummary('client')); });
['editClientTotalFees', 'editClientDeposit'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => updateFeeSummary('editClient')); });

document.getElementById('addClientForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Read-only users cannot add clients.', 'warning'); return; }
    const data = {
        name: document.getElementById('clientName').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        phone: document.getElementById('clientPhone').value.trim(),
        address: document.getElementById('clientAddress').value.trim(),
        notes: document.getElementById('clientNotes').value.trim(),
        createdAt: getToday(),
        expenses: [], documents: [], docRequests: [],
        feeAgreement: buildFeeAgreementFromForm('client', null)
    };
    if (!data.name) { showToast('Client name is required.', 'warning'); return; }
    if (data.feeAgreement.deposit > 0 && data.feeAgreement.depositPaid !== false) {
        data.feeAgreement.payments.push({
            id: generatePaymentId(),
            amount: data.feeAgreement.deposit,
            date: data.feeAgreement.depositDate || getToday(),
            method: 'Cash',
            reference: data.feeAgreement.depositRef || 'Initial deposit',
            notes: 'Initial deposit recorded on client creation',
            recordedBy: currentUserEmail,
            recordedAt: getDateTime()
        });
    }
    const clientId = await addClientToFirestore(data);
    if (clientId) { closeModal('addClientModal'); this.reset(); renderInstallmentRows('client', 0, []); updateFeeSummary('client'); showToast('Client added successfully!', 'info'); }
    else showToast('Failed to add client.', 'error');
});

document.getElementById('editClientForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const id = document.getElementById('editClientId').value;
    const existing = clientsData.find(c => c.id === id) || {};
    const updates = {
        name: document.getElementById('editClientName').value.trim(),
        email: document.getElementById('editClientEmail').value.trim(),
        phone: document.getElementById('editClientPhone').value.trim(),
        address: document.getElementById('editClientAddress').value.trim(),
        notes: document.getElementById('editClientNotes').value.trim(),
        feeAgreement: buildFeeAgreementFromForm('editClient', existing.feeAgreement || null)
    };
    if (!updates.name) return;
    await updateClientInFirestore(id, updates);
    closeModal('editClientModal');
    showToast('Client updated successfully!', 'info');
});

document.getElementById('addInvoiceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Read-only users cannot add invoices.', 'warning'); return; }
    const clientId = document.getElementById('invoiceClient').value;
    const client = clientsData.find(c => c.id === clientId);
    const caseId = document.getElementById('invoiceCase').value;
    const caseData = casesData.find(c => c.id === caseId);
    const terms = parseInt(document.getElementById('invoiceTerms').value) || 30;
    const data = {
        clientId: clientId, clientName: client ? client.name : 'Unknown',
        caseId: caseId || null, caseName: caseData ? caseData.name : null,
        amount: parseInt(document.getElementById('invoiceAmount').value) || 0,
        date: document.getElementById('invoiceDate').value,
        terms: terms, status: document.getElementById('invoiceStatus').value,
        description: document.getElementById('invoiceDescription').value.trim(),
        invoiceNumber: generateInvoiceNumber(), paidDate: null
    };
    if (!data.clientId || !data.amount || !data.date) { showToast('Please fill required fields.', 'warning'); return; }
    const invId = await addInvoiceToFirestore(data);
    if (invId) { closeModal('addInvoiceModal'); this.reset(); showToast('Invoice added successfully!', 'info'); }
    else showToast('Failed to add invoice.', 'error');
});

document.getElementById('addCaseForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Read-only users cannot add cases.', 'warning'); return; }
    const clientSelect = document.getElementById('caseClientSelect');
    const clientInput = document.getElementById('caseClient');
    let clientName = clientInput.value.trim();
    if (clientSelect.value) clientName = clientSelect.value;
    if (!clientName) clientName = 'Unknown Client';
    const filed = document.getElementById('caseFiled').checked;
    const data = {
        caseNo: document.getElementById('caseNo').value.trim(),
        name: document.getElementById('caseName').value.trim(),
        client: clientName,
        area: document.getElementById('caseArea').value,
        courtType: document.getElementById('caseCourtType').value,
        status: document.getElementById('caseStatus').value,
        filingDate: document.getElementById('caseFilingDate').value,
        trackingNo: document.getElementById('caseTracking').value.trim(),
        citation: document.getElementById('caseCitation').value.trim(),
        partner: document.getElementById('casePartner').value.trim(),
        summary: document.getElementById('caseSummary').value.trim(),
        decision: document.getElementById('caseDecision').value,
        caseFee: parseInt(document.getElementById('caseFee').value) || 0,
        courtFees: parseInt(document.getElementById('caseCourtFees').value) || 0,
        filed: filed,
        filedDate: filed ? (document.getElementById('caseFiledDate').value || getToday()) : null,
        activities: [], parties: [], fees: [], receipts: [], documents: [],
        age: getAge(document.getElementById('caseFilingDate').value)
    };
    if (!data.caseNo || !data.name) { showToast('Case number and name required.', 'warning'); return; }
    const caseId = await addCaseToFirestore(data);
    if (caseId) { closeModal('addCaseModal'); this.reset(); showToast('Case added successfully!', 'info'); }
    else showToast('Failed to add case.', 'error');
});

document.getElementById('addDocForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const file = document.getElementById('docFile').files[0];
    const category = document.getElementById('docCategory').value;
    const subCategory = document.getElementById('docSubCategory').value || '';
    const matter = document.getElementById('docMatter').value;
    const uploaded = document.getElementById('docUploaded').value;
    if (!file) { showToast('Please select a file.', 'warning'); return; }
    if (!category || !matter || !uploaded) { showToast('Please fill all required fields.', 'warning'); return; }
    const submitBtn = document.getElementById('submitDocBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    const fileId = 'f' + (++fileStoreId);
    const reader = new FileReader();
    reader.onload = async function(ev) {
        const fileData = ev.target.result;
        fileStore[fileId] = fileData;
        await saveFileToIndexedDB(fileId, fileData);
        const docData = { name: file.name, category: category, subCategory: subCategory, matter: matter, uploaded: uploaded, size: (file.size / 1024).toFixed(1) + ' KB', fileId: fileId, downloadUrl: '', base64: fileData };
        const docId = await addDocumentToFirestore(docData);
        if (docId) {
            const caseMatch = casesData.find(c => c.name === matter);
            if (caseMatch) {
                const docs = [...(caseMatch.documents || []), { name: file.name, fileId: fileId }];
                await updateCaseInFirestore(caseMatch.id, { documents: docs });
            }
            closeModal('addDocModal');
            document.getElementById('addDocForm').reset();
            showToast('Document uploaded successfully!', 'info');
        } else showToast('Failed to save document.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    };
    reader.onerror = function() { showToast('Failed to read file.', 'error'); submitBtn.disabled = false; submitBtn.innerHTML = originalText; };
    reader.readAsDataURL(file);
});

document.getElementById('addTaskForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Read-only users cannot add tasks.', 'warning'); return; }
    const errorEl = document.getElementById('taskFormError');
    errorEl.style.display = 'none';
    const title = document.getElementById('taskTitle').value.trim();
    const caseId = document.getElementById('taskCase').value;
    const clientId = document.getElementById('taskClient').value;
    const date = document.getElementById('taskDate').value;
    const time = document.getElementById('taskTime').value;
    const reminderDate = document.getElementById('taskReminderDate').value;
    const reminderTime = document.getElementById('taskReminderTime').value;
    const location = document.getElementById('taskLocation').value.trim();
    const amount = document.getElementById('taskAmount').value;
    const priority = document.getElementById('taskPriority').value;
    const status = document.getElementById('taskStatus').value;
    const description = document.getElementById('taskDescription').value.trim();
    const docFile = document.getElementById('taskDocument').files[0];
    if (!title || !date || !time) { errorEl.textContent = 'Please fill in all required fields.'; errorEl.style.display = 'block'; return; }
    let caseName = 'General', caseIdNum = null;
    if (caseId) { const c = casesData.find(c => c.id === caseId); if (c) { caseName = c.name; caseIdNum = caseId; } }
    let clientName = null;
    if (clientId) { const cl = clientsData.find(c => c.id === clientId); if (cl) clientName = cl.name; }
    if (!clientName && caseIdNum) {
        const c = casesData.find(x => x.id === caseIdNum);
        if (c && c.client) { const cl = clientsData.find(x => x.name === c.client); if (cl) clientName = cl.name; else clientName = c.client; }
    }
    const taskData = {
        title: title, description: description || '', caseId: caseIdNum, caseName: caseName,
        clientId: clientId || null, clientName: clientName || null,
        date: date, time: time,
        reminderDate: reminderDate || '', reminderTime: reminderTime || '', reminderSent: false,
        location: location || 'N/A', amount: parseInt(amount) || 0,
        priority: priority || 'Medium', status: status || 'Scheduled', documents: [], createdAt: getToday()
    };
    const finalizeTask = async (taskDataFinal) => {
        const taskId = await addTaskToFirestore(taskDataFinal);
        if (taskId) {
            document.getElementById('addTaskForm').reset();
            document.getElementById('taskDate').value = '';
            document.getElementById('taskTime').value = '';
            document.getElementById('taskStatus').value = 'Scheduled';
            document.getElementById('taskCase').value = '';
            document.getElementById('taskClient').value = '';
            errorEl.style.display = 'none';
            showToast('Task added successfully!', 'info');
        } else showToast('Failed to add task.', 'error');
    };
    if (docFile) {
        const fileId = 'f' + (++fileStoreId);
        const reader = new FileReader();
        reader.onload = async function(ev) {
            const dataUrl = ev.target.result;
            fileStore[fileId] = dataUrl;
            await saveFileToIndexedDB(fileId, dataUrl);
            taskData.documents.push({ name: docFile.name, fileId: fileId });
            await addDocumentToFirestore({ name: docFile.name, category: 'Task Attachment', matter: caseName !== 'General' ? caseName : (clientName || 'Task'), uploaded: getToday(), size: (docFile.size / 1024).toFixed(1) + ' KB', fileId: fileId, downloadUrl: '', base64: dataUrl });
            await finalizeTask(taskData);
        };
        reader.onerror = function() { errorEl.textContent = 'Failed to read attached file.'; errorEl.style.display = 'block'; };
        reader.readAsDataURL(docFile);
        return;
    }
    await finalizeTask(taskData);
});

document.getElementById('tasksTable').addEventListener('click', async function(e) {
    const target = e.target.closest('button');
    if (!target) return;
    const taskId = target.dataset.taskid;
    if (!taskId) return;
    if (!isFullAccess()) { showToast('Read-only users cannot modify tasks.', 'warning'); return; }
    if (target.classList.contains('task-complete-btn')) await updateTaskInFirestore(taskId, { status: 'Completed' });
    else if (target.classList.contains('task-cancel-btn')) await updateTaskInFirestore(taskId, { status: 'Cancelled' });
    else if (target.classList.contains('task-delete-btn')) { if (confirm('Delete this task?')) await deleteTaskFromFirestore(taskId); }
});

document.addEventListener('click', function(e) {
    const btn = e.target.closest('.delete-doc-btn');
    if (btn) {
        e.preventDefault();
        if (!canDeleteDocuments()) { showToast('Your role does not permit deleting documents.', 'warning'); return; }
        const docId = btn.dataset.docid || null;
        const caseId = btn.dataset.caseid || null;
        const fileId = btn.dataset.fileid || null;
        const docName = btn.dataset.docname || '';
        deleteDocument(docId, caseId, fileId, docName);
    }
});

document.addEventListener('click', function(e) {
    const btn = e.target.closest('.download-btn');
    if (btn) {
        const url = btn.dataset.url;
        const fileId = btn.dataset.fileid;
        const fileName = btn.dataset.filename || 'document';
        if (url) {
            const link = document.createElement('a');
            link.href = url; link.download = fileName; link.target = '_blank';
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            return;
        }
        if (fileId) {
            const doDownload = (dataUrl) => {
                const link = document.createElement('a');
                link.href = dataUrl; link.download = fileName;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            };
            if (fileStore[fileId]) { doDownload(fileStore[fileId]); return; }
            const doc = documentsData.find(d => d.fileId === fileId);
            if (doc && doc.base64) { fileStore[fileId] = doc.base64; doDownload(doc.base64); return; }
            showToast('File not available for download.', 'warning');
        } else showToast('File reference missing.', 'error');
    }
});

document.addEventListener('click', function(e) {
    const btn = e.target.closest('.view-doc-btn');
    if (btn) {
        const url = btn.dataset.url;
        const fileId = btn.dataset.fileid;
        const fileName = btn.dataset.filename || 'document';
        let dataUrl = url;
        if (!dataUrl && fileId) {
            if (fileStore[fileId]) dataUrl = fileStore[fileId];
            else { const doc = documentsData.find(d => d.fileId === fileId); if (doc && doc.base64) { fileStore[fileId] = doc.base64; dataUrl = doc.base64; } }
        }
        if (!dataUrl) { showToast('File data not loaded yet. Please wait and try again.', 'warning'); return; }
        let previewModal = document.getElementById('previewDocModal');
        if (!previewModal) {
            previewModal = document.createElement('div');
            previewModal.id = 'previewDocModal';
            previewModal.className = 'modal-overlay';
            previewModal.innerHTML = `
                <div class="modal" style="max-width: 95vw; width: 95vw; height: 90vh; max-height: 90vh;">
                    <div class="modal-header">
                        <h2 style="font-size:1rem;"><i class="fas fa-eye"></i> <span id="previewDocTitle"></span></h2>
                        <div>
                            <a class="btn btn-sm btn-primary" id="previewDocDownload" download><i class="fas fa-download"></i> Download</a>
                            <button class="modal-close" onclick="document.getElementById('previewDocModal').classList.remove('active')">&times;</button>
                        </div>
                    </div>
                    <div id="previewDocBody" style="flex:1; overflow:auto; padding:0.5rem; text-align:center;"></div>
                </div>`;
            document.body.appendChild(previewModal);
            previewModal.addEventListener('click', function(ev) { if (ev.target === previewModal) previewModal.classList.remove('active'); });
        }
        document.getElementById('previewDocTitle').textContent = fileName;
        document.getElementById('previewDocDownload').href = dataUrl;
        document.getElementById('previewDocDownload').download = fileName;
        const body = document.getElementById('previewDocBody');
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.pdf')) body.innerHTML = `<iframe src="${dataUrl}" style="width:100%; height:100%; border:none; min-height:70vh;"></iframe>`;
        else if (lower.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/)) body.innerHTML = `<img src="${dataUrl}" style="max-width:100%; max-height:85vh; object-fit:contain;">`;
        else if (lower.match(/\.(mp4|webm|ogg|mov)$/)) body.innerHTML = `<video src="${dataUrl}" controls style="max-width:100%; max-height:85vh;"></video>`;
        else if (lower.match(/\.(mp3|wav|ogg|m4a)$/)) body.innerHTML = `<audio src="${dataUrl}" controls style="margin-top:2rem;"></audio>`;
        else body.innerHTML = `<div style="padding:2rem; text-align:center;"><i class="fas fa-file" style="font-size:3rem; color:#94a3b8;"></i><p style="margin-top:1rem; color:#64748b;">Inline preview not available for this file type.</p><p style="color:#64748b; font-size:0.85rem;">Click <strong>Download</strong> above to open it in its native application.</p></div>`;
        previewModal.classList.add('active');
    }
});

document.querySelectorAll('#sidebarNav .nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.stopPropagation();
        if (this.dataset.dropdown) { toggleDropdown(this); return; }
        const page = this.dataset.page, filter = this.dataset.filter || '', subfilter = this.dataset.subfilter || '';
        if (page) {
            document.getElementById('globalSearchInput').value = '';
            document.getElementById('clearSearchBtn').style.display = 'none';
            document.getElementById('searchResultsDropdown').classList.remove('show');
            navigate(page, filter, subfilter);
            document.querySelectorAll('#sidebarNav .dropdown-wrap').forEach(w => w.classList.remove('open'));
            document.querySelectorAll('#sidebarNav .has-dropdown .arrow').forEach(a => a.classList.remove('open'));
        }
    });
});

document.getElementById('backToCasesList').addEventListener('click', function() {
    document.getElementById('casesListView').style.display = 'block';
    document.getElementById('casesDetailView').style.display = 'none';
    renderCases(currentFilter, currentSubfilter);
});
document.getElementById('backToClientsList').addEventListener('click', function() {
    document.getElementById('clientsListView').style.display = 'block';
    document.getElementById('clientDetailView').style.display = 'none';
    renderClients();
});
document.getElementById('backToAccList').addEventListener('click', function() {
    selectedAccClientId = null;
    document.getElementById('accListView').style.display = 'block';
    document.getElementById('accDetailView').style.display = 'none';
    renderAccidentClients();
});
document.getElementById('taskFilterCase').addEventListener('change', function() { renderTasksWithSearch(document.getElementById('globalSearchInput').value.trim()); });
document.getElementById('taskFilterStatus').addEventListener('change', function() { renderTasksWithSearch(document.getElementById('globalSearchInput').value.trim()); });

document.getElementById('calPrevMonth').addEventListener('click', function() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); });
document.getElementById('calNextMonth').addEventListener('click', function() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); });
document.getElementById('calTodayBtn').addEventListener('click', function() { const now = new Date(); calYear = now.getFullYear(); calMonth = now.getMonth(); renderCalendar(); });

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
});

document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
// ============================================================
// DOCUMENT GENERATOR — SLIDE-OVER
// ============================================================
(function setupDocGeneratorPanel() {
    const openBtn     = document.getElementById('openDocGeneratorBtn');
    const panel       = document.getElementById('docGenPanel');
    const backdrop    = document.getElementById('docGenBackdrop');
    const closeBtn    = document.getElementById('docGenClosePanel');
    const standalone  = document.getElementById('docGenOpenStandalone');
    const frame       = document.getElementById('docGenFrame');

    if (!openBtn || !panel || !frame) return;

    function openPanel() {
        if (frame.src === 'about:blank') {
            const params = new URLSearchParams({
                embedded: '1',
                firm: 'kuriakaratu-b5c90'
            });
            frame.src = 'generator.html?' + params.toString();
        }
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closePanel() {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    openBtn.addEventListener('click', openPanel);
    if (closeBtn)   closeBtn.addEventListener('click', closePanel);
    if (backdrop)   backdrop.addEventListener('click', closePanel);
    if (standalone) standalone.addEventListener('click', () => {
        window.open('generator.html', '_blank', 'noopener');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
    });

    // Receive save notifications from the generator iframe
    window.addEventListener('message', (ev) => {
        if (!ev.data || ev.data.source !== 'kk-docgen') return;
        if (ev.data.action === 'saved' && ev.data.doc) {
            showToast(`Generated "${ev.data.doc.name}" saved to Documents.`, 'info');
        }
        if (ev.data.action === 'close') closePanel();
    });
})();
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeSidebar(); });

document.getElementById('activityFilter')?.addEventListener('input', renderActivityLog);
document.getElementById('clearActivityFilter')?.addEventListener('click', function() { document.getElementById('activityFilter').value = ''; renderActivityLog(); });

document.getElementById('clearActivityLog')?.addEventListener('click', async function() {
    if (!isFullAccess()) { showToast('Only admins can clear logs.', 'warning'); return; }
    if (!confirm('Delete all activity logs?')) return;
    try {
        const snap = await db.collection('activityLogs').limit(500).get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await logActivity('Cleared Activity Log', 'All logs deleted');
        showToast('Activity log cleared.', 'info');
    } catch (e) { showToast('Failed to clear logs: ' + e.message, 'error'); }
});

document.getElementById('globalSearchInput').addEventListener('input', function() {
    const query = this.value;
    if (query.trim().length === 0) {
        document.getElementById('searchResultsDropdown').classList.remove('show');
        document.getElementById('clearSearchBtn').style.display = 'none';
        applyGlobalFilter('');
        return;
    }
    performGlobalSearch(query);
});

document.getElementById('globalSearchInput').addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        this.value = '';
        document.getElementById('searchResultsDropdown').classList.remove('show');
        document.getElementById('clearSearchBtn').style.display = 'none';
        this.blur();
        applyGlobalFilter('');
    }
});
document.getElementById('clearSearchBtn').addEventListener('click', function() {
    const input = document.getElementById('globalSearchInput');
    input.value = '';
    this.style.display = 'none';
    document.getElementById('searchResultsDropdown').classList.remove('show');
    input.focus();
    applyGlobalFilter('');
});
document.addEventListener('click', function(e) {
    const wrap = document.getElementById('globalSearchWrap');
    if (!wrap.contains(e.target)) document.getElementById('searchResultsDropdown').classList.remove('show');
});

document.getElementById('addCaseBtn').addEventListener('click', function() {
    if (!isFullAccess()) { showToast('Read-only users cannot add cases.', 'warning'); return; }
    document.getElementById('caseFilingDate').value = getToday();
    document.getElementById('caseFiled').checked = false;
    document.getElementById('caseFiledDateWrap').style.display = 'none';
    openModal('addCaseModal');
});
document.getElementById('addClientBtn').addEventListener('click', function() {
    if (!isFullAccess()) { showToast('Read-only users cannot add clients.', 'warning'); return; }
    renderInstallmentRows('client', 0, []);
    document.getElementById('clientInstallmentCount').value = 0;
    document.getElementById('clientDepositDate').value = getToday();
    updateFeeSummary('client');
    openModal('addClientModal');
});
document.getElementById('addGlobalInvoiceBtn').addEventListener('click', function() {
    if (!isFullAccess()) { showToast('Read-only users cannot add invoices.', 'warning'); return; }
    populateInvoiceClientDropdown(null);
    document.getElementById('invoiceDate').value = getToday();
    openModal('addInvoiceModal');
});
document.getElementById('addDocBtn').addEventListener('click', function() {
    const select = document.getElementById('docMatter');
    select.innerHTML = '<option value="">Select a case...</option>';
    casesData.forEach(c => { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; select.appendChild(o); });
    const opt = document.createElement('option');
    opt.value = 'General';
    opt.textContent = 'General (No Case)';
    select.appendChild(opt);
    document.getElementById('docUploaded').value = getToday();
    populateDocCategoryDropdowns();
    openModal('addDocModal');
});

document.getElementById('invoiceClient').addEventListener('change', function() {
    const clientId = this.value;
    const caseSelect = document.getElementById('invoiceCase');
    caseSelect.innerHTML = '<option value="">None</option>';
    if (clientId) {
        const client = clientsData.find(c => c.id === clientId);
        if (client) {
            const clientCases = casesData.filter(c => c.client === client.name);
            clientCases.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.caseNo + ' - ' + c.name; caseSelect.appendChild(o); });
        }
    }
});

document.getElementById('caseFiled').addEventListener('change', function() {
    document.getElementById('caseFiledDateWrap').style.display = this.checked ? 'block' : 'none';
    if (this.checked) document.getElementById('caseFiledDate').value = getToday();
});
document.getElementById('editCaseFiled').addEventListener('change', function() {
    document.getElementById('editCaseFiledDateWrap').style.display = this.checked ? 'block' : 'none';
    if (this.checked && !document.getElementById('editCaseFiledDate').value) document.getElementById('editCaseFiledDate').value = getToday();
});

document.getElementById('logoFileInput').addEventListener('change', function() {
    if (!isFullAccess()) { showToast('Read-only users cannot change settings.', 'warning'); this.value = ''; return; }
    const file = this.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file (JPG/PNG).', 'warning'); this.value = ''; return; }
    if (file.size > 1024 * 1024) { showToast('Logo file is too large (max 1 MB).', 'warning'); this.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function(e) { companyLogoBase64 = e.target.result; updateLogoPreview(); showToast('Logo loaded. Click "Save Logo" to persist.', 'info'); };
    reader.readAsDataURL(file);
});

document.getElementById('saveLogoBtn').addEventListener('click', async function() {
    if (!isFullAccess()) { showToast('Read-only users cannot change settings.', 'warning'); return; }
    if (!companyLogoBase64) { showToast('Please select a logo file first.', 'warning'); return; }
    try {
        await db.collection('settings').doc('company').set({ logoBase64: companyLogoBase64, updatedAt: getDateTime(), updatedBy: currentUserEmail }, { merge: true });
                localStorage.setItem(LOGO_LS_KEY, companyLogoBase64);
        applyCompanyLogoEverywhere();          // ← ADD THIS
        await logActivity('Updated Company Logo', 'New logo uploaded');
        showToast('Company logo saved!', 'info');
    } catch (e) { showToast('Failed to save logo: ' + e.message, 'error'); }
});

document.getElementById('removeLogoBtn').addEventListener('click', async function() {
    if (!isFullAccess()) { showToast('Read-only users cannot change settings.', 'warning'); return; }
    if (!confirm('Remove the company logo? The default fallback will be used on invoices.')) return;
    try { await db.collection('settings').doc('company').update({ logoBase64: firebase.firestore.FieldValue.delete() }); } catch (e) {}
    companyLogoBase64 = '';
    localStorage.removeItem(LOGO_LS_KEY);
    document.getElementById('logoFileInput').value = '';
        updateLogoPreview();
    applyCompanyLogoEverywhere();              
    await logActivity('Removed Company Logo', '');
    showToast('Company logo removed.', 'info');
});

document.getElementById('firmSettingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Read-only users cannot change settings.', 'warning'); return; }
    try {
        await db.collection('settings').doc('firm').set({
            firmName: document.getElementById('settingFirmName').value,
            address: document.getElementById('settingFirmAddress').value,
            phone: document.getElementById('settingFirmPhone').value,
            rate: document.getElementById('settingFirmRate').value,
            trustAccount: document.getElementById('settingFirmTrust').value,
            notifications: document.getElementById('settingFirmNotif').value,
            updatedAt: getDateTime()
        }, { merge: true });
        await logActivity('Updated Firm Settings', '');
        showToast('Firm settings saved.', 'info');
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
});

function applyGlobalFilter(term) {
    const currentPageEl = document.querySelector('.page.active');
    if (!currentPageEl) return;
    const pageId = currentPageEl.id.replace('page-', '');
    switch (pageId) {
        case 'clients': renderClientsWithSearch(term); break;
        case 'cases': renderCasesWithSearch(term); break;
        case 'documents': renderDocumentsWithSearch(term); break;
        case 'invoices': renderInvoicesWithSearch(term); break;
        case 'calendar': renderTasksWithSearch(term); break;
        case 'accidentClients': renderAccidentClients(); break;
        default: break;
    }
}

function renderClientsWithSearch(term) {
    if (!canViewPage('clients')) return;
    const tbody = document.getElementById('clientsBody');
    const countLabel = document.getElementById('clientCountLabel');
    let filtered = clientsData;
    if (term) {
        const t = term.toLowerCase();
        filtered = filtered.filter(c => c.name.toLowerCase().includes(t) || (c.email && c.email.toLowerCase().includes(t)) || (c.phone && c.phone.includes(t)) || (c.address && c.address.toLowerCase().includes(t)) || (c.notes && c.notes.toLowerCase().includes(t)));
    }
    countLabel.textContent = `${filtered.length} client${filtered.length !== 1 ? 's' : ''}`;
    if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:1.5rem;">${term ? 'No clients match.' : 'No clients found.'}</td></tr>`; return; }
    tbody.innerHTML = filtered.map(c => {
        const clientCases = casesData.filter(cs => cs.client === c.name || cs.clientId === c.id);
        const clientInvoices = invoicesData.filter(inv => inv.clientId === c.id);
        const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + parseInt(inv.amount), 0);
        const outstanding = clientInvoices.filter(inv => inv.status === 'Unpaid' || inv.status === 'Overdue').reduce((sum, inv) => sum + parseInt(inv.amount), 0);
        const fee = getClientFeeBalance(c);
        const exp = getClientExpenses(c);
        const feeCell = fee.total > 0 ? `<span class="badge ${fee.balance > 0 ? 'red' : 'green'}">${formatCurrency(fee.balance)}</span>` : '<span class="text-muted">—</span>';
        const expCell = exp.total > 0 ? `<span class="badge" style="background:#fef3c7;color:#92400e;">${formatCurrency(exp.total)}</span>` : '<span class="text-muted">—</span>';
        return `<tr class="clickable-row" data-clientid="${c.id}">
            <td><strong>${c.name}</strong></td>
            <td>${c.email || '—'}</td>
            <td>${c.phone || '—'}</td>
            <td><span class="badge blue">${clientCases.length}</span></td>
            <td>${formatCurrency(totalInvoiced)}</td>
            <td>${expCell}</td>
            <td>${feeCell}</td>
            <td><span class="badge ${outstanding > 0 ? 'red' : 'green'}">${formatCurrency(outstanding)}</span></td>
            <td style="text-align:center;white-space:nowrap;">
                <button class="btn btn-teal btn-sm" onclick="event.stopPropagation();openRecordPaymentModal('${c.id}')" title="Pay"><i class="fas fa-money-bill-wave"></i> Pay</button>
                <button class="btn btn-outline btn-sm view-client-btn" data-clientid="${c.id}"><i class="fas fa-chevron-right"></i> View</button>
            </td>
        </tr>`;
    }).join('');
    document.querySelectorAll('.view-client-btn').forEach(b => b.addEventListener('click', function(e) { e.stopPropagation(); showClientDetail(this.dataset.clientid); }));
    document.querySelectorAll('.clickable-row').forEach(r => r.addEventListener('click', function() { showClientDetail(this.dataset.clientid); }));
}

function renderCasesWithSearch(term) {
    if (!canViewPage('cases')) return;
    const tbody = document.getElementById('casesBody');
    const badge = document.getElementById('casesFilterBadge');
    const countLabel = document.getElementById('caseCountLabel');
    let filtered = casesData;
 if (currentCaseFilter) filtered = filtered.filter(c => c.area === currentCaseFilter);
if (currentCaseSubFilter) filtered = filtered.filter(c => c.courtType === currentCaseSubFilter);
    if (term) {
        const t = term.toLowerCase();
        filtered = filtered.filter(c =>
            (c.caseNo && c.caseNo.toLowerCase().includes(t)) ||
            (c.name && c.name.toLowerCase().includes(t)) ||
            (c.client && c.client.toLowerCase().includes(t)) ||
            (c.area && c.area.toLowerCase().includes(t)) ||
            (c.trackingNo && c.trackingNo.toLowerCase().includes(t)) ||
            (c.citation && c.citation.toLowerCase().includes(t)) ||
            (c.summary && c.summary.toLowerCase().includes(t)) ||
            (c.courtType && c.courtType.toLowerCase().includes(t))
        );
    }
    badge.textContent = (currentFilter || 'All') + (currentSubfilter ? ` (${currentSubfilter})` : '') + (term ? ` 🔍 "${term}"` : '');
    countLabel.textContent = `${filtered.length} case${filtered.length !== 1 ? 's' : ''}`;
    if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#64748b;padding:1.5rem;">${term ? 'No cases match.' : 'No cases found.'}</td></tr>`; return; }
    tbody.innerHTML = filtered.map(c => {
        const filedBadge = c.filed === true ? `<span class="badge filed"><i class="fas fa-check"></i> Filed</span>` : `<span class="badge unfiled">Not Filed</span>`;
        return `<tr class="clickable-row" data-caseid="${c.id}">
            <td><strong>${c.caseNo}</strong></td>
            <td>${c.name}</td>
            <td><span class="badge blue">${c.client || '—'}</span></td>
            <td>${c.trackingNo || 'N/A'}</td>
            <td><span class="badge blue">${c.area}</span></td>
            <td>${c.courtType || 'N/A'}</td>
            <td>${filedBadge}</td>
            <td><span class="badge ${c.status === 'Active' ? 'green' : c.status === 'Closed' ? 'gray' : 'yellow'}">${c.status}</span></td>
            <td>${c.filingDate}</td>
            <td><button class="btn btn-outline btn-sm view-case-btn" data-caseid="${c.id}"><i class="fas fa-chevron-right"></i> More</button></td>
        </tr>`;
    }).join('');
    document.querySelectorAll('.view-case-btn').forEach(b => b.addEventListener('click', function(e) { e.stopPropagation(); showCaseDetail(this.dataset.caseid); }));
    document.querySelectorAll('.clickable-row').forEach(r => r.addEventListener('click', function() { showCaseDetail(this.dataset.caseid); }));
}

function renderDocumentsWithSearch(term) {
    const tbody = document.getElementById('docsBody');
    const badge = document.getElementById('docsFilterBadge');
    let filtered = documentsData;
    // Support filtering by category AND subfilter (from sidebar)
    if (currentDocFilter) filtered = filtered.filter(d => d.category === currentDocFilter);
if (currentDocSubFilter) filtered = filtered.filter(d => (d.subCategory || '') === currentDocSubFilter);
    if (term) {
        const t = term.toLowerCase();
        filtered = filtered.filter(d =>
            (d.name && d.name.toLowerCase().includes(t)) ||
            (d.category && d.category.toLowerCase().includes(t)) ||
            (d.subCategory && d.subCategory.toLowerCase().includes(t)) ||
            (d.matter && d.matter.toLowerCase().includes(t)) ||
            (d.uploaded && d.uploaded.includes(t)) ||
            (d.size && d.size.toLowerCase().includes(t))
        );
    }
  badge.textContent = (currentFilter || 'All') + (currentDocSubFilter ? ` › ${currentDocSubFilter}` : '') + (term ? ` 🔍 "${term}"` : '');
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:1.5rem;">${term ? 'No documents match.' : 'No documents found.'}</td></tr>`;
        return;
    }
    // Group: Category → Sub-Section → Filename
    const groups = {};
    filtered.forEach(d => {
        const cat = d.category || 'Uncategorised';
        const sub = d.subCategory || 'General';
        if (!groups[cat]) groups[cat] = {};
        if (!groups[cat][sub]) groups[cat][sub] = [];
        groups[cat][sub].push(d);
    });
    const sortedCats = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    let html = '';
    sortedCats.forEach(cat => {
        const subKeys = Object.keys(groups[cat]).sort((a, b) => a.localeCompare(b));
        let totalInCat = 0;
        subKeys.forEach(sub => { totalInCat += groups[cat][sub].length; });
        // Section header row
        html += `<tr class="doc-section-row"><td colspan="6" style="padding:0;border:none;"><div class="doc-group-header"><i class="fas fa-folder"></i> ${cat} <span style="float:right;font-weight:400;font-size:0.7rem;">${totalInCat} file${totalInCat !== 1 ? 's' : ''}</span></div></td></tr>`;
        subKeys.forEach(sub => {
            const files = groups[cat][sub].slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            html += `<tr class="doc-subsection-row"><td colspan="6" style="padding:0;border:none;"><div style="padding-left:1rem;"><span class="doc-subgroup-header"><i class="fas fa-folder-open"></i> ${sub} <span style="font-weight:400;font-size:0.7rem;">(${files.length})</span></span></div></td></tr>`;
            files.forEach(d => {
                const hasFile = d.fileId && fileStore[d.fileId];
                const hasBase64 = d.base64 && d.base64.length > 0;
                let actionsHtml = '';
                if (hasFile || hasBase64) {
                    actionsHtml += `<button class="btn btn-sm btn-primary download-btn" data-fileid="${d.fileId}" data-filename="${d.name}"><i class="fas fa-download"></i></button>`;
                    actionsHtml += `<button class="btn btn-sm btn-view view-doc-btn" data-fileid="${d.fileId}" data-filename="${d.name}"><i class="fas fa-eye"></i></button>`;
                } else {
                    actionsHtml += `<span class="text-muted fs-small">File loading...</span>`;
                    actionsHtml += `<button class="btn btn-sm btn-primary download-btn" data-fileid="${d.fileId}" data-filename="${d.name}"><i class="fas fa-download"></i></button>`;
                    actionsHtml += `<button class="btn btn-sm btn-view view-doc-btn" data-fileid="${d.fileId}" data-filename="${d.name}"><i class="fas fa-eye"></i></button>`;
                }
                if (isFullAccess()) actionsHtml += `<button class="btn btn-sm btn-warning" onclick="openEditDocClassify('${d.id}')" title="Change section / sub-section"><i class="fas fa-tags"></i></button>`;
if (canDeleteDocuments()) actionsHtml += `<button class="btn btn-sm btn-danger delete-doc-btn" data-docid="${d.id}" data-fileid="${d.fileId}" data-docname="${d.name}"><i class="fas fa-trash"></i></button>`;
                html += `<tr>
                    <td style="padding-left:2rem;"><i class="fas fa-file-pdf" style="color:#ef4444;margin-right:0.4rem;"></i> ${d.name}</td>
                    <td><span class="badge">${d.category}</span></td>
                    <td>${d.subCategory ? `<span class="badge blue">${d.subCategory}</span>` : '<span class="badge gray">General</span>'}</td>
                    <td>${d.matter}</td>
                    <td>${d.uploaded} <span class="text-muted fs-small">${d.size || ''}</span></td>
                    <td style="text-align:center;"><div class="doc-actions">${actionsHtml}</div></td>
                </tr>`;
            });
        });
    });
    tbody.innerHTML = html;
}

function renderInvoicesWithSearch(term) {
    if (!canViewPage('invoices')) return;
    const tbody = document.getElementById('invoicesBody');
    const countLabel = document.getElementById('invoiceCountLabel');
    let filtered = invoicesData;
    if (term) {
        const t = term.toLowerCase();
        filtered = filtered.filter(inv =>
            (inv.clientName && inv.clientName.toLowerCase().includes(t)) ||
            (inv.caseName && inv.caseName.toLowerCase().includes(t)) ||
            (inv.description && inv.description.toLowerCase().includes(t)) ||
            (inv.status && inv.status.toLowerCase().includes(t))
        );
    }
    countLabel.textContent = `${filtered.length} invoice${filtered.length !== 1 ? 's' : ''}`;
    if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:1.5rem;">${term ? 'No invoices match.' : 'No invoices found.'}</td></tr>`; return; }
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
    tbody.innerHTML = sorted.map(inv => {
        const clientName = inv.clientName || 'Unknown Client';
        const caseName = inv.caseName || '—';
        const statusClass = inv.status === 'Paid' ? 'green' : inv.status === 'Overdue' ? 'red' : 'yellow';
        return `<tr>
            <td><strong>${clientName}</strong></td>
            <td>${caseName}</td>
            <td>${inv.description || '—'}</td>
            <td>${formatCurrency(inv.amount)}</td>
            <td>${inv.date}</td>
            <td>${inv.terms || 30} days</td>
            <td><span class="badge ${statusClass}">${inv.status || 'Unpaid'}</span></td>
            <td style="text-align:center;white-space:nowrap;">${invoiceActionsHTML(inv)}</td>
        </tr>`;
    }).join('');
}

function renderTasksWithSearch(term) {
    if (!canViewPage('calendar')) return;
    const tbody = $('tasksBody');
    if (!tbody) return;
    const countLabel = $('taskCountLabel');
    const filterCaseEl = $('taskFilterCase');
    const filterStatusEl = $('taskFilterStatus');
    const filterCase = filterCaseEl ? filterCaseEl.value : 'all';
    const filterStatus = filterStatusEl ? filterStatusEl.value : 'all';
    let filtered = tasksData;
    if (filterCase === 'general') filtered = filtered.filter(t => !t.caseId);
    else if (filterCase !== 'all') filtered = filtered.filter(t => t.caseId === filterCase);
    if (filterStatus !== 'all') filtered = filtered.filter(t => t.status === filterStatus);
    if (term) {
        const t = term.toLowerCase();
        filtered = filtered.filter(task =>
            (task.title && task.title.toLowerCase().includes(t)) ||
            (task.description && task.description.toLowerCase().includes(t)) ||
            (task.caseName && task.caseName.toLowerCase().includes(t)) ||
            (task.clientName && task.clientName.toLowerCase().includes(t)) ||
            (task.location && task.location.toLowerCase().includes(t))
        );
    }
    filtered.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
    if (countLabel) countLabel.textContent = `${filtered.length} task${filtered.length !== 1 ? 's' : ''}`;
    if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#64748b;padding:1.5rem;">${term ? 'No tasks match.' : 'No tasks found.'}</td></tr>`; return; }
    tbody.innerHTML = filtered.map(t => {
        const priorityClass = (t.priority || 'Medium').toLowerCase();
        const statusClass = t.status === 'Scheduled' ? 'yellow' : t.status === 'Completed' ? 'green' : 'gray';
        const isCompleted = t.status === 'Completed';
        const caseDisplay = !t.caseId ? '<span class="badge gray">General</span>' : `<span class="badge blue">${t.caseName}</span>`;
        const clientDisplay = t.clientName ? `<span class="badge" style="background:#e0e7ff;color:#3730a3;">${t.clientName}</span>` : '<span class="text-muted">—</span>';
        const reminderTxt = (t.reminderDate && t.reminderTime) ? `<span class="badge ${t.reminderSent ? 'gray' : 'purple'}"><i class="fas fa-bell"></i> ${t.reminderDate} ${t.reminderTime}</span>` : '<span class="text-muted">—</span>';
        const docBadge = (t.documents && t.documents.length) ? `<span class="badge blue" title="${t.documents.length} attached document(s)"><i class="fas fa-paperclip"></i> ${t.documents.length}</span>` : '';
        return `<tr class="${isCompleted ? 'task-row completed' : ''}">
            <td><strong>${t.title}</strong> ${docBadge}${t.description ? `<br><span class="text-muted fs-small">${t.description}</span>` : ''}</td>
            <td>${caseDisplay}</td>
            <td>${clientDisplay}</td>
            <td>${t.date} <span class="text-muted">${t.time}</span></td>
            <td>${reminderTxt}</td>
            <td><i class="fas fa-map-pin text-muted" style="font-size:0.65rem;"></i> ${t.location}</td>
            <td>${t.amount > 0 ? formatCurrency(t.amount) : '<span class="text-muted">—</span>'}</td>
            <td><span class="badge priority-${priorityClass}"><span class="task-priority-dot ${priorityClass}"></span>${t.priority}</span></td>
            <td><span class="badge ${statusClass}">${t.status}</span></td>
            <td style="text-align:center;white-space:nowrap;">
                ${t.status === 'Scheduled' && isFullAccess() ? `<button class="btn btn-success btn-sm task-complete-btn" data-taskid="${t.id}" title="Complete"><i class="fas fa-check"></i></button> ` : ''}
                ${t.status === 'Scheduled' && isFullAccess() ? `<button class="btn btn-warning btn-sm task-cancel-btn" data-taskid="${t.id}" title="Cancel"><i class="fas fa-times"></i></button> ` : ''}
                ${isFullAccess() ? `<button class="btn btn-danger btn-sm task-delete-btn" data-taskid="${t.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function renderAllInvoices() { if (canViewPage('invoices')) renderInvoicesWithSearch(document.getElementById('globalSearchInput').value.trim()); }
function renderClients() { if (canViewPage('clients')) renderClientsWithSearch(document.getElementById('globalSearchInput').value.trim()); }
function renderCases(filter, subfilter) {
    if (!canViewPage('cases')) return;
    currentCaseFilter = filter || '';
    currentCaseSubFilter = subfilter || '';
    currentFilter = filter || '';
    currentSubfilter = subfilter || '';
    renderCasesWithSearch($('globalSearchInput')?.value?.trim() || '');
}

function renderDocuments(filter) {
    currentDocFilter = filter || '';
    currentFilter = filter || '';
    renderDocumentsWithSearch($('globalSearchInput')?.value?.trim() || '');
}

function renderTasks() {
    if (currentPage !== 'calendar') return;
    if (!canViewPage('calendar')) return;
    renderTasksWithSearch($('globalSearchInput')?.value?.trim() || '');
}
function performGlobalSearch(query) {
    if (!isFullAccess()) return;
    const dropdown = document.getElementById('searchResultsDropdown');
    const term = query.trim().toLowerCase();
    if (!term) { dropdown.classList.remove('show'); document.getElementById('clearSearchBtn').style.display = 'none'; applyGlobalFilter(''); return; }
    document.getElementById('clearSearchBtn').style.display = 'inline';
    const results = [];
    clientsData.forEach(c => {
        const match = c.name.toLowerCase().includes(term) || (c.email && c.email.toLowerCase().includes(term)) || (c.phone && c.phone.includes(term));
        if (match) results.push({ type: 'Client', title: c.name, sub: c.email || c.phone || '', id: c.id, page: 'clients', filter: '' });
    });
    casesData.forEach(c => {
        const match = (c.caseNo && c.caseNo.toLowerCase().includes(term)) || (c.name && c.name.toLowerCase().includes(term)) || (c.client && c.client.toLowerCase().includes(term));
        if (match) results.push({ type: 'Case', title: c.caseNo + ' - ' + c.name, sub: c.client || c.area || '', id: c.id, page: 'cases', filter: c.area || '', subfilter: c.courtType || '' });
    });
    invoicesData.forEach(inv => {
        const match = (inv.clientName && inv.clientName.toLowerCase().includes(term)) || (inv.description && inv.description.toLowerCase().includes(term));
        if (match) results.push({ type: 'Invoice', title: inv.clientName + ' - ' + formatCurrency(inv.amount), sub: inv.date, id: inv.id, page: 'invoices', filter: '' });
    });
    documentsData.forEach(d => {
        const match = (d.name && d.name.toLowerCase().includes(term)) || (d.category && d.category.toLowerCase().includes(term)) || (d.matter && d.matter.toLowerCase().includes(term));
        if (match) results.push({ type: 'Document', title: d.name || 'Unnamed', sub: (d.category || '') + ' | ' + (d.matter || ''), id: d.id, page: 'documents', filter: d.category || '' });
    });
    accidentClientsData.forEach(c => {
        const match = (c.name && c.name.toLowerCase().includes(term)) || (c.claimNumber && c.claimNumber.toLowerCase().includes(term)) || (c.insurer && c.insurer.toLowerCase().includes(term)) || (c.phone && c.phone.includes(term));
        if (match) results.push({ type: 'Accident Claim', title: c.name + ' — ' + (c.claimNumber || ''), sub: (c.insurer || '') + ' | ' + (c.claimStatus || ''), id: c.id, page: 'accidentClients', filter: '' });
    });
    if (results.length === 0) {
        dropdown.innerHTML = `<div class="no-results"><i class="fas fa-search"></i> No results found for "<strong>${query}</strong>"</div>`;
        dropdown.classList.add('show');
        applyGlobalFilter(term);
        return;
    }
    dropdown.innerHTML = results.slice(0, 20).map(r => `<div class="result-item" data-page="${r.page}" data-filter="${r.filter || ''}" data-subfilter="${r.subfilter || ''}" data-id="${r.id || ''}"><span class="result-type">${r.type}</span><span class="result-title">${r.title}</span><span class="result-sub">${r.sub}</span></div>`).join('');
    dropdown.querySelectorAll('.result-item').forEach(el => {
        el.addEventListener('click', function() {
            const page = this.dataset.page;
            const filter = this.dataset.filter;
            const subfilter = this.dataset.subfilter;
            const id = this.dataset.id;
            navigate(page, filter, subfilter);
            dropdown.classList.remove('show');
            if (page === 'cases' && id) setTimeout(() => showCaseDetail(id), 300);
            else if (page === 'clients' && id) setTimeout(() => showClientDetail(id), 300);
            else if (page === 'accidentClients' && id) setTimeout(() => showAccidentClientDetail(id), 300);
            if (page === 'documents') renderDocuments(filter);
            if (page === 'invoices') renderAllInvoices();
            document.getElementById('globalSearchInput').value = '';
            document.getElementById('clearSearchBtn').style.display = 'none';
        });
    });
    dropdown.classList.add('show');
    applyGlobalFilter(term);
}

function showCaseDetail(caseId) {
    if (!canViewPage('cases')) { showToast('Access denied.', 'warning'); return; }
    selectedCaseId = caseId;
    const caseData = casesData.find(c => c.id === caseId);
    if (!caseData) return;
    document.getElementById('casesListView').style.display = 'none';
    document.getElementById('casesDetailView').style.display = 'block';
    const container = document.getElementById('caseDetailContainer');
    let decisionBadge = '';
    if (caseData.decision === 'In our favour') decisionBadge = `<span class="badge favourable">In our favour</span>`;
    else if (caseData.decision === 'Against us') decisionBadge = `<span class="badge against">Against us</span>`;
    else decisionBadge = `<span class="badge gray">Pending</span>`;
    const filedBadge = caseData.filed === true ? `<span class="badge filed"><i class="fas fa-check"></i> Filed ${caseData.filedDate || ''}</span>` : `<span class="badge unfiled">Not Filed</span>`;
    const caseTasks = tasksData.filter(t => t.caseId === caseId);
    const taskHtml = caseTasks.length ? caseTasks.map(t => `<div style="padding:0.3rem 0;border-bottom:1px solid #f1f5f9;"><span class="${t.status === 'Completed' ? 'text-muted' : ''}"><i class="fas fa-tasks" style="color:#3b82f6;margin-right:0.3rem;"></i> ${t.title} <span class="text-muted fs-small">(${t.date} ${t.time})</span>${t.amount > 0 ? ` <span class="badge green">KES ${t.amount}</span>` : ''} <span class="badge priority-${(t.priority || 'Medium').toLowerCase()}">${t.priority}</span>${t.documents && t.documents.length ? ` <span class="badge blue"><i class="fas fa-paperclip"></i> ${t.documents.length}</span>` : ''}</span></div>`).join('') : '<p class="text-muted">No tasks linked to this case.</p>';
    const allActivities = [...(caseData.activities || [])];
    allActivities.sort((a, b) => { const da = a.match(/\d{4}-\d{2}-\d{2}/); const db2 = b.match(/\d{4}-\d{2}-\d{2}/); if (da && db2) return db2[0].localeCompare(da[0]); return 0; });
    let docsHtml = '';
    if (caseData.documents && caseData.documents.length) {
        docsHtml = caseData.documents.map(d => {
            const hasFile = d.fileId && fileStore[d.fileId];
            const masterDoc = documentsData.find(doc => doc.fileId === d.fileId);
            const docId = masterDoc ? masterDoc.id : null;
            const hasBase64 = masterDoc && masterDoc.base64;
            let actions = '';
            if (hasFile || hasBase64) {
                actions += `<button class="btn btn-sm btn-primary download-btn" data-fileid="${d.fileId}" data-filename="${d.name}" style="padding:0.1rem 0.4rem;"><i class="fas fa-download"></i></button>`;
                actions += `<button class="btn btn-sm btn-view view-doc-btn" data-fileid="${d.fileId}" data-filename="${d.name}" style="padding:0.1rem 0.4rem;"><i class="fas fa-eye"></i></button>`;
            } else {
                actions += `<button class="btn btn-sm btn-primary download-btn" data-fileid="${d.fileId}" data-filename="${d.name}" style="padding:0.1rem 0.4rem;"><i class="fas fa-download"></i></button>`;
                actions += `<button class="btn btn-sm btn-view view-doc-btn" data-fileid="${d.fileId}" data-filename="${d.name}" style="padding:0.1rem 0.4rem;"><i class="fas fa-eye"></i></button>`;
            }
            if (canDeleteDocuments()) actions += `<button class="btn btn-sm btn-danger delete-doc-btn" data-fileid="${d.fileId}" data-caseid="${caseData.id}" data-docid="${docId || ''}" data-docname="${d.name}" style="padding:0.1rem 0.4rem;"><i class="fas fa-trash"></i></button>`;
            return `<div style="padding:0.3rem 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem;display:flex;align-items:center;flex-wrap:wrap;gap:0.3rem;"><i class="fas fa-file-pdf" style="color:#ef4444;margin-right:0.3rem;"></i><span style="flex:1;">${d.name}</span><div class="doc-actions">${actions}</div></div>`;
        }).join('');
    } else docsHtml = '<p class="text-muted">No documents linked to this case.</p>';
    const firmNet = getCaseFirmNetFee(caseData);
    container.innerHTML = `
        <div class="case-detail-header">
            <div>
                <div class="case-title">${caseData.name} ${filedBadge}</div>
                <div class="case-meta">
                    <span><i class="fas fa-hashtag"></i> ${caseData.caseNo}</span>
                    <span><i class="fas fa-fingerprint"></i> ${caseData.trackingNo || 'N/A'}</span>
                    <span><i class="fas fa-calendar-alt"></i> Filed: ${caseData.filingDate}</span>
                    <span><i class="fas fa-clock"></i> Age: ${caseData.age || getAge(caseData.filingDate)}</span>
                    <span><i class="fas fa-gavel"></i> ${caseData.area}</span>
                    <span><i class="fas fa-building"></i> ${caseData.courtType || 'N/A'}</span>
                    <span><span class="badge ${caseData.status === 'Active' ? 'green' : caseData.status === 'Closed' ? 'gray' : 'yellow'}">${caseData.status}</span></span>
                    <span><i class="fas fa-quote-right"></i> ${caseData.citation || 'N/A'}</span>
                    <span><i class="fas fa-user"></i> ${caseData.client || 'Unknown Client'}</span>
                </div>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                ${caseData.filed !== true && isFullAccess() ? `<button class="btn btn-success btn-sm" onclick="openMarkCaseFiledModal('${caseData.id}')"><i class="fas fa-stamp"></i> Mark as Filed</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-primary btn-sm" onclick="editCase('${caseData.id}')"><i class="fas fa-edit"></i> Edit</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-danger btn-sm" onclick="deleteCase('${caseData.id}')"><i class="fas fa-trash"></i> Delete</button>` : ''}
                <span class="text-muted fs-small">Partner: ${caseData.partner || 'N/A'}</span>
            </div>
        </div>
        <div class="case-detail-tabs">
            <button class="tab-btn active" data-tab="summary"><i class="fas fa-file-alt"></i> Summary</button>
            <button class="tab-btn" data-tab="activities"><i class="fas fa-list"></i> Activities & Tasks</button>
            <button class="tab-btn" data-tab="parties"><i class="fas fa-users"></i> Parties</button>
            <button class="tab-btn" data-tab="lodging"><i class="fas fa-upload"></i> Lodging</button>
            <button class="tab-btn" data-tab="decision"><i class="fas fa-gavel"></i> Court Decision</button>
            <button class="tab-btn" data-tab="fees"><i class="fas fa-coins"></i> Fees & Expenses</button>
            <button class="tab-btn" data-tab="documents"><i class="fas fa-file-pdf"></i> Documents</button>
        </div>
        <div class="case-detail-body">
            <div class="tab-pane active" id="tab-summary">
                <h4>Case Summary</h4>
                <p>${caseData.summary || 'No summary provided.'}</p>
                <div style="margin-top:0.75rem;display:flex;gap:1.5rem;flex-wrap:wrap;font-size:0.85rem;">
                    <div><strong>Case No:</strong> ${caseData.caseNo}</div>
                    <div><strong>Tracking No:</strong> ${caseData.trackingNo || 'N/A'}</div>
                    <div><strong>Filing Date:</strong> ${caseData.filingDate}</div>
                    <div><strong>Age:</strong> ${caseData.age || getAge(caseData.filingDate)}</div>
                    <div><strong>Status:</strong> <span class="badge ${caseData.status === 'Active' ? 'green' : caseData.status === 'Closed' ? 'gray' : 'yellow'}">${caseData.status}</span></div>
                    <div><strong>Filed:</strong> ${filedBadge}</div>
                    <div><strong>Case Fee:</strong> ${formatCurrency(caseData.caseFee || 0)}</div>
                    <div><strong>Court Fees:</strong> ${formatCurrency(caseData.courtFees || 0)}</div>
                    <div><strong>Firm Net Fee:</strong> ${formatCurrency(firmNet)}</div>
                    <div><strong>Citation:</strong> ${caseData.citation || 'N/A'}</div>
                    <div><strong>Partner:</strong> ${caseData.partner || 'N/A'}</div>
                    <div><strong>Court:</strong> ${caseData.courtType || 'N/A'}</div>
                    <div><strong>Decision:</strong> ${decisionBadge}</div>
                    <div><strong>Client:</strong> ${caseData.client || 'Unknown'}</div>
                </div>
            </div>
            <div class="tab-pane" id="tab-activities">
                <h4>Activity Log & Tasks</h4>
                ${allActivities.length ? allActivities.map(a => `<div style="padding:0.4rem 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem;"><i class="fas fa-circle text-muted" style="font-size:0.4rem;margin-right:0.4rem;"></i> ${a}</div>`).join('') : '<p class="text-muted">No activities recorded.</p>'}
                <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:2px solid #e9edf2;"><h5 style="font-size:0.9rem;">Tasks for this case</h5>${taskHtml}</div>
                ${isFullAccess() ? `<div class="inline-add mt-1"><input type="text" id="newActivityInput" placeholder="New activity..." style="flex:1;"><button class="btn btn-sm btn-primary" id="addActivityBtn"><i class="fas fa-plus"></i> Add</button></div>` : ''}
            </div>
            <div class="tab-pane" id="tab-parties">
                <h4>Parties</h4>
                <div class="party-grid">
                    ${caseData.parties && caseData.parties.length ? caseData.parties.map(p => `<div class="party-card"><div class="party-label">Category</div><div class="party-value">${p.category}</div><div style="margin-top:0.2rem;"><strong>${p.name}</strong></div><div class="text-muted fs-small">${p.firm || 'N/A'}</div></div>`).join('') : '<p class="text-muted">No parties recorded.</p>'}
                </div>
            </div>
            <div class="tab-pane" id="tab-lodging">
                <h4>Lodging – Upload Files</h4>
                ${isFullAccess() ? `<div class="lodging-upload" id="lodgingDropZone"><i class="fas fa-cloud-upload-alt"></i><p><strong>Drop files here</strong> or click to browse</p><input type="file" multiple style="display:none;" id="lodgingFileInput"></div>` : '<p class="text-muted">Upload disabled in read-only mode.</p>'}
                <div style="margin-top:0.75rem;"><h5 style="font-size:0.9rem;">Uploaded Files</h5><div id="lodgingFileList"><p class="text-muted">No files uploaded yet.</p></div></div>
            </div>
            <div class="tab-pane" id="tab-decision">
                <h4>Court Decision</h4>
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap;"><span style="font-weight:600;">Outcome:</span> ${decisionBadge}</div>
                <p>${caseData.decision === 'Pending' ? 'No final decision yet.' : `The court ruled ${caseData.decision.toLowerCase()} on this matter.`}</p>
                ${isFullAccess() ? `<div class="inline-add mt-1"><select id="newDecisionSelect"><option value="Pending">Pending</option><option value="In our favour">In our favour</option><option value="Against us">Against us</option></select><button class="btn btn-sm btn-primary" id="updateDecisionBtn"><i class="fas fa-save"></i> Update</button></div>` : ''}
            </div>
            <div class="tab-pane" id="tab-fees">
                <h4>Fees & Expenses (KES)</h4>
                <div class="client-finance-box">
                    <div class="cf-line"><span>Case Agreed Fee</span><span>${formatCurrency(caseData.caseFee || 0)}</span></div>
                    <div class="cf-line"><span>Court Fees (deducted)</span><span style="color:#8b5cf6;">(${formatCurrency(caseData.courtFees || 0)})</span></div>
                    <div class="cf-line total"><span>Firm Net Fee</span><span>${formatCurrency(firmNet)}</span></div>
                </div>
                <h5 style="font-size:0.9rem;margin-top:0.75rem;">Case-specific expense lines</h5>
                ${(() => {
                    const cl = clientsData.find(c => c.name === caseData.client || c.id === caseData.clientId);
                    const exps = cl && Array.isArray(cl.expenses) ? cl.expenses.filter(e => e.caseId === caseData.id) : [];
                    if (!exps.length) return '<p class="text-muted">No expenses recorded for this case.</p>';
                    return exps.map(e => `<div class="expense-row ${e.type === 'court' || e.category === 'Court Fee' ? 'court' : e.type}"><span class="exp-title">${e.title} <span class="text-muted fs-small">(${e.date})</span></span><span class="exp-amt">${formatCurrency(e.amount)}</span></div>`).join('');
                })()}
            </div>
            <div class="tab-pane" id="tab-documents"><h4>Case Documents</h4>${docsHtml}</div>
        </div>`;
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            container.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            const pane = document.getElementById('tab-' + this.dataset.tab);
            if (pane) pane.classList.add('active');
        });
    });
    const dropZone = document.getElementById('lodgingDropZone');
    const fileInput = document.getElementById('lodgingFileInput');
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#3b82f6'; });
        dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#d1d9e6'; });
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.borderColor = '#d1d9e6'; if (e.dataTransfer.files.length) handleLodgingFiles(e.dataTransfer.files, caseData); });
        fileInput.addEventListener('change', function() { if (this.files.length) { handleLodgingFiles(this.files, caseData); this.value = ''; } });
    }
    async function handleLodgingFiles(files, caseDataRef) {
        const list = document.getElementById('lodgingFileList');
        if (list) list.innerHTML = '';
        for (const f of files) {
            const fileId = 'f' + (++fileStoreId);
            const reader = new FileReader();
            reader.onload = async function(ev) {
                const fileData = ev.target.result;
                fileStore[fileId] = fileData;
                await saveFileToIndexedDB(fileId, fileData);
                if (!caseDataRef.documents) caseDataRef.documents = [];
                caseDataRef.documents.push({ name: f.name, fileId: fileId });
                await addDocumentToFirestore({ name: f.name, category: 'Lodged', matter: caseDataRef.name || 'Case Document', uploaded: getToday(), size: (f.size / 1024).toFixed(1) + ' KB', fileId: fileId, downloadUrl: '', base64: fileData });
                const div = document.createElement('div');
                div.style.padding = '0.3rem 0';
                div.style.borderBottom = '1px solid #f1f5f9';
                div.style.fontSize = '0.85rem';
                let actions = `<button class="btn btn-sm btn-primary download-btn" data-fileid="${fileId}" data-filename="${f.name}" style="padding:0.1rem 0.4rem;"><i class="fas fa-download"></i></button><button class="btn btn-sm btn-view view-doc-btn" data-fileid="${fileId}" data-filename="${f.name}" style="padding:0.1rem 0.4rem;"><i class="fas fa-eye"></i></button>`;
                if (canDeleteDocuments()) actions += `<button class="btn btn-sm btn-danger delete-doc-btn" data-fileid="${fileId}" data-caseid="${caseDataRef.id}" data-docid="" data-docname="${f.name}" style="padding:0.1rem 0.4rem;"><i class="fas fa-trash"></i></button>`;
                div.innerHTML = `<i class="fas fa-file" style="color:#3b82f6;margin-right:0.4rem;"></i> ${f.name} (${(f.size/1024).toFixed(1)} KB) <div class="doc-actions" style="display:inline-flex;gap:0.2rem;margin-left:0.4rem;">${actions}</div>`;
                list.appendChild(div);
                await updateCaseInFirestore(caseDataRef.id, { documents: caseDataRef.documents });
            };
            reader.readAsDataURL(f);
        }
    }
    document.getElementById('addActivityBtn')?.addEventListener('click', function() {
        const input = document.getElementById('newActivityInput');
        if (input && input.value.trim()) {
            const activities = [...(caseData.activities || []), getToday() + ': ' + input.value.trim()];
            updateCaseInFirestore(caseId, { activities });
        }
    });
    document.getElementById('updateDecisionBtn')?.addEventListener('click', function() {
        const select = document.getElementById('newDecisionSelect');
        if (select) updateCaseInFirestore(caseId, { decision: select.value });
    });
}

function showClientDetail(clientId) {
    if (!canViewPage('clients')) { showToast('Access denied.', 'warning'); return; }
    selectedClientId = clientId;
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    document.getElementById('clientsListView').style.display = 'none';
    document.getElementById('clientDetailView').style.display = 'block';
    const container = document.getElementById('clientDetailContainer');
    const clientCases = casesData.filter(c => c.client === client.name || c.clientId === client.id);
    const clientCaseIds = clientCases.map(c => c.id);
    const clientInvoices = invoicesData.filter(inv => inv.clientId === clientId);
    const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + parseInt(inv.amount), 0);
    const outstanding = clientInvoices.filter(inv => inv.status === 'Unpaid' || inv.status === 'Overdue').reduce((sum, inv) => sum + parseInt(inv.amount), 0);
    const fee = getClientFeeBalance(client);
    const expenses = getClientExpenses(client);
    const today = getToday();
    const clientTasks = tasksData.filter(t => t.clientId === clientId || (t.caseId && clientCaseIds.includes(t.caseId)));
       const safeName = (client.name || '').toLowerCase();
    const clientDocs = documentsData.filter(d => (d.matter && safeName && d.matter.toLowerCase().includes(safeName)) || (Array.isArray(client.documents) && client.documents.some(x => x.fileId === d.fileId)));
    let feeHtml = '';
    if (fee.total > 0 || expenses.total > 0) {
        const instRows = (fee.installments || []).map((inst, idx) => {
            const isOverdue = !inst.paid && inst.date && inst.date < today;
            const isDue = !inst.paid && inst.date === today;
            let badge = '<span class="badge green">Paid</span>';
            if (!inst.paid) badge = isOverdue ? '<span class="badge red">Overdue</span>' : isDue ? '<span class="badge yellow">Due Today</span>' : '<span class="badge gray">Scheduled</span>';
            return `<div class="receipt-row"><span>Installment ${idx + 1} – <strong>${inst.date || '—'}</strong></span><span><strong>${formatCurrency(inst.amount)}</strong> ${badge}${!inst.paid ? `<button class="btn btn-teal btn-sm" onclick="openRecordPaymentModal('${client.id}')" title="Pay" style="margin-left:0.3rem;"><i class="fas fa-money-bill-wave"></i></button>` : ''}${!inst.paid ? `<button class="btn btn-success btn-sm" onclick="markInstallmentPaid('${client.id}', ${idx})" title="Mark paid" style="margin-left:0.2rem;"><i class="fas fa-check"></i></button>` : ''}${!inst.paid ? `<button class="btn btn-whatsapp btn-whatsapp-sm" onclick="sendFeeReminderWhatsApp('${client.id}', ${idx})" title="WhatsApp reminder" style="margin-left:0.2rem;"><i class="fab fa-whatsapp"></i></button>` : ''}${!inst.paid ? `<button class="btn btn-sm" style="background:#ea4335;color:#fff;margin-left:0.2rem;" onclick="sendFeeReminderEmail('${client.id}', ${idx})" title="Email reminder"><i class="fas fa-envelope"></i></button>` : ''}</span></div>`;
        }).join('');
        const paymentsHtml = (fee.payments || []).length ? `<div class="payments-history"><h5><i class="fas fa-money-bill-wave" style="color:#14b8a6;"></i> Payment History (${fee.payments.length})</h5><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Notes</th><th style="text-align:center;">Actions</th></tr></thead><tbody>${fee.payments.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(p => `<tr><td>${p.date}</td><td><span class="badge green">${formatCurrency(p.amount)}</span></td><td><span class="badge blue">${p.method || 'N/A'}</span></td><td>${p.reference || '—'}</td><td><span class="text-muted fs-small">${p.notes || '—'}</span></td><td style="text-align:center;white-space:nowrap;">${isFullAccess() ? `<button class="btn btn-danger btn-sm" onclick="deletePayment('${client.id}','${p.id}')" title="Delete payment" style="padding:0.15rem 0.4rem;"><i class="fas fa-trash"></i></button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '';
        const expenseRows = expenses.list.length ? expenses.list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(e => `<div class="expense-row ${e.type === 'court' || e.category === 'Court Fee' ? 'court' : e.type}"><span class="exp-title">${e.title} <span class="text-muted fs-small">(${e.date} · ${e.type === 'firm' ? 'Firm' : (e.type === 'court' || e.category === 'Court Fee') ? 'Court Fee' : 'Client'})</span></span><span class="exp-amt">${formatCurrency(e.amount)}</span>${isFullAccess() ? `<button class="btn btn-danger btn-sm" onclick="deleteExpense('${client.id}','${e.id}')" style="padding:0.1rem 0.4rem;"><i class="fas fa-trash"></i></button>` : ''}</div>`).join('') : '<p class="text-muted fs-small">No expenses recorded.</p>';
        const totalPlusAgreed = fee.total + expenses.clientTotal + expenses.firmTotal + expenses.courtTotal;
        const totalMinusPaid = Math.max(0, totalPlusAgreed - fee.paid);
        feeHtml = `
            <div class="client-finance-box">
                <h4 style="font-size:0.9rem;margin-bottom:0.5rem;"><i class="fas fa-calculator" style="color:#3b82f6;"></i> Financial Summary</h4>
                <div class="cf-line"><span>Agreed Fees</span><span>${formatCurrency(fee.total)}</span></div>
                <div class="cf-line earned"><span>Earned (Filed Cases)</span><span>${formatCurrency(fee.earned)}</span></div>
                <div class="cf-line pending"><span>Pending (Not Yet Filed)</span><span>${formatCurrency(fee.pending)}</span></div>
                <div class="cf-line"><span>Client-side Expenses</span><span style="color:#ef4444;">${formatCurrency(expenses.clientTotal)}</span></div>
                <div class="cf-line"><span>Firm-side Expenses</span><span style="color:#f59e0b;">${formatCurrency(expenses.firmTotal)}</span></div>
                <div class="cf-line"><span>Court Fees (deducted from firm fee)</span><span style="color:#8b5cf6;">${formatCurrency(expenses.courtTotal)}</span></div>
                <div class="cf-line"><span>Total Expenses (all)</span><span>${formatCurrency(expenses.total)}</span></div>
                <div class="cf-line total"><span>Agreed + All Expenses</span><span>${formatCurrency(totalPlusAgreed)}</span></div>
                <div class="cf-line"><span>Paid</span><span style="color:#22c55e;">${formatCurrency(fee.paid)}</span></div>
                <div class="cf-line balance ${totalMinusPaid === 0 ? 'clear' : ''}"><span>Balance (Agreed + Expenses − Paid)</span><span>${formatCurrency(totalMinusPaid)}</span></div>
            </div>
            <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
                ${isFullAccess() ? `<button class="btn btn-teal btn-sm" onclick="openRecordPaymentModal('${client.id}')"><i class="fas fa-money-bill-wave"></i> Record Payment</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-warning btn-sm" onclick="openAddChargeModal('${client.id}')"><i class="fas fa-plus"></i> Add Invoice Line</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-outline btn-sm" onclick="openAddExpenseModal('${client.id}')"><i class="fas fa-receipt"></i> Add Expense</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-outline btn-sm" onclick="editClient('${client.id}')"><i class="fas fa-edit"></i> Edit Fee Agreement</button>` : ''}
            </div>
            <div style="margin-top:0.75rem;">
                <h5 style="font-size:0.85rem;margin-bottom:0.4rem;"><i class="fas fa-receipt"></i> Expense Lines</h5>
                ${expenseRows}
            </div>
            <div style="margin-top:0.75rem;">
                <h5 style="font-size:0.85rem;margin-bottom:0.4rem;"><i class="fas fa-calendar-day"></i> Scheduled Installments</h5>
                ${instRows || '<p class="text-muted fs-small">No installments scheduled.</p>'}
            </div>
            ${paymentsHtml}
        `;
    } else {
        feeHtml = `<div style="margin-bottom:1rem;padding:0.75rem;background:#fef9c3;border-radius:0.5rem;border:1px solid #fef08a;"><i class="fas fa-info-circle"></i> No fee agreement recorded for this client.${isFullAccess() ? `<button class="btn btn-teal btn-sm" onclick="openRecordPaymentModal('${client.id}')" style="margin-left:0.5rem;"><i class="fas fa-money-bill-wave"></i> Record Payment</button>` : ''}${isFullAccess() ? `<button class="btn btn-outline btn-sm" onclick="openAddExpenseModal('${client.id}')" style="margin-left:0.3rem;"><i class="fas fa-receipt"></i> Add Expense</button>` : ''}</div>`;
    }
    const tasksHtml = clientTasks.length ? clientTasks.map(t => {
        const statusClass = t.status === 'Scheduled' ? 'yellow' : t.status === 'Completed' ? 'green' : 'gray';
        return `<div class="client-task-row"><span><strong>${t.title}</strong> <span class="text-muted fs-small">${t.date} ${t.time} — ${t.location || 'N/A'}</span>${t.documents && t.documents.length ? ` <span class="badge blue"><i class="fas fa-paperclip"></i> ${t.documents.length}</span>` : ''}</span><span><span class="badge ${statusClass}">${t.status}</span></span></div>`;
    }).join('') : '<p class="text-muted">No tasks linked to this client.</p>';
    const docReqHtml = (client.docRequests && client.docRequests.length) ? client.docRequests.slice().sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || '')).map(r => {
        const statusClass = r.status === 'received' ? 'green' : r.status === 'cancelled' ? 'gray' : 'yellow';
        return `<div class="doc-request-row"><span><strong>${r.title}</strong> <span class="text-muted fs-small">${r.description || ''}</span> ${r.dueDate ? `<span class="badge gray">Due: ${r.dueDate}</span>` : ''}</span><span><span class="badge ${statusClass}">${r.status}</span> ${r.status === 'received' && r.fileId ? `<button class="btn btn-sm btn-view view-doc-btn" data-fileid="${r.fileId}" data-filename="${r.fileName || r.title}"><i class="fas fa-eye"></i></button>` : ''} ${r.status === 'pending' && isFullAccess() ? `<button class="btn btn-sm btn-success" onclick="openUploadRequestedDocModal('${client.id}','${r.id}')" title="Mark received & upload"><i class="fas fa-upload"></i></button>` : ''} ${r.status === 'pending' && isFullAccess() ? `<button class="btn btn-sm btn-outline" onclick="cancelDocRequest('${client.id}','${r.id}')" title="Cancel"><i class="fas fa-times"></i></button>` : ''}</span></div>`;
    }).join('') : '<p class="text-muted">No document requests yet.</p>';
    const clientDocsHtml = (client.documents && client.documents.length) ? client.documents.map(d => `<div style="padding:0.3rem 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;"><i class="fas fa-paperclip" style="color:#3b82f6;"></i><span style="flex:1;">${d.name}${d.description ? ` <span class="text-muted fs-small">— ${d.description}</span>` : ''}</span><div class="doc-actions"><button class="btn btn-sm btn-primary download-btn" data-fileid="${d.fileId}" data-filename="${d.name}"><i class="fas fa-download"></i></button><button class="btn btn-sm btn-view view-doc-btn" data-fileid="${d.fileId}" data-filename="${d.name}"><i class="fas fa-eye"></i></button>${isFullAccess() ? `<button class="btn btn-sm btn-danger" onclick="deleteClientDocument('${client.id}','${d.fileId}')"><i class="fas fa-trash"></i></button>` : ''}</div></div>`).join('') : '<p class="text-muted">No attached client documents.</p>';
    const casesHtml = clientCases.length ? clientCases.map(c => `<div style="padding:0.3rem 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;"><span><strong>${c.caseNo}</strong> - ${c.name} ${c.filed ? '<span class="badge filed">Filed</span>' : '<span class="badge unfiled">Unfiled</span>'}</span><span><span class="badge ${c.status === 'Active' ? 'green' : c.status === 'Closed' ? 'gray' : 'yellow'}">${c.status}</span><button class="btn btn-outline btn-sm" onclick="showCaseDetail('${c.id}')"><i class="fas fa-chevron-right"></i></button></span></div>`).join('') : '<p class="text-muted">No cases for this client.</p>';
    const invoicesHtml = clientInvoices.length ? clientInvoices.map(inv => `<div style="padding:0.3rem 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;"><span>${inv.description || 'Invoice'} - ${formatCurrency(inv.amount)}</span><span><span class="badge ${inv.status === 'Paid' ? 'green' : inv.status === 'Overdue' ? 'red' : 'yellow'}">${inv.status || 'Unpaid'}</span></span></div>`).join('') : '<p class="text-muted">No invoices for this client.</p>';
    container.innerHTML = `
        <div class="case-detail-header">
            <div>
                <div class="case-title">${client.name}</div>
                ${clientCases.length ? `<div style="font-size:0.8rem;color:#64748b;margin-top:0.2rem;">Case No(s): ${clientCases.map(c => c.caseNo).filter(Boolean).join(' · ')}</div>` : ''}
                <div class="case-meta">
                    <span><i class="fas fa-envelope"></i> ${client.email || 'No email'}</span>
                    <span><i class="fas fa-phone"></i> ${client.phone || 'No phone'}</span>
                    <span><i class="fas fa-map-pin"></i> ${client.address || 'No address'}</span>
                    <span><i class="fas fa-calendar-alt"></i> Since ${client.createdAt || 'N/A'}</span>
                    <span><i class="fas fa-briefcase"></i> ${clientCases.length} cases</span>
                </div>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                ${isFullAccess() ? `<button class="btn btn-teal btn-sm" onclick="openRecordPaymentModal('${client.id}')"><i class="fas fa-money-bill-wave"></i> Payment</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-outline btn-sm" onclick="openAddExpenseModal('${client.id}')"><i class="fas fa-receipt"></i> Expense</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-outline btn-sm" onclick="openAttachClientDocModal('${client.id}')"><i class="fas fa-paperclip"></i> Attach Doc</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-outline btn-sm" onclick="openRequestDocumentModal('${client.id}')"><i class="fas fa-file-circle-plus"></i> Request Doc</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-primary btn-sm" onclick="editClient('${client.id}')"><i class="fas fa-edit"></i> Edit</button>` : ''}
                ${isFullAccess() ? `<button class="btn btn-danger btn-sm" onclick="deleteClient('${client.id}')"><i class="fas fa-trash"></i></button>` : ''}
                <button class="btn btn-success btn-sm" onclick="printClientReport('${client.id}')"><i class="fas fa-print"></i> Print Report</button>
            </div>
        </div>
        <div class="case-detail-body">
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1rem;margin-bottom:1.5rem;">
                <div style="background:#f8fafc;padding:0.75rem;border-radius:0.5rem;border:1px solid #e9edf2;"><div class="text-muted fs-small">Total Invoiced</div><div style="font-size:1.1rem;font-weight:700;">${formatCurrency(totalInvoiced)}</div></div>
                <div style="background:#f8fafc;padding:0.75rem;border-radius:0.5rem;border:1px solid #e9edf2;"><div class="text-muted fs-small">Outstanding</div><div style="font-size:1.1rem;font-weight:700;color:${outstanding > 0 ? '#ef4444' : '#22c55e'};">${formatCurrency(outstanding)}</div></div>
                <div style="background:#f8fafc;padding:0.75rem;border-radius:0.5rem;border:1px solid #e9edf2;"><div class="text-muted fs-small">Earned (Filed)</div><div style="font-size:1.1rem;font-weight:700;color:#22c55e;">${formatCurrency(fee.earned)}</div></div>
                <div style="background:#f8fafc;padding:0.75rem;border-radius:0.5rem;border:1px solid #e9edf2;"><div class="text-muted fs-small">Pending Fees</div><div style="font-size:1.1rem;font-weight:700;color:#f59e0b;">${formatCurrency(fee.pending)}</div></div>
                <div style="background:#f8fafc;padding:0.75rem;border-radius:0.5rem;border:1px solid #e9edf2;"><div class="text-muted fs-small">Fee Balance</div><div style="font-size:1.1rem;font-weight:700;color:${fee.balance > 0 ? '#ef4444' : '#22c55e'};">${formatCurrency(fee.balance)}</div></div>
            </div>
            ${client.notes ? `<div style="margin-bottom:1rem;padding:0.75rem;background:#fef9c3;border-radius:0.5rem;border:1px solid #fef08a;"><strong>Notes:</strong> ${client.notes}</div>` : ''}
            ${feeHtml}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1rem;">
                <div><h4 style="font-size:0.9rem;margin-bottom:0.5rem;"><i class="fas fa-folder-open"></i> Cases (${clientCases.length})</h4>${casesHtml}</div>
                <div><h4 style="font-size:0.9rem;margin-bottom:0.5rem;"><i class="fas fa-file-invoice"></i> Invoices (${clientInvoices.length})</h4>${invoicesHtml}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1rem;">
                <div><h4 style="font-size:0.9rem;margin-bottom:0.5rem;"><i class="fas fa-tasks"></i> Tasks (${clientTasks.length})</h4>${tasksHtml}</div>
                <div><h4 style="font-size:0.9rem;margin-bottom:0.5rem;"><i class="fas fa-file-circle-plus"></i> Document Requests (${(client.docRequests || []).length})</h4>${docReqHtml}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1rem;">
                <div><h4 style="font-size:0.9rem;margin-bottom:0.5rem;"><i class="fas fa-paperclip"></i> Attached Documents (${(client.documents || []).length})</h4>${clientDocsHtml}</div>
                <div><h4 style="font-size:0.9rem;margin-bottom:0.5rem;"><i class="fas fa-file-pdf"></i> All Related Documents (${clientDocs.length})</h4>${clientDocs.length ? clientDocs.map(d => `<div style="padding:0.25rem 0;font-size:0.8rem;"><i class="fas fa-file-pdf" style="color:#ef4444;"></i> ${d.name} <span class="badge">${d.category}</span> <span class="text-muted fs-small">${d.uploaded}</span></div>`).join('') : '<p class="text-muted">None.</p>'}</div>
            </div>
        </div>`;
}

function editCase(caseId) {
    if (!isFullAccess()) { showToast('Read-only users cannot edit cases.', 'warning'); return; }
    const c = casesData.find(c => c.id === caseId);
    if (!c) return;
    document.getElementById('editCaseId').value = c.id;
    document.getElementById('editCaseNo').value = c.caseNo || '';
    document.getElementById('editCaseName').value = c.name || '';
    document.getElementById('editCaseClient').value = c.client || '';
    const select = document.getElementById('editCaseClientSelect');
    if (c.client) { for (let opt of select.options) { if (opt.value === c.client) { select.value = c.client; break; } } }
    document.getElementById('editCaseArea').value = c.area || '';
    document.getElementById('editCaseCourtType').value = c.courtType || '';
    document.getElementById('editCaseStatus').value = c.status || 'Active';
    document.getElementById('editCaseFilingDate').value = c.filingDate || getToday();
    document.getElementById('editCaseTracking').value = c.trackingNo || '';
    document.getElementById('editCaseCitation').value = c.citation || '';
    document.getElementById('editCasePartner').value = c.partner || '';
    document.getElementById('editCaseSummary').value = c.summary || '';
    document.getElementById('editCaseDecision').value = c.decision || 'Pending';
    document.getElementById('editCaseFee').value = c.caseFee || '';
    document.getElementById('editCaseCourtFees').value = c.courtFees || '';
    document.getElementById('editCaseFiled').checked = c.filed === true;
    const fdWrap = document.getElementById('editCaseFiledDateWrap');
    if (c.filed === true) { fdWrap.style.display = 'block'; document.getElementById('editCaseFiledDate').value = c.filedDate || getToday(); } else fdWrap.style.display = 'none';
    openModal('editCaseModal');
}

document.getElementById('editCaseForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const id = document.getElementById('editCaseId').value;
    const clientSelect = document.getElementById('editCaseClientSelect');
    const clientInput = document.getElementById('editCaseClient');
    let clientName = clientInput.value.trim();
    if (clientSelect.value) clientName = clientSelect.value;
    if (!clientName) clientName = 'Unknown Client';
    const filed = document.getElementById('editCaseFiled').checked;
    const updates = {
        caseNo: document.getElementById('editCaseNo').value.trim(),
        name: document.getElementById('editCaseName').value.trim(),
        client: clientName,
        area: document.getElementById('editCaseArea').value,
        courtType: document.getElementById('editCaseCourtType').value,
        status: document.getElementById('editCaseStatus').value,
        filingDate: document.getElementById('editCaseFilingDate').value,
        trackingNo: document.getElementById('editCaseTracking').value.trim(),
        citation: document.getElementById('editCaseCitation').value.trim(),
        partner: document.getElementById('editCasePartner').value.trim(),
        summary: document.getElementById('editCaseSummary').value.trim(),
        decision: document.getElementById('editCaseDecision').value,
        caseFee: parseInt(document.getElementById('editCaseFee').value) || 0,
        courtFees: parseInt(document.getElementById('editCaseCourtFees').value) || 0,
        filed: filed,
        filedDate: filed ? (document.getElementById('editCaseFiledDate').value || getToday()) : null,
        age: getAge(document.getElementById('editCaseFilingDate').value)
    };
    await updateCaseInFirestore(id, updates);
    closeModal('editCaseModal');
    showToast('Case updated successfully!', 'info');
});

async function deleteCase(caseId) {
    if (!isFullAccess()) { showToast('Read-only users cannot delete cases.', 'warning'); return; }
    if (!confirm('Delete this case?')) return;
    await deleteCaseFromFirestore(caseId);
    showToast('Case deleted.', 'info');
    if (selectedCaseId === caseId) {
        document.getElementById('casesDetailView').style.display = 'none';
        document.getElementById('casesListView').style.display = 'block';
        renderCases(currentFilter, currentSubfilter);
    }
}

function editClient(clientId) {
    if (!isFullAccess()) { showToast('Read-only users cannot edit clients.', 'warning'); return; }
    const c = clientsData.find(c => c.id === clientId);
    if (!c) return;
    document.getElementById('editClientId').value = c.id;
    document.getElementById('editClientName').value = c.name || '';
    document.getElementById('editClientEmail').value = c.email || '';
    document.getElementById('editClientPhone').value = c.phone || '';
    document.getElementById('editClientAddress').value = c.address || '';
    document.getElementById('editClientNotes').value = c.notes || '';
    setClientFeeFormValues('editClient', c.feeAgreement || emptyFeeAgreement());
    openModal('editClientModal');
}

async function deleteClient(clientId) {
    if (!isFullAccess()) { showToast('Read-only users cannot delete clients.', 'warning'); return; }
    if (!confirm('Delete this client?')) return;
    await deleteClientFromFirestore(clientId);
    showToast('Client deleted.', 'info');
    if (selectedClientId === clientId) {
        document.getElementById('clientDetailView').style.display = 'none';
        document.getElementById('clientsListView').style.display = 'block';
        renderClients();
    }
}

function editInvoice(invoiceId) {
    if (!isFullAccess()) { showToast('Read-only users cannot edit invoices.', 'warning'); return; }
    const inv = invoicesData.find(i => i.id === invoiceId);
    if (!inv) return;
    document.getElementById('editInvoiceId').value = inv.id;
    document.getElementById('editInvoiceClient').value = inv.clientName || 'Unknown';
    document.getElementById('editInvoiceCase').value = inv.caseName || 'None';
    document.getElementById('editInvoiceAmount').value = inv.amount || 0;
    document.getElementById('editInvoiceDate').value = inv.date || getToday();
    document.getElementById('editInvoiceTerms').value = inv.terms || 30;
    document.getElementById('editInvoiceStatus').value = inv.status || 'Unpaid';
    document.getElementById('editInvoiceDescription').value = inv.description || '';
    openModal('editInvoiceModal');
}

document.getElementById('editInvoiceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isFullAccess()) { showToast('Permission denied.', 'warning'); return; }
    const id = document.getElementById('editInvoiceId').value;
    const updates = {
        amount: parseInt(document.getElementById('editInvoiceAmount').value) || 0,
        date: document.getElementById('editInvoiceDate').value,
        terms: parseInt(document.getElementById('editInvoiceTerms').value) || 30,
        status: document.getElementById('editInvoiceStatus').value,
        description: document.getElementById('editInvoiceDescription').value.trim()
    };
    await updateInvoiceInFirestore(id, updates);
    closeModal('editInvoiceModal');
    showToast('Invoice updated successfully!', 'info');
});

async function deleteInvoice(invoiceId) {
    if (!isFullAccess()) { showToast('Read-only users cannot delete invoices.', 'warning'); return; }
    if (!confirm('Delete this invoice?')) return;
    await deleteInvoiceFromFirestore(invoiceId);
    showToast('Invoice deleted.', 'info');
}

function buildInvoiceHTML(inv) {
    const client = clientsData.find(c => c.id === inv.clientId);
    const clientName = client ? client.name : (inv.clientName || 'Unknown');
    const logo = logoImgTag('height:70px;width:auto;max-width:140px;object-fit:contain;');
    return `
        <div class="invoice-header">
            <div style="display:flex;align-items:center;gap:1rem;">
                ${logo}
                <div><h2 style="margin:0;">INVOICE</h2><div style="font-size:0.8rem;color:#475569;">Kuria Karatu &amp; Company Advocates</div></div>
            </div>
            <div class="company-details"><strong>Kuria Karatu &amp; Company Advocates</strong><br>Ntugi House, 1st flr rm 10, Meru Town<br>Tel: 0725799752 / 0726780451</div>
        </div>
        <div class="invoice-meta">
            <div><strong>Invoice #:</strong> ${inv.invoiceNumber || '#'}</div>
            <div><strong>Client:</strong> ${clientName}</div>
            <div><strong>Case:</strong> ${inv.caseName || 'N/A'}</div>
            <div><strong>Date:</strong> ${inv.date}</div>
            <div><strong>Terms:</strong> ${inv.terms || 30} days</div>
            <div><strong>Status:</strong> ${inv.status || 'Unpaid'}</div>
        </div>
        <table>
            <tr><th>Description</th><th>Amount (KES)</th></tr>
            <tr><td>${inv.description || 'Legal services'}</td><td>${Number(inv.amount).toLocaleString()}</td></tr>
        </table>
        <div class="total-row">Total: KES ${Number(inv.amount).toLocaleString()}</div>
        <div class="footer">Thank you for your business. Payment is due within ${inv.terms || 30} days.</div>`;
}

function viewInvoice(invoiceId) {
    const inv = invoicesData.find(i => i.id === invoiceId);
    if (!inv) { showToast('Invoice not found.', 'error'); return; }
    selectedInvoiceId = invoiceId;
    document.getElementById('viewInvoiceContent').innerHTML = buildInvoiceHTML(inv);
    openModal('viewInvoiceModal');
}

function printInvoiceFromView() { if (!selectedInvoiceId) return; printInvoice(selectedInvoiceId); closeModal('viewInvoiceModal'); }
function shareInvoiceFromView() { if (!selectedInvoiceId) return; shareInvoiceWhatsApp(selectedInvoiceId); }
function emailInvoiceFromView() { if (!selectedInvoiceId) return; shareInvoiceEmail(selectedInvoiceId); }
function downloadInvoiceFromView() { if (!selectedInvoiceId) return; downloadInvoice(selectedInvoiceId); }

function invoiceTextSummary(inv) {
    const client = clientsData.find(c => c.id === inv.clientId);
    const clientName = client ? client.name : (inv.clientName || 'Client');
    const dueDate = new Date(inv.date);
    dueDate.setDate(dueDate.getDate() + (parseInt(inv.terms) || 30));
    return `Dear ${clientName},\n\nPlease find your invoice from Kuria Karatu & Company Advocates.\n\nInvoice No: ${inv.invoiceNumber || '#'}\nCase: ${inv.caseName || 'N/A'}\nDescription: ${inv.description || 'Legal services'}\nAmount: ${formatCurrency(inv.amount)}\nDate: ${inv.date}\nPayment Terms: ${inv.terms || 30} days (due ${dueDate.toISOString().slice(0,10)})\nStatus: ${inv.status || 'Unpaid'}\n\nKindly settle the amount at your earliest convenience.\n\nNtugi House, 1st flr rm 10, Meru Town\nTel: 0725799752 / 0726780451`;
}

function printInvoice(invoiceId) {
    const inv = invoicesData.find(i => i.id === invoiceId);
    if (!inv) { showToast('Invoice not found.', 'error'); return; }
    document.getElementById('printInvoiceContent').innerHTML = buildInvoiceHTML(inv);
    openModal('printInvoiceModal');
}

function shareInvoiceWhatsApp(invoiceId) {
    const inv = invoicesData.find(i => i.id === invoiceId);
    if (!inv) { showToast('Invoice not found.', 'error'); return; }
    const client = clientsData.find(c => c.id === inv.clientId);
    if (!client || !client.phone) { showToast('Client has no phone.', 'warning'); return; }
    sendWhatsApp(client.phone, client.name, invoiceTextSummary(inv));
    logActivity('Shared Invoice via WhatsApp', `${inv.invoiceNumber} → ${client.name}`);
    showToast(`Invoice ${inv.invoiceNumber} shared via WhatsApp.`, 'info');
}

function shareInvoiceEmail(invoiceId) {
    const inv = invoicesData.find(i => i.id === invoiceId);
    if (!inv) { showToast('Invoice not found.', 'error'); return; }
    const client = clientsData.find(c => c.id === inv.clientId);
    if (!client || !client.email) { showToast('Client has no email.', 'warning'); return; }
    sendEmail(client.email, `Invoice ${inv.invoiceNumber || ''} – Kuria Karatu & Company Advocates`, invoiceTextSummary(inv));
    logActivity('Shared Invoice via Email', `${inv.invoiceNumber} → ${client.name}`);
    showToast(`Invoice ${inv.invoiceNumber} shared via Email.`, 'info');
}

function downloadInvoice(invoiceId) {
    const inv = invoicesData.find(i => i.id === invoiceId);
    if (!inv) { showToast('Invoice not found.', 'error'); return; }
    const innerHtml = buildInvoiceHTML(inv);
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.invoiceNumber || ''}</title><style>body{font-family:'Segoe UI',Roboto,sans-serif;padding:2rem;color:#1e293b;background:#fff;}.invoice-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:0.5rem;margin-bottom:1rem;gap:1rem;flex-wrap:wrap;}.invoice-header h2{font-size:1.5rem;font-weight:700;color:#0f172a;margin:0;}.invoice-header .company-details{text-align:right;font-size:0.85rem;color:#475569;}.invoice-logo{height:70px;width:auto;max-width:140px;object-fit:contain;}.invoice-meta{display:flex;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.5rem;}.invoice-meta div{font-size:0.9rem;}table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.9rem;}table th{background:#f1f5f9;padding:0.5rem;text-align:left;border-bottom:1px solid #d1d9e6;}table td{padding:0.5rem;border-bottom:1px solid #e9edf2;}.total-row{font-weight:700;font-size:1.1rem;border-top:2px solid #0f172a;padding-top:0.5rem;text-align:right;}.footer{margin-top:2rem;text-align:center;color:#64748b;font-size:0.75rem;border-top:1px solid #e9edf2;padding-top:1rem;}</style></head><body>${innerHtml}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${(inv.invoiceNumber || inv.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    logActivity('Downloaded Invoice', inv.invoiceNumber || inv.id);
    showToast(`Invoice ${inv.invoiceNumber || ''} downloaded.`, 'info');
}

function updateDashboardStats() {
    if (!isFullAccess()) return;
    const activeCases = casesData.filter(c => c.status === 'Active').length;
    setText('dashActiveCases', activeCases);
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const monthInvoices = invoicesData.filter(inv => { const d = new Date(inv.date); return d.getMonth() === thisMonth && d.getFullYear() === thisYear && inv.status === 'Paid'; });
    const invRevenue = monthInvoices.reduce((sum, inv) => sum + parseInt(inv.amount), 0);
    const filedEarned = casesData.filter(c => c.filed === true).reduce((s, c) => s + (parseInt(c.caseFee) || 0), 0);
    setText('dashRevenue', formatCurrency(filedEarned + invRevenue));
    let pending = 0;
    clientsData.forEach(c => { pending += getClientPendingFees(c); });
    setText('dashPendingFees', formatCurrency(pending));
    setText('dashActiveClients', clientsData.length);
       
    const filedThisYear = casesData.filter(c => {
        if (c.filed !== true) return false;
        const d = new Date(c.filedDate || c.filingDate);
        return d.getFullYear() === thisYear;
    }).length;
    setText('dashFiledCases', filedThisYear);
        /* ---- HERO BANNER ---- */
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    setText('dashGreeting', greeting);
      /* ---- Greeting name: hard-coded for the three built-in accounts ---- */
    let displayName = 'Counsel';
    const emailLower = (currentUserEmail || '').toLowerCase();

    if (emailLower === 'admin@kuriakaratu.com') {
        displayName = 'Counsel';
    } else if (emailLower === 'developer@kuriakaratu.com') {
        displayName = 'Cliff';
    } else if (emailLower === 'clerk@kuriakaratu.com') {
        displayName = 'Clerk';
    } else if (emailLower) {
        // Any other user — use their email prefix, prettified
        const prefix = emailLower.split('@')[0]
            .replace(/[._-]+/g, ' ')           // jane.doe → jane doe
            .split(' ')
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');                         // → "Jane Doe"
        displayName = prefix || 'Counsel';
    }

    setText('dashUserName', displayName);
    setText('dashToday', now.toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));

    const todayStr = now.toISOString().slice(0,10);
    const todaysTasks = tasksData.filter(t => t.date === todayStr && t.status === 'Scheduled').length;
    setText('dashHeroTasks', todaysTasks);
    setText('dashHeroPending', formatCurrency(pending));
    setText('dashHeroCases', activeCases);
        /* ---- RECENT ACTIVITY FEED ---- */
    const feedEl = document.getElementById('dashRecentActivity');
    if (feedEl && activityLogs && activityLogs.length) {
        const recent = activityLogs.slice(0, 6);
        feedEl.innerHTML = recent.map(log => {
            const initial = (log.user || '?').charAt(0).toUpperCase();
            const time = (log.timestamp || '').slice(5, 16); // "MM-DD HH:MM"
            return `
                <div class="dash-feed-row" style="display:flex;gap:0.85rem;padding:0.75rem 0;border-bottom:1px solid var(--paper-2);align-items:flex-start;">
                    <div style="flex-shrink:0;width:36px;height:36px;border-radius:8px;background:var(--paper-2);color:var(--ink);font-family:var(--font-serif);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:0.95rem;">${initial}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-family:var(--font-sans);font-weight:600;font-size:0.85rem;color:var(--ink);">${log.action}</div>
                        ${log.detail ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:0.15rem;overflow:hidden;text-overflow:ellipsis;">${log.detail}</div>` : ''}
                    </div>
                    <div style="flex-shrink:0;font-family:var(--font-mono);font-size:0.62rem;color:var(--muted);white-space:nowrap;padding-top:0.35rem;">${time}</div>
                </div>`;
        }).join('');
    } else if (feedEl) {
        feedEl.innerHTML = '<p class="text-muted" style="padding:1rem 0;margin:0;">No recent activity.</p>';
    }
}

function updateTaskPriorityStats() {
    if (!isFullAccess()) return;
    const scheduled = tasksData.filter(t => t.status === 'Scheduled');
    setText('dashTotalTasks', scheduled.length);
    setText('dashHighCount', scheduled.filter(t => t.priority === 'High').length);
    setText('dashMedCount', scheduled.filter(t => t.priority === 'Medium').length);
    setText('dashLowCount', scheduled.filter(t => t.priority === 'Low').length);
    setText('dashTaskChange', scheduled.length);
}

function renderUpcomingTasks() {
    if (!isFullAccess()) return;
    const container = $('dashboardUpcomingTasks');
    if (!container) return;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const upcoming = tasksData.filter(t => t.date >= today && t.status === 'Scheduled').sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 8);
    if (!upcoming.length) { container.innerHTML = '<p class="text-muted" style="padding:1rem 0;">No upcoming tasks scheduled.</p>'; return; }
    let html = `<div style="display:flex;flex-direction:column;gap:0.3rem;">`;
    upcoming.forEach(t => {
        const priorityClass = (t.priority || 'Medium').toLowerCase();
        const clientName = t.clientName ? ` · <span class="text-muted fs-small"><i class="fas fa-user"></i> ${t.clientName}</span>` : '';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;border-bottom:1px solid #f1f5f9;flex-wrap:wrap;gap:0.3rem;"><div><span class="badge priority-${priorityClass}">${t.priority}</span> <strong>${t.title}</strong> <span class="text-muted fs-small">${t.date} ${t.time}</span> ${t.amount > 0 ? `<span class="badge green">KES ${t.amount}</span>` : ''}${clientName}</div><span class="text-muted fs-small">${t.caseName || 'General'}</span></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function checkNotifications() {
    if (!isFullAccess()) return;
    const banner = $('notificationBanner');
    const list = $('notificationList');
    if (!banner || !list) return;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const upcoming = tasksData.filter(t => t.date >= today && t.status === 'Scheduled').sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 5);
    const feeAlerts = [];
    clientsData.forEach(c => {
        const fa = c.feeAgreement;
        if (!fa || !Array.isArray(fa.installments)) return;
        fa.installments.forEach((inst, idx) => {
            if (inst.paid) return;
            if (!inst.date) return;
            if (inst.date <= today) feeAlerts.push({ client: c, inst: inst, idx: idx, overdue: inst.date < today });
        });
    });
    if (upcoming.length === 0 && feeAlerts.length === 0) { banner.style.display = 'none'; return; }
    banner.style.display = 'block';
    const hasUrgent = upcoming.some(t => t.priority === 'High') || feeAlerts.some(f => f.overdue);
    if (hasUrgent) banner.classList.add('urgent'); else banner.classList.remove('urgent');
    let html = upcoming.map(t => `<div class="notif-item"><span class="notif-dismiss" onclick="this.parentElement.remove(); if(document.getElementById('notificationList').children.length===0) document.getElementById('notificationBanner').style.display='none';">&times;</span><span class="badge priority-${(t.priority || 'Medium').toLowerCase()}">${t.priority}</span> <strong>${t.title}</strong> <span class="notif-time">${t.date} ${t.time}</span> ${t.amount > 0 ? `<span class="badge green">KES ${t.amount}</span>` : ''}</div>`).join('');
    html += feeAlerts.map(f => `<div class="notif-item" style="background:${f.overdue ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'};border-radius:0.4rem;padding:0.4rem 0.5rem;margin-top:0.2rem;"><span class="badge ${f.overdue ? 'red' : 'yellow'}">${f.overdue ? 'Overdue Fee' : 'Fee Due Today'}</span> <strong>${f.client.name}</strong> <span class="notif-time">Installment ${f.idx + 1} – ${formatCurrency(f.inst.amount)} due ${f.inst.date}</span> <button class="btn btn-whatsapp btn-whatsapp-sm" onclick="sendFeeReminderWhatsApp('${f.client.id}', ${f.idx})"><i class="fab fa-whatsapp"></i></button> <button class="btn btn-sm" style="background:#ea4335;color:#fff;" onclick="sendFeeReminderEmail('${f.client.id}', ${f.idx})"><i class="fas fa-envelope"></i></button></div>`).join('');
    list.innerHTML = html;
}

function renderCalendar() {
    if (!canViewPage('calendar')) return;
    const grid = document.getElementById('calendarGrid');
    const monthYear = document.getElementById('calMonthYear');
    monthYear.textContent = getMonthName(calMonth) + ' ' + calYear;
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const events = {};
    tasksData.filter(t => { const d = new Date(t.date); return d.getMonth() === calMonth && d.getFullYear() === calYear && t.status === 'Scheduled'; }).forEach(t => {
        if (!events[t.date]) events[t.date] = [];
        const type = t.caseId ? 'court' : 'general-task';
        events[t.date].push({ ...t, type });
    });
    let html = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => html += `<div class="cal-header">${d}</div>`);
    const totalCells = firstDay + daysInMonth;
    const rows = Math.ceil(totalCells / 7);
    let day = 1;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 7; c++) {
            const index = r * 7 + c;
            if (index < firstDay || day > daysInMonth) { html += `<div class="cal-day empty"></div>`; continue; }
            const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isToday = dateStr === todayStr;
            const dayEvents = events[dateStr] || [];
            html += `<div class="cal-day${isToday ? ' today' : ''}" style="${isToday ? 'background:#dbeafe;border-color:#3b82f6;' : ''}"><div class="day-num">${day}</div>${dayEvents.slice(0,3).map(e => `<div class="event ${e.type}">${e.title}</div>`).join('')}${dayEvents.length > 3 ? `<div class="event" style="background:#e9edf2;color:#475569;">+${dayEvents.length-3} more</div>` : ''}</div>`;
            day++;
        }
    }
    grid.innerHTML = html;
    const eventsBody = document.getElementById('calendarEventsBody');
    const allUpcoming = tasksData.filter(t => t.status === 'Scheduled').sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 15);
    if (!allUpcoming.length) { eventsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#64748b;padding:1rem;">No upcoming events.</td></tr>`; }
    else {
        eventsBody.innerHTML = allUpcoming.map(t => `<tr><td>${t.date}</td><td><strong>${t.title}</strong> ${t.amount > 0 ? `<span class="badge green">KES ${t.amount}</span>` : ''}</td><td>${t.caseName || 'General'}${t.clientName ? ' · ' + t.clientName : ''}</td><td><span class="badge priority-${(t.priority || 'Medium').toLowerCase()}">${t.priority}</span></td></tr>`).join('');
    }
}

function populateTaskCaseDropdown() {
    if (!isFullAccess()) return;
    const select = document.getElementById('taskCase');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">General (No Case)</option>';
    casesData.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.caseNo + ' - ' + c.name; select.appendChild(o); });
    if (currentValue) select.value = currentValue;
}

function populateTaskClientDropdown() {
    if (!isFullAccess()) return;
    const select = document.getElementById('taskClient');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">No specific client</option>';
    clientsData.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; select.appendChild(o); });
    if (currentValue) select.value = currentValue;
}

function populateTaskFilters() {
    const select = document.getElementById('taskFilterCase');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All</option><option value="general">General</option>';
    casesData.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.caseNo + ' - ' + c.name; select.appendChild(o); });
    if (currentValue) select.value = currentValue;
}

function populateCaseClientDropdowns() {
    if (!isFullAccess()) return;
    const selects = [document.getElementById('caseClientSelect'), document.getElementById('editCaseClientSelect')];
    selects.forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Select existing client...</option>';
        clientsData.forEach(c => { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; sel.appendChild(o); });
        if (currentVal) sel.value = currentVal;
    });
}

function populateInvoiceClientDropdown() {
    if (!isFullAccess()) return;
    const select = document.getElementById('invoiceClient');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Select a client...</option>';
    clientsData.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; select.appendChild(o); });
    if (currentVal) select.value = currentVal;
}

let chartsInitialized = false;
function initCharts() {
    if (chartsInitialized) return;
    if (!isFullAccess()) return;
    chartsInitialized = true;
    try {
        const ctx1 = document.getElementById('dashChart1')?.getContext('2d');
        if (ctx1) new Chart(ctx1, { type: 'doughnut', data: { labels: ['Litigation', 'Corporate', 'Estate'], datasets: [{ data: [45, 30, 25], backgroundColor: ['#3b82f6', '#8b5cf6', '#22c55e'], borderWidth: 0 }] }, options: { responsive: true } });
        const ctx2 = document.getElementById('dashChart2')?.getContext('2d');
        if (ctx2) new Chart(ctx2, { type: 'bar', data: { labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'], datasets: [{ label: 'Hours', data: [180,210,190,240,220,260,280,342], backgroundColor: '#60a5fa', borderRadius: 6 }] } });
        const ctx3 = document.getElementById('reportsChart1')?.getContext('2d');
        if (ctx3) new Chart(ctx3, { type: 'line', data: { labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'], datasets: [{ label: 'Revenue (KES k)', data: [82,78,95,110,105,130,145,128], borderColor: '#3b82f6', tension: 0.2 }] } });
        const ctx4 = document.getElementById('reportsChart2')?.getContext('2d');
        if (ctx4) {
            const counts = {};
            casesData.forEach(c => { counts[c.area] = (counts[c.area] || 0) + 1; });
            new Chart(ctx4, { type: 'bar', data: { labels: Object.keys(counts), datasets: [{ label: 'Cases', data: Object.values(counts), backgroundColor: ['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316'], borderRadius: 6 }] } });
        }
    } catch (e) { console.warn('Charts error:', e); }
}
function updateCharts() { if (!chartsInitialized && isFullAccess()) setTimeout(initCharts, 200); }

function initApp() {
    if (!currentUser) return;
    listenClients();
    listenInvoices();
    listenCases();
    listenDocuments();
    listenDocSections();
    listenTasks();
    listenTargets();
    listenReceipts();
    listenActivity();
    listenUsers();
    listenPortalRequests();
    listenPortalAccounts();
    listenAccidentClients();
    if (isFullAccess()) {
        populateTaskCaseDropdown();
        populateTaskClientDropdown();
        populateCaseClientDropdowns();
        document.getElementById('taskDate').value = getToday();
        document.getElementById('clientDepositDate').value = getToday();
        renderInstallmentRows('client', 0, []);
        renderInstallmentRows('editClient', 0, []);
        navigate('dashboard', '', '');
        setTimeout(initCharts, 400);
    } else {
        navigate('documents', '', '');
    }
    if (isFullAccess()) {
        if (reminderInterval) clearInterval(reminderInterval);
        reminderInterval = setInterval(checkAndSendReminders, 14 * 24 * 60 * 60 * 1000);
        setTimeout(checkAndSendReminders, 3000);
        if (taskReminderInterval) clearInterval(taskReminderInterval);
        taskReminderInterval = setInterval(checkTaskReminders, 30000);
        setTimeout(checkTaskReminders, 5000);
        if (feeReminderInterval) clearInterval(feeReminderInterval);
        feeReminderInterval = setInterval(checkFeeReminders, 60000);
        setTimeout(checkFeeReminders, 6000);
    }
}

db.collection('portalRequests').where('status', '==', 'pending').onSnapshot(snap => {
    const count = snap.size;
    const badge = document.getElementById('portalRequestsBadge');
    if (badge) { if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; } else badge.style.display = 'none'; }
    snap.docChanges().forEach(change => {
        if (change.type === 'added' && currentUser) {
            const r = change.doc.data();
            showToast(`New portal signup: ${r.name || r.email}`, 'warning', 8000);
        }
    });
});

function printClientReport(clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) { showToast('Client not found.', 'error'); return; }
    const clientCases = casesData.filter(c => c.client === client.name || c.clientId === client.id);
    const clientInvoices = invoicesData.filter(inv => inv.clientId === clientId);
    const fee = getClientFeeBalance(client);
    const exp = getClientExpenses(client);
    const totalInvoiced = clientInvoices.reduce((s, i) => s + (parseInt(i.amount)||0), 0);
    const outstanding = clientInvoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + (parseInt(i.amount)||0), 0);
    const clientTasks = tasksData.filter(t => t.clientId === clientId || (t.caseId && clientCases.some(c => c.id === t.caseId)));
    const clientDocs = documentsData.filter(d => (Array.isArray(client.documents) && client.documents.some(x => x.fileId === d.fileId)) || (d.matter && d.matter.toLowerCase().includes(client.name.toLowerCase())));
    const win = window.open('', '_blank');
    const expenseRows = exp.list.length ? exp.list.map(e => `<tr><td>${e.date}</td><td>${e.title}</td><td>${e.type === 'firm' ? 'Firm' : (e.type === 'court' || e.category === 'Court Fee') ? 'Court Fee' : 'Client'}</td><td>${formatCurrency(e.amount)}</td></tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">None</td></tr>`;
    win.document.write(`<!DOCTYPE html><html><head><title>Client Report — ${client.name}</title><style>body{font-family:'Segoe UI',sans-serif;padding:2rem;color:#1e293b;max-width:1000px;margin:auto;}h1{color:#0f172a;border-bottom:3px solid #3b82f6;padding-bottom:.5rem;}h2{color:#0f172a;margin-top:2rem;font-size:1.1rem;border-bottom:1px solid #e2e8f0;padding-bottom:.3rem;}.header{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;background:#f8fafc;padding:1rem;border-radius:.5rem;border:1px solid #e2e8f0;margin:1rem 0;}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin:1rem 0;}.card{background:#f8fafc;padding:1rem;border-radius:.5rem;border:1px solid #e2e8f0;}.card .l{font-size:.7rem;text-transform:uppercase;color:#64748b;font-weight:600;}.card .v{font-size:1.2rem;font-weight:700;margin-top:.2rem;}table{width:100%;border-collapse:collapse;margin:.75rem 0;font-size:.85rem;}th{background:#f1f5f9;text-align:left;padding:.5rem;font-size:.72rem;text-transform:uppercase;color:#475569;}td{padding:.5rem;border-bottom:1px solid #f1f5f9;}.footer{margin-top:2rem;text-align:center;color:#64748b;font-size:.75rem;border-top:1px solid #e2e8f0;padding-top:1rem;}</style></head><body><h1>⚖ Kuria Karatu &amp; Company Advocates — Client Report</h1><p style="color:#64748b;">Generated ${new Date().toLocaleString()} by ${currentUserEmail}</p><div class="header"><div><div style="font-size:1.3rem;font-weight:700;">${client.name}</div>${clientCases.length ? `<div>Case No(s): ${clientCases.map(c=>c.caseNo).filter(Boolean).join(' · ')}</div>` : ''}<div>Email: ${client.email||'—'} · Phone: ${client.phone||'—'}</div><div>Address: ${client.address||'—'}</div></div><div style="text-align:right;font-size:.8rem;color:#475569;"><strong>Ntugi House, 1st flr rm 10, Meru Town</strong><br>Tel: 0725799752 / 0726780451</div></div><div class="summary"><div class="card"><div class="l">Agreed Fees</div><div class="v">${formatCurrency(fee.total)}</div></div><div class="card"><div class="l">Earned (Filed)</div><div class="v" style="color:#22c55e;">${formatCurrency(fee.earned)}</div></div><div class="card"><div class="l">Pending</div><div class="v" style="color:#f59e0b;">${formatCurrency(fee.pending)}</div></div><div class="card"><div class="l">Paid</div><div class="v" style="color:#22c55e;">${formatCurrency(fee.paid)}</div></div><div class="card"><div class="l">Client Expenses</div><div class="v" style="color:#ef4444;">${formatCurrency(exp.clientTotal)}</div></div><div class="card"><div class="l">Firm Expenses</div><div class="v" style="color:#f59e0b;">${formatCurrency(exp.firmTotal)}</div></div><div class="card"><div class="l">Court Fees</div><div class="v" style="color:#8b5cf6;">${formatCurrency(exp.courtTotal)}</div></div><div class="card"><div class="l">Balance</div><div class="v" style="color:${fee.balance>0?'#ef4444':'#22c55e'};">${formatCurrency(fee.balance)}</div></div></div><h2>Expenses</h2><table><thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Amount</th></tr></thead><tbody>${expenseRows}</tbody></table><h2>Cases (${clientCases.length})</h2><table><thead><tr><th>Case No.</th><th>Name</th><th>Filed</th><th>Status</th></tr></thead><tbody>${clientCases.length ? clientCases.map(c=>`<tr><td>${c.caseNo||'—'}</td><td>${c.name||'—'}</td><td>${c.filed?'Yes ('+(c.filedDate||'')+')':'No'}</td><td>${c.status||'—'}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">None</td></tr>'}</tbody></table><h2>Invoices (${clientInvoices.length})</h2><table><thead><tr><th>Invoice #</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>${clientInvoices.length ? clientInvoices.map(i=>`<tr><td>${i.invoiceNumber||'#'}</td><td>${i.description||'—'}</td><td>${formatCurrency(i.amount)}</td><td>${i.status||'Unpaid'}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">None</td></tr>'}</tbody></table><h2>Tasks (${clientTasks.length})</h2><table><thead><tr><th>Title</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>${clientTasks.length ? clientTasks.map(t=>`<tr><td>${t.title}</td><td>${t.date||'—'}</td><td>${t.time||'—'}</td><td>${t.status||'—'}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">None</td></tr>'}</tbody></table><h2>Documents (${clientDocs.length})</h2><table><thead><tr><th>File</th><th>Category</th><th>Matter</th><th>Uploaded</th></tr></thead><tbody>${clientDocs.length ? clientDocs.map(d=>`<tr><td>${d.name||'—'}</td><td>${d.category||'—'}</td><td>${d.matter||'—'}</td><td>${d.uploaded||'—'}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">None</td></tr>'}</tbody></table><div class="footer">Computer-generated client report.<br>Kuria Karatu &amp; Company Advocates</div><script>setTimeout(()=>window.print(),400);<\/script></body></html>`);
    win.document.close();
}
window.printClientReport = printClientReport;

window.showCaseDetail = showCaseDetail;
window.showClientDetail = showClientDetail;
window.editCase = editCase;
window.deleteCase = deleteCase;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.editInvoice = editInvoice;
window.deleteInvoice = deleteInvoice;
window.viewInvoice = viewInvoice;
window.printInvoice = printInvoice;
window.printInvoiceFromView = printInvoiceFromView;
window.shareInvoiceFromView = shareInvoiceFromView;
window.emailInvoiceFromView = emailInvoiceFromView;
window.downloadInvoiceFromView = downloadInvoiceFromView;
window.shareInvoiceWhatsApp = shareInvoiceWhatsApp;
window.shareInvoiceEmail = shareInvoiceEmail;
window.downloadInvoice = downloadInvoice;
window.sendWhatsApp = sendWhatsApp;
window.closeModal = closeModal;
window.openModal = openModal;
window.deleteDocument = deleteDocument;
window.openEditTargets = openEditTargets;
window.markInvoicePaid = markInvoicePaid;
window.sendPaymentReminder = sendPaymentReminder;
window.viewReceipt = viewReceipt;
window.deleteReceipt = deleteReceipt;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.markInstallmentPaid = markInstallmentPaid;
window.sendFeeReminderWhatsApp = sendFeeReminderWhatsApp;
window.sendFeeReminderEmail = sendFeeReminderEmail;
window.renderFees = renderFees;
window.openRecordPaymentModal = openRecordPaymentModal;
window.openAddChargeModal = openAddChargeModal;
window.fillFullBalance = fillFullBalance;
window.deletePayment = deletePayment;
window.showAccidentClientDetail = showAccidentClientDetail;
window.editAccidentClient = editAccidentClient;
window.deleteAccidentClient = deleteAccidentClient;
window.openAddAdvanceModal = openAddAdvanceModal;
window.editAdvance = editAdvance;
window.deleteAdvance = deleteAdvance;
window.openStatementModal = openStatementModal;
window.printAccStatementModal = printAccStatementModal;
window.printAccidentClientReport = printAccidentClientReport;
window.renderAccidentClients = renderAccidentClients;
window.openAddAccidentClientModal = openAddAccidentClientModal;
window.openApprovePortalModal = openApprovePortalModal;
window.confirmApprovePortal = confirmApprovePortal;
window.rejectPortalRequest = rejectPortalRequest;
window.deletePortalRequest = deletePortalRequest;
window.openChangePortalLinkModal = openChangePortalLinkModal;
window.confirmChangePortalLink = confirmChangePortalLink;
window.revokePortalAccess = revokePortalAccess;
window.loadPortalRequests = loadPortalRequests;
window.openAddExpenseModal = openAddExpenseModal;
window.deleteExpense = deleteExpense;
window.openRequestDocumentModal = openRequestDocumentModal;
window.openUploadRequestedDocModal = openUploadRequestedDocModal;
window.cancelDocRequest = cancelDocRequest;
window.openAttachClientDocModal = openAttachClientDocModal;
window.deleteClientDocument = deleteClientDocument;
window.openMarkCaseFiledModal = openMarkCaseFiledModal;

window.openEfilingModal = openEfilingModal;
window.openManageSectionsModal = openManageSectionsModal;
window.openFolderUploadModal = openFolderUploadModal;
window.addTopSection = addTopSection;
window.renameSection = renameSection;
window.deleteSection = deleteSection;
window.moveSection = moveSection;
window.addSubSection = addSubSection;
window.renameSubSection = renameSubSection;
window.deleteSubSection = deleteSubSection;
window.moveSubSection = moveSubSection;
window.reAutoDetectAll = reAutoDetectAll;
window.commitFolderUpload = commitFolderUpload;
window.onDocCategoryChange = onDocCategoryChange;

window.openEditDocClassify = openEditDocClassify;
window.onEditDocSectionChange = onEditDocSectionChange;
window.saveEditedDocClassify = saveEditedDocClassify;
window.onFolderRowSectionChange = onFolderRowSectionChange;
window.onFolderRowSubChange = onFolderRowSubChange;
window.onFolderRowNewSubTyped = onFolderRowNewSubTyped;
window.bulkAssignSectionPrompt = bulkAssignSectionPrompt;
window.bulkAssignSubPrompt = bulkAssignSubPrompt;

// ============================================================
// SAFE FALLBACK BINDINGS — prevent crashes on missing elements
// ============================================================
(function safeBindRemaining() {
    // These are already bound above; this block only ensures any
    // elements that were missed don't crash the page.
    const ids = [
        'manageSectionsBtn','uploadFolderBtn','folderFileInput','folderCategory',
        'addUserBtn','addUserForm','editUserForm','recordPaymentForm',
        'addChargeForm','addExpenseForm','requestDocumentForm','uploadRequestedDocForm',
        'attachClientDocForm','markCaseFiledForm','editTargetsForm','generateReceiptForm',
        'addClientForm','editClientForm','addInvoiceForm','addCaseForm','addDocForm',
        'addTaskForm','addAccidentClientForm','editAccidentClientForm',
        'addAdvanceForm','editAdvanceForm','editCaseForm','editInvoiceForm',
        'tasksTable','clientInstallmentCount','editClientInstallmentCount',
        'invoiceClient','caseFiled','editCaseFiled','logoFileInput','saveLogoBtn',
        'removeLogoBtn','firmSettingsForm','taskFilterCase','taskFilterStatus',
        'calPrevMonth','calNextMonth','calTodayBtn','sidebarToggle','sidebarOverlay',
        'globalSearchInput','clearSearchBtn','addCaseBtn','addClientBtn',
        'addGlobalInvoiceBtn','addDocBtn','backToCasesList','backToClientsList',
        'backToAccList','generateReceiptBtn','sendAllDueRemindersBtn',
        'refreshTargetsBtn','clearActivityLog'
    ];
    // Nothing to do — the earlier code already uses these; this just
    // documents the set of elements that MUST exist in the HTML for
    // the app to function. If any are missing, the corresponding
    // event handler will silently no-op instead of throwing.
})();
// Expose live data to the standalone sidebar counter script
window.KKData = () => ({
  cases: casesData,
  documents: documentsData,
  clients: clientsData,
  invoices: invoicesData,
  tasks: tasksData,
  receipts: receiptsData,
  targets: targetsData,
  users: usersData,
  accidentClients: accidentClientsData,
  activityLogs: activityLogs,
  portalRequests: portalRequestsData,
  portalAccounts: portalAccountsData,
  practiceAreas: PRACTICE_AREAS,
  docSections: docSections
});
restoreFileStoreFromPersistence();
loadCompanyLogoFromFirestore();
setTimeout(() => { if (currentUser && isFullAccess()) { updateAccidentSummary(); } }, 1500);

console.log('Kuria Karatu & Company Advocates System Loaded');
})();      
   
