// NEON HAVOC — Unified Input System (Keyboard, Mouse, Gamepad, Touch)

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;

    // Movement vector normalized [-1..1]
    this.moveX = 0;
    this.moveY = 0;

    // Aim position in screen coordinates & world coordinates
    this.screenAimX = window.innerWidth / 2;
    this.screenAimY = window.innerHeight / 2;
    this.aimAngle = 0;

    // Actions state
    this.isShooting = false;
    this.autoFire = true;
    this.autoAim = true;
    this.targetEnemy = null;
    this.mouseMovedRecently = false;
    this.dashPressed = false;
    this.shieldPressed = false;
    this.shockwavePressed = false;
    this.overdrivePressed = false;
    this.pausePressed = false;
    this.fullscreenPressed = false;

    // Player 2 local inputs
    this.p2MoveX = 0;
    this.p2MoveY = 0;
    this.p2AimAngle = 0;
    this.p2IsShooting = false;
    this.p2DashPressed = false;
    this.p2ShieldPressed = false;
    this.p2ShockwavePressed = false;
    this.p2OverdrivePressed = false;

    // Raw key tracking
    this.keys = {};

    // Touch controls
    this.touchEnabled = false;
    this.touchMoveActive = false;
    this.touchMoveId = null;
    this.touchMoveOrigin = { x: 0, y: 0 };
    this.touchMoveCurrent = { x: 0, y: 0 };
    this.touchAimActive = false;
    this.touchAimId = null;
    this.touchAimOrigin = { x: 0, y: 0 };
    this.touchAimCurrent = { x: 0, y: 0 };

    this._setupListeners();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'KeyQ') this.dashPressed = true;
      if (e.code === 'KeyE') this.shieldPressed = true;
      if (e.code === 'KeyR') this.shockwavePressed = true;
      if (e.code === 'Space') this.overdrivePressed = true;
      if (e.code === 'KeyJ' || e.code === 'KeyZ') this.isShooting = true;
      if (e.code === 'KeyP' || e.code === 'Escape') this.pausePressed = true;
      if (e.code === 'KeyC') this.autoFire = !this.autoFire;
      if (e.code === 'KeyT') this.autoAim = !this.autoAim;
      if (e.code === 'KeyF' || e.code === 'F11') {
        e.preventDefault();
        this.fullscreenPressed = true;
      }

      // Player 2 Keybinds (Dual Keyboard / Couch Co-Op)
      if (e.code === 'KeyU' || e.code === 'ShiftRight' || e.code === 'Numpad1') this.p2DashPressed = true;
      if (e.code === 'BracketLeft' || e.code === 'Numpad2') this.p2ShieldPressed = true;
      if (e.code === 'BracketRight' || e.code === 'Numpad3') this.p2ShockwavePressed = true;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') this.p2OverdrivePressed = true;
      if (e.code === 'KeyO' || e.code === 'ControlRight' || e.code === 'Numpad0') this.p2IsShooting = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyJ' || e.code === 'KeyZ') {
        this.isShooting = false;
      }
      if (e.code === 'KeyO' || e.code === 'ControlRight' || e.code === 'Numpad0') {
        this.p2IsShooting = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.screenAimX = e.clientX;
      this.screenAimY = e.clientY;
      this.mouseMovedRecently = true;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isShooting = true;
        this.screenAimX = e.clientX;
        this.screenAimY = e.clientY;
        this.mouseMovedRecently = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.dashPressed = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isShooting = false;
      }
    });

    window.addEventListener('blur', () => {
      this.isShooting = false;
      this.p2IsShooting = false;
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Touch support
    this._setupTouchListeners();
  }

  _setupTouchListeners() {
    const handleTouchStart = (e) => {
      this.touchEnabled = true;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (!this.touchMoveActive && touch.clientX < window.innerWidth / 2) {
          // Left side: Move Joystick
          this.touchMoveActive = true;
          this.touchMoveId = touch.identifier;
          this.touchMoveOrigin = { x: touch.clientX, y: touch.clientY };
          this.touchMoveCurrent = { x: touch.clientX, y: touch.clientY };
        } else if (!this.touchAimActive && touch.clientX >= window.innerWidth / 2) {
          // Right side: Aim & Shoot Joystick
          this.touchAimActive = true;
          this.touchAimId = touch.identifier;
          this.touchAimOrigin = { x: touch.clientX, y: touch.clientY };
          this.touchAimCurrent = { x: touch.clientX, y: touch.clientY };
          this.isShooting = true;
        }
      }
    };

    const handleTouchMove = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.touchMoveActive && touch.identifier === this.touchMoveId) {
          this.touchMoveCurrent = { x: touch.clientX, y: touch.clientY };
        } else if (this.touchAimActive && touch.identifier === this.touchAimId) {
          this.touchAimCurrent = { x: touch.clientX, y: touch.clientY };
          this.screenAimX = touch.clientX;
          this.screenAimY = touch.clientY;
        }
      }
    };

    const handleTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.touchMoveActive && touch.identifier === this.touchMoveId) {
          this.touchMoveActive = false;
          this.touchMoveId = null;
          this.moveX = 0;
          this.moveY = 0;
        } else if (this.touchAimActive && touch.identifier === this.touchAimId) {
          this.touchAimActive = false;
          this.touchAimId = null;
          this.isShooting = false;
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  }

  update(playerScreenPos, playerWorldPos = null, enemies = null, isCoop = false, player2 = null) {
    // 1. Calculate Player 1 Keyboard Movement (WASD)
    let dx = 0;
    let dy = 0;

    if (this.keys['KeyW']) dy -= 1;
    if (this.keys['KeyS']) dy += 1;
    if (this.keys['KeyA']) dx -= 1;
    if (this.keys['KeyD']) dx += 1;

    // In single player, allow Arrow keys for Player 1 as well
    if (!isCoop) {
      if (this.keys['ArrowUp']) dy -= 1;
      if (this.keys['ArrowDown']) dy += 1;
      if (this.keys['ArrowLeft']) dx -= 1;
      if (this.keys['ArrowRight']) dx += 1;
    }

    // Touch override for Player 1
    if (this.touchMoveActive) {
      const tdx = this.touchMoveCurrent.x - this.touchMoveOrigin.x;
      const tdy = this.touchMoveCurrent.y - this.touchMoveOrigin.y;
      const dist = Math.hypot(tdx, tdy);
      const maxRadius = 55;
      if (dist > 8) {
        dx = (tdx / dist) * Math.min(1, dist / maxRadius);
        dy = (tdy / dist) * Math.min(1, dist / maxRadius);
      }
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.moveX = dx;
    this.moveY = dy;

    // Player 1 Aim
    this.targetEnemy = null;
    let manualAimActive = false;

    if (this.touchAimActive) {
      const adx = this.touchAimCurrent.x - this.touchAimOrigin.x;
      const ady = this.touchAimCurrent.y - this.touchAimOrigin.y;
      if (Math.hypot(adx, ady) > 8) {
        this.aimAngle = Math.atan2(ady, adx);
        manualAimActive = true;
      }
    } else if (this.isShooting && playerScreenPos) {
      this.aimAngle = Math.atan2(
        this.screenAimY - playerScreenPos.y,
        this.screenAimX - playerScreenPos.x
      );
      manualAimActive = true;
    } else if (this.mouseMovedRecently && playerScreenPos) {
      const dAim = Math.hypot(this.screenAimX - playerScreenPos.x, this.screenAimY - playerScreenPos.y);
      if (dAim > 15) {
        this.aimAngle = Math.atan2(
          this.screenAimY - playerScreenPos.y,
          this.screenAimX - playerScreenPos.x
        );
        manualAimActive = true;
      }
    }

    // Smart Auto-Aim Assistant (Locks onto nearest hostile if no manual override)
    if (!manualAimActive && this.autoAim && enemies && enemies.length > 0 && playerWorldPos) {
      let nearestDist = 800;
      let nearest = null;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.active || e.isDead) continue;
        const d = Math.hypot(e.x - playerWorldPos.x, e.y - playerWorldPos.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }
      if (nearest) {
        this.targetEnemy = nearest;
        this.aimAngle = Math.atan2(nearest.y - playerWorldPos.y, nearest.x - playerWorldPos.x);
      } else if (Math.hypot(this.moveX, this.moveY) > 0.05) {
        this.aimAngle = Math.atan2(this.moveY, this.moveX);
      }
    } else if (!manualAimActive && Math.hypot(this.moveX, this.moveY) > 0.05) {
      this.aimAngle = Math.atan2(this.moveY, this.moveX);
    }

    // 2. Calculate Player 2 Movement (Arrow keys / IJKL)
    if (isCoop && player2) {
      let p2dx = 0;
      let p2dy = 0;
      if (this.keys['ArrowUp'] || this.keys['KeyI']) p2dy -= 1;
      if (this.keys['ArrowDown'] || this.keys['KeyK']) p2dy += 1;
      if (this.keys['ArrowLeft'] || this.keys['KeyJ']) p2dx -= 1;
      if (this.keys['ArrowRight'] || this.keys['KeyL']) p2dx += 1;

      const p2len = Math.hypot(p2dx, p2dy);
      if (p2len > 1) {
        p2dx /= p2len;
        p2dy /= p2len;
      }
      this.p2MoveX = p2dx;
      this.p2MoveY = p2dy;

      // Player 2 Aim calculation:
      let aimDx = 0, aimDy = 0;
      if (this.keys['Numpad8']) aimDy -= 1;
      if (this.keys['Numpad2']) aimDy += 1;
      if (this.keys['Numpad4']) aimDx -= 1;
      if (this.keys['Numpad6']) aimDx += 1;

      if (aimDx !== 0 || aimDy !== 0) {
        this.p2AimAngle = Math.atan2(aimDy, aimDx);
      } else if (p2len > 0) {
        this.p2AimAngle = Math.atan2(p2dy, p2dx);
      } else if (enemies && enemies.length > 0) {
        let nearest = null;
        let minD = 400;
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (!e.active || e.isDead) continue;
          const d = Math.hypot(e.x - player2.x, e.y - player2.y);
          if (d < minD) {
            minD = d;
            nearest = e;
          }
        }
        if (nearest) {
          this.p2AimAngle = Math.atan2(nearest.y - player2.y, nearest.x - player2.x);
        }
      }
    }

    // 3. Poll Gamepads (GP0 for P1, GP1 for P2)
    this._pollGamepad(isCoop);
  }

  _pollGamepad(isCoop = false) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp0 = gamepads[0];
    const deadzone = 0.18;

    if (gp0) {
      const lx = gp0.axes[0];
      const ly = gp0.axes[1];
      if (Math.abs(lx) > deadzone || Math.abs(ly) > deadzone) {
        this.moveX = lx;
        this.moveY = ly;
      }

      const rx = gp0.axes[2];
      const ry = gp0.axes[3];
      if (Math.hypot(rx, ry) > 0.25) {
        this.aimAngle = Math.atan2(ry, rx);
        this.isShooting = true;
      }

      if (gp0.buttons[0]?.pressed) this.dashPressed = true;
      if (gp0.buttons[1]?.pressed) this.shieldPressed = true;
      if (gp0.buttons[2]?.pressed) this.shockwavePressed = true;
      if (gp0.buttons[3]?.pressed) this.overdrivePressed = true;
      if (gp0.buttons[7]?.pressed) this.isShooting = true;
      if (gp0.buttons[9]?.pressed) this.pausePressed = true;
    }

    const gp1 = gamepads[1];
    if (gp1 && isCoop) {
      const lx = gp1.axes[0];
      const ly = gp1.axes[1];
      if (Math.abs(lx) > deadzone || Math.abs(ly) > deadzone) {
        this.p2MoveX = lx;
        this.p2MoveY = ly;
      }

      const rx = gp1.axes[2];
      const ry = gp1.axes[3];
      if (Math.hypot(rx, ry) > 0.25) {
        this.p2AimAngle = Math.atan2(ry, rx);
        this.p2IsShooting = true;
      }

      if (gp1.buttons[0]?.pressed) this.p2DashPressed = true;
      if (gp1.buttons[1]?.pressed) this.p2ShieldPressed = true;
      if (gp1.buttons[2]?.pressed) this.p2ShockwavePressed = true;
      if (gp1.buttons[3]?.pressed) this.p2OverdrivePressed = true;
      if (gp1.buttons[7]?.pressed) this.p2IsShooting = true;
    }
  }

  getPlayer1Input() {
    return {
      moveX: this.moveX,
      moveY: this.moveY,
      aimAngle: this.aimAngle,
      isShooting: this.isShooting || this.autoFire,
      consumeDash: () => this.consumeDash(),
      consumeShield: () => this.consumeShield(),
      consumeShockwave: () => this.consumeShockwave(),
      consumeOverdrive: () => this.consumeOverdrive(),
    };
  }

  getPlayer2Input() {
    return {
      moveX: this.p2MoveX,
      moveY: this.p2MoveY,
      aimAngle: this.p2AimAngle,
      isShooting: this.p2IsShooting || this.autoFire,
      consumeDash: () => {
        const p = this.p2DashPressed;
        this.p2DashPressed = false;
        return p;
      },
      consumeShield: () => {
        const p = this.p2ShieldPressed;
        this.p2ShieldPressed = false;
        return p;
      },
      consumeShockwave: () => {
        const p = this.p2ShockwavePressed;
        this.p2ShockwavePressed = false;
        return p;
      },
      consumeOverdrive: () => {
        const p = this.p2OverdrivePressed;
        this.p2OverdrivePressed = false;
        return p;
      },
    };
  }

  setRemotePlayer2Input(state) {
    if (!state) return;
    if (state.moveX !== undefined) this.p2MoveX = state.moveX;
    if (state.moveY !== undefined) this.p2MoveY = state.moveY;
    if (state.aimAngle !== undefined) this.p2AimAngle = state.aimAngle;
    if (state.isShooting !== undefined) this.p2IsShooting = state.isShooting;
    if (state.dash) this.p2DashPressed = true;
    if (state.shield) this.p2ShieldPressed = true;
    if (state.shockwave) this.p2ShockwavePressed = true;
    if (state.overdrive) this.p2OverdrivePressed = true;
  }

  consumeDash() {
    const p = this.dashPressed;
    this.dashPressed = false;
    return p;
  }

  consumeShield() {
    const p = this.shieldPressed;
    this.shieldPressed = false;
    return p;
  }

  consumeShockwave() {
    const p = this.shockwavePressed;
    this.shockwavePressed = false;
    return p;
  }

  consumeOverdrive() {
    const p = this.overdrivePressed;
    this.overdrivePressed = false;
    return p;
  }

  consumePause() {
    const p = this.pausePressed;
    this.pausePressed = false;
    return p;
  }

  consumeFullscreen() {
    const f = this.fullscreenPressed;
    this.fullscreenPressed = false;
    return f;
  }

  resetActions() {
    this.isShooting = false;
    this.dashPressed = false;
    this.shieldPressed = false;
    this.shockwavePressed = false;
    this.overdrivePressed = false;
    this.pausePressed = false;
    this.touchMoveActive = false;
    this.touchAimActive = false;
    this.moveX = 0;
    this.moveY = 0;

    // Reset Player 2
    this.p2IsShooting = false;
    this.p2DashPressed = false;
    this.p2ShieldPressed = false;
    this.p2ShockwavePressed = false;
    this.p2OverdrivePressed = false;
    this.p2MoveX = 0;
    this.p2MoveY = 0;
  }
}

