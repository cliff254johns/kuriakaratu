/* ============================================================
   KURIA KARATU & COMPANY ADVOCATES — v2 Enhancement Layer
   ============================================================
   This file extends admin.js WITHOUT modifying it.
   Load AFTER admin.js.
   
   Contents:
   1. Design token bootstrap
   2. Two-tier navigation (rail + panel)
   3. Breadcrumbs
   4. Command Palette (Cmd/Ctrl+K)
   5. Role-specific Dashboard (Today panel, aging heatmap, cash flow)
   6. Conflict-of-Interest Checker
   7. Statutory Deadline Engine
   8. Document Versioning
   9. ARO Calculator
  10. Offline conflict resolution
  11. Pagination helper
  12. Multi-step form framework + autosave
  13. Mobile card rendering
   ============================================================ */

(function KK_V2() {
    'use strict';

    // Wait for admin.js to finish booting
    if (typeof firebase === 'undefined') {
        console.warn('[KKv2] Firebase not ready. Retrying in 500ms...');
        return setTimeout(KK_V2, 500);
    }

    // Expose namespace
    const KK = window.KK_V2 = window.KK_V2 || {};
    KK.enabled = true;
    KK.version = '2.0.0';

    // Aliases to admin.js globals (read via getter so we always see fresh data)
    const getState = () => ({
        cases: window.casesData || [],
        clients: window.clientsData || [],
        documents: window.documentsData || [],
        tasks: window.tasksData || [],
        invoices: window.invoicesData || [],
        receipts: window.receiptsData || [],
        accidents: window.accidentClientsData || [],
        users: window.usersData || [],
        currentUser: window.currentUser,
        currentUserEmail: window.currentUserEmail,
        currentUserRole: window.currentUserRole,
        isFullAccess: typeof window.isFullAccess === 'function' ? window.isFullAccess() : false,
    });

    const db = firebase.firestore();
    const $  = (id) => document.getElementById(id);
    const $$ = (sel, root) => (root || document).querySelectorAll(sel);

    // ============================================================
    // 0. UTILITIES
    // ============================================================
    const util = {
        today: () => new Date().toISOString().slice(0, 10),
        now: () => new Date().toISOString().replace('T', ' ').slice(0, 19),
        fmtKES: (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE'),
        esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
        daysBetween: (a, b) => Math.ceil((new Date(a) - new Date(b)) / 86400000),
        toast: (msg, type) => typeof window.showToast === 'function' ? window.showToast(msg, type || 'info') : console.log(`[toast:${type}]`, msg),
        log: (action, detail) => typeof window.logActivity === 'function' ? window.logActivity(action, detail) : null,
    };
    KK.util = util;

    // ============================================================
    // 1. FEATURE FLAGS — localStorage-overridable
    // ============================================================
    KK.flags = {
        twoTierNav:     localStorage.getItem('kk_v2_nav')      !== 'off',
        commandPalette: localStorage.getItem('kk_v2_palette')  !== 'off',
        conflicts:      localStorage.getItem('kk_v2_conflicts') !== 'off',
        deadlines:      localStorage.getItem('kk_v2_deadlines') !== 'off',
        versioning:     localStorage.getItem('kk_v2_versioning') !== 'off',
        aro:            localStorage.getItem('kk_v2_aro')        !== 'off',
        todayPanel:     localStorage.getItem('kk_v2_today')      !== 'off',
        agingHeatmap:   localStorage.getItem('kk_v2_heatmap')    !== 'off',
        conflictSync:   localStorage.getItem('kk_v2_sync')       !== 'off',
        multiStepForms: localStorage.getItem('kk_v2_forms')      !== 'off',
        pagination:     localStorage.getItem('kk_v2_pagination') !== 'off',
        mobileCards:    localStorage.getItem('kk_v2_mobilecards')!== 'off',
    };

    // ============================================================
    // 2. DOM READY GATE
    // ============================================================
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

      onReady(() => {
        console.log('[KKv2] Booting enhancement layer v' + KK.version);

        // Apply the Clio design theme to the body
        // (Can be overridden by adding class="kk-material" manually)
        if (!document.body.classList.contains('kk-material')) {
            document.body.classList.add('kk-clio');
        }

        try { initDesignTokens(); }   catch (e) { console.warn('[KKv2] tokens:', e); }
        try { initTwoTierNav(); }     catch (e) { console.warn('[KKv2] nav:', e); }
        try { initBreadcrumbs(); }    catch (e) { console.warn('[KKv2] breadcrumbs:', e); }
        try { initCommandPalette(); } catch (e) { console.warn('[KKv2] palette:', e); }
        try { initTodayPanel(); }     catch (e) { console.warn('[KKv2] today:', e); }
        try { initAgingHeatmap(); }   catch (e) { console.warn('[KKv2] heatmap:', e); }
        try { initConflictChecker();} catch (e) { console.warn('[KKv2] conflicts:', e); }
        try { initDeadlineEngine(); } catch (e) { console.warn('[KKv2] deadlines:', e); }
        try { initDocVersioning(); }  catch (e) { console.warn('[KKv2] versioning:', e); }
        try { initAROCalculator(); }  catch (e) { console.warn('[KKv2] aro:', e); }
        try { initOfflineSync(); }    catch (e) { console.warn('[KKv2] sync:', e); }
        try { initMultiStepForms(); } catch (e) { console.warn('[KKv2] forms:', e); }
        try { initPagination(); }     catch (e) { console.warn('[KKv2] pagination:', e); }

        console.log('[KKv2] Ready.');
    });

    // ============================================================
    // 3. DESIGN TOKENS
    // ============================================================
    function initDesignTokens() {
        document.documentElement.classList.add('kk-v2');
        // Apply state/category semantic classes to existing badges
        const semanticMap = {
            'badge green':   'kk-state-success',
            'badge yellow':  'kk-state-warning',
            'badge red':     'kk-state-danger',
            'badge blue':    'kk-state-info',
            'badge gray':    'kk-state-neutral',
        };
        const observer = new MutationObserver(() => applySemanticBadges());
        observer.observe(document.body, { childList: true, subtree: true });
        applySemanticBadges();
    }
    function applySemanticBadges() {
        // Non-destructive — only annotates, doesn't change classes
        $$('.badge').forEach(b => {
            if (b.dataset.kkState) return;
            if (b.classList.contains('green')) b.dataset.kkState = 'success';
            else if (b.classList.contains('yellow')) b.dataset.kkState = 'warning';
            else if (b.classList.contains('red')) b.dataset.kkState = 'danger';
            else if (b.classList.contains('purple')) b.dataset.kkCategory = '2';
            else b.dataset.kkState = 'neutral';
        });
    }

    // ============================================================
    // 4. TWO-TIER NAVIGATION
    // ============================================================
    const NAV_CONFIG = [
        { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard', color: 'var(--kk-cat-1)',
          panel: [
              { label: 'Overview', page: 'dashboard' },
              { label: 'Practice Targets', page: 'targets', adminOnly: true },
              { label: 'Reports', page: 'reports', adminOnly: true },
          ] },
        { id: 'clients', icon: 'fa-users', label: 'Clients', color: 'var(--kk-cat-4)',
          panel: [
              { label: 'All Clients', page: 'clients' },
              { label: 'Portal Requests', page: 'portal', adminOnly: true, badge: () => countPendingPortal() },
          ] },
        { id: 'cases', icon: 'fa-folder-open', label: 'Cases', color: 'var(--kk-cat-2)',
          panel: [
              { label: 'All Cases', page: 'cases' },
              { label: 'ELCs — Magistrate', page: 'cases', filter: 'ELCs', subfilter: 'Magistrate' },
              { label: 'ELCs — High Court', page: 'cases', filter: 'ELCs', subfilter: 'High Court' },
              { label: 'Criminal — Magistrate', page: 'cases', filter: 'Criminal', subfilter: 'Magistrate' },
              { label: 'Criminal — High Court', page: 'cases', filter: 'Criminal', subfilter: 'High Court' },
              { label: 'Succession', page: 'cases', filter: 'Succession' },
              { label: 'Civil', page: 'cases', filter: 'Civil' },
              { label: 'Tribunal', page: 'cases', filter: 'Tribunal' },
              { label: 'Divorce', page: 'cases', filter: 'Divorce' },
              { label: 'Conveyancing', page: 'cases', filter: 'Conveyancing' },
              { label: 'Running Down', page: 'cases', filter: 'Running Down' },
              { label: 'Employment & Labour', page: 'cases', filter: 'Employment' },
              { label: 'Children', page: 'cases', filter: 'Children' },
              { label: 'Kadhi', page: 'cases', filter: 'Kadhi' },
          ] },
        { id: 'documents', icon: 'fa-file-alt', label: 'Documents', color: 'var(--kk-cat-6)',
          panel: [] /* rendered dynamically from docSections */ },
        { id: 'calendar', icon: 'fa-calendar-check', label: 'Calendar', color: 'var(--kk-cat-5)',
          panel: [
              { label: 'Calendar', page: 'calendar' },
              { label: 'Tasks & Activities', page: 'calendar', scrollTo: 'tasksSection' },
              { label: 'Statutory Deadlines', page: 'deadlines', isNew: true },
          ] },
        { id: 'finance', icon: 'fa-coins', label: 'Finance', color: 'var(--kk-cat-7)',
          panel: [
              { label: 'Invoices', page: 'invoices' },
              { label: 'Payments & Receipts', page: 'payments', adminOnly: true },
              { label: 'Client Fees & Installments', page: 'fees', adminOnly: true },
              { label: 'Accident Clients', page: 'accidentClients', adminOnly: true },
              { label: 'Cash Flow Projection', page: 'cashflow', adminOnly: true, isNew: true },
          ] },
        { id: 'admin', icon: 'fa-cog', label: 'Admin', color: 'var(--kk-cat-8)', adminOnly: true,
          panel: [
              { label: 'Activity Log', page: 'activity' },
              { label: 'Users', page: 'users' },
              { label: 'Settings', page: 'settings' },
              { label: 'Integrations', page: 'integrations' },
          ] },
        { id: 'ai', icon: 'fa-robot', label: 'AI Tools', color: 'var(--kk-cat-3)',
          panel: [{ label: 'AI Tools', page: 'ai' }] },
    ];

      let activeRailId = 'dashboard';

    // ============================================================
    // 4a. LIVE SUBMENU COUNTERS (Clio-style)
    // Each panel item can show a live count of what's inside it.
    // Counts refresh in real time when Firestore data changes.
    // ============================================================

    /* --- Count functions --- */

    function countCases(filter, subfilter) {
        const cases = window.casesData || [];
        return cases.filter(c => {
            if (filter && c.area !== filter) return false;
            if (subfilter && c.courtType !== subfilter) return false;
            return true;
        }).length;
    }

    function countCasesActive(filter, subfilter) {
        const cases = window.casesData || [];
        return cases.filter(c => {
            if (filter && c.area !== filter) return false;
            if (subfilter && c.courtType !== subfilter) return false;
            return c.status === 'Active';
        }).length;
    }

    function countPendingPortal() {
        const list = window.portalRequestsData || [];
        return list.filter(r => !r.status || r.status === 'pending').length;
    }

    function countScheduledTasks() {
        const today = util.today();
        const tasks = window.tasksData || [];
        return tasks.filter(t => t.status === 'Scheduled' && t.date >= today).length;
    }

    function countCriticalDeadlines() {
        if (!KK.deadlines || typeof KK.deadlines.upcoming !== 'function') return 0;
        try { return KK.deadlines.upcoming(7).length; } catch (e) { return 0; }
    }

    function countUnpaidInvoices() {
        const invoices = window.invoicesData || [];
        return invoices.filter(i => i.status !== 'Paid').length;
    }

    function countOverdueInstallments() {
        const today = util.today();
        const clients = window.clientsData || [];
        let n = 0;
        clients.forEach(c => {
            const fa = c.feeAgreement;
            if (!fa || !Array.isArray(fa.installments)) return;
            n += fa.installments.filter(i => !i.paid && i.date && i.date < today).length;
        });
        return n;
    }

    function countDocumentsInSection(sectionName, subName) {
        // Guard against documentsData being undefined during boot
        const docs = Array.isArray(window.documentsData) ? window.documentsData : [];
        if (!docs.length) return 0;
        try {
            return docs.filter(d => {
                if (!d) return false;
                if (sectionName && d.category !== sectionName) return false;
                if (subName && (d.subCategory || '') !== subName) return false;
                return true;
            }).length;
        } catch (e) {
            console.warn('[KKv2] countDocumentsInSection failed:', e);
            return 0;
        }
    }

    /* --- Counter registry: maps a panel item's label to its count function --- */
    const PANEL_COUNTERS = {
        // Cases panel
        'All Cases':                 () => countCases(),
        'ELCs — Magistrate':         () => countCases('ELCs', 'Magistrate'),
        'ELCs — High Court':         () => countCases('ELCs', 'High Court'),
        'Criminal — Magistrate':     () => countCases('Criminal', 'Magistrate'),
        'Criminal — High Court':     () => countCases('Criminal', 'High Court'),
        'Succession':                () => countCases('Succession'),
        'Civil':                     () => countCases('Civil'),
        'Tribunal':                  () => countCases('Tribunal'),
        'Divorce':                   () => countCases('Divorce'),
        'Conveyancing':              () => countCases('Conveyancing'),
        'Running Down':              () => countCases('Running Down'),
        'Employment & Labour':       () => countCases('Employment'),
        'Children':                  () => countCases('Children'),
        'Kadhi':                     () => countCases('Kadhi'),

        // Clients panel
        'All Clients':               () => (window.clientsData || []).length,
        'Portal Requests':           () => countPendingPortal(),

        // Calendar panel
        'Calendar':                  () => countScheduledTasks(),
        'Tasks & Activities':        () => countScheduledTasks(),
        'Statutory Deadlines':       () => countCriticalDeadlines(),

        // Finance panel
        'Invoices':                  () => countUnpaidInvoices(),
        'Payments & Receipts':       () => countUnpaidInvoices(),
        'Client Fees & Installments':() => countOverdueInstallments(),
        'Accident Clients':          () => (window.accidentClientsData || []).length,

        // Admin panel
        'Activity Log':              () => (window.activityLogs || []).length,
        'Users':                     () => (window.usersData || []).length,
    };

    /* --- Attach counters to a freshly-rendered panel --- */
    function attachPanelCounters() {
        const panel = $('kkPanel');
        if (!panel) return;

        // Wrap the whole thing in try/catch so a counter failure
        // NEVER breaks the panel render.
        try {
            $$('.kk-panel-item', panel).forEach(item => {
                try {
                    attachCounterToItem(item);
                } catch (e) {
                    console.warn('[KKv2] counter failed for one item:', e);
                }
            });
        } catch (e) {
            console.warn('[KKv2] attachPanelCounters failed:', e);
        }
    }

    function attachCounterToItem(item) {
            // Find the label span (the one containing the text label)
            const labelSpan = item.querySelector('span:not(.kk-panel-count)');
            if (!labelSpan) return;
            const label = (labelSpan.textContent || '').trim();

            // Remove any previous counter
            const prev = item.querySelector('.kk-panel-count');
            if (prev) prev.remove();

            let count = null;

            // 1) Registry lookup
            if (Object.prototype.hasOwnProperty.call(PANEL_COUNTERS, label)) {
                try { count = PANEL_COUNTERS[label](); } catch (e) { count = null; }
            }

            // 2) Documents tree — count by section/sub-section
            if (count === null && item.dataset.page === 'documents') {
                const sec = item.dataset.filter || '';
                const sub = item.dataset.subfilter || '';
                count = countDocumentsInSection(sec, sub);
            }

            // 3) Any cases page with a filter — count
            if (count === null && item.dataset.page === 'cases' && item.dataset.filter) {
                count = countCases(item.dataset.filter, item.dataset.subfilter || '');
            }

            // Nothing matched — leave this item without a counter
            if (count === null || count === undefined) return;

            const badge = document.createElement('span');
            badge.className = 'kk-panel-count';
            badge.dataset.kkCountLabel = label;
            badge.textContent = count;

            // Visual state
            if (count === 0) badge.classList.add('zero');
            if (label === 'Portal Requests' && count > 0) badge.classList.add('urgent');
            if (label === 'Statutory Deadlines' && count > 0) badge.classList.add('urgent');
            if (label === 'Client Fees & Installments' && count > 0) badge.classList.add('warn');
            if (label === 'Payments & Receipts' && count > 20) badge.classList.add('warn');
            item.appendChild(badge);
    }

    /* --- Refresh counts on data change --- */
      function refreshPanelCounters() {
        if (!KK.flags.twoTierNav) return;
        const panel = $('kkPanel');
        if (!panel) return;

        $$('.kk-panel-item', panel).forEach(item => {
          try {
            const badge = item.querySelector('.kk-panel-count');
            if (!badge) return;
            const label = badge.dataset.kkCountLabel;
            if (!label) return;

            // Get the fresh count
            let newCount = null;
            if (Object.prototype.hasOwnProperty.call(PANEL_COUNTERS, label)) {
                try { newCount = PANEL_COUNTERS[label](); } catch (e) { newCount = null; }
            } else if (item.dataset.page === 'documents') {
                newCount = countDocumentsInSection(item.dataset.filter || '', item.dataset.subfilter || '');
            } else if (item.dataset.page === 'cases' && item.dataset.filter) {
                newCount = countCases(item.dataset.filter, item.dataset.subfilter || '');
            }
            if (newCount === null) return;

            const oldText = badge.textContent;
            const oldNum = parseInt(oldText, 10) || 0;

            // Update class state
            badge.className = 'kk-panel-count';
            if (label === 'Portal Requests' && newCount > 0) badge.classList.add('urgent');
            if (label === 'Statutory Deadlines' && newCount > 0) badge.classList.add('urgent');
            if (label === 'Client Fees & Installments' && newCount > 0) badge.classList.add('warn');
            if (label === 'Payments & Receipts' && newCount > 20) badge.classList.add('warn');
            if (newCount === 0) badge.classList.add('zero');

            // Update text and pulse if it changed
            if (oldText !== String(newCount)) {
                badge.textContent = newCount;
                if (newCount > oldNum) {
                    badge.style.transition = 'background 250ms ease';
                    badge.style.background = 'rgba(61,90,254,0.4)';
                    setTimeout(() => { badge.style.background = ''; }, 400);
                }
            }
          } catch (e) { /* silently skip bad items */ }
        });
    }

    // Expose for external use
    KK.counters = { attach: attachPanelCounters, refresh: refreshPanelCounters };

    function initTwoTierNav() {
    if (!KK.flags.twoTierNav) return;
    const sidebar = $('sidebar');
    if (!sidebar) return;

    // Correct class — matches the CSS above
    sidebar.classList.add('kk-nav-active');

    const wrap = document.createElement('div');
    wrap.className = 'kk-nav-v2';
    wrap.innerHTML = `
        <div class="kk-rail" id="kkRail"></div>
        <div class="kk-panel" id="kkPanel"></div>
    `;

    // Append to sidebar (the CSS positions it absolutely over everything)
    sidebar.appendChild(wrap);

    renderRail();
    renderPanel(activeRailId);
    patchNavigate();

    // Re-render on window resize so the panel width adjusts
    window.addEventListener('resize', debounce(() => {
        renderRail();
        renderPanel(activeRailId);
    }, 200));
}

// Small debounce helper
function debounce(fn, ms) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
    };
}

    function renderRail() {
        const rail = $('kkRail');
        if (!rail) return;
        const { isFullAccess } = getState();
        rail.innerHTML = NAV_CONFIG
            .filter(item => !item.adminOnly || isFullAccess)
            .map(item => {
                const badge = item.id === 'clients' ? countPendingPortal() : 0;
                return `
                    <button class="kk-rail-btn ${item.id === activeRailId ? 'active' : ''}"
                            data-rail="${item.id}" title="${item.label}">
                        <i class="fas ${item.icon}"></i>
                        ${badge > 0 ? `<span class="kk-rail-badge">${badge}</span>` : ''}
                    </button>
                `;
            }).join('');

        $$('.kk-rail-btn', rail).forEach(btn => {
            btn.addEventListener('click', () => {
                activeRailId = btn.dataset.rail;
                renderRail();
                renderPanel(activeRailId);
            });
        });
    }

    function renderPanel(railId) {
        const panel = $('kkPanel');
        if (!panel) return;
        const config = NAV_CONFIG.find(x => x.id === railId);
        if (!config) return;

        const { isFullAccess } = getState();
        let items = (config.panel || []).filter(x => !x.adminOnly || isFullAccess);

        // Special: Documents panel renders from live docSections
        if (railId === 'documents' && Array.isArray(window.docSections)) {
            items = [];
            window.docSections.forEach(sec => {
                items.push({ label: sec.name, page: 'documents', filter: sec.name });
                (sec.subSections || []).forEach(sub => {
                    items.push({ label: '  ↳ ' + sub, page: 'documents', filter: sec.name, subfilter: sub, isSub: true });
                });
            });
        }

        panel.innerHTML = `
            <div class="kk-panel-header">${util.esc(config.label)}</div>
            ${items.map(it => `
                <button class="kk-panel-item"
                        data-page="${util.esc(it.page || '')}"
                        data-filter="${util.esc(it.filter || '')}"
                        data-subfilter="${util.esc(it.subfilter || '')}"
                        data-scroll="${util.esc(it.scrollTo || '')}"
                        style="${it.isSub ? 'padding-left:1.5rem;font-size:0.8rem;' : ''}">
                    ${it.isNew ? '<i class="fas fa-star" style="color:#fbbf24;font-size:0.6rem;"></i>' : ''}
                    <span>${util.esc(it.label)}</span>
                    ${typeof it.badge === 'function' && it.badge() > 0
                        ? `<span class="kk-count">${it.badge()}</span>` : ''}
                </button>
            `).join('')}
        `;

          $$('.kk-panel-item', panel).forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                const filter = btn.dataset.filter;
                const subfilter = btn.dataset.subfilter;
                const scrollTo = btn.dataset.scroll;
                if (!page) return;
                $$('.kk-panel-item', panel).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (typeof window.navigate === 'function') {
                    window.navigate(page, filter, subfilter);
                }
                // V2-only pages
                if (page === 'deadlines') openDeadlinesView();
                if (page === 'cashflow') openCashflowView();
                if (scrollTo) setTimeout(() => {
                    const el = $(scrollTo);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 300);
            });
        });

        // Attach live counters after every panel render
        attachPanelCounters();
    }

    function countPendingPortal() {
        const list = window.portalRequestsData || [];
        return list.filter(r => !r.status || r.status === 'pending').length;
    }

    // Patch navigate() to also sync the nav state and update breadcrumbs
    function patchNavigate() {
        if (window.__kkNavigatePatched) return;
        const orig = window.navigate;
        if (typeof orig !== 'function') return setTimeout(patchNavigate, 500);
        window.navigate = function(page, filter, subfilter) {
            try { orig.apply(this, arguments); } catch (e) { console.warn('[KKv2] navigate error:', e); }
            try { syncNavToPage(page, filter); } catch (e) {}
            try { renderBreadcrumbs(page, filter, subfilter); } catch (e) {}
            try { onPageChange(page); } catch (e) {}
            try { refreshPanelCounters(); } catch (e) {}
        };
        window.__kkNavigatePatched = true;
    }

    function syncNavToPage(page, filter) {
        // Find the rail whose panel contains this page
        for (const rail of NAV_CONFIG) {
            const match = (rail.panel || []).some(it => it.page === page);
            if (match || (rail.id === page)) {
                if (activeRailId !== rail.id) {
                    activeRailId = rail.id;
                    renderRail();
                    renderPanel(rail.id);
                }
                // Mark the panel item active
                setTimeout(() => {
                    $$('.kk-panel-item').forEach(b => {
                        const samePage = b.dataset.page === page;
                        const sameFilter = !filter || b.dataset.filter === filter;
                        b.classList.toggle('active', samePage && sameFilter);
                    });
                }, 60);
                return;
            }
        }
    }

    // ============================================================
    // 5. BREADCRUMBS
    // ============================================================
    function initBreadcrumbs() {
        const host = document.querySelector('.topbar .left-section') || document.querySelector('.topbar');
        if (!host) return;
        let bc = $('kkBreadcrumbs');
        if (!bc) {
            bc = document.createElement('div');
            bc.id = 'kkBreadcrumbs';
            bc.className = 'kk-breadcrumbs';
            host.parentElement.insertBefore(bc, host.nextSibling);
        }
        renderBreadcrumbs(window.currentPage || 'dashboard', window.currentFilter || '', window.currentSubfilter || '');
    }

    function renderBreadcrumbs(page, filter, subfilter) {
        const bc = $('kkBreadcrumbs');
        if (!bc) return;
        const titles = {
            dashboard: 'Dashboard', clients: 'Clients', invoices: 'Invoices', cases: 'Cases',
            documents: 'Documents', calendar: 'Calendar', targets: 'Practice Targets',
            payments: 'Payments & Receipts', fees: 'Client Fees', accidentClients: 'Accident Clients',
            activity: 'Activity Log', users: 'Users', portal: 'Portal Requests',
            settings: 'Settings', reports: 'Reports', ai: 'AI Tools', integrations: 'Integrations',
            deadlines: 'Statutory Deadlines', cashflow: 'Cash Flow Projection',
        };
        const parts = [{ label: 'Home', page: 'dashboard' }];
        if (page !== 'dashboard') parts.push({ label: titles[page] || page, page });
        if (filter) parts.push({ label: filter, page, filter });
        if (subfilter) parts.push({ label: subfilter, page, filter, subfilter });

        bc.innerHTML = parts.map((p, i) => {
            const isLast = i === parts.length - 1;
            return `
                <span class="crumb ${isLast ? 'current' : ''}"
                      data-page="${util.esc(p.page)}"
                      data-filter="${util.esc(p.filter || '')}"
                      data-subfilter="${util.esc(p.subfilter || '')}">
                    ${i > 0 ? '<i class="fas fa-chevron-right sep" style="font-size:0.55rem;margin-right:0.35rem;"></i>' : ''}
                    ${util.esc(p.label)}
                </span>
            `;
        }).join('');

        $$('.crumb', bc).forEach(c => {
            if (c.classList.contains('current')) return;
            c.addEventListener('click', () => {
                if (typeof window.navigate === 'function') {
                    window.navigate(c.dataset.page, c.dataset.filter, c.dataset.subfilter);
                }
            });
        });
    }

    // ============================================================
    // 6. COMMAND PALETTE
    // ============================================================
    let paletteOpen = false;
    let paletteSelected = 0;
    let paletteResults = [];

    function initCommandPalette() {
        if (!KK.flags.commandPalette) return;

        const overlay = document.createElement('div');
        overlay.className = 'kk-palette-overlay';
        overlay.id = 'kkPaletteOverlay';
        overlay.innerHTML = `
            <div class="kk-palette" role="dialog">
                <div class="kk-palette-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="kkPaletteInput" placeholder="Search cases, clients, actions..." autocomplete="off">
                    <kbd style="background:#f1f5f9;padding:0.15rem 0.45rem;border-radius:4px;font-size:0.65rem;color:#64748b;">ESC</kbd>
                </div>
                <div class="kk-palette-results" id="kkPaletteResults"></div>
                <div class="kk-palette-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
                    <span><kbd>↵</kbd> Open</span>
                    <span><kbd>Esc</kbd> Close</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = $('kkPaletteInput');

        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                togglePalette();
            }
            if (!paletteOpen) return;
            if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); paletteSelected = Math.min(paletteSelected + 1, paletteResults.length - 1); highlightResult(); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); paletteSelected = Math.max(paletteSelected - 1, 0); highlightResult(); }
            if (e.key === 'Enter')     { e.preventDefault(); activateResult(); }
        });

        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePalette(); });
        input.addEventListener('input', () => runPaletteQuery(input.value));
    }

    function togglePalette() { paletteOpen ? closePalette() : openPalette(); }
    function openPalette() {
        paletteOpen = true;
        paletteSelected = 0;
        const o = $('kkPaletteOverlay');
        o.classList.add('open');
        $('kkPaletteInput').value = '';
        $('kkPaletteInput').focus();
        runPaletteQuery('');
    }
    function closePalette() {
        paletteOpen = false;
        $('kkPaletteOverlay').classList.remove('open');
    }

    function runPaletteQuery(q) {
        const term = q.trim().toLowerCase();
        const { cases, clients, documents, tasks, accidents } = getState();
        const results = [];

        // --- Static actions always available ---
        const ACTIONS = [
            { group: 'Actions', title: 'New Case',      icon: 'fa-folder-plus',   run: () => { if ($('addCaseModal'))   { $('addCaseBtn')?.click(); } } },
            { group: 'Actions', title: 'New Client',    icon: 'fa-user-plus',     run: () => { $('addClientBtn')?.click(); } },
            { group: 'Actions', title: 'New Invoice',   icon: 'fa-file-invoice',  run: () => { $('addGlobalInvoiceBtn')?.click(); } },
            { group: 'Actions', title: 'Upload Document', icon: 'fa-cloud-upload-alt', run: () => { $('addDocBtn')?.click(); } },
            { group: 'Actions', title: 'New Task',      icon: 'fa-tasks',         run: () => { window.navigate('calendar'); setTimeout(() => $('taskTitle')?.focus(), 300); } },
            { group: 'Navigation', title: 'Open Dashboard', icon: 'fa-chart-pie',  run: () => window.navigate('dashboard') },
            { group: 'Navigation', title: 'Open Calendar',  icon: 'fa-calendar',   run: () => window.navigate('calendar') },
            { group: 'Navigation', title: 'Open Deadlines', icon: 'fa-hourglass-end', run: () => openDeadlinesView() },
            { group: 'Navigation', title: 'Open Cash Flow', icon: 'fa-money-bill-trend-up', run: () => openCashflowView() },
        ];
        ACTIONS.filter(a => !term || a.title.toLowerCase().includes(term)).forEach(a => results.push({ ...a, type: 'action' }));

        // --- Data search ---
        if (term) {
            clients.filter(c => (c.name || '').toLowerCase().includes(term)
                             || (c.email || '').toLowerCase().includes(term)
                             || (c.phone || '').includes(term))
                .slice(0, 6)
                .forEach(c => results.push({
                    group: 'Clients', title: c.name, subtitle: c.email || c.phone || '',
                    icon: 'fa-user', type: 'client', data: c,
                    run: () => window.showClientDetail && window.showClientDetail(c.id),
                }));

            cases.filter(c => (c.caseNo || '').toLowerCase().includes(term)
                           || (c.name || '').toLowerCase().includes(term)
                           || (c.client || '').toLowerCase().includes(term))
                .slice(0, 8)
                .forEach(c => results.push({
                    group: 'Cases', title: `${c.caseNo} — ${c.name}`,
                    subtitle: `${c.client || ''} · ${c.area || ''}`,
                    icon: 'fa-folder-open', type: 'case', data: c,
                    run: () => window.showCaseDetail && window.showCaseDetail(c.id),
                }));

            documents.filter(d => (d.name || '').toLowerCase().includes(term)
                               || (d.matter || '').toLowerCase().includes(term)
                               || (d.category || '').toLowerCase().includes(term))
                .slice(0, 5)
                .forEach(d => results.push({
                    group: 'Documents', title: d.name, subtitle: `${d.category || ''} · ${d.matter || ''}`,
                    icon: 'fa-file-alt', type: 'doc', data: d,
                    run: () => { window.navigate('documents', d.category || ''); },
                }));

            tasks.filter(t => (t.title || '').toLowerCase().includes(term)
                           || (t.caseName || '').toLowerCase().includes(term))
                .slice(0, 5)
                .forEach(t => results.push({
                    group: 'Tasks', title: t.title, subtitle: `${t.date || ''} · ${t.caseName || 'General'}`,
                    icon: 'fa-tasks', type: 'task', data: t,
                    run: () => window.navigate('calendar'),
                }));

            accidents.filter(a => (a.name || '').toLowerCase().includes(term)
                               || (a.claimNumber || '').toLowerCase().includes(term))
                .slice(0, 4)
                .forEach(a => results.push({
                    group: 'Accident Claims', title: a.name, subtitle: a.claimNumber || '',
                    icon: 'fa-car-burst', type: 'accident', data: a,
                    run: () => window.showAccidentClientDetail && window.showAccidentClientDetail(a.id),
                }));
        } else {
            // Default: recent cases
            cases.slice(0, 6).forEach(c => results.push({
                group: 'Recent Cases', title: `${c.caseNo} — ${c.name}`,
                subtitle: c.client || '', icon: 'fa-folder-open', type: 'case',
                run: () => window.showCaseDetail && window.showCaseDetail(c.id),
            }));
        }

        paletteResults = results.slice(0, 40);
        paletteSelected = 0;
        renderPaletteResults();
    }

    function renderPaletteResults() {
        const box = $('kkPaletteResults');
        if (!box) return;
        if (!paletteResults.length) {
            box.innerHTML = `<div style="padding:2rem;text-align:center;color:#94a3b8;font-size:0.85rem;">
                <i class="fas fa-search" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;opacity:0.5;"></i>
                No results. Try a case number, client name, or type "new".</div>`;
            return;
        }
        let html = '';
        let lastGroup = null;
        paletteResults.forEach((r, i) => {
            if (r.group !== lastGroup) {
                html += `<div class="kk-palette-group">${util.esc(r.group)}</div>`;
                lastGroup = r.group;
            }
            html += `
                <div class="kk-palette-item ${i === paletteSelected ? 'selected' : ''}" data-i="${i}">
                    <div class="icon"><i class="fas ${r.icon}"></i></div>
                    <div style="flex:1;min-width:0;">
                        <div class="title">${util.esc(r.title)}</div>
                        ${r.subtitle ? `<div class="subtitle">${util.esc(r.subtitle)}</div>` : ''}
                    </div>
                    <span class="badge-type">${util.esc(r.type)}</span>
                </div>
            `;
        });
        box.innerHTML = html;
        $$('.kk-palette-item', box).forEach(el => {
            el.addEventListener('mouseenter', () => { paletteSelected = parseInt(el.dataset.i, 10); highlightResult(); });
            el.addEventListener('click', () => { paletteSelected = parseInt(el.dataset.i, 10); activateResult(); });
        });
    }

    function highlightResult() {
        $$('.kk-palette-item').forEach((el, i) => el.classList.toggle('selected', i === paletteSelected));
        const sel = $$('.kk-palette-item')[paletteSelected];
        if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
    }

    function activateResult() {
        const r = paletteResults[paletteSelected];
        if (!r) return;
        closePalette();
        setTimeout(() => { try { r.run(); } catch (e) { console.warn('[palette]', e); } }, 80);
    }

    // ============================================================
    // 7. TODAY PANEL — inject into Dashboard
    // ============================================================
    function initTodayPanel() {
        if (!KK.flags.todayPanel) return;
        if (!getState().isFullAccess) return;
        const dash = $('page-dashboard');
        if (!dash) return;

        // Insert once
        if ($('kkTodayPanel')) return;
        const panel = document.createElement('div');
        panel.id = 'kkTodayPanel';
        panel.className = 'kk-today-panel';
        dash.insertBefore(panel, dash.firstChild);

        refreshTodayPanel();
        // Refresh every 60s and on data changes
        setInterval(refreshTodayPanel, 60000);
        window.addEventListener('kk:data-changed', refreshTodayPanel);
    }

    function refreshTodayPanel() {
        const panel = $('kkTodayPanel');
        if (!panel) return;
        const { tasks, cases, currentUserEmail, currentUserRole } = getState();
        const today = util.today();

        // Today's tasks
        const todaysTasks = tasks.filter(t => t.date === today && t.status === 'Scheduled');
        const courtAppearances = todaysTasks.filter(t => /court|hearing|mention|appearance/i.test(t.title + ' ' + (t.location || '')));
        const meetings = todaysTasks.filter(t => /meeting|conference|client/i.test(t.title));
        const filings = todaysTasks.filter(t => /file|filing|lodge/i.test(t.title));

        // Deadline count (from deadline engine)
        const deadlines = KK.deadlines ? KK.deadlines.upcoming(14) : [];
        const criticalDeadlines = deadlines.filter(d => d.days <= 3);

        // Greeting
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const firstName = (currentUserEmail || '').split('@')[0] || 'Counsel';
        const roleLabel = currentUserRole === 'admin' ? 'Partner'
                        : currentUserRole === 'developer' ? 'Developer'
                        : 'Clerk';

        // Build headline
        const bits = [];
        if (courtAppearances.length) bits.push(`${courtAppearances.length} court appearance${courtAppearances.length > 1 ? 's' : ''}`);
        if (criticalDeadlines.length) bits.push(`${criticalDeadlines.length} critical deadline${criticalDeadlines.length > 1 ? 's' : ''}`);
        if (meetings.length) bits.push(`${meetings.length} client meeting${meetings.length > 1 ? 's' : ''}`);
        const headline = bits.length
            ? `You have ${bits.join(', ')} today.`
            : 'No urgent items on your docket today.';

        panel.innerHTML = `
            <div class="kk-today-headline">
                <i class="fas fa-sun" style="color:#fbbf24;"></i>
                <span>${util.esc(greeting)}, ${util.esc(firstName)} <span style="opacity:0.6;font-weight:400;">· ${util.esc(roleLabel)}</span></span>
                <span class="date-sub">${new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div style="margin-bottom:0.85rem;font-size:0.9rem;color:#cbd5e1;">${util.esc(headline)}</div>
            <div class="kk-today-grid">
                <div class="kk-today-card" data-goto="court">
                    <div class="icon court"><i class="fas fa-gavel"></i></div>
                    <div><div class="kk-today-num">${courtAppearances.length}</div><div class="kk-today-label">In Court</div></div>
                </div>
                <div class="kk-today-card" data-goto="deadlines">
                    <div class="icon filing"><i class="fas fa-hourglass-end"></i></div>
                    <div><div class="kk-today-num">${criticalDeadlines.length}</div><div class="kk-today-label">Critical Deadlines</div></div>
                </div>
                <div class="kk-today-card" data-goto="meetings">
                    <div class="icon meeting"><i class="fas fa-handshake"></i></div>
                    <div><div class="kk-today-num">${meetings.length}</div><div class="kk-today-label">Client Meetings</div></div>
                </div>
                <div class="kk-today-card" data-goto="tasks">
                    <div class="icon task"><i class="fas fa-tasks"></i></div>
                    <div><div class="kk-today-num">${todaysTasks.length}</div><div class="kk-today-label">Total Tasks</div></div>
                </div>
            </div>
        `;

        $$('.kk-today-card', panel).forEach(card => {
            card.addEventListener('click', () => {
                const go = card.dataset.goto;
                if (go === 'deadlines') openDeadlinesView();
                else window.navigate('calendar');
            });
        });
    }

    // ============================================================
    // 8. CASE AGING HEATMAP
    // ============================================================
    function initAgingHeatmap() {
        if (!KK.flags.agingHeatmap) return;
        if (!getState().isFullAccess) return;
        const dash = $('page-dashboard');
        if (!dash) return;
        if ($('kkAgingPanel')) return;
        const panel = document.createElement('div');
        panel.id = 'kkAgingPanel';
        panel.className = 'table-wrap';
        panel.style.marginTop = '1.5rem';
        dash.appendChild(panel);
        refreshAgingHeatmap();
        window.addEventListener('kk:data-changed', refreshAgingHeatmap);
    }

    function refreshAgingHeatmap() {
        const panel = $('kkAgingPanel');
        if (!panel) return;
        const { cases } = getState();
        const active = cases.filter(c => c.status === 'Active' && c.filingDate);
        // Bucket by age (years)
        const buckets = [0, 0, 0, 0, 0]; // 0-6mo, 6-12mo, 1-2yr, 2-3yr, 3yr+
        const cells = active.map(c => {
            const days = Math.max(0, util.daysBetween(new Date(), new Date(c.filingDate)));
            let bucket = 0;
            if (days > 365 * 3) bucket = 4;
            else if (days > 365 * 2) bucket = 3;
            else if (days > 365) bucket = 2;
            else if (days > 180) bucket = 1;
            buckets[bucket]++;
            return { case: c, bucket, days };
        }).sort((a, b) => b.days - a.days);

        panel.innerHTML = `
            <h3 style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
                <i class="fas fa-fire" style="color:#ef4444;"></i> Case Aging Heatmap
                <span class="filter-badge">${active.length} active</span>
            </h3>
            <div style="font-size:0.8rem;color:#64748b;margin-bottom:0.75rem;">
                Each cell is one active case. Darker = older. Click a cell to open the case.
            </div>
            <div class="kk-aging-grid">
                ${cells.map(c => `
                    <div class="kk-aging-cell" data-age="${c.bucket}" data-caseid="${util.esc(c.case.id)}"
                         title="${util.esc(c.case.caseNo)} — ${util.esc(c.case.name)} (${Math.round(c.days / 30)} months)"></div>
                `).join('')}
            </div>
            <div class="kk-aging-legend">
                <span><span class="swatch" style="background:#dcfce7;"></span>0–6 months (${buckets[0]})</span>
                <span><span class="swatch" style="background:#fef3c7;"></span>6–12 months (${buckets[1]})</span>
                <span><span class="swatch" style="background:#fed7aa;"></span>1–2 years (${buckets[2]})</span>
                <span><span class="swatch" style="background:#fca5a5;"></span>2–3 years (${buckets[3]})</span>
                <span><span class="swatch" style="background:#ef4444;"></span>3+ years (${buckets[4]})</span>
            </div>
        `;

        $$('.kk-aging-cell', panel).forEach(cell => {
            cell.addEventListener('click', () => {
                const id = cell.dataset.caseid;
                if (id && window.showCaseDetail) window.showCaseDetail(id);
            });
        });
    }

    // ============================================================
    // 9. CONFLICT-OF-INTEREST CHECKER
    // ============================================================
    function initConflictChecker() {
        if (!KK.flags.conflicts) return;
        // Hook into addCaseForm + addClientForm + edit variants
        const forms = [
            { id: 'addCaseForm',    nameField: 'caseClient',  isCase: true  },
            { id: 'addClientForm',  nameField: 'clientName',  isCase: false },
            { id: 'editClientForm', nameField: 'editClientName', isCase: false },
        ];
        forms.forEach(f => hookConflictCheck(f));
    }

    function hookConflictCheck({ id, nameField }) {
        const form = $(id);
        if (!form) return;
        const input = $(nameField);
        if (!input) return;

        // Live check on blur
        input.addEventListener('blur', () => {
            const name = input.value.trim();
            if (name.length >= 3) runConflictCheck(name, form);
        });

        // Intercept submit
        const origSubmit = form.onsubmit;
        form.addEventListener('submit', (e) => {
            const name = input.value.trim();
            if (name.length >= 3) {
                const conflicts = findConflicts(name);
                if (conflicts.length && !form.dataset.kkConflictAck) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    showConflictWarning(form, name, conflicts);
                    return false;
                }
            }
        }, true);
    }

    function normalizeName(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/\b(mr|mrs|ms|dr|prof|hon|justice|adv|advocate|company|ltd|limited|inc|llc|llp|plc)\b/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function nameTokens(s) { return normalizeName(s).split(' ').filter(Boolean); }

    // Simple Jaccard + subset match. Soundex for Kenyan names is ideal but
    // requires a larger implementation; this gives 80% of the value.
    function nameSimilarity(a, b) {
        const ta = new Set(nameTokens(a));
        const tb = new Set(nameTokens(b));
        if (!ta.size || !tb.size) return 0;
        let intersect = 0;
        ta.forEach(t => { if (tb.has(t)) intersect++; });
        const union = new Set([...ta, ...tb]).size;
        return intersect / union;
    }

    function findConflicts(candidateName) {
        const { cases, clients } = getState();
        const conflicts = [];
        const threshold = 0.6;

        // 1. Against existing clients (same person twice — potentially fine, but flag)
        clients.forEach(c => {
            const sim = nameSimilarity(candidateName, c.name);
            if (sim >= threshold) {
                conflicts.push({
                    type: 'Existing client',
                    name: c.name,
                    context: c.email || c.phone || 'Client record',
                    similarity: sim,
                    refId: c.id,
                });
            }
        });

        // 2. Against case parties & adverse parties
        cases.forEach(cs => {
            // Case name usually "X v Y" — split it
            const parts = String(cs.name || '').split(/\s+v[s]?\.?\s+/i);
            parts.forEach((p, idx) => {
                const sim = nameSimilarity(candidateName, p);
                if (sim >= threshold && p.trim().length > 2) {
                    conflicts.push({
                        type: idx === 1 ? 'Adverse party' : 'Case party',
                        name: p.trim(),
                        context: `${cs.caseNo || ''} — ${cs.name || ''}`,
                        similarity: sim,
                        refId: cs.id,
                        isAdverse: idx === 1,
                    });
                }
            });
            // 3. Against recorded parties array
            (cs.parties || []).forEach(p => {
                const sim = nameSimilarity(candidateName, p.name);
                if (sim >= threshold) {
                    conflicts.push({
                        type: p.category || 'Case party',
                        name: p.name,
                        context: `${cs.caseNo || ''} — ${cs.name || ''}`,
                        similarity: sim,
                        refId: cs.id,
                    });
                }
            });
        });

        // Deduplicate by name+refId
        const seen = new Set();
        return conflicts.filter(c => {
            const k = c.name + '|' + c.refId;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        }).sort((a, b) => b.similarity - a.similarity);
    }

    function runConflictCheck(name, form) {
        const conflicts = findConflicts(name);
        const existing = form.querySelector('.kk-conflict-warning');
        if (existing) existing.remove();
        if (conflicts.length) showConflictWarning(form, name, conflicts);
    }

    function showConflictWarning(form, name, conflicts) {
        const existing = form.querySelector('.kk-conflict-warning');
        if (existing) existing.remove();
        const box = document.createElement('div');
        box.className = 'kk-conflict-warning';
        box.innerHTML = `
            <div class="title"><i class="fas fa-triangle-exclamation"></i> Possible Conflict of Interest</div>
            <div style="font-size:0.82rem;color:#7f1d1d;margin-bottom:0.4rem;">
                <strong>${util.esc(name)}</strong> resembles the following records. Review before proceeding:
            </div>
            ${conflicts.slice(0, 6).map(c => `
                <div class="match">
                    <span class="match-type">${util.esc(c.type)}</span>
                    <strong>${util.esc(c.name)}</strong>
                    <div style="font-size:0.7rem;color:#64748b;margin-top:0.2rem;">
                        ${util.esc(c.context)} · ${Math.round(c.similarity * 100)}% match
                    </div>
                </div>
            `).join('')}
            <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button type="button" class="btn btn-danger btn-sm" data-conflict="cancel">
                    <i class="fas fa-times"></i> Cancel & Investigate
                </button>
                <button type="button" class="btn btn-outline btn-sm" data-conflict="ack">
                    <i class="fas fa-check"></i> Acknowledge & Proceed
                </button>
            </div>
        `;
        form.insertBefore(box, form.firstChild);
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });

        box.querySelector('[data-conflict="cancel"]').addEventListener('click', () => {
            box.remove();
            const nameInput = form.querySelector('input, select');
            if (nameInput) nameInput.focus();
        });
        box.querySelector('[data-conflict="ack"]').addEventListener('click', () => {
            form.dataset.kkConflictAck = '1';
            util.log('Conflict Acknowledged', `Name: ${name} — ${conflicts.length} match(es)`);
            util.toast('Conflict acknowledged. Proceeding.', 'warning');
            // Trigger submit programmatically
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.click();
            setTimeout(() => { delete form.dataset.kkConflictAck; box.remove(); }, 500);
        });
    }

    // Expose for external use
    KK.conflicts = { find: findConflicts, similarity: nameSimilarity };

    // ============================================================
    // 10. STATUTORY DEADLINE ENGINE
    // ============================================================
    // Kenyan procedural rules of thumb (not legal advice — user must verify)
    const DEADLINE_RULES = {
        'Civil': [
            { event: 'fileDefence', label: 'File Defence', days: 14, from: 'serviceDate', citation: 'Order 7 Rule 1 CPR' },
            { event: 'fileReply', label: 'File Reply to Defence', days: 14, from: 'defenceServed', citation: 'Order 7 Rule 5 CPR' },
            { event: 'setDown', label: 'Set Down for Hearing', days: 30, from: 'closeOfPleadings', citation: 'Order 11 CPR' },
        ],
        'Criminal': [
            { event: 'mention', label: 'Mention', days: 14, from: 'pleaDate' },
            { event: 'hearing', label: 'Hearing', days: 60, from: 'pleaDate', citation: 'Art 50(2)(e) Constitution' },
        ],
        'ELCs': [
            { event: 'defence', label: 'File Defence & Counterclaim', days: 14, from: 'serviceDate' },
            { event: 'pld', label: 'Pre-Liminary Objection Window', days: 21, from: 'serviceDate' },
        ],
        'Succession': [
            { event: 'objection', label: 'Objection to Grant', days: 30, from: 'grantDate', citation: 's.67 LSA' },
            { event: 'confirmation', label: 'Apply for Confirmation of Grant', days: 180, from: 'grantDate', citation: 's.71 LSA' },
        ],
        'Employment': [
            { event: 'memorandum', label: 'File Memorandum of Appeal', days: 30, from: 'judgmentDate' },
        ],
        'Divorce': [
            { event: 'answer', label: 'File Answer & Cross-Petition', days: 21, from: 'serviceDate' },
        ],
        'Running Down': [
            { event: 'defence', label: 'File Defence', days: 14, from: 'serviceDate' },
        ],
        'Children': [
            { event: 'response', label: 'File Response', days: 14, from: 'serviceDate' },
        ],
        'Kadhi': [
            { event: 'response', label: 'File Response', days: 14, from: 'serviceDate' },
        ],
        'Tribunal': [
            { event: 'response', label: 'File Response', days: 14, from: 'serviceDate' },
        ],
        'Conveyancing': [],
    };

    function initDeadlineEngine() {
        if (!KK.flags.deadlines) return;
        KK.deadlines = {
            rules: DEADLINE_RULES,
            upcoming: upcomingDeadlines,
            forCase: deadlinesForCase,
            open: openDeadlinesView,
        };
    }

    function deadlinesForCase(c) {
        const rules = DEADLINE_RULES[c.area] || [];
        const out = [];
        const baseDate = c.filedDate || c.filingDate;
        if (!baseDate) return out;
        rules.forEach(r => {
            const anchor = baseDate; // simplified — real impl would use event dates
            const due = new Date(anchor);
            due.setDate(due.getDate() + r.days);
            out.push({
                caseId: c.id, caseNo: c.caseNo, caseName: c.name,
                label: r.label, event: r.event, due: due.toISOString().slice(0, 10),
                citation: r.citation || '', days: util.daysBetween(due, new Date()),
                done: false, // would be tracked in a subcollection
            });
        });
        return out;
    }

    function upcomingDeadlines(daysAhead) {
        const { cases } = getState();
        const limit = daysAhead || 30;
        const all = [];
        cases.filter(c => c.status === 'Active').forEach(c => {
            deadlinesForCase(c).forEach(d => {
                if (d.days >= 0 && d.days <= limit) all.push(d);
            });
        });
        return all.sort((a, b) => a.days - b.days);
    }

    function openDeadlinesView() {
        // Create a virtual page
        let page = $('page-deadlines');
        if (!page) {
            page = document.createElement('div');
            page.id = 'page-deadlines';
            page.className = 'page';
            $('mainContent').appendChild(page);
        }
        // Hide all, show this
        $$('.page').forEach(p => p.classList.remove('active'));
        page.classList.add('active');
        $('pageTitle').textContent = 'Statutory Deadlines';

        const upcoming = upcomingDeadlines(60);
        const overdue = upcomingDeadlines(3650).filter(d => d.days < 0);

        page.innerHTML = `
            <div class="permission-note">
                <i class="fas fa-info-circle"></i>
                Statutory deadlines are computed from case filing dates and Kenyan procedural rules.
                <strong>Always verify against the actual pleadings and current rules.</strong>
            </div>
            <div class="targets-overview-grid">
                <div class="target-overview-card">
                    <div class="ov-label">Overdue</div>
                    <div class="ov-value" style="color:#dc2626;">${overdue.length}</div>
                    <div class="ov-sub">immediate action required</div>
                </div>
                <div class="target-overview-card">
                    <div class="ov-label">Next 7 Days</div>
                    <div class="ov-value" style="color:#d97706;">${upcoming.filter(d => d.days <= 7).length}</div>
                    <div class="ov-sub">critical window</div>
                </div>
                <div class="target-overview-card">
                    <div class="ov-label">Next 30 Days</div>
                    <div class="ov-value">${upcoming.filter(d => d.days <= 30).length}</div>
                    <div class="ov-sub">planning horizon</div>
                </div>
                <div class="target-overview-card">
                    <div class="ov-label">Total Tracked</div>
                    <div class="ov-value">${upcoming.length + overdue.length}</div>
                    <div class="ov-sub">across active cases</div>
                </div>
            </div>
            <div class="table-wrap">
                <h3><i class="fas fa-hourglass-end"></i> Upcoming Deadlines</h3>
                ${upcoming.length ? upcoming.map(d => deadlineCardHTML(d)).join('') : '<p class="text-muted">No upcoming deadlines in the next 60 days.</p>'}
            </div>
            ${overdue.length ? `
            <div class="table-wrap" style="border:2px solid #dc2626;">
                <h3 style="color:#dc2626;"><i class="fas fa-exclamation-triangle"></i> Overdue</h3>
                ${overdue.map(d => deadlineCardHTML(d)).join('')}
            </div>` : ''}
        `;

        $$('.kk-deadline-card', page).forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.caseid;
                if (id && window.showCaseDetail) window.showCaseDetail(id);
            });
        });

        renderBreadcrumbs('deadlines');
    }

    function deadlineCardHTML(d) {
        const rag = d.days < 0 ? 'rag-danger' : d.days <= 3 ? 'rag-danger' : d.days <= 14 ? 'rag-warning' : '';
        const countdown = d.days < 0 ? `${Math.abs(d.days)}d overdue`
                        : d.days === 0 ? 'TODAY'
                        : d.days === 1 ? 'Tomorrow'
                        : `${d.days} days`;
        return `
            <div class="kk-deadline-card ${rag}" data-caseid="${util.esc(d.caseId)}" style="cursor:pointer;">
                <div class="d-icon"><i class="fas fa-gavel"></i></div>
                <div style="flex:1;min-width:0;">
                    <div class="d-title">${util.esc(d.label)}</div>
                    <div class="d-meta">
                        <strong>${util.esc(d.caseNo)}</strong> — ${util.esc(d.caseName)}
                        · Due ${util.esc(d.due)}
                        ${d.citation ? ' · ' + util.esc(d.citation) : ''}
                    </div>
                </div>
                <div class="d-countdown">${util.esc(countdown)}</div>
            </div>
        `;
    }

    // ============================================================
    // 11. DOCUMENT VERSIONING
    // ============================================================
    function initDocVersioning() {
        if (!KK.flags.versioning) return;
        // Hook into every "View Document" and add a "Versions" button
        // We listen on the docs table and inject a Versions button per row
        const obs = new MutationObserver(() => {
            $$('#docsBody tr').forEach(tr => {
                if (tr.dataset.kkVersionPatched) return;
                const docId = tr.querySelector('.delete-doc-btn')?.dataset.docid;
                if (!docId) return;
                tr.dataset.kkVersionPatched = '1';
                const actionCell = tr.querySelector('.doc-actions');
                if (actionCell && !actionCell.querySelector('.kk-versions-btn')) {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-sm kk-versions-btn';
                    btn.style.background = '#0891b2';
                    btn.style.color = 'white';
                    btn.title = 'Version history';
                    btn.innerHTML = '<i class="fas fa-code-branch"></i>';
                    btn.addEventListener('click', (e) => { e.stopPropagation(); openVersionsModal(docId); });
                    actionCell.appendChild(btn);
                }
            });
        });
        const target = $('docsBody');
        if (target) obs.observe(target, { childList: true, subtree: true });
    }

    async function openVersionsModal(docId) {
        const doc = (window.documentsData || []).find(d => d.id === docId);
        if (!doc) return;
        // Fetch versions subcollection
        let versions = [];
        try {
            const snap = await db.collection('documents').doc(docId).collection('versions')
                .orderBy('version', 'desc').get();
            snap.forEach(v => versions.push({ id: v.id, ...v.data() }));
        } catch (e) { console.warn('[versions]', e); }

        // Always show current as v1 if no history yet
        if (!versions.length) {
            versions = [{
                version: 1, isCurrent: true,
                uploadedBy: doc.uploadedBy || 'system',
                uploadedAt: doc.uploaded || util.today(),
                size: doc.size || '—',
                note: 'Initial upload',
            }];
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" style="max-width:600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-code-branch"></i> Version History</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div style="font-weight:600;margin-bottom:0.5rem;">${util.esc(doc.name)}</div>
                <div style="font-size:0.8rem;color:#64748b;margin-bottom:1rem;">
                    Category: ${util.esc(doc.category || '—')} · Matter: ${util.esc(doc.matter || '—')}
                </div>
                <div class="kk-version-list">
                    ${versions.map(v => `
                        <div class="kk-version-item ${v.isCurrent ? 'current' : ''}">
                            <div class="vnum">v${v.version || 1}</div>
                            <div class="vmeta">
                                <div><strong>${util.esc(v.note || 'Upload')}</strong>${v.isCurrent ? ' <span class="badge green" style="font-size:0.6rem;">Current</span>' : ''}</div>
                                <div class="vby">
                                    <i class="fas fa-user"></i> ${util.esc(v.uploadedBy || 'system')}
                                    · <i class="fas fa-clock"></i> ${util.esc(v.uploadedAt || '—')}
                                    · ${util.esc(v.size || '—')}
                                </div>
                            </div>
                            <div class="vactions">
                                ${!v.isCurrent ? `<button class="btn btn-outline btn-sm" data-vrestore="${v.id}"><i class="fas fa-undo"></i> Restore</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid #e9edf2;">
                    <label class="btn btn-primary btn-sm" style="cursor:pointer;">
                        <i class="fas fa-plus"></i> Upload New Version
                        <input type="file" style="display:none;" id="kkNewVersionFile">
                    </label>
                    <input type="text" id="kkNewVersionNote" placeholder="Note (e.g. 'Added paragraph 5')"
                           style="margin-left:0.5rem;padding:0.35rem 0.6rem;border:1px solid #d1d9e6;border-radius:6px;font-size:0.8rem;width:60%;">
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const fileInput = modal.querySelector('#kkNewVersionFile');
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) return;
            const note = modal.querySelector('#kkNewVersionNote').value.trim() || 'New version';
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const fileId = 'f' + Date.now();
                if (window.fileStore) window.fileStore[fileId] = ev.target.result;
                const nextV = (versions[0]?.version || 0) + 1;
                try {
                    await db.collection('documents').doc(docId).collection('versions').add({
                        version: nextV,
                        uploadedBy: getState().currentUserEmail || 'system',
                        uploadedAt: util.now(),
                        size: (file.size / 1024).toFixed(1) + ' KB',
                        note: note,
                        fileId: fileId,
                        isCurrent: false,
                    });
                    // Update parent to mark this as current
                    await db.collection('documents').doc(docId).update({
                        lastVersion: nextV,
                        lastVersionAt: util.now(),
                    });
                    util.toast(`Version v${nextV} uploaded.`, 'info');
                    util.log('Document Version Added', `${doc.name} → v${nextV}`);
                    modal.remove();
                    openVersionsModal(docId);
                } catch (e) {
                    util.toast('Failed: ' + e.message, 'error');
                }
            };
            reader.readAsDataURL(file);
        });

        modal.querySelectorAll('[data-vrestore]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Restore this version as the current one? The existing current version will be preserved as history.')) return;
                const vid = btn.dataset.vrestore;
                try {
                    // Mark all as not current
                    const all = await db.collection('documents').doc(docId).collection('versions').get();
                    const batch = db.batch();
                    all.forEach(v => batch.update(v.ref, { isCurrent: false }));
                    batch.update(db.collection('documents').doc(docId).collection('versions').doc(vid), { isCurrent: true });
                    await batch.commit();
                    util.toast('Version restored.', 'info');
                    util.log('Document Version Restored', doc.name);
                    modal.remove();
                } catch (e) { util.toast('Restore failed: ' + e.message, 'error'); }
            });
        });
    }

    // ============================================================
    // 12. ARO CALCULATOR
    // ============================================================
    // Simplified Advocates Remuneration Order (2014) — Schedule VI scale.
    // NOTE: This is an INDICATIVE calculation. The user must verify.
    const ARO_SCALE = [
        { max: 100000,      pct: 12.5, min: 15000 },
        { max: 500000,      pct: 10,   min: 0 },
        { max: 1000000,     pct: 8,    min: 0 },
        { max: 5000000,     pct: 6,    min: 0 },
        { max: 10000000,    pct: 5,    min: 0 },
        { max: 20000000,    pct: 4,    min: 0 },
        { max: Infinity,    pct: 3,    min: 0 },
    ];
    const VAT_RATE = 0.16;

    function computeARO(subjectValue, options) {
        const opts = options || {};
        let remaining = subjectValue;
        let prevCap = 0;
        let fee = 0;
        const breakdown = [];
        for (const tier of ARO_SCALE) {
            if (remaining <= 0) break;
            const band = Math.min(remaining, tier.max - prevCap);
            const bandFee = band * (tier.pct / 100);
            fee += bandFee;
            breakdown.push({ band: `${util.fmtKES(prevCap)} – ${util.fmtKES(tier.max === Infinity ? subjectValue : tier.max)}`, rate: tier.pct + '%', fee: bandFee });
            remaining -= band;
            prevCap = tier.max;
            if (tier.max === Infinity) break;
        }
        // Apply minimum
        const topTier = ARO_SCALE.find(t => subjectValue <= t.max) || ARO_SCALE[0];
        if (topTier.min && fee < topTier.min) {
            breakdown.push({ band: 'Minimum fee applied', rate: '', fee: topTier.min - fee });
            fee = topTier.min;
        }
        const disbursements = opts.disbursements || 0;
        const subtotal = fee + disbursements;
        const vat = subtotal * VAT_RATE;
        const total = subtotal + vat;
        return { fee, disbursements, subtotal, vat, total, breakdown };
    }

    function initAROCalculator() {
        if (!KK.flags.aro) return;
        // Inject calculator into the add/edit case modal near the fee field
        ['addCaseModal', 'editCaseModal'].forEach(modalId => {
            const modal = $(modalId);
            if (!modal) return;
            if (modal.dataset.kkAroPatched) return;
            modal.dataset.kkAroPatched = '1';
            const feeInput = modal.querySelector('[id$="CaseFee"]');
            if (!feeInput) return;
            const wrap = feeInput.closest('.form-group');
            if (!wrap) return;
            const box = document.createElement('div');
            box.className = 'kk-aro-box';
            box.innerHTML = `
                <h5><i class="fas fa-calculator"></i> ARO Fee Calculator <span style="font-weight:400;font-size:0.7rem;color:#64748b;">(indicative — verify against current scale)</span></h5>
                <div class="form-group" style="margin:0 0 0.5rem 0;">
                    <label style="font-size:0.75rem;">Subject Matter Value (KES)</label>
                    <input type="number" class="kk-aro-subject" min="0" step="1000" placeholder="e.g. 2,500,000"
                           style="width:100%;padding:0.4rem;border:1px solid #bae6fd;border-radius:6px;font-size:0.85rem;">
                </div>
                <div class="form-group" style="margin:0 0 0.5rem 0;">
                    <label style="font-size:0.75rem;">Disbursements (KES)</label>
                    <input type="number" class="kk-aro-disb" min="0" step="100" value="0"
                           style="width:100%;padding:0.4rem;border:1px solid #bae6fd;border-radius:6px;font-size:0.85rem;">
                </div>
                <div class="kk-aro-output"></div>
                <button type="button" class="btn btn-sm btn-primary" style="margin-top:0.5rem;" data-aro="apply">
                    <i class="fas fa-arrow-down"></i> Apply Total to Case Fee
                </button>
            `;
            wrap.appendChild(box);

            const subject = box.querySelector('.kk-aro-subject');
            const disb = box.querySelector('.kk-aro-disb');
            const out = box.querySelector('.kk-aro-output');

            const recompute = () => {
                const sv = parseFloat(subject.value) || 0;
                if (!sv) { out.innerHTML = '<div style="font-size:0.75rem;color:#94a3b8;font-style:italic;">Enter subject value to see scale fee.</div>'; return; }
                const r = computeARO(sv, { disbursements: parseFloat(disb.value) || 0 });
                out.innerHTML = `
                    ${r.breakdown.map(b => `
                        <div class="kk-aro-row">
                            <span>${util.esc(b.band)} ${b.rate ? `<span style="color:#64748b;">@ ${b.rate}</span>` : ''}</span>
                            <span>${util.fmtKES(b.fee)}</span>
                        </div>
                    `).join('')}
                    <div class="kk-aro-row"><span>Subtotal</span><span>${util.fmtKES(r.subtotal)}</span></div>
                    <div class="kk-aro-row"><span>VAT (16%)</span><span>${util.fmtKES(r.vat)}</span></div>
                    <div class="kk-aro-row total"><span>Total</span><span>${util.fmtKES(r.total)}</span></div>
                `;
            };
            subject.addEventListener('input', recompute);
            disb.addEventListener('input', recompute);

            box.querySelector('[data-aro="apply"]').addEventListener('click', () => {
                const sv = parseFloat(subject.value) || 0;
                if (!sv) { util.toast('Enter subject value first.', 'warning'); return; }
                const r = computeARO(sv, { disbursements: parseFloat(disb.value) || 0 });
                feeInput.value = Math.round(r.total);
                util.toast(`Applied ${util.fmtKES(r.total)} to case fee.`, 'info');
            });
        });
    }

    KK.aro = { compute: computeARO };

    // ============================================================
    // 13. OFFLINE-FIRST CONFLICT RESOLUTION
    // ============================================================
    function initOfflineSync() {
        if (!KK.flags.conflictSync) return;

        // Sync status pill
        const pill = document.createElement('div');
        pill.className = 'kk-sync-pill';
        pill.id = 'kkSyncPill';
        document.body.appendChild(pill);

        const updatePill = () => {
            const online = navigator.onLine;
            pill.className = 'kk-sync-pill show ' + (online ? 'online' : 'offline');
            pill.innerHTML = `
                <span class="kk-sync-dot"></span>
                ${online ? 'Online — synced' : 'Offline — changes queued'}
            `;
            if (online) {
                setTimeout(() => pill.classList.remove('show'), 2000);
            }
        };

        window.addEventListener('online', updatePill);
        window.addEventListener('offline', updatePill);
        updatePill();

        // Firestore pending writes indicator
        try {
            db.enableNetwork().catch(() => {});
            db.waitForPendingWrites().then(() => {
                // if we got here, all pending writes are done
            }).catch(() => {});
        } catch (e) {}
    }

    // ============================================================
    // 14. MULTI-STEP FORMS + AUTOSAVE
    // ============================================================
    function initMultiStepForms() {
        if (!KK.flags.multiStepForms) return;
        // Wire Add Case form to multi-step
        // This is a large transformation — implemented as an optional enhancement
        // that can be enabled per form via data-attribute
        $$('form[data-kk-steps]').forEach(form => transformToMultiStep(form));

        // Autosave every form
        $$('form').forEach(form => {
            if (form.dataset.kkAutosave) return;
            form.dataset.kkAutosave = '1';
            attachAutosave(form);
        });
    }

    function attachAutosave(form) {
        const key = 'kk_draft_' + (form.id || 'anon');
        // Restore prompt
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                if (draft.savedAt && (Date.now() - new Date(draft.savedAt).getTime()) < 7 * 24 * 3600 * 1000) {
                    showDraftBanner(form, key, draft);
                }
            } catch (e) {}
        }
        // Save on input
        form.addEventListener('input', () => {
            const data = {};
            new FormData(form).forEach((v, k) => { if (typeof v === 'string') data[k] = v; });
            data._savedAt = new Date().toISOString();
            try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
        });
        form.addEventListener('submit', () => { localStorage.removeItem(key); });
    }

    function showDraftBanner(form, key, draft) {
        const banner = document.createElement('div');
        banner.className = 'kk-draft-banner';
        banner.innerHTML = `
            <i class="fas fa-clock-rotate-left"></i>
            <span>Unsaved draft from ${new Date(draft._savedAt).toLocaleString()}</span>
            <div class="kk-draft-actions">
                <button type="button" class="btn btn-outline btn-sm" data-draft="discard">Discard</button>
                <button type="button" class="btn btn-primary btn-sm" data-draft="restore">Restore</button>
            </div>
        `;
        form.insertBefore(banner, form.firstChild);

        banner.querySelector('[data-draft="discard"]').addEventListener('click', () => {
            localStorage.removeItem(key);
            banner.remove();
        });
        banner.querySelector('[data-draft="restore"]').addEventListener('click', () => {
            Object.keys(draft).forEach(k => {
                if (k.startsWith('_')) return;
                const input = form.querySelector(`[name="${k}"]`) || form.querySelector(`#${k}`);
                if (input) input.value = draft[k];
            });
            banner.remove();
            util.toast('Draft restored.', 'info');
        });
    }

    function transformToMultiStep(form) {
        // Requires explicit data-steps attribute in the HTML like:
        // <form data-kk-steps='[{"title":"Basic"},{"title":"Court"},{"title":"Fees"}]'>
        // This function is a scaffold — wire it to specific forms later.
        try {
            const steps = JSON.parse(form.dataset.kkSteps || '[]');
            if (!steps.length) return;
        } catch (e) { return; }
    }

    // ============================================================
    // 15. PAGINATION HELPER
    // ============================================================
    const PAGINATION_STATE = {};
    function initPagination() {
        if (!KK.flags.pagination) return;
        // Attach to known tables via wrapping render functions
        // Simpler approach: expose a helper that renderers can call
        KK.paginate = function(container, items, pageSize, renderFn) {
            const key = container.id;
            const state = PAGINATION_STATE[key] = PAGINATION_STATE[key] || { page: 1 };
            const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
            state.page = Math.min(state.page, totalPages);
            const start = (state.page - 1) * pageSize;
            const slice = items.slice(start, start + pageSize);
            renderFn(slice);

            // Render pagination footer
            let footer = container.parentElement.querySelector('.kk-pagination');
            if (!footer) {
                footer = document.createElement('div');
                footer.className = 'kk-pagination';
                container.parentElement.appendChild(footer);
            }
            footer.innerHTML = `
                <span>Showing ${start + 1}–${Math.min(start + pageSize, items.length)} of ${items.length}</span>
                <div class="kk-page-btns">
                    <button ${state.page === 1 ? 'disabled' : ''} data-pg="prev"><i class="fas fa-chevron-left"></i></button>
                    ${buildPageButtons(state.page, totalPages)}
                    <button ${state.page === totalPages ? 'disabled' : ''} data-pg="next"><i class="fas fa-chevron-right"></i></button>
                </div>
            `;
            footer.querySelectorAll('button[data-pg]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const v = btn.dataset.pg;
                    if (v === 'prev') state.page = Math.max(1, state.page - 1);
                    else if (v === 'next') state.page = Math.min(totalPages, state.page + 1);
                    else state.page = parseInt(v, 10);
                    KK.paginate(container, items, pageSize, renderFn);
                });
            });
        };
    }

    function buildPageButtons(current, total) {
        const pages = [];
        const push = (n) => pages.push(`<button ${n === current ? 'class="active"' : ''} data-pg="${n}">${n}</button>`);
        if (total <= 7) { for (let i = 1; i <= total; i++) push(i); }
        else {
            push(1);
            if (current > 3) pages.push('<span style="padding:0 0.3rem;color:#94a3b8;">…</span>');
            for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) push(i);
            if (current < total - 2) pages.push('<span style="padding:0 0.3rem;color:#94a3b8;">…</span>');
            push(total);
        }
        return pages.join('');
    }

    // ============================================================
    // 16. PAGE CHANGE HOOK
    // ============================================================
    function onPageChange(page) {
        // Refresh data-driven widgets
        if (page === 'dashboard') {
            refreshTodayPanel();
            refreshAgingHeatmap();
        }
        // Lazy-init role dashboards
        if (page === 'dashboard') initTodayPanel();
    }

    // ============================================================
    // 17. CASH FLOW PROJECTION
    // ============================================================
    function openCashflowView() {
        let page = $('page-cashflow');
        if (!page) {
            page = document.createElement('div');
            page.id = 'page-cashflow';
            page.className = 'page';
            $('mainContent').appendChild(page);
        }
        $$('.page').forEach(p => p.classList.remove('active'));
        page.classList.add('active');
        $('pageTitle').textContent = 'Cash Flow Projection';

        const { clients, accidents, invoices } = getState();

        // Build monthly buckets for next 6 months
        const months = [];
        const now = new Date();
        for (let i = 0; i < 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' }),
                expected: 0, sources: [],
            });
        }

        // Expected from installments
        clients.forEach(c => {
            const fa = c.feeAgreement;
            if (!fa || !Array.isArray(fa.installments)) return;
            fa.installments.filter(i => !i.paid && i.date).forEach(i => {
                const key = i.date.slice(0, 7);
                const m = months.find(x => x.key === key);
                if (m) {
                    m.expected += parseInt(i.amount) || 0;
                    m.sources.push({ label: `${c.name} installment`, amount: parseInt(i.amount) || 0 });
                }
            });
        });

        // Expected from unpaid invoices
        invoices.filter(i => i.status !== 'Paid').forEach(i => {
            const key = (i.date || '').slice(0, 7);
            const m = months.find(x => x.key === key);
            if (m) {
                m.expected += parseInt(i.amount) || 0;
                m.sources.push({ label: `${i.clientName || 'Client'} invoice`, amount: parseInt(i.amount) || 0 });
            }
        });

        const total = months.reduce((s, m) => s + m.expected, 0);

        page.innerHTML = `
            <div class="permission-note">
                <i class="fas fa-chart-line"></i>
                Projected inflows from <strong>unpaid invoices</strong> and <strong>scheduled installments</strong>. Not a guarantee — treat as a planning tool.
            </div>
            <div class="targets-overview-grid">
                <div class="target-overview-card">
                    <div class="ov-label">6-Month Projection</div>
                    <div class="ov-value">${util.fmtKES(total)}</div>
                    <div class="ov-sub">across all sources</div>
                </div>
                ${months.slice(0, 3).map(m => `
                    <div class="target-overview-card">
                        <div class="ov-label">${util.esc(m.label)}</div>
                        <div class="ov-value">${util.fmtKES(m.expected)}</div>
                        <div class="ov-sub">${m.sources.length} item${m.sources.length !== 1 ? 's' : ''}</div>
                    </div>
                `).join('')}
            </div>
            <div class="table-wrap">
                <h3><i class="fas fa-calendar"></i> Monthly Breakdown</h3>
                <table style="min-width:100%;">
                    <thead><tr><th>Month</th><th>Expected Inflow</th><th>Sources</th></tr></thead>
                    <tbody>
                        ${months.map(m => `
                            <tr>
                                <td><strong>${util.esc(m.label)}</strong></td>
                                <td>${util.fmtKES(m.expected)}</td>
                                <td style="font-size:0.75rem;color:#64748b;">
                                    ${m.sources.length ? m.sources.slice(0, 4).map(s => util.esc(s.label) + ' — ' + util.fmtKES(s.amount)).join('<br>') : '—'}
                                    ${m.sources.length > 4 ? `<br><em>+ ${m.sources.length - 4} more</em>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        renderBreadcrumbs('cashflow');
    }

    // ============================================================
    // EXPORTS & EVENT BRIDGE
    // ============================================================
    KK.openDeadlinesView = openDeadlinesView;
    KK.openCashflowView = openCashflowView;
    KK.refreshTodayPanel = refreshTodayPanel;
    KK.refreshAgingHeatmap = refreshAgingHeatmap;
    KK.findConflicts = findConflicts;

    // Notify v2 of data changes when Firestore listeners fire
    ['casesData', 'clientsData', 'tasksData', 'invoicesData', 'documentsData', 'accidentClientsData', 'portalRequestsData', 'activityLogs', 'usersData'].forEach(name => {
        // Poll — admin.js reassigns arrays, so we can't observe them directly
        let last = null;
        setInterval(() => {
            const cur = window[name];
            if (cur !== last) {
                last = cur;
                window.dispatchEvent(new CustomEvent('kk:data-changed', { detail: { name } }));
            }
        }, 3000);
    });

    // Whenever data changes, refresh the sidebar counters
    window.addEventListener('kk:data-changed', () => {
        try { refreshPanelCounters(); } catch (e) {}
    });

    // Re-render v2 widgets whenever navigate() is called externally
    const origNavigateForV2 = window.navigate;
    if (typeof origNavigateForV2 === 'function' && !window.__kkNavigatePatched) {
        patchNavigate();
    }

    console.log('[KKv2] Enhancement layer loaded. Command palette: Cmd/Ctrl+K');
})();

