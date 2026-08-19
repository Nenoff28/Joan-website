# Brochure UI Verification Notes

The authenticated owner account successfully loaded `/admin/brochures` and received both `auth.me` and `admin.brochures` responses with HTTP 200. The administrator workspace displayed the active brochure, two-version history, PDF controls, and the 20 MB limit.

The supplied `Broshura-list.pdf` was selected through the real file control after MIME validation was corrected to accept `.pdf` filenames. The initial large combined request exposed browser MIME-label and request-size constraints. The workflow was revised to render the PDF in-browser, upload its JPEG pages sequentially, and then submit a small activation record containing the stored page URLs.

The owner completed the real UI upload after confirming the operation. The management workspace displayed a third version, marked it active with eight pages, and the public homepage immediately showed the new active title and eight-page slideshow. The prior versions remain inactive in the version history.
