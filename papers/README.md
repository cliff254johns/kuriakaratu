# Conference papers catalogue

The public library is rendered from `catalog.json` and is intentionally empty until the firm or a contributing publisher supplies an approved paper. Do not create sample or placeholder research records that could be mistaken for published work.

## Publish a paper

1. Obtain the final PDF and written confirmation that the submitter/publisher may distribute it publicly.
2. Confirm exact title, author names, affiliations, publisher organisation, conference name, date and location.
3. Record the abstract, keywords, publication date/year, DOI or permanent source, review status and licence.
4. Check that the PDF is accessible, readable, text-searchable where possible, and does not contain confidential or personal information that should not be public.
5. Upload the authorised PDF to this directory under `files/<descriptive-slug>.pdf`. Keep the filename stable after publication.
6. Add a record to `catalog.json` using the schema below.
7. Test search, organisation/year filters, download, share, citation copy and the PDF itself before release.
8. Add a permanent landing URL to the sitemap only if a separate detail page is created. The library page already appears in the sitemap.

## Record schema

```json
{
  "id": "unique-short-id",
  "title": "Exact approved paper title",
  "authors": ["Author Name"],
  "publisher": "Publishing organisation's full legal/public name",
  "conference": "Conference or proceedings title",
  "location": "City, Country",
  "year": 2026,
  "datePublished": "2026-11-20",
  "type": "Conference paper",
  "abstract": "Approved public abstract.",
  "keywords": ["topic one", "topic two"],
  "pdfUrl": "/papers/files/descriptive-slug.pdf",
  "doi": "10.xxxx/example",
  "peerReviewed": false,
  "reviewStatus": "Conference-reviewed",
  "license": "CC BY 4.0",
  "rightsConfirmed": true
}
```

Required fields for the public listing: `id`, `title`, `authors` (array), `publisher`, and `abstract`. PDF files hosted on this site should use a same-origin path under `/papers/files/` so the Download PDF control can download them directly. External PDF URLs are displayed as View PDF links instead.

## Editorial and legal safeguards

- The publisher must be accurately named; never imply the firm published or endorsed an external organisation's paper.
- Do not claim peer review unless the publisher confirms the process.
- Retain the licence/permission evidence with the editorial records.
- Respect copyright, embargoes, conference rules, author rights and third-party material permissions.
- Remove confidential, privileged, restricted and unnecessary personal data.
- Do not alter an author's research conclusions without written approval.
- Clearly distinguish an invited presentation, conference paper, working paper and peer-reviewed article.
- The library is a discovery and distribution channel, not an independent peer-review service.
