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

let cursors, keyX, keyZ;
let car;
let gamepad;
let controlLines = [];
let raceStartTime = null;
let currentLapTime = null;
let bestLapTime = null;
let checkpointsPassed = 0;
let timeText;
let bestTimeText;
let lapHistoryTexts = [];
let lapHistory = [];
let smokeManager;
let activeCourse = 'tomin'; // Default course
let game = null;

function preload() {
  this.load.image('car', 'car.png');
  this.load.image('smoke', 'smoke.png');
  // Load course-specific assets
  this.load.image('bg', `${activeCourse}/background.png`);
  this.load.text('collisionSVG', `${activeCourse}/collision.svg`);
}

function create() {
  // 4Kマップサイズの設定
  const WORLD_WIDTH = 3840;
  const WORLD_HEIGHT = 2160;

  // ワールド境界の設定
  this.matter.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // 背景画像を4Kサイズで配置
  const bg = this.add.image(0, 0, 'bg');
  bg.setOrigin(0, 0);
  bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);

  // SVGコリジョンデータの読み込み
  const svgText = this.cache.text.get('collisionSVG');
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgRoot = svgDoc.documentElement;

  let viewBox = svgRoot.getAttribute('viewBox');
  let vb = viewBox ? viewBox.split(/\s+/).map(Number) : [0, 0, 1920, 1080];
  const vbWidth = vb[2] || 1920;
  const vbHeight = vb[3] || 1080;

  // 4Kサイズへのスケーリング
  const scaleX = WORLD_WIDTH / vbWidth;
  const scaleY = WORLD_HEIGHT / vbHeight;

  const adjustedScaleX = scaleX;
  const adjustedScaleY = scaleY;
  let offsetX = 0;
  let offsetY = 0;

  const innerPoints = parsePath(svgDoc, 'collisionInner', adjustedScaleX, adjustedScaleY, offsetX, offsetY);
  const outerPoints = parsePath(svgDoc, 'collisionOuter', adjustedScaleX, adjustedScaleY, offsetX, offsetY);

  // コントロールライン用のパースと設定
  const startFinishLine = parseLineElement(svgDoc, 'startFinishLine', adjustedScaleX, adjustedScaleY, offsetX, offsetY);
  const checkpoint1 = parseLineElement(svgDoc, 'checkpoint1', adjustedScaleX, adjustedScaleY, offsetX, offsetY);
  const checkpoint2 = parseLineElement(svgDoc, 'checkpoint2', adjustedScaleX, adjustedScaleY, offsetX, offsetY);

  // コントロールライン情報を格納
  controlLines = [];
  if (startFinishLine && startFinishLine.length >= 2) {
    controlLines.push({
      id: 'startFinish',
      points: startFinishLine,
      type: 'startFinish',
      passed: false
    });
  }
  if (checkpoint1 && checkpoint1.length >= 2) {
    controlLines.push({
      id: 'checkpoint1',
      points: checkpoint1,
      type: 'checkpoint',
      passed: false
    });
  }
  if (checkpoint2 && checkpoint2.length >= 2) {
    controlLines.push({
      id: 'checkpoint2',
      points: checkpoint2,
      type: 'checkpoint',
      passed: false
    });
  }

  // コントロールラインの視覚的表示
  controlLines.forEach(line => {
    if (line.points.length >= 2) {
      const p1 = line.points[0];
      const p2 = line.points[line.points.length - 1];
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      const lineRect = this.matter.add.rectangle(centerX, centerY, length, 20, {
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

  // コリジョン設定
  if (isValidVertices(innerPoints)) {
    for (let i = 0; i < innerPoints.length; i++) {
      const p1 = innerPoints[i];
      const p2 = innerPoints[(i + 1) % innerPoints.length];
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.matter.add.rectangle(centerX, centerY, length, 4, { isStatic: true, angle: angle, render: { visible: false } });
    }
  }

  if (isValidVertices(outerPoints)) {
    for (let i = 0; i < outerPoints.length; i++) {
      const p1 = outerPoints[i];
      const p2 = outerPoints[(i + 1) % outerPoints.length];
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.matter.add.rectangle(centerX, centerY, length, 4, { isStatic: true, angle: angle, render: { visible: false } });
    }
  }

  // 入力設定
  cursors = this.input.keyboard.createCursorKeys();
  keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  gamepad = initializeGamepad(this);

  // 4Kマップ上のspawn位置の取得
  const spawnPoint = parseSpawnPoint(svgDoc, adjustedScaleX, adjustedScaleY, offsetX, offsetY);
  let carX = spawnPoint ? spawnPoint.x : WORLD_WIDTH / 2;
  let carY = spawnPoint ? spawnPoint.y : WORLD_HEIGHT / 2;

  // 車オブジェクトの作成
  car = this.matter.add.image(carX, carY, 'car');
  car.setOrigin(0.5, 0.5);
  car.setDisplaySize(36, 48);
  car.setRotation(-Math.PI / 2);
  car.setFrictionAir(0.025);
  car.setMass(30);
  car.setFixedRotation(false);
  car.setFriction(0.05);

  smokeManager = createSmokeManager(this);

  // カメラ設定
  this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  this.cameras.main.startFollow(car, true, 0.1, 0.1);
  this.cameras.main.setZoom(1.0);

  // UI表示
  lapHistoryTexts = [];
  for (let i = 0; i < 5; i++) {
    const lapText = this.add.text(20, 100 + (i * 25), ``, { fontSize: '16px', fill: '#666', backgroundColor: '#f0f0f0', padding: { x: 8, y: 3 } });
    lapText.setScrollFactor(0).setVisible(false);
    lapHistoryTexts.push(lapText);
  }
  timeText = this.add.text(20, 20, 'Time: --:--.--', { fontSize: '20px', fill: '#000', backgroundColor: '#fff', padding: { x: 10, y: 5 } }).setScrollFactor(0);
  bestTimeText = this.add.text(20, 55, 'Best: --:--.--', { fontSize: '18px', fill: '#0066cc', backgroundColor: '#fff', padding: { x: 10, y: 5 } }).setScrollFactor(0);

  const backButton = this.add.text(1100, 20, 'Back to Menu', { fontSize: '16px', fill: '#000', backgroundColor: '#fff', padding: { x: 10, y: 5 } })
    .setScrollFactor(0)
    .setInteractive();

  backButton.on('pointerdown', () => {
    shutdownGame();
  });

  const lapHistoryUpdater = createLapHistoryUpdater(lapHistoryTexts);

  // 衝突検出
  this.matter.world.on('collisionstart', (event) => {
    for (let i = 0; i < event.pairs.length; i++) {
      const bodyA = event.pairs[i].bodyA;
      const bodyB = event.pairs[i].bodyB;
      if ((bodyA === car.body && bodyB.controlLineId) || (bodyB === car.body && bodyA.controlLineId)) {
        const controlLineId = bodyA.controlLineId || bodyB.controlLineId;
        const result = handleControlLineCrossing(controlLineId, controlLines, raceStartTime, checkpointsPassed, bestLapTime, lapHistory);
        if (result) {
          raceStartTime = result.raceStartTime;
          checkpointsPassed = result.checkpointsPassed;
          bestLapTime = result.bestLapTime;
          lapHistory = result.lapHistory;
          lapHistoryUpdater(lapHistory, bestLapTime);
        }
      }
    }
  });
}

function update() {
  if (!car || !car.body) return;

  if (!gamepad && this.input.gamepad && this.input.gamepad.total > 0) {
    gamepad = this.input.gamepad.getPad(0);
  }

  const steerInput = getSteeringInput(cursors, gamepad);
  const { accel, brake } = getGamepadButtons(gamepad, keyX, keyZ);
  const velocity = car.body.velocity;
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
  const currentAngularVelocity = car.body.angularVelocity;
  const heading = car.rotation + Math.PI / 2;
  const vForward = velocity.x * Math.cos(heading) + velocity.y * Math.sin(heading);
  const vSide = velocity.x * -Math.sin(heading) + velocity.y * Math.cos(heading);
  const slipAngle = Math.atan2(vSide, vForward);
  const isReversing = brake && speed < 1.0;

  const { angleDiff } = computeSteering({ steerInput, isReversing, heading, maxSteerAngle: Math.PI / 3 });
  const angularDamping = 0.99906 - Math.min(speed / 18, 1) * 0.01706;
  const angularVelocity = computeAngularVelocity({ currentAngularVelocity, angularDamping, angleDiff, slipAngle, vForward });
  car.setAngularVelocity(angularVelocity);

  const stabilization = computeStraightStabilization(car, steerInput, speed);
  if (stabilization.shouldApply) {
    car.setAngularVelocity(car.body.angularVelocity * stabilization.angularDamping);
    if (stabilization.shouldCorrectVelocity) {
      car.setVelocity(stabilization.correctedVelocity.x, stabilization.correctedVelocity.y);
    }
  }

  const forceMagnitude = 0.018;
  const angle = car.rotation + Math.PI / 2;
  if (accel) {
    applyDriveForce({ car, angle, forceMagnitude });
  } else if (brake) {
    applyBrakeOrReverse({ car, angle, forceMagnitude, speed });
  } else {
    applyIdleFriction({ car });
  }

  smokeManager.update(car, slipAngle, speed, heading);

  if (raceStartTime !== null) {
    timeText.setText(`Time: ${formatTime(Date.now() - raceStartTime)}`);
  }
  if (bestLapTime !== null) {
    bestTimeText.setText(`Best: ${formatTime(bestLapTime)}`);
  }
}

export function startGame(courseId) {
  if (game) {
    game.destroy(true);
    game = null;
  }
  activeCourse = courseId;

  // Reset state for new game
  raceStartTime = null;
  currentLapTime = null;
  bestLapTime = null;
  checkpointsPassed = 0;
  lapHistory = [];
  controlLines = [];

  const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container', // Render canvas in this div
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
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      gamepad: true
    },
    scene: {
      preload: preload,
      create: create,
      update: update
    }
  };

  game = new Phaser.Game(config);
}

export function shutdownGame() {
  if (game) {
    game.destroy(true);
    game = null;
  }
  document.getElementById('menu-container').style.display = 'block';
  document.getElementById('game-container').style.display = 'none';
}
