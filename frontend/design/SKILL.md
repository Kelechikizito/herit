---
name: neobrutalism-design
description: Design and build websites and web apps using the Neobrutalism (Neubrutalism) UI style — thick borders, hard offset shadows, bold typography, raw geometric shapes, and unapologetic color. Use this skill whenever the user asks to design, build, create, style, or redesign anything in a Neobrutalism or Neubrutalism style, even if phrased casually like "make it look brutalist", "give it that bold raw look", "neobrutalist design", "thick border shadow style", "brutalist website", or "I want a Neobrutalism website/app/component/dashboard". Also trigger when the user says things like "raw and bold UI", "anti-design aesthetic", or "Figma-style hard shadow." Always use this skill before writing any Neobrutalism-related code or design — do NOT attempt it from memory alone.
---

# Neobrutalism Design Skill

Grounded in real examples (Neo Brutalism UI component library + parastoo.ui portfolio). Neobrutalism is **not** stark black-on-yellow with 0px radius — it's warm cream backgrounds, rounded corners, pastel accents, friendly fonts, hard offset shadows, and scattered decorative energy.

---

## Step 1: Ask These Questions First

Present all at once. User can skip — defaults apply.

**1. Color Palette**
- 🍑 **Coral & Cream** *(default)* — `#FAFADF` bg, coral `#E8635A`, lavender `#C4B5FD`
- 💛 **Yellow & Black** — `#FFFDE7` bg, yellow `#FFE566`, coral/teal secondaries
- 🌊 **Teal & Cream** — cream bg, teal `#4ECDC4`, yellow accent
- 🌸 **Pink & Purple** — cream bg, pink `#F9A8B8`, purple `#7B6CF6`
- 🖤 **Dark Brut** — `#111111` bg, white borders, yellow/coral accent
- 🎨 **Custom** — provide hex values

**2. Border & Shadow Weight**
- **Light** — `2px` border, `3px 3px` shadow
- **Standard** *(default)* — `2px` border, `4px 4px` shadow
- **Heavy** — `3px` border, `6px 6px` shadow

**3. Typography**
- **Rounded Grotesque** *(default)* — DM Sans 700/800
- **Soft & Bubbly** — Nunito 700/800
- **Sharp Grotesque** — Plus Jakarta Sans or Syne 700/800

**4. Heading Case** — Lowercase *(default)* · Title Case · Uppercase

**5. Decorative Layer** — Scattered stars/blobs *(default)* · Minimal · None

**6. Animations** — Mechanical *(default)* · Playful · None

---

## Step 2: Defaults

| Decision | Default |
|---|---|
| Palette | Coral & Cream — `#FAFADF` bg, `#E8635A` primary, `#C4B5FD` secondary |
| Weight | Standard — 2px border, 4px shadow |
| Font | DM Sans 700/800 headings, 400/500 body |
| Heading case | Lowercase |
| Decorative | Scattered |
| Animations | Mechanical |

---

## Step 3: CSS Tokens

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap');

:root {
  --bg-page:    #FAFADF;
  --bg-surface: #FFFFFF;
  --bg-dark:    #111111;

  --color-primary:   #E8635A;
  --color-secondary: #7B6CF6;
  --color-teal:      #4ECDC4;
  --color-yellow:    #FFE566;
  --color-pink:      #F9A8B8;
  --color-lavender:  #C4B5FD;

  --border-color: #111111;
  --border-width: 2px;
  --border: var(--border-width) solid var(--border-color);

  --radius-sm:   6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-pill: 999px;

  --shadow-sm:       3px 3px 0px 0px var(--border-color);
  --shadow-md:       4px 4px 0px 0px var(--border-color);
  --shadow-lg:       6px 6px 0px 0px var(--border-color);
  --shadow-sm-hover: 1px 1px 0px 0px var(--border-color);
  --shadow-md-hover: 2px 2px 0px 0px var(--border-color);

  --font: 'DM Sans', sans-serif;

  --text-primary:   #111111;
  --text-secondary: #555555;
  --text-on-dark:   #FFFFFF;
  --text-on-accent: #FFFFFF;

  --space-xs: 8px;   --space-sm: 16px;  --space-md: 24px;
  --space-lg: 40px;  --space-xl: 64px;  --space-xxl: 96px;
}
```

**Shadow rule — never break:** `box-shadow: 4px 4px 0px 0px #111111` — zero blur always. On dark mode use `#FFFFFF`. Shadow is selective — not every card needs one; flat cards use border only.

