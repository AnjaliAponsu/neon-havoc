import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { ARENA, WALLS, SPAWNS, PICKUPS, COLORS, clamp, blocked, moveBody, moveInput, lineClear } from '../src/battleground/arena.js';

export const WEAPONS = {
  pulse_pistol_mk1: { name:'Pulse Pistol', damage:12, rate:5, speed:900, range:1000, radius:5, magazine:24, reload:1250 },
  arc_smg: { name:'Arc SMG', damage:7, rate:10, speed:860, range:700, radius:4, magazine:36, reload:1500, spread:.07 },
  prism_rifle: { name:'Prism Rifle', damage:18, rate:3.4, speed:1100, range:1150, radius:5, magazine:18, reload:1400 },
  nova_shotgun: { name:'Nova Shotgun', damage:8, rate:1.35, speed:800, range:460, radius:5, magazine:8, reload:1800, pellets:6, spread:.28 },
  rail_lance: { name:'Rail Lance', damage:38, rate:.85, speed:1600, range:1600, radius:5, magazine:6, reload:1800, pierce:2 },
  plasma_cannon: { name:'Plasma Cannon', damage:28, rate:1.05, speed:560, range:1000, radius:11, magazine:8, reload:1800, splash:100 },
  tesla_carbine: { name:'Tesla Carbine', damage:10, rate:6.5, speed:980, range:850, radius:5, magazine:28, reload:1400, chain:130 },
  vortex_launcher: { name:'Vortex Launcher', damage:32, rate:0.9, speed:620, range:950, radius:12, magazine:5, reload:1900, vortex:140, splash:110 },
};
const weaponValid = (id) => Object.hasOwn(WEAPONS, id);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const cleanName = (s) => typeof s === 'string' ? s.replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,16) || 'Pilot' : 'Pilot';
const zero = () => ({mx:0,my:0,aim:0,fire:false});
const playing = (room) => room.state === 'ACTIVE' || room.state === 'OVERTIME';
const connected = (p) => p.isBot || p.socket?.readyState === WebSocket.OPEN;

