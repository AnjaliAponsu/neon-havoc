# NEON HAVOC — 2D Bullet-Hell Survival Game (30X Overhaul)

> **"Survive the chaos, destroy everything chasing you, and become the most powerful energy ball in the arena."**

A commercial-grade twin-stick roguelite bullet-hell survival shooter inspired by *Geometry Wars*, *Vampire Survivors*, and *Slime 3K*.

---

## 🌟 30X Upgrades & Enhancements

1. **Geometry Wars Elastic Spring Grid**:
   - High-performance 2D lattice with real-time Hooke's law spring physics.
   - Every dash, shockwave, bullet impact, and explosion dynamically distorts, ripples, and warps the arena floor with fluid elasticity.

2. **Holographic Tactical Radar (Minimap)**:
   - High-tech circular HUD radar in the top-right corner.
   - Real-time sweep beam tracking active enemy dots, Elite Champions (pulsing badges), Power-ups (stars), and Bosses (pulsing skull with off-screen directional chevrons).

3. **6 Arena Power-up Pickups**:
   - 💣 **Spectrum Supernova (Nuke)**: Vaporizes all standard enemies on screen in a blinding flash.
   - 🧲 **Quantum Vacuum**: Instantly pulls all crystals across the entire arena directly to Spark-01.
   - ⏱️ **Chrono Stasis**: Freezes all enemies and hostile projectiles for 5 seconds.
   - ⚡ **Hypercharge Battery**: Instantly charges Spectrum Overdrive to 100%.
   - 🛡️ **Invulnerability Matrix**: 6 seconds of complete invulnerability and +75% speed.
   - ❤️ **Nanite Repair Capsule**: Restores 50% Maximum Health.

4. **Tactical Environmental Energy Pylons**:
   - Overcharged Pylons scattered across the arena that can be shot.
   - When overloaded, they detonate in a massive chain lightning nova that wipes out adjacent swarms! Respawns every 45s.

5. **4 Legendary Weapon Evolutions (Super Weapons)**:
   - ⚡👑 **Thunderstorm Railgun** *(Evolved from Pulse Blaster)*: Hyper-velocity rail beam that discharges chain lightning on hit.
   - 💥👑 **Supernova Flak Cannon** *(Evolved from Plasma Spread)*: Exploding cluster shells detonating into secondary shrapnel.
   - 🕸️👑 **Tempest Web Matrix** *(Evolved from Chain Lightning)*: Permanent lightning cage electrocuting up to 8 targets at once.
   - 🌀👑 **Event Horizon Vortex** *(Evolved from Orbital Drones)*: 4 relativistic dark energy cores creating a gravitational vortex that shreds swarms.

6. **Elite Champion Enemies**:
   - Special champions marked with glowing gold crowns and special affixes (*Swift*, *Shielded*, *Mortar*, *Splitter King*). Guaranteed to drop a Power-up upon defeat!

7. **Dual Boss Encounter**:
   - **Wave 10**: The Void Titan (Radial bullet rings, rotating laser sweep, minion summoning).
   - **Wave 20 (Final Boss)**: Singularity Weaver (Cosmic accretion core, 4-way cross laser crucifix, petal spiral storms, and gravitational well).

8. **Visceral Game Feel (Juice & Crunch)**:
   - Directional camera trauma shake, smooth dynamic zoom (wide view on boss arrival, zoom-in on Overdrive).
   - Micro-freeze / hit-stop (35ms freeze on big kills, crits, and shockwaves for heavy impact).
   - Reroll 🎲 and Skip (+50 💎) options in the Level Up modal.

---

## 🚀 Quick Start (Play Instantly!)

