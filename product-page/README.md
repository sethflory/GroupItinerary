# Travel Concierge Product Page

Marketing landing page for Travel Concierge - Your Travel Concierge Powered by AI.

## Brand Mark

The **Golden Keys** are the visual identity of Travel Concierge - two crossed keys symbolizing:
- Access to exclusive experiences
- Unlocking seamless travel coordination
- The traditional concierge service elevated by AI

The keys appear throughout the product page as:
- Logo mark (crossed golden keys on emerald)
- Background patterns (subtle floating keys)
- Badge and icon elements

## Structure

```
product-page/
├── index.html              # Main landing page
├── css/
│   └── styles.css          # Emerald theme styles
├── images/
│   └── (placeholder)       # OG images, screenshots
├── staticwebapp.config.json # Azure SWA config
└── README.md
```

## Features Highlighted

- AI-first travel planning (paste, upload, describe)
- Shared itinerary with group filtering
- Smart groups (family, interest, logistics)
- Games & engagement (scavenger hunts, trivia, memes)
- Shot list for coordinated photos
- Social sharing

## Target Scenarios

1. **Family Vacations** - Multi-generational, kid-friendly
2. **Group Travel** - Friends trips, bachelor parties
3. **Conference Travel** - Team coordination at events
4. **College & Campus** - Study abroad, spring break
5. **Company Retreats** - Team building, offsites
6. **Destination Events** - Weddings, reunions

## Deployment

### Azure Static Web Apps (CLI)

```bash
cd product-page
swa deploy . --env production
```

### Azure Portal

1. Create new Static Web App resource
2. Source: GitHub or local
3. Build preset: Custom
4. App location: `/product-page`
5. Output location: `/product-page`
6. No API

## Theme

Emerald + Gold color palette:

```css
/* Emerald (background/primary) */
--emerald-dark: #134e5e;
--emerald-mid: #1a6b5a;
--emerald-light: #71b280;
--emerald-gradient: linear-gradient(135deg, #134e5e 0%, #71b280 100%);

/* Golden Keys (brand mark) */
--gold-bright: #f0b429;
--gold-rich: #d4a012;
--gold-deep: #b8860b;
--gold-gradient: linear-gradient(135deg, #f0b429 0%, #d4a012 50%, #b8860b 100%);
```

## Brand Patterns

### Golden Keys Monogram Wallpaper

Inspired by luxury brand patterns (Louis Vuitton, Gucci), the Travel Concierge brand includes a subtle repeating monogram pattern using the Golden Keys. This creates a premium, recognizable visual identity.

#### Pattern Characteristics

- **Repeating motif**: Crossed Golden Keys at regular intervals
- **Diagonal grid**: Keys arranged in a diamond/diagonal pattern
- **Subtle opacity**: 3-8% opacity on emerald backgrounds
- **Scale options**:
  - Large (120px) - Hero sections, splash screens
  - Medium (80px) - Cards, panels
  - Small (40px) - Dense backgrounds, mobile

#### Color Variations

| Background | Key Color | Opacity |
|------------|-----------|---------|
| Emerald gradient | Gold (#f0b429) | 5-8% |
| White/Light | Emerald (#1a6b5a) | 3-5% |
| Dark/Navy | Gold (#f0b429) | 6-10% |

#### CSS Implementation

```css
/* Emerald background with gold keys pattern */
.pattern-emerald {
  background-color: var(--emerald-dark);
  background-image:
    url("data:image/svg+xml,...golden-keys-svg..."),
    var(--emerald-gradient);
  background-size: 80px 80px, 100% 100%;
  background-position: 0 0, 0 0;
}

/* White background with emerald keys pattern */
.pattern-light {
  background-color: #fff;
  background-image: url("data:image/svg+xml,...emerald-keys-svg...");
  background-size: 60px 60px;
}
```

#### Usage Guidelines

1. **Hero sections**: Large pattern, very subtle (5% opacity)
2. **Cards/Panels**: Medium pattern on hover states
3. **Loading screens**: Animated pattern fade-in
4. **Email headers**: Static pattern strip
5. **Print materials**: Higher contrast (15-20% opacity)

#### Pattern Variations

- **Static**: Fixed position, no animation
- **Floating**: Subtle vertical drift animation (30s cycle)
- **Parallax**: Moves slower than content on scroll
- **Reveal**: Fades in on section entry

## Images Needed

- `og-image.png` - 1200x630 Open Graph image (emerald gradient + golden keys + tagline)
- `favicon.ico` - Golden keys on emerald background
- `apple-touch-icon.png` - Golden keys logo for iOS

## Local Development

Just open `index.html` in a browser, or use a simple server:

```bash
npx serve .
```
