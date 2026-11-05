import { ARENA, blocked } from '../src/battleground/arena.js';

// A reusable clearance graph. Edges test the full fighter radius, so routes
// cannot cut through corners even when the ray to an opponent is unobstructed.
export function walkable(a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/12));
  for(let i=0;i<=steps;i++) if(blocked(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,ARENA.radius))return false;
  return true;
}
let graph;
function navigationGraph() {
  if(graph)return graph;
  const nodes=[], grid=new Map(),step=70;
  for(let y=80;y<ARENA.height-69;y+=step)for(let x=80;x<ARENA.width-69;x+=step){
    if(blocked(x,y,ARENA.radius+3))continue;
    const node={x,y,id:nodes.length,edges:[]};nodes.push(node);grid.set(`${x},${y}`,node);
  }
  for(const a of nodes)for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step],[step,step],[step,-step],[-step,step],[-step,-step]]){
    const b=grid.get(`${a.x+dx},${a.y+dy}`);
    if(b&&walkable(a,b))a.edges.push({id:b.id,cost:Math.hypot(dx,dy)});
  }
  return graph=nodes;
}
export function findRoute(start, goal) {
  if(walkable(start,goal))return [{x:goal.x,y:goal.y}];
  const nodes=navigationGraph();
  const nearest=p=>[...nodes].sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).find(n=>walkable(p,n));
  const from=nearest(start),to=nearest(goal);if(!from||!to)return [];
  const costs=new Map([[from.id,0]]),parents=new Map(),open=new Set([from.id]);
  const heuristic=id=>Math.hypot(nodes[id].x-to.x,nodes[id].y-to.y);
  while(open.size){
    let current=-1,best=Infinity;
    for(const id of open){const f=costs.get(id)+heuristic(id);if(f<best){best=f;current=id;}}
    if(current===to.id){
      const route=[{x:goal.x,y:goal.y}];
      for(let id=current;id!==undefined;id=parents.get(id))route.unshift({x:nodes[id].x,y:nodes[id].y});
      return route;
    }
    open.delete(current);
    for(const e of nodes[current].edges){
      const cost=costs.get(current)+e.cost;
      if(cost<(costs.get(e.id)??Infinity)){costs.set(e.id,cost);parents.set(e.id,current);open.add(e.id);}
    }
  }
  return [];
}

export function steerBot(room,p,goal) {
  if(walkable(p,goal))return {mx:goal.x-p.x,my:goal.y-p.y};
  if(!p.route||room.clock>=p.routeUntil){p.route=findRoute(p,goal);p.routeUntil=room.clock+700;}
  while(p.route.length&&Math.hypot(p.route[0].x-p.x,p.route[0].y-p.y)<22)p.route.shift();
  // Skip obsolete waypoints only when the complete body can reach the next.
  while(p.route.length>1&&walkable(p,p.route[1]))p.route.shift();
  const next=p.route[0];return next?{mx:next.x-p.x,my:next.y-p.y}:{mx:0,my:0};
}
