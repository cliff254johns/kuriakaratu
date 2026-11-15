# Legal Practice Ecosystem — Security and Release Gate

## Scope approved
The target ecosystem retains the five existing applications as separate modules:
- Public website and Knowledge Centre
- Administration and website content management
- Client portal
- Case management and calendar
- Documents and document generation
- Finance and trust/client accounting

## Security findings verified in the repository
1. The former administrator frontend embedded default staff credentials and attempted to create staff accounts from a public browser session.
2. The finance portal displayed and accepted hard-coded staff credentials, including an offline authentication fallback.
3. The client portal attempted to auto-link and approve portal registrations by matching public sign-up details against client, phone, or case records.
4. The repository does not contain a reviewed Firestore security-rules file or a tested trusted backend for privileged role assignment, audit events, document access, backups, or notifications.
5. UI role checks are not a security boundary. Firestore/Storage rules and trusted server authorization must enforce every read and write.

## Immediate code hardening in this change
- Remove embedded/default staff passwords and browser-side staff-account seeding.
- Require a pre-provisioned staff profile before staff access.
- Remove finance's hard-coded and offline sign-in bypass.
- Make every client portal registration pending; public sign-up no longer auto-links by matching client or case data.

## Production blockers — do not mark these features live until verified
- Obtain and review the active Firebase Firestore and Storage rules from the Firebase project.
- Enforce server-side staff roles using Firebase custom claims or a trusted role service; prevent users from editing their own role/profile.
- Verify that clients can read only their own approved profile, cases, documents, appointments, invoices and receipts.
- Verify that staff roles have least-privilege access and that finance/trust records are restricted to authorised finance roles.
- Move privileged writes, audit logging, notifications, content publishing and account linking to a trusted backend.
- Add private document storage with authenticated, short-lived download links; never expose client files through public R2/custom domains.
- Establish backup schedules, retention, restore tests, audit-log immutability and incident procedures.
- Configure email/SMS notification providers through secrets; do not log confidential matter details.
- Complete legal-practice data-protection review, retention schedule and client-facing privacy notices.

## Editorial controls
- Case studies remain unpublished until a responsible advocate approves the facts, anonymisation and client consent/waiver where required.
- New legal articles remain drafts until an advocate reviews legal accuracy, currency, jurisdiction and publication date.
- Lawyer profiles, qualifications, outcomes, awards, testimonials, addresses and service claims require firm verification.

## Acceptance tests required before release
- Unauthenticated users cannot read any private record or upload/download client documents.
- Client A cannot read Client B's records by changing IDs, query filters, URLs or request payloads.
- Client sign-up always creates a pending request; only authorised staff can approve and link it.
- A clerk cannot access restricted finance, staff administration or privileged document operations.
- A finance user cannot change case permissions or publish website content unless explicitly granted.
- All privileged changes create attributable audit events.
- Document upload, retrieval, deletion, retention and backup restoration are tested.
- Consultation submissions are validated, rate-limited, stored privately and trigger safe notifications.
- Mobile, desktop, keyboard, screen-reader, performance and security tests pass on production-equivalent staging.

## Deployment policy
The public website may be deployed independently of private operations. Do not expose new private workflows or claim that confidential-data security is complete until the blockers and acceptance tests above pass. Search Console and Google Business Profile require the firm's authorised account owner and verified business details.
