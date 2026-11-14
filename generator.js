
/* ============================================================
   KK ADVOCATES — DOCUMENT GENERATOR
   Message 2 — Data Layer
   Firebase · Firestore · localStorage · Ref numbers · Helpers
   ============================================================ */

(function bootstrapDocGen() {
    'use strict';

    /* ==========================================================
       0. ENVIRONMENT
       ========================================================== */
    const PARAMS   = new URLSearchParams(window.location.search);
    const EMBEDDED = PARAMS.get('embedded') === '1';
    const FIRM_ID  = PARAMS.get('firm') || 'kuriakaratu-b5c90';
    const IS_FRAME = window.top !== window.self;

    /* ==========================================================
       1. DOM HELPERS
       ========================================================== */
    const $  = (id) => document.getElementById(id);
    const $$ = (sel, root) => (root || document).querySelectorAll(sel);
    const el = (tag, attrs, children) => {
        const n = document.createElement(tag);
        if (attrs) {
            for (const k in attrs) {
                if (k === 'class') n.className = attrs[k];
                else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(n.style, attrs[k]);
                else if (k === 'dataset' && typeof attrs[k] === 'object') Object.assign(n.dataset, attrs[k]);
                else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
                else n.setAttribute(k, attrs[k]);
            }
        }
        if (children) {
            (Array.isArray(children) ? children : [children]).forEach(c => {
                if (c == null) return;
                n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
            });
        }
        return n;
    };
    const setText = (id, val) => { const n = $(id); if (n) n.textContent = val; };
    const setHtml = (id, val) => { const n = $(id); if (n) n.innerHTML  = val; };
    const setVal  = (id, val) => { const n = $(id); if (n) n.value = val; };
    const getVal  = (id) => { const n = $(id); return n ? n.value : ''; };
    const getChecked = (id) => { const n = $(id); return n ? !!n.checked : false; };
    const bindClick  = (id, fn) => { const n = $(id); if (n) n.addEventListener('click', fn); };
    const bindInput  = (id, fn) => { const n = $(id); if (n) n.addEventListener('input', fn); };
    const bindChange = (id, fn) => { const n = $(id); if (n) n.addEventListener('change', fn); };
    const bindSubmit = (id, fn) => { const n = $(id); if (n) n.addEventListener('submit', fn); };

    /* ==========================================================
       2. DATE / FORMAT HELPERS
       ========================================================== */
    const pad = (n, w) => String(n).padStart(w || 2, '0');
    function getToday() { return new Date().toISOString().slice(0, 10); }
    function getDateTime() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

    function formatLongDate(dateStr) {
        if (!dateStr) return '';
        const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        return `${d.getDate()}${ordinal(d.getDate())} day of ${months[d.getMonth()]}, ${d.getFullYear()}`;
    }
    function ordinal(n) {
        const s = ['th','st','nd','rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }
    function formatMoney(n) {
        n = Number(n) || 0;
        return n.toLocaleString('en-KE', { maximumFractionDigits: 0 });
    }
    function formatMoneyKes(n) { return 'KES ' + formatMoney(n); }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function slug(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    function titleCase(s) {
        return String(s || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }

    /* ==========================================================
       3. FIRM CONSTANTS + FALLBACK LOGO
       ========================================================== */
    const FIRM_DEFAULTS = {
        name:    'Kuria Karatu & Company Advocates',
        address: 'Ntugi House, 1st floor room 10, Meru Town',
        phone:   '0725799752 / 0726780451',
        email:   'managingpartner@kuriakaratuadvocates.co.ke',
        website: 'www.kuriakaratuadvocates.co.ke'
    };

    const DEFAULT_LOGO_SVG =
        'data:image/svg+xml;utf8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
            '<circle cx="80" cy="80" r="74" fill="#0b1220"/>' +
            '<circle cx="80" cy="80" r="72" fill="none" stroke="#c8a24a" stroke-width="2"/>' +
            '<text x="80" y="76" font-size="44" text-anchor="middle" fill="#c8a24a" font-family="Georgia,serif" font-weight="700">KK</text>' +
            '<text x="80" y="106" font-size="13" text-anchor="middle" fill="#e7d7a6" font-family="Arial,sans-serif" letter-spacing="3">ADVOCATES</text>' +
            '<text x="80" y="128" font-size="9" text-anchor="middle" fill="#c8a24a" font-family="Arial,sans-serif" letter-spacing="2">EST. MMXIV · MERU</text>' +
            '</svg>'
        );

    /* ==========================================================
       4. LOCALSTORAGE KEYS
       ========================================================== */
    const LS = {
        draft:    'kk_docgen_draft_v1',
        settings: 'kk_docgen_settings_v1',
        custom:   'kk_docgen_custom_v1',
        logo:     'kk_docgen_logo_v1',
        counters: 'kk_docgen_counters_v1'
    };

    /* ==========================================================
       5. STATE
       ========================================================== */
    const State = {
        mode: 'smart',                    // smart | wizard | rule | ai
        firm: { ...FIRM_DEFAULTS },
        logoBase64: '',
        counters: {},                     // { 'DEMAND-2026': 42, ... }
        customTemplates: [],              // user templates
        pickedDocs: new Set(),            // doc template ids
        pickedLegal: new Set(),           // legal basis ids
        clients: [],                      // Firestore clients (if signed in)
        cases: [],                        // Firestore cases (if signed in)
        currentPreview: [],               // [{ id, title, html }]
        firebaseReady: false,
        fb: { app: null, db: null, auth: null, user: null },
        autosaveTimer: null
    };
    window.KKGenState = State;            // exposed for messages 3 & 4

    /* ==========================================================
       6. TOASTS
       ========================================================== */
    function toast(msg, type = 'info', ms = 4200) {
        const wrap = $('genToasts');
        if (!wrap) return;
        const icons = {
            info: 'fa-circle-info',
            success: 'fa-circle-check',
            warning: 'fa-triangle-exclamation',
            error: 'fa-circle-exclamation'
        };
        const node = el('div', { class: 'gen-toast ' + (type === 'info' ? '' : type) }, [
            el('i', { class: 'fas ' + (icons[type] || icons.info) }),
            el('span', {}, msg),
            el('span', { class: 't-close', onclick: () => node.remove() }, '\u00D7')
        ]);
        wrap.appendChild(node);
        setTimeout(() => node.remove(), ms);
    }
    window.kkGenToast = toast;

    /* ==========================================================
       7. MODAL HELPERS
       ========================================================== */
    function openModal(id) {
        const m = $(id);
        if (m) m.classList.add('active');
    }
    function closeModal(id) {
        const m = $(id);
        if (m) m.classList.remove('active');
    }
    window.kkGenOpenModal  = openModal;
    window.kkGenCloseModal = closeModal;

    document.addEventListener('click', (e) => {
        const closer = e.target.closest('[data-close-modal]');
        if (closer) closeModal(closer.dataset.closeModal);
        if (e.target.classList && e.target.classList.contains('gen-modal-backdrop')) {
            e.target.classList.remove('active');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            $$('.gen-modal-backdrop.active').forEach(m => m.classList.remove('active'));
        }
    });

    /* ==========================================================
       8. LOCALSTORAGE HELPERS
       ========================================================== */
    function lsGet(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch { return fallback; }
    }
    function lsSet(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); return true; }
        catch { return false; }
    }
    function lsDel(key) {
        try { localStorage.removeItem(key); return true; } catch { return false; }
    }

    /* ==========================================================
       9. SETTINGS — load & save
       ========================================================== */
    function loadSettings() {
        const s = lsGet(LS.settings, null);
        if (s && typeof s === 'object') {
            State.firm = { ...FIRM_DEFAULTS, ...(s.firm || {}) };
            State.settings = s;
        } else {
            State.settings = { firm: { ...FIRM_DEFAULTS }, advocate: {}, counters: {} };
        }
        State.logoBase64 = lsGet(LS.logo, '') || '';
        State.customTemplates = lsGet(LS.custom, []) || [];
        State.counters = lsGet(LS.counters, {}) || {};
    }
    function saveSettings() {
        State.settings.firm = State.firm;
        lsSet(LS.settings, State.settings);
        lsSet(LS.logo, State.logoBase64);
    }
    window.kkGenLoadSettings = loadSettings;
    window.kkGenSaveSettings = saveSettings;

    /* ==========================================================
       10. REFERENCE NUMBER GENERATOR
       KK / {TYPE} / {YEAR} / {NNNN}
       ========================================================== */
    function nextRefNumber(typeCode) {
        const year = new Date().getFullYear();
        const key  = `${typeCode}-${year}`;
        const seq  = (State.counters[key] || 0) + 1;
        State.counters[key] = seq;
        lsSet(LS.counters, State.counters);
        // Also persist to Firestore if available (fire-and-forget)
        if (State.firebaseReady && State.fb.db) {
            State.fb.db.collection('settings').doc('counters')
                .set({ [key]: seq, updatedAt: getDateTime() }, { merge: true })
                .catch(() => {});
        }
        return `KK/${typeCode}/${year}/${pad(seq, 4)}`;
    }
    async function syncCountersFromFirestore() {
        if (!State.firebaseReady || !State.fb.db) return;
        try {
            const doc = await State.fb.db.collection('settings').doc('counters').get();
            if (doc.exists) {
                const remote = doc.data() || {};
                // Take the higher of local and remote to avoid collisions
                Object.keys(remote).forEach(k => {
                    if (typeof remote[k] === 'number') {
                        State.counters[k] = Math.max(State.counters[k] || 0, remote[k]);
                    }
                });
                lsSet(LS.counters, State.counters);
            }
        } catch (e) { /* silent — offline mode */ }
    }
    window.kkGenNextRefNumber = nextRefNumber;

    /* ==========================================================
       11. LOGO MANAGEMENT
       ========================================================== */
    function applyLogo(base64) {
        State.logoBase64 = base64 || '';
        const img = $('genBrandLogo');
        if (img) img.src = State.logoBase64 || DEFAULT_LOGO_SVG;
        const prev = $('setLogoPreview');
        if (prev) prev.src = State.logoBase64 || DEFAULT_LOGO_SVG;
        lsSet(LS.logo, State.logoBase64);
    }
    async function loadLogoFromFirestore() {
        if (!State.firebaseReady || !State.fb.db) return;
        try {
            const doc = await State.fb.db.collection('settings').doc('company').get();
            if (doc.exists && doc.data().logoBase64) {
                applyLogo(doc.data().logoBase64);
            }
        } catch (e) { /* silent */ }
    }
    window.kkGenApplyLogo = applyLogo;
    window.kkGenGetLogo   = () => State.logoBase64 || DEFAULT_LOGO_SVG;

    /* ==========================================================
       12. FIREBASE / FIRESTORE
       ========================================================== */
    function loadFirebaseSDK() {
        return new Promise((resolve) => {
            if (typeof firebase !== 'undefined' && firebase.apps) return resolve(true);
            const urls = [
                'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
                'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js'
            ];
            let pending = urls.length;
            let failed = false;
            urls.forEach(src => {
                const s = document.createElement('script');
                s.src = src;
                s.onload  = () => { if (--pending === 0 && !failed) resolve(true); };
                s.onerror = () => { failed = true; resolve(false); };
                document.head.appendChild(s);
            });
        });
    }

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyAv35HANTesz9EqroXt3QaHpYvZwk2fa3o",
        authDomain: "kuriakaratu-b5c90.firebaseapp.com",
        databaseURL: "https://kuriakaratu-b5c90-default-rtdb.firebaseio.com",
        projectId: "kuriakaratu-b5c90",
        storageBucket: "kuriakaratu-b5c90.firebasestorage.app",
        messagingSenderId: "14852374326",
        appId: "1:14852374326:web:b171bd36719d8700953d97"
    };

    async function initFirebase() {
        const ok = await loadFirebaseSDK();
        if (!ok || typeof firebase === 'undefined') {
            console.warn('[docgen] Firebase SDK unavailable — running offline');
            return false;
        }
        try {
            if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
            State.fb.app  = firebase.app();
            State.fb.db   = firebase.firestore();
            State.fb.auth = firebase.auth();

            // Try persistence (harmless if it fails)
            try {
                await State.fb.db.enablePersistence({ synchronizeTabs: true });
            } catch (_) { /* already enabled or unsupported */ }

            State.firebaseReady = true;
            return true;
        } catch (e) {
            console.warn('[docgen] Firebase init failed:', e);
            return false;
        }
    }

    /* Reuse the admin session if possible. Anonymous fallback otherwise. */
    async function initFirebaseAuth() {
        if (!State.firebaseReady) return null;
        return new Promise(resolve => {
            const unsub = State.fb.auth.onAuthStateChanged(user => {
                State.fb.user = user || null;
                unsub();
                resolve(State.fb.user);
            });
        });
    }

    /* ==========================================================
       13. FIRESTORE READS — CLIENTS & CASES
       ========================================================== */
    async function fetchClients() {
        if (!State.firebaseReady || !State.fb.db || !State.fb.user) {
            State.clients = [];
            return;
        }
        try {
            const snap = await State.fb.db.collection('clients').limit(500).get();
            State.clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('[docgen] clients fetch failed:', e);
            State.clients = [];
        }
    }
    async function fetchCases() {
        if (!State.firebaseReady || !State.fb.db || !State.fb.user) {
            State.cases = [];
            return;
        }
        try {
            const snap = await State.fb.db.collection('cases').limit(500).get();
            State.cases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('[docgen] cases fetch failed:', e);
            State.cases = [];
        }
    }

    /* ==========================================================
       14. FIRESTORE WRITES — SAVE GENERATED DOCUMENT
       Matches the admin `documents` schema:
       { name, category, subCategory, matter, uploaded, size, fileId, downloadUrl, base64 }
       ========================================================== */
    function makeFileId() {
        return 'gen_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    async function saveGeneratedDocToFirestore({ name, category, subCategory, matter, html, plainText }) {
        if (!State.firebaseReady || !State.fb.db) {
            throw new Error('Firestore not available (offline mode)');
        }
        if (!State.fb.user) {
            throw new Error('Not signed in — open the generator from the admin app while logged in.');
        }

        const fileId   = makeFileId();
        const dataUrl  = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        const sizeKb   = (new Blob([html]).size / 1024).toFixed(1) + ' KB';

        const doc = {
            name:        name,
            category:    category || 'General',
            subCategory: subCategory || '',
            matter:      matter || 'General',
            uploaded:    getToday(),
            size:        sizeKb,
            fileId:      fileId,
            downloadUrl: '',
            base64:      dataUrl,
            generated:   true,
            generatedBy: (State.fb.user && State.fb.user.email) || 'docgen',
            generatedAt: getDateTime(),
            plainText:   (plainText || '').slice(0, 20000)  // search-friendly
        };

        const ref = await State.fb.db.collection('documents').add(doc);
        return { id: ref.id, ...doc };
    }
    window.kkGenSaveToFirestore = saveGeneratedDocToFirestore;

    /* ==========================================================
       15. DRAFT AUTOSAVE
       ========================================================== */
    function collectFormDraft() {
        const ids = [
            'fClientName','fClientId','fClientPin','fClientEmail','fClientPhone','fClientAddress',
            'fClientOccupation','fClientGender','fClientNextOfKin',
            'fCaseNo','fCaseName','fCourt','fStation','fFilingDate','fTracking','fCitation','fCaseSummary',
            'fOppName','fOppId','fOppPhone','fOppAddress','fOppAdvocate',
            'fAdvocateName','fAdvocateLsk','fPartner','fFirmSign',
            'fStatutoryPeriod','fClaimAmount','fClaimDesc','fPriorAgreementDesc',
            'fParcel','fParcelLocation','fParcelArea','fConsideration','fLcbConsent','fSpousalConsent',
            'fStampDuty','fRatesClearance',
            'fMotorReg','fClaimNumber','fInsurer','fAccidentDate','fPoliceOb','fAccidentLocation'
        ];
        const draft = { fields: {}, checks: {}, picked: Array.from(State.pickedDocs), legal: Array.from(State.pickedLegal) };
        ids.forEach(id => { draft.fields[id] = getVal(id); });
        const checkIds = ['sigFirm','sigClient','sigAdvocate','sigWitness','sigCommissioner','sigDraftedBy',
                          'fInterestClaim','fCostsClaim','fPriorAgreement',
                          'fLcbConsentOpt','fSpousalConsentOpt','fStampDutyOpt',
                          'optAutosave','optSaveToFirestore','optDownloadCopy'];
        checkIds.forEach(id => { draft.checks[id] = getChecked(id); });
        return draft;
    }

    function applyFormDraft(draft) {
        if (!draft || !draft.fields) return;
        Object.keys(draft.fields).forEach(id => setVal(id, draft.fields[id] || ''));
        Object.keys(draft.checks || {}).forEach(id => {
            const n = $(id);
            if (n) n.checked = !!draft.checks[id];
        });
        // Toggle visibility for dependent fields
        togglePriorAgreementField();
    }

    function scheduleAutosave() {
        if (!getChecked('optAutosave')) return;
        if (State.autosaveTimer) clearTimeout(State.autosaveTimer);
        State.autosaveTimer = setTimeout(() => {
            lsSet(LS.draft, collectFormDraft());
        }, 800);
    }
    function clearDraft() {
        lsDel(LS.draft);
        toast('Draft cleared.', 'info');
    }
    window.kkGenScheduleAutosave = scheduleAutosave;

    /* ==========================================================
       16. DEPENDENT FIELD VISIBILITY
       ========================================================== */
    function togglePriorAgreementField() {
        const wrap = $('fPriorAgreementWrap');
        if (!wrap) return;
        wrap.style.display = getChecked('fPriorAgreement') ? '' : 'none';
    }

    /* ==========================================================
       17. BRIDGE TO ADMIN (parent postMessage)
       ========================================================== */
    function notifyParent(action, payload) {
        if (!IS_FRAME) return;
        try {
            window.parent.postMessage({ source: 'kk-docgen', action, ...(payload || {}) }, '*');
        } catch (_) {}
    }
    window.kkGenNotifyParent = notifyParent;

    /* ==========================================================
       18. INITIALISATION
       ========================================================== */
    async function boot() {
        // 1. Settings, logo, custom templates, counters
        loadSettings();
        applyLogo(State.logoBase64);

        // 2. Field visibility dependencies
        bindChange('fPriorAgreement', togglePriorAgreementField);

        // 3. Autosave on every input / change in the form panel
        const panel = $('genFormPanel');
        if (panel) {
            panel.addEventListener('input',  scheduleAutosave);
            panel.addEventListener('change', scheduleAutosave);
        }

        // 4. Restore draft if present
        const draft = lsGet(LS.draft, null);
        if (draft) {
            applyFormDraft(draft);
            toast('Draft restored from your last session.', 'info', 3200);
        }

        // 5. Firebase (best-effort)
        const firebaseOk = await initFirebase();
        if (firebaseOk) {
            const user = await initFirebaseAuth();
            if (user) {
                await Promise.all([fetchClients(), fetchCases(), syncCountersFromFirestore()]);
                await loadLogoFromFirestore();
                console.log('[docgen] signed in as', user.email || user.uid,
                            '— clients:', State.clients.length,
                            '— cases:', State.cases.length);
                // Announce readiness to message-3 code
                document.dispatchEvent(new CustomEvent('kk-docgen-ready', {
                    detail: { firebaseReady: true, signedIn: true }
                }));
            } else {
                console.log('[docgen] Firebase ready — no signed-in user (offline drafting mode)');
                document.dispatchEvent(new CustomEvent('kk-docgen-ready', {
                    detail: { firebaseReady: true, signedIn: false }
                }));
            }
        } else {
            console.log('[docgen] running fully offline');
            document.dispatchEvent(new CustomEvent('kk-docgen-ready', {
                detail: { firebaseReady: false, signedIn: false }
            }));
        }

        console.log('[generator] message-2 data layer ready');
    }

    /* ==========================================================
       19. EXPORTS FOR MESSAGES 3 & 4
       ========================================================== */
    window.KKGen = window.KKGen || {};
    Object.assign(window.KKGen, {
        $, $$, el, setText, setHtml, setVal, getVal, getChecked,
        bindClick, bindInput, bindChange, bindSubmit,
        getToday, getDateTime, formatLongDate, formatMoney, formatMoneyKes,
        escapeHtml, slug, titleCase, ordinal, pad,
        toast, openModal, closeModal,
        lsGet, lsSet, lsDel, LS,
        FIRM_DEFAULTS, DEFAULT_LOGO_SVG,
        loadSettings, saveSettings,
        nextRefNumber,
    applyLogo, loadLogoFromFirestore,
    kkGenGetLogo: () => State.logoBase64 || DEFAULT_LOGO_SVG,
    kkGenApplyLogo: applyLogo,
        fetchClients, fetchCases,
        saveGeneratedDocToFirestore,
        collectFormDraft, applyFormDraft, scheduleAutosave, clearDraft,
        togglePriorAgreementField,
        notifyParent,
        State
    });

    /* Run */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();

/* ============================================================
   KK ADVOCATES — DOCUMENT GENERATOR
   Message 3 — Template Engine
   Built-in templates · Legal basis · Generation modes · Custom templates
   ============================================================ */

(function templateEngine() {
    'use strict';

    /* ==========================================================
       0. WAIT FOR MESSAGE-2 DATA LAYER
       ========================================================== */
    function onReady(fn) {
        if (window.KKGen && window.KKGen.State && window.KKGen.State.fb) return fn();
        document.addEventListener('kk-docgen-ready', fn, { once: true });
    }

    onReady(function () {
        const K = window.KKGen;
        const S = K.State;
 const { $, $$, el, getVal, getChecked, escapeHtml, formatLongDate,
        formatMoney, formatMoneyKes, getToday, toast, slug,
        bindClick, bindInput, bindChange, bindSubmit,
        setVal, setText, setHtml, lsGet, lsSet, lsDel } = K;

        /* ==========================================================
           1. FIRM CONTACT BLOCK (used in every document)
           ========================================================== */
        function firm() {
            return {
                name:    S.firm.name,
                address: S.firm.address,
                phone:   S.firm.phone,
                email:   S.firm.email,
                website: S.firm.website
            };
        }

        /* ==========================================================
           2. LEGAL BASIS CATALOGUE
           ========================================================== */
        const LEGAL_LIBRARY = {
            /* Constitutional articles */
            'constitution-art-40': { group: 'Constitution', title: 'Article 40 — Protection of right to property', desc: 'Guarantees every person the right to acquire and own property.' },
            'constitution-art-45-3': { group: 'Constitution', title: 'Article 45(3) — Equality in marriage', desc: 'Parties to a marriage are entitled to equal rights at the time of marriage, during the marriage and at the dissolution of the marriage.' },
            'constitution-art-27': { group: 'Constitution', title: 'Article 27 — Equality and freedom from discrimination', desc: 'Every person is equal before the law.' },
            'constitution-art-28': { group: 'Constitution', title: 'Article 28 — Human dignity', desc: 'Every person has inherent dignity and the right to have that dignity respected and protected.' },
            'constitution-art-29': { group: 'Constitution', title: 'Article 29 — Freedom and security of the person', desc: 'Every person has the right to freedom and security of the person.' },
            'constitution-art-31': { group: 'Constitution', title: 'Article 31 — Privacy', desc: 'Every person has the right to privacy.' },
            'constitution-art-35': { group: 'Constitution', title: 'Article 35 — Access to information', desc: 'Every citizen has the right of access to information held by the State.' },
            'constitution-art-43': { group: 'Constitution', title: 'Article 43 — Economic and social rights', desc: 'Right to the highest attainable standard of health, accessible housing, food, clean water, social security, education.' },
            'constitution-art-47': { group: 'Constitution', title: 'Article 47 — Fair administrative action', desc: 'Every person has the right to administrative action that is expeditious, efficient, lawful, reasonable and procedurally fair.' },
            'constitution-art-48': { group: 'Constitution', title: 'Article 48 — Access to justice', desc: 'The State shall ensure access to justice for all persons.' },
            'constitution-art-50': { group: 'Constitution', title: 'Article 50 — Fair hearing', desc: 'Every person has the right to have any dispute resolved by the application of law in a fair and public hearing before a court.' },
            'constitution-art-53': { group: 'Constitution', title: 'Article 53 — Children', desc: 'Every child has the right to be protected from abuse, neglect, harmful cultural practices, violence, inhuman treatment and punishment.' },
            'constitution-art-159': { group: 'Constitution', title: 'Article 159 — Judicial authority', desc: 'Judicial authority is derived from the people and justice shall be done to all irrespective of status.' },

            /* Primary statutes by practice area */
            'cpa-cap21':       { group: 'Civil Procedure', title: 'Civil Procedure Act (Cap 21)', desc: 'Principal statute governing civil procedure in Kenya.' },
            'cpr-2010':        { group: 'Civil Procedure', title: 'Civil Procedure Rules, 2010', desc: 'Rules made under the Civil Procedure Act.' },
            'limitation-cap22':{ group: 'Civil Procedure', title: 'Limitation of Actions Act (Cap 22)', desc: 'Prescribes time limits for bringing civil claims.' },

            'cpc-cap75':       { group: 'Criminal', title: 'Criminal Procedure Code (Cap 75)', desc: 'Procedure in criminal trials and appeals.' },
            'penal-cap63':     { group: 'Criminal', title: 'Penal Code (Cap 63)', desc: 'Defines criminal offences and punishments.' },
            'evidence-cap80':  { group: 'Criminal', title: 'Evidence Act (Cap 80)', desc: 'Law of evidence in Kenya.' },
            'soa-2006':        { group: 'Criminal', title: 'Sexual Offences Act, 2006', desc: 'Defines and penalises sexual offences.' },

            'lra-2012':        { group: 'Land', title: 'Land Registration Act, 2012', desc: 'Registration of title to land, transfers, charges and leases.' },
            'la-2012':         { group: 'Land', title: 'Land Act, 2012', desc: 'Management and administration of public, community and private land.' },
            'elc-act-2011':    { group: 'Land', title: 'Environment and Land Court Act, 2011', desc: 'Establishes the ELC and its jurisdiction.' },
            'lcb-cap302':      { group: 'Land', title: 'Land Control Act (Cap 302)', desc: 'Land Control Board consent for dealings in agricultural land.' },
            'physical-planning-2019': { group: 'Land', title: 'Physical and Land Use Planning Act, 2019', desc: 'Planning and development control.' },

            'lsa-cap160':      { group: 'Succession', title: 'Law of Succession Act (Cap 160)', desc: 'Wills, intestacy, grants of representation.' },
            'par':             { group: 'Succession', title: 'Probate and Administration Rules', desc: 'Procedure under the Law of Succession Act.' },

            'marriage-2014':   { group: 'Family', title: 'Marriage Act, 2014', desc: 'Forms of marriage recognised in Kenya.' },
            'mpa-2013':        { group: 'Family', title: 'Matrimonial Property Act, 2013', desc: 'Rights of spouses in matrimonial property.' },
            'children-2022':   { group: 'Family', title: "Children Act, 2022", desc: 'Rights and welfare of children.' },

            'employment-2007': { group: 'Employment', title: 'Employment Act, 2007', desc: 'Employment relationship, wages, termination.' },
            'lra-2007':        { group: 'Employment', title: 'Labour Relations Act, 2007', desc: 'Trade unions, collective bargaining.' },
            'elrc-act-2011':   { group: 'Employment', title: 'Employment and Labour Relations Court Act, 2011', desc: 'Establishes the ELRC.' },

            'insolvency-2015': { group: 'Commercial', title: 'Insolvency Act, 2015', desc: 'Bankruptcy and insolvency of individuals and companies.' },
            'companies-2015':  { group: 'Commercial', title: 'Companies Act, 2015', desc: 'Incorporation, governance and winding up of companies.' },
            'sale-of-goods-cap31': { group: 'Commercial', title: 'Sale of Goods Act (Cap 31)', desc: 'Contracts for the sale of goods.' },

            'advocates-cap16': { group: 'Legal Profession', title: 'Advocates Act (Cap 16)', desc: 'Regulation of advocates and their practice.' },
            'advocates-rules': { group: 'Legal Profession', title: 'Advocates (Practice) Rules', desc: 'Professional conduct and practice rules.' },
            'lsk-act-2014':    { group: 'Legal Profession', title: 'Law Society of Kenya Act, 2014', desc: 'Governance of the Law Society of Kenya.' },

            'stamp-duty-cap480': { group: 'Revenue', title: 'Stamp Duty Act (Cap 480)', desc: 'Imposition of stamp duty on instruments.' },
            'tax-procedure-2015': { group: 'Revenue', title: 'Tax Procedures Act, 2015', desc: 'Administration of tax in Kenya.' },
            'vat-2013':        { group: 'Revenue', title: 'Value Added Tax Act, 2013', desc: 'VAT on taxable supplies.' },

            'traffic-cap403':  { group: 'Traffic', title: 'Traffic Act (Cap 403)', desc: 'Road traffic offences and procedures.' },
            'insurance-mv-405': { group: 'Traffic', title: 'Insurance (Motor Vehicles Third Party Risks) Act (Cap 405)', desc: 'Third-party motor insurance.' },

            'dpa-2019':        { group: 'Data & Cyber', title: 'Data Protection Act, 2019', desc: 'Processing of personal data.' },
            'cmca-2018':       { group: 'Data & Cyber', title: 'Computer Misuse and Cybercrimes Act, 2018', desc: 'Cybercrime offences.' },

            'oaths-cap15':     { group: 'Evidence', title: 'Oaths and Statutory Declarations Act (Cap 15)', desc: 'Affidavits and statutory declarations.' },
            'registration-docs-cap285': { group: 'Evidence', title: 'Registration of Documents Act (Cap 285)', desc: 'Registration of documents.' }
        };

        const CONSTITUTION_ARTICLE_PATTERN = /^constitution-/;

        /* ==========================================================
           3. BUILT-IN TEMPLATE LIBRARY
           Each template:
           {
             id, category, subCategory, title, shortDesc,
             typeCode (for KK/.../YYYY/NNNN),
             defaultLegal: [legalBasisIds],
             appliesWhen: { areas:[], tags:[] },  // for Smart mode scoring
             requires: [fieldIds],                // soft warnings if empty
             build(data) -> { html, plainText }
           }
           ========================================================== */

        /* ---------- helpers used by many templates ---------- */

        function courtHeader(extra) {
            const d = collectData();
            const court = d.court ? d.court.toUpperCase() : 'IN THE HIGH COURT OF KENYA';
            const station = d.station ? ` AT ${d.station.toUpperCase()}` : '';
            const caseName = d.caseName ? `<div class="ch-case">${escapeHtml(d.caseName.toUpperCase())}</div>` : '';
            const caseNo = d.caseNo ? `<div class="ch-sub">${escapeHtml(d.caseNo.toUpperCase())}</div>` : '';
            const extraLines = extra ? `<div class="ch-sub">${extra}</div>` : '';
            return `<div class="doc-court-header">
                <div class="ch-line">IN THE ${escapeHtml(court)}${escapeHtml(station)}</div>
                ${extraLines}
                ${caseName}
                ${caseNo}
            </div>`;
        }

        function partiesBlock(plaintiffLabel, defendantLabel) {
            const d = collectData();
            if (!d.clientName && !d.oppName) return '';
            const left  = d.clientName ? `<div class="party-name">${escapeHtml(d.clientName.toUpperCase())}</div><div class="party-role">${escapeHtml(plaintiffLabel || 'Plaintiff')}</div>` : '';
            const right = d.oppName    ? `<div class="party-name">${escapeHtml(d.oppName.toUpperCase())}</div><div class="party-role">${escapeHtml(defendantLabel || 'Defendant')}</div>` : '';
            return `<div class="doc-parties">
                <div class="party-row">
                    <div class="party-left">${left}</div>
                    <div class="party-mid">— versus —</div>
                    <div class="party-right">${right}</div>
                </div>
            </div>`;
        }

        function docTitle(text) { return `<div class="doc-title">${escapeHtml(text)}</div>`; }
        function refLine(ref) {
            if (!ref) return '';
            return `<div class="doc-ref">OUR REF: <strong>${escapeHtml(ref)}</strong> &nbsp;·&nbsp; YOUR REF: ___________________ &nbsp;·&nbsp; DATE: ${escapeHtml(formatLongDate(getToday()))}</div>`;
        }

        function legalBasisBlock(basisIds) {
            if (!basisIds || !basisIds.length) return '';
            const grouped = {};
            basisIds.forEach(id => {
                const item = LEGAL_LIBRARY[id];
                if (!item) return;
                if (!grouped[item.group]) grouped[item.group] = [];
                grouped[item.group].push(item.title);
            });
            const items = Object.keys(grouped).map(g => {
                const list = grouped[g].map(t => `<li>${escapeHtml(t)}</li>`).join('');
                return `<p style="margin-top:6pt;"><strong>${escapeHtml(g)}</strong></p><ol>${list}</ol>`;
            }).join('');
            return `<div class="legal-basis">
                <div class="lb-title">Legal Basis</div>
                ${items}
            </div>`;
        }

        function signatureBlocks() {
            const d = collectData();
            const parts = [];
            if (getChecked('sigClient')) {
                parts.push(`<div class="sig-line">
                    <div class="sig-role">Client / Deponent</div>
                    <div class="sig-detail">${escapeHtml(d.clientName || '')}${d.clientId ? ' · ID ' + escapeHtml(d.clientId) : ''}</div>
                    <div class="sig-detail">Date: ______________________</div>
                </div>`);
            }
            if (getChecked('sigAdvocate')) {
                parts.push(`<div class="sig-line">
                    <div class="sig-role">${escapeHtml(d.firmSign || S.firm.name)}</div>
                    <div class="sig-detail">${escapeHtml(d.advocateName || '____________________')}</div>
                    ${d.advocateLsk ? `<div class="sig-detail">LSK No. ${escapeHtml(d.advocateLsk)}</div>` : ''}
                    <div class="sig-detail">Date: ______________________</div>
                </div>`);
            }
            if (getChecked('sigWitness')) {
                parts.push(`<div class="sig-line">
                    <div class="sig-role">Witness</div>
                    <div class="sig-detail">Name: ______________________</div>
                    <div class="sig-detail">ID No.: ______________________</div>
                    <div class="sig-detail">Signature: ______________________</div>
                </div>`);
            }
            let html = '';
            if (parts.length) html += `<div class="sig-row">${parts.join('')}</div>`;
            if (getChecked('sigCommissioner')) {
                html += `<div class="commissioner-block">
                    <div class="cb-title">Sworn / Declared before me</div>
                    <div class="cb-lines">
                        <div>Commissioner for Oaths: <span class="cb-line"></span></div>
                        <div style="margin-top:10pt;">Signature: <span class="cb-line" style="min-width:40%;"></span> &nbsp; Date: <span class="cb-line" style="min-width:20%;"></span></div>
                        <div style="margin-top:10pt;font-size:9pt;color:#4a5568;">(Advocate / Magistrate / Notary Public / Commissioner for Oaths)</div>
                    </div>
                </div>`;
            }
            if (getChecked('sigFirm')) {
                html += `<div class="firm-stamp-block"><div class="stamp-inner">${escapeHtml(S.firm.name)}<br>Official Stamp</div></div>`;
            }
            return html ? `<div class="sign-block">${html}</div>` : '';
        }

        function draftedByBlock() {
            if (!getChecked('sigDraftedBy')) return '';
            return `<div class="drafted-by">
                <div class="db-title">Drafted by</div>
                <strong>${escapeHtml(S.firm.name)}</strong><br>
                ${escapeHtml(S.firm.address)}<br>
                Tel: ${escapeHtml(S.firm.phone)}<br>
                Email: ${escapeHtml(S.firm.email)}
            </div>`;
        }

        /* ==========================================================
           4. collectData() — read the form into a single object
           ========================================================== */
        function collectData() {
            const d = {
                clientName:    getVal('fClientName').trim(),
                clientId:      getVal('fClientId').trim(),
                clientPin:     getVal('fClientPin').trim(),
                clientEmail:   getVal('fClientEmail').trim(),
                clientPhone:   getVal('fClientPhone').trim(),
                clientAddress: getVal('fClientAddress').trim(),
                clientOccupation: getVal('fClientOccupation').trim(),
                clientGender:  getVal('fClientGender'),
                clientNextOfKin: getVal('fClientNextOfKin').trim(),

                caseNo:      getVal('fCaseNo').trim(),
                caseName:    getVal('fCaseName').trim(),
                court:       getVal('fCourt'),
                station:     getVal('fStation'),
                filingDate:  getVal('fFilingDate'),
                tracking:    getVal('fTracking').trim(),
                citation:    getVal('fCitation').trim(),
                caseSummary: getVal('fCaseSummary').trim(),

                oppName:    getVal('fOppName').trim(),
                oppId:      getVal('fOppId').trim(),
                oppPhone:   getVal('fOppPhone').trim(),
                oppAddress: getVal('fOppAddress').trim(),
                oppAdvocate:getVal('fOppAdvocate').trim(),

                advocateName: getVal('fAdvocateName').trim(),
                advocateLsk:  getVal('fAdvocateLsk').trim(),
                partner:      getVal('fPartner').trim(),
                firmSign:     getVal('fFirmSign').trim(),

                statutoryPeriod: getVal('fStatutoryPeriod') || '14',
                claimAmount:     getVal('fClaimAmount'),
                claimDesc:       getVal('fClaimDesc').trim(),
                priorAgreement:  getChecked('fPriorAgreement'),
                priorAgreementDesc: getVal('fPriorAgreementDesc').trim(),
                interestClaim:   getChecked('fInterestClaim'),
                costsClaim:      getChecked('fCostsClaim'),

                parcel:          getVal('fParcel').trim(),
                parcelLocation:  getVal('fParcelLocation').trim(),
                parcelArea:      getVal('fParcelArea').trim(),
                consideration:   getVal('fConsideration'),
                lcbConsent:      getVal('fLcbConsent').trim(),
                spousalConsent:  getVal('fSpousalConsent').trim(),
                stampDuty:       getVal('fStampDuty').trim(),
                ratesClearance:  getVal('fRatesClearance').trim(),
                lcbConsentOpt:   getChecked('fLcbConsentOpt'),
                spousalConsentOpt: getChecked('fSpousalConsentOpt'),
                stampDutyOpt:    getChecked('fStampDutyOpt'),

                motorReg:     getVal('fMotorReg').trim(),
                claimNumber:  getVal('fClaimNumber').trim(),
                insurer:      getVal('fInsurer').trim(),
                accidentDate: getVal('fAccidentDate'),
                policeOb:     getVal('fPoliceOb').trim(),
                accidentLocation: getVal('fAccidentLocation').trim()
            };
            return d;
        }
        window.kkGenCollectData = collectData;

        /* ==========================================================
           5. TEMPLATE LIBRARY
           ========================================================== */
        const TEMPLATES = {};

        /* ---------- utility to register a template ---------- */
        function reg(tpl) { TEMPLATES[tpl.id] = tpl; }

        /* ==========================================================
           5.1  RETAINER — Client Care Letter / Fee Agreement
           ========================================================== */
        reg({
            id: 'retainer-clientcare',
            category: 'Retainer',
            subCategory: 'Client Care Letter',
            title: 'Client Care & Fee Agreement',
            shortDesc: 'Advocates (Practice) Rules compliant retainer letter.',
            typeCode: 'RETAINER',
            defaultLegal: ['advocates-cap16', 'advocates-rules'],
            appliesWhen: { areas: [], tags: ['retainer', 'fee', 'engagement'] },
            requires: ['clientName'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Client Care & Fee Agreement')}
                    <p>Dear ${escapeHtml(d.clientName || 'Client')},</p>
                    <p><strong>RE: ENGAGEMENT OF LEGAL SERVICES</strong></p>
                    <p>We refer to your instructions to us, and confirm our acceptance of the same on the terms set out below.</p>
                    <div class="section-label">1. Scope of Engagement</div>
                    <p>${escapeHtml(d.caseSummary || 'We shall act for you in the matter described in your instructions, and in any related proceedings that may be necessary.')}</p>
                    <div class="section-label">2. Professional Fees</div>
                    <p>Our fees are computed in accordance with the Advocates (Remuneration) Order. An initial deposit is payable upon engagement, and the balance shall be payable upon conclusion of the matter or on such other schedule as may be agreed in writing.</p>
                    <div class="section-label">3. Disbursements</div>
                    <p>Court filing fees, service fees, land search fees, stamp duty, transport, and other reasonable out-of-pocket expenses will be billed separately and are payable by you.</p>
                    <div class="section-label">4. Client Account</div>
                    <p>All monies received on your behalf will be held in our <strong>Client Account</strong> at [Bank name, Branch, Account No.], separate from our office account, in accordance with the Advocates (Accounts) Rules.</p>
                    <div class="section-label">5. Communication</div>
                    <p>We will communicate with you regularly. Kindly respond promptly to requests for documents or instructions so as to avoid delay in your matter.</p>
                    <div class="section-label">6. Termination</div>
                    <p>Either party may terminate this engagement in writing, subject to settlement of all outstanding fees and disbursements.</p>
                    <p>Kindly sign and return the duplicate of this letter to confirm your acceptance.</p>
                    <p>Yours faithfully,</p>
                    <p><strong>${escapeHtml(S.firm.name)}</strong></p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        /* ==========================================================
           5.2  AGREEMENTS
           ========================================================== */
        reg({
            id: 'agreement-general',
            category: 'Agreements',
            subCategory: '',
            title: 'General Agreement',
            shortDesc: 'Standard bipartite agreement.',
            typeCode: 'AGREEMENT',
            defaultLegal: ['cpa-cap21'],
            appliesWhen: { areas: [], tags: ['agreement'] },
            requires: ['clientName', 'oppName'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Agreement')}
                    <p>THIS AGREEMENT is made this ${escapeHtml(formatLongDate(getToday()))} BETWEEN <strong>${escapeHtml(d.clientName || '[Party A]')}</strong> of ${escapeHtml(d.clientAddress || '[address]')} (hereinafter "the First Party") AND <strong>${escapeHtml(d.oppName || '[Party B]')}</strong> of ${escapeHtml(d.oppAddress || '[address]')} (hereinafter "the Second Party").</p>
                    <div class="section-label">1. Recitals</div>
                    <p>${escapeHtml(d.caseSummary || 'The parties have agreed to enter into this Agreement on the terms set out below.')}</p>
                    <div class="section-label">2. Obligations</div>
                    <p>The parties shall each perform their respective obligations as herein set out, in good faith and in accordance with the laws of Kenya.</p>
                    <div class="section-label">3. Consideration</div>
                    <p>The consideration for this Agreement is ${escapeHtml(formatMoneyKes(d.consideration || 0))}, receipt of which is hereby acknowledged.</p>
                    <div class="section-label">4. Governing Law</div>
                    <p>This Agreement is governed by the laws of the Republic of Kenya.</p>
                    <div class="section-label">5. Dispute Resolution</div>
                    <p>Any dispute arising under this Agreement shall first be referred to negotiation, and if unresolved, to the jurisdiction of the Courts of Kenya.</p>
                    <p>IN WITNESS WHEREOF the parties have executed this Agreement the day and year first hereinbefore written.</p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'agreement-sale-land',
            category: 'Agreements',
            subCategory: 'Sale of Land',
            title: 'Sale of Land Agreement',
            shortDesc: 'Sale agreement for land under the Land Registration Act.',
            typeCode: 'AGREEMENT',
            defaultLegal: ['lra-2012', 'la-2012', 'lcb-cap302', 'constitution-art-40', 'stamp-duty-cap480'],
            appliesWhen: { areas: ['Conveyancing', 'ELCs'], tags: ['land', 'sale', 'conveyance'] },
            requires: ['clientName', 'oppName', 'parcel'],
            build(d) {
                const ref = nextRef();
                const lcb = d.lcbConsentOpt ? `
                    <div class="section-label">Land Control Board Consent</div>
                    <p>The parties acknowledge that this transaction requires the consent of the Land Control Board under section 6 of the Land Control Act (Cap 302)${d.lcbConsent ? `, and confirm that consent reference <strong>${escapeHtml(d.lcbConsent)}</strong> has been obtained` : ''}.</p>` : '';
                const spousal = d.spousalConsentOpt ? `
                    <div class="section-label">Spousal Consent</div>
                    <p>In compliance with Article 45(3) of the Constitution of Kenya, 2010, the spouse of the Vendor${d.spousalConsent ? `, <strong>${escapeHtml(d.spousalConsent)}</strong>,` : ''} consents to this transaction.</p>` : '';
                const stamp = d.stampDutyOpt ? `
                    <div class="section-label">Stamp Duty</div>
                    <p>The Transfer instrument shall be presented for stamping under the Stamp Duty Act (Cap 480)${d.stampDuty ? `, iTax / Stamp Duty reference <strong>${escapeHtml(d.stampDuty)}</strong>` : ''}.</p>` : '';
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Agreement for Sale of Land')}
                    <p>THIS AGREEMENT FOR SALE OF LAND is made this ${escapeHtml(formatLongDate(getToday()))} BETWEEN <strong>${escapeHtml(d.clientName || '[Vendor]')}</strong> of ${escapeHtml(d.clientAddress || '[address]')} (the "Vendor") AND <strong>${escapeHtml(d.oppName || '[Purchaser]')}</strong> of ${escapeHtml(d.oppAddress || '[address]')} (the "Purchaser").</p>
                    <div class="section-label">1. Property</div>
                    <p>The Vendor is the registered proprietor of <strong>${escapeHtml(d.parcel || '[Title Number]')}</strong>${d.parcelLocation ? ` situated at ${escapeHtml(d.parcelLocation)}` : ''}${d.parcelArea ? ` measuring approximately ${escapeHtml(d.parcelArea)}` : ''} (the "Property").</p>
                    <div class="section-label">2. Purchase Price</div>
                    <p>The purchase price is <strong>${escapeHtml(formatMoneyKes(d.consideration || 0))}</strong>, payable as follows: a deposit of 10% upon execution of this Agreement, and the balance upon completion.</p>
                    <div class="section-label">3. Title</div>
                    <p>The Vendor shall transfer the Property to the Purchaser free from all encumbrances, and shall deliver the original title documents together with the duly executed Transfer instrument (Form RL 21) and Land Control Board consent.</p>
                    <div class="section-label">4. Completion</div>
                    <p>Completion shall take place within ninety (90) days from the date of this Agreement.</p>
                    ${lcb}
                    ${spousal}
                    ${stamp}
                    <div class="section-label">5. Governing Law</div>
                    <p>This Agreement is governed by the laws of Kenya, and the parties submit to the exclusive jurisdiction of the Environment and Land Court.</p>
                    <p>IN WITNESS WHEREOF the parties have executed this Agreement the day and year first hereinbefore written.</p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        /* ==========================================================
           5.3  AFFIDAVITS
           ========================================================== */
        function affidavitShell(title, paras, d) {
            const ref = nextRef();
            const html = `
                ${refLine(ref)}
                ${courtHeader('')}
                ${docTitle(title)}
                <p>I, <strong>${escapeHtml(d.clientName || '[Deponent]')}</strong>, of Post Office Box Number ${escapeHtml(d.clientAddress || '____________')}, in the Republic of Kenya, do hereby make oath and state as follows:</p>
                <ol>
                    ${paras.map(p => `<li>${p}</li>`).join('')}
                </ol>
                <p>I make this affidavit in support of the above matter.</p>
                <p>What is deposed to herein is true to the best of my knowledge, information and belief.</p>
                <p style="margin-top:12pt;">SWORN at ${escapeHtml(d.station || '___________')} by the said <strong>${escapeHtml(d.clientName || '[Deponent]')}</strong> this ______ day of ____________________, 20____.</p>
                ${signatureBlocks()}
                ${legalBasisBlock(d.__legal || this.defaultLegal)}
                ${draftedByBlock()}
            `;
            return { html, plainText: stripTags(html) };
        }

        reg({
            id: 'affidavit-names',
            category: 'Affidavits',
            subCategory: 'Names',
            title: 'Affidavit of Names',
            shortDesc: 'Confirming that several names refer to the same person.',
            typeCode: 'AFFIDAVIT',
            defaultLegal: ['oaths-cap15'],
            appliesWhen: { areas: [], tags: ['affidavit', 'names', 'identity'] },
            requires: ['clientName'],
            build(d) {
                const paras = [
                    `THAT I am the Deponent herein, and I am competent to make this affidavit.`,
                    `THAT I am known by the names <strong>${escapeHtml(d.clientName)}</strong>, and I am the holder of National Identity Card Number <strong>${escapeHtml(d.clientId || '____________')}</strong>.`,
                    `THAT I have, over the years, been known by the following additional names: ______________________________.`,
                    `THAT the said names refer to one and the same person, that is to say, myself.`,
                    `THAT I make this affidavit in support of my application to have the names appearing on my documents rectified accordingly.`,
                    `THAT what is deposed to herein is true to the best of my knowledge, information and belief.`
                ];
                return affidavitShell('Affidavit of Names', paras, d);
            }
        });

        reg({
            id: 'affidavit-customary-marriage',
            category: 'Affidavits',
            subCategory: 'Customary Marriages',
            title: 'Affidavit of Customary Marriage',
            shortDesc: 'Confirming a customary law marriage.',
            typeCode: 'AFFIDAVIT',
            defaultLegal: ['oaths-cap15', 'marriage-2014'],
            appliesWhen: { areas: ['Succession', 'Divorce'], tags: ['affidavit', 'marriage', 'customary'] },
            requires: ['clientName'],
            build(d) {
                const paras = [
                    `THAT I am the Deponent herein, and I am competent to make this affidavit.`,
                    `THAT I am an adult male / female of sound mind, and I am the holder of National Identity Card Number <strong>${escapeHtml(d.clientId || '____________')}</strong>.`,
                    `THAT on or about the ______ day of ____________________, 20____, I married <strong>${escapeHtml(d.oppName || '_________________')}</strong> under <strong>${escapeHtml(d.caseSummary || '[name of custom] customary law')}</strong>.`,
                    `THAT our said marriage was solemnised in accordance with the customary law of the <strong>${escapeHtml(d.caseNo || '[community]')}</strong> community, and was attended by members of our respective families.`,
                    `THAT the said marriage has not been dissolved, and no other marriage subsists between us.`,
                    `THAT what is deposed to herein is true to the best of my knowledge, information and belief.`
                ];
                return affidavitShell('Affidavit of Customary Marriage', paras, d);
            }
        });

        reg({
            id: 'affidavit-lost-document',
            category: 'Affidavits',
            subCategory: 'Lost Document',
            title: 'Affidavit of Lost Document',
            shortDesc: 'Confirming loss of a document (title, ID, share certificate, etc.).',
            typeCode: 'AFFIDAVIT',
            defaultLegal: ['oaths-cap15'],
            appliesWhen: { areas: [], tags: ['affidavit', 'lost', 'document'] },
            requires: ['clientName'],
            build(d) {
                const paras = [
                    `THAT I am the Deponent herein, and I am competent to make this affidavit.`,
                    `THAT I am the holder of National Identity Card Number <strong>${escapeHtml(d.clientId || '____________')}</strong>.`,
                    `THAT I was the holder of the document described as <strong>${escapeHtml(d.caseSummary || '[describe document]')}</strong>.`,
                    `THAT on or about the ______ day of ____________________, 20____, at <strong>${escapeHtml(d.accidentLocation || '____________________')}</strong>, I lost the said document.`,
                    `THAT I have made a diligent search for the said document and it has not been found, and I verily believe it to be irretrievably lost.`,
                    `THAT no person has, to my knowledge, fraudulently used or transferred the said document.`,
                    `THAT I make this affidavit in support of my application for a duplicate copy / replacement of the said document.`,
                    `THAT what is deposed to herein is true to the best of my knowledge, information and belief.`
                ];
                return affidavitShell('Affidavit of Lost Document', paras, d);
            }
        });

        reg({
            id: 'affidavit-forced-transfer',
            category: 'Affidavits',
            subCategory: 'Forced Transfer',
            title: 'Affidavit of Forced / Fraudulent Transfer',
            shortDesc: 'Deposing that a transfer was obtained without the deponent\u2019s free consent.',
            typeCode: 'AFFIDAVIT',
            defaultLegal: ['oaths-cap15', 'lra-2012', 'constitution-art-40'],
            appliesWhen: { areas: ['ELCs'], tags: ['affidavit', 'land', 'fraud', 'transfer'] },
            requires: ['clientName', 'parcel'],
            build(d) {
                const paras = [
                    `THAT I am the Deponent herein, and I am competent to make this affidavit.`,
                    `THAT I am the registered proprietor of land parcel number <strong>${escapeHtml(d.parcel || '_________________')}</strong>.`,
                    `THAT I have come to learn that the said parcel was purportedly transferred to <strong>${escapeHtml(d.oppName || '_________________')}</strong> vide a transfer dated the ______ day of ____________________, 20____.`,
                    `THAT I did not, at any material time, execute the said transfer, and the signature appearing on the said instrument is <strong>not mine</strong>.`,
                    `THAT I did not receive any consideration for the purported transfer, and I did not appear before any Land Control Board to give my consent.`,
                    `THAT the said transfer was procured by fraud, forgery and/or misrepresentation on the part of the said <strong>${escapeHtml(d.oppName || '_________________')}</strong> and/or persons acting in concert with them.`,
                    `THAT I have reported the matter to the Directorate of Criminal Investigations at <strong>${escapeHtml(d.station || '________')}</strong>${d.policeOb ? `, OB Number <strong>${escapeHtml(d.policeOb)}</strong>` : ''}.`,
                    `THAT what is deposed to herein is true to the best of my knowledge, information and belief.`
                ];
                return affidavitShell('Affidavit of Forced / Fraudulent Transfer', paras, d);
            }
        });

        reg({
            id: 'affidavit-land-transfer',
            category: 'Affidavits',
            subCategory: 'Land Transfer',
            title: 'Affidavit of Land Transfer',
            shortDesc: 'Confirming a voluntary transfer of land.',
            typeCode: 'AFFIDAVIT',
            defaultLegal: ['oaths-cap15', 'lra-2012'],
            appliesWhen: { areas: ['Conveyancing', 'ELCs'], tags: ['affidavit', 'land', 'transfer'] },
            requires: ['clientName', 'parcel'],
            build(d) {
                const paras = [
                    `THAT I am the Deponent herein, and I am competent to make this affidavit.`,
                    `THAT I am the registered proprietor of land parcel number <strong>${escapeHtml(d.parcel || '_________________')}</strong>${d.parcelLocation ? ` situated at <strong>${escapeHtml(d.parcelLocation)}</strong>` : ''}.`,
                    `THAT by a Transfer dated the ______ day of ____________________, 20____, I transferred the said parcel to <strong>${escapeHtml(d.oppName || '_________________')}</strong> for the consideration of <strong>${escapeHtml(formatMoneyKes(d.consideration || 0))}</strong>, the receipt whereof I hereby acknowledge.`,
                    `THAT the said transfer was made freely and voluntarily, without any form of duress, coercion or undue influence.`,
                    `THAT I have executed all documents necessary to effect the said transfer, including Form RL 21, and I have no further claim to the said parcel.`,
                    `THAT what is deposed to herein is true to the best of my knowledge, information and belief.`
                ];
                return affidavitShell('Affidavit of Land Transfer', paras, d);
            }
        });

        /* ==========================================================
           5.4  DEMAND
           ========================================================== */
        function demandLetterShell(title, bodyParas, d, opts) {
            opts = opts || {};
            const ref = nextRef();
            const period = d.statutoryPeriod || '14';
            const interest = d.interestClaim ? `<p>Unless payment is received within the said period, we shall institute legal proceedings against you for the recovery of the said sum <strong>together with interest at court rate from the date of filing suit until payment in full</strong>.</p>` : '';
            const costs = d.costsClaim ? `<p>Please note that the costs of this demand shall be borne by you.</p>` : '';
            const prior = (d.priorAgreement && d.priorAgreementDesc) ? `<p>Our demand is founded upon <strong>${escapeHtml(d.priorAgreementDesc)}</strong>.</p>` : '';
            const html = `
                ${refLine(ref)}
                ${docTitle(title)}
                <p>To:<br>
                <strong>${escapeHtml(d.oppName || '[Addressee]')}</strong><br>
                ${escapeHtml(d.oppAddress || '[Address]')}</p>
                <p style="margin-top:12pt;">Dear Sir/Madam,</p>
                <p><strong>RE: ${escapeHtml(title.toUpperCase())}</strong></p>
                ${prior}
                ${bodyParas.map(p => `<p>${p}</p>`).join('')}
                <p>TAKE NOTICE that unless the said sum${d.claimAmount ? ` of <strong>${escapeHtml(formatMoneyKes(d.claimAmount))}</strong>` : ''} is paid to us within <strong>${escapeHtml(period)} days</strong> from the date of service of this letter, we shall, on the instructions of our client, proceed to institute legal proceedings against you without any further notice.</p>
                ${interest}
                ${costs}
                <p>Yours faithfully,</p>
                <p><strong>${escapeHtml(S.firm.name)}</strong></p>
                ${signatureBlocks()}
                ${legalBasisBlock(d.__legal || this.defaultLegal)}
                ${draftedByBlock()}
            `;
            return { html, plainText: stripTags(html) };
        }

        reg({
            id: 'demand-debt',
            category: 'Demand',
            subCategory: 'Debt',
            title: 'Demand Letter — Debt',
            shortDesc: 'Demand for payment of an outstanding debt.',
            typeCode: 'DEMAND',
            defaultLegal: ['cpa-cap21', 'cpr-2010', 'limitation-cap22'],
            appliesWhen: { areas: ['Civil'], tags: ['demand', 'debt'] },
            requires: ['oppName', 'claimAmount'],
            build(d) {
                const body = [
                    `We act for <strong>${escapeHtml(d.clientName || '[Client]')}</strong> (hereinafter "our client"), on whose instructions we write to you as follows.`,
                    `Our client is entitled to the sum of <strong>${escapeHtml(formatMoneyKes(d.claimAmount || 0))}</strong> being ${escapeHtml(d.claimDesc || 'an outstanding debt owed to our client')}.`,
                    `Despite demand having been made, you have failed, refused and/or neglected to pay the said sum or any part thereof.`
                ];
                return demandLetterShell('Demand Letter', body, d);
            }
        });

        reg({
            id: 'demand-eviction',
            category: 'Demand',
            subCategory: 'Eviction',
            title: 'Demand Letter — Vacant Possession',
            shortDesc: 'Demand to vacate property.',
            typeCode: 'DEMAND',
            defaultLegal: ['cpa-cap21', 'constitution-art-40'],
            appliesWhen: { areas: ['ELCs', 'Civil'], tags: ['demand', 'eviction', 'landlord'] },
            requires: ['oppName', 'parcel'],
            build(d) {
                const body = [
                    `We act for <strong>${escapeHtml(d.clientName || '[Client]')}</strong>, the registered proprietor of land parcel number <strong>${escapeHtml(d.parcel || '[title]')}</strong>.`,
                    `You are currently in occupation of the said property without any lawful title, and you have failed, refused and/or neglected to vacate the same despite demand.`,
                    `Our client requires vacant possession of the said property forthwith.`
                ];
                return demandLetterShell('Demand for Vacant Possession', body, d);
            }
        });

        reg({
            id: 'demand-statutory-notice',
            category: 'Demand',
            subCategory: 'Statutory Notice',
            title: 'Statutory Notice (Cap 301)',
            shortDesc: 'Notice under the Landlord and Tenant (Shops, Hotels and Catering Establishments) Act (Cap 301).',
            typeCode: 'NOTICE',
            defaultLegal: ['cpa-cap21'],
            appliesWhen: { areas: ['Civil', 'ELCs'], tags: ['notice', 'tenancy', 'landlord'] },
            requires: ['oppName', 'parcel'],
            build(d) {
                const ref = nextRef();
                const period = d.statutoryPeriod || '14';
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Statutory Notice')}
                    <p>To:<br>
                    <strong>${escapeHtml(d.oppName || '[Tenant]')}</strong><br>
                    ${escapeHtml(d.oppAddress || '[Address]')}</p>
                    <p><strong>RE: STATUTORY NOTICE UNDER SECTION 4(2) OF THE LANDLORD AND TENANT (SHOPS, HOTELS AND CATERING ESTABLISHMENTS) ACT, CAP 301</strong></p>
                    <p>TAKE NOTICE that you are a tenant of our client, <strong>${escapeHtml(d.clientName || '[Landlord]')}</strong>, in respect of the premises known as <strong>${escapeHtml(d.parcel || '[premises]')}</strong>.</p>
                    <p>TAKE FURTHER NOTICE that our client hereby requires you to <strong>${escapeHtml(d.caseSummary || 'vacate and deliver up vacant possession of the said premises')}</strong> within <strong>${escapeHtml(period)} days</strong> from the date of service of this notice.</p>
                    <p>The grounds for this notice are: <strong>${escapeHtml(d.claimDesc || 'Non-payment of rent and breach of tenancy terms')}</strong>.</p>
                    <p>TAKE FURTHER NOTICE that unless you comply with this notice, our client shall apply to the Business Premises Rent Tribunal for the appropriate orders.</p>
                    <p>Yours faithfully,</p>
                    <p><strong>${escapeHtml(S.firm.name)}</strong></p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'demand-general',
            category: 'Demand',
            subCategory: 'Demand Notice',
            title: 'General Demand Notice',
            shortDesc: 'Generic demand notice for any claim.',
            typeCode: 'DEMAND',
            defaultLegal: ['cpa-cap21'],
            appliesWhen: { areas: [], tags: ['demand', 'notice'] },
            requires: ['oppName'],
            build(d) {
                const body = [
                    `We act for <strong>${escapeHtml(d.clientName || '[Client]')}</strong>, on whose instructions we write to you as follows.`,
                    `Our client's claim against you is: <strong>${escapeHtml(d.claimDesc || '[describe the claim]')}</strong>.`,
                    `Despite our client's requests, you have failed to address the said claim.`
                ];
                return demandLetterShell('Demand Notice', body, d);
            }
        });

        /* ==========================================================
           5.5  CONSENT
           ========================================================== */
        reg({
            id: 'consent-lcb',
            category: 'Consent',
            subCategory: '',
            title: 'Land Control Board Consent Application',
            shortDesc: 'Application for consent to a controlled transaction.',
            typeCode: 'CONSENT',
            defaultLegal: ['lcb-cap302', 'lra-2012'],
            appliesWhen: { areas: ['Conveyancing', 'ELCs'], tags: ['consent', 'land', 'lcb'] },
            requires: ['clientName', 'parcel'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Application for Consent of the Land Control Board')}
                    <p>To:<br>The Secretary,<br><strong>${escapeHtml(d.station || '___________')} Land Control Board</strong>.</p>
                    <p>We write on behalf of <strong>${escapeHtml(d.clientName || '[Applicant]')}</strong> of ${escapeHtml(d.clientAddress || '[address]')}, to apply for the consent of the Board in respect of the following controlled transaction.</p>
                    <div class="section-label">1. Land</div>
                    <p>Land Parcel Number: <strong>${escapeHtml(d.parcel || '[title]')}</strong>${d.parcelLocation ? `<br>Location: <strong>${escapeHtml(d.parcelLocation)}</strong>` : ''}${d.parcelArea ? `<br>Area: <strong>${escapeHtml(d.parcelArea)}</strong>` : ''}.</p>
                    <div class="section-label">2. Nature of Transaction</div>
                    <p><strong>${escapeHtml(d.caseSummary || '[Describe: transfer / lease / charge / subdivision / partition]')}</strong>.</p>
                    <div class="section-label">3. Parties</div>
                    <p>Applicant / Vendor: <strong>${escapeHtml(d.clientName || '[Vendor]')}</strong>.<br>
                    Purchaser / Transferee: <strong>${escapeHtml(d.oppName || '[Purchaser]')}</strong>.</p>
                    <div class="section-label">4. Consideration</div>
                    <p><strong>${escapeHtml(formatMoneyKes(d.consideration || 0))}</strong>.</p>
                    <p>We shall be grateful for the Board's favourable consideration of this application.</p>
                    <p>Yours faithfully,</p>
                    <p><strong>${escapeHtml(S.firm.name)}</strong></p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'consent-spousal',
            category: 'Consent',
            subCategory: '',
            title: 'Spousal Consent',
            shortDesc: 'Consent of a spouse under Article 45(3) of the Constitution.',
            typeCode: 'CONSENT',
            defaultLegal: ['constitution-art-45-3', 'mpa-2013', 'lra-2012'],
            appliesWhen: { areas: ['Conveyancing', 'ELCs', 'Succession'], tags: ['consent', 'spouse'] },
            requires: ['clientName'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Spousal Consent')}
                    <p>I, <strong>${escapeHtml(d.spousalConsent || '[Spouse Name]')}</strong>, of National Identity Card Number <strong>_____________</strong>, being the lawful spouse of <strong>${escapeHtml(d.clientName || '[Client]')}</strong>, do hereby give my free and voluntary consent to the following transaction:</p>
                    <div class="section-label">Property / Matter</div>
                    <p><strong>${escapeHtml(d.parcel || d.caseSummary || '[describe the property or matter]')}</strong>.</p>
                    <div class="section-label">Transaction</div>
                    <p><strong>${escapeHtml(d.claimDesc || '[sale / transfer / charge / lease / other disposition]')}</strong>.</p>
                    <p>I confirm that I have been fully informed of the nature and effect of the said transaction, and that I give my consent freely, without duress, coercion or undue influence, in accordance with Article 45(3) of the Constitution of Kenya, 2010.</p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        /* ==========================================================
           5.6  LAND
           ========================================================== */
        reg({
            id: 'land-transfer',
            category: 'Land',
            subCategory: 'Transfer Documents',
            title: 'Transfer of Land (RL 21)',
            shortDesc: 'Instrument of transfer of land.',
            typeCode: 'LAND',
            defaultLegal: ['lra-2012', 'stamp-duty-cap480'],
            appliesWhen: { areas: ['Conveyancing', 'ELCs'], tags: ['land', 'transfer', 'rl21'] },
            requires: ['clientName', 'oppName', 'parcel'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Transfer of Land — Form RL 21')}
                    <p>I, <strong>${escapeHtml(d.clientName || '[Transferor]')}</strong>, of Post Office Box Number ${escapeHtml(d.clientAddress || '____________')}, being the registered proprietor of the land described below, in consideration of <strong>${escapeHtml(formatMoneyKes(d.consideration || 0))}</strong>, hereby transfer to <strong>${escapeHtml(d.oppName || '[Transferee]')}</strong> of ${escapeHtml(d.oppAddress || '[address]')} all my right, title and interest in:</p>
                    <div class="section-label">Property</div>
                    <p>Title Number: <strong>${escapeHtml(d.parcel || '[title]')}</strong><br>
                    ${d.parcelLocation ? `Situated at: <strong>${escapeHtml(d.parcelLocation)}</strong><br>` : ''}
                    ${d.parcelArea ? `Area: <strong>${escapeHtml(d.parcelArea)}</strong>` : ''}</p>
                    <p>Dated at <strong>${escapeHtml(d.station || '___________')}</strong> this ______ day of ____________________, 20____.</p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'land-caution',
            category: 'Land',
            subCategory: 'Caution',
            title: 'Caution (Section 71, Land Registration Act)',
            shortDesc: 'Caution against dealings with land.',
            typeCode: 'LAND',
            defaultLegal: ['lra-2012', 'constitution-art-40'],
            appliesWhen: { areas: ['ELCs', 'Conveyancing'], tags: ['land', 'caution'] },
            requires: ['clientName', 'parcel'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Caution')}
                    <p>To:<br>The Land Registrar,<br><strong>${escapeHtml(d.station || '___________')} Land Registry</strong>.</p>
                    <p>TAKE NOTICE that I, <strong>${escapeHtml(d.clientName || '[Claimant]')}</strong>, of ${escapeHtml(d.clientAddress || '[address]')}, do hereby lodge a caution against the land described below, pursuant to section 71 of the Land Registration Act, 2012.</p>
                    <div class="section-label">Land</div>
                    <p>Title Number: <strong>${escapeHtml(d.parcel || '[title]')}</strong>${d.parcelLocation ? `<br>Situated at: <strong>${escapeHtml(d.parcelLocation)}</strong>` : ''}.</p>
                    <div class="section-label">Interest Claimed</div>
                    <p><strong>${escapeHtml(d.caseSummary || '[Describe the nature of the claim — e.g., purchaser\u2019s interest, equitable charge, unregistered lease]')}</strong>.</p>
                    <p>I therefore request that no disposition be registered against the said land until this caution is withdrawn or removed by order of the Court.</p>
                    <p>Yours faithfully,</p>
                    <p><strong>${escapeHtml(S.firm.name)}</strong></p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'land-registration-application',
            category: 'Land',
            subCategory: 'Application for Registration',
            title: 'Application for Registration',
            shortDesc: 'Application for registration of an interest or instrument.',
            typeCode: 'LAND',
            defaultLegal: ['lra-2012', 'registration-docs-cap285'],
            appliesWhen: { areas: ['Conveyancing', 'ELCs'], tags: ['land', 'registration'] },
            requires: ['clientName', 'parcel'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Application for Registration')}
                    <p>To:<br>The Land Registrar,<br><strong>${escapeHtml(d.station || '___________')} Land Registry</strong>.</p>
                    <p>We act for <strong>${escapeHtml(d.clientName || '[Applicant]')}</strong> and apply for the registration of the following instrument in respect of the land described below.</p>
                    <div class="section-label">Land</div>
                    <p>Title Number: <strong>${escapeHtml(d.parcel || '[title]')}</strong>${d.parcelLocation ? `<br>Situated at: <strong>${escapeHtml(d.parcelLocation)}</strong>` : ''}.</p>
                    <div class="section-label">Instrument</div>
                    <p><strong>${escapeHtml(d.caseSummary || '[Name of instrument — Transfer / Charge / Lease / Discharge / Caution]')}</strong>.</p>
                    <div class="section-label">Attached Documents</div>
                    <ol>
                        <li>Original title</li>
                        <li>Duly executed instrument</li>
                        <li>Land Control Board consent (where applicable)</li>
                        <li>Stamp duty receipt / exemption</li>
                        <li>Rates clearance certificate</li>
                        <li>Rent clearance certificate (where applicable)</li>
                        <li>KRA PIN certificate and ID copies of parties</li>
                        ${d.stampDuty ? `<li>iTax / Stamp Duty reference: <strong>${escapeHtml(d.stampDuty)}</strong></li>` : ''}
                        ${d.ratesClearance ? `<li>Rates Clearance No.: <strong>${escapeHtml(d.ratesClearance)}</strong></li>` : ''}
                    </ol>
                    <p>We shall be grateful if the registration is effected and the title issued in the name of the applicant.</p>
                    <p>Yours faithfully,</p>
                    <p><strong>${escapeHtml(S.firm.name)}</strong></p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'land-lcb-application',
            category: 'Land',
            subCategory: 'Application for Land Control Board',
            title: 'Application for Land Control Board Consent',
            shortDesc: 'Form for LCB consent.',
            typeCode: 'LAND',
            defaultLegal: ['lcb-cap302'],
            appliesWhen: { areas: ['Conveyancing'], tags: ['land', 'lcb'] },
            requires: ['clientName', 'parcel'],
            build(d) {
                return TEMPLATES['consent-lcb'].build(d);
            }
        });

        /* ==========================================================
           5.7  ACKNOWLEDGEMENT RECEIPTS
           ========================================================== */
        reg({
            id: 'receipt-acknowledgement',
            category: 'Acknowledgement Receipts',
            subCategory: '',
            title: 'Acknowledgement Receipt',
            shortDesc: 'Acknowledgement of payment received.',
            typeCode: 'RECEIPT',
            defaultLegal: ['evidence-cap80'],
            appliesWhen: { areas: [], tags: ['receipt', 'payment', 'acknowledgement'] },
            requires: ['clientName'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${docTitle('Acknowledgement Receipt')}
                    <p>I, <strong>${escapeHtml(d.clientName || '[Payee]')}</strong>, of National Identity Card Number <strong>${escapeHtml(d.clientId || '____________')}</strong>, hereby acknowledge receipt of <strong>${escapeHtml(formatMoneyKes(d.claimAmount || 0))}</strong> from <strong>${escapeHtml(d.oppName || '[Payer]')}</strong> of ${escapeHtml(d.oppAddress || '[address]')}, being <strong>${escapeHtml(d.claimDesc || '[purpose of payment]')}</strong>.</p>
                    <p>The sum has been received in <strong>${d.caseSummary || '[cash / M-PESA / bank transfer / cheque]'}</strong>${d.claimNumber ? `, reference <strong>${escapeHtml(d.claimNumber)}</strong>` : ''}.</p>
                    <p>Dated at <strong>${escapeHtml(d.station || '___________')}</strong> this ______ day of ____________________, 20____.</p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        /* ==========================================================
           5.8  GENERAL — pleadings & notices
           ========================================================== */
        reg({
            id: 'general-notice-of-motion',
            category: 'General',
            subCategory: '',
            title: 'Notice of Motion',
            shortDesc: 'Chamber application under the Civil Procedure Rules.',
            typeCode: 'NOTICE',
            defaultLegal: ['cpa-cap21', 'cpr-2010', 'constitution-art-50'],
            appliesWhen: { areas: ['Civil', 'ELCs', 'Succession', 'Divorce'], tags: ['motion', 'application'] },
            requires: ['clientName', 'caseNo'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${courtHeader('')}
                    ${partiesBlock('Applicant', 'Respondent')}
                    ${docTitle('Notice of Motion')}
                    <p>TAKE NOTICE that this Honourable Court will be moved on the ______ day of ____________________, 20____, at 9.00 o'clock in the forenoon or so soon thereafter as counsel for the Applicant can be heard, for orders that:</p>
                    <ol>
                        <li>Spent.</li>
                        <li>This Honourable Court be pleased to grant <strong>${escapeHtml(d.caseSummary || '[state the substantive prayer]')}</strong>.</li>
                        <li>The costs of this application be provided for.</li>
                    </ol>
                    <p>WHICH APPLICATION is based on the grounds set out in the supporting affidavit annexed hereto, and on the following further grounds:</p>
                    <ol>
                        <li>The Applicant has a <em>locus standi</em> to bring this application.</li>
                        <li>The application is made in good faith and discloses a prima facie case with a probability of success.</li>
                        <li>Unless the orders sought are granted, the Applicant will suffer irreparable loss and damage.</li>
                        <li>It is in the interest of justice that the orders sought be granted.</li>
                    </ol>
                    <p>DATED at <strong>${escapeHtml(d.station || '___________')}</strong> this ______ day of ____________________, 20____.</p>
                    ${signatureBlocks()}
                    <div class="section-label">Drawn & Filed by</div>
                    <p>${escapeHtml(S.firm.name)}<br>${escapeHtml(S.firm.address)}</p>
                    <div class="section-label">To be served upon</div>
                    <p>${escapeHtml(d.oppAdvocate || d.oppName || '[Respondent\u2019s Advocate]')}<br>${escapeHtml(d.oppAddress || '[address]')}</p>
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'general-plaint',
            category: 'General',
            subCategory: '',
            title: 'Plaint',
            shortDesc: 'Statement of claim.',
            typeCode: 'PLEADING',
            defaultLegal: ['cpa-cap21', 'cpr-2010', 'constitution-art-50'],
            appliesWhen: { areas: ['Civil', 'ELCs'], tags: ['plaint', 'pleading', 'claim'] },
            requires: ['clientName', 'oppName', 'caseNo'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${courtHeader('')}
                    ${partiesBlock('Plaintiff', 'Defendant')}
                    ${docTitle('Plaint')}
                    <div class="section-label">1. The Parties</div>
                    <p>The Plaintiff is <strong>${escapeHtml(d.clientName || '[Plaintiff]')}</strong>, of Post Office Box Number ${escapeHtml(d.clientAddress || '____________')}, in the Republic of Kenya.</p>
                    <p>The Defendant is <strong>${escapeHtml(d.oppName || '[Defendant]')}</strong>, of ${escapeHtml(d.oppAddress || '[address]')}.</p>
                    <div class="section-label">2. Facts</div>
                    <p>${escapeHtml(d.caseSummary || '[Set out the material facts giving rise to the claim.]')}</p>
                    <div class="section-label">3. Cause of Action</div>
                    <p>The Plaintiff\u2019s cause of action against the Defendant is for <strong>${escapeHtml(d.claimDesc || '[state the cause of action]')}</strong>.</p>
                    <div class="section-label">4. Particulars of Loss</div>
                    <p>The Plaintiff has suffered loss and damage amounting to <strong>${escapeHtml(formatMoneyKes(d.claimAmount || 0))}</strong>.</p>
                    <div class="section-label">5. Reliefs Sought</div>
                    <p>WHEREFORE the Plaintiff prays for judgment against the Defendant for:</p>
                    <ol>
                        <li>The sum of <strong>${escapeHtml(formatMoneyKes(d.claimAmount || 0))}</strong>.</li>
                        <li>Interest at court rate from the date of filing suit until payment in full.</li>
                        <li>Costs of the suit.</li>
                        <li>Any other or further relief this Honourable Court may deem just.</li>
                    </ol>
                    <p>DATED at <strong>${escapeHtml(d.station || '___________')}</strong> this ______ day of ____________________, 20____.</p>
                    ${signatureBlocks()}
                    <div class="section-label">Drawn & Filed by</div>
                    <p>${escapeHtml(S.firm.name)}<br>${escapeHtml(S.firm.address)}</p>
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'general-defence',
            category: 'General',
            subCategory: '',
            title: 'Statement of Defence',
            shortDesc: 'Defence to a plaint.',
            typeCode: 'PLEADING',
            defaultLegal: ['cpa-cap21', 'cpr-2010'],
            appliesWhen: { areas: ['Civil', 'ELCs'], tags: ['defence', 'pleading'] },
            requires: ['clientName', 'oppName', 'caseNo'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${courtHeader('')}
                    ${partiesBlock('Defendant', 'Plaintiff')}
                    ${docTitle('Statement of Defence')}
                    <p>The Defendant denies each and every allegation contained in the Plaint as if the same were set out verbatim and traversed seriatim.</p>
                    <div class="section-label">1. The Parties</div>
                    <p>The Defendant admits the description of the parties as set out in paragraphs 1 and 2 of the Plaint.</p>
                    <div class="section-label">2. Response to Facts</div>
                    <p>${escapeHtml(d.caseSummary || '[Set out the Defendant\u2019s version of the facts and the specific denials.]')}</p>
                    <div class="section-label">3. Reliefs</div>
                    <p>WHEREFORE the Defendant prays that:</p>
                    <ol>
                        <li>The Plaintiff\u2019s suit be dismissed with costs.</li>
                        <li>The costs of this defence be borne by the Plaintiff.</li>
                        <li>Any other or further relief this Honourable Court may deem fit.</li>
                    </ol>
                    <p>DATED at <strong>${escapeHtml(d.station || '___________')}</strong> this ______ day of ____________________, 20____.</p>
                    ${signatureBlocks()}
                    <div class="section-label">Drawn & Filed by</div>
                    <p>${escapeHtml(S.firm.name)}<br>${escapeHtml(S.firm.address)}</p>
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'general-witness-statement',
            category: 'General',
            subCategory: '',
            title: 'Witness Statement',
            shortDesc: 'Statement of a witness for filing.',
            typeCode: 'GENERAL',
            defaultLegal: ['cpr-2010', 'evidence-cap80'],
            appliesWhen: { areas: ['Civil', 'ELCs', 'Criminal'], tags: ['witness', 'statement'] },
            requires: ['clientName'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${courtHeader('')}
                    ${docTitle('Witness Statement')}
                    <p>I, <strong>${escapeHtml(d.clientName || '[Witness]')}</strong>, of Post Office Box Number ${escapeHtml(d.clientAddress || '____________')}, in the Republic of Kenya, do hereby state as follows:</p>
                    <ol>
                        <li>I am an adult of sound mind and I am competent to make this statement.</li>
                        <li>I am the <strong>${escapeHtml(d.caseSummary || '[role of witness]')}</strong> in this matter.</li>
                        <li>The facts of this case are within my personal knowledge. I state as follows: ______________________________________.</li>
                        <li>I make this statement in support of the case herein.</li>
                    </ol>
                    <p>I declare that what is stated herein is true to the best of my knowledge, information and belief.</p>
                    <p>DATED at <strong>${escapeHtml(d.station || '___________')}</strong> this ______ day of ____________________, 20____.</p>
                    ${signatureBlocks()}
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        reg({
            id: 'general-list-of-documents',
            category: 'General',
            subCategory: '',
            title: 'List of Documents',
            shortDesc: 'List of documents to be relied upon.',
            typeCode: 'GENERAL',
            defaultLegal: ['cpr-2010', 'evidence-cap80'],
            appliesWhen: { areas: ['Civil', 'ELCs'], tags: ['documents', 'list'] },
            requires: ['caseNo'],
            build(d) {
                const ref = nextRef();
                const html = `
                    ${refLine(ref)}
                    ${courtHeader('')}
                    ${partiesBlock('Plaintiff', 'Defendant')}
                    ${docTitle('List of Documents')}
                    <p>The following is a list of documents to be relied upon at the hearing of this matter:</p>
                    <ol>
                        <li>__________________________ (dated ______________)</li>
                        <li>__________________________ (dated ______________)</li>
                        <li>__________________________ (dated ______________)</li>
                        <li>__________________________ (dated ______________)</li>
                    </ol>
                    <p>DATED at <strong>${escapeHtml(d.station || '___________')}</strong> this ______ day of ____________________, 20____.</p>
                    ${signatureBlocks()}
                    <div class="section-label">Drawn & Filed by</div>
                    <p>${escapeHtml(S.firm.name)}<br>${escapeHtml(S.firm.address)}</p>
                    ${legalBasisBlock(d.__legal || this.defaultLegal)}
                    ${draftedByBlock()}
                `;
                return { html, plainText: stripTags(html) };
            }
        });

        /* ==========================================================
           6. nextRef() — thin wrapper that memoizes within a single build
           ========================================================== */
        let __buildRef = null;
        function nextRef() {
            if (!__buildRef) __buildRef = K.nextRefNumber('MISC');
            return __buildRef;
        }
        function resetRef() { __buildRef = null; }

        /* ==========================================================
           7. stripTags — for .docx/plain-text export
           ========================================================== */
        function stripTags(html) {
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            return (tmp.textContent || tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
        }

        /* ==========================================================
           8. LEGAL BASIS RENDERING (checklist UI)
           ========================================================== */
        function renderLegalLibrary() {
            const wrap = $('genLegalList');
            if (!wrap) return;
            const groups = {};
            Object.keys(LEGAL_LIBRARY).forEach(id => {
                const item = LEGAL_LIBRARY[id];
                if (!groups[item.group]) groups[item.group] = [];
                groups[item.group].push({ id, ...item });
            });
            const frag = document.createDocumentFragment();
            Object.keys(groups).sort().forEach(groupName => {
                const h = el('div', {
                    style: {
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.62rem',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--muted)',
                        marginTop: '0.5rem',
                        padding: '0.15rem 0.25rem'
                    }
                }, groupName);
                frag.appendChild(h);
                groups[groupName].forEach(item => {
                    const cb = el('input', { type: 'checkbox', 'data-legal-id': item.id });
                    cb.checked = S.pickedLegal.has(item.id);
                    cb.addEventListener('change', () => {
                        if (cb.checked) S.pickedLegal.add(item.id);
                        else S.pickedLegal.delete(item.id);
                        K.scheduleAutosave();
                    });
                    const row = el('label', { class: 'gen-legal-item' }, [
                        cb,
                        el('span', {}, [
                            el('span', { class: 'li-title' }, item.title),
                            el('span', { class: 'li-desc' }, item.desc || '')
                        ])
                    ]);
                    frag.appendChild(row);
                });
            });
            wrap.innerHTML = '';
            wrap.appendChild(frag);
        }

        /* ==========================================================
           9. DOC PICKER RENDERING
           ========================================================== */
        function renderDocPicker() {
            const wrap = $('genDocPicker');
            if (!wrap) return;
            const filter = ($('fDocSearch')?.value || '').toLowerCase().trim();
            const ids = Object.keys(TEMPLATES).sort((a, b) => {
                const A = TEMPLATES[a], B = TEMPLATES[b];
                if (A.category === B.category) return A.title.localeCompare(B.title);
                return A.category.localeCompare(B.category);
            });
            const frag = document.createDocumentFragment();
            ids.forEach(id => {
                const t = TEMPLATES[id];
                const hay = (t.title + ' ' + t.category + ' ' + (t.subCategory || '') + ' ' + t.shortDesc).toLowerCase();
                if (filter && !hay.includes(filter)) return;
                const cb = el('input', { type: 'checkbox' });
                cb.checked = S.pickedDocs.has(id);
                cb.addEventListener('change', () => {
                    if (cb.checked) S.pickedDocs.add(id);
                    else S.pickedDocs.delete(id);
                    K.scheduleAutosave();
                    if (window.kkGenRenderPreview) window.kkGenRenderPreview();
                });
                const card = el('label', { class: 'gen-doc-pick' + (cb.checked ? ' picked' : '') }, [
                    cb,
                    el('div', { class: 'pick-text' }, [
                        el('div', { class: 'pick-title' }, t.title),
                        el('div', { class: 'pick-cat' }, t.category + (t.subCategory ? ' › ' + t.subCategory : ''))
                    ])
                ]);
                card.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT') return;
                });
                cb.addEventListener('change', () => {
                    card.classList.toggle('picked', cb.checked);
                });
                frag.appendChild(card);
            });
            // Custom templates
            S.customTemplates.forEach(ct => {
                const hay = (ct.name + ' ' + ct.category + ' ' + (ct.description || '')).toLowerCase();
                if (filter && !hay.includes(filter)) return;
                const id = 'custom:' + ct.id;
                const cb = el('input', { type: 'checkbox' });
                cb.checked = S.pickedDocs.has(id);
                cb.addEventListener('change', () => {
                    if (cb.checked) S.pickedDocs.add(id);
                    else S.pickedDocs.delete(id);
                    K.scheduleAutosave();
                    if (window.kkGenRenderPreview) window.kkGenRenderPreview();
                });
                const card = el('label', { class: 'gen-doc-pick' + (cb.checked ? ' picked' : '') }, [
                    cb,
                    el('div', { class: 'pick-text' }, [
                        el('div', { class: 'pick-title' }, ct.name),
                        el('div', { class: 'pick-cat' }, 'Custom › ' + (ct.category || 'Uncategorised'))
                    ])
                ]);
                cb.addEventListener('change', () => { card.classList.toggle('picked', cb.checked); });
                frag.appendChild(card);
            });
            wrap.innerHTML = '';
            wrap.appendChild(frag);
        }

        /* ==========================================================
           10. CUSTOM TEMPLATES — CRUD
           ========================================================== */
        function renderCustomTemplateList() {
            const wrap = $('genCustomList');
            if (!wrap) return;
            if (!S.customTemplates.length) {
                wrap.innerHTML = '<p style="font-size:0.75rem; color:var(--muted); margin:0;">No custom templates yet. Click "New custom template" below.</p>';
                return;
            }
            wrap.innerHTML = '';
            S.customTemplates.forEach(ct => {
                const node = el('div', { class: 'gen-custom-item' }, [
                    el('div', {}, [
                        el('div', { class: 'ci-name' }, ct.name),
                        el('div', { class: 'ci-meta' }, (ct.category || 'Custom') + ' · ' + (ct.updatedAt || ct.createdAt || ''))
                    ]),
                    el('div', { class: 'ci-actions' }, [
                        el('button', {
                            class: 'gen-btn',
                            style: { border: '1px solid var(--rule)', fontSize: '0.65rem', padding: '0.25rem 0.6rem' },
                            onclick: () => editCustomTemplate(ct.id)
                        }, [el('i', { class: 'fas fa-pen' })]),
                        el('button', {
                            class: 'gen-btn',
                            style: { border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.65rem', padding: '0.25rem 0.6rem' },
                            onclick: () => deleteCustomTemplate(ct.id)
                        }, [el('i', { class: 'fas fa-trash' })])
                    ])
                ]);
                wrap.appendChild(node);
            });
        }

        function editCustomTemplate(id) {
            const ct = S.customTemplates.find(x => x.id === id);
            if (!ct) return;
            $('customEditId').value = ct.id;
            $('customName').value   = ct.name;
            $('customCategory').value = ct.category || 'Custom';
            $('customDescription').value = ct.description || '';
            $('customBody').value   = ct.body || '';
            K.openModal('genCustomModal');
        }

        function newCustomTemplate() {
            $('customEditId').value = '';
            $('customName').value = '';
            $('customCategory').value = 'Custom';
            $('customDescription').value = '';
            $('customBody').value = '<div class="doc-title">YOUR DOCUMENT TITLE</div>\n<p>Dear {{opposing.name}},</p>\n<p>Your content here with {{client.name}}, {{case.number}}, {{court}}, {{station}}, and {{today}}.</p>';
            K.openModal('genCustomModal');
        }

        function deleteCustomTemplate(id) {
            if (!confirm('Delete this custom template?')) return;
            S.customTemplates = S.customTemplates.filter(x => x.id !== id);
            K.lsSet(K.LS.custom, S.customTemplates);
            renderCustomTemplateList();
            renderDocPicker();
            toast('Custom template deleted.', 'info');
        }

        function saveCustomTemplate() {
            const id = $('customEditId').value;
            const name = $('customName').value.trim();
            const category = $('customCategory').value;
            const description = $('customDescription').value.trim();
            const body = $('customBody').value;
            if (!name) { toast('Please give the template a name.', 'warning'); return; }
            if (!body.trim()) { toast('The template body cannot be empty.', 'warning'); return; }
            if (id) {
                const ct = S.customTemplates.find(x => x.id === id);
                Object.assign(ct, { name, category, description, body, updatedAt: K.getToday() });
            } else {
                S.customTemplates.push({
                    id: 'ct_' + Date.now().toString(36),
                    name, category, description, body,
                    createdAt: K.getToday(),
                    updatedAt: K.getToday()
                });
            }
            K.lsSet(K.LS.custom, S.customTemplates);
            K.closeModal('genCustomModal');
            renderCustomTemplateList();
            renderDocPicker();
            toast('Custom template saved.', 'success');
        }

        /* ==========================================================
           11. CUSTOM TEMPLATE PLACEHOLDER ENGINE
           ========================================================== */
        function renderCustomTemplate(ct, d) {
            const map = {
                'client.name':    d.clientName || '',
                'client.id':      d.clientId || '',
                'client.pin':     d.clientPin || '',
                'client.email':   d.clientEmail || '',
                'client.phone':   d.clientPhone || '',
                'client.address': d.clientAddress || '',
                'client.occupation': d.clientOccupation || '',
                'client.gender':  d.clientGender || '',
                'client.nextofkin': d.clientNextOfKin || '',
                'opposing.name':  d.oppName || '',
                'opposing.id':    d.oppId || '',
                'opposing.phone': d.oppPhone || '',
                'opposing.address': d.oppAddress || '',
                'opposing.advocate': d.oppAdvocate || '',
                'case.number':    d.caseNo || '',
                'case.name':      d.caseName || '',
                'case.tracking':  d.tracking || '',
                'case.citation':  d.citation || '',
                'case.summary':   d.caseSummary || '',
                'case.filingdate': d.filingDate || '',
                'court':          d.court || '',
                'station':        d.station || '',
                'advocate.name':  d.advocateName || S.settings?.advocate?.name || '',
                'advocate.lsk':   d.advocateLsk || S.settings?.advocate?.lsk || '',
                'advocate.partner': d.partner || S.settings?.advocate?.partner || '',
                'firm.name':      S.firm.name,
                'firm.address':   S.firm.address,
                'firm.phone':     S.firm.phone,
                'firm.email':     S.firm.email,
                'firm.website':   S.firm.website,
                'demand.amount':  d.claimAmount ? formatMoneyKes(d.claimAmount) : '',
                'demand.period':  d.statutoryPeriod,
                'demand.desc':    d.claimDesc || '',
                'parcel.title':   d.parcel || '',
                'parcel.location':d.parcelLocation || '',
                'parcel.area':    d.parcelArea || '',
                'consideration':  d.consideration ? formatMoneyKes(d.consideration) : '',
                'accident.date':  d.accidentDate || '',
                'accident.location': d.accidentLocation || '',
                'motor.reg':      d.motorReg || '',
                'claim.number':   d.claimNumber || '',
                'insurer':        d.insurer || '',
                'today':          formatLongDate(getToday()),
                'today.short':    getToday(),
                'ref':            ''  // populated below
            };
            const ref = K.nextRefNumber('MISC');
            map['ref'] = ref;

            let body = ct.body || '';
            // Replace {{...}} placeholders
            body = body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
                const v = map[key];
                return v != null ? escapeHtml(v) : '';
            });
            // Strip any unclosed placeholder braces
            body = body.replace(/\{\{[^}]*\}\}/g, '');

            const html = `
                ${refLine(ref)}
                ${body}
                ${signatureBlocks()}
                ${legalBasisBlock(Array.from(S.pickedLegal))}
                ${draftedByBlock()}
            `;
            return { html, plainText: stripTags(html) };
        }

        /* ==========================================================
           12. SMART MODE — score templates against case metadata
           ========================================================== */
        function smartSuggestTemplates() {
            const d = collectData();
            const blob = [
                d.caseSummary, d.claimDesc, d.caseNo, d.caseName, d.parcel,
                d.priorAgreementDesc, d.accidentLocation, d.insurer, d.claimNumber
            ].filter(Boolean).join(' ').toLowerCase();

            const areaHints = [];
            if (/land|parcel|title|elc|convey|transfer|caution|survey|acre|plot/i.test(blob)) areaHints.push('ELCs', 'Conveyancing');
            if (/divorce|matrimon|marriage|spous|custody/i.test(blob)) areaHints.push('Divorce', 'Succession');
            if (/child|minor|custody|guardian/i.test(blob)) areaHints.push('Children');
            if (/probate|succession|grant|deceased|will|administrat/i.test(blob)) areaHints.push('Succession');
            if (/employ|salary|labour|termination|redundan/i.test(blob)) areaHints.push('Employment');
            if (/accident|injur|motor|vehicle|insur|claim/i.test(blob)) areaHints.push('Running Down');
            if (/criminal|accus|charge|police|ob |ob number/i.test(blob)) areaHints.push('Criminal');
            if (/debt|loan|owed|default/i.test(blob)) areaHints.push('Civil');
            if (/tenan|lease|rent|landlord|evict/i.test(blob)) areaHints.push('Civil', 'ELCs');
            if (/kadhi|islamic|sharia/i.test(blob)) areaHints.push('Kadhi');
            if (/tribunal|business premises/i.test(blob)) areaHints.push('Tribunal');

            const scored = [];
            Object.keys(TEMPLATES).forEach(id => {
                const t = TEMPLATES[id];
                let score = 0;
                const tags = (t.appliesWhen?.tags || []).map(x => x.toLowerCase());
                tags.forEach(tag => { if (blob.includes(tag)) score += 5; });
                const areas = (t.appliesWhen?.areas || []);
                areas.forEach(a => { if (areaHints.includes(a)) score += 10; });
                scored.push({ id, score, title: t.title });
            });
            return scored.sort((a, b) => b.score - a.score).filter(x => x.score > 0);
        }

        /* ==========================================================
           13. GUIDED WIZARD
           ========================================================== */
        const WIZARD_STEPS = [
            {
                id: 'matter',
                question: 'What type of matter is this?',
                hint: 'Choose the practice area. This narrows the wizard.',
                choices: [
                    { value: 'land',        label: 'Land / Conveyancing (ELC)', areas: ['ELCs','Conveyancing'] },
                    { value: 'civil',       label: 'Civil claim (debt, contract, tort)', areas: ['Civil'] },
                    { value: 'succession',  label: 'Succession / Probate', areas: ['Succession'] },
                    { value: 'family',      label: 'Family / Divorce / Children', areas: ['Divorce','Children'] },
                    { value: 'employment',  label: 'Employment & Labour', areas: ['Employment'] },
                    { value: 'criminal',    label: 'Criminal', areas: ['Criminal'] },
                    { value: 'accident',    label: 'Running Down / Accident claim', areas: ['Running Down'] }
                ]
            },
            {
                id: 'side',
                question: 'Which side is your client on?',
                hint: 'This determines whether you file or respond.',
                choices: [
                    { value: 'plaintiff', label: 'Plaintiff / Applicant / Claimant' },
                    { value: 'defendant', label: 'Defendant / Respondent' }
                ]
            },
            {
                id: 'stage',
                question: 'At what stage is the matter?',
                hint: 'Filing, responding, or enforcement / demand.',
                choices: [
                    { value: 'predemand', label: 'Before filing — demand / notice' },
                    { value: 'pleadings', label: 'Pleadings — plaint, defence, motion' },
                    { value: 'affidavit', label: 'Affidavit / evidence stage' },
                    { value: 'agreement', label: 'Transactional — agreement, transfer, consent' }
                ]
            },
            {
                id: 'urgency',
                question: 'Is there any urgency or risk?',
                hint: 'Optional — helps suggest cautions, injunctions, etc.',
                choices: [
                    { value: 'none',    label: 'None' },
                    { value: 'urgent',  label: 'Urgent — need an interim order' },
                    { value: 'fraud',   label: 'Fraud / forgery suspected' }
                ]
            }
        ];

        function renderWizardSteps() {
            const wrap = $('genWizardSteps');
            if (!wrap) return;
            wrap.innerHTML = '';
            WIZARD_STEPS.forEach((step, i) => {
                const cls = 'gen-wizard-step' + (i === WizardState.step ? ' active' : (i < WizardState.step ? ' done' : ''));
                wrap.appendChild(el('div', { class: cls }, `Step ${i + 1} · ${step.question.split(' ').slice(0, 3).join(' ')}`));
            });
        }

        const WizardState = { step: 0, answers: {} };

        function renderWizardBody() {
            const body = $('genWizardBody');
            const step = WIZARD_STEPS[WizardState.step];
            if (!body || !step) return;
            body.innerHTML = '';
            body.appendChild(el('div', { class: 'gen-wizard-question' }, step.question));
            body.appendChild(el('div', { class: 'gen-wizard-hint' }, step.hint || ''));
            step.choices.forEach(ch => {
                const cb = el('input', { type: 'radio', name: 'wiz_' + step.id, value: ch.value });
                cb.checked = WizardState.answers[step.id] === ch.value;
                cb.addEventListener('change', () => { WizardState.answers[step.id] = ch.value; });
                const row = el('label', { class: 'gen-check', style: { marginBottom: '0.35rem', cursor: 'pointer' } }, [
                    cb,
                    el('span', {}, ch.label)
                ]);
                body.appendChild(row);
            });
            // Nav buttons
            $('genWizardBack').disabled = WizardState.step === 0;
            const nextBtn = $('genWizardNext');
            nextBtn.innerHTML = WizardState.step === WIZARD_STEPS.length - 1
                ? 'Assemble documents <i class="fas fa-wand-magic-sparkles"></i>'
                : 'Next <i class="fas fa-arrow-right"></i>';
            renderWizardSteps();
        }

        function wizardNext() {
            if (WizardState.step < WIZARD_STEPS.length - 1) {
                WizardState.step++;
                renderWizardBody();
                return;
            }
            wizardAssemble();
        }
        function wizardBack() {
            if (WizardState.step > 0) { WizardState.step--; renderWizardBody(); }
        }

        function wizardAssemble() {
            const a = WizardState.answers;
            const picks = new Set();
            if (a.matter === 'land') {
                if (a.stage === 'agreement') { picks.add('agreement-sale-land'); picks.add('consent-lcb'); picks.add('land-transfer'); }
                if (a.stage === 'predemand') { picks.add('demand-eviction'); picks.add('demand-general'); }
                if (a.stage === 'pleadings') { picks.add('general-plaint'); picks.add('general-notice-of-motion'); }
                if (a.stage === 'affidavit') { picks.add('affidavit-land-transfer'); picks.add('affidavit-forced-transfer'); }
                if (a.urgency === 'fraud') { picks.add('affidavit-forced-transfer'); picks.add('land-caution'); }
                if (a.urgency === 'urgent') { picks.add('general-notice-of-motion'); picks.add('land-caution'); }
            } else if (a.matter === 'civil') {
                if (a.stage === 'predemand') picks.add('demand-debt');
                if (a.stage === 'pleadings') picks.add('general-plaint');
                if (a.side === 'defendant' && a.stage === 'pleadings') picks.add('general-defence');
                if (a.stage === 'affidavit') picks.add('general-witness-statement');
            } else if (a.matter === 'succession') {
                if (a.stage === 'affidavit') picks.add('affidavit-customary-marriage');
                picks.add('general-notice-of-motion');
            } else if (a.matter === 'family') {
                if (a.stage === 'affidavit') picks.add('affidavit-customary-marriage');
                if (a.urgency === 'urgent') picks.add('general-notice-of-motion');
            } else if (a.matter === 'employment') {
                if (a.stage === 'pleadings') picks.add('general-plaint');
                if (a.stage === 'predemand') picks.add('demand-general');
            } else if (a.matter === 'criminal') {
                picks.add('affidavit-lost-document');
            } else if (a.matter === 'accident') {
                if (a.stage === 'predemand') picks.add('demand-debt');
                if (a.stage === 'pleadings') picks.add('general-plaint');
            }
            if (!picks.size) { toast('The wizard could not determine a document set for these answers.', 'warning'); return; }
            S.pickedDocs = picks;
            // Re-render picker
            renderDocPicker();
            K.closeModal('genWizardModal');
            toast(`Wizard assembled ${picks.size} document${picks.size !== 1 ? 's' : ''}. Preview updated.`, 'success');
            if (window.kkGenRenderPreview) window.kkGenRenderPreview();
        }

        /* ==========================================================
           14. RENDER PREVIEW
           ========================================================== */
        function renderPreview() {
            const stack = $('genPageStack');
            if (!stack) return;
            if (!S.pickedDocs.size) {
                stack.innerHTML = '';
                const empty = el('div', { class: 'gen-empty-preview', id: 'genEmptyPreview' }, [
                    el('i', { class: 'fas fa-file-signature' }),
                    el('h3', {}, 'No document yet'),
                    el('p', {}, 'Fill in the client and case details on the left, then pick one or more documents from the picker. Your live preview appears here — ready to print, export, or save to the case file.')
                ]);
                stack.appendChild(empty);
                $('genPreviewLabel').textContent = 'Preview — no document selected';
                return;
            }
            const d = collectData();
            const docs = [];
            S.pickedDocs.forEach(id => {
                if (id.startsWith('custom:')) {
                    const ct = S.customTemplates.find(x => x.id === id.slice(7));
                    if (!ct) return;
                    resetRef();
                    const r = renderCustomTemplate(ct, d);
                    docs.push({ id, title: ct.name, html: wrapPage(ct.name, r.html) });
                    return;
                }
                const t = TEMPLATES[id];
                if (!t) return;
                // Set document-scoped legal picks: if user has picked any, use theirs, else template default
                const userLegal = Array.from(S.pickedLegal);
                d.__legal = userLegal.length ? userLegal : t.defaultLegal;
                resetRef();
                const r = t.build(d);
                const label = (t.category + (t.subCategory ? ' › ' + t.subCategory : '')) + ' — ' + t.title;
                docs.push({ id, title: label, html: wrapPage(t.title, r.html) });
            });
            S.currentPreview = docs;

            stack.innerHTML = '';
            docs.forEach(doc => {
                const page = el('div', { class: 'gen-page' });
                page.innerHTML = doc.html;
                stack.appendChild(page);
            });

            $('genPreviewLabel').textContent =
                `Preview — ${docs.length} document${docs.length !== 1 ? 's' : ''}`;
        }
        window.kkGenRenderPreview = renderPreview;

        /* Wrap document body in letterhead + footer */
        function wrapPage(title, innerHtml) {
            const logo = K.kkGenGetLogo();
            const ref = (S.currentPreview?.[0]?.ref) || '';
            return `
                <div class="gen-letterhead">
                    <div class="lh-left">
                        <img class="lh-logo" src="${logo}" alt="Firm logo">
                        <div class="lh-firm">
                            <div class="lh-firm-name">${escapeHtml(S.firm.name)}</div>
                            <div class="lh-firm-tag">Advocates &amp; Legal Consultants</div>
                        </div>
                    </div>
                    <div class="lh-right">
                        <span class="lh-line">${escapeHtml(S.firm.address)}</span>
                        <span class="lh-line">Tel: ${escapeHtml(S.firm.phone)}</span>
                        <span class="lh-line">${escapeHtml(S.firm.email)}</span>
                        <span class="lh-line">${escapeHtml(S.firm.website)}</span>
                    </div>
                </div>
                <div class="gen-doc-body">${innerHtml}</div>
                <div class="gen-page-footer">
                    <span>${escapeHtml(S.firm.name)} · ${escapeHtml(S.firm.address)}</span>
                    <span>Generated ${K.getToday()} · Kuria Karatu Document Generator</span>
                </div>
                <div class="doc-version">v1.0</div>
            `;
        }

        /* ==========================================================
           15. AI HOOK (pluggable)
           ========================================================== */
        const AI = {
            async generate({ prompt, docType, tone }) {
                if (typeof window.KKAI?.generate === 'function') {
                    return window.KKAI.generate({ prompt, docType, tone });
                }
                throw new Error(
                    'AI drafting is not yet connected. ' +
                    'Wire window.KKAI.generate({ prompt, docType, tone }) to your provider, ' +
                    'or use the Wizard / Rule modes.'
                );
            }
        };

        async function runAiDraft() {
            const prompt = $('aiPrompt').value.trim();
            if (!prompt) { toast('Please describe the document you need.', 'warning'); return; }
            const status = $('aiStatus');
            status.style.display = 'block';
            status.textContent = 'Drafting…';
            try {
                const result = await AI.generate({
                    prompt,
                    docType: $('aiDocType').value.trim(),
                    tone: $('aiTone').value
                });
                const html = typeof result === 'string' ? result : (result && result.html) || '';
                if (!html) throw new Error('AI returned an empty draft.');
                const id = 'ai_' + Date.now().toString(36);
                const title = $('aiDocType').value.trim() || 'AI-Drafted Document';
                S.customTemplates.push({
                    id: id,
                    name: title,
                    category: 'AI Drafts',
                    description: prompt.slice(0, 120),
                    body: html,
                    createdAt: K.getToday(),
                    updatedAt: K.getToday()
                });
                K.lsSet(K.LS.custom, S.customTemplates);
                S.pickedDocs.add('custom:' + id);
                renderDocPicker();
                renderCustomTemplateList();
                closeModal('genAiModal');
                status.style.display = 'none';
                toast('AI draft added to the picker and selected.', 'success');
                renderPreview();
            } catch (e) {
                status.textContent = e.message;
                toast(e.message, 'warning', 7000);
            }
        }

        /* ==========================================================
           16. EVENT WIRING
           ========================================================== */
        function wireEvents() {
            // Collapsible sections
            $$('.gen-section-head[data-toggle]').forEach(head => {
                head.addEventListener('click', () => {
                    head.parentElement.classList.toggle('collapsed');
                });
            });

            // Picker search
            const search = $('fDocSearch');
            if (search) search.addEventListener('input', renderDocPicker);

            // Select all / none
            bindClick('genPickAllBtn', () => {
                const filter = ($('fDocSearch')?.value || '').toLowerCase().trim();
                Object.keys(TEMPLATES).forEach(id => {
                    const t = TEMPLATES[id];
                    const hay = (t.title + ' ' + t.category + ' ' + (t.subCategory || '')).toLowerCase();
                    if (!filter || hay.includes(filter)) S.pickedDocs.add(id);
                });
                renderDocPicker();
                renderPreview();
            });
            bindClick('genPickNoneBtn', () => {
                S.pickedDocs.clear();
                renderDocPicker();
                renderPreview();
            });

            // Custom templates
            bindClick('genAddCustomBtn', newCustomTemplate);
            bindClick('genSaveCustomBtn', saveCustomTemplate);

            // Placeholder chips → insert into body
            $$('#genCustomModal [data-ph]').forEach(chip => {
                chip.addEventListener('click', () => {
                    const body = $('customBody');
                    const start = body.selectionStart, end = body.selectionEnd;
                    const text = body.value;
                    body.value = text.slice(0, start) + chip.dataset.ph + text.slice(end);
                    body.selectionStart = body.selectionEnd = start + chip.dataset.ph.length;
                    body.focus();
                });
            });

            // Wizard
            bindClick('genWizardBack', wizardBack);
            bindClick('genWizardNext', wizardNext);

            // AI
            bindClick('genAiRunBtn', runAiDraft);

            // Mode switch
            $$('.gen-mode-switch button').forEach(btn => {
                btn.addEventListener('click', () => {
                    $$('.gen-mode-switch button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    S.mode = btn.dataset.mode;
                    if (S.mode === 'wizard') {
                        WizardState.step = 0;
                        WizardState.answers = {};
                        renderWizardBody();
                        K.openModal('genWizardModal');
                    } else if (S.mode === 'ai') {
                        K.openModal('genAiModal');
                    } else if (S.mode === 'smart') {
                        const suggestions = smartSuggestTemplates();
                        if (!suggestions.length) {
                            toast('Smart mode: fill in case details first, then click Smart again.', 'warning');
                        } else {
                            const newPicks = new Set(suggestions.slice(0, 6).map(x => x.id));
                            newPicks.forEach(id => S.pickedDocs.add(id));
                            renderDocPicker();
                            renderPreview();
                            toast(`Smart mode added ${newPicks.size} suggested document${newPicks.size !== 1 ? 's' : ''}.`, 'success');
                        }
                    }
                });
            });

            // Settings
            bindClick('genSettingsBtn', () => {
                $('setFirmName').value  = S.firm.name;
                $('setFirmAddress').value = S.firm.address;
                $('setFirmPhone').value = S.firm.phone;
                $('setFirmEmail').value = S.firm.email;
                $('setFirmWebsite').value = S.firm.website;
                const adv = (S.settings && S.settings.advocate) || {};
                $('setAdvName').value = adv.name || '';
                $('setAdvLsk').value  = adv.lsk  || '';
                $('setPartner').value = adv.partner || '';
                $('setLogoPreview').src = K.kkGenGetLogo();
                K.openModal('genSettingsModal');
            });
            bindClick('genSaveSettingsBtn', () => {
                S.firm.name    = $('setFirmName').value.trim() || S.firm.name;
                S.firm.address = $('setFirmAddress').value.trim();
                S.firm.phone   = $('setFirmPhone').value.trim();
                S.firm.email   = $('setFirmEmail').value.trim();
                S.firm.website = $('setFirmWebsite').value.trim();
                S.settings.advocate = {
                    name: $('setAdvName').value.trim(),
                    lsk:  $('setAdvLsk').value.trim(),
                    partner: $('setPartner').value.trim()
                };
                K.saveSettings();
                K.closeModal('genSettingsModal');
                toast('Settings saved.', 'success');
                renderPreview();
            });
            bindChange('setLogoFile', (e) => {
                const f = e.target.files[0];
                if (!f) return;
                if (f.size > 1024 * 1024) { toast('Logo must be under 1 MB.', 'warning'); return; }
                const r = new FileReader();
                r.onload = () => {
                    K.applyLogo(r.result);
                    $('setLogoPreview').src = r.result;
                    toast('Logo loaded — click Save settings to persist.', 'info');
                };
                r.readAsDataURL(f);
            });
            bindClick('setLogoReset', () => {
                K.applyLogo('');
                $('setLogoPreview').src = K.DEFAULT_LOGO_SVG;
                toast('Logo reset to default.', 'info');
            });

            // Help
            bindClick('genHelpBtn', () => K.openModal('genHelpModal'));

            // Clear draft
            bindClick('genClearDraftBtn', () => {
                if (confirm('Clear all draft fields? This cannot be undone.')) {
                    K.clearDraft();
                    // Reset all inputs in the form panel
                    $$('#genFormPanel input, #genFormPanel select, #genFormPanel textarea').forEach(node => {
                        if (node.type === 'checkbox' || node.type === 'radio') return;
                        node.value = '';
                    });
                    S.pickedDocs.clear();
                    S.pickedLegal.clear();
                    renderDocPicker();
                    renderPreview();
                    renderLegalLibrary();
                }
            });

            // Print / Export / Save — Message 4 will implement these
            window.kkGenWireExports = function wireExports() {
                /* intentionally left for message 4 */
            };
        }

        /* ==========================================================
           17. INPUT LISTENERS → LIVE PREVIEW
           ========================================================== */
        function wireLivePreview() {
            const form = $('genFormPanel');
            if (!form) return;
            let t = null;
            form.addEventListener('input', () => {
                if (t) clearTimeout(t);
                t = setTimeout(() => {
                    if (window.kkGenRenderPreview) window.kkGenRenderPreview();
                    K.scheduleAutosave();
                }, 250);
            });
        }

        /* ==========================================================
           18. BOOT
           ========================================================== */
        function boot() {
            renderLegalLibrary();
            renderDocPicker();
            renderCustomTemplateList();
            wireEvents();
            wireLivePreview();

            // If the draft already had picked docs, re-render preview
            renderPreview();

            console.log('[generator] message-3 template engine ready —', Object.keys(TEMPLATES).length, 'built-in templates');
        }

        // Expose template API for message 4
        window.KKGen.TEMPLATES   = TEMPLATES;
        window.KKGen.LEGAL_LIBRARY = LEGAL_LIBRARY;
        window.KKGen.collectData = collectData;
        window.KKGen.renderDocPicker = renderDocPicker;
        window.KKGen.renderPreview = renderPreview;
        window.KKGen.smartSuggestTemplates = smartSuggestTemplates;

        boot();

    }); // end onReady

})();

/* ============================================================
   KK ADVOCATES — DOCUMENT GENERATOR
   Message 4 — UI Wiring, Print, Export, Save, Mobile
   ============================================================ */

(function finalWiring() {
    'use strict';

    /* ==========================================================
       0. WAIT FOR THE FULL STACK (Messages 2 & 3)
       ========================================================== */
    function onReady(fn) {
        if (window.KKGen && window.KKGen.TEMPLATES && window.KKGen.State) return fn();
        document.addEventListener('kk-docgen-ready', () => setTimeout(fn, 60), { once: true });
    }

    onReady(function () {
        const K = window.KKGen;
        const S = K.State;
        const { $, $$, el, toast, getChecked, getVal, getToday, formatLongDate, escapeHtml } = K;

        /* ==========================================================
           1. PRINT — cleans preview for @media print
           ========================================================== */
        function printPreview() {
            if (!S.currentPreview || !S.currentPreview.length) {
                toast('Generate at least one document first.', 'warning');
                return;
            }
            // The @media print CSS in Message 1 already hides chrome.
            // This just makes sure all pages are visible before printing.
            document.body.classList.add('gen-printing');
            setTimeout(() => {
                window.print();
                setTimeout(() => document.body.classList.remove('gen-printing'), 400);
            }, 120);
        }
        K.printPreview = printPreview;

        /* ==========================================================
           2. HTML DOWNLOAD — packages the preview into a standalone file
           ========================================================== */
        function buildStandaloneHtml(doc) {
            const logo = K.kkGenGetLogo();
            return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(doc.title)} — ${escapeHtml(S.firm.name)}</title>
<style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.55;color:#000;background:#eef1f7;padding:20px;}
    .page{width:210mm;min-height:297mm;background:#fff;margin:0 auto;padding:18mm 20mm 20mm;box-shadow:0 4px 24px rgba(11,18,32,.12);position:relative;}
    .letterhead{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;padding-bottom:8pt;margin-bottom:8pt;border-bottom:2.5pt double #0b1220;}
    .lh-left{display:flex;align-items:center;gap:10pt;}
    .lh-logo{width:22mm;height:22mm;object-fit:contain;}
    .lh-firm-name{font-size:14pt;font-weight:700;color:#0b1220;line-height:1.15;}
    .lh-firm-tag{font-family:Arial,sans-serif;font-size:8pt;letter-spacing:.22em;text-transform:uppercase;color:#4a5568;margin-top:2pt;}
    .lh-right{text-align:right;font-family:Arial,sans-serif;font-size:8.5pt;color:#2d3748;line-height:1.55;max-width:60mm;}
    .doc-ref{font-family:Arial,sans-serif;font-size:8.5pt;color:#4a5568;letter-spacing:.05em;text-align:right;margin-bottom:12pt;}
    .doc-ref strong{font-family:monospace;color:#0b1220;}
    .doc-court-header{text-align:center;margin-bottom:18pt;}
    .doc-court-header .ch-line{font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:12.5pt;}
    .doc-court-header .ch-sub{font-size:11pt;margin-top:2pt;}
    .doc-court-header .ch-case{margin-top:10pt;font-weight:700;font-size:12pt;}
    .doc-title{text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-size:13pt;margin:20pt 0 14pt;text-decoration:underline;text-underline-offset:4pt;}
    .doc-parties{margin:14pt 0;line-height:1.7;}
    .party-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:baseline;gap:8pt;}
    .party-left{text-align:right;}
    .party-right{text-align:left;}
    .party-mid{font-weight:700;text-align:center;font-style:italic;font-size:10.5pt;}
    .party-name{text-transform:uppercase;font-weight:700;font-size:11.5pt;}
    .party-role{font-size:10.5pt;font-style:italic;font-weight:400;}
    p{margin-bottom:8pt;text-align:justify;}
    ol,ul{margin:6pt 0 10pt 24pt;}
    ol li,ul li{margin-bottom:4pt;}
    .section-label{font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11pt;margin:14pt 0 6pt;}
    .legal-basis{margin-top:20pt;padding-top:10pt;border-top:1px solid #cbd5e0;font-size:10.5pt;}
    .legal-basis .lb-title{font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:10.5pt;margin-bottom:6pt;}
    .sign-block{margin-top:28pt;page-break-inside:avoid;}
    .sig-row{display:grid;grid-template-columns:1fr 1fr;gap:40pt;margin-bottom:28pt;}
    .sig-line{border-top:1px solid #000;margin-top:44pt;padding-top:4pt;font-size:10pt;text-align:center;}
    .sig-line .sig-role{font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:9.5pt;}
    .sig-line .sig-detail{font-size:9pt;color:#2d3748;margin-top:2pt;}
    .firm-stamp-block{border:1.5pt dashed #2d3748;border-radius:50%;width:34mm;height:34mm;display:flex;align-items:center;justify-content:center;text-align:center;font-family:Arial,sans-serif;font-size:8pt;color:#4a5568;letter-spacing:.05em;margin:14pt auto 8pt;text-transform:uppercase;}
    .stamp-inner{padding:6pt;line-height:1.35;}
    .commissioner-block{margin-top:24pt;padding:12pt;border:1.5pt solid #000;border-radius:3pt;page-break-inside:avoid;}
    .commissioner-block .cb-title{text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11pt;margin-bottom:8pt;}
    .commissioner-block .cb-lines{font-size:11pt;line-height:2;}
    .commissioner-block .cb-line{border-bottom:1px solid #000;display:inline-block;min-width:60%;}
    .drafted-by{margin-top:22pt;font-family:Arial,sans-serif;font-size:8.5pt;color:#2d3748;line-height:1.55;border-top:1px solid #cbd5e0;padding-top:8pt;}
    .drafted-by .db-title{font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:8.5pt;margin-bottom:3pt;color:#0b1220;}
    .page-footer{position:absolute;bottom:12mm;left:20mm;right:20mm;padding-top:6pt;border-top:1px solid #cbd5e0;font-family:Arial,sans-serif;font-size:7.5pt;color:#718096;display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;letter-spacing:.03em;}
    .doc-version{position:absolute;bottom:4mm;right:12mm;font-family:monospace;font-size:6.5pt;color:#a0aec0;letter-spacing:.08em;}
    @media print{
        body{background:#fff;padding:0;}
        .page{width:auto;min-height:auto;box-shadow:none;padding:12mm 15mm;page-break-after:always;}
        .page:last-child{page-break-after:auto;}
        @page{size:A4;margin:0;}
    }
</style>
</head>
<body>
    <div class="page">${doc.html}</div>
</body>
</html>`;
        }

        function downloadHtml(doc) {
            const html = buildStandaloneHtml(doc);
            const safe = (doc.title || 'document').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
            const fname = `${safe}_${getToday()}.html`;
            triggerDownload(html, fname, 'text/html');
        }

        /* ==========================================================
           3. DOCX DOWNLOAD — uses docx.js from CDN (loaded on demand)
           ========================================================== */
        async function ensureDocxLoaded() {
            if (window.docx && window.docx.Document) return true;
            return new Promise((resolve) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
                s.onload = () => resolve(!!(window.docx && window.docx.Document));
                s.onerror = () => resolve(false);
                document.head.appendChild(s);
            });
        }

        /* Very small HTML → docx converter — paragraphs, headings, lists, bold/italic. */
        function htmlToDocxBlocks(html) {
            const { Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle } = window.docx;
            const root = document.createElement('div');
            root.innerHTML = html;
            const blocks = [];

            function inlineRuns(node, opts) {
                opts = opts || {};
                const runs = [];
                node.childNodes.forEach(child => {
                    if (child.nodeType === 3) {
                        const text = child.textContent.replace(/\s+/g, ' ');
                        if (text.trim()) runs.push(new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size || 24, font: opts.font || 'Times New Roman' }));
                    } else if (child.nodeType === 1) {
                        const tag = child.tagName.toLowerCase();
                        const childOpts = { ...opts };
                        if (tag === 'strong' || tag === 'b') childOpts.bold = true;
                        if (tag === 'em' || tag === 'i') childOpts.italics = true;
                        if (tag === 'br') { runs.push(new TextRun({ text: '', break: 1 })); return; }
                        runs.push(...inlineRuns(child, childOpts));
                    }
                });
                return runs;
            }

            function walk(node, listLevel) {
                node.childNodes.forEach(child => {
                    if (child.nodeType !== 1) return;
                    const tag = child.tagName.toLowerCase();
                    const textContent = (child.textContent || '').trim();
                    if (!textContent && !['br','hr'].includes(tag)) { walk(child, listLevel); return; }

                    if (tag === 'div' || tag === 'section' || tag === 'header' || tag === 'footer') {
                        const cls = child.className || '';
                        // Heading-style via CSS class
                        if (cls.includes('doc-title')) {
                            blocks.push(new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 240, after: 240 },
                                children: [new TextRun({ text: textContent.toUpperCase(), bold: true, underline: {}, size: 28, font: 'Times New Roman' })]
                            }));
                            return;
                        }
                        if (cls.includes('section-label')) {
                            blocks.push(new Paragraph({
                                spacing: { before: 200, after: 80 },
                                children: [new TextRun({ text: textContent.toUpperCase(), bold: true, size: 24, font: 'Times New Roman' })]
                            }));
                            return;
                        }
                        if (cls.includes('ch-line') || cls.includes('ch-case')) {
                            blocks.push(new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: textContent.toUpperCase(), bold: true, size: 25, font: 'Times New Roman' })]
                            }));
                            return;
                        }
                        if (cls.includes('ch-sub')) {
                            blocks.push(new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: textContent, size: 22, font: 'Times New Roman' })]
                            }));
                            return;
                        }
                        if (cls.includes('doc-ref') || cls.includes('doc-version')) {
                            blocks.push(new Paragraph({
                                alignment: AlignmentType.RIGHT,
                                children: [new TextRun({ text: textContent, size: 18, font: 'Arial' })]
                            }));
                            return;
                        }
                        if (cls.includes('sig-line') || cls.includes('commissioner-block') || cls.includes('drafted-by') || cls.includes('legal-basis') || cls.includes('firm-stamp-block')) {
                            // Emit block with slight spacing
                            blocks.push(new Paragraph({
                                spacing: { before: 200, after: 100 },
                                children: inlineRuns(child, { size: 22 })
                            }));
                            return;
                        }
                        walk(child, listLevel);
                        return;
                    }

                    if (tag === 'p' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
                        blocks.push(new Paragraph({
                            alignment: AlignmentType.JUSTIFIED,
                            spacing: { after: 120 },
                            children: inlineRuns(child, { size: tag.startsWith('h') ? 26 : 24 })
                        }));
                        return;
                    }
                    if (tag === 'ol' || tag === 'ul') {
                        Array.from(child.children).forEach((li, i) => {
                            blocks.push(new Paragraph({
                                numbering: tag === 'ol' ? { reference: 'numList', level: listLevel || 0 } : undefined,
                                bullet: tag === 'ul' ? { level: listLevel || 0 } : undefined,
                                alignment: AlignmentType.JUSTIFIED,
                                spacing: { after: 80 },
                                children: (tag === 'ol' ? [new TextRun({ text: `${i + 1}. `, size: 24, font: 'Times New Roman' })] : []).concat(inlineRuns(li, { size: 24 }))
                            }));
                        });
                        return;
                    }
                    if (tag === 'br') { blocks.push(new Paragraph({ children: [new TextRun({ text: '' })] })); return; }
                    walk(child, listLevel);
                });
            }
            walk(root, 0);
            return blocks;
        }

        async function downloadDocx(doc) {
            const ok = await ensureDocxLoaded();
            if (!ok) { toast('Could not load .docx library (offline?). Try the HTML export instead.', 'warning', 6000); return; }
            const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = window.docx;

            const blocks = htmlToDocxBlocks(doc.html);

            // Letterhead as a small table-like paragraph
            const header = [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 40 },
                    border: { bottom: { color: '0B1220', style: BorderStyle.DOUBLE, size: 12 } },
                    children: [new TextRun({ text: S.firm.name.toUpperCase(), bold: true, size: 30, font: 'Times New Roman' })]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: 'Advocates & Legal Consultants', italics: true, size: 20, font: 'Times New Roman' })]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 220 },
                    children: [new TextRun({
                        text: `${S.firm.address}  ·  Tel: ${S.firm.phone}  ·  ${S.firm.email}  ·  ${S.firm.website}`,
                        size: 18, font: 'Arial'
                    })]
                })
            ];

            const docObj = new Document({
                creator: S.firm.name,
                title: doc.title,
                description: `Generated ${getToday()} by Kuria Karatu Document Generator`,
                numbering: {
                    config: [{
                        reference: 'numList',
                        levels: [
                            { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
                        ]
                    }]
                },
                sections: [{
                    properties: {
                        page: {
                            size: { width: 11906, height: 16838 }, // A4 in twips
                            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
                        }
                    },
                    children: [...header, ...blocks]
                }]
            });

            const blob = await Packer.toBlob(docObj);
            const safe = (doc.title || 'document').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
            const fname = `${safe}_${getToday()}.docx`;
            triggerBlobDownload(blob, fname);
        }

        /* ==========================================================
           4. TRIGGER DOWNLOADS
           ========================================================== */
        function triggerDownload(text, filename, mime) {
            const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
            triggerBlobDownload(blob, filename);
        }
        function triggerBlobDownload(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        /* ==========================================================
           5. SAVE TO FIRESTORE — matches admin documents schema
           ========================================================== */
        async function saveCurrentToFirestore() {
            if (!S.currentPreview || !S.currentPreview.length) {
                toast('Generate at least one document first.', 'warning');
                return;
            }
            if (!S.firebaseReady || !S.fb.db) {
                toast('Offline — cannot save to Firestore. Use Print or Download instead.', 'warning', 5500);
                return;
            }
            if (!S.fb.user) {
                toast('Not signed in. Open the generator from the admin app while logged in.', 'warning', 6500);
                return;
            }
            const d = K.collectData();
            const matter = d.caseName || d.caseNo || d.clientName || 'General';
            let savedCount = 0;

            for (const doc of S.currentPreview) {
                try {
                    const tpl = doc.id.startsWith('custom:')
                        ? null
                        : K.TEMPLATES[doc.id];
                    const category = tpl ? tpl.category : 'Custom';
                    const subCategory = tpl ? (tpl.subCategory || '') : '';
                    const docName = tpl ? tpl.title : (doc.title.split(' — ').pop() || doc.title);
                    const plainText = (new DOMParser().parseFromString(doc.html, 'text/html').body.textContent || '').trim();

                    await K.kkGenSaveToFirestore({
                        name: docName,
                        category: category,
                        subCategory: subCategory,
                        matter: matter,
                        html: doc.html,
                        plainText: plainText
                    });
                    savedCount++;
                } catch (e) {
                    console.warn('[docgen] save failed for', doc.id, e);
                }
            }

            if (savedCount) {
                toast(`Saved ${savedCount} document${savedCount !== 1 ? 's' : ''} to the case file.`, 'success');
                // Notify the parent admin window
                S.currentPreview.forEach(doc => {
                    K.notifyParent('saved', { doc: { name: doc.title } });
                });
            } else {
                toast('Nothing was saved.', 'warning');
            }
        }

        /* ==========================================================
           6. EXPORT MENU WIRING
           ========================================================== */
        function wireExports() {
            // Print
            K.bindClick('genPrintBtn', () => {
                if (!S.currentPreview.length) { toast('Generate at least one document first.', 'warning'); return; }
                K.printPreview();
            });

            // DOCX
            K.bindClick('genDocxBtn', async () => {
                if (!S.currentPreview.length) { toast('Generate at least one document first.', 'warning'); return; }
                toast('Building .docx — this may take a moment…', 'info', 3000);
                for (const doc of S.currentPreview) {
                    await downloadDocx(doc);
                }
            });

            // HTML
            K.bindClick('genHtmlBtn', () => {
                if (!S.currentPreview.length) { toast('Generate at least one document first.', 'warning'); return; }
                S.currentPreview.forEach(doc => downloadHtml(doc));
                toast('HTML download started.', 'success');
            });

            // Save to Firestore
            K.bindClick('genSaveBtn', saveCurrentToFirestore);

            // Session option: auto-download after generating
            // (checked state is read at generate time — we trigger an
            //  initial download whenever picked docs change if this is on)
            window.kkGenAutoDownload = function () {
                if (!getChecked('optDownloadCopy')) return;
                if (!S.currentPreview.length) return;
                S.currentPreview.forEach(doc => downloadHtml(doc));
            };
        }

        /* ==========================================================
           7. LIVE PREVIEW + AUTO-DOWNLOAD HOOK
           ========================================================== */
        function patchPreviewToAutoDownload() {
            if (typeof K.renderPreview !== 'function') return;
            const orig = K.renderPreview;
            let lastPickCount = -1;
            window.kkGenRenderPreview = function () {
                orig.apply(this, arguments);
                if (S.currentPreview.length !== lastPickCount) {
                    lastPickCount = S.currentPreview.length;
                    // Only auto-download when the user actually toggled a document,
                    // not on every keystroke
                }
            };
        }

        /* ==========================================================
           8. MOBILE FORM/PREVIEW TOGGLE
           ========================================================== */
        function wireMobileToggle() {
            const btn = $('genMobileToggle');
            const body = $('genBody');
            if (!btn || !body) return;

            function syncLabel() {
                const formOpen = body.classList.contains('mobile-form-open');
                btn.querySelector('span').textContent = formOpen ? 'Preview' : 'Form';
                btn.querySelector('i').className = formOpen ? 'fas fa-eye' : 'fas fa-pen-to-square';
            }

            btn.addEventListener('click', () => {
                body.classList.toggle('mobile-form-open');
                syncLabel();
            });

            // Start on preview (no mobile-form-open)
            syncLabel();

            // On desktop, ensure classes don't linger
            const mq = window.matchMedia('(min-width: 901px)');
            mq.addEventListener?.('change', (e) => {
                if (e.matches) body.classList.remove('mobile-form-open');
                syncLabel();
            });
        }

        /* ==========================================================
           9. KEYBOARD SHORTCUTS
           ========================================================== */
        function wireShortcuts() {
            document.addEventListener('keydown', (e) => {
                const tag = (e.target.tagName || '').toLowerCase();
                const inField = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

                // Ctrl/Cmd + P → custom print
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                    if (!inField) {
                        e.preventDefault();
                        K.printPreview();
                    }
                }
                // Ctrl/Cmd + S → save to Firestore
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    saveCurrentToFirestore();
                }
                // Ctrl/Cmd + Shift + D → download .html
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
                    e.preventDefault();
                    if (S.currentPreview.length) S.currentPreview.forEach(doc => downloadHtml(doc));
                }
            });
        }

        /* ==========================================================
           10. TOPBAR MODE SWITCH — MOBILE COLLAPSE
           ========================================================== */
        function wireTopbarMobile() {
            const sw = document.querySelector('.gen-mode-switch');
            if (!sw) return;
            const apply = () => {
                if (window.innerWidth < 560) sw.classList.add('compact');
                else sw.classList.remove('compact');
            };
            window.addEventListener('resize', apply);
            apply();
            // CSS for .compact is added below
        }

        /* ==========================================================
           11. INJECT SMALL MOBILE CSS
           ========================================================== */
        function injectMobileCss() {
            const css = `
                .gen-mode-switch.compact button{
                    padding:.3rem .5rem; font-size:.55rem;
                }
                .gen-mode-switch.compact button i{ font-size:.6rem; }
                .gen-mode-switch.compact button:not(.active) span{
                    display:none;
                }
                body.gen-printing .gen-page{
                    box-shadow:none;
                }
                @media (max-width: 900px){
                    .gen-body.mobile-form-open #genMobileToggle{
                        /* keep toggle visible */
                    }
                }
            `;
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        }

        /* ==========================================================
           12. PARENT BRIDGE — close request from admin
           ========================================================== */
        function wireParentBridge() {
            window.addEventListener('message', (ev) => {
                if (!ev.data || ev.data.target !== 'kk-docgen') return;
                if (ev.data.action === 'focus') {
                    // Scroll the preview into view (nice to have)
                    document.querySelector('.gen-preview-panel')?.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        /* ==========================================================
           13. BOOT
           ========================================================== */
        function boot() {
            injectMobileCss();
            wireExports();
            patchPreviewToAutoDownload();
            wireMobileToggle();
            wireShortcuts();
            wireTopbarMobile();
            wireParentBridge();

            // Initial render in case a draft was restored
            if (S.currentPreview && S.currentPreview.length) {
                // already rendered by Message 3
            }

            console.log('[generator] message-4 UI wiring ready');
            console.log('[generator] ready — all four messages loaded');
        }

        boot();

    }); // end onReady

})();