export function createRoom(code, isPublic = false, time = Date.now()) {
  return { code, isPublic, hostId:null, state:'LOBBY', createdAt:time, clock:time, round:1,
    players:new Map(), projectiles:[], events:[], nextId:1, tick:0, score:{BLUE:0,RED:0},
    winner:null, endedAt:0, countdownEndsAt:0, lobbyDeadline:0, endsAt:0, overtimeEndsAt:0,
    pickups:PICKUPS.map(p=>({...p,active:true,respawnAt:0})),
    nexus:{
      x:1280, y:605, radius:155, control:0, state:'NEUTRAL',
      overchargeTeam:null, overchargeUntil:0, cooldownUntil:0
    }
  };
}
function spawn(room, p) {
  const enemies = [...room.players.values()].filter(e=>e.team!==p.team&&e.alive);
  const allies = [...room.players.values()].filter(e=>e!==p&&e.team===p.team&&e.alive);
  const points = [...SPAWNS[p.team]].sort((a,b)=> {
    const score = (s) => Math.min(2000,...enemies.map(e=>distance(s,e)-(lineClear(s,e)?500:0)))
      - allies.reduce((v,e)=>v+(distance(s,e)<90?1200:0),0);
    return score(b)-score(a);
  });
  Object.assign(p,points[0],{health:115,shield:0,alive:true,respawnAt:0,protectedUntil:room.clock+2000,
    ammo:WEAPONS[p.weapon].magazine,reloadUntil:0,dashUntil:0,vx:0,vy:0,input:zero(),pending:[],
    streak:0,multiKills:0,overchargedUntil:0});
  p.damageBy.clear();
}
function addPlayer(room, id, socket, data) {
  const blue=[...room.players.values()].filter(p=>p.team==='BLUE').length;
  const red=room.players.size-blue;
  const team=data.team&&['BLUE','RED'].includes(data.team)?data.team:(blue<=red?'BLUE':'RED');
  const weapon=weaponValid(data.weapon)?data.weapon:'pulse_pistol_mk1';
  const isBot=!!data.isBot;
  const p={id,name:cleanName(data.name),team,weapon,socket,token:randomBytes(24).toString('hex'),
    isBot,ready:isBot?true:false,health:115,maxHealth:115,shield:0,alive:true,aim:team==='BLUE'?0:Math.PI,
    kills:0,deaths:0,assists:0,damage:0,score:0,ultimate:0,damageBy:new Map(),input:zero(),pending:[],
    lastInputAt:room.clock,lastSeq:0,ack:0,lastChatAt:0,disconnectedAt:0,ping:isBot?8:0,
    lastShotAt:0,dashReadyAt:0,aegisReadyAt:0,waveReadyAt:0,shieldUntil:0,
    streak:0,multiKills:0,lastKillAt:0,overchargedUntil:0};
  room.players.set(id,p); if(!room.hostId) room.hostId=id;
  spawn(room,p); return p;
}
function event(room,type,data={}) {
  room.events.push({type,data,at:room.clock});
  if(room.events.length>256) room.events.shift();
}
function end(room,winner) {
  if(room.state==='ENDED') return;
  room.state='ENDED';room.endedAt=room.clock;room.winner=winner;
  event(room,'MATCH_ENDED',{winner,score:{...room.score}});
}
export function damage(room,target,attacker,amount,weapon=attacker.weapon) {
  if(!playing(room)||!target.alive||target.team===attacker.team||target.protectedUntil>room.clock) return;
  const absorbed=Math.min(target.shield,amount);target.shield-=absorbed;
  const dealt=Math.min(target.health,amount-absorbed);target.health-=dealt;
  attacker.damage+=dealt;attacker.ultimate=clamp(attacker.ultimate+dealt*.12,0,100);
  if(dealt+absorbed>0) target.damageBy.set(attacker.id,room.clock);
  event(room,'HIT',{targetId:target.id,attackerId:attacker.id,x:target.x,y:target.y,amount:Math.round(dealt+absorbed),shield:absorbed>0,fatal:target.health<=0});
  if(target.health>0) return;
  target.alive=false;target.deaths++;target.respawnAt=room.clock+4000;target.pending=[];target.input=zero();

  const prevStreak = target.streak || 0;
  target.streak = 0;

  attacker.kills++;attacker.score+=100;room.score[attacker.team]++;
  attacker.streak = (attacker.streak || 0) + 1;

  if (!attacker.lastKillAt || room.clock - attacker.lastKillAt > 4500) {
    attacker.multiKills = 1;
  } else {
    attacker.multiKills = (attacker.multiKills || 1) + 1;
  }
  attacker.lastKillAt = room.clock;

  let streakTitle = null;
  if (attacker.streak === 3) streakTitle = 'KILLING SPREE';
  else if (attacker.streak === 5) streakTitle = 'RAMPAGE';
  else if (attacker.streak === 7) streakTitle = 'DOMINATING';
  else if (attacker.streak === 10) streakTitle = 'UNSTOPPABLE';
  else if (attacker.streak >= 15 && attacker.streak % 5 === 0) streakTitle = 'GODLIKE';

  let multiKillTitle = null;
  if (attacker.multiKills === 2) { multiKillTitle = 'DOUBLE KILL'; attacker.score += 50; }
  else if (attacker.multiKills === 3) { multiKillTitle = 'TRIPLE KILL'; attacker.score += 100; }
  else if (attacker.multiKills === 4) { multiKillTitle = 'QUADRA KILL'; attacker.score += 150; }
  else if (attacker.multiKills >= 5) { multiKillTitle = 'ACE'; attacker.score += 250; }

  if (streakTitle) {
    event(room, 'STREAK', { playerId: attacker.id, playerName: attacker.name, team: attacker.team, streak: attacker.streak, title: streakTitle });
  }
  if (multiKillTitle) {
    event(room, 'MULTIKILL', { playerId: attacker.id, playerName: attacker.name, team: attacker.team, multiKills: attacker.multiKills, title: multiKillTitle });
  }
  if (prevStreak >= 3) {
    const bounty = prevStreak * 50;
    attacker.score += bounty;
    event(room, 'SHUTDOWN', { killerId: attacker.id, killerName: attacker.name, victimId: target.id, victimName: target.name, bounty, team: attacker.team });
  }

  for(const [id,at] of target.damageBy) {
    const p=room.players.get(id);
    if(p&&p!==attacker&&p.team===attacker.team&&room.clock-at<=8000){p.assists++;p.score+=40;}
  }
  event(room,'ELIMINATION',{killer:attacker.name,victim:target.name,killerId:attacker.id,victimId:target.id,
    x:target.x,y:target.y,weapon:WEAPONS[weapon]?.name||'Meteor',team:attacker.team,streak:attacker.streak});
  if(room.score[attacker.team]>=40||room.state==='OVERTIME') end(room,attacker.team);
}
function shot(room,p,meteor=false) {
  const w=meteor?{damage:65,speed:650,range:1100,radius:14,splash:150}:WEAPONS[p.weapon];
  if(!meteor&&(p.reloadUntil>room.clock||room.clock-p.lastShotAt<1000/w.rate))return;
  if(!meteor&&p.ammo<=0){p.reloadUntil=room.clock+w.reload;return;}
  if(!meteor){p.lastShotAt=room.clock;p.ammo--;}
  p.protectedUntil=0;
  for(let n=0;n<(w.pellets||1);n++) {
    const angle=p.aim+(w.pellets?(n/(w.pellets-1)-.5)*2*(w.spread||0):(Math.random()-.5)*(w.spread||0));
    room.projectiles.push({id:room.nextId++,ownerId:p.id,team:p.team,x:p.x,y:p.y,
      vx:Math.cos(angle)*w.speed,vy:Math.sin(angle)*w.speed,radius:w.radius,remaining:w.range,
      damage:w.damage,pierce:w.pierce||1,splash:w.splash||0,chain:w.chain||0,vortex:w.vortex||0,
      hit:new Set(),meteor,weapon:meteor?'meteor':p.weapon,
      color:meteor?'#ffc247':p.weapon==='tesla_carbine'?'#00e5ff':p.weapon==='vortex_launcher'?'#b14dff':p.team==='BLUE'?'#ffbc45':'#ff40dd'});
  }
  event(room,'SHOT',{playerId:p.id,x:p.x,y:p.y,aim:p.aim,team:p.team,meteor,weapon:meteor?'meteor':p.weapon});
}
function ability(room,p,type) {
  if(!playing(room)||!p.alive)return;
  if(type==='dash'&&p.dashReadyAt<=room.clock){
    const moving=Math.hypot(p.input.mx,p.input.my)>.01;
    const a=moving?Math.atan2(p.input.my,p.input.mx):p.aim;
    p.dashX=Math.cos(a);p.dashY=Math.sin(a);p.dashUntil=room.clock+180;p.dashReadyAt=room.clock+5000;
  } else if(type==='aegis'&&p.aegisReadyAt<=room.clock){
    p.shield=45;p.shieldUntil=room.clock+2500;p.aegisReadyAt=room.clock+12000;
  } else if(type==='wave'&&p.waveReadyAt<=room.clock){
    p.waveReadyAt=room.clock+10000;
    for(const target of room.players.values()) if(target.team!==p.team&&target.alive&&distance(target,p)<155&&lineClear(p,target)){
      damage(room,target,p,18);const a=Math.atan2(target.y-p.y,target.x-p.x);moveBody(target,Math.cos(a)*65,Math.sin(a)*65);
    }
  } else if(type==='ultimate'&&p.ultimate>=100){
    p.ultimate=0;shot(room,p,true);
  } else return;
  event(room,'ABILITY',{playerId:p.id,ability:type,x:p.x,y:p.y,team:p.team});
}
function splash(room,b,owner) {
  for(const target of room.players.values()){
    const d=distance(target,b);
    if(target.alive&&target.team!==b.team&&d<b.splash&&lineClear(b,target))
      damage(room,target,owner,b.damage*Math.max(.35,1-d/b.splash),b.weapon);
  }
  event(room,'EXPLOSION',{x:b.x,y:b.y,radius:b.splash,team:b.team});
}
function bullets(room,dt) {
  for(let i=room.projectiles.length-1;i>=0;i--){
    const b=room.projectiles[i],owner=room.players.get(b.ownerId);
    if(!owner){room.projectiles.splice(i,1);continue;}
    const length=Math.hypot(b.vx,b.vy)*dt,steps=Math.max(1,Math.ceil(length/4));
    let removed=false;
    for(let s=0;s<steps&&!removed;s++){
      const x=b.x+b.vx*dt/steps,y=b.y+b.vy*dt/steps;b.remaining-=length/steps;
      if(blocked(x,y,b.radius)||b.remaining<=0){
        if(b.splash)splash(room,b,owner);
        if(b.vortex){
          for(const target of room.players.values()){
            if(target.alive&&target.team!==b.team&&distance(b,target)<b.vortex){
              const a=Math.atan2(b.y-target.y,b.x-target.x);
              moveBody(target,Math.cos(a)*55,Math.sin(a)*55);
            }
          }
        }
        event(room,'IMPACT',{x:b.x,y:b.y,team:b.team});removed=true;break;
      }
      b.x=x;b.y=y;
      for(const target of room.players.values()){
        if(!target.alive||target.team===b.team||b.hit.has(target.id)||distance(target,b)>ARENA.radius+b.radius)continue;
        b.hit.add(target.id);
        if(b.splash)splash(room,b,owner);else damage(room,target,owner,b.damage,b.weapon);
        if(b.chain){
          for(const other of room.players.values()){
            if(other.alive&&other.team!==owner.team&&other.id!==target.id&&distance(target,other)<=b.chain&&lineClear(target,other)){
              damage(room,other,owner,Math.round(b.damage*0.65),b.weapon);
              event(room,'CHAIN_LIGHTNING',{fromX:target.x,fromY:target.y,toX:other.x,toY:other.y,team:owner.team});
              break;
            }
          }
        }
        if(b.vortex){
          for(const other of room.players.values()){
            if(other.alive&&other.team!==b.team&&distance(b,other)<b.vortex){
              const a=Math.atan2(b.y-other.y,b.x-other.x);
              moveBody(other,Math.cos(a)*55,Math.sin(a)*55);
            }
          }
        }
        if(--b.pierce<=0){removed=true;break;}
      }
    }
    if(removed)room.projectiles.splice(i,1);
    if(!playing(room))break;
  }
}
function resetRound(room) {
  room.round++;room.score={BLUE:0,RED:0};room.winner=null;room.endedAt=0;room.state='LOBBY';
  room.lobbyDeadline=0;room.projectiles=[];
  room.pickups=PICKUPS.map(p=>({...p,active:true,respawnAt:0}));
  if (room.nexus) {
    room.nexus.control = 0; room.nexus.state = 'NEUTRAL';
    room.nexus.overchargeTeam = null; room.nexus.overchargeUntil = 0; room.nexus.cooldownUntil = 0;
  }
  for(const p of room.players.values()){
    Object.assign(p,{ready:p.isBot?true:false,kills:0,deaths:0,assists:0,damage:0,score:0,ultimate:0,
      dashReadyAt:0,aegisReadyAt:0,waveReadyAt:0,lastShotAt:0,streak:0,multiKills:0,overchargedUntil:0});spawn(room,p);
  }
}
export function simulate(room,dt,time=Date.now()) {
  room.clock=time;room.tick++;
  const live=[...room.players.values()].filter(connected);
  const both=live.some(p=>p.team==='BLUE')&&live.some(p=>p.team==='RED');
  if(room.state==='LOBBY'){
    if(!both){room.lobbyDeadline=0;return;}
    if(!room.lobbyDeadline)room.lobbyDeadline=time+60000;
    if(live.every(p=>p.ready)||time>=room.lobbyDeadline){room.state='COUNTDOWN';room.countdownEndsAt=time+10000;}
    return;
  }
  if(room.state==='COUNTDOWN'){
    if(!both){room.state='LOBBY';room.lobbyDeadline=0;return;}
    if(time<room.countdownEndsAt)return;
    for(const p of room.players.values())spawn(room,p);
    room.state='ACTIVE';room.startedAt=time;room.endsAt=time+360000;event(room,'MATCH_STARTED');
  }
  if(!playing(room))return;

  // Central Nexus Tactical Objective Simulation
  if(room.nexus){
    const nx=room.nexus;
    if(nx.overchargeUntil&&time>=nx.overchargeUntil){
      nx.overchargeTeam=null;nx.state='NEUTRAL';
    }
    const insideBlue=[...room.players.values()].filter(p=>p.alive&&p.team==='BLUE'&&distance(p,nx)<nx.radius).length;
    const insideRed=[...room.players.values()].filter(p=>p.alive&&p.team==='RED'&&distance(p,nx)<nx.radius).length;

    if(insideBlue>0&&insideRed>0){
      nx.state='CONTESTED';
    }else if(insideBlue>0&&time>=nx.cooldownUntil){
      nx.state='CAPTURING';
      nx.control=Math.min(100,nx.control+dt*28);
      if(nx.control>=100&&nx.overchargeTeam!=='BLUE'){
        nx.control=100;nx.overchargeTeam='BLUE';nx.overchargeUntil=time+14000;nx.cooldownUntil=time+36000;
        room.score.BLUE+=2;
        for(const p of room.players.values()){
          if(p.team==='BLUE'&&p.alive){
            p.shield=Math.min(65,(p.shield||0)+35);
            p.overchargedUntil=time+14000;
          }
        }
        event(room,'NEXUS_OVERCHARGED',{team:'BLUE',score:{...room.score}});
      }
    }else if(insideRed>0&&time>=nx.cooldownUntil){
      nx.state='CAPTURING';
      nx.control=Math.max(-100,nx.control-dt*28);
      if(nx.control<=-100&&nx.overchargeTeam!=='RED'){
        nx.control=-100;nx.overchargeTeam='RED';nx.overchargeUntil=time+14000;nx.cooldownUntil=time+36000;
        room.score.RED+=2;
        for(const p of room.players.values()){
          if(p.team==='RED'&&p.alive){
            p.shield=Math.min(65,(p.shield||0)+35);
            p.overchargedUntil=time+14000;
          }
        }
        event(room,'NEXUS_OVERCHARGED',{team:'RED',score:{...room.score}});
      }
    }else if(time>=nx.cooldownUntil){
      if(nx.control>0)nx.control=Math.max(0,nx.control-dt*10);
      else if(nx.control<0)nx.control=Math.min(0,nx.control+dt*10);
      nx.state=nx.control===0?'NEUTRAL':'CAPTURING';
    }
  }

  for(const p of room.players.values()){
    if(!connected(p))continue;
    if(!p.alive){if(time>=p.respawnAt)spawn(room,p);else continue;}
    if(p.shieldUntil<=time&&(!p.overchargedUntil||time>=p.overchargedUntil))p.shield=0;
    if(p.reloadUntil&&p.reloadUntil<=time){p.ammo=WEAPONS[p.weapon].magazine;p.reloadUntil=0;}
    const speedMult=p.overchargedUntil>time?1.20:1.0;

    if(p.isBot){
      p.lastInputAt=time;
      const enemies=[...room.players.values()].filter(e=>e.team!==p.team&&e.alive);
      const lowHealth=p.health<65;

      // Smart Heal Pickup Seeking
      let targetGoal=null;
      if(lowHealth){
        const heals=room.pickups.filter(pk=>pk.active&&pk.type==='HEAL');
        if(heals.length>0)targetGoal=heals.sort((a,b)=>distance(p,a)-distance(p,b))[0];
      }

      // Reflexive projectile / meteor dodge dash
      const threat=room.projectiles.find(b=>b.team!==p.team&&distance(p,b)<130);
      if(threat&&p.dashReadyAt<=time){
        const awayAngle=Math.atan2(p.y-threat.y,p.x-threat.x);
        p.dashX=Math.cos(awayAngle);p.dashY=Math.sin(awayAngle);
        p.dashUntil=time+180;p.dashReadyAt=time+5000;
        event(room,'ABILITY',{playerId:p.id,ability:'dash',x:p.x,y:p.y,team:p.team});
      }

      if(enemies.length>0){
        let bestEnemy=null,bestDist=Infinity;
        for(const e of enemies){
          const d=distance(p,e);
          const clear=lineClear(p,e);
          const score=d-(clear?250:0);
          if(score<bestDist){bestDist=score;bestEnemy=e;}
        }
        if(bestEnemy){
          const d=distance(p,bestEnemy);
          const w=WEAPONS[p.weapon]||WEAPONS.pulse_pistol_mk1;
          const leadTime=d/(w.speed||900);
          const leadX=bestEnemy.x+(bestEnemy.vx||0)*leadTime*0.7;
          const leadY=bestEnemy.y+(bestEnemy.vy||0)*leadTime*0.7;
          const angle=Math.atan2(leadY-p.y,leadX-p.x);
          p.aim=angle;

          let mx=0,my=0;
          if(targetGoal){
            const toGoal=Math.atan2(targetGoal.y-p.y,targetGoal.x-p.x);
            mx=Math.cos(toGoal);my=Math.sin(toGoal);
          }else{
            const preferredRange=p.weapon==='rail_lance'?520:p.weapon==='nova_shotgun'?140:280;
            if(d>preferredRange+80){
              mx=Math.cos(angle);my=Math.sin(angle);
            }else if(d<preferredRange-60){
              const strafe=Math.sin(time*0.003+p.id.length)*0.7;
              mx=-Math.cos(angle)*0.7-Math.sin(angle)*strafe;
              my=-Math.sin(angle)*0.7+Math.cos(angle)*strafe;
            }else{
              const strafeDir=(p.id.charCodeAt(p.id.length-1)%2===0?1:-1);
              mx=-Math.sin(angle)*strafeDir*0.85+Math.cos(angle)*0.15;
              my=Math.cos(angle)*strafeDir*0.85+Math.sin(angle)*0.15;
            }
          }
          p.input={mx,my,aim:p.aim,fire:false};
          const clear=lineClear(p,bestEnemy);
          if(clear&&d<550){
            if(p.ammo<=0&&!p.reloadUntil){p.reloadUntil=time+w.reload;}
            else if(p.ammo>0&&!p.reloadUntil){shot(room,p);}
            if(p.health<60&&p.aegisReadyAt<=time)ability(room,p,'aegis');
            if(d<160&&p.waveReadyAt<=time)ability(room,p,'wave');
            if(p.ultimate>=100&&d<420)ability(room,p,'ultimate');
          }
        }
      }else{
        const angle=Math.atan2(ARENA.height/2-p.y,ARENA.width/2-p.x);
        p.input={mx:Math.cos(angle)*0.5,my:Math.sin(angle)*0.5,aim:angle,fire:false};
      }
      const before={x:p.x,y:p.y};
      if(p.dashUntil>time)moveBody(p,p.dashX*190/.18*dt,p.dashY*190/.18*dt);
      else {
        const length=Math.max(1,Math.hypot(p.input.mx,p.input.my));
        moveBody(p,p.input.mx/length*ARENA.speed*dt*speedMult,p.input.my/length*ARENA.speed*dt*speedMult);
      }
      p.vx=(p.x-before.x)/dt;p.vy=(p.y-before.y)/dt;
      continue;
    }
    const command=p.pending.shift();
    if(command){p.input=command;p.aim=command.aim;p.ack=command.seq;if(command.ability)ability(room,p,command.ability);
      if(command.reload&&p.ammo<WEAPONS[p.weapon].magazine&&!p.reloadUntil)p.reloadUntil=time+WEAPONS[p.weapon].reload;}
    if(!playing(room))break;
    if(time-p.lastInputAt>250)p.input=zero();
    const before={x:p.x,y:p.y};
    if(p.dashUntil>time)moveBody(p,p.dashX*190/.18*dt,p.dashY*190/.18*dt);
    else {
      const length=Math.max(1,Math.hypot(p.input.mx,p.input.my));
      moveBody(p,p.input.mx/length*ARENA.speed*dt*speedMult,p.input.my/length*ARENA.speed*dt*speedMult);
    }
    p.vx=(p.x-before.x)/dt;p.vy=(p.y-before.y)/dt;
    if(p.input.fire)shot(room,p);
  }
  if(!playing(room))return;
  bullets(room,dt);
  for(const pickup of room.pickups){
    if(!pickup.active&&time>=pickup.respawnAt)pickup.active=true;
    if(!pickup.active)continue;
    for(const p of room.players.values()){
      if(!p.alive||!connected(p)||distance(p,pickup)>46)continue;
      if(pickup.type==='HEAL'){if(p.health>=115)continue;p.health=Math.min(115,p.health+45);}
      if(pickup.type==='CHARGE'){if(p.ultimate>=100)continue;p.ultimate=Math.min(100,p.ultimate+35);}
      if(pickup.type==='AMMO'){if(p.ammo===WEAPONS[p.weapon].magazine&&!p.reloadUntil)continue;p.ammo=WEAPONS[p.weapon].magazine;p.reloadUntil=0;}
      pickup.active=false;pickup.respawnAt=time+18000;event(room,'PICKUP',{player:p.name,playerId:p.id,pickup:pickup.type,team:p.team});break;
    }
  }
  if(room.state==='ACTIVE'&&time>=room.endsAt){
    if(room.score.BLUE===room.score.RED){room.state='OVERTIME';room.overtimeEndsAt=time+60000;event(room,'OVERTIME');}
    else end(room,room.score.BLUE>room.score.RED?'BLUE':'RED');
  } else if(room.state==='OVERTIME'&&time>=room.overtimeEndsAt)end(room,'DRAW');
}
export function snapshot(room) {
  const t=room.clock;
  return {type:'TDM_SNAPSHOT',roomCode:room.code,round:room.round,tick:room.tick,state:room.state,hostId:room.hostId,
    winner:room.winner,score:{...room.score},targetScore:40,world:ARENA,
    nexus:room.nexus?{control:Math.round(room.nexus.control),state:room.nexus.state,overchargeTeam:room.nexus.overchargeTeam,
      overchargeMs:Math.max(0,room.nexus.overchargeUntil-t),cooldownMs:Math.max(0,room.nexus.cooldownUntil-t)}:null,
    remainingMs:Math.max(0,(room.state==='COUNTDOWN'?room.countdownEndsAt:room.state==='ACTIVE'?room.endsAt:room.state==='OVERTIME'?room.overtimeEndsAt:room.lobbyDeadline)-t),
    players:[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,isBot:!!p.isBot,ready:p.ready,connected:connected(p),ping:p.ping,
      weapon:p.weapon,x:p.x,y:p.y,vx:p.vx,vy:p.vy,aim:p.aim,ack:p.ack,health:p.health,maxHealth:115,alive:p.alive,
      respawnMs:Math.max(0,p.respawnAt-t),protected:p.protectedUntil>t,shield:p.shield,ultimate:p.ultimate,
      kills:p.kills,deaths:p.deaths,assists:p.assists,damage:Math.round(p.damage),personalScore:p.score,ammo:p.ammo,magazine:WEAPONS[p.weapon].magazine,
      reloadMs:Math.max(0,p.reloadUntil-t),dashing:p.dashUntil>t,streak:p.streak||0,overcharged:p.overchargedUntil>t,
      cooldowns:{dash:Math.max(0,p.dashReadyAt-t),aegis:Math.max(0,p.aegisReadyAt-t),wave:Math.max(0,p.waveReadyAt-t)}})),
    projectiles:room.projectiles.map(b=>({id:b.id,ownerId:b.ownerId,x:b.x,y:b.y,vx:b.vx,vy:b.vy,radius:b.radius,color:b.color,team:b.team,meteor:b.meteor,chain:!!b.chain,vortex:!!b.vortex})),
    pickups:room.pickups.map(p=>({...p,respawnMs:Math.max(0,p.respawnAt-t)}))};
}
export function setupTeamDeathmatch(wss) {
  const rooms=new Map(),sessions=new Map();let id=0;
  const send=(ws,msg)=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<256000)ws.send(JSON.stringify(msg));};
  const error=(ws,message)=>send(ws,{type:'TDM_ERROR',message});
  function code(){let s;do{s=randomBytes(4).toString('hex').slice(0,5).toUpperCase();}while(rooms.has(s));return s;}
  function welcome(ws,room,p){sessions.set(ws,{room,player:p});send(ws,{type:'TDM_JOINED',playerId:p.id,team:p.team,roomCode:room.code,token:p.token});send(ws,snapshot(room));}
  wss.on('connection',ws=>{
    let count=0,windowStart=Date.now();
    ws.on('message',raw=>{
      if(raw.length>4096)return;
      let m;try{m=JSON.parse(raw.toString());}catch{return;}
      if(!m||typeof m.type!=='string'||!m.type.startsWith('TDM_'))return;
      const t=Date.now();if(t-windowStart>1000){windowStart=t;count=0;}if(++count>90)return;
      if(m.type==='TDM_RESUME'){
        if(sessions.has(ws))return error(ws,'Already in an arena.');
        const room=rooms.get(m.roomCode),p=room&&[...room.players.values()].find(p=>p.token===m.token);
        if(!p||!p.disconnectedAt||t-p.disconnectedAt>45000)return error(ws,'Your arena reservation expired. Join again.');
        p.socket=ws;p.disconnectedAt=0;p.pending=[];p.input=zero();welcome(ws,room,p);return;
      }
      if(['TDM_QUICK_MATCH','TDM_CREATE_ROOM','TDM_JOIN_ROOM','TDM_PRACTICE'].includes(m.type)){
        if(sessions.has(ws))return error(ws,'Already in an arena. Leave before joining another.');
        let room;
        if(m.type==='TDM_QUICK_MATCH')room=[...rooms.values()].find(r=>r.isPublic&&r.state!=='ENDED'&&r.players.size<8);
        if(m.type==='TDM_JOIN_ROOM'){
          room=rooms.get(String(m.roomCode||'').trim().toUpperCase());
          if(!room)return error(ws,'Room not found. Check the code and server address.');
        }
        if(!room){room=createRoom(code(),m.type==='TDM_QUICK_MATCH');rooms.set(room.code,room);}
        if(room.players.size>=8)return error(ws,'Arena full: four players per team.');
        if(room.state==='ENDED')return error(ws,'Match ended. Ask the host to start a rematch.');
        const p=addPlayer(room,`p${++id}`,ws,m);welcome(ws,room,p);event(room,'PLAYER_JOINED',{name:p.name,team:p.team});
        if(m.type==='TDM_PRACTICE'){
          const botNames=['Viper AI','Apex AI','Ghost AI','Titan AI','Raptor AI','Phantom AI','Specter AI'];
          const botWeapons=['pulse_pistol_mk1','arc_smg','prism_rifle','nova_shotgun','rail_lance'];
          let bIdx=0;
          while(room.players.size<8){
            const bot=addPlayer(room,`bot_${++id}`,null,{name:botNames[bIdx%botNames.length],weapon:botWeapons[bIdx%botWeapons.length],isBot:true});
            bIdx++;
            event(room,'PLAYER_JOINED',{name:bot.name,team:bot.team});
          }
        }
        return;
      }
      const session=sessions.get(ws);if(!session)return;
      const {room,player:p}=session;room.clock=t;
      if(m.type==='TDM_LEAVE'){
        room.players.delete(p.id);sessions.delete(ws);if(room.hostId===p.id)room.hostId=[...room.players.values()].find(connected)?.id||null;
        event(room,'PLAYER_LEFT',{name:p.name,team:p.team});return;
      }
      if(m.type==='TDM_READY'&&room.state==='LOBBY')p.ready=!!m.ready;
      if(m.type==='TDM_TEAM'&&room.state==='LOBBY'&&['BLUE','RED'].includes(m.team)&&m.team!==p.team){
        if([...room.players.values()].filter(e=>e.team===m.team).length>=4)return error(ws,'That team is full.');
        p.team=m.team;p.ready=false;spawn(room,p);
      }
      if(m.type==='TDM_FILL_BOTS'&&room.state==='LOBBY'){
        const botNames=['Viper AI','Apex AI','Ghost AI','Titan AI','Raptor AI','Phantom AI','Specter AI','Echo AI'];
        const botWeapons=['pulse_pistol_mk1','arc_smg','prism_rifle','nova_shotgun','rail_lance'];
        let bIdx=0;
        while(room.players.size<8){
          const bot=addPlayer(room,`bot_${++id}`,null,{name:botNames[bIdx%botNames.length],weapon:botWeapons[bIdx%botWeapons.length],isBot:true});
          bIdx++;
          event(room,'PLAYER_JOINED',{name:bot.name,team:bot.team});
        }
      }
      if(m.type==='TDM_LOADOUT'&&room.state==='LOBBY'&&weaponValid(m.weapon)){p.weapon=m.weapon;p.ammo=WEAPONS[m.weapon].magazine;p.ready=false;}
      if(m.type==='TDM_REMATCH'&&room.state==='ENDED'){
        if(room.hostId!==p.id)return error(ws,'Only the room host can start the rematch.');
        resetRound(room);
      }
      if(m.type==='TDM_INPUT'&&playing(room)){
        if(!Number.isSafeInteger(m.seq)||m.seq<=p.lastSeq||!Number.isFinite(m.mx)||!Number.isFinite(m.my)||!Number.isFinite(m.aim))return;
        p.lastSeq=m.seq;p.lastInputAt=t;
        if(p.pending.length>=3)p.pending.shift();
        p.pending.push({seq:m.seq,mx:clamp(m.mx,-1,1),my:clamp(m.my,-1,1),aim:m.aim%(Math.PI*2),
          fire:m.fire===true,reload:m.reload===true,ability:['dash','aegis','wave','ultimate'].includes(m.ability)?m.ability:null});
      }
      if(m.type==='TDM_PING')send(ws,{type:'TDM_PONG',time:m.time});
      if(m.type==='TDM_LATENCY'&&Number.isFinite(m.ping))p.ping=clamp(Math.round(m.ping),0,5000);
      if(m.type==='TDM_PING_BEACON'&&playing(room)){
        if(t - (p.lastPingBeaconAt||0) >= 1200){
          p.lastPingBeaconAt = t;
          for(const target of room.players.values()){
            if(target.team === p.team)
              send(target.socket, { type:'TDM_EVENT', event:{ type:'TACTICAL_PING', data:{ x:m.x, y:m.y, playerId:p.id, playerName:p.name, team:p.team, pingType:m.pingType||'alert' }}});
          }
        }
      }
      if(m.type==='TDM_CHAT'&&t-p.lastChatAt>=700){
        if(typeof m.message!=='string')return;const message=m.message.replace(/[\x00-\x1f]/g,'').trim().slice(0,120);if(!message)return;
        p.lastChatAt=t;const channel=m.channel==='TEAM'?'TEAM':'ALL';
        for(const target of room.players.values())if(channel==='ALL'||target.team===p.team)
          send(target.socket,{type:'TDM_EVENT',event:{type:'CHAT',data:{name:p.name,team:p.team,channel,message}}});
      }
    });
    ws.on('error',()=>{});
    ws.on('close',()=>{
      const s=sessions.get(ws);if(!s)return;
      s.player.socket=null;s.player.disconnectedAt=Date.now();s.player.input=zero();s.player.pending=[];s.player.ready=false;sessions.delete(ws);
    });
  });
  let last=Date.now(),accumulator=0;
  const timer=setInterval(()=>{
    const t=Date.now();accumulator+=Math.min(250,t-last);last=t;
    while(accumulator>=1000/30){
      for(const room of rooms.values())simulate(room,1/30,t-accumulator+1000/30);
      accumulator-=1000/30;
    }
    for(const [key,room] of rooms){
      for(const p of room.players.values())if(p.disconnectedAt&&t-p.disconnectedAt>45000)room.players.delete(p.id);
      if(!room.players.size){rooms.delete(key);continue;}
      if(!room.players.get(room.hostId)||!connected(room.players.get(room.hostId)))room.hostId=[...room.players.values()].find(connected)?.id||room.hostId;
      if(playing(room)&&new Set([...room.players.values()].map(p=>p.team)).size<2)end(room,[...room.players.values()][0].team);
      const state=snapshot(room),events=room.events.splice(0);
      for(const p of room.players.values())if(connected(p)){
        send(p.socket,state);for(const e of events)send(p.socket,{type:'TDM_EVENT',event:e});
      }
    }
  },1000/15);
  wss.on('close',()=>clearInterval(timer));
  return {rooms,close:()=>clearInterval(timer)};
}
export { COLORS as TEAM_COLORS, WALLS as SPECTRUM_NEXUS_WALLS };
