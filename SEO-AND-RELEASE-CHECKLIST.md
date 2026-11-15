# Website enhancement and release checklist

## Implemented on the feature branch
- 26 individual practice-area pages and a searchable practice-area directory.
- Consultation request page with contact preference, practice-area preselection, optional preferred date/time, a 500-character non-confidential summary, privacy acknowledgement and visitor-reviewed WhatsApp hand-off.
- Legal Knowledge Centre with six educational guides, searchable index and links to Kenya Law and the Office of the Data Protection Commissioner where relevant.
- Meru location page; no street address or map pin is invented.
- LegalService structured data, XML sitemap and robots.txt.
- Baseline response headers: nosniff, strict-origin referrer policy, same-origin framing, restrictive Permissions-Policy and HSTS.
- Homepage image decoding, eager brand-logo loading, external-host preconnects, service-page deep links, keyboard-accessible mobile menu and skip link.

## Firm approval and Google visibility actions
- Advocates must review and approve each legal guide and practice description against current law and the firm's actual scope before promotion.
- Confirm the exact public office address, map pin, opening hours and service area; then ensure the same name, address and phone are used consistently on the Google Business Profile and reputable directories.
- Claim/verify the firm's Google Business Profile. Select the most accurate primary category, add only relevant secondary categories, complete hours, website, phone, services and genuine office photographs.
- Add authentic office and advocate photographs with appropriate permission. Do not publish confidential client material or use stock images as if they depict the firm.
- Verify the preferred canonical hostname (www vs non-www), confirm redirects, add the property in Google Search Console, submit /sitemap.xml and inspect the new page URLs.
- Connect GA4 or another privacy-compliant analytics platform only after the firm approves the provider and corresponding privacy/cookie disclosures.
- Earn genuine local citations and professional/legal directory references; do not buy links, keyword-stuff the business name or solicit gated reviews.

## Testing still required in a real browser
- Verify each of the 26 service URLs and six article URLs return HTTP 200 on the public domain.
- Test all practice-card links, consultation form validation, WhatsApp hand-off on Android/iOS/desktop, and telephone/email links.
- Check mobile navigation, keyboard-only operation, screen-reader labels, focus order, contrast, zoom and reduced-motion behavior.
- Run Lighthouse on mobile and desktop and record LCP, CLS, INP, accessibility, best-practices and SEO scores.
- Verify response headers and HTTPS, test broken links and ensure sitemap URLs match the chosen canonical hostname.

## Known limits
- The form opens a prefilled WhatsApp draft for the visitor to review and send. It does not store leads, send email automatically, issue a reference number or connect to a CRM. Those features need an authenticated backend endpoint and approved data-retention/security design.
- Legal articles are general educational content and require advocate review before being represented as firm-approved guidance.
- Google Business Profile claim/verification and Search Console submission require the firm's owner/admin account; website code cannot perform those account-ownership steps.
- A strict Content-Security-Policy is not yet set because the existing homepage relies on inline scripts/styles and third-party fonts, icons, images and YouTube embeds. Add CSP only after inventorying and testing every dependency, preferably by migrating inline code to local assets and using nonces/hashes.
