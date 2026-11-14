/* ============================================================
   SIDEBAR COUNTERS — standalone
   Depends on window.KKData() exposed from admin.js
   Safe to load even if admin.js hasn't run yet.
   ============================================================ */

(function sidebarCounters() {
    'use strict';

    const PAGE_COUNTERS = {
        dashboard:       (d) => d.cases.filter(c => c.status === 'Active').length,
        clients:         (d) => d.clients.length,
        invoices:        (d) => d.invoices.length,
        cases:           (d) => d.cases.length,
        documents:       (d) => d.documents.length,
        calendar:        (d) => d.tasks.filter(t => t.status === 'Scheduled').length,
        targets:         (d) => d.practiceAreas.filter(p => {
                             const t = d.targets[p];
                             return t && (t.revenue || t.won || t.filed || t.active);
                         }).length,
        payments:        (d) => d.invoices.filter(i => i.status !== 'Paid').length,
        fees:            (d) => d.clients.filter(c => {
                             const fa = c.feeAgreement;
                             return fa && Array.isArray(fa.installments) &&
                                    fa.installments.some(i => !i.paid && i.date && i.date <= today());
                         }).length,
        accidentClients: (d) => d.accidentClients.length,
        activity:        (d) => d.activityLogs.length,
        users:           (d) => d.users.length,
        portal:          (d) => d.portalRequests.filter(r => !r.status || r.status === 'pending').length
    };

    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    /* ---------------------------------------------------------
       Compute the count for one nav item
       --------------------------------------------------------- */
    function computeCount(item, d) {
        const page   = item.dataset.page   || '';
        const filter = item.dataset.filter || '';
        const sub    = item.dataset.subfilter || '';

        // --- Documents: count per category AND per sub-category ---
        if (page === 'documents') {
            if (filter && sub) {
                return d.documents.filter(x =>
                    (x.category || '') === filter &&
                    (x.subCategory || '') === sub
                ).length;
            }
            if (filter) {
                return d.documents.filter(x => (x.category || '') === filter).length;
            }
            return d.documents.length;
        }

        // --- Cases: count per practice area and per court type ---
        if (page === 'cases') {
            if (filter && sub) {
                return d.cases.filter(c => c.area === filter && c.courtType === sub).length;
            }
            if (filter) {
                return d.cases.filter(c => c.area === filter).length;
            }
            return d.cases.length;
        }

        // --- Everything else: use the PAGE_COUNTERS table ---
        const fn = PAGE_COUNTERS[page];
        return fn ? fn(d) : null;
    }

    /* ---------------------------------------------------------
       Render pass — walks every nav item and updates its chip
       --------------------------------------------------------- */
    function render() {
        const nav = document.getElementById('sidebarNav');
        if (!nav) return;

        // Data not yet exposed — silently skip
        if (typeof window.KKData !== 'function') return;
        let d;
        try { d = window.KKData(); } catch (e) { return; }
        if (!d) return;

        nav.querySelectorAll('.nav-item[data-page]').forEach(item => {
            const value = computeCount(item, d);

            let chip = item.querySelector('.nav-count');

            // No count for this page (AI Tools, Reports, Settings, Integration)
            if (value == null) {
                if (chip) chip.remove();
                return;
            }

            if (!chip) {
                chip = document.createElement('span');
                chip.className = 'nav-count';
                item.appendChild(chip);
            }

            if (chip.textContent !== String(value)) {
                chip.textContent = value;
                chip.title = `${value} item${value === 1 ? '' : 's'}`;
            }

            // Visual cue when zero
            chip.style.opacity = value === 0 ? '0.4' : '';
        });
    }

    /* ---------------------------------------------------------
       Throttled scheduler — coalesces rapid re-renders
       --------------------------------------------------------- */
    let scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            render();
        });
    }

    /* ---------------------------------------------------------
       Boot — poll every 2 seconds
       Simple, dependency-free, works regardless of when
       admin.js finishes loading its listeners.
       --------------------------------------------------------- */
    function boot() {
        // Initial delay to let admin.js render the sidebar first
        setTimeout(schedule, 800);
        setInterval(schedule, 2000);

        // Also re-render on window focus (user comes back to the tab)
        window.addEventListener('focus', schedule);

        // Watch for the Documents dropdown being rebuilt by admin.js
        const docsDrop = document.getElementById('docsDrop');
        if (docsDrop && typeof MutationObserver !== 'undefined') {
            new MutationObserver(schedule).observe(docsDrop, {
                childList: true,
                subtree: true
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Expose for console debugging
    window.refreshSidebarCounts = schedule;
})();
