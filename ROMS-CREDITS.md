# Bundled homebrew ROMs

The games under `roms/` are free, legally redistributable homebrew - not commercial titles. Each is credited below with its author, license, and upstream source (where the corresponding source code lives).

## uCity (`roms/ucity.gbc`)

- A city-building game for Game Boy Color.
- Author: Antonio Niño Díaz (AntonioND)
- License: GPLv3
- Source: https://github.com/AntonioND/ucity
- Release: https://github.com/AntonioND/ucity/releases/tag/v1.3

The binary is distributed here under the GPLv3; the corresponding source is available at the link above.

## 2048 (`roms/2048.gb`)

- A Game Boy port of the 2048 sliding-tile puzzle.
- Author: Sanqui
- License: Zlib
- Source: https://github.com/Sanqui/2048-gb
- ROM: http://sanqui.rustedlogic.net/etc/2048.gb

Distributed here under the permissive Zlib license; source is available at the link above.

## Libbet and the Magic Floor (`roms/libbet.gb`)

- A Game Boy puzzle game (rolling around a floor of tiles).
- Author: Damian Yerrick (pinobatch)
- License: Zlib
- Source + release: https://github.com/pinobatch/libbet

Distributed here under the permissive Zlib license; source is available at the link above.

## Nova the Squirrel (`roms/nova.nes`)

- An NES platformer where you copy enemy abilities.
- Author: NovaSquirrel
- License: GPLv3
- Source + release: https://github.com/NovaSquirrel/NovaTheSquirrel

The binary is distributed here under the GPLv3; the corresponding source is available at the link above.

## Thwaite (`roms/thwaite.nes`)

- An NES arcade game: shoot down missiles to protect towns.
- Author: Damian Yerrick (pinobatch)
- License: GPLv3
- Source + release: https://github.com/pinobatch/thwaite-nes

The binary is distributed here under the GPLv3; the corresponding source is available at the link above.

## Concentration Room (`roms/croom.nes`)

- An NES memory/concentration puzzle game.
- Author: Damian Yerrick (pinobatch)
- License: GPLv3
- Source + release: https://github.com/pinobatch/croom-nes

The binary is distributed here under the GPLv3; the corresponding source is available at the link above.

## Pong (`roms/pong.gba`)

- A simple Game Boy Advance Pong, made as a homebrew learning example.
- Author: ZeroDayArcade
- License: MIT
- Source: https://github.com/ZeroDayArcade/Pong-Homebrew-GBA

Distributed here under the permissive MIT license; source is available at the link above.

## Cover images (`covers/`)

The example-game cover images are title screens / promotional art taken from each
game's own source repository, and are redistributed here under that game's license:

- `covers/libbet.png` - promotional card from pinobatch/libbet (Zlib)
- `covers/nova.png` - title screen from NovaSquirrel/NovaTheSquirrel (GPLv3)
- `covers/thwaite.png` - title screen from pinobatch/thwaite-nes (GPLv3)
- `covers/croom.png` - screenshot from pinobatch/croom-nes (GPLv3)
- `covers/ucity.png` - screenshot from AntonioND/ucity (GPLv3)

Box art for non-example (user) ROMs is not bundled; it is fetched on demand from
the libretro thumbnail CDN by game name, and only when a match exists.

---

Only ROMs you are legally entitled to distribute belong in this folder. Commercial game ROMs are copyrighted and must not be committed (the `.gitignore` blocks ROM extensions by default; bundled homebrew is allowlisted explicitly).
