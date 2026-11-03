// Shared geometry and movement: rendering, prediction and server collision use the same map.
export const ARENA = { width: 2400, height: 1350, radius: 24, speed: 300 };
export const COLORS = { BLUE: '#00e5ff', RED: '#ff315b' };
const barrier = (id, points) => ({ id, points });
const mirror = (wall) => barrier(`${wall.id}-mirror`, wall.points.map(([x, y]) => [2400 - x, 1350 - y]));
const half = [
  barrier('west-hook', [[290,590],[515,590],[570,535],[620,535],[620,710],[545,710],[545,670],[290,670]]),
  barrier('north-hook', [[980,205],[1050,205],[1050,340],[990,400],[900,400],[900,325],[980,245]]),
  barrier('south-elbow', [[900,800],[1040,800],[1160,920],[1160,1020],[1085,1020],[1085,950],[1000,875],[900,875]]),
  barrier('edge-fin', [[335,245],[430,150],[475,190],[390,275],[390,410],[335,450]]),
  barrier('spawn-cover', [[490,65],[570,65],[570,165],[490,165]]),
];
export const WALLS = [...half, ...half.map(mirror)];
export const SPAWNS = {
  BLUE: [{x:430,y:500},{x:480,y:780},{x:600,y:340},{x:640,y:1000}],
  RED: [{x:1970,y:850},{x:1920,y:570},{x:1800,y:1010},{x:1760,y:350}],
};
export const PICKUPS = [
  {id:'heal-west',type:'HEAL',x:690,y:1150}, {id:'heal-east',type:'HEAL',x:1710,y:200},
  {id:'charge-west',type:'CHARGE',x:770,y:900}, {id:'charge-east',type:'CHARGE',x:1630,y:450},
  {id:'ammo-west',type:'AMMO',x:780,y:440}, {id:'ammo-east',type:'AMMO',x:1620,y:910},
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
  moveBody(body, input.mx / length * ARENA.speed * dt, input.my / length * ARENA.speed * dt);
}
export function lineClear(a, b) {
  const steps = Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/10);
  for(let i=1;i<steps;i++) if(blocked(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,1)) return false;
  return true;
}
