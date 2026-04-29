/**
 * メインゲームシーン
 *
 * Phaser.Scene として実装し、すべてのゲーム状態をシーンプロパティに集約する。
 */

import Phaser from 'phaser';
import { parsePath, parseLineElement, isValidVertices, parseSpawnPoint } from './svgUtils.js';
import {
  computeSteering,
  computeAngularVelocity,
  applyDriveForce,
  applyBrakeOrReverse,
  applyIdleFriction
} from './carPhysics.js';
import { formatTime, handleControlLineCrossing, createLapHistoryUpdater } from './lapManager.js';
import { createSmokeManager } from './smokeManager.js';
import { getSteeringInput, getGamepadButtons, initializeGamepad } from './inputManager.js';
import { computeStraightStabilization } from './stabilization.js';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CAR_DISPLAY_WIDTH,
  CAR_DISPLAY_HEIGHT,
  CAR_MASS,
  CAR_FRICTION_AIR,
  CAR_FRICTION,
  DRIVE_FORCE_MAGNITUDE,
  CONTROL_LINE_HEIGHT,
  ANGULAR_DAMPING_BASE,
  ANGULAR_DAMPING_SPEED_FACTOR,
  ANGULAR_DAMPING_SPEED_THRESHOLD
} from './constants.js';

// 現在アクティブなコース ID
let activeCourse = 'tomin';

// グローバル game インスタンス（メニュー戻り用）
let game = null;