---

## Step 4: Components

### Button (press-down required on every interactive button)
```css
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font); font-weight: 700; font-size: 0.95rem;
  padding: 12px 24px; background: var(--color-primary); color: var(--text-on-accent);
  border: var(--border); border-radius: var(--radius-md);
  box-shadow: var(--shadow-md); cursor: pointer;
  transform: translate(0,0); transition: transform 0.1s ease, box-shadow 0.1s ease;
  text-decoration: none; user-select: none;
}
.btn:hover  { transform: translate(2px,2px);  box-shadow: var(--shadow-md-hover); }
.btn:active { transform: translate(4px,4px);  box-shadow: none; }
.btn-ghost  { background: transparent; color: var(--text-primary); }
.btn-ghost:hover { background: var(--bg-page); }
.btn-pill   { border-radius: var(--radius-pill); padding: 14px 32px; }
```

### Card
```css
.card {
  background: var(--bg-surface); border: var(--border);
  border-radius: var(--radius-md); box-shadow: var(--shadow-md);
  padding: var(--space-md); transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.card:hover      { transform: translate(2px,2px); box-shadow: var(--shadow-md-hover); }
.card-flat       { box-shadow: none; }
.card-flat:hover { box-shadow: var(--shadow-sm); transform: translate(-2px,-2px); }
```

### Icon Box
```css
.icon-box {
  width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
  background: var(--color-teal); border: var(--border);
  border-radius: 50%; box-shadow: var(--shadow-sm); flex-shrink: 0;
}
```

### Input
```css
.input {
  width: 100%; background: var(--bg-surface); border: var(--border);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-sm);
  padding: 11px 16px; font-family: var(--font); font-size: 0.95rem;
  color: var(--text-primary); outline: none;
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
}
.input:focus {
  border-color: var(--color-primary);
  box-shadow: 4px 4px 0px 0px var(--color-primary);
  transform: translate(-1px,-1px);
}
```

### Navbar
```css
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-sm) var(--space-lg); background: var(--bg-surface);
  border: var(--border); border-radius: var(--radius-md);
  box-shadow: var(--shadow-md); position: sticky; top: 16px; z-index: 100;
}
.nav-link {
  color: var(--text-primary); font-family: var(--font); font-weight: 500;
  font-size: 0.9rem; text-decoration: none; padding: 6px 10px;
  border-radius: var(--radius-sm); border: 2px solid transparent;
  transition: border-color 0.15s;
}
.nav-link:hover { border-color: var(--border-color); }
```

### Tag / Badge
```css
.tag {
  display: inline-flex; align-items: center; padding: 4px 12px;
  background: var(--bg-surface); border: var(--border);
  border-radius: var(--radius-pill); font-family: var(--font);
  font-size: 0.8rem; font-weight: 600; box-shadow: var(--shadow-sm);
}
.tag-filled { background: var(--color-yellow); }
```

### CTA Block & Testimonial
```css
.cta-block {
  background: var(--color-lavender); border: var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  padding: var(--space-xl) var(--space-lg); text-align: center;
}
.testimonial {
  background: var(--bg-surface); border: 2px solid var(--color-lavender);
  border-radius: var(--radius-md); box-shadow: var(--shadow-md);
  padding: var(--space-md); transform: rotate(-2deg); transition: transform 0.2s ease;
}
.testimonial:nth-child(even) { transform: rotate(1.5deg); border-color: var(--color-pink); }
.testimonial:hover { transform: rotate(0deg) translate(-2px,-2px); box-shadow: var(--shadow-lg); }
.testimonial::before { content: '● ● ●'; display: block; font-size: 10px; color: #ccc; letter-spacing: 4px; margin-bottom: 12px; }
```

---

## Step 5: Typography

```css
h1 { font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.01em; }
h2 { font-size: clamp(1.75rem, 4vw, 2.75rem); font-weight: 700; line-height: 1.2; }
h3 { font-size: 1.2rem; font-weight: 700; }
p  { font-size: 0.95rem; font-weight: 400; line-height: 1.65; color: var(--text-secondary); }
h1, h2, h3, p { font-family: var(--font); color: var(--text-primary); }
```

