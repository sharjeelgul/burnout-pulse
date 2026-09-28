# Accessibility conformance (draft)

**Target:** WCAG 2.1 Level AA. This is the standard in HHS's Section 504 rule for web content and mobile apps offered by recipients of HHS funding, which includes virtually every U.S. hospital. On May 7, 2026, HHS extended the compliance date for recipients with 15 or more employees to **May 11, 2027**.

**Status:** Tested with automated tools and scripted keyboard checks. **Not yet tested by assistive-technology users.** A formal Accessibility Conformance Report (VPAT 2.5) needs manual testing with NVDA, JAWS, VoiceOver (macOS and iOS), and TalkBack, which has not been done.

## Automated results (v13, 2026-09-27)

axe-core 4.13, WCAG 2.0/2.1 A and AA rule sets, on every view (sign-in, check-in, trend, coach consent, coach thread with a crisis block, settings), in light and dark mode: **0 violations.** Reproduce with `npm run test:e2e`.

## What v12 failed and v13 fixes

| Criterion | v12 | v13 |
|---|---|---|
| 1.4.3 Contrast (text) | 7 text pairs below 4.5:1 (eyebrows 2.29, primary button 3.06, band labels 1.92 to 3.21) | All pairs at 4.5:1 or above (see table) |
| 1.4.11 Non-text contrast | Focus ring 2.78, scale borders 2.14, toggle 1.39 | 3.09 to 4.58 |
| 1.3.1 Info and relationships | Answer choices were loose buttons with no grouping | `fieldset`/`legend` radio groups; labeled form fields; real `form` elements |
| 4.1.2 Name, role, value | Tabs had no roles; selection state was not exposed | WAI-ARIA tabs with `aria-selected` and arrow-key navigation; `role="switch"` with `aria-checked` |
| 4.1.3 Status messages | Toasts and errors were silent to screen readers | `role="status"` toast, `role="alert"` errors, `role="log"` coach thread |
| 2.4.1 Bypass blocks | None | Skip link |
| 1.4.1 Use of color | Trend shown by color and arrow only | Trend in words ("Up 8"); chart has a text caption |
| 1.4.4 / 1.4.12 Text size and spacing | 9.6px answer captions on mobile | 12px minimum; answer text wraps |
| 2.5.5 Target size (AAA, adopted anyway) | 38px icon buttons | 44px minimum |
| 2.3.3 Animation | Breathing ring and splash screen ran continuously | Removed; all motion stops under `prefers-reduced-motion` |
| Dark mode, forced colors | None | `prefers-color-scheme` and `forced-colors` support |

## Contrast ratios (computed)

| Pair | Light | Dark |
|---|---|---|
| Body text on panel | 11.11 | 11.47 |
| Secondary text on background | 5.70 | 7.00 |
| Eyebrow labels | 4.61 | 8.05 |
| Primary button text | 5.77 | 6.21 |
| Accent text on panel | 5.29 | 5.50 |
| Band: steady / strained / heavy / depleted | 6.34 / 5.35 / 5.29 / 7.76 | 6.88 / 7.44 / 5.50 / 6.14 |
| Control borders (non-text) | 3.09 | 3.25 |
| Focus ring (non-text) | 4.58 | 6.21 |

## Known gaps

- There has been no manual screen-reader pass (see Status above).
- The trend chart is decorative. Its data is given in the caption and the list; there is no data-table alternative beyond those.
- Cognitive accessibility has not been assessed with users. The check-in is short by design.
