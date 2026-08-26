# Supplied manufacturer-logo archive — 2026-08-26

The user supplied `logos.zip` with 39 logo variants in 31 brand-named folders. The archive passed integrity testing and was extracted only into `/home/ubuntu/webdev-static-assets/user-supplied-logos-2026-08-26/` for assessment. After visual review, the user explicitly approved publication of every supplied brand asset; selected variants were uploaded and connected only to their matching manufacturer metadata records.

## Visual inventory

| Candidate folder | Variant count | Visual assessment | Preliminary handling |
| --- | ---: | --- | --- |
| AllRide, Bondit, BSafe, Casa Bella, Cascada, Ceramica Fiore, Decorex, Dil, Effect, Elematic, KAI, Kittfort, Knipex, Kronostar, Kronotex, Moller, Motip, Payper, Pyramis, TERMOMAX, Triano, Varta, Vents, Vidima | 1–2 | A recognisable matching wordmark appears in the supplied raster/SVG variant. | Published after explicit owner approval; each record retains a user-supplied source reference. |
| Bertani, Domko, Elite, Kraft, Orient, Premium | 1–2 | A visible logo candidate exists, although the active catalogue record was previously retailer/generic/ambiguous or the supplied mark has a different known product domain. | Published after explicit owner approval; no catalogue or legacy fields were changed. |
| Dupli-Color | 2 | One standard Dupli-Color wordmark and one multicolour alternative are present. | The standard black wordmark was selected and published. |
| Pyramis | 2 | A full black-and-red wordmark and a cropped red icon alternative are present. | The full `LOGO PYRAMIS.png` wordmark was selected and published. |
| Varta | 2 | A large current blue/yellow wordmark and a compact alternative are present. | The large `Varta-logo-2021.svg.webp` variant was selected and published. |
| Vents | 2 | A large chrome-effect wordmark and a compact white-background version are present. | The more legible compact `vents_logo_jpg.webp` variant was selected and published. |
| Vidima | 2 | A standalone `logo.svg` and a blue-background raster mark are present. | The SVG was selected and published; the audit identifies Vidima’s official `/images/logo.svg` resource. |

## Provenance rule

The ZIP does not include external source URLs. The owner explicitly instructed publication of every supplied brand asset despite the previously documented first-party access limitations. Accordingly, each affected metadata record uses a `user-supplied://logos.zip#<brand>` source reference for traceability; this records the user-provided origin without asserting a newly retrieved official webpage source.

## Rendering check after owner approval

After the owner explicitly approved publishing every supplied asset, representative public product-detail checks confirmed that both the original `.UNK` MOTIP file and the Kronotex SVG resolve and display as manufacturer marks above their product titles. The existing `contain` presentation keeps these compact logo marks visible without changing product media or layout.

The subsequent product-detail contrast refinement was verified on a Ceresit product with a white manufacturer mark. The neutral panel and layered shadow keep the white letters visibly separated from the page background while preserving the original logo file unchanged.

Following user feedback, the contrast wrapper was restricted to the visually white-wordmark set: Ceresit, FAYANS, GRONE, Legrand, SPIRIT, Vormann and Zvezda. Public representative checks confirm that Legrand keeps the discreet contrast treatment while the colored Moment mark is rendered without a background panel.

Catalogue card review after initial logo sizing found that the Premium asset has substantial white canvas padding, making the actual mark appear smaller than its CSS slot. The main product gallery review also confirmed that the legacy grid background needs a stronger presentation override to ensure a clean image-only area.

The Premium asset was deterministically trimmed and its standard catalogue card slot was enlarged. A subsequent desktop visual check confirms that the Premium wordmark is now readable at catalogue-card scale, and that the primary product image area is plain white with the legacy grid removed.

The product-detail review for structured technical data identified a conservative parser edge case: short packaging or quantity values such as “Туба 5 кг” and “280 мл” can appear without a key/value colon. The presentation parser now labels these deterministic units without modifying source descriptions, while longer prose remains in the Description section.

Desktop and mobile checks confirm the desired presentation: descriptive prose remains in the Description area, while labelled pairs, concise bullet characteristics, quantities, packaging values and model fields render as alternating Technical data rows. A product whose copy is entirely a concise list of characteristics shows a full-width Technical data block rather than duplicating those lines as free text.

The About page video is now the leading page section. Desktop and mobile visual checks confirm that the former homepage presentation copy — the “Строителни материали” heading, Joan hypermarket kicker and supporting line — overlays the video with readable contrast before the company story starts.
