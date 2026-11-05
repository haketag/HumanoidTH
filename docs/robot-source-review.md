# Robot source review — 2026-11-01

## Follow-up: research PDFs and missing images

The initial review below is a historical snapshot. A second search added **7 more images**, bringing coverage to **16 of 17 robots**. Kaitomm remains without a downloaded, visually confirmed source image: both manufacturer hostnames timed out. This does not mean no image exists.

- **Exoskeleton Wheelchair:** original journal paper downloaded and read from the publisher: *Transformable Wheelchair–Exoskeleton Hybrid Robot for Assisting Human Locomotion*, Ronnapee Chaichaowarat, Sarunpat Prakthong and Siri Thitipankul, *Robotics* 2023, 12(1), 16, DOI [10.3390/robotics12010016](https://doi.org/10.3390/robotics12010016). Figure 3 supplies the unchanged 2023 alpha-prototype image. The PDF confirms CC BY 4.0. Added one research contribution with `NEEDS_REVIEW`, linked at project-family level, without claiming equivalence to later revisions or clinical certification.
- **Dinsaw Mini Home AI:** manufacturer product page supplies explicitly labelled Home AI artwork, distinct from IPD and Pro4.
- **Pinto and Mirror:** extracted the embedded images from [the official Department of Older Persons report](https://www.dop.go.th/download/statistics/th1635826412-975_0.pdf#page=109), printed p.107 / PDF page 109, sections 4.7.2 and 4.7.3. PDF image and text coordinates were checked to establish the correct pairing. These are university images reproduced in an official report, not journal research figures. Desktop Ninja in the same PDF is a different configuration and was not silently substituted.
- **SR1:** original project-operator MQDC handover photograph, dated March 2022; manufacturer downloads still unavailable.
- **Mr.SAM:** original Faculty of Medicine report and launch photograph from January 2024. This supersedes the previous secondary-only limitation and its conflicting rollout timing.
- **Ninja:** canonical university article `/en/news/33484/` became readable. Its exact university-CDN photograph shows the project's two telemedicine configurations; caption preserves this distinction. No need to bypass the stage site's TLS failure.

Follow-up snapshots, applied receipts, source pages, image hashes and downloaded PDFs are in `output/robot-source-audit/followup/`. The original snapshots were preserved. Existing robot IDs and favorites were retained. Copyright permission remains unconfirmed for images other than the checked CC BY research figure.

## Initial review (before the follow-up)

Reviewed all 17 existing robot records. Added 9 original-publisher images, preserved as downloaded, and linked publisher credits on the registry, detail and favorites screens. No robot IDs, favorites, source records or research relationships were deleted. `lastVerifiedAt` was deliberately not advanced: checking a source is not independent verification of every model specification.

## Evidence boundaries

- Primary-source checks: AI Police, CUREs rehabilitation robots, CORGI, Dinsaw family, Kaitomm, Khun Sean, NAO6, radioactive-iodine project, Robo-Buddy and SR1 (10 records). These are university, manufacturer or project-partner reports, not independent validation.
- Partial checks: Bumi, Dinsaw Mini Home, Exoskeleton Wheelchair, Mirror, Mr SAM, Ninja and Pinto (7 records). Notes in each record explain unreadable content, TLS failure, secondary-only evidence or unspecified hardware. Do not interpret these as fully verified deployments.
- Bumi image is a manufacturer product banner; it does not verify a Bangkok event. NAO image is specifically NAO6. Dinsaw image shows several generations. CUREs is a rehabilitation project family, not one humanoid model. CORGI image is a group launch photograph with CORGI at the right. The radioactive-iodine image is a hospital project launch photograph.
- No journal article with a confirmed bibliographic identity was established for the existing linked research. The existing Dinsaw `Thai HRI research seed` is a placeholder without a usable original URL and remains excluded from the detail page's research citations. No paper, DOI, author list or research link was invented. Withdrawn arXiv:0807.3223 was not added.
- Original source claims do not establish clinical certification, task suitability or independent performance. Capability matching continues to abstain without structured evidence.
- Kaitomm and SR1 original image downloads timed out. Six other records lack an exact-model primary image confirmed in this pass. Reviewed records cannot borrow thumbnails through fuzzy article-title matching.
- Image ownership remains with the original publishers. Public availability does not establish a reuse license; permission remains unverified.

## Files and recovery

- `output/robot-source-audit/robots-before.json`: pre-update snapshot of all 17 robot rows and linked contributions. This is not a full-database backup.
- `data/robot-source-review.json`: sources, proposed factual corrections and individual limitations.
- `output/robot-source-audit/source-pages-reviewed.json`: fetched text, image candidates and retrieval failures.
- `output/robot-source-audit/downloaded-images.json`: download results and SHA-256 fingerprints.
- `output/robot-source-audit/applied-review.json`: exact applied changes, timestamp and image provenance.
- `public/images/robots/sourced/`: 9 unchanged image files used by the application.

The apply script locks robot rows and rejects changes if their count or modification timestamps differ from the backup. It runs in one database transaction and rejects repeat application after a receipt exists. Previous import notes are retained in `sourceMeta.importNotes`. Original registry URLs and manufacturer history are preserved; the reviewed source is stored separately in `sourceMeta.sourceReview`.

## Selected original sources

- [AWS / Security Pitch — AI Police](https://aws.amazon.com/th/blogs/thailand/aws-thai-ai-police-cyborg/)
- [Chulalongkorn — CUREs](https://sustainability.chula.ac.th/report/2683/)
- [CT Asia — Dinsaw family](https://www.ctasia.com/about-us/)
- [Chulalongkorn — Khun Sean](https://sustainability.chula.ac.th/report/3801/)
- [Chulalongkorn — Robo-Buddy](https://sustainability.chula.ac.th/report/3802/)
- [Maxtronics — NAO6](https://maxtronics.com/en/nao6/)
- [Obodroid — Kaitomm](https://www.obodroid.com/product/personal-assistant/)
- [Obodroid — SR1](https://www.obodroid.com/product/security/)

Full source links and per-record notes, including the True Digital project announcements, are in the review JSON.

## Validation

- TypeScript check passed; all 10 tests passed, including reviewed-image fallback and credit URL checks.
- Next.js production build passed using the existing generated Prisma client. Full `npm run build` could not regenerate Prisma because another running process held `query_engine-windows.dll.node` (EPERM); no schema change was made.
- `npm run lint` stops at the existing interactive ESLint configuration prompt; no completed lint result is claimed.
- Real-browser check: registry shows 17 records, 9 successfully decoded local images, 9 publisher credits and 8 missing-image placeholders. Sample detail and favorites API responses returned HTTP 200 and the same sourced image/credit. Screenshot: `output/robot-source-audit/registry-reviewed.png`.
