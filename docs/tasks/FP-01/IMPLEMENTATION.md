# FP-01 implementation and review evidence

Local branch: `feat/fp-01-app-scaffold-and-shared-ui`. Related issue: #1.

## Run locally

Use the repository's Node 22.13+ baseline and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. On Windows with PowerShell script execution disabled, use `npm.cmd` instead of `npm`. Production: `npm run build`, then `npm start`. No environment file, database or provider credentials are needed for this public, synthetic UI preview.

## Scope and integration

- Next.js App Router, React and strict TypeScript; plain CSS with shared color, spacing and shape conventions. Lucide icons and Recharts are available from the agreed UI stack.
- Fixed desktop sidebar, compact tablet rail, mobile modal navigation, persistent simulation/profile/notification status, skip link, and responsive content grid.
- Shared `Button`, `Card`, `MetricCard`, `Badge`, `FormField`, `SelectField`, `DataTable`, `ChartWrapper`, `DataState` and `PageHeading` components in `src/components`.
- `/` demonstrates the shell with explicitly labeled fixture values. `/ui` demonstrates labeled fields, validation that preserves values, unavailable actions, and loading/empty/error/stale/success patterns.
- All twelve navigation destinations resolve to explicit placeholders. Feature owners can replace each destination with a static route without changing the shared layout. Unknown sections render the not-found view.
- No authentication, database access, banking connection, financial calculation, agent execution, chat response or API route is implemented. The preview profile is not an authenticated user. Financial actions are unavailable with visible explanations.
- Existing planning files and API contracts are preserved. `agentRules: false` prevents Next.js development startup from appending generated instructions to the existing `AGENTS.md`.

## Design reference

Reviewed the attached `FinPilot_All_Screens_and_Task_Guide.pdf`: page 3 (FP-01 handoff), page 4 (shell), and page 5 (shared interaction patterns). Pages 19 and 55 were consulted only for shared component and responsive consistency. The PDF review aligned the shell's “Open overview” navigation action, the stacked form and reusable table, and the right-hand loading, validation and decision-control cards. All text, inputs, navigation and buttons remain real semantic HTML/React components. No PDF page is used as an application image. PDF page headers, handoff text and interaction annotations remain outside the product UI.

Used the [dedicated FP-01 Figma page](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=2-4): shell application `3:829` and shared patterns application `3:936`. Implementation annotations are outside the product UI. Reused the provided forecast SVG locally at `public/images/forecast-reference.svg` (828 × 190); no temporary asset URLs remain. This is a design illustration, with a text alternative and disclosure explaining that numerical forecast data is unavailable. Future calculated charts must provide equivalent tabular data through `ChartWrapper.dataTable`.

Unavailable financial actions and synthetic source labels intentionally replace the reference's apparent functional actions and named profile. The layout adapts to the viewport instead of retaining fixed Figma widths.

## Acceptance checks

Verified on Windows with Node 24.22.0 and npm; the team's documented Node baseline remains 22.13+.

| Check | Result |
| --- | --- |
| `npm run dev` on localhost | Browser suite starts the real Next.js development server and loads the app |
| `npm run build` | Production build and all 16 generated pages pass |
| `npm run lint` | Pass, zero warnings |
| `npm run typecheck` | Pass |
| `npm test` | Two interaction tests pass: field validation/focus/accessible error association and input preservation through recovery |
| `npm run test:e2e` | Three Chromium browser tests pass |
| `npm audit` | Zero vulnerabilities after a scoped minimatch override for the TypeScript ESLint parser dependency |

Browser checks exercise all thirteen navigation links (twelve sections plus Shared UI), active states, unknown route, skip link, mobile drawer focus containment, Escape and focus return, navigation selection, keyboard table scrolling, no viewport overflow at 390px and 720px, tablet rail at 768px, reduced motion, local chart loading, and accessibility scans on home, mobile drawer and the validation state. The 720px check approximates the layout width at 200% zoom on a 1440px display; it does not automate browser zoom. Automated accessibility scans do not replace a screen-reader review.

The lockfile pins exact package versions. ESLint 9 is retained because the Next.js React/import/accessibility plugins do not yet declare ESLint 10 compatibility. Its registry deprecation notice is separate from the clean vulnerability audit. The scoped minimatch override should be revisited when the upstream parser updates its dependency.

## Screenshots

- [Desktop, 1440px](evidence/desktop-1440.png)
- [Mobile, 390px](evidence/mobile-390.png)
- [Mobile navigation, 390px](evidence/mobile-navigation-390.png)
- [Shared UI and keyboard validation, 1440px](evidence/shared-ui-1440.png)

Screenshots were visually reviewed for readable figures, simulation labels, unclipped primary actions and intentional table overflow. Browser screenshot tests regenerate these files. Planning documents retain their original historical status text; this file records the FP-01 implementation.

No push, pull request, merge or deployment is part of this local implementation.
