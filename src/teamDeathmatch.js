import { ARENA, WALLS, COLORS, moveInput, clamp } from './battleground/arena.js';
import { BattlegroundArt, fighterColor } from './battleground/art.js';
import { soundEngine } from './audio.js';

const WEAPONS={pulse_pistol_mk1:'Pulse Pistol',arc_smg:'Arc SMG',prism_rifle:'Prism Rifle',nova_shotgun:'Nova Shotgun',rail_lance:'Rail Lance',plasma_cannon:'Plasma Cannon'};
const esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const paths={
  dash:'M4 8l13 16L4 40l20-16z M23 8l13 16-13 16 20-16z',
  aegis:'M24 3l17 7v14c0 10-17 21-17 21S7 34 7 24V10z',
  wave:'M37 12a18 18 0 1 0 5 19 13 13 0 1 1-5-19M35 7l9 7-10 5',
  meteor:'M42 3L24 15M44 11L28 24M34 3L16 18M29 19a13 13 0 1 1-19 18 13 13 0 0 1 19-18z',
  cross:'M24 3v11m0 20v11M3 24h11m20 0h11M39 24a15 15 0 1 1-30 0 15 15 0 0 1 30 0',
  people:'M17 7a7 7 0 1 1 0 14 7 7 0 0 1 0-14M31 9a6 6 0 1 1 0 12M5 39v-8c0-10 24-10 24 0v8zM33 25c9 0 10 6 10 14H34',
  settings:'M24 16a8 8 0 1 1 0 16 8 8 0 0 1 0-16M20 4h8l2 7 6 3 7-1 4 7-5 5v6l2 7-7 5-6-3h-7l-5 4-7-4 1-8-3-5-7-3 2-8 7-1 5-5z',
  fullscreen:'M5 18V5h13M30 5h13v13M43 30v13H30M18 43H5V30',
  exit:'M20 6H6v36h14M25 13l13 11-13 11M15 24h23',
  wifi:'M4 17c12-12 28-12 40 0M11 25c8-8 18-8 26 0M18 32c4-4 8-4 12 0M24 40v1',
  skull:'M10 30V16c0-17 28-17 28 0v14l-8 3v9H18v-9zM16 21h3m10 0h3M24 30v4',
};
const icon=(name)=>`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="${paths[name]||paths.cross}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const playing=s=>s==='ACTIVE'||s==='OVERTIME';
export class TeamDeathmatchGame {
  constructor(canvas,{onEnter=()=>{},onExit=()=>{},onFullscreen=()=>{}}={}) {
    Object.assign(this,{canvas,ctx:canvas.getContext('2d'),onEnter,onExit,onFullscreen,ws:null,snapshot:null,playerId:null,team:'BLUE',
      active:false,roomCode:'',token:null,selectedWeapon:'pulse_pistol_mk1',ping:0,fps:60,seq:0,pending:[],inputTimer:0,
      snapshotAt:0,visualPlayers:new Map(),effects:[],feed:[],keys:new Set(),mouse:{x:innerWidth/2,y:innerHeight/2,down:false},
      touchMove:{x:0,y:0},touchAim:null,chatChannel:'ALL',lastPingAt:0,frames:0,frameTime:0,menuOpen:false,reconnecting:false});
    this.art=new BattlegroundArt();this._injectUI();this._bindUI();
  }
  _injectUI() {
    document.body.insertAdjacentHTML('beforeend',`
      <div class="screen-overlay tdm-lobby" id="tdmLobby"><div class="tdm-lobby-panel">
        <button class="tdm-close" id="tdmLobbyClose" aria-label="Close lobby">×</button>
        <div class="tdm-kicker">NEON HAVOC / ONLINE ARENA</div><h2>TEAM <span>DEATHMATCH</span></h2>
        <p class="tdm-intro">Bring your squad. Take the Nexus. Every elimination counts.</p>
        <div class="tdm-config-strip"><span>UP TO 4 VS 4</span><span>6 MINUTES</span><span>FIRST TO 40</span><span>HUMAN PLAYERS</span></div>
        <div id="tdmJoinControls">
          <label class="tdm-field-label" for="tdmPilotName">YOUR CALLSIGN</label>
          <input id="tdmPilotName" class="tdm-input" maxlength="16" placeholder="Enter your name" value="Pilot" autocomplete="off">
        </div>
        <div class="tdm-field-label">YOUR LOADOUT</div><div class="tdm-loadouts" id="tdmLoadouts">
          ${Object.entries(WEAPONS).map(([id,w],i)=>`<button data-weapon="${id}" class="tdm-loadout ${i===0?'selected':''}">${icon(i===5?'meteor':'cross')}<span>${w}</span></button>`).join('')}
        </div>
        <div id="tdmEntryActions"><div class="tdm-lobby-actions">
          <button class="tdm-primary" id="tdmQuickMatch">FIND PUBLIC MATCH</button><button class="tdm-secondary" id="tdmCreateRoom">CREATE PRIVATE ROOM</button>
        </div><div class="tdm-divider"><span>HAVE AN INVITE?</span></div>
        <div class="tdm-join-row"><input id="tdmRoomCode" class="tdm-input" maxlength="5" placeholder="ROOM CODE"><button class="tdm-secondary" id="tdmJoinRoom">JOIN ROOM</button></div>
        <details class="tdm-server-options"><summary>Server address</summary><label for="tdmServerUrl">Use the same server as your friends. Leave blank for this game's server.</label><input id="tdmServerUrl" class="tdm-input" placeholder="wss://your-server.example/ws"></details></div>
        <div id="tdmWaiting" hidden><div class="tdm-room-share"><span>INVITE CODE <strong id="tdmInviteCode"></strong></span><button class="tdm-secondary" id="tdmCopyInvite">COPY INVITE</button></div>
          <div id="tdmLobbyTeams" class="tdm-lobby-teams"></div>
          <div class="tdm-lobby-actions"><button class="tdm-secondary" id="tdmSwitchTeam">SWITCH TEAM</button><button class="tdm-primary" id="tdmReady">READY UP</button></div>
          <p class="tdm-lobby-help">Both teams need a player. Ready up together to start the 10-second countdown. Empty slots stay open for friends.</p>
        </div><div id="tdmLobbyStatus" class="tdm-lobby-status" role="status">CREATE AN ARENA OR FIND OTHER PLAYERS</div>
        <p class="tdm-controls-help">WASD move · Mouse aim / fire · Q dash · E aegis · R wave · F ultimate · X reload</p>
      </div></div>
      <div id="tdmHud" class="tdm-hud" aria-hidden="true">
        <svg class="tdm-frame" viewBox="0 0 1672 941" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="tdmFrameGradient"><stop stop-color="#00cfff"/><stop offset=".5" stop-color="#0068bd"/><stop offset="1" stop-color="#f000dd"/></linearGradient></defs>
          <path d="M0 71H320L373 25H477L504 0M1672 65H1400L1340 0M0 883H281L328 830H373L443 899H542L580 918H1098L1130 897H1245L1310 831H1391L1440 877H1672" fill="none" stroke="#14172e" stroke-width="29"/>
          <path d="M0 71H320L373 25H477L504 0M1672 65H1400L1340 0M0 883H281L328 830H373L443 899H542L580 918H1098L1130 897H1245L1310 831H1391L1440 877H1672" fill="none" stroke="url(#tdmFrameGradient)" stroke-width="2"/>
          <path d="M445 899H542L580 918H1098L1130 897H1245M328 830H373M1310 831H1391" fill="none" stroke="#00dfff" stroke-width="4"/>
        </svg>
        <div class="tdm-brand"><strong>NEON <span>HAVOC</span><i>ϟ</i></strong><small>MULTIPLAYER BATTLEGROUND</small></div>
        <div class="tdm-top-score"><div class="tdm-team-score blue"><strong id="tdmBlueScore">0</strong>${icon('skull')}</div>
        <div class="tdm-match-center"><b>TEAM DEATHMATCH</b><strong id="tdmTimer">06:00</strong><small id="tdmMatchState">FIRST TO 40</small></div>
        <div class="tdm-team-score red">${icon('skull')}<strong id="tdmRedScore">0</strong></div></div>
        <div class="tdm-diagnostics"><span class="tdm-ping">${icon('wifi')}<span id="tdmPing">— ms</span></span><span id="tdmFps">FPS —</span>
          <button id="tdmShowScore" title="Scoreboard (Tab)" aria-label="Scoreboard">${icon('people')}</button><button id="tdmSettings" title="Match menu" aria-label="Settings">${icon('settings')}</button>
          <button id="tdmFullscreen" title="Fullscreen" aria-label="Fullscreen">${icon('fullscreen')}</button><button id="tdmLeave" title="Match menu (Esc)" aria-label="Match menu">Ⅱ</button></div>
        <aside class="tdm-roster" id="tdmRoster"></aside>
        <div class="tdm-minimap-wrap"><canvas id="tdmMinimap" width="250" height="175"></canvas></div>
        <div class="tdm-feed" id="tdmFeed"></div>
        <div class="tdm-chat"><div class="tdm-chat-tabs"><button data-channel="ALL" class="selected">All</button><button data-channel="TEAM">Team</button><button id="tdmMuteChat" title="Mute incoming chat">Mute</button></div>
          <div id="tdmChatLog" class="tdm-chat-log" aria-live="polite"></div><form id="tdmChatForm"><input id="tdmChatInput" maxlength="120" placeholder="Type a message…"><button aria-label="Send message">➤</button></form></div>
        <div class="tdm-ability-bar">
          <button data-ability="dash"><kbd>Q</kbd><b>${icon('dash')}</b><span>DASH</span><small id="tdmCdDash">● ● ●</small></button>
          <button data-ability="aegis"><kbd>E</kbd><b>${icon('aegis')}</b><span>AEGIS</span><small id="tdmCdAegis">● ● ●</small></button>
          <button data-ability="wave"><kbd>R</kbd><b>${icon('wave')}</b><span>WAVE</span><small id="tdmCdWave">● ● ●</small></button>
          <button class="ultimate" data-ability="ultimate"><kbd>F</kbd><b>${icon('meteor')}</b><span>ULTIMATE</span><small id="tdmUltimate">0%</small></button>
        </div>
        <div class="tdm-status-bar"><div><span id="tdmHpLabel">115 / 115 HP</span><i><em id="tdmHpFill"></em></i></div>
          <div id="tdmWeaponLabel"></div><button id="tdmReload" title="Reload (X)"><b id="tdmAmmo">24 / 24</b><small>AMMO / X RELOAD</small></button><div>ROOM <b id="tdmRoomLabel"></b></div></div>
        <div class="tdm-mobile-stick" id="tdmMoveStick"><i></i><span>MOVE</span></div>
        <button class="tdm-mobile-fire" id="tdmFireButton" aria-label="Drag to aim and fire">${icon('cross')}<small>AIM / FIRE</small></button>
        <div class="tdm-respawn" id="tdmRespawn"><strong>CORE FRACTURED</strong><span>RESPAWNING IN <b>4.0</b></span></div>
        <div class="tdm-announcement" id="tdmAnnouncement"></div><div class="tdm-scoreboard" id="tdmScoreboard"></div>
        <div class="tdm-match-menu" id="tdmMatchMenu" hidden><div><h2>ARENA MENU</h2><p>The online match continues while this menu is open.</p>
          <button class="tdm-primary" id="tdmResume">RETURN TO BATTLE</button><button class="tdm-secondary" id="tdmSound">SOUND ON</button>
          <button class="tdm-secondary" id="tdmDisconnect">LEAVE MATCH</button></div></div>
        <div class="tdm-results" id="tdmResults"><div class="tdm-results-card"><small>TEAM DEATHMATCH / FINAL</small><h2 id="tdmResultTitle"></h2><div class="tdm-final-score" id="tdmFinalScore"></div><div id="tdmResultStats"></div>
          <button id="tdmPlayAgain" class="tdm-primary">REMATCH</button><button id="tdmResultsMenu" class="tdm-secondary">MAIN MENU</button></div></div>
      </div>`);
    this.dom={};document.querySelectorAll('[id^="tdm"]').forEach(e=>this.dom[e.id.slice(3)]=e);
    try{this.dom.PilotName.value=localStorage.getItem('neon_tdm_name')||'Pilot';this.dom.ServerUrl.value=localStorage.getItem('neon_tdm_server')||'';}catch{}
    const params=new URLSearchParams(location.search);
    if(params.has('arena')){this.dom.RoomCode.value=params.get('arena').slice(0,5).toUpperCase();setTimeout(()=>this.openLobby(),0);}
  }
  _bindUI() {
    this.dom.Loadouts.onclick=e=>{
      const b=e.target.closest('[data-weapon]');if(!b)return;this.selectedWeapon=b.dataset.weapon;
      this.dom.Loadouts.querySelectorAll('button').forEach(el=>el.classList.toggle('selected',el===b));
      this._send({type:'TDM_LOADOUT',weapon:this.selectedWeapon});
    };
    this.dom.QuickMatch.onclick=()=>this._join('TDM_QUICK_MATCH');
    this.dom.CreateRoom.onclick=()=>this._join('TDM_CREATE_ROOM');
    this.dom.JoinRoom.onclick=()=>this._join('TDM_JOIN_ROOM');
    this.dom.LobbyClose.onclick=()=>{if(this.active)this.leave();else this.closeLobby();};
    this.dom.Ready.onclick=()=>this._send({type:'TDM_READY',ready:!this._localPlayer()?.ready});
    this.dom.SwitchTeam.onclick=()=>this._send({type:'TDM_TEAM',team:this._localPlayer()?.team==='BLUE'?'RED':'BLUE'});
    this.dom.CopyInvite.onclick=async()=>{
      const url=new URL(location.href);url.search='';url.searchParams.set('arena',this.roomCode);
      try{await navigator.clipboard.writeText(url.href);this.dom.LobbyStatus.textContent='INVITE LINK COPIED';}
      catch{this.dom.LobbyStatus.textContent='SHARE ROOM CODE '+this.roomCode+' AND THIS GAME ADDRESS';}
    };
    this.dom.Fullscreen.onclick=()=>this.onFullscreen();
    this.dom.ShowScore.onclick=()=>this.dom.Scoreboard.classList.toggle('visible');
    this.dom.Scoreboard.onclick=()=>this.dom.Scoreboard.classList.remove('visible');
    this.dom.Leave.onclick=this.dom.Settings.onclick=()=>this._menu(true);
    this.dom.Resume.onclick=()=>this._menu(false);
    this.dom.Disconnect.onclick=this.dom.ResultsMenu.onclick=()=>this.leave();
    this.dom.Sound.onclick=()=>{soundEngine.setMute(!soundEngine.isMuted);this.dom.Sound.textContent=soundEngine.isMuted?'SOUND OFF':'SOUND ON';};
    this.dom.PlayAgain.onclick=()=>this._send({type:'TDM_REMATCH'});
    this.dom.Reload.onclick=()=>this.reload=true;
    this.dom.Hud.querySelectorAll('[data-ability]').forEach(b=>b.onclick=()=>this.abilityQueue=b.dataset.ability);
    this.dom.Hud.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>{
      this.chatChannel=b.dataset.channel;this.dom.Hud.querySelectorAll('[data-channel]').forEach(e=>e.classList.toggle('selected',e===b));
    });
    this.dom.MuteChat.onclick=()=>{this.mutedChat=!this.mutedChat;this.dom.MuteChat.textContent=this.mutedChat?'Unmute':'Mute';};
    this.dom.ChatForm.onsubmit=e=>{
      e.preventDefault();const message=this.dom.ChatInput.value.trim();if(message)this._send({type:'TDM_CHAT',message,channel:this.chatChannel});
      this.dom.ChatInput.value='';this.dom.ChatInput.blur();this._clearInput();
    };
    this.dom.ChatInput.onfocus=()=>this._clearInput();
    window.addEventListener('keydown',e=>{
      if(!this.active)return;
      e.stopImmediatePropagation();
      if(e.target.matches('input,textarea,select'))return;
      if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      this.keys.add(e.code);
      if(e.repeat)return;
      const ability={KeyQ:'dash',ShiftLeft:'dash',KeyE:'aegis',KeyR:'wave',KeyF:'ultimate',Space:'ultimate'}[e.code];
      if(ability)this.abilityQueue=ability;
      if(e.code==='KeyX')this.reload=true;
      if(e.code==='Tab')this.dom.Scoreboard.classList.add('visible');
      if(e.code==='Enter'){e.preventDefault();this.dom.ChatInput.focus();}
      if(e.code==='Escape')this._menu(!this.menuOpen);
      if(e.code==='F11'){e.preventDefault();this.onFullscreen();}
    },true);
    window.addEventListener('keyup',e=>{
      this.keys.delete(e.code);if(e.code==='Tab')this.dom.Scoreboard.classList.remove('visible');
      if(this.active)e.stopImmediatePropagation();
    },true);
    window.addEventListener('mousemove',e=>{this.mouse.x=e.clientX;this.mouse.y=e.clientY;});
    this.canvas.addEventListener('pointerdown',e=>{
      if(!this.active||e.button!==0||this.menuOpen)return;this.mouse.down=true;this.canvas.setPointerCapture(e.pointerId);soundEngine.init();
    });
    window.addEventListener('pointerup',()=>{this.mouse.down=false;});
    window.addEventListener('blur',()=>this._clearInput());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this._clearInput();});
    this._bindStick(this.dom.MoveStick,false);this._bindStick(this.dom.FireButton,true);
  }
  _bindStick(el,aim) {
    let pointer=null,origin;
    const move=e=>{
      if(e.pointerId!==pointer)return;
      const dx=e.clientX-origin.x,dy=e.clientY-origin.y,length=Math.max(45,Math.hypot(dx,dy));
      if(aim){if(Math.hypot(dx,dy)>8)this.touchAim=Math.atan2(dy,dx);this.touchFire=true;}
      else{this.touchMove={x:dx/length,y:dy/length};el.querySelector('i').style.transform=`translate(${dx/length*45}px,${dy/length*45}px)`;}
    };
    el.onpointerdown=e=>{pointer=e.pointerId;const r=el.getBoundingClientRect();origin={x:r.left+r.width/2,y:r.top+r.height/2};el.setPointerCapture(pointer);move(e);};
    el.onpointermove=move;
    el.onpointerup=el.onpointercancel=e=>{
      if(e.pointerId!==pointer)return;pointer=null;
      if(aim){this.touchFire=false;this.touchAim=null;}else{this.touchMove={x:0,y:0};el.querySelector('i').style.transform='';}
    };
  }
  _clearInput(){this.keys.clear();this.mouse.down=false;this.touchFire=false;this.touchMove={x:0,y:0};this.abilityQueue=null;this.reload=false;}
  _menu(open){this.menuOpen=open;this.dom.MatchMenu.hidden=!open;this._clearInput();}
  openLobby(){this.dom.Lobby.style.display='flex';this.dom.Lobby.classList.add('active');}
  closeLobby(){this.dom.Lobby.style.display='none';this.dom.Lobby.classList.remove('active');}
  _serverAddress(){
    const custom=this.dom.ServerUrl.value.trim()||import.meta.env.VITE_MULTIPLAYER_URL;
    if(custom){const url=new URL(custom);if(!['ws:','wss:'].includes(url.protocol))throw Error('Use a ws:// or wss:// server address.');if(location.protocol==='https:'&&url.protocol!=='wss:')throw Error('HTTPS requires a secure wss:// server.');return url.href;}
    return `${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`;
  }
  _connect(){
    if(this.ws?.readyState===WebSocket.OPEN)return Promise.resolve();
    if(this.connecting)return this.connecting;
    this.connecting=new Promise((resolve,reject)=>{
      let ws;try{ws=new WebSocket(this._serverAddress());}catch(e){reject(e);return;}this.ws=ws;
      const timer=setTimeout(()=>{ws.close();reject(Error('Server did not respond. Check its address.'));},7000);
      ws.onopen=()=>{clearTimeout(timer);resolve();};
      ws.onerror=()=>{clearTimeout(timer);reject(Error('Cannot reach the multiplayer server.'));};
      ws.onmessage=e=>{if(this.ws===ws)this._handleMessage(e);};
      ws.onclose=()=>{
        clearTimeout(timer);reject(Error('Connection closed.'));if(this.ws!==ws)return;
        this.connecting=null;this._clearInput();
        if(this.active&&this.token)this._reconnect();
      };
    }).finally(()=>this.connecting=null);
    return this.connecting;
  }
  async _reconnect(){
    if(this.reconnecting)return;this.reconnecting=true;this._announce('RECONNECTING…', '#ffc247',45000);
    for(let i=0;i<10&&this.active;i++){
      await new Promise(r=>setTimeout(r,Math.min(3000,500+i*300)));
      try{await this._connect();this._send({type:'TDM_RESUME',roomCode:this.roomCode,token:this.token});return;}catch{}
    }
    this.reconnecting=false;if(this.active){this._announce('SERVER UNAVAILABLE — OPEN MENU TO LEAVE','#ff315b',30000);this._menu(true);}
  }
  async _join(type) {
    if(this.joining||this.active)return;
    if(type==='TDM_JOIN_ROOM'&&!/^[A-Z0-9]{5}$/i.test(this.dom.RoomCode.value.trim())){this.dom.LobbyStatus.textContent='ENTER THE FIVE-CHARACTER ROOM CODE';return;}
    this.joining=true;this.dom.LobbyStatus.textContent='CONNECTING…';soundEngine.init();
    try{
      await this._connect();this._send({type,name:this.dom.PilotName.value,weapon:this.selectedWeapon,roomCode:this.dom.RoomCode.value});
      try{localStorage.setItem('neon_tdm_name',this.dom.PilotName.value);localStorage.setItem('neon_tdm_server',this.dom.ServerUrl.value.trim());}catch{}
    }catch(e){this.dom.LobbyStatus.textContent=e.message;}finally{this.joining=false;}
  }
  _send(m){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(m));}
  _handleMessage(e) {
    let m;try{m=JSON.parse(e.data);}catch{return;}
    if(m.type==='TDM_JOINED'){
      Object.assign(this,{playerId:m.playerId,team:m.team,roomCode:m.roomCode,token:m.token,active:true,reconnecting:false});
      this.dom.Hud.classList.add('active');this.dom.Hud.setAttribute('aria-hidden','false');this.dom.RoomLabel.textContent=m.roomCode;
      this.dom.InviteCode.textContent=m.roomCode;this.dom.EntryActions.hidden=true;this.dom.JoinControls.hidden=true;this.dom.Waiting.hidden=false;
      this.pending=[];this.onEnter();this.openLobby();this.dom.Announcement.classList.remove('visible');
    } else if(m.type==='TDM_SNAPSHOT'){
      const previous=this.snapshot;this.snapshot=m;this.snapshotAt=performance.now();
      const local=this._localPlayer();
      if(local){
        this.team=local.team;this.seq=Math.max(this.seq,local.ack);
        this.pending=this.pending.filter(i=>i.seq>local.ack);
        const predicted={x:local.x,y:local.y};
        if(local.alive&&!local.dashing&&playing(m.state))for(const input of this.pending)moveInput(predicted,input,1/30);
        this.predicted=predicted;
      }
      for(const p of m.players)if(!this.visualPlayers.has(p.id))this.visualPlayers.set(p.id,{x:p.x,y:p.y,trail:[]});
      for(const id of this.visualPlayers.keys())if(!m.players.some(p=>p.id===id))this.visualPlayers.delete(id);
      if(previous?.round!==m.round){this.dom.Results.classList.remove('visible');this.feed=[];this.effects=[];}
      if(m.state==='LOBBY'){this.openLobby();this.dom.Results.classList.remove('visible');}
      else this.closeLobby();
      this._updateHud();
    } else if(m.type==='TDM_EVENT')this._event(m.event);
    else if(m.type==='TDM_ERROR'){
      this.dom.LobbyStatus.textContent=m.message;this._announce(m.message,'#ffc247',5000);
      if(this.reconnecting){this.reconnecting=false;this.token=null;this._menu(true);}
    } else if(m.type==='TDM_PONG'){
      this.ping=Math.round(performance.now()-m.time);this._send({type:'TDM_LATENCY',ping:this.ping});
    }
  }
  _event(e) {
    const d=e.data||{},color=COLORS[d.team]||'#ffc247';
    const effect=(type,life,extra={})=>this.effects.push({type,life,duration:life,x:d.x,y:d.y,color,seed:Math.random(),...extra});
    if(e.type==='SHOT'){
      if(d.playerId===this.playerId)soundEngine.playPistol();effect('spark',.12);
    }else if(e.type==='HIT'){
      effect('spark',.25);if(d.attackerId===this.playerId){effect('text',.7,{text:String(d.amount),color:d.shield?'#55dfff':'#ffc247'});soundEngine.playEnemyPop(.3);}
    }else if(e.type==='ELIMINATION'){
      effect('explosion',.65);soundEngine.playEnemyPop(1);
      this.feed.unshift({at:performance.now(),html:`<span style="color:${color}">${esc(d.killer)}</span> ✦ ${esc(d.victim)}<small>${esc(d.weapon)}</small>`});
    }else if(e.type==='ABILITY'){
      if(d.ability==='wave')effect('wave',.45);
      if(d.playerId===this.playerId){if(d.ability==='dash')soundEngine.playDash();if(d.ability==='aegis')soundEngine.playShield();if(d.ability==='wave')soundEngine.playShockwave();}
    }else if(e.type==='EXPLOSION'){effect('explosion',.65);}
    else if(e.type==='IMPACT')effect('spark',.3);
    else if(e.type==='PICKUP'&&d.playerId===this.playerId){soundEngine.playCrystal();this._announce(d.pickup==='HEAL'?'HEALTH RESTORED':d.pickup==='AMMO'?'AMMO REFILLED':'ULTIMATE +35%',color,1400);}
    else if(e.type==='OVERTIME')this._announce('SUDDEN DEATH / NEXT ELIMINATION WINS','#ff36df',3500);
    else if(e.type==='MATCH_STARTED')this._announce('BATTLE START','#ffc247',1500);
    else if(e.type==='CHAT'&&!this.mutedChat){
      const p=document.createElement('p');p.innerHTML=`<i style="color:${color}">[${esc(d.channel)}] ${esc(d.name)}:</i> ${esc(d.message)}`;
      this.dom.ChatLog.append(p);while(this.dom.ChatLog.children.length>80)this.dom.ChatLog.firstChild.remove();this.dom.ChatLog.scrollTop=this.dom.ChatLog.scrollHeight;
    }
    if(this.effects.length>140)this.effects.splice(0,this.effects.length-140);
  }
  _localPlayer(){return this.snapshot?.players.find(p=>p.id===this.playerId)||null;}
  _camera(){return {x:1200,y:675,zoom:Math.min(this.canvas.width/2400,this.canvas.height/1350)};}
  _readInput(){
    const disabled=this.menuOpen||!playing(this.snapshot?.state)||document.activeElement===this.dom.ChatInput||document.hidden;
    if(disabled)return {mx:0,my:0,aim:this._localPlayer()?.aim||0,fire:false};
    let mx=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.touchMove.x;
    let my=(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)+this.touchMove.y;
    const local=this.predicted||this._localPlayer(),cam=this._camera();
    let aim=local?Math.atan2((this.mouse.y-this.canvas.height/2)/cam.zoom+cam.y-local.y,(this.mouse.x-this.canvas.width/2)/cam.zoom+cam.x-local.x):0;
    let fire=this.mouse.down||this.touchFire;if(this.touchAim!==null)aim=this.touchAim;
    const gp=navigator.getGamepads?.()[0];if(gp){if(Math.hypot(gp.axes[0],gp.axes[1])>.18){mx=gp.axes[0];my=gp.axes[1];}if(Math.hypot(gp.axes[2],gp.axes[3])>.25)aim=Math.atan2(gp.axes[3],gp.axes[2]);fire=fire||gp.buttons[7]?.pressed;
      for(const [button,ability] of [[0,'dash'],[4,'aegis'],[5,'wave'],[3,'ultimate']])if(gp.buttons[button]?.pressed&&!this.padHeld?.[button])this.abilityQueue=ability;
      this.padHeld=gp.buttons.map(b=>b.pressed);}
    return {mx:clamp(mx,-1,1),my:clamp(my,-1,1),aim,fire};
  }
  _sendInput(){
    if(!playing(this.snapshot?.state)||this.ws?.readyState!==WebSocket.OPEN)return;
    const input={...this._readInput(),seq:++this.seq,ability:this.menuOpen?null:this.abilityQueue,reload:!!this.reload};
    this._send({type:'TDM_INPUT',...input});this.pending.push(input);if(this.pending.length>20)this.pending.shift();
    this.abilityQueue=null;this.reload=false;
  }
  frame(dt){
    if(!this.active)return;dt=Math.min(dt,.05);this.frames++;this.frameTime+=dt;
    if(this.frameTime>=.5){this.fps=Math.round(this.frames/this.frameTime);this.frames=0;this.frameTime=0;}
    this.inputTimer+=dt;if(this.inputTimer>=1/30){this.inputTimer%=1/30;this._sendInput();}
    if(performance.now()-this.lastPingAt>1500){this.lastPingAt=performance.now();this._send({type:'TDM_PING',time:this.lastPingAt});}
    if(this.predicted&&this._localPlayer()?.alive&&playing(this.snapshot?.state)&&this.ws?.readyState===WebSocket.OPEN)moveInput(this.predicted,this._readInput(),dt);
    for(const p of this.snapshot?.players||[]){
      const v=this.visualPlayers.get(p.id);if(!v)continue;
      const target=p.id===this.playerId?(this.predicted||p):p;
      const snap=Math.hypot(v.x-target.x,v.y-target.y)>200||!p.alive;
      v.x+=(target.x-v.x)*(snap?1:Math.min(1,dt*(p.id===this.playerId?30:18)));
      v.y+=(target.y-v.y)*(snap?1:Math.min(1,dt*(p.id===this.playerId?30:18)));
      v.trail.forEach(t=>t.life-=dt);v.trail=v.trail.filter(t=>t.life>0);
      if(p.alive&&(Math.hypot(p.vx,p.vy)>30||p.dashing)){v.trail.unshift({x:v.x,y:v.y,life:.28});v.trail=v.trail.slice(0,12);}
    }
    this.effects.forEach(e=>e.life-=dt);this.effects=this.effects.filter(e=>e.life>0);
    this.feed=this.feed.filter(e=>performance.now()-e.at<8000).slice(0,4);
    this.dom.Feed.innerHTML=this.feed.map(e=>`<div>${e.html}</div>`).join('');
    this.art.draw(this.ctx,this);this._drawMinimap();
  }
  _drawMinimap(){
    const c=this.dom.Minimap.getContext('2d'),w=this.dom.Minimap.width,h=this.dom.Minimap.height;
    c.clearRect(0,0,w,h);c.fillStyle='#030919';c.fillRect(0,0,w,h);c.save();c.scale(w/2400,h/1350);
    c.strokeStyle='#00cfff';c.lineWidth=12;c.strokeRect(65,65,2270,1220);
    c.fillStyle='#182746';for(const wall of WALLS){c.beginPath();wall.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
    c.fillStyle='#dc32ff';c.beginPath();c.moveTo(1280,495);c.lineTo(1350,605);c.lineTo(1280,710);c.lineTo(1210,605);c.closePath();c.fill();
    for(const p of this.snapshot?.players||[]){if(!p.alive)continue;c.fillStyle=p.id===this.playerId?'#fff':COLORS[p.team];c.shadowColor=c.fillStyle;c.shadowBlur=10;c.beginPath();c.arc(p.x,p.y,p.id===this.playerId?30:21,0,Math.PI*2);c.fill();}
    c.restore();
  }
  _updateHud(){
    const s=this.snapshot,p=this._localPlayer();if(!s||!p)return;
    this.dom.BlueScore.textContent=s.score.BLUE;this.dom.RedScore.textContent=s.score.RED;
    const seconds=Math.ceil(s.remainingMs/1000);
    this.dom.Timer.textContent=s.state==='LOBBY'?'06:00':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    this.dom.MatchState.textContent=s.state==='COUNTDOWN'?'DEPLOYING':s.state==='OVERTIME'?'SUDDEN DEATH':'FIRST TO 40';
    this.dom.Ping.textContent=this.reconnecting?'OFFLINE':`${this.ping} ms`;this.dom.Fps.textContent=`FPS ${this.fps}`;
    this.dom.HpLabel.textContent=`${Math.ceil(p.health)} / 115 HP`;this.dom.HpFill.style.width=`${p.health/115*100}%`;
    this.dom.WeaponLabel.textContent=WEAPONS[p.weapon];this.dom.Ammo.textContent=p.reloadMs>0?'RELOADING':`${p.ammo} / ${p.magazine}`;
    this.dom.Ultimate.textContent=`${Math.round(p.ultimate)}%`;this.dom.Ultimate.parentElement.classList.toggle('charged',p.ultimate>=100);
    for(const [key,el]of[['dash',this.dom.CdDash],['aegis',this.dom.CdAegis],['wave',this.dom.CdWave]]){
      el.textContent=p.cooldowns[key]>0?(p.cooldowns[key]/1000).toFixed(1)+'s':'● ● ●';el.parentElement.classList.toggle('cooling',p.cooldowns[key]>0);
    }
    const teamHtml=team=>s.players.filter(e=>e.team===team).map(e=>`<div class="${e.id===this.playerId?'me':''}"><i class="tdm-orb-avatar" style="--orb:${fighterColor(e,s.players)}"></i><span>${esc(e.name)}${e.id===s.hostId?' <em>♛</em>':''}</span><b title="${e.ping} ms">${!e.connected?'OFFLINE':s.state==='LOBBY'?(e.ready?'READY':'…'):e.alive?'▂▄▆':'DOWN'}</b></div>`).join('');
    this.dom.Roster.innerHTML=['BLUE','RED'].map(team=>`<section style="--team:${COLORS[team]}"><h3>${team} TEAM (${s.players.filter(p=>p.team===team).length})</h3>${teamHtml(team)}</section>`).join('');
    this.dom.LobbyTeams.innerHTML=['BLUE','RED'].map(team=>`<section style="--team:${COLORS[team]}"><h3>${team} TEAM</h3>${teamHtml(team)}${Array.from({length:4-s.players.filter(p=>p.team===team).length},()=>'<div class="tdm-empty-slot">Waiting for player…</div>').join('')}</section>`).join('');
    this.dom.Ready.textContent=p.ready?'READY ✓ / CANCEL':'READY UP';this.dom.SwitchTeam.textContent='JOIN '+(p.team==='BLUE'?'RED':'BLUE');
    this.dom.LobbyStatus.textContent=s.players.filter(e=>e.connected).length<2?'WAITING FOR A HUMAN OPPONENT':s.players.filter(e=>e.connected).every(e=>e.ready)?'SQUADS READY / DEPLOYING':'READY UP TO DEPLOY · '+(seconds?'AUTO START IN '+seconds+'s':'');
    this.dom.Respawn.classList.toggle('visible',!p.alive&&playing(s.state));this.dom.Respawn.querySelector('b').textContent=(p.respawnMs/1000).toFixed(1);
    if(s.state==='COUNTDOWN')this._announce('DEPLOYING IN '+seconds,'#ffc247',300);
    const rows=[...s.players].sort((a,b)=>b.personalScore-a.personalScore);
    this.dom.Scoreboard.innerHTML=`<div><h2>TEAM DEATHMATCH <small>${s.score.BLUE} — ${s.score.RED}</small></h2><table><thead><tr><th>PILOT</th><th>TEAM</th><th>K</th><th>D</th><th>A</th><th>DAMAGE</th><th>SCORE</th></tr></thead><tbody>${rows.map(e=>`<tr class="${e.id===p.id?'me':''}"><td>${esc(e.name)}</td><td style="color:${COLORS[e.team]}">${e.team}</td><td>${e.kills}</td><td>${e.deaths}</td><td>${e.assists}</td><td>${e.damage}</td><td>${e.personalScore}</td></tr>`).join('')}</tbody></table><small>TAB / CLICK TO CLOSE</small></div>`;
    if(s.state==='ENDED'){
      this.dom.Results.classList.add('visible');this.dom.ResultTitle.textContent=s.winner==='DRAW'?'DRAW':s.winner===p.team?'VICTORY':'DEFEAT';
      this.dom.ResultTitle.style.color=COLORS[s.winner]||'#fff';this.dom.FinalScore.textContent=s.score.BLUE+' — '+s.score.RED;
      this.dom.ResultStats.innerHTML=[['ELIMINATIONS',p.kills],['DEATHS',p.deaths],['ASSISTS',p.assists],['DAMAGE',p.damage]].map(([label,n])=>`<div><b>${n}</b><span>${label}</span></div>`).join('');
      this.dom.PlayAgain.disabled=s.hostId!==p.id;this.dom.PlayAgain.textContent=s.hostId===p.id?'REMATCH':'WAITING FOR HOST';
    }
  }
  _announce(text,color='#fff',duration=2000){
    this.dom.Announcement.textContent=text;this.dom.Announcement.style.color=color;this.dom.Announcement.classList.add('visible');
    clearTimeout(this.announcementTimer);this.announcementTimer=setTimeout(()=>this.dom.Announcement.classList.remove('visible'),duration);
  }
  leave(){
    this._send({type:'TDM_LEAVE'});this.active=false;this.token=null;this.reconnecting=false;
    const ws=this.ws;this.ws=null;if(ws)ws.close();this.connecting=null;this.snapshot=null;this.playerId=null;
    this.pending=[];this.predicted=null;this.visualPlayers.clear();this.effects=[];this.feed=[];this._clearInput();
    this.dom.Hud.classList.remove('active');this.dom.Hud.setAttribute('aria-hidden','true');this.dom.Results.classList.remove('visible');
    this.dom.Scoreboard.classList.remove('visible');this._menu(false);this.closeLobby();
    this.dom.EntryActions.hidden=false;this.dom.JoinControls.hidden=false;this.dom.Waiting.hidden=true;
    this.dom.ChatLog.innerHTML='';this.onExit();
  }
}
