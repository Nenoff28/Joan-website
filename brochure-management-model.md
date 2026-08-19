# Managed Brochure Workflow

The operations console will hold each brochure as a versioned record. A record stores a title, the optional source-PDF storage reference, rendered page-image references, the page count, lifecycle flags, and timestamps. Page images—not PDF bytes—remain the direct source for the public slideshow, which keeps the homepage fast and preserves one-page-per-slide navigation.

| Lifecycle state | Administrator behavior | Public homepage behavior |
|---|---|---|
| Active | Newly uploaded brochure may be activated immediately, or an existing version may be made active later. | The active record provides the slideshow title and ordered page images. |
| Inactive | Previous versions remain available for inspection and future activation. | Never shown on the homepage. |
| Archived | Version is retained in the audit trail but cannot be activated without restoring it. | Never shown on the homepage. |

The browser renders selected PDF pages into compressed JPEG images before upload. This avoids relying on operating-system PDF utilities in the deployed application runtime. Administrator procedures accept PDFs up to 20 MB and up to 16 rendered JPEG pages, apply type and per-page-size limits, write page assets to storage, and record each material action in the audit log. The legacy source PDF is stored where request size permits; otherwise its rendered pages remain the managed public artifact. When no database record is available, the existing brochure remains the public fallback.
