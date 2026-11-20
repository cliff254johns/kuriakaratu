# Publishing Insights

The public Insights page is available at:

- https://www.kuriakaratuadvocates.com/insights-library/

The page is intentionally empty until the firm approves its first articles. It reads `catalog.json`; no sample or fictional articles are displayed.

## Add an article

Add an object to the `insights` array in `catalog.json`:

```json
{
  "title": "Article title",
  "excerpt": "A concise summary for the listing card.",
  "category": "Legal Analysis",
  "author": "Author or contributor",
  "publishedAt": "2026-12-01",
  "url": "/insights-library/article-slug.html",
  "tags": ["Kenya", "Commercial"]
}
```

Each article URL should point to a published page in this repository or a trusted HTTPS destination. For an article hosted in this repository, add its HTML file under `insights-library/` and use a root-relative URL such as `/insights-library/article-slug.html`.

## Editorial checks before publishing

- Obtain the author's approval and confirm the firm has permission to publish the material.
- Check legal references, dates and links against current authoritative sources.
- Remove confidential, privileged or identifying client information unless publication is expressly authorised and lawful.
- Include an author, publication date and appropriate disclaimer on the article page.
- Do not describe an article as legal advice or claim peer review unless that is accurate and documented.
- Keep the JSON valid and ensure each article URL works before updating the catalogue.
