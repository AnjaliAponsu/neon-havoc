import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { setupTeamDeathmatch, createRoom, simulate, damage } from './teamDeathmatchServer.js';
import { blocked, moveBody, WALLS } from '../src/battleground/arena.js';
import { findRoute, walkable } from './tdmNavigation.js';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=5000){const start=Date.now();while(Date.now()-start<timeout){const result=fn();if(result)return result;await wait(20);}throw Error('Condition timed out');}
async function client(url){
  const ws=new WebSocket(url),messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
  return {ws,messages,send:m=>ws.send(JSON.stringify(m)),latest:type=>messages.findLast(m=>m.type===type)};
}
test('eight independent humans share one public room; ready, combat, capacity, chat and reconnect are authoritative',{timeout:25000},async()=>{
  const server=http.createServer(),wss=new WebSocketServer({server}),service=setupTeamDeathmatch(wss),clients=[];
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`ws://127.0.0.1:${server.address().port}`;
  try{
    const first=await client(url);clients.push(first);first.send({type:'TDM_QUICK_MATCH',name:'Alpha'});
    const joined=await until(()=>first.latest('TDM_JOINED'));
    await wait(200);
    assert.equal(first.latest('TDM_SNAPSHOT').state,'LOBBY');
    assert.equal(first.latest('TDM_SNAPSHOT').players.length,1,'no hidden bots or invented players');
    for(let i=1;i<8;i++){const c=await client(url);clients.push(c);c.send({type:'TDM_QUICK_MATCH',name:'Pilot '+i});await until(()=>c.latest('TDM_JOINED'));}
    await until(()=>first.latest('TDM_SNAPSHOT').players.length===8);
    for(const c of clients)assert.equal(c.latest('TDM_JOINED').roomCode,joined.roomCode);
    let state=first.latest('TDM_SNAPSHOT');
    assert.equal(state.players.filter(p=>p.team==='BLUE').length,4);
    assert.equal(state.players.filter(p=>p.team==='RED').length,4);
    assert.ok(state.players.every(p=>!p.isBot));
    const extra=await client(url);clients.push(extra);extra.send({type:'TDM_JOIN_ROOM',roomCode:joined.roomCode});
    assert.match((await until(()=>extra.latest('TDM_ERROR'))).message,/full/);
    const room=service.rooms.get(joined.roomCode);
    const before=room.players.get(joined.playerId).x;
    first.send({type:'TDM_INPUT',seq:1,mx:1,my:0,aim:0,fire:true,ability:'ultimate',score:40,x:9000});
    await wait(100);assert.equal(room.players.get(joined.playerId).x,before);assert.equal(room.projectiles.length,0);
    for(const c of clients.slice(0,8))c.send({type:'TDM_READY',ready:true});
    await until(()=>first.latest('TDM_SNAPSHOT').state==='COUNTDOWN');
    // Keep production's ten-second countdown; verify real start packets, not fabricated snapshots.
    await until(()=>first.latest('TDM_SNAPSHOT').state==='ACTIVE',12000);
    first.send({type:'TDM_CHAT',channel:'TEAM',message:'Blue only'});
    await until(()=>clients[2].messages.some(m=>m.event?.data?.message==='Blue only'));
    assert.ok(!clients[1].messages.some(m=>m.event?.data?.message==='Blue only'));
    const shooter=room.players.get(joined.playerId),victim=room.players.get(clients[1].latest('TDM_JOINED').playerId);
    // Controlled combat fixture in the live authoritative server. No client state-setting message exists.
    Object.assign(shooter,{x:800,y:750,protectedUntil:0});Object.assign(victim,{x:1050,y:750,protectedUntil:0});
    const timer=setInterval(()=>first.send({type:'TDM_INPUT',seq:++sequence,mx:0,my:0,aim:0,fire:true}),34);
    let sequence=1;
    try{await until(()=>room.score.BLUE===1,5000);}finally{clearInterval(timer);}
    first.send({type:'TDM_INPUT',seq:++sequence,mx:0,my:0,aim:0,fire:false});
    await until(()=>clients[1].latest('TDM_SNAPSHOT').score.BLUE===1);
    assert.equal(first.latest('TDM_SNAPSHOT').score.BLUE,1);
    assert.equal(victim.deaths,1);assert.equal(shooter.kills,1);assert.equal(victim.alive,false);
    // Client-provided score, health and position are never applied.
    first.send({type:'TDM_INPUT',seq:++sequence,mx:Infinity,my:0,aim:0,health:999,score:40,x:9999});
    await wait(100);assert.equal(room.score.BLUE,1);assert.equal(shooter.health,115);
    await until(()=>victim.alive,5000);assert.equal(victim.health,115);
    const token=joined.token;first.ws.terminate();
    await until(()=>shooter.disconnectedAt>0);
    const rejoined=await client(url);clients.push(rejoined);rejoined.send({type:'TDM_RESUME',roomCode:joined.roomCode,token});
    const resume=await until(()=>rejoined.latest('TDM_JOINED'));assert.equal(resume.playerId,joined.playerId);
    assert.equal(room.players.size,8);assert.equal(shooter.kills,1);
  }finally{
    for(const c of clients)c.ws.terminate();
    service.close();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));
  }
});
function player(id,team,x=800,y=750){
  return {id,name:id,team,x,y,health:115,alive:true,protectedUntil:0,shield:0,damage:0,ultimate:0,weapon:'pulse_pistol_mk1',
    kills:0,deaths:0,assists:0,score:0,damageBy:new Map(),pending:[],socket:null,input:{mx:0,my:0,aim:0,fire:false},lastInputAt:0};
}
test('friendly fire, shield, spawn protection, one elimination and overtime',()=>{
  const r=createRoom('TEST');r.state='ACTIVE';r.clock=1000;r.endsAt=1000;
  const a=player('a','BLUE'),b=player('b','RED'),ally=player('c','BLUE');r.players=new Map([[a.id,a],[b.id,b],[ally.id,ally]]);
  damage(r,ally,a,500);assert.equal(ally.health,115);
  b.protectedUntil=2000;damage(r,b,a,50);assert.equal(b.health,115);
  b.protectedUntil=0;b.shield=45;damage(r,b,a,50);assert.equal(b.shield,0);assert.equal(b.health,110);
  r.score={BLUE:0,RED:0};simulate(r,1/30,1001);assert.equal(r.state,'OVERTIME');
  damage(r,b,a,999);assert.equal(r.state,'ENDED');assert.equal(r.winner,'BLUE');assert.equal(r.score.BLUE,1);
  damage(r,b,a,999);assert.equal(r.score.BLUE,1);assert.equal(a.damage,115);
  const draw=createRoom('DRAW');draw.state='OVERTIME';draw.overtimeEndsAt=999;simulate(draw,1/30,1000);assert.equal(draw.winner,'DRAW');
});
test('shared swept movement cannot cross thin cover, including dash-sized steps',()=>{
  const wall=WALLS[0];assert.ok(wall.points.length>4);
  const body={x:400,y:500};moveBody(body,0,260);assert.ok(body.y<570);assert.equal(blocked(body.x,body.y),false);
});
test('killstreaks, multi-kills, shutdown bounty, and Nexus support buffs preserve elimination scoring',()=>{
  const r=createRoom('NX50');r.state='ACTIVE';r.clock=1000;r.endsAt=100000;
  const p1=player('p1','BLUE',1920,1080),p2=player('p2','RED',1920,1080),p3=player('p3','RED',1920,1080);
  r.players=new Map([[p1.id,p1],[p2.id,p2],[p3.id,p3]]);
  damage(r,p2,p1,999);
  assert.equal(p1.kills,1);
  assert.equal(p1.streak,1);
  assert.equal(p1.multiKills,1);
  r.clock=2000;p3.alive=true;p3.health=115;
  damage(r,p3,p1,999);
  assert.equal(p1.kills,2);
  assert.equal(p1.streak,2);
  assert.equal(p1.multiKills,2);
  assert.ok(r.events.some(e=>e.type==='MULTIKILL'&&e.data.title==='DOUBLE KILL'));
  p1.streak=4;p2.alive=true;p2.health=115;
  damage(r,p1,p2,999);
  assert.equal(p1.streak,0);
  assert.ok(r.events.some(e=>e.type==='SHUTDOWN'&&e.data.bounty===200));
  assert.ok(r.nexus);
  p1.alive=true;p1.health=115;p1.team='BLUE';p1.x=1920;p1.y=1080;
  p1.socket={readyState:WebSocket.OPEN};p1.shieldUntil=0;
  p2.alive=false;p3.alive=false;
  const score={...r.score};
  for(let i=0;i<120;i++) simulate(r,1/30,3000+i*33);
  assert.equal(r.nexus.overchargeTeam,'BLUE');
  assert.ok(p1.shield>=30);
  assert.ok(p1.overchargedUntil>3000);
  assert.deepEqual(r.score,score,'Nexus buffs do not grant elimination points');
});

