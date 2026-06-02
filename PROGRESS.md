# Progress log

Autonomous improvement log. One line per shipped item: date, what shipped, commit.

- 2026-06-02 - One-file .zip backup/restore for the current game (ROM + .sav + .state); store-only zip writer/reader with CRC32, validated against an external unzip tool - f5145a7
- 2026-06-02 - PWA: manifest.json, service worker caching the static shell (cores stay on CDN, not full offline), generated 192/512 PNG icons, theme-color - df94b2c
- 2026-06-02 - Page metadata: meta description, Open Graph + Twitter card tags, og:image - acaac29
- 2026-06-02 - Harden cheats startup race: await cheats.json before boot so cheats are never missed on a fast load - a9fec3e
- 2026-06-02 - Configurable save-state autosave interval (10/20/30/60s, persisted) and skip writing unchanged states via crc32 - 3944b08
- 2026-06-02 - "Now playing" row + Change game button to return to the game list (reload, recent ROMs persist) - 017fa73
- 2026-06-02 - SKIPPED item 7 (settings persistence): EmulatorJS already persists volume, control mappings, shaders and display settings to its own storage; building our own would be redundant
- 2026-06-02 - Loading spinner on the "Loading..." state (CSS-only ::before, perceived-load polish) - 3383276
- 2026-06-02 - Mobile polish: stack control labels above their buttons under 480px so rows aren't cramped - f5914bb
- 2026-06-02 - Respect prefers-reduced-motion: disable spinner animation and transitions - 9be73d4
- 2026-06-02 - Emulator load timeout (30s): show a clear error instead of an endless spinner if the core fails to load - b76b192
- 2026-06-02 - In-page Install app button shown when the browser reports PWA installability - 236dc5c
- 2026-06-02 - System badge in the "Now playing" row (Game Boy / GBC / GBA / NES / SNES) - a69a615
- 2026-06-02 - Set document title to the loaded game so tabs / installed PWA window are identifiable - 212c4f6
- 2026-06-02 - noscript fallback message for visitors with JavaScript disabled - 54ea257
- 2026-06-02 - Footer "View source on GitHub" link - d08e1a6
- 2026-06-02 - Expand cheats.json: Super Mario Land (GB), Super Mario Bros + Zelda (NES), Super Mario World (SNES), verified Game Genie codes; match now also requires system==core to avoid cross-console collisions - e16609a
- 2026-06-02 - Visual modernization: gradient background + title, card-style panels with shadows, refined buttons (hover lift, primary/secondary hierarchy), pill badge, polished spacing - 4569d17
- 2026-06-02 - First-run hero: cartridge SVG glyph + headline on the picker landing for clearer visual hierarchy - b35d5e2
- 2026-06-02 - Header polish: accent underline under the wordmark; theme-color corrected to match the redesigned background - acd821a
- 2026-06-02 - Destructive-action affordance: red hover for Clear all and the remove-game buttons - fda081a
- 2026-06-02 - Custom-styled select with inline-SVG caret to match the themed controls - 6ae9ebd
- 2026-06-02 - Show console (system) as a pill badge on each recent-games entry - 939c74c
- 2026-06-02 - Style #status confirmations as a feedback chip (inset background, border) when present - 08cf785
- 2026-06-02 - Bigger tap targets on mobile (>=42px min height for buttons/selects/remove) - 261aecc
- 2026-06-02 - Themed thin scrollbars (Firefox scrollbar-color + WebKit scrollbar pseudo-elements) - a7a1146
- 2026-06-02 - Gentle fade/slide entrance for the save-controls panel on game ready (reduced-motion honored) - d7d5c50
- 2026-06-02 - Group the controls panel: dividers only between logical groups (saves / autosave-to-disk / backup), not every row - 3388e44
- 2026-06-02 - Themed ::selection highlight (green tint) to match the palette - pending
