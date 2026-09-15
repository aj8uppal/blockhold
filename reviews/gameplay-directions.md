# Blockhold gameplay directions

Review date: 15 September 2026. Code baseline: `88065c9`.

Open [the portable review](./gameplay-directions.html) in a browser. It includes five alternatives, illustrative UI, implementation boundaries, a proposed test matrix, a critical design review, and a feedback form. It works without a server. Its feedback download does not send anything automatically.

The proposal recommends authored enemy encounters first, followed by a separate experiment with one optional battlefield objective. Battle doctrines, short expeditions, and more purposeful Hold goals remain alternatives for discussion. These gameplay ideas have not been implemented.

The adversarial review is a separate critical pass by the same assistant, not independent sign-off. It challenges dominant builds, compulsory mobile micro, reward snowballing, co-op transition failures, duplication of existing features, inaccessible counters, hidden adaptive difficulty, and shipping too many experiments together. The HTML records the resulting revisions and remaining uncertainties.

Evidence comes from the current wave generator, enemy definitions, Mythic powers, hunts, Frontier maps, the Hold catalog/editor, opt-in telemetry, user feedback, and [Ninja Kiwi’s official BTD6 feature page](https://store.steampowered.com/app/960090/Bloons_TD_6/). The proposal distinguishes observed code behavior from design hypotheses. No measured retention lift or completed gameplay balance study is claimed.

The review uses Blockhold’s current UI colors and control conventions. Browser checks passed at 1440×1000, 390×844, and 844×390: no horizontal overflow or JavaScript errors, five options, no feedback queued until explicit submission, and a functioning feedback download.

## Shipped before this review

Commit `88065c9` shipped to GitHub Pages and the co-op server:

- Barracks face their rally point.
- Seraph upper structures aim together, including Crimson’s flanking prongs.
- Legion Standards activate automatically when needed, including older runs through recorded commands.
- Range bands are clearer, with dotted continuation beyond the map.
- Impact shake leaves the sky and cloud backdrop steady and becomes gentler at close zoom.

Validation: 528 game tests, 56 server tests, four browser smoke tests, build/type/lint/asset budgets, historical replay fixtures, and a production two-browser co-op check covering combat, Standard activation, fusion, rejoin, and solo recovery.