test('navigation routes full-size fighters around cover without cutting corners',()=>{
  const start={x:400,y:500},goal={x:430,y:800};
  assert.equal(walkable(start,goal),false);
  const route=findRoute(start,goal);assert.ok(route.length>1);
  let previous=start;
  for(const waypoint of route){assert.ok(walkable(previous,waypoint));previous=waypoint;}
  assert.deepEqual(route.at(-1),goal);
});

test('solo test starts immediately with seven labeled bots, real combat, isolated matchmaking and cleanup',{timeout:30000},async()=>{
  const server=http.createServer(),wss=new WebSocketServer({server}),service=setupTeamDeathmatch(wss),clients=[];
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`ws://127.0.0.1:${server.address().port}`;
  try{
    const a=await client(url);clients.push(a);a.send({type:'TDM_PRACTICE',name:'Tester',difficulty:'veteran'});
    const joined=await until(()=>a.latest('TDM_JOINED')),room=service.rooms.get(joined.roomCode);
    const first=a.latest('TDM_SNAPSHOT');assert.equal(first.state,'COUNTDOWN');assert.equal(first.isPractice,true);
    assert.equal(first.players.length,8);assert.equal(first.players.filter(p=>p.isBot).length,7);
    assert.equal(first.players.filter(p=>p.team==='BLUE').length,4);assert.ok(first.remainingMs<=3100);
    const b=await client(url);clients.push(b);b.send({type:'TDM_QUICK_MATCH',name:'Human',isBot:true,team:'RED'});
    const publicJoin=await until(()=>b.latest('TDM_JOINED'));assert.notEqual(publicJoin.roomCode,joined.roomCode);
    const publicRoom=service.rooms.get(publicJoin.roomCode);assert.equal(publicRoom.players.size,1);
    assert.equal(publicRoom.players.get(publicJoin.playerId).isBot,false,'clients cannot impersonate server bots');
    b.send({type:'TDM_FILL_BOTS'});await until(()=>b.latest('TDM_ERROR'));assert.equal(publicRoom.players.size,1);
    await until(()=>a.latest('TDM_SNAPSHOT').state==='ACTIVE',5000);
    const initial=new Map([...room.players].map(([id,p])=>[id,{x:p.x,y:p.y}]));
    await until(()=>room.score.BLUE+room.score.RED>0,20000);
    assert.ok([...room.players.values()].filter(p=>p.isBot&&Math.hypot(p.x-initial.get(p.id).x,p.y-initial.get(p.id).y)>80).length>=4);
    assert.ok([...room.players.values()].some(p=>p.isBot&&p.damage>0));
    assert.ok([...room.players.values()].every(p=>!blocked(p.x,p.y)));
    assert.equal(room.hostId,joined.playerId);
    const human=room.players.get(joined.playerId);human.alive=false;human.respawnAt=Date.now()+4000;
    a.send({type:'TDM_LOADOUT',weapon:'tesla_carbine'});await until(()=>human.weapon==='tesla_carbine');
    room.state='ENDED';a.send({type:'TDM_REMATCH'});await until(()=>room.round===2);
    assert.equal(room.state,'COUNTDOWN');assert.equal(room.players.size,8);assert.deepEqual(room.score,{BLUE:0,RED:0});
    a.send({type:'TDM_LEAVE'});await until(()=>!service.rooms.has(room.code));
  }finally{for(const c of clients)c.ws.terminate();service.close();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}
});

