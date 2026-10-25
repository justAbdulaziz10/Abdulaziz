# Portfolio: Abdulaziz Alkhlaiwe — design and build spec

Build a formal personal portfolio website, deployed as a static site on GitHub Pages at
`https://justabdulaziz10.github.io/Abdulaziz/` (project page, so every URL must work under the `/Abdulaziz/` base path — use relative URLs everywhere).

The owner is a Saudi founder and CEO (Mara), app engineer and Information Systems student in Riyadh.
Audience: investors, partners, recruiters, and engineers. Primary job: in ten seconds, establish who he is and that he ships real products; then let people dig into the work.
The bar: it must look like a top studio built it — the kind of site that gets featured — and still read as formal and trustworthy.

## Inputs (read all before writing code)
- `content/content.json` — ALL copy. **The site is ENGLISH ONLY** (owner's explicit request): use only the `en` strings. The single exception is the owner's Arabic name `person.name.ar` (عبدالعزيز الخليوي), which appears in the hero beside the Latin name as a design element. Ignore every other `ar` field. Use copy verbatim. Never invent facts, numbers, testimonials, clients or quotes. Do not add copy that is not in this file except tiny UI strings already listed under `ui`.
- `content/contributions.json` — real GitHub contribution calendar `{total, days:[[date,count],...]}` (365 days).
- `assets/manifest.json` + `assets/**` — real images and logos gathered for this site (app icons, App Store screenshots, project screenshots, Riyadh/Diriyah photography, simple-icons SVGs, org logos). Each entry has source + license + credit. Pick the best ones; ignore weak or broken ones. Never use stock illustrations, AI images, emoji, or placeholder boxes.

## Design direction: "Najd at night"
Formal and cinematic. English site; the identity mark is the owner's name set in both scripts in the hero (Arabic in Alexandria 800 above, Latin in Alexandria 300 below).

### Color tokens (exact)
- `--paper: #F3F4F1` limestone, the light page base (cool off-white, NOT cream)
- `--ink: #0D1B2A` Najd night, text on paper and the dark plates
- `--ink-2: #4F5B67` secondary text on paper (passes AA on paper)
- `--palm: #0B6E4F` Saudi palm green, the ONLY accent: links, focus rings, active nav, the contribution scale. Use sparingly.
- `--clay: #B8946A` Turaif mud-brick, used ONLY for the Najdi crenellation divider and the timeline year ticks
- `--star: #EEF1F6` text on dark plates
Dark plates (hero, Mara showcase, off-the-clock) use `--ink` + real night photography. Everything else sits on `--paper`. Do not add gradients as decoration. Do not use #000/#111.

### Typography
- Display (both scripts): **Alexandria** variable (Google Fonts, OFL; has Arabic + Latin). Self-host woff2 subsets (arabic + latin) — get them from the `@fontsource-variable/alexandria` npm package (`npm pack`, extract the woff2 files you need into `/fonts`). No runtime Google Fonts requests.
- Text (both scripts): **IBM Plex Sans Arabic** (OFL; contains Latin). Weights 400, 500, 600. Self-host from `@fontsource/ibm-plex-sans-arabic`.
- Scale (Elements of Typographic Style, ratio ~1.333 with display jumps): 14 / 16 / 18 (body) / 24 / 32 / 42 / 56 / 75 / and the hero name with `clamp(3.5rem, 11vw, 10.5rem)`.
- Body 18px, line-height 1.6 (Latin) / 1.8 (Arabic); measure max 68ch.
- Arabic headings: Alexandria 700–800; Latin headings: Alexandria 300–500 with tight tracking (-0.02em at display sizes). The weight contrast between the Arabic and Latin name in the hero is deliberate.
- Do NOT: accent a single word in a headline with italic/colour; ALL-CAPS tracked eyebrow labels; monospace data labels; `A · B · C` meta strings; `→` appended to link text; em-dash label patterns.
- Numbers: `font-variant-numeric: tabular-nums` in the record and path sections.

### The one ornamental device: Najdi crenellation
At-Turaif's mud-brick parapets end in rows of small stepped triangles. Use this as the single recurring ornament: an inline SVG pattern (repeat-x) that forms the bottom edge where a dark plate meets the paper (the plate "ends" in a row of triangles, color `--ink` on top of `--paper`, with a hairline of `--clay`). Also a tiny 3-triangle mark used as the list bullet for the timeline. Nothing else decorative.

### Layout
12-column grid, max width 1320px, generous margins (clamp(20px, 5vw, 72px)). Left-aligned. No centered body text except the contact headline.

```
HERO (dark plate, 100svh)
┌───────────────────────────────────────────────────────────────────────┐
│ AA                                About Mara Work Path Contact       │ ← nav, transparent over photo
│                                                                       │
│                                                                       │
│ عبدالعزيز الخليوي                                    (Alexandria 800) │
│ Abdulaziz Alkhlaiwe                                  (Alexandria 300) │
│                                                                       │
│ Founder & CEO of Mara.                            Riyadh 19:04  (live)│
│ I build Arabic-first apps from Riyadh, and the systems that ship them.│
└▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲┘ crenellation
   background: best Riyadh night photo (KAFD / Kingdom Centre), ink overlay
   so text passes AA; subtle slow parallax on scroll (disabled for reduced motion)

ABOUT (paper)
  [NO portrait photo (none available — the avatars are copyrighted comic art; never use assets/img/portrait/*). Instead the AA monogram set very large in Alexandria as a typographic plate, with the Najdi crenellation]
  heading + 3 paragraphs (cols 5–11)  |  facts as a <dl> (cols 1–4)

MARA (dark plate) — the showcase, the most impressive section
  intro row: Mara wordmark/logo (from assets) + intro paragraph + link
  then each app as a full-width "scene": real App Store screenshots inside a
  CSS-drawn iPhone frame (rounded rect, dynamic island), app icon, name,
  kind, status, body, stack, link. On desktop (≥1024px) the four app scenes
  are a pinned horizontal scroll (GSAP ScrollTrigger); each phone tilts
  slightly in 3D as it enters (rotateY 12deg → 0). On mobile: vertical stack.
  For apps without screenshots (Mara, Aghoo) use their icon at large size on
  a framed tile with the iammara.com imagery; never fake screenshots.
  Below: open-source tools as an index list (name | one line | link), two
  columns on desktop. Not cards.

WORK (paper) — selected work as an editorial index
  Rows, not identical cards: year | name (Alexandria 42) | kind | links.
  The first two (Rassah, Pit Lane Hub) are "feature rows" with a large real
  screenshot (desktop shot in a minimal browser frame + the mobile shot
  overlapping it). Hovering/focusing a plain row reveals its body text
  (expand, answering the user's action). Keyboard accessible (button +
  aria-expanded) and the text is in the DOM for no-JS/SEO.

RECORD (paper)
  The real contribution calendar from contributions.json, drawn as a large
  53×7 grid of squares in SVG (5-step scale from paper → palm). This is the
  section's image. One reveal: the squares light up in date order once when
  the grid first enters the viewport (≤1.6s total). Tooltip/aria per day is
  not needed; give the SVG a <title> with the summary sentence.
  Body sentence + 3 stats set inline as a sentence-like row (value in
  Alexandria 56, label beside it) — not three boxed tiles.

PATH (paper) — vertical timeline (this IS a sequence, dates as markers)
  date (tabular) | crenellation mark | sentence. The line draws as you scroll.

LEARNING (paper)
  Two lists side by side: completed / in progress (with progress fraction
  and a thin palm progress bar, notes link where given). Link to roadmap.

STACK (paper)
  Grouped monochrome simple-icons SVG logos (ink, 60% opacity, 100% on
  hover/focus) with visible names. Quiet.

OFF THE CLOCK (dark plate, Riyadh/Diriyah photo at dusk)
  Three short lines from content. Restrained, cinematic. Use a Diriyah /
  At-Turaif photo if available.

CONTACT (paper)
  Big centered heading, sentence, mailto button (palm), then the links list.
  Footer: © year name, company legal name, photo credits link (opens a
  <dialog> listing every credited photo from manifest.json: credit, license,
  source link).
```

### Motion (GSAP 3 + ScrollTrigger + Lenis, vendored locally in `/vendor`, no CDN)
- ONE orchestrated page-load moment in the hero: the photo settles from scale 1.06 → 1 while the Arabic name rises line-by-line out of a mask (clip), then the Latin name follows 120ms later, then tagline and clock fade in. Total ≤ 1.4s. Nothing else animates on load.
- Scroll-linked: hero parallax, Mara pinned horizontal showcase, timeline line draw, contribution reveal (once).
- Do NOT add fade-and-slide-up on every section or hover lift on every card.
- `prefers-reduced-motion: reduce` → no Lenis, no pinning (vertical layout), no parallax, everything visible immediately.
- Lenis smooth scroll only on fine pointers; native scroll on touch.

### Language
- English only: one page, `/index.html`, `lang="en" dir="ltr"`. No language switch, no `/ar/` page. Mark the Arabic hero name with `lang="ar" dir="rtl"` on its element.
- The Riyadh clock uses `Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Riyadh', hour:'2-digit', minute:'2-digit'})`.

### Mobile is a first-class target (owner's explicit request)
The phone experience must be as impressive as desktop, not a collapsed afterthought. Design mobile deliberately:
- Hero: the name still fills the width (Arabic and Latin each on their own line, fitted to the viewport), photo cropped with `object-position` chosen for portrait, `100svh`, clock below the tagline.
- Nav: compact bar with the monogram and a menu button opening a full-screen sheet (focus-trapped, Esc closes, scroll locked). Not a cramped row of links.
- Mara showcase on mobile: horizontal swipeable scene carousel with CSS scroll-snap (one app per screen, phones large, peek of the next scene, dot/position indicator), instead of the desktop pinned scroll.
- Work feature rows: screenshot first, full-bleed, then text. Tap targets ≥ 44px. Body text 17px min.
- Contribution grid: horizontally scrollable on narrow screens with the most recent weeks visible first (scrollLeft to end), or rendered as a 7-wide × 53-tall vertical grid — pick the one that looks better and is readable.
- Test at 360, 390, 430 widths: no overflow, nothing clipped, no text smaller than 14px.
## Tech constraints
- Pure static output. No framework. A tiny Node build script `scripts/build.mjs` (no dependencies beyond Node 20+ built-ins) reads `content/content.json` + `src/template.html` and writes `index.html`. Commit the generated files (GitHub Pages serves the repo root from `main`). `npm run build` runs it. Add `.nojekyll`.
- Source: `src/template.html`, `css/site.css` (one file, CSS custom properties, logical properties, container queries where helpful), `js/site.js` (ES module, progressive enhancement — the page must be fully readable with JS off), `vendor/` (gsap.min.js, ScrollTrigger.min.js, lenis.min.js — get them with `npm pack gsap lenis` and copy the dist files; GSAP is free for this use under its standard license — include its license file in vendor/).
- Images: use the `.webp` versions with width/height attributes, `loading="lazy"` + `decoding="async"` below the fold, `fetchpriority="high"` on the hero image, and `<picture>` with a jpg/png fallback. Generate a 1200×630 Open Graph image (`assets/og.png`) — render it from an HTML page with Playwright if available (name in both scripts on the hero photo), otherwise compose with ffmpeg.
- SEO/meta: title, description (from tagline), canonical, OG/Twitter tags, JSON-LD `Person` (name, alternateName (Arabic), jobTitle, worksFor Organization Mara url, sameAs links, alumniOf/affiliation King Saud University), favicon (SVG monogram) + apple-touch-icon.
- Accessibility: semantic landmarks, one h1, skip link, visible focus (2px palm outline, offset 3px), AA contrast on every text/background pair (check text over photos), alt text for every meaningful image (decorative ones `alt=""`), keyboard-operable everything, `<dialog>` for credits.
- Performance: Lighthouse (mobile) Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO 100. Hero LCP image ≤ 250 KB webp at 2400w with a 1200w srcset entry. Total JS (excluding vendor) small.
- Responsive: 360px, 390px, 430px, 768px, 1024px, 1440px, 1920px. No horizontal overflow at any width.
- Add `README.md` (short: what the site is, how to build, how to deploy) and keep `assets/manifest.json` (credits).

## Verification you must do before reporting done
1. `npm run build` succeeds; `index.html` is regenerated.
2. Serve the repo root under a `/Abdulaziz/` base locally (e.g. a tiny Node static server mounting the repo at `/Abdulaziz/`) and use Playwright to screenshot at 360×780, 390×844, 768×1024 and 1440×900 (full page, plus a viewport-only hero shot for each) into `/Users/abdulaziz/Desktop/MyProtofolio/_work/shots/` — and LOOK at them; fix anything broken, overlapping, unreadable, or empty.
3. Check: no console errors, no 404s for any asset (log failed requests), no horizontal scroll at 360px, reduced-motion mode renders everything.
4. Run Lighthouse (`npx lighthouse` with chrome headless) on the served page (mobile) and report the four scores; fix issues until the targets are met.
5. Report: files created, screenshots paths, Lighthouse scores, any content/asset you could not place.

## Asset decisions already made by the lead (follow these)
- All large rasters are WebP only (originals were removed from the repo to keep it small). WebP is universally supported: plain `<img>` with `srcset` is fine; no jpg fallback needed. Generate smaller responsive variants (e.g. 1200w, 800w) with `cwebp -resize` where useful and commit them.
- Hero photo: `assets/img/places/riyadh-skyline-dusk-01.webp` (purple dusk skyline, Kingdom Centre + Al Faisaliah). Text goes in the sky area (upper-left on desktop); overlay a vertical ink scrim so white text passes AA.
- Mara plate background: `assets/img/places/riyadh-kafd-night-03.webp` (KAFD at night), darkened heavily so screenshots read on top.
- Off-the-clock plate: `assets/img/places/riyadh-kingdom-tower-moody-05.webp` (black and white Kingdom Centre) — cinematic.
- About section accent / or path section: `assets/img/places/diriyah-at-turaif-01.webp` (At-Turaif mud-brick, daylight) — e.g. a tall cropped image beside the timeline, tying in the crenellation motif.
- Photo credits (CC BY / CC BY-SA from Wikimedia Commons) MUST be shown in the credits dialog exactly as recorded in manifest.json.
- Mara/Echo/DocMara/Aghoo icons and imagery: `assets/img/apps/*` (App Store) and `assets/img/mara/*` (from iammara.com: mara-app-icon, mara-logo, mara-home-en-light, mara-chat-en-light, mara-hero-hands, aghoo-app-icon-256, docmara-platform-*). For Mara, the real in-app screens `mara-home-en-light.webp` and `mara-chat-en-light.webp` exist — use them in the phone frame.
- Do NOT use org logos (Harvard/MIT/Stanford/Meta etc.) — trademark use is unnecessary; set course providers as text. Tech logos (simple-icons, CC0) are fine.
- No portrait exists. Never use anything from a portrait folder.
