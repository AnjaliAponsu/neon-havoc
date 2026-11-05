// Shared geometry and movement: rendering, prediction and server collision use the same map.
export const ARENA = { width: 3840, height: 2160, radius: 24, speed: 320 };
export const COLORS = { BLUE: '#00e5ff', RED: '#ff315b' };
const barrier = (id, points) => ({ id, points });
const mirror = (wall) => barrier(`${wall.id}-mirror`, wall.points.map(([x, y]) => [ARENA.width - x, ARENA.height - y]));
const half = [
  barrier('west-hook', [[290,590],[515,590],[570,535],[620,535],[620,710],[545,710],[545,670],[290,670]]),
  barrier('edge-fin', [[335,245],[430,150],[475,190],[390,275],[390,410],[335,450]]),
  barrier('spawn-cover', [[490,65],[570,65],[570,165],[490,165]]),
  barrier('north-hook', [[980,205],[1050,205],[1050,340],[990,400],[900,400],[900,325],[980,245]]),
  barrier('south-elbow', [[900,800],[1040,800],[1160,920],[1160,1020],[1085,1020],[1085,950],[1000,875],[900,875]]),
  barrier('midfield-bunker', [[1420,680],[1580,680],[1580,820],[1420,820]]),
  barrier('nexus-shield-nw', [[1680,880],[1780,800],[1840,860],[1740,940]]),
  barrier('nexus-shield-sw', [[1680,1280],[1740,1220],[1840,1300],[1780,1360]]),
  barrier('south-trench-barrier', [[1200,1650],[1450,1650],[1450,1780],[1350,1780],[1350,1730],[1200,1730]]),
];
export const WALLS = [...half, ...half.map(mirror)];
export const SPAWNS = {
  BLUE: [{x:520,y:440},{x:440,y:920},{x:520,y:1400},{x:720,y:1100}],
  RED: [{x:3320,y:1720},{x:3400,y:1240},{x:3320,y:760},{x:3120,y:1060}],
};
export const PICKUPS = [
  {id:'heal-west',type:'HEAL',x:920,y:1080}, {id:'heal-east',type:'HEAL',x:2920,y:1080},
  {id:'charge-west',type:'CHARGE',x:1380,y:1940}, {id:'charge-east',type:'CHARGE',x:2460,y:220},
  {id:'ammo-west',type:'AMMO',x:1380,y:220}, {id:'ammo-east',type:'AMMO',x:2460,y:1940},
  {id:'heal-mid-north',type:'HEAL',x:1920,y:520}, {id:'charge-mid-south',type:'CHARGE',x:1920,y:1640},
];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function circlePolygon(x, y, radius, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j], [bx, by] = points[i];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    if ((x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2 < radius ** 2) return true;
  }
  return inside;
}
export function blocked(x, y, radius = ARENA.radius) {
  return x < 45 + radius || y < 45 + radius || x > ARENA.width - 45 - radius || y > ARENA.height - 45 - radius
    || WALLS.some((w) => circlePolygon(x, y, radius, w.points));
}
export function moveBody(body, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let n = 0; n < steps; n++) {
    if (!blocked(body.x + dx / steps, body.y)) body.x += dx / steps;
    if (!blocked(body.x, body.y + dy / steps)) body.y += dy / steps;
  }
}
export function moveInput(body, input, dt) {
  const length = Math.max(1, Math.hypot(input.mx, input.my));
  const speed=ARENA.speed*(body.speedMultiplier||1);
  moveBody(body, input.mx / length * speed * dt, input.my / length * speed * dt);
}
export function lineClear(a, b) {
  const steps = Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/10);
  for(let i=1;i<steps;i++) if(blocked(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,1)) return false;
  return true;
}