Default to **lowercase headings** — "services i provide" feels handcrafted. Uppercase is aggressive; use only for small labels.

---

## Step 6: Decorative Layer

Scatter 3–6 elements per section as `position: absolute` inside `position: relative` containers. Vary size (20–100px) and add random rotations.

```html
<!-- 4-point star -->
<svg class="deco" width="32" height="32" viewBox="0 0 32 32">
  <path d="M16 2 L17.5 14.5 L30 16 L17.5 17.5 L16 30 L14.5 17.5 L2 16 L14.5 14.5 Z"
        fill="#FFE566" stroke="#111" stroke-width="1.5"/>
</svg>
<!-- Blob splash -->
<svg class="deco" viewBox="0 0 80 80" width="60" height="60">
  <path d="M40 5 C55 5,75 20,75 40 C75 60,60 75,40 75 C20 75,5 60,5 40 C5 20,25 5,40 5Z" fill="#F9A8B8"/>
</svg>
```
```css
.deco { position: absolute; pointer-events: none; }
@keyframes spin-slow { to { transform: rotate(360deg); } }
.deco.spin { animation: spin-slow 8s linear infinite; }
```
Swap `fill` to any accent color per instance. Place at corners, near headings, alongside content blocks.

---

## Step 7: Animations

```css
/* Scroll reveal */
.reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.35s ease, transform 0.35s ease; }
.reveal.visible { opacity: 1; transform: translateY(0); }

/* Staggered children */
.card-grid > *:nth-child(1) { transition-delay: 0ms; }
.card-grid > *:nth-child(2) { transition-delay: 70ms; }
.card-grid > *:nth-child(3) { transition-delay: 140ms; }
.card-grid > *:nth-child(4) { transition-delay: 210ms; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  .reveal { opacity: 1; transform: none; }
}
```
```javascript
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
```

---

## Step 8: Palette Reference

| Palette | BG | Primary | Secondary | Border | Text |
|---|---|---|---|---|---|
| 🍑 Coral & Cream | `#FAFADF` | `#E8635A` | `#C4B5FD` | `#111` | `#111` |
| 💛 Yellow & Black | `#FFFDE7` | `#FFE566` | `#E8635A` | `#111` | `#111` |
| 🌊 Teal & Cream | `#FAFADF` | `#4ECDC4` | `#FFE566` | `#111` | `#111` |
| 🌸 Pink & Purple | `#FAFADF` | `#F9A8B8` | `#7B6CF6` | `#111` | `#111` |
| 🖤 Dark Brut | `#111111` | `#FFE566` | `#E8635A` | `#FFF` | `#FFF` |

Always include all 5 accent color tokens — they appear in icon boxes, decorative elements, and badges.

---

## Step 9: Anti-Patterns

| ❌ Avoid | ✅ Instead |
|---|---|
| `border-radius: 0px` on cards | `10–12px` rounded |
| Blurred `box-shadow` with rgba | `4px 4px 0px 0px #111` zero blur |
| Bright yellow `#FFEB3B` page bg | Warm cream `#FAFADF` |
| Pure RGB primaries | Pastel-adjacent coral, lavender, mint |
| All-caps headings everywhere | Lowercase default |
| No decorative layer | Stars, blobs, sparkles in every section |
| Shadow on every card | Mix shadowed + flat — use selectively |
| Condensed/aggressive display fonts | DM Sans, Space Grotesk, Nunito |
| Backdrop blur / glassmorphism | Hard flat surfaces only |

---

## Quick Reference

```
Background:  #FAFADF warm cream (not white, not bright yellow)
Border:      2px solid #111111 on everything
Radius:      10–12px cards · 999px pill · 50% icon circles (NOT 0px)
Shadow:      4px 4px 0px 0px #111111 — zero blur always
Colors:      Coral · Lavender · Mint · Yellow · Pink (pastel-adjacent)
Headings:    Lowercase · DM Sans 700–800
Decor:       3–6 scattered stars/blobs per section, absolutely positioned
Hover:       translate(2px,2px) + shadow shrink
Click:       translate(4px,4px) + shadow none
```
