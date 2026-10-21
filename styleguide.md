# Reusable product style guide

A framework-neutral visual system for clear, dependable service apps. Use it as a starting point for products such as finance tools, project managers, inventory dashboards, or other data-driven services. Keep the shared design language consistent while adapting navigation, workflows, data, and terminology to each product. Change semantic colour tokens to give each service its own identity.

## Design principles

- **Clarity first.** Make the main task and the next action easy to find.
- **Professional, not decorative.** Use calm surfaces and a restrained brand palette; reserve strong colour for actions, emphasis, and meaningful states.
- **Consistent by default.** Reuse the same spacing, type scale, controls, and interaction states across screens.
- **Quiet hierarchy.** Establish emphasis with size, weight, spacing, and surface contrast before adding more colour.
- **Data should explain itself.** Give values clear labels, units, timeframes, and context; do not make users guess what a number represents.
- **Fit the service.** Use patterns that support the product's real tasks rather than forcing every service into the same dashboard or workflow.
- **Accessible and responsive.** Keep text legible, controls operable, and layouts usable at narrow widths and with assistive technology.

## Colour system

Use semantic tokens rather than placing palette values directly in component styles. A theme should be replaceable by editing the token values, without changing the meaning of the interface.

| Token | Role |
| --- | --- |
| `--color-bg` | Overall page background |
| `--color-surface` | Cards, inputs, menus, and other raised surfaces |
| `--color-primary` | Brand identity and high-emphasis structural elements |
| `--color-primary-dark` | Deep brand tone for contrast and pressed/emphasized states |
| `--color-primary-light` | Soft brand-tinted surface for selected or hovered items |
| `--color-secondary` | Supporting palette tone, often used in borders or subtle fills |
| `--color-accent` | Main call to action and key interactive emphasis |
| `--color-contrast` | Foreground for high-emphasis brand surfaces |
| `--color-text` | Main body text |
| `--color-text-muted` | Supporting text, labels, and metadata |
| `--color-border` | Dividers, outlines, and control borders |
| `--color-success`, `--color-warning`, `--color-danger`, `--color-info` | Meaningful status feedback |

### Theme examples

These are starting points, not fixed brand requirements or industry conventions. Choose colours that suit the service's identity, then check contrast, especially for text on buttons and tinted surfaces.

| Role | Blue and cream | Orange and cream |
| --- | --- | --- |
| Page background | `#F6F3EA` | `#FAF4E9` |
| Surface | `#FFFCF5` | `#FFFCF5` |
| Primary | `#203A5B` | `#56301F` |
| Primary dark | `#14263F` | `#382014` |
| Secondary | `#A7B8C8` | `#D6B79D` |
| Accent | `#2C6491` | `#A84316` |
| Main text | `#203047` | `#3D2B20` |
| Muted text | `#536274` | `#6A584B` |

Example token setup:

```css
:root {
  --color-bg: #f6f3ea;
  --color-surface: #fffcf5;
  --color-primary: #203a5b;
  --color-primary-dark: #14263f;
  --color-secondary: #a7b8c8;
  --color-accent: #2c6491;
  --color-contrast: #14263f;
  --color-text: #203047;
  --color-text-muted: #536274;
  --color-border: #a7b8c8;

  --color-success: #26734d;
  --color-warning: #8a5b00;
  --color-danger: #b4232c;
  --color-info: #2c6491;
}
```

Generate or choose `--color-primary-light` as a subtle tint of the secondary/brand colour and surface; keep text on it readable. Status colours communicate meaning consistently and should not be repurposed as brand colours. Never rely on colour alone to communicate status.

Treat these values as examples only. A service can use a different palette, including dark themes, as long as semantic roles remain clear and contrast is checked. Keep success, warning, danger, and information colours recognizable and consistent even when the brand palette changes.

## Typography

- Use a clean sans-serif stack, preferably the product's existing licensed or bundled font. A dependable fallback is `Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
- Set body copy around `14–16px` with a line height near `1.5`. Choose the larger end for reading-heavy products.
- Use a clear, compact heading scale: page title around `28–36px`, section heading around `20px`, and supporting heading around `16px`.
- Use medium or semibold weights for labels and headings; reserve bold for short, high-priority emphasis.
- Keep line lengths comfortable. Use muted text for secondary metadata, not for essential instructions or low-contrast placeholder-only labels.
- Use sentence case for headings, buttons, and navigation. Prefer concise, specific labels such as “Create project” over vague labels such as “Submit”.

## Layout and spacing

- Use a consistent spacing scale based on `4px`: `4`, `8`, `16`, `24`, and `40px` are useful anchors.
- Keep primary page content centered with a readable maximum width (about `1120px` for a desktop dashboard); reduce outer padding on small screens.
- Group related content with whitespace first. Use a card only when it creates a useful boundary or grouping.
- Use a consistent corner-radius scale: about `7px` for compact controls, `12px` for buttons and inputs, and `16px` for larger cards.
- Keep surfaces simple: neutral or subtly tinted page background, clear surface contrast, subtle borders, and restrained shadows. Avoid stacking multiple shadows or nested cards without a clear purpose.
- Make the content order work in a single column; add columns only when the viewport has room.