test('private room bot filling is restricted to its human host',{timeout:5000},async()=>{
  const server=http.createServer(),wss=new WebSocketServer({server}),service=setupTeamDeathmatch(wss),clients=[];
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`ws://127.0.0.1:${server.address().port}`;
  try{
    const host=await client(url);clients.push(host);host.send({type:'TDM_CREATE_ROOM'});
    const joined=await until(()=>host.latest('TDM_JOINED'));
    const guest=await client(url);clients.push(guest);guest.send({type:'TDM_JOIN_ROOM',roomCode:joined.roomCode});await until(()=>guest.latest('TDM_JOINED'));
    guest.send({type:'TDM_FILL_BOTS'});await until(()=>guest.latest('TDM_ERROR'));
    const room=service.rooms.get(joined.roomCode);assert.equal(room.players.size,2);
    host.send({type:'TDM_FILL_BOTS'});await until(()=>room.players.size===8);
    assert.equal([...room.players.values()].filter(p=>p.isBot).length,6);
    host.send({type:'TDM_LEAVE'});await until(()=>room.hostId===guest.latest('TDM_JOINED').playerId);
    guest.send({type:'TDM_LEAVE'});await until(()=>!service.rooms.has(room.code));
  }finally{for(const c of clients)c.ws.terminate();service.close();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}
});
