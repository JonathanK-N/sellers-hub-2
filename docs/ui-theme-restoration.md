# Original green restoration

Historical tokens: primary #1D9E75, hover #168260, secondary #085041, soft #E1F5EE, accent #EF9F27. Tailwind `afri-*` colors support opacity modifiers through shared RGB variables; inline chart/icon colors use CSS variables.

387 corresponding lines were restored against main with minimum masked-line similarity 0.94. Full before/after evidence: `release-evidence/theme-correspondence.json`. Residual new components were reviewed separately: `theme-manual-review.json`. Original accent remains on premium labels, rating stars, notification/cart counters and original amber statuses. Functional orange suspension warnings, neutral grays, black modal scrims and error reds remain distinct.

Cart drawer, authentication modal, responsive layouts, routing, Poppins, animations and reduced-motion behavior are preserved. New brand header/hero/footer surfaces inherit original dark green; new CTAs inherit primary/hover green. No financial behavior changed.

Accessibility limitation: white on #1D9E75 has approximately 3.38:1 contrast; white on #EF9F27 approximately 2.15:1. Small white text on these backgrounds fails AA. Exact historical palette restoration does not itself certify accessibility. Dark-green focus outlines were added; complete contrast and keyboard audits remain mandatory before production.