The game is live right now!
Open your browser to:
👉 **[http://localhost:5173/](http://localhost:5173/)**

*(Or run `npm.cmd run dev` inside `d:\Games\MyGames`)*.

### Team Deathmatch Multiplayer

1. Run `npm.cmd run dev` and open the local game URL.
2. Select **Multiplayer Battleground** from the main menu.
3. Enter your callsign and choose a weapon. **Find Public Match** joins an available public arena. **Create Private Room** creates an invite-only room with a five-character code.
4. Friends open the same game address and join by code or invite link. The lobby shows actual players and empty slots. There are no automatically inserted bots.
5. Select teams and **Ready Up**. With at least one connected player on each team, all-ready starts a ten-second countdown. A lobby with opponents also starts after its sixty-second waiting period. Rooms hold up to four people per team, and late joins fill available slots.

**Testing alone:** click **TEST MATCH** in the battleground lobby. Choose Casual, Standard, or Veteran bots. You join three bot teammates against four bot opponents, and the match starts in three seconds without needing Ready Up. Bots navigate around cover, seek health, reload, strafe, and use abilities. Test arenas stay separate from public matchmaking, and every bot is labeled. A running match server is still required; `npm.cmd run dev` includes it.

**Testing with friends:** create a private room, have friends join first, then the host can select **Fill with Bots** and Ready Up. Public matches require just two humans, one on each team; eight players are optional. Bots cannot take ownership of a room, and bot-only rooms are removed when their last human leaves.

Loadout cards show damage, fire rate, magazine size, and reload time from the same weapon definitions used by the server. During the four-second respawn window, change your next weapon in **Respawn Loadout**. Reload progress appears on your orb and ammo display. Confirmed hits, eliminations, incoming damage direction, streaks, and team pings have distinct feedback. Use Z or middle click to ping a position for teammates. The match menu includes a screen shake toggle and respects reduced-motion preferences for camera shake.

The central Nexus grants its capturing team a temporary shield and 20% movement boost; it does not award elimination points. Its HUD distinguishes capture, contested, active boost, and recharge states. First to 40 eliminations still wins.

The match server runs at 30 Hz and owns movement, projectiles, damage, abilities, pickups, eliminations, respawns, team scores, and overtime. Hold `Tab` for the scoreboard and press `Enter` for chat.

**Battlefield & Camera:** The arena is expanded to **3840 x 2160** (2.56X larger surface area in 16:9 standard ratio) featuring a 3-lane tactical layout: North Sniper Highroad, South Industrial Trenches, Blue Bastion (West), Red Bastion (East), and the Grand Central Nexus. A **Dynamic Follow Camera** tracks player movement with aim peeking, soft boundary clamping, and combat trauma shake. Press `C`, use the mouse wheel, or click the camera button on the HUD to toggle between close-up **Follow** mode and full arena **Overview** mode. Off-screen fighter chevrons on the screen edge and an interactive minimap with a frustum viewport rectangle maintain total spatial awareness.

Deathmatch controls: WASD/arrows to move; mouse to aim; hold left click to fire; Q/Shift to dash; E for Aegis; R for Wave; F/Space for Meteor; X to reload; C or mouse wheel to toggle camera; Z or middle click to ping. Escape opens the match menu while the online game continues. Touch players drag the right control to aim and fire. Team chat reaches only teammates.

For friends on the same Wi-Fi, share this computer's LAN address (for example, `http://192.168.1.20:5173`), not `localhost`. All clients must reach the same running server.

For a production server, run `npm.cmd run build` followed by `npm.cmd run server`. Port 3001 serves both the built game and the WebSocket endpoint at `/ws`; `PORT` can override it. Internet play requires this server to be publicly reachable behind HTTPS with WebSocket upgrades forwarded to `/ws`. GitHub Pages alone hosts static files and cannot run the match server. For separate hosting, use the lobby's **Server address** setting or build with `VITE_MULTIPLAYER_URL=wss://your-server.example/ws`.

Connections have a 45-second reservation and retry automatically after disruption. Rematch returns the same players to their room's ready lobby; solo test rematches restart after three seconds. Host controls are reassigned to connected human players when the host disconnects.

Validation: `node --test server/teamDeathmatchServer.test.js` covers eight separate WebSocket clients, shared public matchmaking, capacity, ready/countdown, server-owned combat, team chat, reconnect, respawn, friendly fire, spawn protection, shield absorption, overtime, navigation around cover, solo bot combat, practice isolation, rematches, respawn loadouts, private-host controls, and room cleanup.

---

## 🎮 Controls

| Action | Keyboard / Mouse | Gamepad | Mobile Touch |
| :--- | :--- | :--- | :--- |
| **Move** | `W` `A` `S` `D` or `Arrow Keys` | Left Analog Stick | Left Virtual Joystick |
| **Aim** | Mouse Cursor | Right Analog Stick | Right Virtual Joystick |
| **Primary Fire** | Left Mouse Button (Hold) | Right Trigger / R1 | Right Virtual Joystick |
| **Auto-Fire Toggle** | `C` key | Settings Menu | Settings Menu |
| **Lightning Dash** | `Q` or Right Mouse Button | Left Trigger / L1 / A | Tap `[Q] DASH` slot |
| **Aegis Shield** | `E` key | B / Circle | Tap `[E] AEGIS` slot |
| **Electric Shockwave** | `R` key | X / Square | Tap `[R] WAVE` slot |
| **Spectrum Overdrive** | `SPACE` (when charged) | Y / Triangle | Tap `[SPACE] OD` slot |
| **Pause Menu** | `P` or `ESC` | Start / Options | Tap Pause button |