## Adapting the system to a service

Keep the shared visual foundation, but let the information architecture reflect what people come to the service to do. Name navigation and actions using the product's language, and prioritize the most common tasks and decisions.

- **Finance and money management:** Make currency, units, date ranges, account/source, and whether a value is estimated or final explicit. Align amounts for easy comparison and format them consistently. Show gains, losses, and risk with labels or symbols as well as colour; do not imply that green always means good or red always means bad without context.
- **Project and work management:** Make ownership, status, due dates, dependencies, and progress easy to scan. Use a small, consistent set of statuses and explain progress measures. Keep task detail and project-level summaries visually distinct.
- **Inventory and stock overview:** Distinguish on-hand, reserved, and available quantities where relevant. Show units, location, thresholds, and when the data was last updated. Make low-stock or unavailable states actionable and avoid ambiguous quantity-only displays.
- **Other service types:** Identify the key objects, decisions, and actions first. Reuse the same layout and control conventions, but only include domain-specific fields, statuses, and visualizations when they help users understand or act on their data.

## Data-heavy screens

- Start dashboards with a small number of useful summary metrics, each with a plain-language label, unit, and relevant date range or comparison. Avoid filling the page with KPI cards just because the data exists.
- Put the primary task or decision near the top. Group secondary analysis and supporting detail below it.
- Make filters visible, understandable, and easy to reset. Show active filters and ensure exported or summarized results clearly reflect them.
- Use tables for precise comparison and scanning. Align numeric values consistently, include units in headers or values, and make sorting and pagination states clear.
- Use charts to answer a specific question. Label axes and time ranges, explain series, and pair the visual with a concise text summary or accessible data alternative.
- Design explicit loading, empty, partial-data, stale-data, and error states. Tell users what happened and what they can do next; do not present missing data as a valid zero.
- Use precise date, time, percentage, and currency formats consistently within the service. Respect locale and user settings where appropriate.

## Components and patterns

### Navigation

- Keep the product name and primary destinations easy to locate.
- Visually distinguish the current destination with a filled/tinted background or another clear indicator, not colour alone.
- Collapse or wrap navigation cleanly on smaller screens; avoid horizontal overflow.

### Buttons

- **Primary:** one prominent action per context, using the accent colour with a legible foreground.
- **Secondary:** lower-emphasis actions, using a surface fill and visible border.
- **Destructive:** use the danger colour and label the consequence clearly; do not make it look like an ordinary action.
- Aim for a minimum height of `42px`, a comfortable hit area, and a consistent radius.
- Include hover, keyboard-focus, pressed, and disabled states. Do not communicate disabled state only by colour.

### Forms

- Put a persistent, programmatically associated label above each input; do not use placeholder text as the only label.
- Use a consistent control height (around `42px`), padding, border, and radius.
- Show validation next to the relevant field, explain how to fix the error, and associate the message with that field.
- Preserve input values when validation fails. Clearly distinguish disabled, read-only, invalid, and focused states.
- Use native controls where they provide a better accessible and mobile experience.

### Cards, tables, and data

- Use cards to group related information or actions, with a clear heading and consistent internal padding.
- Keep tables aligned and scannable; label columns clearly, format numbers consistently, and provide a useful narrow-screen alternative when needed. See [Data-heavy screens](#data-heavy-screens) for additional guidance.
- Show empty, loading, and error states with explicit next steps where possible.
- Give charts a text summary or accessible data alternative. Do not rely on hue alone to distinguish data series.

### Feedback and status

- Use the same status token and wording consistently throughout the product.
- Pair status colour with text, an icon, or another visible cue.
- Make success and error feedback clear without relying solely on transient animation or colour.

## Interaction and accessibility

- All interactive elements must work with a keyboard and have an obvious `:focus-visible` indicator.
- Maintain sufficient contrast: target WCAG AA (at least `4.5:1` for normal text and `3:1` for large text and meaningful interface boundaries).
- Respect reduced-motion preferences. Keep transitions subtle and never make motion necessary to understand a change.
- Provide accessible names for icon-only controls; decorative icons should be hidden from assistive technology.
- Use semantic HTML and preserve logical heading order.
- Aim for touch targets of at least `44 × 44px` where practical.

## Responsive behavior

- Design from a usable single-column layout, then enhance for wider screens.
- At narrow widths, reduce page padding, stack related controls, and keep primary actions visible without horizontal scrolling.
- Allow navigation and tables to adapt deliberately; do not simply shrink desktop layouts until text becomes unreadable.
- Test at a narrow phone width, a tablet width, and a typical desktop width.

## Implementation guidance

1. Define semantic CSS custom properties for colours, typography, spacing, radii, and shadows in one shared theme file.
2. Build shared primitives for buttons, fields, cards, page containers, and navigation before duplicating those styles in feature screens.
3. Reference tokens in component styles; avoid hard-coded brand colours and one-off spacing values.
4. Keep theme variants limited to token overrides so layouts and component behavior remain consistent.
5. Keep domain rules and data formatting close to the relevant feature, while reusing visual primitives across the product.
6. Verify contrast, focus visibility, responsive behavior, data clarity, and status meaning whenever a theme or feature changes.
