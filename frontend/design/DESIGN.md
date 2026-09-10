# Design Guidelines — Neobrutalism

## Visual Style
- **Aesthetic**: Playful, handcrafted brutalism — warm cream backgrounds, bold black borders, pastel accent colors, rounded corners, scattered decorative elements (stars, blobs, sparkles)
- **Mood**: Friendly, energetic, approachable — brutalist structure with a joyful, indie personality. Feels like a zine made digital
- **Inspiration**: parastoo.ui, Neo Brutalism UI component library, Gumroad, indie SaaS

## Color Palette
- **Background**: `#FAFADF` — warm cream, not white and not bright yellow
- **Surface / Card**: `#FFFFFF` — white cards on cream background
- **Border + Shadow**: `#111111` — all borders and hard shadows use this
- **Primary / CTA**: `#E8635A` — coral, buttons and primary actions
- **Secondary**: `#7B6CF6` — purple, secondary buttons and icon backgrounds
- **Teal**: `#4ECDC4` — mint, accent buttons and decoration
- **Yellow**: `#FFE566` — tags, badges, decorative stars
- **Pink**: `#F9A8B8` — soft accent, CTA blocks, testimonial borders
- **Lavender**: `#C4B5FD` — CTA section backgrounds, secondary borders
- **Text Primary**: `#111111`
- **Text Secondary**: `#555555` — body copy inside cards

## Typography
- **Primary Font**: DM Sans (preferred) — friendly geometric sans-serif. Alternatives: Space Grotesk, Nunito
- **Headings**: Weight 700–800, `clamp(2.5rem, 6vw, 5rem)` for h1, `line-height: 1.1`, `letter-spacing: -0.01em`. **Default to lowercase** — "services i provide" not "SERVICES I PROVIDE"
- **Body**: Regular 400, `0.95rem`, `line-height: 1.65`, color `#555555`
- **Labels / Nav**: Medium 500–600, `0.9rem`, normal case (not uppercase)
- **Annotations**: Handwritten-style (Caveat or similar) used sparingly for callouts

## Spacing & Layout
- **Overall feel**: Airy — generous padding, elements breathe
- **Section padding**: `60–80px` vertical, `24–40px` horizontal
- **Card padding**: `24px`
- **Grid**: 2-column card layout (services, projects), max-width `960–1100px`, centered
- **Decorative layer**: Stars, blob splashes, sparkle icons positioned `absolute` around sections — adds handcrafted energy without affecting the layout grid
- **Mobile**: Single column stack, responsive

## Borders & Radius
- **Border radius**: `10–12px` on cards and containers — rounded, not sharp. `999px` pill on badges and CTA buttons. `50%` on icon circles. **Never `0px`**
- **Borders**: `2px solid #111111` on cards, buttons, inputs, nav — consistent and always visible

## Shadows & Elevation
- **Hard offset shadow**: `box-shadow: 4px 4px 0px 0px #111111` — zero blur, zero spread. This is the signature rule
- **Small variant**: `3px 3px 0px 0px #111111` — for badges, tags, small elements
- **Large variant**: `6px 6px 0px 0px #111111` — for CTA blocks and high-prominence elements
- **Shadows are selective** — prominent cards get a shadow, flat supporting cards use border only. Not everything gets a shadow
- **Colored shadow variant**: Occasionally shadow uses an accent color (e.g. focus state uses `4px 4px 0px 0px #E8635A`)
- **No soft or blurred shadows anywhere**

## Buttons
- **Primary**: Coral `#E8635A` bg, white text, `font-weight: 700`, `border-radius: 10px`, `2px solid #111`, `4px 4px 0 #111` shadow
- **Ghost**: Transparent bg, black border and shadow — fills with `#FAFADF` on hover
- **Pill CTA**: `border-radius: 999px`, coral or pink bg, black border and shadow — used for solo prominent CTAs
- **Hover**: `transform: translate(2px, 2px)` + shadow shrinks to `2px 2px 0 #111`
- **Active / press**: `transform: translate(4px, 4px)` + shadow collapses to `none` — feels like a physical button press

## Icons
- Line icons inside colored circular containers: `border: 2px solid #111`, `box-shadow: 3px 3px 0 #111`, pastel fill
- Icon size: ~20–24px inside a 48px circular container (`border-radius: 50%`)
- Style: Lucide or similar clean line icons, stroke ~1.5–2px
- Decorative: 4-point star SVG, wavy lines, blob shapes — scattered as non-functional decoration

## Components Spotted
- **Navbar**: White bg, `2px solid #111` border on all sides, `4px 4px 0 #111` shadow, `10px` radius, logo + icon left, nav links center, CTA right. Floats sticky with `top: 16px`
- **Service / Feature Cards**: White, `2px solid #111` border, **no shadow** (flat), `10px` radius, `24px` padding, circular icon top-left, bold lowercase title, muted body text
- **Project Cards**: White, `2px solid #111`, `4px 4px 0 #111` shadow, `10px` radius, image fills top, title + tag labels below
- **Testimonials**: Slightly rotated (`rotate(-2deg)` / `rotate(1.5deg)`), browser-chrome dots (`● ● ●`) at top, colored border (lavender or pink), `4px 4px 0 #111` shadow, stacked/collage layout
- **Tags / Badges**: Outlined pill (`border-radius: 999px`, `2px solid #111`, white bg) or filled with accent color, `font-weight: 600`
- **Inputs**: White, `2px solid #111`, `6px` radius, `3px 3px 0 #111` shadow — focus shifts border and shadow to accent color with `translate(-1px, -1px)` nudge
- **CTA Section Block**: Full-width, lavender or pink bg, `2px solid #111`, `14px` radius, `6px 6px 0 #111` shadow, centered text + pill button

## Imagery & Illustration
- Product screenshots in hard-bordered frames (`2px solid #111`, `10px` radius) — no soft device mockups
- Sketch/wireframe-style placeholder images with construction corner marks
- **Scattered SVG decoratives** (core to the style): 4-point star badges in yellow/pink/purple/green, pink and green blob splashes, sparkle icons — positioned absolutely around sections
- Hand-drawn annotation arrows + handwriting-font callouts ("it's me, hi!") for personality

## Overall Replication Notes
Key things an AI coding tool must know to nail this style:

- **Rounded corners are required** — `10–12px` on cards. `border-radius: 0` is wrong for this style
- **The shadow rule**: `box-shadow: 4px 4px 0px 0px #111111` — zero blur, always. Single most important rule
- **Press-down on every interactive element**: `translate(2px,2px)` + shadow shrink on hover; `translate(4px,4px)` + shadow none on click
- **Background is warm cream `#FAFADF`** — not pure white, not bright yellow
- **Headings are lowercase by default** — casual and handcrafted, not aggressive
- **All accent colors coexist** — coral, purple, mint, yellow, pink can all appear in one design; define all 5 as CSS tokens even if not all prominent
- **Scatter decorative elements** — 3–6 absolute-positioned stars/blobs per section; this is what makes it feel alive and handcrafted, not just "cards with borders"
- **Shadows are selective** — not every card gets one; flat cards (border only) are intentional and mix with shadowed cards
- **Fonts feel friendly** — DM Sans, Space Grotesk, Nunito. Not condensed, not ultra-heavy display
