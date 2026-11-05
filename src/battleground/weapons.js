// One source for server combat and the loadout screen.
export const WEAPONS = {
  pulse_pistol_mk1: { name:'Pulse Pistol', role:'Balanced sidearm', damage:12, rate:5, speed:900, range:1000, radius:5, magazine:24, reload:1250 },
  arc_smg: { name:'Arc SMG', role:'Close-range pressure', damage:7, rate:10, speed:860, range:700, radius:4, magazine:36, reload:1500, spread:.07 },
  prism_rifle: { name:'Prism Rifle', role:'Precise mid-range fire', damage:18, rate:3.4, speed:1100, range:1150, radius:5, magazine:18, reload:1400 },
  nova_shotgun: { name:'Nova Shotgun', role:'Six-pellet burst', damage:8, rate:1.35, speed:800, range:460, radius:5, magazine:8, reload:1800, pellets:6, spread:.28 },
  rail_lance: { name:'Rail Lance', role:'Long-range piercing', damage:38, rate:.85, speed:1600, range:1600, radius:5, magazine:6, reload:1800, pierce:2 },
  plasma_cannon: { name:'Plasma Cannon', role:'Explosive area damage', damage:28, rate:1.05, speed:560, range:1000, radius:11, magazine:8, reload:1800, splash:100 },
  tesla_carbine: { name:'Tesla Carbine', role:'Chains to nearby enemies', damage:10, rate:6.5, speed:980, range:850, radius:5, magazine:28, reload:1400, chain:130 },
  vortex_launcher: { name:'Vortex Launcher', role:'Explosive gravity pull', damage:32, rate:.9, speed:620, range:950, radius:12, magazine:5, reload:1900, vortex:140, splash:110 },
};
