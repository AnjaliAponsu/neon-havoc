// NEON HAVOC — 30X Master Game Loop, Spatial Hash Grid, Fast Glow & UI/UX

import { GAME_CONFIG, SECTORS, META_UPGRADES, ENEMY_TYPES, COLORS, MULTIPLAYER_CONFIG, POWERUP_TYPES } from './constants.js';
import { soundEngine } from './audio.js';
import { saveManager } from './saveManager.js';
import { InputManager } from './input.js';
import { Renderer } from './renderer.js';
import { Player } from './entities/player.js';
import { Enemy } from './entities/enemy.js';
import { BulletPool } from './entities/bullet.js';
import { ParticlePool } from './entities/particle.js';
import { CrystalPool } from './entities/crystal.js';
import { FloatingTextManager } from './entities/floatingText.js';
import { WeaponSystem } from './systems/weaponSystem.js';
import { WaveManager } from './systems/waveManager.js';
import { upgradeManager } from './systems/upgradeManager.js';
import { PowerupManager } from './entities/powerup.js';
import { HazardManager } from './entities/hazard.js';
import { spatialGrid } from './spatialHash.js';
import { multiplayerManager } from './network/multiplayerManager.js';
import { TeamDeathmatchGame } from './teamDeathmatch.js';
import './teamDeathmatch.css';

class NeonHavocGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager(this.canvas);

    // Subsystems & Pools
    this.bulletPool = new BulletPool(700);
    this.particlePool = new ParticlePool(800);
    this.crystalPool = new CrystalPool(500);
    this.floatingTexts = new FloatingTextManager(140);
    this.weaponSystem = new WeaponSystem();
    this.powerupManager = new PowerupManager(25);
    this.hazardManager = new HazardManager();

    // Game State
    this.state = 'MENU';
    this.currentSector = SECTORS[0];
    this.player = null;
    this.enemies = [];
    this.activeBoss = null;
    this.waveManager = null;
    this.upgradeManager = upgradeManager;
    this.rerollsRemaining = 1;

    // Performance & FPS Tracking
    this.fps = 60;
    this.fpsTimer = 0;
    this.frameCount = 0;
    this.hudThrottle = 0;

    // Run Stats
    this.runKills = 0;
    this.runCrystals = 0;
    this.runScore = 0;

    // 30X Killstreak & Combo System
    this.comboStreak = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;

    // 30X Dodge Matrix & Bullet Time
    this.timeDilation = 1.0;
    this.bulletTimeTimer = 0;
    this.dodgeMatrixTriggered = false;

    // Multiplayer & Co-Op State
    this.gameMode = 'SOLO'; // 'SOLO' | 'LOCAL_COOP' | 'ONLINE_HOST' | 'ONLINE_CLIENT'
    this.isCoop = false;
    this.player2 = null;
    this.players = [];
    this.pendingMode = 'SOLO';
    this.networkSyncTimer = 0;
    this.isReviving = false;
    this.reviveP1 = null;
    this.reviveP2 = null;
    this.reviveProg = 0;

    // Timing
    this.lastTime = performance.now();
    this._toastTimer = null;

    // Cache DOM Elements
    this._cacheDom();
    this.battleground = new TeamDeathmatchGame(this.canvas, {
      onEnter: () => this._enterBattleground(),
      onExit: () => this._exitBattleground(),
      onFullscreen: () => this.toggleFullscreen(),
    });
    this._bindEvents();
    this._loadSettings();
    this._checkAutoJoin();

    // Start Animation Loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  toggleFullscreen() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      const isCurrentlyFs = document.documentElement.classList.contains('ios-fullscreen-mode');
      if (!isCurrentlyFs) {
        document.documentElement.classList.add('ios-fullscreen-mode');
        document.body.classList.add('ios-fullscreen-mode');
        window.scrollTo(0, 1);
        if (this.renderer && this.renderer.resize) this.renderer.resize();
        this.showToast('📱 iPhone Fullscreen Active! (Tip: Tap Share ➔ Add to Home Screen for borderless app)', 'info', 4500);
      } else {
        document.documentElement.classList.remove('ios-fullscreen-mode');
        document.body.classList.remove('ios-fullscreen-mode');
        if (this.renderer && this.renderer.resize) this.renderer.resize();
        this.showToast('Exited Fullscreen', 'info', 2000);
      }
      return;
    }

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const root = document.documentElement;
      const req = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
      if (req) {
        req.call(root).catch(() => {
          document.documentElement.classList.add('ios-fullscreen-mode');
          document.body.classList.add('ios-fullscreen-mode');
          if (this.renderer && this.renderer.resize) this.renderer.resize();
          this.showToast('📱 Fullscreen Active (Standalone Mode)', 'info', 3000);
        });
      } else {
        document.documentElement.classList.add('ios-fullscreen-mode');
        document.body.classList.add('ios-fullscreen-mode');
        if (this.renderer && this.renderer.resize) this.renderer.resize();
        this.showToast('📱 Fullscreen Active (Standalone Mode)', 'info', 3000);
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) {
        exit.call(document).catch(() => {});
      }
      document.documentElement.classList.remove('ios-fullscreen-mode');
      document.body.classList.remove('ios-fullscreen-mode');
      if (this.renderer && this.renderer.resize) this.renderer.resize();
    }
  }

  _cacheDom() {
    this.dom = {
      // HUD
      inGameHud: document.getElementById('inGameHud'),
      abilityTray: document.getElementById('abilityTray'),
      xpBarFill: document.getElementById('xpBarFill'),
      hpFill: document.getElementById('hpFill'),
      hpText: document.getElementById('hpText'),
      shieldFill: document.getElementById('shieldFill'),
      hudLevelBadge: document.getElementById('hudLevelBadge'),
      hudWaveBadge: document.getElementById('hudWaveBadge'),
      hudTimer: document.getElementById('hudTimer'),
      hudShards: document.getElementById('hudShards'),
      hudPowerupBadge: document.getElementById('hudPowerupBadge'),
      fpsCounter: document.getElementById('fpsCounter'),
      bossHudBar: document.getElementById('bossHudBar'),
      bossHpFill: document.getElementById('bossHpFill'),
      hudBossName: document.getElementById('hudBossName'),
      hudPauseBtn: document.getElementById('hudPauseBtn'),
      hudFullscreenBtn: document.getElementById('hudFullscreenBtn'),
      hudComboBadge: document.getElementById('hudComboBadge'),
      hudComboText: document.getElementById('hudComboText'),
      hudDownedAlert: document.getElementById('hudDownedAlert'),

      // Abilities
      slotDash: document.getElementById('slotDash'),
      slotShield: document.getElementById('slotShield'),
      slotWave: document.getElementById('slotWave'),
      slotOverdrive: document.getElementById('slotOverdrive'),
      cdDash: document.getElementById('cdDash'),
      cdShield: document.getElementById('cdShield'),
      cdWave: document.getElementById('cdWave'),
      cdOverdrive: document.getElementById('cdOverdrive'),
      lblDash: document.querySelector('#slotDash .ability-key'),
      lblShield: document.querySelector('#slotShield .ability-key'),
      lblWave: document.querySelector('#slotWave .ability-key'),
      lblOverdrive: document.querySelector('#slotOverdrive .ability-key'),
      hudDashPips: document.getElementById('hudDashPips'),
      odPercent: document.getElementById('odPercent'),

      // Cyber Bezel & Virtual Joystick
      bottomCyberFrame: document.getElementById('bottomCyberFrame'),
      virtualJoystickContainer: document.getElementById('virtualJoystickContainer'),
      virtualJoystickThumb: document.getElementById('virtualJoystickThumb'),
      virtualJoystickBase: document.getElementById('virtualJoystickBase'),

      // Touch Joysticks
      touchOverlay: document.getElementById('touchOverlay'),
      touchMoveBase: document.getElementById('touchMoveBase'),
      touchMoveThumb: document.getElementById('touchMoveThumb'),
      touchAimBase: document.getElementById('touchAimBase'),
      touchAimThumb: document.getElementById('touchAimThumb'),

      // Notifications & Toasts
      globalToast: document.getElementById('globalToast'),

      // Top Quick Actions & Profile / Achievements
      btnQuickProfile: document.getElementById('btnQuickProfile'),
      btnQuickAchievements: document.getElementById('btnQuickAchievements'),
      btnQuickQuit: document.getElementById('btnQuickQuit'),
      profileModal: document.getElementById('profileModal'),
      btnProfileClose: document.getElementById('btnProfileClose'),
      profRankTitle: document.getElementById('profRankTitle'),
      profTotalKills: document.getElementById('profTotalKills'),
      profHighScore: document.getElementById('profHighScore'),
      profMaxWave: document.getElementById('profMaxWave'),
      profShards: document.getElementById('profShards'),
      achievementsModal: document.getElementById('achievementsModal'),
      btnAchievementsClose: document.getElementById('btnAchievementsClose'),
      achievementsList: document.getElementById('achievementsList'),
      menuTechLabDot: document.getElementById('menuTechLabDot'),

      // Screens
      mainMenu: document.getElementById('mainMenu'),
      btnMenuCoop: document.getElementById('btnMenuCoop'),
      btnMenuOnline: document.getElementById('btnMenuOnline'),
      btnMenuBattleground: document.getElementById('btnMenuBattleground'),
      onlineModal: document.getElementById('onlineModal'),
      onlineRelayBadge: document.getElementById('onlineRelayBadge'),
      lanUrlDisplay: document.getElementById('lanUrlDisplay'),
      btnCopyLanUrl: document.getElementById('btnCopyLanUrl'),
      btnCreateRoom: document.getElementById('btnCreateRoom'),
      hostRoomDisplay: document.getElementById('hostRoomDisplay'),
      hostRoomCode: document.getElementById('hostRoomCode'),
      btnCopyRoomCode: document.getElementById('btnCopyRoomCode'),
      btnCopyInviteLink: document.getElementById('btnCopyInviteLink'),
      hostRoomStatus: document.getElementById('hostRoomStatus'),
      btnHostStartNow: document.getElementById('btnHostStartNow'),
      btnCancelHost: document.getElementById('btnCancelHost'),
      joinSectorCard: document.getElementById('joinSectorCard'),
      joinLockedBanner: document.getElementById('joinLockedBanner'),
      lanUrlHint: document.getElementById('lanUrlHint'),
      inputRoomCode: document.getElementById('inputRoomCode'),
      btnJoinRoom: document.getElementById('btnJoinRoom'),
      joinRoomStatus: document.getElementById('joinRoomStatus'),
      btnOnlineClose: document.getElementById('btnOnlineClose'),
      btnMenuFullscreen: document.getElementById('btnMenuFullscreen'),
      btnMenuSynergies: document.getElementById('btnMenuSynergies'),
      sectorModal: document.getElementById('sectorModal'),
      techLabModal: document.getElementById('techLabModal'),
      upgradeModal: document.getElementById('upgradeModal'),
      pauseModal: document.getElementById('pauseModal'),
      btnPauseFullscreen: document.getElementById('btnPauseFullscreen'),
      btnPauseSynergies: document.getElementById('btnPauseSynergies'),
      synergyModal: document.getElementById('synergyModal'),
      btnSynergyClose: document.getElementById('btnSynergyClose'),
      victoryModal: document.getElementById('victoryModal'),
      gameOverModal: document.getElementById('gameOverModal'),
      settingsModal: document.getElementById('settingsModal'),
      loreModal: document.getElementById('loreModal'),

      // Containers & Buttons
      upgradeCards: document.getElementById('upgradeCards'),
      btnUpgradeReroll: document.getElementById('btnUpgradeReroll'),
      btnUpgradeSkip: document.getElementById('btnUpgradeSkip'),
      sectorsList: document.getElementById('sectorsList'),
      techLabList: document.getElementById('techLabList'),
      labShards: document.getElementById('labShards'),
      btnTechLabRefund: document.getElementById('btnTechLabRefund'),

      // Settings Inputs
      volMaster: document.getElementById('volMaster'),
      volSfx: document.getElementById('volSfx'),
      volMusic: document.getElementById('volMusic'),
      chkScreenShake: document.getElementById('chkScreenShake'),
      chkAutoFire: document.getElementById('chkAutoFire'),
      chkAutoAim: document.getElementById('chkAutoAim'),
      chkLaserSight: document.getElementById('chkLaserSight'),
      chkDamageNumbers: document.getElementById('chkDamageNumbers'),

      // Result displays
      vicTime: document.getElementById('vicTime'),
      vicKills: document.getElementById('vicKills'),
      vicCrystals: document.getElementById('vicCrystals'),
      vicShards: document.getElementById('vicShards'),
      goTime: document.getElementById('goTime'),
      goWave: document.getElementById('goWave'),
      goKills: document.getElementById('goKills'),
      goShards: document.getElementById('goShards'),
    };
  }

  _bindEvents() {
    // Menu buttons
    document.getElementById('btnMenuPlay').onclick = () => {
      this.pendingMode = 'SOLO';
      this.isCoop = false;
      this.player2 = null;
      this.openSectorSelect();
    };
    if (this.dom.btnMenuCoop) {
      this.dom.btnMenuCoop.onclick = () => {
        this.pendingMode = 'LOCAL_COOP';
        this.openSectorSelect();
      };
    }
    if (this.dom.btnMenuOnline) {
      this.dom.btnMenuOnline.onclick = () => this.openOnlineModal();
    }
    if (this.dom.btnMenuBattleground) {
      this.dom.btnMenuBattleground.onclick = () => this.battleground.openLobby();
    }
    if (this.dom.btnOnlineClose) {
      this.dom.btnOnlineClose.onclick = () => {
        this._hideOverlay(this.dom.onlineModal);
        this.pendingMode = 'SOLO';
        this.player2 = null;
        multiplayerManager.disconnect();
      };
    }

    if (this.dom.btnCopyLanUrl) {
      this.dom.btnCopyLanUrl.onclick = () => {
        const url = window.location.origin + window.location.pathname;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            this.showToast('📋 Game URL copied! Send to your friend.', 'info');
          }).catch(() => {
            this.showToast('Game URL: ' + url, 'info');
          });
        } else {
          this.showToast('Game URL: ' + url, 'info');
        }
      };
    }

    if (this.dom.btnCopyRoomCode) {
      this.dom.btnCopyRoomCode.onclick = () => {
        const code = multiplayerManager.roomCode;
        if (!code) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            this.showToast(`📋 Room Code [${code}] copied to clipboard!`, 'success');
          }).catch(() => {
            this.showToast(`Room Code: ${code}`, 'success');
          });
        } else {
          this.showToast(`Room Code: ${code}`, 'success');
        }
      };
    }

    if (this.dom.btnCopyInviteLink) {
      this.dom.btnCopyInviteLink.onclick = () => {
        const code = multiplayerManager.roomCode;
        if (!code) return;
        const inviteUrl = window.location.origin + window.location.pathname + '?join=' + encodeURIComponent(code);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(inviteUrl).then(() => {
            this.showToast('🔗 Direct invite link copied! Friend will join automatically.', 'success');
          }).catch(() => {
            this.showToast(`Invite: ${inviteUrl}`, 'success');
          });
        } else {
          this.showToast(`Invite: ${inviteUrl}`, 'success');
        }
      };
    }

    if (this.dom.inputRoomCode) {
      this.dom.inputRoomCode.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
      this.dom.inputRoomCode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (this.dom.btnJoinRoom) this.dom.btnJoinRoom.click();
        }
      });
    }

    if (this.dom.btnCreateRoom) {
      this.dom.btnCreateRoom.onclick = () => {
        this.pendingMode = 'ONLINE_HOST';
        this.dom.btnCreateRoom.disabled = true;
        this.dom.btnCreateRoom.textContent = 'CONNECTING...';
        this.showToast('Connecting to Relay & creating sector...', 'info', 2000);
        multiplayerManager.createRoom(SECTORS[0]).catch((err) => {
          this.dom.btnCreateRoom.disabled = false;
          this.dom.btnCreateRoom.textContent = 'CREATE HOST ROOM';
          this.showToast('Failed to create room: ' + (err.message || 'Relay offline'), 'error');
        });
      };
    }

    if (this.dom.btnJoinRoom) {
      this.dom.btnJoinRoom.onclick = () => {
        if (multiplayerManager.role === 'HOST') {
          this.showToast('⚠️ You are already hosting Sector [' + (multiplayerManager.roomCode || '') + ']! Player 2 should enter this code on their laptop.', 'warning', 5000);
          return;
        }
        const code = (this.dom.inputRoomCode ? this.dom.inputRoomCode.value : '').trim().toUpperCase();
        if (!code || code.length < 4) {
          if (this.dom.joinRoomStatus) {
            this.dom.joinRoomStatus.textContent = 'Enter 4-letter code!';
            this.dom.joinRoomStatus.style.color = '#ff0055';
          }
          this.showToast('⚠️ Please enter a 4-letter room code', 'warning');
          return;
        }
        this.pendingMode = 'ONLINE_CLIENT';
        if (this.dom.joinRoomStatus) {
          this.dom.joinRoomStatus.textContent = 'Connecting to room ' + code + '...';
          this.dom.joinRoomStatus.style.color = '#00f0ff';
        }
        this.dom.btnJoinRoom.disabled = true;
        this.showToast('Connecting to Sector [' + code + ']...', 'info', 2500);
        multiplayerManager.joinRoom(code).catch((err) => {
          this.dom.btnJoinRoom.disabled = false;
          if (this.dom.joinRoomStatus) {
            this.dom.joinRoomStatus.textContent = 'Connection failed!';
            this.dom.joinRoomStatus.style.color = '#ff0055';
          }
          this.showToast('Failed to connect: ' + (err.message || 'Relay offline'), 'error');
        });
      };
    }

    if (this.dom.btnHostStartNow) {
      this.dom.btnHostStartNow.onclick = () => {
        this._hideOverlay(this.dom.onlineModal);
        this.startRun(SECTORS[0], 'ONLINE_HOST');
      };
    }

    if (this.dom.btnCancelHost) {
      this.dom.btnCancelHost.onclick = () => {
        multiplayerManager.leaveRoom();
        this._unlockJoinCard();
        if (this.dom.hostRoomDisplay) this.dom.hostRoomDisplay.style.display = 'none';
        if (this.dom.btnCreateRoom) {
          this.dom.btnCreateRoom.disabled = false;
          this.dom.btnCreateRoom.textContent = 'CREATE HOST ROOM';
        }
        this.showToast('Sector canceled. You can now host again or join as Player 2.', 'info');
      };
    }

    // Multiplayer Network Callbacks
    multiplayerManager.onStatusChangeCb = (online) => {
      this._updateRelayBadge(online ? 'ONLINE' : 'OFFLINE');
    };

    multiplayerManager.onServerInfoCb = () => {
      this._updateLanAddressDisplay();
    };

    multiplayerManager.onRoomCreatedCb = (code) => {
      if (this.dom.btnCreateRoom) {
        this.dom.btnCreateRoom.disabled = true;
        this.dom.btnCreateRoom.textContent = '👑 HOSTING ACTIVE';
      }
      if (this.dom.hostRoomDisplay) this.dom.hostRoomDisplay.style.display = 'block';
      if (this.dom.hostRoomCode) this.dom.hostRoomCode.textContent = code;
      if (this.dom.hostRoomStatus) this.dom.hostRoomStatus.textContent = 'Waiting for Player 2 to connect...';

      // Lock Join Card on Host laptop so user doesn't accidentally fill their own room!
      if (this.dom.joinLockedBanner) this.dom.joinLockedBanner.style.display = 'block';
      if (this.dom.inputRoomCode) {
        this.dom.inputRoomCode.disabled = true;
        this.dom.inputRoomCode.value = '';
        this.dom.inputRoomCode.placeholder = code;
      }
      if (this.dom.btnJoinRoom) {
        this.dom.btnJoinRoom.disabled = true;
        this.dom.btnJoinRoom.textContent = 'WAITING FOR P2 ON LAPTOP 2';
      }
      if (this.dom.joinRoomStatus) {
        this.dom.joinRoomStatus.textContent = 'Enter this code on Laptop 2!';
        this.dom.joinRoomStatus.style.color = '#00ff88';
      }

      soundEngine.playLevelUp();
      this.showToast(`✅ Room [${code}] ready! On Laptop 2, enter code [${code}] to join.`, 'success', 5000);
    };

    multiplayerManager.onPlayerJoinedCb = () => {
      soundEngine.playLevelUp();
      this.showToast('🎉 Player 2 (Nova-02) connected to sector!', 'success', 4000);

      if (this.state === 'PLAYING') {
        // Hot-join: Player 2 joins an active host match in progress!
        if (!this.player2) {
          const metaMods = this._calculateMetaModifiers();
          this.player2 = new Player(this.player.x + 60, this.player.y, metaMods, 2);
          this.player2.isRemote = true;
          this.players = [this.player, this.player2];
          this.isCoop = true;
          this.floatingTexts.spawn(this.player2.x, this.player2.y - 45, 'NOVA-02 JOINED! 🚀', '#ff00aa', '#00f0ff', true, 22);
        }
      } else {
        if (this.dom.hostRoomStatus) this.dom.hostRoomStatus.textContent = '🎉 PLAYER 2 CONNECTED! DEPLOYING...';
        setTimeout(() => {
          this._hideOverlay(this.dom.onlineModal);
          this.startRun(SECTORS[0], 'ONLINE_HOST');
        }, 900);
      }
    };

    multiplayerManager.onJoinSuccessCb = (code, sector) => {
      if (this.dom.joinRoomStatus) {
        this.dom.joinRoomStatus.textContent = 'CONNECTED! DEPLOYING...';
        this.dom.joinRoomStatus.style.color = '#00ff88';
      }
      soundEngine.playLevelUp();
      this.showToast(`🚀 Connected to Sector [${code}]! Deploying...`, 'success');
      setTimeout(() => {
        this._hideOverlay(this.dom.onlineModal);
        const sec = sector ? (SECTORS.find(s => s.id === sector.id) || SECTORS[0]) : SECTORS[0];
        this.startRun(sec, 'ONLINE_CLIENT');
      }, 900);
    };

    multiplayerManager.onJoinErrorCb = (err) => {
      if (this.dom.btnJoinRoom) this.dom.btnJoinRoom.disabled = false;
      const msg = err || 'Join failed!';
      if (this.dom.joinRoomStatus) {
        this.dom.joinRoomStatus.textContent = msg;
        this.dom.joinRoomStatus.style.color = '#ff0055';
      }
      soundEngine.playDash();
      this.showToast('❌ ' + msg, 'error');
    };

    multiplayerManager.onPeerDisconnectedCb = (msg) => {
      this.showToast('⚠️ Co-op Teammate disconnected: ' + (msg || 'Connection lost'), 'warning', 4000);
      if (this.gameMode === 'ONLINE_HOST' && this.player2) {
        this.player2 = null;
        this.players = [this.player];
        this.isCoop = false;
      }
    };

    multiplayerManager.onPeerStateCb = (payload) => {
      if (this.gameMode === 'ONLINE_HOST' && payload.p2 && this.player2) {
        this.player2.targetNetX = payload.p2.x;
        this.player2.targetNetY = payload.p2.y;
        this.player2.targetNetVx = payload.p2.vx || 0;
        this.player2.targetNetVy = payload.p2.vy || 0;
        this.player2.aimAngle = payload.p2.aimAngle;
        this.input.p2IsShooting = payload.p2.isShooting;
        if (payload.p2.hp !== undefined) this.player2.health = payload.p2.hp;
        if (payload.p2.isDashing && !this.player2.isDashing) this.player2.dash(soundEngine, this.particlePool);
        if (payload.p2.isOverdrive && !this.player2.isOverdrive) this.player2.activateOverdrive(soundEngine, this.particlePool);
      } else if (this.gameMode === 'ONLINE_CLIENT' && payload.p1 && this.player) {
        this.player.targetNetX = payload.p1.x;
        this.player.targetNetY = payload.p1.y;
        this.player.targetNetVx = payload.p1.vx || 0;
        this.player.targetNetVy = payload.p1.vy || 0;
        this.player.aimAngle = payload.p1.aimAngle;
        this.input.p1IsShooting = payload.p1.isShooting;
        if (payload.p1.hp !== undefined) this.player.health = payload.p1.hp;
        if (payload.p1.isDashing && !this.player.isDashing) this.player.dash(soundEngine, this.particlePool);
        if (payload.p1.isOverdrive && !this.player.isOverdrive) this.player.activateOverdrive(soundEngine, this.particlePool);
      }
    };

    // Top Quick Actions
    if (this.dom.btnQuickProfile) {
      this.dom.btnQuickProfile.onclick = () => this.openProfileModal();
    }
    if (this.dom.btnQuickAchievements) {
      this.dom.btnQuickAchievements.onclick = () => this.openAchievementsModal();
    }
    if (this.dom.btnQuickQuit) {
      this.dom.btnQuickQuit.onclick = () => {
        soundEngine.playDash();
        this.showToast('⚡ Spectrum core active. Simulation standby.', 'info', 3000);
      };
    }
    if (this.dom.btnProfileClose) {
      this.dom.btnProfileClose.onclick = () => this._hideOverlay(this.dom.profileModal);
    }
    if (this.dom.btnAchievementsClose) {
      this.dom.btnAchievementsClose.onclick = () => this._hideOverlay(this.dom.achievementsModal);
    }

    // Audio SFX on Menu Hover
    const menuHoverButtons = document.querySelectorAll('.mode-btn, .menu-nav-btn, .quick-icon-btn');
    menuHoverButtons.forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        try {
          soundEngine.initAudio();
          soundEngine.playSfx(520, 0.04, 'sine', 0.06);
        } catch (e) {}
      });
    });

    this.updateMenuNotifications();

    document.getElementById('btnMenuTechLab').onclick = () => this.openTechLab();
    if (this.dom.btnMenuSynergies) {
      this.dom.btnMenuSynergies.onclick = () => this._showOverlay(this.dom.synergyModal);
    }
    document.getElementById('btnMenuLore').onclick = () => this.openLore();
    document.getElementById('btnMenuSettings').onclick = () => this.openSettings();
    if (this.dom.btnMenuFullscreen) {
      this.dom.btnMenuFullscreen.onclick = () => this.toggleFullscreen();
    }

    // Synergy Modal
    if (this.dom.btnSynergyClose) {
      this.dom.btnSynergyClose.onclick = () => this._hideOverlay(this.dom.synergyModal);
    }

    // Sector Modal
    document.getElementById('btnSectorClose').onclick = () => this._hideOverlay(this.dom.sectorModal);

    // Tech Lab Modal
    document.getElementById('btnTechLabClose').onclick = () => {
      this._hideOverlay(this.dom.techLabModal);
      this.updateMenuNotifications();
    };
    if (this.dom.btnTechLabRefund) {
      this.dom.btnTechLabRefund.onclick = () => {
        const refunded = saveManager.refundMetaUpgrades(META_UPGRADES);
        if (refunded > 0) {
          soundEngine.playLevelUp();
          this.openTechLab();
        }
      };
    }

    // Upgrade Modal Buttons (Reroll & Skip)
    if (this.dom.btnUpgradeReroll) {
      this.dom.btnUpgradeReroll.onclick = () => {
        if (this.rerollsRemaining > 0) {
          this.rerollsRemaining--;
          soundEngine.playPistol();
          this.triggerLevelUp(false);
        }
      };
    }
    if (this.dom.btnUpgradeSkip) {
      this.dom.btnUpgradeSkip.onclick = () => {
        this.runCrystals += 50;
        saveManager.addShards(25);
        soundEngine.playLevelUp();
        this._hideOverlay(this.dom.upgradeModal);
        this.state = 'PLAYING';
        this.lastTime = performance.now();
      };
    }

    // Global Keydown & Shortcut Handler
    window.addEventListener('keydown', (e) => {
      if (this.battleground?.active || this.battleground?.dom.Lobby.classList.contains('active')) return;
      if (e.code === 'KeyF' || e.code === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
        return;
      }

      if (e.code === 'KeyT') {
        if (this.dom.chkAutoAim) {
          this.dom.chkAutoAim.checked = this.input.autoAim;
        }
        saveManager.data.settings.autoAim = this.input.autoAim;
        saveManager.save();
      }

      if (e.code === 'KeyH') {
        if (this.dom.synergyModal && this.dom.synergyModal.classList.contains('active')) {
          this._hideOverlay(this.dom.synergyModal);
        } else if (this.dom.synergyModal) {
          this._showOverlay(this.dom.synergyModal);
        }
      }

      if (this.state === 'UPGRADE_MODAL') {
        if (e.code === 'Digit1') this._chooseCard(0);
        if (e.code === 'Digit2') this._chooseCard(1);
        if (e.code === 'Digit3') this._chooseCard(2);
        if (e.code === 'KeyR' && this.rerollsRemaining > 0) {
          this.rerollsRemaining--;
          soundEngine.playPistol();
          this.triggerLevelUp(false);
        }
        if (e.code === 'KeyS') {
          this.runCrystals += 50;
          saveManager.addShards(25);
          soundEngine.playLevelUp();
          this._hideOverlay(this.dom.upgradeModal);
          this.state = 'PLAYING';
          this.lastTime = performance.now();
        }
      } else if (this.state === 'GAME_OVER') {
        if (e.code === 'KeyR' || e.code === 'Space') {
          this.startRun(this.currentSector);
        }
      } else if (this.state === 'VICTORY') {
        if (e.code === 'Space') {
          this._hideOverlay(this.dom.victoryModal);
          this.openTechLab();
        }
      }
    });

    // Ability slot clicks (mouse or touch)
    this.dom.slotDash.onclick = () => { this.input.dashPressed = true; };
    this.dom.slotShield.onclick = () => { this.input.shieldPressed = true; };
    this.dom.slotWave.onclick = () => { this.input.shockwavePressed = true; };
    this.dom.slotOverdrive.onclick = () => { this.input.overdrivePressed = true; };

    // Fullscreen HUD Button
    if (this.dom.hudFullscreenBtn) {
      this.dom.hudFullscreenBtn.onclick = () => this.toggleFullscreen();
    }

    // Pause Modal
    this.dom.hudPauseBtn.onclick = () => this.togglePause();
    document.getElementById('btnPauseResume').onclick = () => this.togglePause();
    if (this.dom.btnPauseSynergies) {
      this.dom.btnPauseSynergies.onclick = () => this._showOverlay(this.dom.synergyModal);
    }
    if (this.dom.btnPauseFullscreen) {
      this.dom.btnPauseFullscreen.onclick = () => this.toggleFullscreen();
    }
    document.getElementById('btnPauseSettings').onclick = () => this.openSettings();
    document.getElementById('btnPauseQuit').onclick = () => this.returnToMenu();

    // Victory & Game Over buttons
    document.getElementById('btnVicContinue').onclick = () => {
      this._hideOverlay(this.dom.victoryModal);
      this.openTechLab();
    };
    document.getElementById('btnVicMenu').onclick = () => this.returnToMenu();

    document.getElementById('btnGoRetry').onclick = () => this.startRun(this.currentSector);
    document.getElementById('btnGoMenu').onclick = () => this.returnToMenu();

    // Lore & Settings
    document.getElementById('btnLoreClose').onclick = () => this._hideOverlay(this.dom.loreModal);
    document.getElementById('btnSettingsClose').onclick = () => this._hideOverlay(this.dom.settingsModal);

    // Lore Modal Category Tabs
    const loreTabs = document.querySelectorAll('#loreTabs .guide-tab-btn');
    loreTabs.forEach(btn => {
      btn.onclick = () => {
        loreTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const cards = document.querySelectorAll('#loreContentContainer .guide-section-card');
        if (targetId === 'loreSecAll') {
          cards.forEach(c => c.style.display = 'block');
        } else {
          cards.forEach(c => {
            c.style.display = (c.id === targetId) ? 'block' : 'none';
          });
        }
      };
    });

    // Synergy Modal (Arsenal Archive & Power Guide) Category Tabs
    const synTabs = document.querySelectorAll('#synTabs .guide-tab-btn');
    synTabs.forEach(btn => {
      btn.onclick = () => {
        synTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const sections = document.querySelectorAll('#synergyModal .syn-tab-content');
        sections.forEach(sec => {
          sec.style.display = (sec.id === targetId) ? 'block' : 'none';
        });
      };
    });

    // Settings listeners
    this.dom.volMaster.oninput = () => this._updateAudioVolumes();
    this.dom.volSfx.oninput = () => this._updateAudioVolumes();
    this.dom.volMusic.oninput = () => this._updateAudioVolumes();
    this.dom.chkScreenShake.onchange = (e) => {
      saveManager.data.settings.screenShake = e.target.checked;
      saveManager.save();
    };
    this.dom.chkAutoFire.onchange = (e) => {
      this.input.autoFire = e.target.checked;
      saveManager.data.settings.autoFire = e.target.checked;
      saveManager.save();
    };
    if (this.dom.chkAutoAim) {
      this.dom.chkAutoAim.onchange = (e) => {
        this.input.autoAim = e.target.checked;
        saveManager.data.settings.autoAim = e.target.checked;
        saveManager.save();
      };
    }
    if (this.dom.chkLaserSight) {
      this.dom.chkLaserSight.onchange = (e) => {
        saveManager.data.settings.laserSight = e.target.checked;
        saveManager.save();
      };
    }
    this.dom.chkDamageNumbers.onchange = (e) => {
      saveManager.data.settings.damageNumbers = e.target.checked;
      saveManager.save();
    };
  }

  _loadSettings() {
    const s = saveManager.data.settings;
    this.dom.volMaster.value = s.masterVolume;
    this.dom.volSfx.value = s.sfxVolume;
    this.dom.volMusic.value = s.musicVolume;
    this.dom.chkScreenShake.checked = s.screenShake;
    this.dom.chkAutoFire.checked = s.autoFire;
    this.dom.chkDamageNumbers.checked = s.damageNumbers;
    this.input.autoFire = s.autoFire;

    if (this.dom.chkAutoAim) {
      this.dom.chkAutoAim.checked = !!s.autoAim;
      this.input.autoAim = !!s.autoAim;
    }
    if (this.dom.chkLaserSight) {
      this.dom.chkLaserSight.checked = s.laserSight !== false;
    }

    this._updateAudioVolumes();
  }

  _updateAudioVolumes() {
    const m = parseFloat(this.dom.volMaster.value);
    const s = parseFloat(this.dom.volSfx.value);
    const bgm = parseFloat(this.dom.volMusic.value);
    soundEngine.setVolume(m, s, bgm);
    saveManager.data.settings.masterVolume = m;
    saveManager.data.settings.sfxVolume = s;
    saveManager.data.settings.musicVolume = bgm;
    saveManager.save();
  }

  showToast(message, type = 'info', duration = 3200) {
    const toast = this.dom.globalToast;
    if (!toast) return;
    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }

    let bg = 'rgba(0, 240, 255, 0.94)';
    let color = '#050a15';
    let border = '1px solid #00f0ff';
    let shadow = '0 0 24px rgba(0, 240, 255, 0.6)';

    if (type === 'success') {
      bg = 'rgba(0, 255, 136, 0.96)';
      color = '#050a15';
      border = '1px solid #00ff88';
      shadow = '0 0 24px rgba(0, 255, 136, 0.6)';
    } else if (type === 'error') {
      bg = 'rgba(255, 0, 85, 0.96)';
      color = '#ffffff';
      border = '1px solid #ff0055';
      shadow = '0 0 24px rgba(255, 0, 85, 0.6)';
    } else if (type === 'warning') {
      bg = 'rgba(255, 230, 0, 0.96)';
      color = '#050a15';
      border = '1px solid #ffe600';
      shadow = '0 0 24px rgba(255, 230, 0, 0.6)';
    }

    toast.textContent = message;
    toast.style.background = bg;
    toast.style.color = color;
    toast.style.border = border;
    toast.style.boxShadow = shadow;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px)';
      setTimeout(() => {
        if (toast.style.opacity === '0') {
          toast.style.display = 'none';
        }
      }, 300);
    }, duration);
  }

  _showOverlay(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = 'flex';
    modalEl.classList.add('active');
  }

  _hideOverlay(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    modalEl.classList.remove('active');
  }

  _hideAllOverlays() {
    const overlays = document.querySelectorAll('.screen-overlay');
    overlays.forEach((el) => {
      el.style.display = 'none';
      el.classList.remove('active');
    });
  }

  _updateRelayBadge(status = null) {
    if (!this.dom.onlineRelayBadge) return;
    const badge = this.dom.onlineRelayBadge;
    const isOnline = status === 'ONLINE' || (status === null && multiplayerManager.isConnected);
    const isConnecting = status === 'CONNECTING';

    if (isConnecting) {
      badge.textContent = '🟡 CONNECTING...';
      badge.style.color = '#ffe600';
      badge.style.borderColor = 'rgba(255, 230, 0, 0.4)';
      badge.style.background = 'rgba(255, 230, 0, 0.12)';
    } else if (isOnline) {
      badge.textContent = '● RELAY ONLINE';
      badge.style.color = '#00ff88';
      badge.style.borderColor = '#00ff88';
      badge.style.background = 'rgba(0, 255, 136, 0.12)';
    } else {
      badge.textContent = '● RELAY OFFLINE';
      badge.style.color = '#ff0055';
      badge.style.borderColor = '#ff0055';
      badge.style.background = 'rgba(255, 0, 85, 0.12)';
    }
  }

  _unlockJoinCard() {
    if (this.dom.joinLockedBanner) this.dom.joinLockedBanner.style.display = 'none';
    if (this.dom.inputRoomCode) {
      this.dom.inputRoomCode.disabled = false;
      this.dom.inputRoomCode.placeholder = 'CODE';
      this.dom.inputRoomCode.value = '';
    }
    if (this.dom.btnJoinRoom) {
      this.dom.btnJoinRoom.disabled = false;
      this.dom.btnJoinRoom.textContent = 'CONNECT & DEPLOY';
    }
    if (this.dom.joinRoomStatus) {
      this.dom.joinRoomStatus.textContent = 'Enter 4-letter Code';
      this.dom.joinRoomStatus.style.color = '#ff00aa';
    }
  }

  _updateLanAddressDisplay() {
    if (!this.dom.lanUrlDisplay) return;
    try {
      const port = window.location.port ? `:${window.location.port}` : '';
      const path = window.location.pathname || '/';
      let lanIp = null;
      if (multiplayerManager.serverLanIps && multiplayerManager.serverLanIps.length > 0) {
        lanIp = multiplayerManager.serverLanIps.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.')) || multiplayerManager.serverLanIps[0];
      }

      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (lanIp) {
          const lanUrl = `http://${lanIp}${port}${path}`;
          this.dom.lanUrlDisplay.textContent = lanUrl;
          if (this.dom.lanUrlHint) {
            this.dom.lanUrlHint.textContent = `👉 Open ${lanUrl} on Laptop 2 via WiFi, then enter Sector Code!`;
            this.dom.lanUrlHint.style.color = '#00ff88';
          }
          return;
        }
      }
      this.dom.lanUrlDisplay.textContent = window.location.origin + path;
    } catch (e) {
      this.dom.lanUrlDisplay.textContent = window.location.origin || 'http://localhost:5173/';
    }
  }

  openOnlineModal() {
    this._showOverlay(this.dom.onlineModal);

    // Update Game Address display using detected LAN IP
    this._updateLanAddressDisplay();

    if (this.dom.hostRoomDisplay) this.dom.hostRoomDisplay.style.display = 'none';
    if (this.dom.btnCreateRoom) {
      this.dom.btnCreateRoom.disabled = false;
      this.dom.btnCreateRoom.textContent = 'CREATE HOST ROOM';
    }
    this._unlockJoinCard();

    this._updateRelayBadge();

    // Auto-connect to relay
    if (!multiplayerManager.isConnected) {
      this._updateRelayBadge('CONNECTING');
      multiplayerManager.connect()
        .then(() => {
          this._updateRelayBadge('ONLINE');
          this._updateLanAddressDisplay();
        })
        .catch(() => {
          this._updateRelayBadge('OFFLINE');
        });
    }
  }

  _checkAutoJoin() {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join');
      if (joinCode) {
        const cleanCode = joinCode.trim().toUpperCase().substring(0, 4);
        if (cleanCode.length === 4) {
          this.openOnlineModal();
          if (this.dom.inputRoomCode) {
            this.dom.inputRoomCode.value = cleanCode;
          }
          this.showToast(`🔗 Auto-detected invite code [${cleanCode}]! Click CONNECT & DEPLOY.`, 'info', 5000);
        }
      }
    } catch (e) {
      console.warn('[AutoJoin] URL query check failed:', e);
    }
  }

  updateMenuNotifications() {
    if (this.dom.menuTechLabDot) {
      const shards = saveManager.data.spectrumShards || 0;
      const canUpgrade = META_UPGRADES.some(u => {
        const rank = saveManager.getMetaRank(u.id);
        return rank < u.maxRank && shards >= u.costs[rank];
      });
      this.dom.menuTechLabDot.style.display = canUpgrade ? 'block' : 'none';
    }
  }

  openProfileModal() {
    this._showOverlay(this.dom.profileModal);
    const stats = saveManager.data.stats || {};
    const shards = saveManager.data.spectrumShards || 0;
    const kills = stats.totalKills || 0;
    const bestScore = stats.bestScore || 0;
    const maxWave = stats.highestWave || 1;

    if (this.dom.profTotalKills) this.dom.profTotalKills.textContent = kills.toLocaleString();
    if (this.dom.profHighScore) this.dom.profHighScore.textContent = bestScore.toLocaleString();
    if (this.dom.profMaxWave) this.dom.profMaxWave.textContent = `Wave ${maxWave}`;
    if (this.dom.profShards) this.dom.profShards.textContent = `${shards} 💎`;

    if (this.dom.profRankTitle) {
      let rank = 'SPECTRUM INITIATE';
      if (kills > 2000) rank = 'VOID OVERLORD';
      else if (kills > 1000) rank = 'SPECTRUM VANGUARD';
      else if (kills > 400) rank = 'CORONA ENFORCER';
      else if (kills > 100) rank = 'PHOTON STRIKER';
      this.dom.profRankTitle.textContent = `RANK: ${rank}`;
    }
  }

  openAchievementsModal() {
    this._showOverlay(this.dom.achievementsModal);
    const list = this.dom.achievementsList;
    if (!list) return;

    const stats = saveManager.data.stats || {};
    const shards = saveManager.data.spectrumShards || 0;
    const kills = stats.totalKills || 0;

    const achievements = [
      {
        id: 'first_blood',
        icon: '⚔️',
        title: 'FIRST ENGAGEMENT',
        desc: 'Destroy at least 50 Void entities in combat.',
        unlocked: kills >= 50,
        progress: `${Math.min(kills, 50)} / 50`
      },
      {
        id: 'void_hunter',
        icon: '🎯',
        title: 'VOID PURIFIER',
        desc: 'Neutralize 500 total Void enemies.',
        unlocked: kills >= 500,
        progress: `${Math.min(kills, 500)} / 500`
      },
      {
        id: 'shard_hoarder',
        icon: '💎',
        title: 'SPECTRUM HARVESTER',
        desc: 'Accumulate 250 or more Spectrum Shards.',
        unlocked: shards >= 250,
        progress: `${Math.min(shards, 250)} / 250`
      },
      {
        id: 'wave_veteran',
        icon: '🌊',
        title: 'SURVIVAL SPECIALIST',
        desc: 'Reach Wave 5 in any Combat Sector.',
        unlocked: (stats.highestWave || 1) >= 5,
        progress: `Wave ${stats.highestWave || 1} / 5`
      },
      {
        id: 'titan_slayer',
        icon: '👑',
        title: 'TITAN ECLIPSE',
        desc: 'Eliminate a Void Titan sector boss.',
        unlocked: (stats.bossesDefeated || 0) >= 1,
        progress: `${stats.bossesDefeated || 0} Defeated`
      },
      {
        id: 'coop_synergy',
        icon: '👥',
        title: 'HARMONIC BROTHERHOOD',
        desc: 'Deploy in Co-op mode with a fellow pilot.',
        unlocked: (saveManager.data.stats.totalRuns || 0) >= 2,
        progress: `${saveManager.data.stats.totalRuns || 0} / 2 Runs`
      }
    ];

    list.innerHTML = achievements.map(ach => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; background: ${ach.unlocked ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${ach.unlocked ? 'rgba(0, 240, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}; box-shadow: ${ach.unlocked ? '0 0 15px rgba(0, 240, 255, 0.15)' : 'none'};">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="font-size: 26px; filter: ${ach.unlocked ? 'drop-shadow(0 0 8px #00f0ff)' : 'grayscale(1) opacity(0.4)'};">
            ${ach.icon}
          </div>
          <div style="text-align: left;">
            <div style="font-family: var(--font-display); font-size: 14px; font-weight: 800; color: ${ach.unlocked ? '#ffe600' : 'rgba(255,255,255,0.6)'}; letter-spacing: 1px;">
              ${ach.title}
            </div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 2px;">
              ${ach.desc}
            </div>
          </div>
        </div>
        <div style="text-align: right; font-family: var(--font-display); font-size: 11px; font-weight: 700; color: ${ach.unlocked ? '#00ff88' : 'rgba(255,255,255,0.4)'};">
          ${ach.unlocked ? '✅ UNLOCKED' : ach.progress}
        </div>
      </div>
    `).join('');
  }

  openSectorSelect() {
    this._renderSectorsList();
    this._showOverlay(this.dom.sectorModal);
  }

  _renderSectorsList() {
    const container = this.dom.sectorsList;
    container.innerHTML = '';

    SECTORS.forEach((sec) => {
      const isUnlocked = saveManager.data.unlockedSectors.includes(sec.id);
      const card = document.createElement('div');
      card.className = `sector-card ${isUnlocked ? '' : 'locked'}`;

      let diffClass = 'diff-normal';
      if (sec.difficulty === 'Hard') diffClass = 'diff-hard';
      if (sec.difficulty === 'Insane') diffClass = 'diff-insane';

      card.innerHTML = `
        <div class="sector-info">
          <h3>${sec.name} ${isUnlocked ? '' : '🔒'}</h3>
          <p>${sec.subtitle} — ${sec.description}</p>
        </div>
        <div class="sector-diff ${diffClass}">
          ${sec.difficulty}
        </div>
      `;

      if (isUnlocked) {
        card.onclick = () => {
          this._hideOverlay(this.dom.sectorModal);
          this.startRun(sec, this.pendingMode);
        };
      }
      container.appendChild(card);
    });
  }

  openTechLab() {
    this._renderTechLabList();
    this.dom.labShards.textContent = saveManager.data.spectrumShards;
    this._showOverlay(this.dom.techLabModal);
  }

  _renderTechLabList() {
    const container = this.dom.techLabList;
    container.innerHTML = '';
    const shards = saveManager.data.spectrumShards;

    META_UPGRADES.forEach((meta) => {
      const currentRank = saveManager.getMetaRank(meta.id);
      const isMax = currentRank >= meta.maxRank;
      const cost = isMax ? 0 : meta.costs[currentRank];
      const canAfford = !isMax && shards >= cost;

      const item = document.createElement('div');
      item.className = 'tech-item';
      item.innerHTML = `
        <div class="tech-header">
          <div class="tech-name">${meta.icon} ${meta.title}</div>
          <div class="tech-rank">RANK ${currentRank} / ${meta.maxRank}</div>
        </div>
        <div class="tech-desc">${meta.desc}</div>
        <button class="tech-buy-btn" ${canAfford ? '' : 'disabled'}>
          ${isMax ? 'MAX RANK' : `UPGRADE (${cost} 💎)`}
        </button>
      `;

      const buyBtn = item.querySelector('.tech-buy-btn');
      if (canAfford) {
        buyBtn.onclick = () => {
          if (saveManager.upgradeMeta(meta.id, cost)) {
            soundEngine.playLevelUp();
            this.openTechLab();
          }
        };
      }
      container.appendChild(item);
    });
  }

  openLore() {
    this._showOverlay(this.dom.loreModal);
  }

  openSettings() {
    this._showOverlay(this.dom.settingsModal);
  }

  _calculateMetaModifiers() {
    const mods = {
      maxHealthBonus: 0,
      speedBonus: 0,
      damageBonus: 0,
      magnetBonus: 0,
      dashCdBonus: 0,
      extraDashes: 0,
      shardBonus: 0,
    };

    META_UPGRADES.forEach((meta) => {
      const rank = saveManager.getMetaRank(meta.id);
      if (rank > 0 && meta.effect) {
        const eff = meta.effect(rank);
        Object.assign(mods, eff);
      }
    });

    return mods;
  }

  startRun(sector = SECTORS[0], mode = this.pendingMode || 'SOLO') {
    this.currentSector = sector;
    this.gameMode = mode;
    this.isCoop = mode === 'LOCAL_COOP' || (mode === 'ONLINE_HOST' && multiplayerManager.isMultiplayerActive) || mode === 'ONLINE_CLIENT';

    this._hideAllOverlays();
    this.dom.mainMenu.style.display = 'none';
    this.dom.inGameHud.style.display = 'flex';
    this.dom.abilityTray.style.display = 'flex';
    if (this.dom.bottomCyberFrame) this.dom.bottomCyberFrame.style.display = 'flex';
    if (this.dom.virtualJoystickContainer) this.dom.virtualJoystickContainer.style.display = 'block';
    if (this.dom.bossHudBar) this.dom.bossHudBar.style.display = 'none';
    if (this.dom.hudDownedAlert) this.dom.hudDownedAlert.style.display = 'none';

    // Clear pools & state
    this.bulletPool.clear();
    this.particlePool.clear();
    this.crystalPool.clear();
    this.powerupManager.clear();
    this.floatingTexts.clear();
    this.hazardManager.setup(this.currentSector);
    this.enemies = [];
    this.activeBoss = null;
    this.rerollsRemaining = 1;

    // Reset counters
    this.runKills = 0;
    this.runCrystals = 0;
    this.runScore = 0;

    // Reset 30X combo
    this.comboStreak = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    if (this.dom.hudComboBadge) this.dom.hudComboBadge.style.display = 'none';
    this.input.resetActions();

    // 30X Sector Theming & Dodge Matrix reset
    this.renderer.setSector(this.currentSector);
    this.timeDilation = 1.0;
    this.bulletTimeTimer = 0;
    this.dodgeMatrixTriggered = false;

    // Initialize Entities
    const metaMods = this._calculateMetaModifiers();
    const spawnX = GAME_CONFIG.ARENA_WIDTH / 2;
    const spawnY = GAME_CONFIG.ARENA_HEIGHT / 2;

    if (this.gameMode === 'LOCAL_COOP') {
      this.player = new Player(spawnX - 45, spawnY, metaMods, 1);
      this.player2 = new Player(spawnX + 45, spawnY, metaMods, 2);
      this.player.isRemote = false;
      this.player2.isRemote = false;
      this.players = [this.player, this.player2];
    } else if (this.gameMode === 'ONLINE_HOST') {
      this.player = new Player(spawnX, spawnY, metaMods, 1);
      this.player.isRemote = false;
      if (multiplayerManager.isMultiplayerActive) {
        this.player2 = new Player(spawnX + 60, spawnY, metaMods, 2);
        this.player2.isRemote = true;
        this.players = [this.player, this.player2];
      } else {
        this.player2 = null;
        this.players = [this.player];
      }
    } else if (this.gameMode === 'ONLINE_CLIENT') {
      this.player = new Player(spawnX - 60, spawnY, metaMods, 1);
      this.player.isRemote = true;
      this.player2 = new Player(spawnX, spawnY, metaMods, 2);
      this.player2.isRemote = false;
      this.players = [this.player, this.player2];
    } else {
      // SOLO
      this.player = new Player(spawnX, spawnY, metaMods, 1);
      this.player.isRemote = false;
      this.player2 = null;
      this.players = [this.player];
    }

    // Anchor camera immediately at local player location
    const camInitPlayer = (this.gameMode === 'ONLINE_CLIENT' && this.player2) ? this.player2 : this.player;
    this.renderer.camera.x = camInitPlayer.x;
    this.renderer.camera.y = camInitPlayer.y;

    this.waveManager = new WaveManager(this.currentSector);

    // Spawn immediate opening Vanguard scouting wave (Instant Action)
    this.waveManager.spawnOpeningVanguard(this.players, this.enemies, this.particlePool, soundEngine);

    // Pre-populate tactical supply drops nearby as in reference storyboard
    const px = camInitPlayer.x;
    const py = camInitPlayer.y;
    this.powerupManager.spawn(px - 320, py - 180, POWERUP_TYPES.HEALTH);
    this.powerupManager.spawn(px + 340, py + 210, POWERUP_TYPES.OVERDRIVE);

    // Scatter 12 gleaming XP diamond crystals around the opening arena
    for (let i = 0; i < 12; i++) {
      const ca = (i * Math.PI * 2) / 12 + Math.random() * 0.4;
      const cd = 160 + Math.random() * 260;
      this.crystalPool.spawn(px + Math.cos(ca) * cd, py + Math.sin(ca) * cd, 10);
    }

    // Audio & State
    soundEngine.startMusic();
    soundEngine.setIntensity(1);
    this.state = 'PLAYING';
    this.lastTime = performance.now();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this._showOverlay(this.dom.pauseModal);
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this._hideOverlay(this.dom.pauseModal);
      this.lastTime = performance.now();
    }
  }

  returnToMenu() {
    this._hideAllOverlays();
    this.dom.mainMenu.style.display = 'flex';
    this.dom.inGameHud.style.display = 'none';
    this.dom.abilityTray.style.display = 'none';
    if (this.dom.bottomCyberFrame) this.dom.bottomCyberFrame.style.display = 'none';
    if (this.dom.virtualJoystickContainer) this.dom.virtualJoystickContainer.style.display = 'none';
    this.dom.bossHudBar.style.display = 'none';
    soundEngine.stopMusic();
    this.pendingMode = 'SOLO';
    this.gameMode = 'SOLO';
    this.isCoop = false;
    this.player2 = null;
    this.players = [];
    this.state = 'MENU';
  }

  _enterBattleground() {
    this._hideAllOverlays();
    this.dom.mainMenu.style.display = 'none';
    this.dom.inGameHud.style.display = 'none';
    this.dom.abilityTray.style.display = 'none';
    if (this.dom.bottomCyberFrame) this.dom.bottomCyberFrame.style.display = 'none';
    if (this.dom.virtualJoystickContainer) this.dom.virtualJoystickContainer.style.display = 'none';
    soundEngine.stopMusic();
    this.state = 'BATTLEGROUND';
    this.lastTime = performance.now();
  }

  _exitBattleground() {
    this._hideAllOverlays();
    this.dom.mainMenu.style.display = 'flex';
    this.dom.inGameHud.style.display = 'none';
    this.dom.abilityTray.style.display = 'none';
    if (this.dom.bottomCyberFrame) this.dom.bottomCyberFrame.style.display = 'none';
    if (this.dom.virtualJoystickContainer) this.dom.virtualJoystickContainer.style.display = 'none';
    this.state = 'MENU';
    this.lastTime = performance.now();
  }

  triggerLevelUp(resetReroll = true) {
    this.state = 'UPGRADE_MODAL';
    if (resetReroll) this.rerollsRemaining = 1;
    if (this.dom.btnUpgradeReroll) {
      this.dom.btnUpgradeReroll.textContent = `REROLL CHOICES 🎲 [R] (${this.rerollsRemaining})`;
      this.dom.btnUpgradeReroll.disabled = this.rerollsRemaining <= 0;
    }
    const choices = upgradeManager.generateChoices(this.player, 3);
    this._renderUpgradeCards(choices);
    this._showOverlay(this.dom.upgradeModal);
  }

  _chooseCard(idx) {
    if (this.state !== 'UPGRADE_MODAL') return;
    const upg = upgradeManager.applyChoice(idx, this.player);
    if (upg) {
      if (this.player2) {
        upg.apply(this.player2);
      }
      soundEngine.playLevelUp();
      this._hideOverlay(this.dom.upgradeModal);
      this.state = 'PLAYING';
      this.lastTime = performance.now();
      this.input.resetActions();
    }
  }

  _renderUpgradeCards(choices) {
    const container = this.dom.upgradeCards;
    container.innerHTML = '';

    const categoryLabels = {
      weapon: 'WEAPON',
      player: 'MOBILITY',
      survival: 'DEFENSE',
      ability: 'ABILITY',
      evolution: 'SUPER WEAPON',
    };

    choices.forEach((upg, idx) => {
      const card = document.createElement('div');
      card.className = `upgrade-card ${upg.rarity}`;
      const imgPath = upg.image || './assets/powers/power_pulse_blaster.svg';
      const catLabel = categoryLabels[upg.category] || (upg.category || 'AUGMENT').toUpperCase();

      card.innerHTML = `
        <div class="upgrade-card-header">
          <span class="upgrade-category-tag">${catLabel}</span>
          <span class="upgrade-hotkey-badge">KEY [${idx + 1}]</span>
        </div>

        <div class="upgrade-identity">
          <span class="upgrade-icon">${upg.icon}</span>
          <div class="upgrade-name-wrap">
            <div class="upgrade-title" title="${upg.title}">${upg.title}</div>
            <span class="upgrade-rarity rarity-${upg.rarity}">${upg.rarity.toUpperCase()}</span>
          </div>
        </div>

        <div class="upgrade-card-preview">
          <div class="preview-hud-tag">TACTICAL PREVIEW</div>
          <img src="${imgPath}" alt="${upg.title}" />
        </div>

        <div class="upgrade-desc-box">
          <div class="upgrade-desc-text">${upg.desc}</div>
        </div>

        <div class="upgrade-select-btn">
          <span>EQUIP AUGMENTATION</span>
          <kbd>[${idx + 1}]</kbd>
        </div>
      `;

      card.onclick = () => this._chooseCard(idx);
      container.appendChild(card);
    });
  }

  _onPowerupCollected(type, px, py) {
    soundEngine.playLevelUp();
    this.particlePool.spawnShockwave(px, py, type.color, 180);
    this.floatingTexts.spawn(px, py - 25, `${type.name.toUpperCase()}!`, type.color, type.color, true, 18);

    if (type.id === 'nuke') {
      soundEngine.playShockwave();
      this.renderer.addTrauma(0.85);
      this.renderer.triggerHitStop(0.06);
      this.renderer.grid.applyExplosion(this.player.x, this.player.y, 90, 400);

      // Obliterate minor enemies
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.active || e.isDead || e.isBoss) continue;
        e.takeDamage(999, soundEngine, this.particlePool, this.floatingTexts, true);
      }
    } else if (type.id === 'magnet') {
      for (let i = 0; i < this.crystalPool.pool.length; i++) {
        if (this.crystalPool.pool[i].active) {
          this.crystalPool.pool[i].magnetized = true;
        }
      }
    } else if (type.id === 'freeze') {
      this.player.chronoFreezeTimer = 5.0;
      if (this.player2) this.player2.chronoFreezeTimer = 5.0;
    } else if (type.id === 'battery') {
      this.player.overdriveCharge = 100;
      if (this.player2) this.player2.overdriveCharge = 100;
    } else if (type.id === 'shield') {
      this.player.invulnPowerupTimer = 6.0;
      if (this.player2) this.player2.invulnPowerupTimer = 6.0;
    } else if (type.id === 'heal') {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + this.player.maxHealth * 0.5);
      if (this.player2) this.player2.health = Math.min(this.player2.maxHealth, this.player2.health + this.player2.maxHealth * 0.5);
    }
  }

  onEnemyKilled(enemy) {
    this.runKills++;
    this.runScore += enemy.score;
    soundEngine.playEnemyPop(enemy.radius / 12);

    // 30X Killstreak & Combo
    this.comboStreak++;
    this.comboTimer = 2.4;
    if (this.comboStreak > this.maxCombo) {
      this.maxCombo = this.comboStreak;
    }

    if (this.comboStreak === 10 || this.comboStreak === 25 || this.comboStreak === 50 || this.comboStreak === 100) {
      this.renderer.triggerGlitch(0.22, 10);
      soundEngine.playLevelUp();
      if (this.player) {
        this.floatingTexts.spawn(
          this.player.x,
          this.player.y - 45,
          `${this.comboStreak}x KILLSTREAK!`,
          '#ff00aa',
          '#ffe600',
          true,
          26
        );
      }
    }

    // Dynamic grid shockwave deformation
    const force = enemy.isBoss ? 85 : enemy.isElite ? 55 : enemy.type === 'tank' ? 45 : 25;
    const rad = enemy.isBoss ? 350 : enemy.isElite ? 240 : enemy.type === 'tank' ? 200 : 130;
    this.renderer.grid.applyExplosion(enemy.x, enemy.y, force, rad);

    // Fiery Starburst Kill Explosion & Radiant Shock Ring (Matching Reference Storyboard)
    this.particlePool.spawnStarburst(enemy.x, enemy.y, '#ffe600', enemy.radius * 1.6);
    this.particlePool.spawnShockwave(enemy.x, enemy.y, enemy.glow || '#ff00aa', enemy.radius * 2.2);
    this.particlePool.burst(enemy.x, enemy.y, enemy.color || '#ff2255', enemy.isBoss ? 50 : enemy.isElite ? 22 : 10, 240, 2.5);
    this.renderer.addScorchMark(enemy.x, enemy.y, enemy.radius * (enemy.isBoss ? 2.6 : enemy.isElite ? 1.8 : 1.1), enemy.glow || '#ff00aa');

    // Screen Shake Trauma
    if (saveManager.data.settings.screenShake) {
      if (enemy.isBoss) {
        this.renderer.addTrauma(0.9);
        this.renderer.triggerHitStop(0.08);
      } else if (enemy.isElite) {
        this.renderer.addTrauma(0.45);
        this.renderer.triggerHitStop(0.04);
      } else if (enemy.type === 'tank') {
        this.renderer.addTrauma(0.3);
      }
    }

    if (enemy.isElite) {
      this.powerupManager.spawn(enemy.x, enemy.y);
    }

    // Splitter death division
    if (enemy.type === 'splitter' && enemy.radius > 10) {
      const miniCount = 2;
      for (let i = 0; i < miniCount; i++) {
        const miniType = {
          ...ENEMY_TYPES.SPLITTER,
          radius: 9,
          speed: 175,
          health: 15,
          damage: 8,
          xp: 8,
          behavior: 'rush',
        };
        const angle = (i * Math.PI * 2) / miniCount;
        const mx = enemy.x + Math.cos(angle) * 16;
        const my = enemy.y + Math.sin(angle) * 16;
        this.waveManager.spawnQueue.push({ type: miniType, x: mx, y: my });
      }
    }

    // Spawn XP Crystals
    const crystalCount = enemy.isBoss ? 24 : enemy.isElite ? 8 : enemy.type === 'tank' ? 4 : 1;
    for (let i = 0; i < crystalCount; i++) {
      const cx = enemy.x + (Math.random() - 0.5) * enemy.radius;
      const cy = enemy.y + (Math.random() - 0.5) * enemy.radius;
      this.crystalPool.spawn(cx, cy, enemy.xp);
    }

    // Boss killed
    if (enemy.isBoss) {
      if (enemy.type === 'singularity_boss') {
        this.waveManager.boss2Defeated = true;
      } else {
        this.waveManager.boss1Defeated = true;
      }
      this.activeBoss = null;
      this.dom.bossHudBar.style.display = 'none';
      soundEngine.setIntensity(2);
      this.particlePool.burst(enemy.x, enemy.y, '#ff0055', 90, 480, 7);
      this.floatingTexts.spawn(enemy.x, enemy.y - 40, 'CORE ANNIHILATED!', '#ffe600', '#ffaa00', true, 28);
      this.powerupManager.spawn(enemy.x, enemy.y);
    }
  }

  onVictory() {
    this.state = 'VICTORY';
    soundEngine.stopMusic();
    soundEngine.playLevelUp();

    const shardsEarned = Math.round(
      (this.runCrystals * 0.15 + this.runKills * 0.25 + 200) * (1 + (this.player.stats.shardBonus || 0))
    );
    saveManager.addShards(shardsEarned);
    saveManager.recordRunResult({
      time: this.waveManager.timer,
      kills: this.runKills,
      crystals: this.runCrystals,
      wave: this.waveManager.currentWave,
      score: this.runScore,
      bossKilled: true,
      sectorId: this.currentSector.id,
    });

    const m = Math.floor(this.waveManager.timer / 60);
    const s = Math.floor(this.waveManager.timer % 60);
    this.dom.vicTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.dom.vicKills.textContent = this.runKills;
    this.dom.vicCrystals.textContent = this.runCrystals;
    this.dom.vicShards.textContent = `+${shardsEarned} 💎`;

    this._showOverlay(this.dom.victoryModal);
  }

  onGameOver() {
    this.state = 'GAME_OVER';
    soundEngine.stopMusic();
    soundEngine.playGameOver();

    const shardsEarned = Math.round(
      (this.runCrystals * 0.08 + this.runKills * 0.1) * (1 + (this.player.stats.shardBonus || 0))
    );
    saveManager.addShards(shardsEarned);
    saveManager.recordRunResult({
      time: this.waveManager.timer,
      kills: this.runKills,
      crystals: this.runCrystals,
      wave: this.waveManager.currentWave,
      score: this.runScore,
      bossKilled: false,
      sectorId: this.currentSector.id,
    });

    const m = Math.floor(this.waveManager.timer / 60);
    const s = Math.floor(this.waveManager.timer % 60);
    this.dom.goTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.dom.goWave.textContent = `Wave ${this.waveManager.currentWave}`;
    this.dom.goKills.textContent = this.runKills;
    this.dom.goShards.textContent = `+${shardsEarned} 💎`;

    this._showOverlay(this.dom.gameOverModal);
  }

  gameLoop(currentTime) {
    try {
      if (!currentTime || isNaN(currentTime)) {
        currentTime = performance.now();
      }
      if (!this.lastTime || isNaN(this.lastTime)) {
        this.lastTime = currentTime;
      }
      const rawDt = Math.max(0.001, Math.min(0.08, (currentTime - this.lastTime) / 1000));
      this.lastTime = currentTime;

      // 30X Dodge Matrix Bullet-Time Dilation
      if (this.bulletTimeTimer > 0) {
        this.bulletTimeTimer -= rawDt;
        this.timeDilation = 0.35;
        if (this.bulletTimeTimer <= 0) {
          this.timeDilation = 1.0;
        }
      } else {
        this.timeDilation = 1.0;
      }

      const dt = Math.max(0.001, Math.min(0.064, rawDt * this.timeDilation));

      if (this.state === 'BATTLEGROUND') {
        this.battleground.frame(Math.min(0.05, rawDt));
        return;
      }

      // FPS Meter
      this.frameCount++;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 0.5) {
        this.fps = Math.round(this.frameCount / this.fpsTimer);
        this.frameCount = 0;
        this.fpsTimer = 0;
        if (this.dom.fpsCounter) {
          this.dom.fpsCounter.textContent = `${this.fps} FPS`;
        }
      }

      // Hit-stop crunch freeze handling
      if (this.renderer.hitStopTimer > 0) {
        this.renderer.hitStopTimer = Math.max(0, this.renderer.hitStopTimer - dt);
        this.particlePool.update(dt);
        const camTarget = (this.gameMode === 'ONLINE_CLIENT' && this.player2) ? this.player2 : this.player;
        const camX = camTarget ? camTarget.x : (GAME_CONFIG.ARENA_WIDTH / 2);
        const camY = camTarget ? camTarget.y : (GAME_CONFIG.ARENA_HEIGHT / 2);
        this.renderer.updateCamera(dt, camX, camY, !!this.activeBoss, camTarget ? camTarget.isOverdrive : false);
        this.render();
        return;
      }

      if (this.state === 'PLAYING') {
        this.update(dt);
      }

      this.render();
    } catch (err) {
      console.error('[GameLoop Exception caught and recovered]:', err);
    } finally {
      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  update(dt) {
    const player = this.player;
    if (!player) return;

    if (this.input.consumePause()) {
      this.togglePause();
      return;
    }

    if (this.input.consumeFullscreen()) {
      this.toggleFullscreen();
    }

    // 0. Populate Spatial Hash Grid for O(1) broadphase queries
    spatialGrid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.active && !e.isDead) {
        spatialGrid.insert(e);
      }
    }

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboStreak = 0;
      }
    }

    // 1. Update Input relative to camera position with smart auto-aim targets
    const primaryFocusPlayer = (this.gameMode === 'ONLINE_CLIENT' && this.player2) ? this.player2 : player;
    const playerScreenPos = this.renderer.getScreenPos(primaryFocusPlayer.x, primaryFocusPlayer.y);
    this.input.update(playerScreenPos, { x: primaryFocusPlayer.x, y: primaryFocusPlayer.y }, this.enemies, this.isCoop, this.player2);

    // 2. Update Players (With Co-Op Wingman Follow & Dedicated Online Roles)
    let p1Input;
    let p2Input;

    if (this.gameMode === 'ONLINE_CLIENT') {
      p1Input = { moveX: 0, moveY: 0, aimAngle: player.aimAngle, isShooting: false, consumeDash: () => false, consumeShield: () => false, consumeShockwave: () => false, consumeOverdrive: () => false };
      p2Input = this.input.getPlayer1Input();
    } else if (this.gameMode === 'ONLINE_HOST') {
      p1Input = this.input.getPlayer1Input();
      p2Input = { moveX: 0, moveY: 0, aimAngle: this.player2 ? this.player2.aimAngle : 0, isShooting: this.input.p2IsShooting, consumeDash: () => false, consumeShield: () => false, consumeShockwave: () => false, consumeOverdrive: () => false };
    } else {
      // LOCAL_COOP:
      p1Input = this.input.getPlayer1Input();
      const rawP2 = this.input.getPlayer2Input();
      const p2HasActiveMove = Math.hypot(rawP2.moveX, rawP2.moveY) > 0.05 || this.input.p2IsShooting;

      if (!p2HasActiveMove && this.player2) {
        // Wingman Follow mode: Player 2 stays alongside Player 1!
        const targetX = player.x + (player.vx !== 0 ? Math.sign(player.vx) * -55 : 55);
        const targetY = player.y + 25;
        const dx = targetX - this.player2.x;
        const dy = targetY - this.player2.y;
        const dist = Math.hypot(dx, dy);
        let fx = 0, fy = 0;
        if (dist > 35) {
          fx = Math.max(-1, Math.min(1, dx / 80));
          fy = Math.max(-1, Math.min(1, dy / 80));
        }
        if (player.isDashing && !this.player2.isDashing) this.player2.dash(soundEngine, this.particlePool);
        p2Input = {
          moveX: fx,
          moveY: fy,
          aimAngle: rawP2.aimAngle || player.aimAngle,
          isShooting: rawP2.isShooting || this.input.isShooting || this.input.autoFire,
          consumeDash: () => false,
          consumeShield: () => false,
          consumeShockwave: () => false,
          consumeOverdrive: () => false
        };
      } else {
        p2Input = rawP2;
      }
    }

    player.update(dt, p1Input, soundEngine, this.particlePool, this.floatingTexts);
    player.checkIonTrailDamage(this.enemies, soundEngine, this.particlePool, this.floatingTexts);
    if (this.player2) {
      this.player2.update(dt, p2Input, soundEngine, this.particlePool, this.floatingTexts);
      this.player2.checkIonTrailDamage(this.enemies, soundEngine, this.particlePool, this.floatingTexts);
    }

    // Dynamic grid kinetic wake & ripples under movement
    if (Math.hypot(player.vx, player.vy) > 20) {
      this.renderer.grid.applyWake(player.x, player.y, player.vx, player.vy);
    }

    // Grid ripple & 30X Dodge Matrix on Dash
    const anyDashing = player.isDashing || (this.player2 && this.player2.isDashing);
    if (anyDashing) {
      const dashP = player.isDashing ? player : this.player2;
      this.renderer.grid.applyExplosion(dashP.x, dashP.y, 45, 170);

      // Trigger Dodge Matrix if dashing near swarms or threats
      if (!this.dodgeMatrixTriggered && this.bulletTimeTimer <= 0) {
        let threatNearby = false;
        spatialGrid.queryNearby(dashP.x, dashP.y, 140, (e) => {
          if (e.active && !e.isDead) threatNearby = true;
        });
        if (threatNearby) {
          this.dodgeMatrixTriggered = true;
          this.bulletTimeTimer = 0.42;
          this.renderer.triggerGlitch(0.18, 6);
          soundEngine.playGraze();
          this.floatingTexts.spawn(dashP.x, dashP.y - 40, 'DODGE MATRIX! ⏳', '#00f0ff', '#ffe600', true, 22);
        }
      }
    } else {
      this.dodgeMatrixTriggered = false;
    }

    // Trigger crosshair recoil kick on weapon firing
    if (this.input.isShooting || this.input.p2IsShooting || this.input.autoFire) {
      this.renderer.triggerRecoil(2.5);
    }

    // 3. Shockwave trigger handling (Player 1 + Player 2)
    const shockwavePlayers = [player];
    if (this.player2) shockwavePlayers.push(this.player2);

    shockwavePlayers.forEach((p) => {
      if (p.shockwaveTriggered) {
        const sw = p.shockwaveTriggered;
        p.shockwaveTriggered = null;
        if (saveManager.data.settings.screenShake) {
          this.renderer.addTrauma(0.5);
        }
        this.renderer.grid.applyExplosion(sw.x, sw.y, 85, sw.radius);

        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.active || e.isDead) continue;
          const d = Math.hypot(e.x - sw.x, e.y - sw.y);
          if (d < sw.radius) {
            e.takeDamage(sw.damage, soundEngine, this.particlePool, this.floatingTexts, true);
            e.applyKnockback(Math.atan2(e.y - sw.y, e.x - sw.x), 70);
          }
        }
      }
    });

    // 3.5 Co-Op Revival Tether Mechanics
    this.isReviving = false;
    if (this.isCoop && this.player2) {
      if (this.player.isDowned && !this.player2.isDowned) {
        const d = Math.hypot(this.player.x - this.player2.x, this.player.y - this.player2.y);
        if (d < MULTIPLAYER_CONFIG.REVIVE_RADIUS) {
          this.isReviving = true;
          this.reviveP1 = this.player2;
          this.reviveP2 = this.player;
          this.player.reviveProgress += dt / MULTIPLAYER_CONFIG.REVIVE_TIME;
          this.reviveProg = this.player.reviveProgress;
          if (this.player.reviveProgress >= 1.0) {
            this.player.revive(soundEngine, this.particlePool, this.floatingTexts);
            this.isReviving = false;
          }
        } else {
          this.player.reviveProgress = Math.max(0, this.player.reviveProgress - dt * 0.5);
        }
      } else if (this.player2.isDowned && !this.player.isDowned) {
        const d = Math.hypot(this.player.x - this.player2.x, this.player.y - this.player2.y);
        if (d < MULTIPLAYER_CONFIG.REVIVE_RADIUS) {
          this.isReviving = true;
          this.reviveP1 = this.player;
          this.reviveP2 = this.player2;
          this.player2.reviveProgress += dt / MULTIPLAYER_CONFIG.REVIVE_TIME;
          this.reviveProg = this.player2.reviveProgress;
          if (this.player2.reviveProgress >= 1.0) {
            this.player2.revive(soundEngine, this.particlePool, this.floatingTexts);
            this.isReviving = false;
          }
        } else {
          this.player2.reviveProgress = Math.max(0, this.player2.reviveProgress - dt * 0.5);
        }
      }

      if (this.dom.hudDownedAlert) {
        if (this.player.isDowned || this.player2.isDowned) {
          const who = this.player.isDowned ? 'SPARK-01' : 'NOVA-02';
          this.dom.hudDownedAlert.textContent = `⚡ ${who} IS DOWN! STAND NEAR CORE TO REVIVE! ⚡`;
          this.dom.hudDownedAlert.style.display = 'block';
        } else {
          this.dom.hudDownedAlert.style.display = 'none';
        }
      }
    }

    // 4. Update Hazards & Powerups (Pylons, Accel Boost Pads, Volatile Barrels & Orbital Drops)
    this.hazardManager.update(dt, this.bulletPool, this.enemies, soundEngine, this.particlePool, this.floatingTexts, player, this.player2, this.renderer);
    this.powerupManager.update(dt, player.x, player.y, (type, px, py) => this._onPowerupCollected(type, px, py));
    if (this.player2 && !this.player2.isDowned) {
      this.powerupManager.update(dt, this.player2.x, this.player2.y, (type, px, py) => this._onPowerupCollected(type, px, py));
    }

    // 5. Weapons & Projectiles (Dedicated Controls for Host & Client)
    let weaponsInputList;
    if (this.gameMode === 'ONLINE_CLIENT') {
      weaponsInputList = [
        { isShooting: !!this.input.p1IsShooting, autoFire: false },
        this.input.getPlayer1Input()
      ];
    } else if (this.gameMode === 'ONLINE_HOST') {
      weaponsInputList = [
        this.input.getPlayer1Input(),
        { isShooting: !!this.input.p2IsShooting, autoFire: false }
      ];
    } else {
      weaponsInputList = [
        this.input.getPlayer1Input(),
        this.input.getPlayer2Input()
      ];
    }

    this.weaponSystem.update(
      dt,
      this.players,
      weaponsInputList,
      this.bulletPool,
      soundEngine,
      this.particlePool,
      this.enemies,
      this.floatingTexts,
      this.isCoop
    );

    // 6. Update Wave Progression & Boss Director
    this.waveManager.update(
      dt,
      this.players,
      this.enemies,
      soundEngine,
      this.particlePool,
      this.floatingTexts,
      (boss) => {
        this.activeBoss = boss;
        if (this.dom.bossHudBar) this.dom.bossHudBar.style.display = 'flex';
        if (this.dom.hudBossName) this.dom.hudBossName.textContent = `⚠️ ${boss.name.toUpperCase()} ⚠️`;
      },
      () => this.onVictory(),
      (wave, wx, wy) => {
        if (this.renderer && this.renderer.triggerWaveClear) {
          this.renderer.triggerWaveClear(wave, wx, wy);
        }
        if (soundEngine && soundEngine.playShockwave) {
          soundEngine.playShockwave();
        }
      }
    );

    // 7. Update Enemies & Contact Collisions
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.active || enemy.isDead) {
        this.onEnemyKilled(enemy);
        this.enemies.splice(i, 1);
        continue;
      }

      enemy.update(
        dt,
        this.players,
        this.bulletPool,
        this.particlePool,
        soundEngine,
        this.floatingTexts,
        this.waveManager.spawnQueue
      );

      // Contact collision for each active player
      for (let pIdx = 0; pIdx < this.players.length; pIdx++) {
        const p = this.players[pIdx];
        if (!p || p.isDowned) continue;
        const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (dist < enemy.radius + p.radius) {
          if (p.isOverdrive) {
            enemy.takeDamage(999, soundEngine, this.particlePool, this.floatingTexts, true);
          } else {
            p.takeDamage(enemy.damage * dt * 2, soundEngine, this.particlePool, this.floatingTexts, this.isCoop);
            enemy.applyKnockback(Math.atan2(enemy.y - p.y, enemy.x - p.x), 15);
          }
        }
      }
    }

    // 8. Update Crystals with vacuum physics towards nearest player
    this.crystalPool.update(dt, this.players, (crystal) => {
      this.runCrystals++;
      soundEngine.playCrystal();
      this.particlePool.burst(crystal.x, crystal.y, crystal.color, 4, 100, 1.5);

      let comboMult = 1.0;
      if (this.comboStreak >= 50) comboMult = 3.0;
      else if (this.comboStreak >= 25) comboMult = 2.0;
      else if (this.comboStreak >= 10) comboMult = 1.5;
      else if (this.comboStreak >= 5) comboMult = 1.2;

      const xpGained = Math.round(crystal.value * comboMult);
      const primaryPlayer = (this.gameMode === 'ONLINE_CLIENT' && this.player2) ? this.player2 : player;
      const leveledUp = primaryPlayer.addXp(xpGained, soundEngine, this.floatingTexts);
      if (this.player2 && primaryPlayer !== this.player2) {
        this.player2.addXp(xpGained, soundEngine, this.floatingTexts);
      }
      if (leveledUp) {
        if (this.gameMode === 'ONLINE_HOST' || this.gameMode === 'ONLINE_CLIENT') {
          // In online co-op: auto-apply random upgrade so neither player's screen halts!
          const choices = upgradeManager.generateChoices(primaryPlayer, 1);
          if (choices.length > 0) {
            upgradeManager.applyChoice(0, primaryPlayer);
            this.floatingTexts.spawn(primaryPlayer.x, primaryPlayer.y - 45, `+${choices[0].title.toUpperCase()}!`, '#ffe600', '#00f0ff', true, 16);
          }
        } else {
          this.triggerLevelUp();
        }
      }
    });

    // 9. Update Bullets, Particles, and Floating Texts
    this.bulletPool.update(dt, this.particlePool);
    this.particlePool.update(dt);
    this.floatingTexts.update(dt);

    // 10. Camera Tracking with Dedicated Viewports (Multi-Device Freedom)
    let camTargetX = player.x;
    let camTargetY = player.y;

    if (this.gameMode === 'ONLINE_CLIENT' && this.player2) {
      camTargetX = this.player2.x;
      camTargetY = this.player2.y;
    } else if (this.gameMode === 'LOCAL_COOP' && this.player2) {
      camTargetX = (player.x + this.player2.x) / 2;
      camTargetY = (player.y + this.player2.y) / 2;
    } else {
      camTargetX = player.x;
      camTargetY = player.y;
    }

    const pDist = (this.gameMode === 'LOCAL_COOP' && this.player2) ? Math.hypot(player.x - this.player2.x, player.y - this.player2.y) : 0;
    this.renderer.updateCamera(
      dt,
      camTargetX,
      camTargetY,
      !!this.activeBoss,
      player.isOverdrive || (this.player2 && this.player2.isOverdrive),
      pDist
    );

    // 10.5 High-Speed Online Multiplayer State Relay (50Hz)
    if (multiplayerManager.isMultiplayerActive) {
      this.networkSyncTimer = (this.networkSyncTimer || 0) + dt;
      if (this.networkSyncTimer >= 0.02) {
        this.networkSyncTimer = 0;
        if (this.gameMode === 'ONLINE_HOST' && this.player) {
          multiplayerManager.sendState({
            p1: {
              x: this.player.x,
              y: this.player.y,
              vx: this.player.vx,
              vy: this.player.vy,
              hp: this.player.health,
              maxHp: this.player.maxHealth,
              aimAngle: this.player.aimAngle,
              isShooting: this.input.isShooting || this.input.autoFire,
              isDashing: this.player.isDashing,
              isOverdrive: this.player.isOverdrive,
              isDowned: this.player.isDowned
            }
          });
        } else if (this.gameMode === 'ONLINE_CLIENT' && this.player2) {
          multiplayerManager.sendState({
            p2: {
              x: this.player2.x,
              y: this.player2.y,
              vx: this.player2.vx,
              vy: this.player2.vy,
              hp: this.player2.health,
              maxHp: this.player2.maxHealth,
              aimAngle: this.player2.aimAngle,
              isShooting: this.input.isShooting || this.input.autoFire,
              isDashing: this.player2.isDashing,
              isOverdrive: this.player2.isOverdrive,
              isDowned: this.player2.isDowned
            }
          });
        }
      }
    }

    // 11. Check Game Over
    if (this.isCoop) {
      const p1Dead = this.player && (this.player.isDowned && this.player.downedTimer <= 0 || (this.player.health <= 0 && !this.player.isDowned));
      const p2Dead = this.player2 && (this.player2.isDowned && this.player2.downedTimer <= 0 || (this.player2.health <= 0 && !this.player2.isDowned));
      const p1Downed = this.player && (this.player.isDowned || this.player.health <= 0);
      const p2Downed = this.player2 && (this.player2.isDowned || this.player2.health <= 0);

      if (this.player && !this.player2) {
        if (p1Dead) {
          this.onGameOver();
          return;
        }
      } else if (!this.player && this.player2) {
        if (p2Dead) {
          this.onGameOver();
          return;
        }
      } else if (this.player && this.player2) {
        if ((p1Downed && p2Downed) || (p1Dead && p2Dead)) {
          this.onGameOver();
          return;
        }
      }
    } else {
      if (player && player.health <= 0) {
        this.onGameOver();
        return;
      }
    }

    // 12. Update HUD
    this._updateHud();
  }

  _updateHud() {
    const p = (this.gameMode === 'ONLINE_CLIENT' && this.player2) ? this.player2 : this.player;
    if (!p) return;
    const w = this.waveManager;

    const hpPct = Math.max(0, (p.health / p.maxHealth) * 100);
    this.dom.hpFill.style.width = `${hpPct}%`;

    if (this.dom.hpText) {
      this.dom.hpText.textContent = `${Math.ceil(p.health)} / ${p.maxHealth} HP`;
    }

    const shieldPct = p.maxShield > 0 ? (p.shield / p.maxShield) * 100 : 0;
    this.dom.shieldFill.style.width = `${shieldPct}%`;

    const xpPct = Math.min(100, (p.xp / p.xpToNextLevel) * 100);
    this.dom.xpBarFill.style.width = `${xpPct}%`;
    this.dom.hudLevelBadge.textContent = `LVL ${p.level}`;

    this.dom.hudWaveBadge.textContent = `WAVE ${w.currentWave} / ${w.totalWaves}`;
    const m = Math.floor(w.timer / 60);
    const s = Math.floor(w.timer % 60);
    this.dom.hudTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.dom.hudShards.textContent = this.runCrystals;

    // 30X Killstreak & Combo Badge
    if (this.dom.hudComboBadge && this.dom.hudComboText) {
      if (this.comboStreak >= 3 && this.comboTimer > 0) {
        this.dom.hudComboBadge.style.display = 'flex';
        let mult = '1.0x';
        if (this.comboStreak >= 50) mult = '3.0x';
        else if (this.comboStreak >= 25) mult = '2.0x';
        else if (this.comboStreak >= 10) mult = '1.5x';
        else if (this.comboStreak >= 5) mult = '1.2x';
        this.dom.hudComboText.textContent = `${this.comboStreak} COMBO (${mult})`;
        const timerRatio = Math.max(0.35, this.comboTimer / 2.4);
        this.dom.hudComboBadge.style.opacity = `${timerRatio}`;
      } else {
        this.dom.hudComboBadge.style.display = 'none';
      }
    }

    // Active Powerup indicator
    if (this.dom.hudPowerupBadge) {
      if (p.chronoFreezeTimer > 0) {
        this.dom.hudPowerupBadge.style.display = 'block';
        this.dom.hudPowerupBadge.textContent = `❄️ CHRONO STASIS: ${p.chronoFreezeTimer.toFixed(1)}s`;
      } else if (p.invulnPowerupTimer > 0) {
        this.dom.hudPowerupBadge.style.display = 'block';
        this.dom.hudPowerupBadge.textContent = `🛡️ INVULNERABLE: ${p.invulnPowerupTimer.toFixed(1)}s`;
      } else {
        this.dom.hudPowerupBadge.style.display = 'none';
      }
    }

    // Boss Bar
    if (this.activeBoss && this.activeBoss.active && !this.activeBoss.isDead) {
      if (this.dom.bossHudBar) this.dom.bossHudBar.style.display = 'flex';
      const bossHpPct = Math.max(0, (this.activeBoss.health / this.activeBoss.maxHealth) * 100);
      if (this.dom.bossHpFill) this.dom.bossHpFill.style.width = `${bossHpPct}%`;
    } else {
      if (this.dom.bossHudBar && this.dom.bossHudBar.style.display !== 'none') {
        this.dom.bossHudBar.style.display = 'none';
      }
    }

    // Ability Slot Cooldowns & Dynamic Number Labels (Matching Reference Image)
    const dashCooldown = p.dashCooldown * p.stats.dashCdMult;
    const dashCdPct = p.dashCharges >= p.maxDashCharges ? 0 : 100 - (p.dashChargeRechargeTimer / dashCooldown) * 100;
    this.dom.cdDash.style.height = `${dashCdPct}%`;
    this.dom.slotDash.classList.toggle('ready', p.dashCharges > 0);
    if (this.dom.lblDash) {
      this.dom.lblDash.textContent = '[Q] DASH';
    }
    // Update Dash Charge Pips (4 Pips)
    if (this.dom.hudDashPips) {
      const pips = this.dom.hudDashPips.children;
      for (let i = 0; i < pips.length; i++) {
        pips[i].classList.toggle('on', i < p.dashCharges);
      }
    }

    const shieldCdPct = p.shieldCdTimer > 0 ? (p.shieldCdTimer / p.shieldCooldown) * 100 : 0;
    this.dom.cdShield.style.height = `${shieldCdPct}%`;
    this.dom.slotShield.classList.toggle('ready', p.shieldCdTimer <= 0);
    if (this.dom.lblShield) {
      this.dom.lblShield.textContent = p.shieldCdTimer > 0 ? `[E] ${p.shieldCdTimer.toFixed(1)}s` : '[E] AEGIS';
    }

    const waveCdPct = p.shockwaveCdTimer > 0 ? (p.shockwaveCdTimer / p.shockwaveCooldown) * 100 : 0;
    this.dom.cdWave.style.height = `${waveCdPct}%`;
    this.dom.slotWave.classList.toggle('ready', p.shockwaveCdTimer <= 0);
    if (this.dom.lblWave) {
      this.dom.lblWave.textContent = p.shockwaveCdTimer > 0 ? `[R] ${p.shockwaveCdTimer.toFixed(1)}s` : '[R] WAVE';
    }

    const odFillPct = p.isOverdrive ? (p.overdriveTimer / p.stats.overdriveDuration) * 100 : p.overdriveCharge;
    this.dom.cdOverdrive.style.height = `${100 - odFillPct}%`;
    this.dom.slotOverdrive.classList.toggle('ready', p.overdriveCharge >= 100 || p.isOverdrive);
    if (this.dom.lblOverdrive) {
      this.dom.lblOverdrive.textContent = '[SPACE]';
    }
    if (this.dom.odPercent) {
      this.dom.odPercent.textContent = p.isOverdrive ? 'ACTIVE!' : `${Math.floor(p.overdriveCharge)}%`;
    }

    // Virtual Joystick Dial (Tactile Mobile & Desktop Feedback)
    if (this.dom.virtualJoystickContainer) {
      if (this.input.touchEnabled || window.innerWidth <= 768) {
        this.dom.virtualJoystickContainer.style.display = 'block';
      }

      if (this.input.touchMoveActive) {
        const tdx = this.input.touchMoveCurrent.x - this.input.touchMoveOrigin.x;
        const tdy = this.input.touchMoveCurrent.y - this.input.touchMoveOrigin.y;
        const dist = Math.hypot(tdx, tdy);
        const maxR = 34;
        const normDist = Math.min(dist, maxR);
        const angle = Math.atan2(tdy, tdx);
        const jx = Math.cos(angle) * normDist;
        const jy = Math.sin(angle) * normDist;
        if (this.dom.virtualJoystickThumb) {
          this.dom.virtualJoystickThumb.style.transform = `translate(calc(-50% + ${jx.toFixed(1)}px), calc(-50% + ${jy.toFixed(1)}px))`;
        }
      } else if (Math.hypot(this.input.moveX, this.input.moveY) > 0.05) {
        // Keyboard tactile deflection
        const jx = this.input.moveX * 24;
        const jy = this.input.moveY * 24;
        if (this.dom.virtualJoystickThumb) {
          this.dom.virtualJoystickThumb.style.transform = `translate(calc(-50% + ${jx.toFixed(1)}px), calc(-50% + ${jy.toFixed(1)}px))`;
        }
      } else {
        if (this.dom.virtualJoystickThumb) {
          this.dom.virtualJoystickThumb.style.transform = 'translate(-50%, -50%)';
        }
      }
    }

    // Touch Virtual Joysticks
    if (this.input.touchEnabled) {
      this.dom.touchOverlay.style.display = 'block';

      if (this.input.touchMoveActive) {
        this.dom.touchMoveBase.style.display = 'block';
        this.dom.touchMoveThumb.style.display = 'block';
        this.dom.touchMoveBase.style.left = `${this.input.touchMoveOrigin.x}px`;
        this.dom.touchMoveBase.style.top = `${this.input.touchMoveOrigin.y}px`;
        this.dom.touchMoveThumb.style.left = `${this.input.touchMoveCurrent.x}px`;
        this.dom.touchMoveThumb.style.top = `${this.input.touchMoveCurrent.y}px`;
      } else {
        this.dom.touchMoveBase.style.display = 'none';
        this.dom.touchMoveThumb.style.display = 'none';
      }

      if (this.input.touchAimActive) {
        this.dom.touchAimBase.style.display = 'block';
        this.dom.touchAimThumb.style.display = 'block';
        this.dom.touchAimBase.style.left = `${this.input.touchAimOrigin.x}px`;
        this.dom.touchAimBase.style.top = `${this.input.touchAimOrigin.y}px`;
        this.dom.touchAimThumb.style.left = `${this.input.touchAimCurrent.x}px`;
        this.dom.touchAimThumb.style.top = `${this.input.touchAimCurrent.y}px`;
      } else {
        this.dom.touchAimBase.style.display = 'none';
        this.dom.touchAimThumb.style.display = 'none';
      }
    }
  }

  render() {
    const localPlayer = (this.gameMode === 'ONLINE_CLIENT' && this.player2) ? this.player2 : this.player;
    const teammate = (this.gameMode === 'ONLINE_CLIENT') ? this.player : this.player2;

    try {
      this.renderer.beginFrame(localPlayer, this.comboStreak || 0);
      const ctx = this.renderer.ctx;

      if (this.state === 'PLAYING' || this.state === 'UPGRADE_MODAL' || this.state === 'PAUSED') {
        // 1. Draw Hazards (Energy Pylons)
        try { this.hazardManager.draw(ctx); } catch (e) { /* hazard render guard */ }

        // 2. Draw Powerup Pickups
        try { this.powerupManager.draw(ctx); } catch (e) { /* powerup render guard */ }

        // 3. Draw Crystals
        try { this.crystalPool.draw(ctx); } catch (e) { /* crystal render guard */ }

        // 4. Draw Weapon Arcs (Lightning)
        try { this.weaponSystem.draw(ctx); } catch (e) { /* weapon render guard */ }

        // 5. Draw Bullets
        try { this.bulletPool.draw(ctx); } catch (e) { /* bullet render guard */ }

        // 6. Draw Enemies
        for (let i = 0; i < this.enemies.length; i++) {
          try {
            this.enemies[i].draw(ctx);
          } catch (e) { /* enemy render guard */ }
        }

        // 7. Draw Players & Co-Op Revival Tether
        try {
          if (this.isReviving && this.reviveP1 && this.reviveP2) {
            this.renderer.drawReviveTether(this.reviveP1, this.reviveP2, this.reviveProg);
          }
          if (this.player) {
            this.player.draw(ctx);
          }
          if (this.player2) {
            this.player2.draw(ctx);
          }
        } catch (e) { /* player render guard */ }

        // 8. Draw Particles
        try { this.particlePool.draw(ctx); } catch (e) { /* particle render guard */ }

        // 9. Draw Floating Combat Text
        if (saveManager.data.settings.damageNumbers) {
          try { this.floatingTexts.draw(ctx); } catch (e) { /* text render guard */ }
        }
      }
    } finally {
      // Guaranteed endFrame restore
      this.renderer.endFrame(localPlayer);

      // 10. Holographic Tactical Radar (rendered on top screen HUD with off-screen teammate radar)
      if (this.state === 'PLAYING' || this.state === 'PAUSED') {
        try {
          this.renderer.drawRadar(localPlayer, this.enemies, this.powerupManager, this.activeBoss, teammate, this.hazardManager);
        } catch (e) { /* radar render guard */ }
      }
    }
  }
}

// Initialize on window load
function initGame() {
  if (!window.game) {
    window.game = new NeonHavocGame();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
