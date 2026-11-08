# Frontend blueprints

28 vector reference frames covering the scoped frontend. All figures, identities, offers and activity traces are illustrative. These are design references, not completed application features.

[Review PDF](FinPilot_Frontend_Blueprints.pdf) · [Screen gallery](gallery.html) · [Machine-readable map](screen-map.json)

| Screen | Frontend task | Backend | Agents | Editable SVG |
|---|---|---|---|---|
| 00 Design system | #1 / FP-01 | Shared contracts | All roles | [SVG](screens/00-design-system.svg) |
| 01 Sign in | #2 / FP-02 | #10 | None | [SVG](screens/01-sign-in.svg) |
| 02 Verify your email | #2 / FP-02 | #10 | None | [SVG](screens/02-verify-your-email.svg) |
| 03 Overview | #4 / FP-04 | #12, #13 | #18, #23 | [SVG](screens/03-overview.svg) |
| 04 Connected institutions | #3 / FP-03 | #11, #12 | Integrity #18 | [SVG](screens/04-connected-institutions.svg) |
| 05 Link institution | #3 / FP-03 | #11 | None | [SVG](screens/05-link-institution.svg) |
| 06 Consent & selection | #3 / FP-03 | #11 | Integrity #18 | [SVG](screens/06-consent-selection.svg) |
| 07 Accounts | #4 / FP-04 | #12 | Integrity #18 | [SVG](screens/07-accounts.svg) |
| 08 Transactions | #4 / FP-04 | #12 | Integrity #18 | [SVG](screens/08-transactions.svg) |
| 09 Cash & bills | #4 / FP-04 | #12, #13 | #18 | [SVG](screens/09-cash-bills.svg) |
| 10 Subscriptions | #5 / FP-05 | #13, #14 | #19 | [SVG](screens/10-subscriptions.svg) |
| 11 Offer comparison | #5 / FP-05 | #13, #14 | #19 | [SVG](screens/11-offer-comparison.svg) |
| 12 Debt & readiness | #6 / FP-06 | #13, #14 | #20 | [SVG](screens/12-debt-readiness.svg) |
| 13 Goals & plans | #6 / FP-06 | #14 | #20 | [SVG](screens/13-goals-plans.svg) |
| 14 Plan comparison | #6 / FP-06 | #14 | #20, #21 | [SVG](screens/14-plan-comparison.svg) |
| 15 Assets | #6 / FP-06 | #12 | #20 | [SVG](screens/15-assets.svg) |
| 16 Agent workspace | #7 / FP-07 | #15 | #17-#24 | [SVG](screens/16-agent-workspace.svg) |
| 17 Evidence drawer | #4, #7 / FP-04,07 | #12, #15 | #18, #23 | [SVG](screens/17-evidence-drawer.svg) |
| 18 Scenario lab | #6 / FP-06 | #13, #14 | #21 | [SVG](screens/18-scenario-lab.svg) |
| 19 Plan repair | #6, #7 / FP-06,07 | #14, #15 | #22, #23 | [SVG](screens/19-plan-repair.svg) |
| 20 Settings | #8 / FP-08 | #10, #11, #12 | None | [SVG](screens/20-settings.svg) |
| 21 Chat interface | #7 / FP-07 | #15 | #17, #23 | [SVG](screens/21-chat-interface.svg) |
| 22 State patterns | #1, #8 / FP-01,08 | All endpoints | All roles | [SVG](screens/22-state-patterns.svg) |
| 23 Mobile layouts | #1, #4, #7, #8 | Same APIs | Same roles | [SVG](screens/23-mobile-layouts.svg) |
| 24 Goal editor | #6 / FP-06 | #14 | #20 | [SVG](screens/24-goal-editor.svg) |
| 25 Subscription preferences | #5 / FP-05 | #14 | #19 | [SVG](screens/25-subscription-preferences.svg) |
| 26 Accept plan | #6 / FP-06 | #14 | #20, #21 | [SVG](screens/26-accept-plan.svg) |
| 27 Disconnect institution | #3, #8 / FP-03,08 | #11 | #18, #22 | [SVG](screens/27-disconnect-institution.svg) |

## Figma import

Create a Figma Design file and drag the SVG files onto the canvas. Each is a 1440 x 1000 vector reference frame; desktop app viewport is 1376 x 800. Frame 23 contains 390px mobile references. Font: DejaVu Sans (PDF embedded); substitute Inter or Arial if Figma requests a font. Text and shapes remain vector elements; imports do not automatically create native auto-layout, design-system components, prototype links or production code. Group each import into a named frame using its screen ID. Use page groups Foundations, Authentication, Accounts, Planning, Agents, and Mobile.

## Codex implementation

Read the selected issue, this map, the corresponding SVG and docs/UI_DESIGN.md. Match composition, component hierarchy and states while implementing the issue's acceptance criteria. Preserve authenticated user-scoped APIs and honest fixture labels. Do not hardcode illustrative amounts as real application data. Use frame 00 as shared tokens; frame 22 defines states; frame 23 defines responsive behavior.

## Task boundaries

#1 creates the shared shell/components and route scaffolds. #2 implements auth screens. #3 implements institution linking. #4 implements overview/accounts/transactions/cash plus shared record evidence. #5 implements subscriptions/offers. #6 implements debt/goals/plans/assets/scenarios and plan revision presentation. #7 implements agent workspace, finding evidence and basic chat; share the repair presentation with #6. #8 completes settings composition, visual integration and accessibility checks. Backend or agent dependencies in the map do not change those issue owners.
