# Instructions for implementing agents

1. Read `SPEC.md` first. It is the source of truth for product, design and process.
2. Then read `docs/progress.md` (what is done, what is next) and `docs/decisions.md` (accepted choices). Nothing else carries over between sessions, so keep both files current in every PR.
3. Work in focused PRs following the delivery plan in `SPEC.md` section 15. Never push to `main` directly.
4. Where the spec leaves a visual or interaction detail open, render it in a real browser with Playwright, look at the screenshots at the capture-matrix viewports (390 × 844, 768 × 1024, 1440 × 1000, plus 320 px reflow), and iterate until it is as good as you can make it. Record the choice in `docs/decisions.md`.
5. After each PR, show the Playwright screenshots to the owner in the conversation. Do not attach screenshots to PRs or PR comments and do not commit screenshots or visual baselines.
6. You draw the pixel art yourself, as original work. Do not copy or import third-party assets. Keep reference material as attributed links only.
7. Never invent production events, dates, fees, contact addresses, affiliations or statistics. Every published event needs provenance.
8. Do not deploy, change DNS, buy anything or publish the site without the owner's explicit release decision.
