import { WALLS, ARENA, COLORS } from './arena.js';

const TAU = Math.PI * 2;
function poly(c, points) {
  c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.closePath();
}
function glow(c,x,y,r,color,alpha=1) {
  c.save(); c.globalAlpha=alpha;
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.18,color+'88');g.addColorStop(1,color+'00');
  c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
}
function line(c,points,color,width=2,blur=0) {
  c.save();c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.shadowColor=color;c.shadowBlur=blur;
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();
}
export function fighterColor(p,players) {
  if(p.team==='RED')return '#ff174f';
  const i=players.filter(e=>e.team==='BLUE').findIndex(e=>e.id===p.id);
  return ['#00dfff','#b335ff','#ffb719','#00ff88'][Math.max(0,i)%4];
}

export class BattlegroundArt {
  constructor() {
    this.floor=document.createElement('canvas');this.floor.width=ARENA.width;this.floor.height=ARENA.height;
    this.scorchMarks=[];
    this.floorRipples=[];
    this.dashStreaks=[];
    this.nexusPulses=[];
    this.nexusPulseTimer=0;
    this.steamParticles=[];
    this.steamVents=[
      { x: 450, y: 110, angle: Math.PI / 2, timer: 0 },
      { x: 1950, y: 1240, angle: -Math.PI / 2, timer: 0.8 },
      { x: 270, y: 710, angle: 0, timer: 0.4 },
      { x: 2130, y: 640, angle: Math.PI, timer: 1.2 }
    ];
    this.lastFighterPos=new Map();
    this.lastTime=performance.now()/1000;
    this.hitmarkers=[];
    this.combatNumbers=[];
    this.damageArcs=[];
    this.pings=[];
    this.streakBanners=[];
    this.motes=Array.from({length:35},()=>({
      x:Math.random()*ARENA.width,y:Math.random()*ARENA.height,
      vx:(Math.random()-.5)*18,vy:(Math.random()-.5)*18,
      size:1.5+Math.random()*2.2,color:Math.random()>.5?'#00dfff':'#ff1da0'
    }));
    this.buildFloor(this.floor.getContext('2d'));
  }
  addScorch(x,y,radius=26,color='#ffaa00'){
    if(this.scorchMarks.length>30)this.scorchMarks.shift();
    this.scorchMarks.push({x,y,radius,color,life:8.0,maxLife:8.0});
  }
  addFloorRipple(x,y,color='#00dfff'){
    if(this.floorRipples.length>50)this.floorRipples.shift();
    this.floorRipples.push({x,y,radius:10,maxRadius:52,color,life:0.65,maxLife:0.65});
  }
  addDashStreak(x1,y1,x2,y2,color='#00dfff'){
    if(this.dashStreaks.length>25)this.dashStreaks.shift();
    const dist=Math.hypot(x2-x1,y2-y1);
    const steps=Math.max(3,Math.floor(dist/22));
    const pts=[[x1,y1]];
    const nx=-(y2-y1)/(dist||1), ny=(x2-x1)/(dist||1);
    for(let i=1;i<steps;i++){
      const t=i/steps, j=(Math.random()-.5)*16;
      pts.push([x1+(x2-x1)*t+nx*j, y1+(y2-y1)*t+ny*j]);
    }
    pts.push([x2,y2]);
    this.dashStreaks.push({pts,color,life:0.38,maxLife:0.38});
  }
  addHitmarker(fatal=false,shield=false){
    if(this.hitmarkers.length>15)this.hitmarkers.shift();
    this.hitmarkers.push({life:0.24,maxLife:0.24,fatal,shield});
  }
  addCombatNumber(x,y,text,color='#ffc247'){
    if(this.combatNumbers.length>40)this.combatNumbers.shift();
    this.combatNumbers.push({x:x+(Math.random()-.5)*20,y,text,color,life:0.85,maxLife:0.85});
  }
  addDamageArc(attackerPos,playerPos){
    if(!attackerPos||!playerPos)return;
    const angle=Math.atan2(attackerPos.y-playerPos.y,attackerPos.x-playerPos.x);
    if(this.damageArcs.length>8)this.damageArcs.shift();
    this.damageArcs.push({angle,life:0.65,maxLife:0.65});
  }
  addPing(x,y,team='BLUE',label='PING'){
    if(this.pings.length>10)this.pings.shift();
    this.pings.push({x,y,team,label,life:4.5,maxLife:4.5});
  }
  addStreakBanner(title,playerName,team,count){
    if(this.streakBanners.length>3)this.streakBanners.shift();
    this.streakBanners.push({title,playerName,team,count,life:3.2,maxLife:3.2});
  }
  buildFloor(c) {
    c.fillStyle='#030716';c.fillRect(0,0,2400,1350);
    const g=c.createRadialGradient(1270,650,60,1200,675,1300);
    g.addColorStop(0,'#151535');g.addColorStop(.52,'#081427');g.addColorStop(1,'#020617');
    c.fillStyle=g;c.fillRect(0,0,2400,1350);
    // Floor plates, fastening points and circuit traces stay subtle behind combat.
    for(let x=45;x<2360;x+=44)for(let y=45;y<1310;y+=44){
      const v=(x*73+y*31)%17;
      c.fillStyle=v<4?'#14203b33':'#09122422';c.fillRect(x+1,y+1,42,42);
      c.strokeStyle='#25365930';c.lineWidth=.7;c.strokeRect(x,y,44,44);
      c.fillStyle=v%3===0?'#0fa9f47a':'#31558b65';c.fillRect(x-1,y-1,2,2);
      if(v===2)line(c,[[x+8,y+34],[x+19,y+34],[x+28,y+25]],'#3a33672f',1);
    }
    for(const [x,y,color] of [[420,390,'#003b70'],[2100,830,'#590334'],[1240,620,'#490a65']])glow(c,x,y,480,color,.4);
    const rim=[[80,65],[410,65],[490,145],[820,145],[890,65],[2310,65],[2360,120],[2360,1230],[2285,1305],[1920,1305],[1830,1235],[1520,1235],[1450,1305],[80,1305],[40,1240],[40,125],[80,65]];
    line(c,rim,'#070b20',40);line(c,rim,'#273157',24);line(c,rim,'#49355b',2);
    for(let i=0;i<rim.length-1;i++){
      if(i%3===0)line(c,[rim[i],rim[i+1]],i%2?'#fc1cff':'#02cfff',4,18);
      else line(c,[rim[i],rim[i+1]],'#151630',11);
    }
    WALLS.forEach(w=>this.wall(c,w));
    for(const [x,y] of [[555,1050],[610,1125],[900,1100],[1730,165],[1790,195],[235,770],[880,130]])this.crate(c,x,y);
    for(const [x,y,col] of [[290,380,'#00dfff'],[750,1210,'#00ff88'],[2110,970,'#ff315b'],[1650,140,'#ffb719'],[1100,560,'#d333ff'],[1300,790,'#00dfff']])this.crystal(c,x,y,col);
    c.font='bold 13px monospace';c.textAlign='center';
    c.fillStyle='#00dfff55';c.fillText('BLUE / DEPLOYMENT',440,1180);
    c.fillStyle='#ff315b55';c.fillText('RED / DEPLOYMENT',1960,180);
  }
  wall(c,w) {
    const pts=w.points,depth=36,top=pts.map(([x,y])=>[x,y-depth]);
    c.save();c.shadowBlur=25;c.shadowColor='#000';c.fillStyle='#000a';poly(c,pts.map(([x,y])=>[x+8,y+20]));c.fill();c.restore();
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length];
      const grad=c.createLinearGradient(0,Math.min(a[1],b[1])-depth,0,Math.max(a[1],b[1]));
      grad.addColorStop(0,'#253457');grad.addColorStop(1,'#060c1a');
      c.fillStyle=grad;poly(c,[[a[0],a[1]-depth],[b[0],b[1]-depth],b,a]);c.fill();
      line(c,[a,b],'#15284b',2);
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),parts=Math.floor(length/39);
      for(let k=1;k<parts;k++){
        const x=a[0]+(b[0]-a[0])*k/parts,y=a[1]+(b[1]-a[1])*k/parts;
        line(c,[[x,y-depth+3],[x,y-3]],'#050a18',3);
        c.fillStyle='#2e3e6b';c.fillRect(x+4,y-11,5,4);
      }
    }
    const grad=c.createLinearGradient(pts[0][0],pts[0][1]-120,pts[0][0]+250,pts[0][1]+80);
    grad.addColorStop(0,'#253c65');grad.addColorStop(.5,'#18213d');grad.addColorStop(1,'#321c4c');
    c.fillStyle=grad;poly(c,top);c.fill();c.strokeStyle='#40527e';c.lineWidth=2;c.stroke();
    const cx=top.reduce((n,p)=>n+p[0],0)/top.length,cy=top.reduce((n,p)=>n+p[1],0)/top.length;
    const inset=top.map(([x,y])=>[x+(cx-x)*.06,y+(cy-y)*.07]);
    line(c,[...inset,inset[0]],'#060b20',5);
    for(let i=0;i<top.length;i++){
      const a=top[i],b=top[(i+1)%top.length],col=i<top.length/2?'#00dfff':'#fb17fa';
      if(i%3!==2)line(c,[[a[0]+(b[0]-a[0])*.12,a[1]+(b[1]-a[1])*.12],[a[0]+(b[0]-a[0])*.86,a[1]+(b[1]-a[1])*.86]],col,4,16);
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let t=35;t<len-15;t+=52){
        const x=a[0]+(b[0]-a[0])*t/len,y=a[1]+(b[1]-a[1])*t/len;
        c.fillStyle='#0a1025';c.fillRect(x-7,y+7,14,7);
        line(c,[[x-7,y+7],[x-2,y+12],[x+6,y+12]],'#435075',1);
      }
    }
    // Bright side seams create the raised industrial silhouettes in the reference.
    for(let i=0;i<pts.length;i+=3)line(c,[[pts[i][0],pts[i][1]-depth+8],[pts[i][0],pts[i][1]-5]],'#ee13f0',3,15);
  }
  crate(c,x,y) {
    c.fillStyle='#10172c';poly(c,[[x-23,y-8],[x+23,y-8],[x+23,y+50],[x-23,y+50]]);c.fill();
    line(c,[[x-20,y],[x-20,y+44],[x+19,y+44],[x+19,y]],'#233c61',2);
    const p=Array.from({length:8},(_,i)=>[x+Math.cos(i*TAU/8+Math.PI/8)*28,y+Math.sin(i*TAU/8+Math.PI/8)*22]);
    c.fillStyle='#203862';poly(c,p);c.fill();line(c,[...p,p[0]],'#2574ad',2,4);
    c.fillStyle='#29436f';c.beginPath();c.ellipse(x,y,16,13,0,0,TAU);c.fill();
    line(c,[[x+20,y+10],[x+20,y+32]],'#008bde',2,8);
  }
  crystal(c,x,y,color) {
    glow(c,x,y,55,color,.55);
    c.fillStyle='rgba(2,6,18,0.55)';c.beginPath();c.ellipse(x+4,y+6,22,10,0,0,TAU);c.fill();
    const h=38,w=14;
    // Left facet (specular primary)
    c.fillStyle=color;c.beginPath();c.moveTo(x,y-h);c.lineTo(x-w,y-h*.2);c.lineTo(x-w*.6,y+6);c.lineTo(x,y+8);c.closePath();c.fill();
    // Right facet (ambient shade)
    c.fillStyle='#07182c';c.beginPath();c.moveTo(x,y-h);c.lineTo(x,y+8);c.lineTo(x+w*.6,y+6);c.lineTo(x+w,y-h*.2);c.closePath();c.fill();
    // Spine
    line(c,[[x,y-h],[x,y+8]],'#ffffff',1.4);
    // Tip glint
    c.fillStyle='#fff';c.beginPath();c.arc(x,y-h,2,0,TAU);c.fill();
  }
  nexus(c,time) {
    c.save();c.translate(1280,605);
    glow(c,0,0,260,'#a000d0',.24);
    c.fillStyle='#050819';c.beginPath();c.ellipse(0,32,190,155,0,0,TAU);c.fill();
    for(const [r,color,width] of [[181,'#243b6a',17],[165,'#0a1027',20],[145,'#3e2259',20],[124,'#090b24',17],[99,'#46265b',16],[76,'#7f248c',8]]){
      c.beginPath();c.arc(0,0,r,0,TAU);c.strokeStyle=color;c.lineWidth=width;c.stroke();
    }
    for(let i=0;i<16;i++){
      const a=i*TAU/16+.05;
      c.strokeStyle=i%2?'#00dfff':'#ff1da0';c.shadowColor=c.strokeStyle;c.shadowBlur=16;c.lineWidth=6;
      c.beginPath();c.arc(0,0,177,a,a+.23);c.stroke();c.shadowBlur=0;
      c.save();c.rotate(a);c.fillStyle='#2c3d70';c.fillRect(132,-7,31,14);c.fillStyle='#0c1330';c.fillRect(139,-4,17,8);c.restore();
    }
    glow(c,0,0,130,'#ff00ef',.5);
    const bob=Math.sin(time*1.5)*5;c.translate(0,bob-15);
    const facets=[{p:[[0,-100],[-43,-35],[0,75]],c:'#a716da'},{p:[[0,-100],[43,-35],[0,75]],c:'#f733ef'},
      {p:[[0,-100],[0,75],[15,-12]],c:'#ff79ff'},{p:[[-43,-35],[-28,33],[0,75]],c:'#5b0dba'},
      {p:[[43,-35],[28,33],[0,75]],c:'#bc0ee8'}];
    for(const f of facets){poly(c,f.p);c.fillStyle=f.c;c.fill();c.strokeStyle='#ffbaff';c.lineWidth=1.6;c.shadowColor='#ff2cf7';c.shadowBlur=14;c.stroke();}
    c.restore();
  }
  pickup(c,p,time) {
    if(!p.active)return;
    const color=p.type==='HEAL'?'#36ffb0':p.type==='CHARGE'?'#ffca35':'#d333ff';
    c.save();c.translate(p.x,p.y+Math.sin(time*2+p.x)*5);glow(c,0,0,65,color,.22);
    c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=18;c.lineWidth=3;
    if(p.type==='HEAL'){c.beginPath();c.arc(0,0,36,0,TAU);c.stroke();line(c,[[-17,0],[17,0]],color,8,15);line(c,[[0,-17],[0,17]],color,8,15);}
    else{
      poly(c,Array.from({length:6},(_,i)=>[Math.cos(i*TAU/6+Math.PI/6)*39,Math.sin(i*TAU/6+Math.PI/6)*39]));c.stroke();
      c.fillStyle='#fff5b5';
      if(p.type==='CHARGE'){poly(c,[[0,-23],[-15,4],[-2,4],[-7,25],[17,-6],[3,-6],[10,-23]]);c.fill();}
      else for(let x=-15;x<=15;x+=15){c.fillStyle='#f3b8ff';poly(c,[[x-3,15],[x-3,-9],[x,-18],[x+3,-9],[x+3,15]]);c.fill();}
    }c.restore();
  }
  fighter(c,p,v,players,local,time,leader) {
    if(!p.alive)return;
    const color=fighterColor(p,players);
    c.save();c.lineCap='round';
    for(let i=v.trail.length-1;i>=0;i--){
      const t=v.trail[i];c.globalAlpha=Math.max(0,t.life)*1.1;
      glow(c,t.x,t.y,30,color,.35);c.fillStyle=color;c.beginPath();c.arc(t.x,t.y,Math.max(1,19*t.life/.28),0,TAU);c.fill();
    }
    c.globalAlpha=1;c.translate(v.x,v.y);
    c.fillStyle='rgba(2,6,18,0.52)';c.beginPath();c.ellipse(0,18,30,14,0,0,TAU);c.fill();
    glow(c,0,0,p.dashing?95:70,color,.46);
    const radius=32,body=c.createRadialGradient(-10,-12,0,0,0,radius);
    body.addColorStop(0,color);body.addColorStop(.22,color+'88');body.addColorStop(.55,'#051223');body.addColorStop(.86,'#03101d');body.addColorStop(1,color);
    c.fillStyle=body;c.beginPath();c.arc(0,0,radius,0,TAU);c.fill();c.strokeStyle=color;c.shadowBlur=18;c.shadowColor=color;c.lineWidth=3;c.stroke();
    c.strokeStyle='#d9ffff';c.lineWidth=2;c.beginPath();c.arc(0,0,radius-2,-2.7,-1.1);c.stroke();
    // Slanted luminous eyes, matching the expressive energy-orb fighters.
    const lookX=Math.cos(p.aim)*4,lookY=Math.sin(p.aim)*3;
    c.fillStyle='#edffff';c.shadowColor=color;c.shadowBlur=12;
    poly(c,[[-20+lookX,-5+lookY],[-5+lookX,3+lookY],[-8+lookX,10+lookY],[-15+lookX,8+lookY]]);c.fill();
    poly(c,[[20+lookX,-5+lookY],[5+lookX,3+lookY],[8+lookX,10+lookY],[15+lookX,8+lookY]]);c.fill();
    c.shadowBlur=0;
    if(p.protected||p.shield>0){
      c.strokeStyle=p.protected?'#ffffff':'#55dfff';c.lineWidth=2;c.setLineDash(p.protected?[7,5]:[]);c.beginPath();c.arc(0,0,43,0,TAU);c.stroke();c.setLineDash([]);
    }
    if(local){c.strokeStyle='#ffffff88';c.lineWidth=1;c.beginPath();c.arc(0,0,38,.4,2.8);c.stroke();}
    c.rotate(p.aim);line(c,[[35,0],[45,0]],COLORS[p.team],4,7);c.rotate(-p.aim);
    c.textAlign='center';c.font=(local?'bold 25px':'600 21px')+' Arial';c.fillStyle='#f8faff';c.shadowColor='#000';c.shadowBlur=6;
    c.fillText(p.name,0,-65);
    if(leader){c.fillStyle='#ffd137';c.font='30px Arial';c.fillText('♛',0,-94);}
    c.shadowBlur=0;c.fillStyle='#020617';c.fillRect(-49,-53,98,12);c.strokeStyle=color;c.lineWidth=1;c.strokeRect(-49,-53,98,12);
    const hp=Math.max(0,p.health/115);c.fillStyle=hp<.35?'#ff844b':color;c.fillRect(-47,-51,94*hp,8);
    if(!p.connected){c.fillStyle='#ffc247';c.font='14px monospace';c.fillText('RECONNECTING',0,58);}
    c.restore();
  }
  projectile(c,b,age=0) {
    const x=b.x+b.vx*age,y=b.y+b.vy*age;
    c.save();c.translate(x,y);c.rotate(Math.atan2(b.vy,b.vx));
    if(b.vortex){
      glow(c,0,0,45,'#b14dff',.7);
      c.rotate((performance.now()/120)%TAU);
      c.strokeStyle='#00e5ff';c.lineWidth=2.2;
      for(let i=0;i<3;i++){
        c.rotate(TAU/3);
        c.beginPath();c.arc(0,0,13,-0.6,1.2);c.stroke();
      }
      c.fillStyle='#ffffff';c.beginPath();c.arc(0,0,5,0,TAU);c.fill();
    }else{
      glow(c,0,0,b.meteor?62:b.chain?38:25,b.color,.5);
      const g=c.createLinearGradient(-45,0,14,0);g.addColorStop(0,b.color+'00');g.addColorStop(.7,b.color);g.addColorStop(1,'#fff');
      c.fillStyle=g;c.beginPath();c.ellipse(-6,0,b.meteor?32:b.chain?26:22,b.radius,0,0,TAU);c.fill();
      c.fillStyle='#fff';c.beginPath();c.ellipse(4,0,7,b.radius*.45,0,0,TAU);c.fill();
    }
    c.restore();
  }
  effect(c,e) {
    c.save();const alpha=Math.max(0,Math.min(1,e.life*3));c.globalAlpha=alpha;
    if(e.type==='wave'){
      c.strokeStyle=e.color;c.lineWidth=5;c.shadowBlur=20;c.shadowColor=e.color;c.beginPath();c.arc(e.x,e.y,155*(1-e.life/.45),0,TAU);c.stroke();
    }else if(e.type==='chain_lightning'){
      c.strokeStyle=e.color||'#00e5ff';c.lineWidth=3.5;c.shadowBlur=16;c.shadowColor=e.color||'#00e5ff';
      c.beginPath();c.moveTo(e.x,e.y);
      const midX=(e.x+e.toX)/2+(Math.sin(e.life*40)*22);
      const midY=(e.y+e.toY)/2+(Math.cos(e.life*40)*22);
      c.lineTo(midX,midY);c.lineTo(e.toX,e.toY);
      c.stroke();
      c.strokeStyle='#ffffff';c.lineWidth=1.5;c.stroke();
    }else if(e.type==='text'){
      c.fillStyle=e.color;c.font='bold 22px Arial';c.textAlign='center';c.fillText(e.text,e.x,e.y-(1-e.life)*38);
    }else{
      const count=e.type==='explosion'?24:9;const travel=(1-e.life/(e.duration||.5));
      glow(c,e.x,e.y,(e.type==='explosion'?100:35)*alpha,'#ff9d00',.6);
      for(let i=0;i<count;i++){
        const a=i*TAU/count+(e.seed||0),length=(18+(i%5)*14)*travel*(e.type==='explosion'?2:1);
        line(c,[[e.x+Math.cos(a)*length,e.y+Math.sin(a)*length],[e.x+Math.cos(a)*(length+12*alpha),e.y+Math.sin(a)*(length+12*alpha)]],i%3?'#ffc72f':'#fff',2);
      }
    }c.restore();
  }

  _drawVolumetricSweeper(c, time) {
    const cx = 1280, cy = 605, len = 860;
    const beamAngles = [(time * 0.38) % TAU, (time * 0.38 + Math.PI) % TAU];
    for (const angle of beamAngles) {
      c.save();
      c.translate(cx, cy);
      c.rotate(angle);
      const grad = c.createRadialGradient(0, 0, 30, 0, 0, len);
      grad.addColorStop(0, 'rgba(215, 60, 255, 0.16)');
      grad.addColorStop(0.28, 'rgba(0, 223, 255, 0.08)');
      grad.addColorStop(0.7, 'rgba(0, 223, 255, 0.025)');
      grad.addColorStop(1, 'rgba(0, 223, 255, 0)');
      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, len, -0.16, 0.16);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  _drawNexusPulses(c, dt) {
    this.nexusPulseTimer = (this.nexusPulseTimer || 0) + dt;
    if (this.nexusPulseTimer >= 3.2) {
      this.nexusPulseTimer = 0;
      if (this.nexusPulses.length > 8) this.nexusPulses.shift();
      this.nexusPulses.push({ r: 180, maxR: 640, life: 2.2, maxLife: 2.2, color: '#00dfff' });
    }
    for (let i = this.nexusPulses.length - 1; i >= 0; i--) {
      const p = this.nexusPulses[i];
      p.life -= dt;
      p.r += 210 * dt;
      if (p.life <= 0 || p.r >= p.maxR) {
        this.nexusPulses.splice(i, 1);
        continue;
      }
      const alpha = (p.life / p.maxLife) * 0.45;
      c.save();
      c.strokeStyle = p.color;
      c.globalAlpha = alpha;
      c.lineWidth = 2.4;
      c.setLineDash([14, 8]);
      const hex = Array.from({ length: 6 }, (_, idx) => [
        1280 + Math.cos(idx * TAU / 6) * p.r,
        605 + Math.sin(idx * TAU / 6) * p.r
      ]);
      poly(c, hex);
      c.stroke();
      c.restore();
    }
  }

  _drawSteamVents(c, dt, time) {
    for (const v of this.steamVents) {
      v.timer += dt;
      if (v.timer >= 0.18) {
        v.timer = 0;
        const spread = (Math.random() - 0.5) * 0.4;
        const spd = 25 + Math.random() * 35;
        this.steamParticles.push({
          x: v.x,
          y: v.y,
          vx: Math.cos(v.angle + spread) * spd,
          vy: Math.sin(v.angle + spread) * spd,
          size: 8 + Math.random() * 8,
          growRate: 16,
          life: 1.1 + Math.random() * 0.4,
          maxLife: 1.4
        });
      }
    }
    for (let i = this.steamParticles.length - 1; i >= 0; i--) {
      const p = this.steamParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.steamParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.growRate * dt;
      const a = (p.life / p.maxLife) * 0.28;
      c.save();
      c.fillStyle = `rgba(160, 215, 255, ${a})`;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, TAU);
      c.fill();
      c.restore();
    }
  }

  _drawTacticalDeploymentZones(c, time) {
    const zones = [
      { x: 440, y: 1180, color: '#00dfff', label: 'BLUE SQUADRON' },
      { x: 1960, y: 180, color: '#ff174f', label: 'RED SQUADRON' }
    ];
    for (const z of zones) {
      c.save();
      c.translate(z.x, z.y);
      c.strokeStyle = z.color;
      c.globalAlpha = 0.35 + Math.sin(time * 2.5) * 0.12;
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(0, 0, 155, 0, TAU);
      c.stroke();
      c.lineWidth = 1.2;
      c.setLineDash([12, 10]);
      c.beginPath();
      c.arc(0, 0, 135, 0, TAU);
      c.stroke();
      c.setLineDash([]);

      // Rotating tactical chevron reticle
      c.rotate(time * 0.6);
      c.strokeStyle = z.color;
      c.lineWidth = 2.2;
      c.globalAlpha = 0.55;
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.moveTo(110, -8); c.lineTo(122, 0); c.lineTo(110, 8);
        c.stroke();
      }
      c.restore();
    }
  }

  _drawEmergencyStrobes(c, s, time) {
    if (!s) return;
    const isUrgent = (s.remainingMs > 0 && s.remainingMs <= 60000) || s.state === 'OVERTIME';
    if (!isUrgent) return;
    const flash = Math.sin(time * 8) > 0;
    const strobes = [[120, 100], [2280, 100], [120, 1250], [2280, 1250]];
    for (const [sx, sy] of strobes) {
      c.save();
      glow(c, sx, sy, flash ? 90 : 35, '#ff4400', flash ? 0.65 : 0.2);
      c.fillStyle = flash ? '#ffea00' : '#ff174f';
      c.beginPath();
      c.arc(sx, sy, 7, 0, TAU);
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.stroke();
      c.restore();
    }
  }

  _drawDashStreaks(c, dt) {
    for (let i = this.dashStreaks.length - 1; i >= 0; i--) {
      const d = this.dashStreaks[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.dashStreaks.splice(i, 1);
        continue;
      }
      const a = d.life / d.maxLife;
      c.save();
      c.strokeStyle = d.color;
      c.globalAlpha = a * 0.85;
      c.lineWidth = 3.5;
      c.shadowColor = d.color;
      c.shadowBlur = 14;
      poly(c, d.pts);
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.globalAlpha = a;
      c.stroke();
      c.restore();
    }
  }

  _drawFloorRipples(c, dt) {
    for (let i = this.floorRipples.length - 1; i >= 0; i--) {
      const r = this.floorRipples[i];
      r.life -= dt;
      r.radius += (r.maxRadius - r.radius) * dt * 4;
      if (r.life <= 0) {
        this.floorRipples.splice(i, 1);
        continue;
      }
      const a = r.life / r.maxLife;
      c.save();
      c.strokeStyle = r.color;
      c.globalAlpha = a * 0.42;
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(r.x, r.y, r.radius, 0, TAU);
      c.stroke();
      c.restore();
    }
  }

  _drawTacticalNexusCapture(c, s, time) {
    const nx = s?.nexus;
    if (!nx) return;
    const cx = 1280, cy = 605, r = 155;
    c.save();
    c.translate(cx, cy);

    // Holographic boundary perimeter
    c.strokeStyle = nx.state === 'CONTESTED' ? '#ffc247' : nx.overchargeTeam === 'BLUE' ? '#00e5ff' : nx.overchargeTeam === 'RED' ? '#ff174f' : 'rgba(0, 223, 255, 0.25)';
    c.lineWidth = 2.5;
    c.setLineDash([14, 8]);
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.stroke();
    c.setLineDash([]);

    // Capture Progress Fill Arc
    if (nx.control !== 0) {
      const pct = Math.abs(nx.control) / 100;
      const col = nx.control > 0 ? '#00e5ff' : '#ff174f';
      c.strokeStyle = col;
      c.lineWidth = 7;
      c.shadowColor = col;
      c.shadowBlur = 18;
      c.beginPath();
      c.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + pct * TAU * (nx.control > 0 ? 1 : -1), nx.control < 0);
      c.stroke();
      c.shadowBlur = 0;
    }

    // Overcharge Lightning Arcs
    if (nx.overchargeTeam) {
      const col = nx.overchargeTeam === 'BLUE' ? '#00e5ff' : '#ff174f';
      c.strokeStyle = col;
      c.lineWidth = 2.8;
      c.shadowColor = col;
      c.shadowBlur = 14;
      for (let i = 0; i < 4; i++) {
        const ang = (time * 3 + i * TAU / 4) % TAU;
        const pts = [[0, 0]];
        for (let k = 1; k < 5; k++) {
          const dist = (r * k) / 5;
          const jitter = (Math.sin(time * 20 + i * 10 + k) * 14);
          pts.push([Math.cos(ang) * dist - Math.sin(ang) * jitter, Math.sin(ang) * dist + Math.cos(ang) * jitter]);
        }
        pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
        poly(c, pts);
        c.stroke();
      }
      c.shadowBlur = 0;
    }

    // Status Label below Nexus
    c.font = 'bold 13px Orbitron, monospace';
    c.textAlign = 'center';
    c.fillStyle = nx.state === 'CONTESTED' ? '#ffc247' : nx.overchargeTeam ? (nx.overchargeTeam === 'BLUE' ? '#00e5ff' : '#ff174f') : '#8fa6cb';
    const label = nx.overchargeTeam ? `⚡ NEXUS OVERCHARGED: ${nx.overchargeTeam} ⚡` : nx.state === 'CONTESTED' ? '⚠️ NEXUS CONTESTED ⚠️' : nx.control !== 0 ? `${nx.control > 0 ? 'BLUE' : 'RED'} CAPTURING ${Math.round(Math.abs(nx.control))}%` : 'CENTRAL NEXUS / OBJECTIVE';
    c.fillText(label, 0, r + 26);
    c.restore();
  }

  _drawPings(c, dt, time) {
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i];
      p.life -= dt;
      if (p.life <= 0) { this.pings.splice(i, 1); continue; }
      const a = p.life / p.maxLife;
      const col = p.team === 'BLUE' ? '#00e5ff' : '#ff174f';
      c.save();
      c.translate(p.x, p.y);

      // Floor ripple rings
      for (let r = 0; r < 2; r++) {
        const ringR = ((1 - a) * 80 + r * 30) % 75;
        c.strokeStyle = col;
        c.lineWidth = 2.2;
        c.globalAlpha = a * (1 - ringR / 75);
        c.beginPath();
        c.arc(0, 0, ringR, 0, TAU);
        c.stroke();
      }

      // Vertical beacon pillar
      const grad = c.createLinearGradient(0, 0, 0, -110);
      grad.addColorStop(0, col + 'aa');
      grad.addColorStop(1, col + '00');
      c.fillStyle = grad;
      c.fillRect(-6, -110, 12, 110);

      // Beacon icon & label
      c.globalAlpha = Math.min(1, a * 1.5);
      c.fillStyle = '#01091a';
      c.strokeStyle = col;
      c.lineWidth = 1.2;
      const labelW = c.measureText(p.label).width + 18;
      c.fillRect(-labelW / 2, -135, labelW, 22);
      c.strokeRect(-labelW / 2, -135, labelW, 22);
      c.font = 'bold 11px Orbitron, monospace';
      c.textAlign = 'center';
      c.fillStyle = '#ffffff';
      c.fillText(p.label, 0, -120);

      c.restore();
    }
  }

  _drawCombatNumbers(c, dt) {
    for (let i = this.combatNumbers.length - 1; i >= 0; i--) {
      const cn = this.combatNumbers[i];
      cn.life -= dt;
      cn.y -= 42 * dt;
      if (cn.life <= 0) { this.combatNumbers.splice(i, 1); continue; }
      const a = cn.life / cn.maxLife;
      c.save();
      c.globalAlpha = a;
      c.font = '900 16px Orbitron, Arial';
      c.textAlign = 'center';
      c.fillStyle = '#020612';
      c.fillText(cn.text, cn.x + 1, cn.y + 1);
      c.fillStyle = cn.color;
      c.shadowColor = cn.color;
      c.shadowBlur = 8;
      c.fillText(cn.text, cn.x, cn.y);
      c.restore();
    }
  }

  _drawDamageArcs(c, dt, player) {
    if (!player) return;
    for (let i = this.damageArcs.length - 1; i >= 0; i--) {
      const da = this.damageArcs[i];
      da.life -= dt;
      if (da.life <= 0) { this.damageArcs.splice(i, 1); continue; }
      const a = da.life / da.maxLife;
      c.save();
      c.translate(player.x, player.y);
      c.strokeStyle = '#ff174f';
      c.lineWidth = 4;
      c.shadowColor = '#ff174f';
      c.shadowBlur = 12;
      c.globalAlpha = a * 0.9;
      c.beginPath();
      c.arc(0, 0, 56, da.angle - 0.35, da.angle + 0.35);
      c.stroke();
      c.restore();
    }
  }

  _drawHitmarkers(c, dt, mx, my) {
    c.save();
    c.translate(mx, my);
    c.strokeStyle = 'rgba(0, 229, 255, 0.7)';
    c.lineWidth = 1.4;
    const len = 7, gap = 5;
    line(c, [[-gap - len, 0], [-gap, 0]], 'rgba(0, 229, 255, 0.7)', 1.4);
    line(c, [[gap, 0], [gap + len, 0]], 'rgba(0, 229, 255, 0.7)', 1.4);
    line(c, [[0, -gap - len], [0, -gap]], 'rgba(0, 229, 255, 0.7)', 1.4);
    line(c, [[0, gap], [0, gap + len]], 'rgba(0, 229, 255, 0.7)', 1.4);

    for (let i = this.hitmarkers.length - 1; i >= 0; i--) {
      const hm = this.hitmarkers[i];
      hm.life -= dt;
      if (hm.life <= 0) { this.hitmarkers.splice(i, 1); continue; }
      const a = hm.life / hm.maxLife;
      const col = hm.fatal ? '#ff174f' : hm.shield ? '#00e5ff' : '#ffca34';
      const sz = 7 + (1 - a) * 4;
      c.strokeStyle = col;
      c.lineWidth = hm.fatal ? 3 : 2;
      c.globalAlpha = a;
      c.shadowColor = col;
      c.shadowBlur = hm.fatal ? 14 : 6;
      line(c, [[-sz, -sz], [-3, -3]], col, hm.fatal ? 3 : 2);
      line(c, [[sz, -sz], [3, -3]], col, hm.fatal ? 3 : 2);
      line(c, [[-sz, sz], [-3, 3]], col, hm.fatal ? 3 : 2);
      line(c, [[sz, sz], [3, 3]], col, hm.fatal ? 3 : 2);
    }
    c.restore();
  }

  _drawStreakBanners(c, dt, w, h) {
    for (let i = this.streakBanners.length - 1; i >= 0; i--) {
      const sb = this.streakBanners[i];
      sb.life -= dt;
      if (sb.life <= 0) { this.streakBanners.splice(i, 1); continue; }
      const a = Math.min(1, sb.life / sb.maxLife * 2);
      c.save();
      c.translate(w / 2, 115);
      const scale = Math.min(1.0, (1 - sb.life / sb.maxLife) * 6);
      c.scale(scale, scale);
      c.globalAlpha = a;

      const col = sb.team === 'BLUE' ? '#00e5ff' : '#ff174f';
      const cardW = 380, cardH = 50;
      const grad = c.createLinearGradient(-cardW / 2, 0, cardW / 2, 0);
      grad.addColorStop(0, 'rgba(2, 6, 20, 0)');
      grad.addColorStop(0.2, 'rgba(4, 14, 40, 0.95)');
      grad.addColorStop(0.8, 'rgba(4, 14, 40, 0.95)');
      grad.addColorStop(1, 'rgba(2, 6, 20, 0)');
      c.fillStyle = grad;
      c.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

      c.strokeStyle = col;
      c.lineWidth = 1.8;
      c.strokeRect(-cardW * 0.4, -cardH / 2, cardW * 0.8, cardH);

      c.font = '900 20px Orbitron, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = '#ffe600';
      c.shadowColor = '#ffe600';
      c.shadowBlur = 12;
      c.fillText(`⚡ ${sb.title}! ⚡`, 0, -4);
      c.shadowBlur = 0;

      c.font = '700 11px Rajdhani, monospace';
      c.fillStyle = col;
      c.fillText(`${sb.playerName.toUpperCase()} • ${sb.team} SQUADRON`, 0, 15);
      c.restore();
    }
  }

  _drawSpectatorOverlay(c, game, s) {
    const local = game._localPlayer();
    if (local?.alive || !playing(s?.state)) return;
    const spectated = game._spectatedPlayer();
    if (!spectated) return;
    c.save();
    c.translate(game.canvas.width / 2, game.canvas.height - 75);
    c.fillStyle = 'rgba(2, 6, 22, 0.88)';
    c.fillRect(-220, -18, 440, 36);
    c.strokeStyle = COLORS[spectated.team] || '#00e5ff';
    c.lineWidth = 1.4;
    c.strokeRect(-220, -18, 440, 36);

    c.font = '800 13px Orbitron, sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#ffffff';
    c.fillText(`🔴 SPECTATING: ${spectated.name.toUpperCase()} [${WEAPONS[spectated.weapon] || 'Pulse Pistol'}]`, 0, -1);
    c.font = '700 11px Rajdhani, monospace';
    c.fillStyle = '#ffc247';
    c.fillText(`HP ${Math.ceil(spectated.health)}/115  •  [SPACE] NEXT ALLY`, 0, 13);
    c.restore();
  }

  draw(c, game) {
    const time = performance.now() / 1000;
    const dt = Math.min(0.05, Math.max(0.001, time - (this.lastTime || time)));
    this.lastTime = time;
    const camera = game._camera(), s = game.snapshot;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#020510';
    c.fillRect(0, 0, game.canvas.width, game.canvas.height);

    c.save();
    c.translate(game.canvas.width / 2, game.canvas.height / 2);
    c.scale(camera.zoom, camera.zoom);
    c.translate(-camera.x, -camera.y);

    // 1. Static Floor Plates, Walls & Landmarks
    c.drawImage(this.floor, 0, 0);

    // 2. Persistent Ground Scorch Marks
    for (let i = this.scorchMarks.length - 1; i >= 0; i--) {
      const sm = this.scorchMarks[i];
      sm.life -= dt;
      if (sm.life <= 0) { this.scorchMarks.splice(i, 1); continue; }
      const a = sm.life / sm.maxLife;
      c.save();
      c.fillStyle = `rgba(3, 6, 16, ${a * 0.75})`;
      c.beginPath();
      c.arc(sm.x, sm.y, sm.radius, 0, TAU);
      c.fill();
      c.strokeStyle = sm.color;
      c.globalAlpha = a * 0.45;
      c.lineWidth = 1.6;
      c.stroke();
      c.restore();
    }

    // 3. Reactive Floor Footstep Ripples
    this._drawFloorRipples(c, dt);

    // 4. Tactical Deployment Range Rings
    this._drawTacticalDeploymentZones(c, time);

    // 5. Dual Volumetric Sweeping Atmospheric Searchlights
    this._drawVolumetricSweeper(c, time);

    // 6. Radiating Plasma Hex Resonance Waves from Central Nexus
    this._drawNexusPulses(c, dt);

    // 7. Industrial Steam Exhaust Vents
    this._drawSteamVents(c, dt, time);

    // 8. Ionized Electric Dash Streaks
    this._drawDashStreaks(c, dt);

    // 9. Emergency Climax Strobes (<=60s or Overtime)
    this._drawEmergencyStrobes(c, s, time);

    // 9.5 Tactical Floor Pings
    this._drawPings(c, dt, time);

    // 10. Atmospheric Floating Cyber Motes
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.x = (m.x + m.vx * dt + ARENA.width) % ARENA.width;
      m.y = (m.y + m.vy * dt + ARENA.height) % ARENA.height;
      c.fillStyle = m.color;
      c.globalAlpha = 0.35 + Math.sin(time * 2 + i) * 0.15;
      c.beginPath();
      c.arc(m.x, m.y, m.size, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1.0;

    // 10.5 Central Nexus Tactical Capture Zone
    this._drawTacticalNexusCapture(c, s, time);

    // 11. Central Crystal Nexus
    this.nexus(c, time);

    // 12. Pickups
    for (const p of s?.pickups || []) this.pickup(c, p, time);

    // 13. Projectiles
    for (const b of s?.projectiles || []) this.projectile(c, b, Math.min(0.066, (performance.now() - (game.snapshotAt || 0)) / 1000));

    // 14. Fighters & Kinetic Footstep / Dash Trackers
    const players = s?.players || [];
    const leader = [...players].sort((a, b) => b.kills - a.kills).find(p => p.kills > 0)?.id;
    for (const p of players) {
      const v = game.visualPlayers.get(p.id);
      if (!v) continue;

      // Track movement for floor ripples and dashes
      const last = this.lastFighterPos.get(p.id);
      if (last && p.alive) {
        const moveDist = Math.hypot(v.x - last.x, v.y - last.y);
        if (p.dashing && !last.dashing) {
          this.addDashStreak(last.x, last.y, v.x, v.y, fighterColor(p, players));
        }
        if (moveDist > 22) {
          this.addFloorRipple(v.x, v.y, fighterColor(p, players));
          this.lastFighterPos.set(p.id, { x: v.x, y: v.y, dashing: p.dashing });
        }
      } else {
        this.lastFighterPos.set(p.id, { x: v.x, y: v.y, dashing: p.dashing });
      }

      this.fighter(c, p, v, players, p.id === game.playerId, time, p.id === leader);
    }

    // 14.5 Directional Damage Arcs around local player
    const localFighter = game.predicted || game._localPlayer();
    if (localFighter) this._drawDamageArcs(c, dt, localFighter);

    // 14.8 Floating Combat Text
    this._drawCombatNumbers(c, dt);

    // 15. Effects & Scorch Generation
    for (const e of game.effects) {
      if (e.type === 'explosion' && e.life > 0.48) {
        this.addScorch(e.x, e.y, 36, '#ffaa00');
        this.addFloorRipple(e.x, e.y, '#ffaa00');
      }
      this.effect(c, e);
    }

    c.restore();

    // ---- Screen Space Overlays (Crosshair, Hitmarkers, Tournament Streak Banners, Spectator) ----
    if (game.mouse && !game.menuOpen) {
      this._drawHitmarkers(c, dt, game.mouse.x, game.mouse.y);
    }
    this._drawStreakBanners(c, dt, game.canvas.width, game.canvas.height);
    this._drawSpectatorOverlay(c, game, s);
  }
}
