# Legal Practice Ecosystem — Security and Release Gate

## Scope approved
Retain the five existing applications as separate modules: public website and Knowledge Centre; administration and content management; client portal; case management and calendar; documents and generation; finance and trust/client accounting.

## Verified repository findings
1. The administrator frontend embedded default staff passwords and attempted to create staff accounts from a public browser session.
2. The finance portal displayed hard-coded staff credentials and allowed an offline authentication bypass.
3. The client portal attempted to auto-link and approve sign-ups by matching public user input against client, phone or case records.
4. No reviewed Firestore/Storage security-rules file or trusted backend implementation for role assignment, audit, document access, backups or notifications is present in the repository.
5. Client-side role checks are not a security boundary. Database rules and trusted server authorization must enforce every read and write.

## Immediate code hardening
- Remove embedded/default staff passwords and browser-side staff-account seeding.
- Require a pre-provisioned staff profile before staff access.
- Remove finance's hard-coded and offline sign-in bypass.
- Keep every new client portal registration pending; public sign-up no longer auto-links client or case data.

## Production blockers
- Obtain and review active Firebase Firestore and Storage rules from the Firebase project.
- Enforce staff roles using Firebase custom claims or a trusted role service; prevent users editing their own role/profile.
- Verify clients can read only their own approved profile, cases, documents, appointments, invoices and receipts.
- Enforce least-privilege staff roles and restrict trust/finance records to authorised finance staff.
- Move privileged writes, audit logging, notifications, publishing and account linking to a trusted backend.
- Use private document storage and authenticated, short-lived download links; never publish client files through public buckets.
- Establish backups, retention, restore tests, audit-log integrity and incident procedures.
- Configure email/SMS providers through secrets and avoid confidential details in notification payloads.
- Complete legal-practice data-protection review, retention schedule and privacy notices.

## Editorial controls
- Case studies stay unpublished until an advocate approves facts, anonymisation and client consent/waiver where required.
- New legal articles remain drafts until an advocate reviews legal accuracy, currency, jurisdiction and publication date.
- Lawyer profiles, qualifications, outcomes, awards, testimonials, addresses and service claims require firm verification.

## Acceptance tests
- Unauthenticated users cannot read private records or upload/download client documents.
- Client A cannot read Client B's records by changing IDs, filters, URLs or payloads.
- Sign-up always creates a pending request; only authorised staff can approve and link it.
- Clerks cannot access restricted finance, staff administration or privileged document operations.
- Finance users cannot change case permissions or publish content unless explicitly authorised.
- Every privileged change creates an attributable audit event.
- Document upload, retrieval, deletion, retention and backup restoration are tested.
- Consultation intake is validated, rate-limited, privately stored and safely notified.
- Mobile, desktop, keyboard, screen-reader, performance and security tests pass on production-equivalent staging.

## Deployment policy
The public website can be deployed independently. Do not expose new private workflows or claim confidential-data security is complete until the blockers and tests pass. Search Console and Google Business Profile require the firm's authorised account owner and verified business details.