/**
 * メインゲームシーン
 */
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  /** @override */
  preload() {
    this.load.image('car', 'car.png');
    this.load.image('smoke', 'smoke.png');
    this.load.image('bg', `${activeCourse}/background.png`);
    this.load.text('collisionSVG', `${activeCourse}/collision.svg`);
  }

  /** @override */
  create() {
    // 入力設定
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.gamepad = initializeGamepad(this);

    // ラップ管理状態
    this.raceStartTime = null;
    this.bestLapTime = null;
    this.checkpointsPassed = 0;
    this.lapHistory = [];
    this.controlLines = [];

    // 背景
    const bg = this.add.image(0, 0, 'bg');
    bg.setOrigin(0, 0);
    bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);

    // ワールド境界
    this.matter.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // SVG コリジョンデータのパース
    const svgText = this.cache.text.get('collisionSVG');
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgRoot = svgDoc.documentElement;

    let viewBox = svgRoot.getAttribute('viewBox');
    const vb = viewBox ? viewBox.split(/\s+/).map(Number) : [0, 0, 1920, 1080];
    const vbWidth = vb[2] || 1920;
    const vbHeight = vb[3] || 1080;

    const scaleX = WORLD_WIDTH / vbWidth;
    const scaleY = WORLD_HEIGHT / vbHeight;
    const offsetX = 0;
    const offsetY = 0;

    // コリジョンポイント
    const innerPoints = parsePath(svgDoc, 'collisionInner', scaleX, scaleY, offsetX, offsetY);
    const outerPoints = parsePath(svgDoc, 'collisionOuter', scaleX, scaleY, offsetX, offsetY);

    // コントロールライン
    const startFinishLine = parseLineElement(svgDoc, 'startFinishLine', scaleX, scaleY, offsetX, offsetY);
    const checkpoint1 = parseLineElement(svgDoc, 'checkpoint1', scaleX, scaleY, offsetX, offsetY);
    const checkpoint2 = parseLineElement(svgDoc, 'checkpoint2', scaleX, scaleY, offsetX, offsetY);

    this.setupControlLines(startFinishLine, checkpoint1, checkpoint2);
    this.setupCollisionWalls(innerPoints, outerPoints);

    // 車
    const spawnPoint = parseSpawnPoint(svgDoc, scaleX, scaleY, offsetX, offsetY);
    const carX = spawnPoint ? spawnPoint.x : WORLD_WIDTH / 2;
    const carY = spawnPoint ? spawnPoint.y : WORLD_HEIGHT / 2;

    this.car = this.matter.add.image(carX, carY, 'car');
    this.car.setOrigin(0.5, 0.5);
    this.car.setDisplaySize(CAR_DISPLAY_WIDTH, CAR_DISPLAY_HEIGHT);
    this.car.setRotation(-Math.PI / 2);
    this.car.setFrictionAir(CAR_FRICTION_AIR);
    this.car.setMass(CAR_MASS);
    this.car.setFixedRotation(false);
    this.car.setFriction(CAR_FRICTION);

    // スモーク
    this.smokeManager = createSmokeManager(this);

    // カメラ
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.car, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.0);

    // UI
    this.setupUI();

    // 衝突検出
    this.matter.world.on('collisionstart', (event) => {
      this.handleCollisions(event);
    });
  }

  /**
   * コントロールラインを設定する。
   */
  setupControlLines(startFinishLine, checkpoint1, checkpoint2) {
    const lines = [];

    if (startFinishLine && startFinishLine.length >= 2) {
      lines.push({ id: 'startFinish', points: startFinishLine, type: 'startFinish', passed: false });
    }
    if (checkpoint1 && checkpoint1.length >= 2) {
      lines.push({ id: 'checkpoint1', points: checkpoint1, type: 'checkpoint', passed: false });
    }
    if (checkpoint2 && checkpoint2.length >= 2) {
      lines.push({ id: 'checkpoint2', points: checkpoint2, type: 'checkpoint', passed: false });
    }

    this.controlLines = lines;

    // コントロールラインの物理ボディ（センサー）
    lines.forEach(line => {
      if (line.points.length >= 2) {
        const p1 = line.points[0];
        const p2 = line.points[line.points.length - 1];
        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;
        const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        const lineRect = this.matter.add.rectangle(centerX, centerY, length, CONTROL_LINE_HEIGHT, {
          isStatic: true,
          isSensor: true,
          angle: angle,
          render: {
            fillStyle: line.type === 'startFinish' ? '#00ff00' : '#ffff00',
            strokeStyle: line.type === 'startFinish' ? '#00aa00' : '#aaaa00',
            lineWidth: 2
          }
        });
        lineRect.controlLineId = line.id;
      }
    });
  }

  /**
   * コリジョンウォールを設定する。
   */
  setupCollisionWalls(innerPoints, outerPoints) {
    const createWallSegments = (points) => {
      if (!isValidVertices(points)) return;
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;
        const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        this.matter.add.rectangle(centerX, centerY, length, 4, {
          isStatic: true,
          angle: angle,
          render: { visible: false }
        });
      }
    };

    createWallSegments(innerPoints);
    createWallSegments(outerPoints);
  }

  /**
   * UI 要素を設定する。
   */
  setupUI() {
    // ラップ履歴テキスト
    this.lapHistoryTexts = [];
    for (let i = 0; i < 5; i++) {
      const lapText = this.add.text(
        20, 100 + (i * 25),
        '',
        { fontSize: '16px', fill: '#666', backgroundColor: '#f0f0f0', padding: { x: 8, y: 3 } }
      );
      lapText.setScrollFactor(0).setVisible(false);
      this.lapHistoryTexts.push(lapText);
    }

    // タイム表示
    this.timeText = this.add.text(
      20, 20,
      'Time: --:--.--',
      { fontSize: '20px', fill: '#000', backgroundColor: '#fff', padding: { x: 10, y: 5 } }
    ).setScrollFactor(0);

    this.bestTimeText = this.add.text(
      20, 55,
      'Best: --:--.--',
      { fontSize: '18px', fill: '#0066cc', backgroundColor: '#fff', padding: { x: 10, y: 5 } }
    ).setScrollFactor(0);

    // メニューに戻るボタン
    const backButton = this.add.text(
      1100, 20,
      'Back to Menu',
      { fontSize: '16px', fill: '#000', backgroundColor: '#fff', padding: { x: 10, y: 5 } }
    )
      .setScrollFactor(0)
      .setInteractive();

    backButton.on('pointerdown', () => {
      shutdownGame();
    });

    this.lapHistoryUpdater = createLapHistoryUpdater(this.lapHistoryTexts);
  }

  /**
   * 衝突イベントを処理する。
   */
  handleCollisions(event) {
    for (let i = 0; i < event.pairs.length; i++) {
      const bodyA = event.pairs[i].bodyA;
      const bodyB = event.pairs[i].bodyB;

      if ((bodyA === this.car.body && bodyB.controlLineId) ||
          (bodyB === this.car.body && bodyA.controlLineId)) {
        const controlLineId = bodyA.controlLineId || bodyB.controlLineId;

        const result = handleControlLineCrossing(
          controlLineId,
          this.controlLines,
          this.raceStartTime,
          this.checkpointsPassed,
          this.bestLapTime,
          this.lapHistory,
          this.time.now
        );

        if (result) {
          this.raceStartTime = result.raceStartTime;
          this.checkpointsPassed = result.checkpointsPassed;
          this.bestLapTime = result.bestLapTime;
          this.lapHistory = result.lapHistory;
          this.lapHistoryUpdater(this.lapHistory, this.bestLapTime);
        }
      }
    }
  }

  /** @override */
  update() {
    if (!this.car || !this.car.body) return;

    // ゲームパッド再接続検出
    if (!this.gamepad && this.input.gamepad && this.input.gamepad.total > 0) {
      this.gamepad = this.input.gamepad.getPad(0);
    }

    const steerInput = getSteeringInput(this.cursors, this.gamepad);
    const { accel, brake } = getGamepadButtons(this.gamepad, this.keyX, this.keyZ);

    const velocity = this.car.body.velocity;
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    const currentAngularVelocity = this.car.body.angularVelocity;
    const heading = this.car.rotation + Math.PI / 2;

    // 前進方向・横方向の速度成分
    const vForward = velocity.x * Math.cos(heading) + velocity.y * Math.sin(heading);
    const vSide = velocity.x * -Math.sin(heading) + velocity.y * Math.cos(heading);
    const slipAngle = Math.atan2(vSide, vForward);
    const isReversing = brake && speed < 1.0;

    // ステアリング
    const { angleDiff } = computeSteering({ steerInput, isReversing, heading });

    // 角速度減衰
    const angularDamping = ANGULAR_DAMPING_BASE -
      Math.min(speed / ANGULAR_DAMPING_SPEED_THRESHOLD, 1) * ANGULAR_DAMPING_SPEED_FACTOR;

    // 角速度計算
    const angularVelocity = computeAngularVelocity({
      currentAngularVelocity,
      angularDamping,
      angleDiff,
      slipAngle,
      vForward
    });
    this.car.setAngularVelocity(angularVelocity);

    // 直進安定化（事前に計算した slipAngle, vForward を渡す）
    const stabilization = computeStraightStabilization(
      this.car,
      steerInput,
      speed,
      { slipAngle, vForward }
    );

    if (stabilization.shouldApply) {
      this.car.setAngularVelocity(this.car.body.angularVelocity * stabilization.angularDamping);
      if (stabilization.shouldCorrectVelocity) {
        this.car.setVelocity(stabilization.correctedVelocity.x, stabilization.correctedVelocity.y);
      }
    }

    // 駆動・制動
    const angle = this.car.rotation + Math.PI / 2;
    if (accel) {
      applyDriveForce({ car: this.car, angle });
    } else if (brake) {
      applyBrakeOrReverse({ car: this.car, angle, speed });
    } else {
      applyIdleFriction({ car: this.car });
    }

    // スモーク
    this.smokeManager.update(this.car, slipAngle, speed, heading);

    // タイム表示更新
    if (this.raceStartTime !== null) {
      this.timeText.setText(`Time: ${formatTime(this.time.now - this.raceStartTime)}`);
    }
    if (this.bestLapTime !== null) {
      this.bestTimeText.setText(`Best: ${formatTime(this.bestLapTime)}`);
    }
  }
}

/**
 * ゲームを開始する。
 *
 * @param {string} courseId - コース ID
 */
export function startGame(courseId) {
  if (game) {
    game.destroy(true);
    game = null;
  }

  activeCourse = courseId;

  const config = {
    type: Phaser.AUTO,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#ffffff',
    physics: {
      default: 'matter',
      matter: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: {
      gamepad: true
    },
    scene: GameScene
  };

  game = new Phaser.Game(config);
}

/**
 * ゲームを終了しメニューに戻る。
 */
export function shutdownGame() {
  if (game) {
    game.destroy(true);
    game = null;
  }
  document.getElementById('menu-container').style.display = 'block';
  document.getElementById('game-container').style.display = 'none';
}