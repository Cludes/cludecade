# Progress log

Autonomous improvement log. One line per shipped item: date, what shipped, commit.

- 2026-06-02 - One-file .zip backup/restore for the current game (ROM + .sav + .state); store-only zip writer/reader with CRC32, validated against an external unzip tool - f5145a7
- 2026-06-02 - PWA: manifest.json, service worker caching the static shell (cores stay on CDN, not full offline), generated 192/512 PNG icons, theme-color - df94b2c
- 2026-06-02 - Page metadata: meta description, Open Graph + Twitter card tags, og:image - acaac29
- 2026-06-02 - Harden cheats startup race: await cheats.json before boot so cheats are never missed on a fast load - pending
