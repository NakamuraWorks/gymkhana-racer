import Phaser from 'phaser';
import { parsePath, parseLineElement, isValidVertices } from './svgUtils.js';
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

const config = {
  type: Phaser.AUTO,
  width: 1280,  // 固定解像度
  height: 720,  // 固定解像度
  backgroundColor: '#ffffff',
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 0 },
      debug: false  // デバッグ表示を無効化してパフォーマンス向上
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

const game = new Phaser.Game(config);

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
let lapHistory = [];  // 過去のラップタイム履歴（最新5周分）
// スモーク管理用
let smokeManager;

function preload() {
  this.load.image('car', 'car.png');
  this.load.image('bg', 'background.png');
  this.load.image('smoke', 'smoke.png'); // 追加
  this.load.text('collisionSVG', 'collision.svg');
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
  
  // SVG内の全要素をデバッグ出力
  // console.log('SVG elements with IDs:');
  // const allElements = svgDoc.querySelectorAll('[id]');
  // allElements.forEach(elem => {
  //   console.log(`- ${elem.tagName} with id: ${elem.id}`);
  // });
  
  let viewBox = svgRoot.getAttribute('viewBox');
  let vb = viewBox ? viewBox.split(/\s+/).map(Number) : [0, 0, 1920, 1080];
  const vbWidth = vb[2] || 1920;
  const vbHeight = vb[3] || 1080;
  
  // 4Kサイズへのスケーリング
  const scaleX = WORLD_WIDTH / vbWidth;
  const scaleY = WORLD_HEIGHT / vbHeight;
  const baseScale = Math.min(scaleX, scaleY);
  
  // 最終スケール（4Kマップ用）
  const finalScaleX = scaleX;
  const finalScaleY = scaleY;
  
  // console.log('4K Map scale factors:', { scaleX, scaleY, baseScale, finalScaleX, finalScaleY });
  // console.log('World size:', { width: WORLD_WIDTH, height: WORLD_HEIGHT });

  // square要素を基準とした配置調整（4K用に簡略化）
  let adjustedScaleX = finalScaleX;
  let adjustedScaleY = finalScaleY;
  let offsetX = 0;
  let offsetY = 0;
  
  // console.log('Using 4K scaling:', { adjustedScaleX, adjustedScaleY, offsetX, offsetY });

  // ...existing code...

  const innerPoints = parsePath(svgDoc, 'collisionInner', adjustedScaleX, adjustedScaleY, offsetX, offsetY);
  const outerPoints = parsePath(svgDoc, 'collisionOuter', adjustedScaleX, adjustedScaleY, offsetX, offsetY);

  // コントロールライン用のパースと設定
  const startFinishLine = parseLineElement(svgDoc, 'startFinishLine', adjustedScaleX, adjustedScaleY, offsetX, offsetY);
  const checkpoint1 = parseLineElement(svgDoc, 'checkpoint1', adjustedScaleX, adjustedScaleY, offsetX, offsetY);
  const checkpoint2 = parseLineElement(svgDoc, 'checkpoint2', adjustedScaleX, adjustedScaleY, offsetX, offsetY);
  
  // console.log('Parsed control lines:');
  // console.log('- startFinishLine:', startFinishLine);
  // console.log('- checkpoint1:', checkpoint1);
  // console.log('- checkpoint2:', checkpoint2);
  
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
  
  // console.log('Control lines loaded:', controlLines.length);
  
  // コントロールラインの視覚的表示
  controlLines.forEach(line => {
    // console.log(`Processing control line: ${line.id}, points:`, line.points);
    if (line.points.length >= 2) {
      const p1 = line.points[0];
      const p2 = line.points[line.points.length - 1];
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      
      // console.log(`Creating control line ${line.id}: center(${centerX}, ${centerY}), length=${length}, angle=${angle}`);
      
      // コントロールライン用の矩形（物理的な当たり判定なし）
      const lineRect = this.matter.add.rectangle(centerX, centerY, length, 20, {  // 高さを8から20に拡大
        isStatic: true,
        isSensor: true,  // センサーとして設定（物理的衝突なし）
        angle: angle,
        render: {
          fillStyle: line.type === 'startFinish' ? '#00ff00' : '#ffff00',
          strokeStyle: line.type === 'startFinish' ? '#00aa00' : '#aaaa00',
          lineWidth: 2
        }
      });
      
      // ラインオブジェクトにIDを関連付け
      lineRect.controlLineId = line.id;
      
      // console.log(`Successfully created control line: ${line.id} at (${centerX}, ${centerY})`);
    } else {
      // console.warn(`Control line ${line.id} has insufficient points:`, line.points);
    }
  });

  // コリジョン設定
  if (isValidVertices(innerPoints)) {
    // 内側の壁（コースの内壁）
    for (let i = 0; i < innerPoints.length - 1; i++) {
      const p1 = innerPoints[i];
      const p2 = innerPoints[i + 1];
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      
      this.matter.add.rectangle(centerX, centerY, length, 4, {
        isStatic: true,
        angle: angle,
        render: {
          fillStyle: 'transparent',
          strokeStyle: '#ff0000',
          lineWidth: 2
        }
      });
    }
    // 最後の点と最初の点をつなぐ
    const pLast = innerPoints[innerPoints.length - 1];
    const pFirst = innerPoints[0];
    const centerX = (pLast.x + pFirst.x) / 2;
    const centerY = (pLast.y + pFirst.y) / 2;
    const length = Math.sqrt((pFirst.x - pLast.x) ** 2 + (pFirst.y - pLast.y) ** 2);
    const angle = Math.atan2(pFirst.y - pLast.y, pFirst.x - pLast.x);
    
    this.matter.add.rectangle(centerX, centerY, length, 4, {
      isStatic: true,
      angle: angle,
      render: {
        fillStyle: 'transparent',
        strokeStyle: '#ff0000',
        lineWidth: 2
      }
    });
    // console.log('Inner collision created with', innerPoints.length, 'segments');
  }
  
  if (isValidVertices(outerPoints)) {
    // 外側の壁（コースの外壁）
    for (let i = 0; i < outerPoints.length - 1; i++) {
      const p1 = outerPoints[i];
      const p2 = outerPoints[i + 1];
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      
      this.matter.add.rectangle(centerX, centerY, length, 4, {
        isStatic: true,
        angle: angle,
        render: {
          fillStyle: 'transparent',
          strokeStyle: '#0000ff',
          lineWidth: 2
        }
      });
    }
    // 最後の点と最初の点をつなぐ
    const pLast = outerPoints[outerPoints.length - 1];
    const pFirst = outerPoints[0];
    const centerX = (pLast.x + pFirst.x) / 2;
    const centerY = (pLast.y + pFirst.y) / 2;
    const length = Math.sqrt((pFirst.x - pLast.x) ** 2 + (pFirst.y - pLast.y) ** 2);
    const angle = Math.atan2(pFirst.y - pLast.y, pFirst.x - pLast.x);
    
    this.matter.add.rectangle(centerX, centerY, length, 4, {
      isStatic: true,
      angle: angle,
      render: {
        fillStyle: 'transparent',
        strokeStyle: '#0000ff',
        lineWidth: 2
      }
    });
    // console.log('Outer collision created with', outerPoints.length, 'segments');
  }

  // 入力設定
  cursors = this.input.keyboard.createCursorKeys();
  keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  
  // ゲームパッド初期化
  gamepad = initializeGamepad(this);

  // 4Kマップ上のspawn位置の取得
  let carX = WORLD_WIDTH / 2;
  let carY = WORLD_HEIGHT / 2;
  
  // 複数の可能なspawn要素名を試す
  const possibleSpawnIds = ['spown', 'spawn', 'start', 'startPoint', 'car', 'vehicle'];
  let spawnElem = null;
  let foundSpawnId = null;
  
  for (const spawnId of possibleSpawnIds) {
    spawnElem = svgDoc.getElementById(spawnId);
    if (spawnElem) {
      foundSpawnId = spawnId;
      break;
    }
  }
  
  // console.log('Checking spawn element with ID:', foundSpawnId);
  // console.log('Spawn element:', spawnElem);
  
  if (spawnElem) {
    // console.log('Spawn element found, tagName:', spawnElem.tagName);
    // console.log('All attributes:', Array.from(spawnElem.attributes).map(attr => `${attr.name}="${attr.value}"`));
    
    if (spawnElem.tagName === 'circle') {
      const cx = parseFloat(spawnElem.getAttribute('cx')) || 0;
      const cy = parseFloat(spawnElem.getAttribute('cy')) || 0;
      carX = cx * adjustedScaleX + offsetX;
      carY = cy * adjustedScaleY + offsetY;
      // console.log('Spawn from circle - original:', cx, cy, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'ellipse') {
      const cx = parseFloat(spawnElem.getAttribute('cx')) || 0;
      const cy = parseFloat(spawnElem.getAttribute('cy')) || 0;
      carX = cx * adjustedScaleX + offsetX;
      carY = cy * adjustedScaleY + offsetY;
      // console.log('Spawn from ellipse - original:', cx, cy, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'rect') {
      const x = parseFloat(spawnElem.getAttribute('x')) || 0;
      const y = parseFloat(spawnElem.getAttribute('y')) || 0;
      const width = parseFloat(spawnElem.getAttribute('width')) || 0;
      const height = parseFloat(spawnElem.getAttribute('height')) || 0;
      carX = (x + width/2) * adjustedScaleX + offsetX;
      carY = (y + height/2) * adjustedScaleY + offsetY;
      // console.log('Spawn from rect - original:', x, y, 'center:', x + width/2, y + height/2, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'path') {
      const d = spawnElem.getAttribute('d');
      // console.log('Path d attribute:', d);
      const m = /M\s*([\d\.\-]+)[\s,]+([\d\.\-]+)/.exec(d);
      if (m) {
        const origX = parseFloat(m[1]);
        const origY = parseFloat(m[2]);
        carX = origX * adjustedScaleX + offsetX;
        carY = origY * adjustedScaleY + offsetY;
        // console.log('Spawn from path - original:', origX, origY, 'scaled:', carX, carY);
      }
    } else if (spawnElem.tagName === 'g') {
      // グループ要素の場合、transform属性を確認
      const transform = spawnElem.getAttribute('transform');
      // console.log('Group transform:', transform);
      if (transform) {
        const translateMatch = /translate\(([\d\.\-]+)[\s,]*([\d\.\-]+)\)/.exec(transform);
        if (translateMatch) {
          const origX = parseFloat(translateMatch[1]);
          const origY = parseFloat(translateMatch[2]);
          carX = origX * adjustedScaleX + offsetX;
          carY = origY * adjustedScaleY + offsetY;
          // console.log('Spawn from group transform - original:', origX, origY, 'scaled:', carX, carY);
        }
      }
    }
    
    // console.log('Final spawn position:', carX, carY);
    // console.log('World dimensions:', WORLD_WIDTH, WORLD_HEIGHT);
    
  } else {
    // console.warn('No spawn element found with any of these IDs:', possibleSpawnIds);
    if (isValidVertices(innerPoints)) {
      const sum = innerPoints.reduce((acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }), { x: 0, y: 0 });
      carX = sum.x / innerPoints.length;
      carY = sum.y / innerPoints.length;
      // console.log('Fallback: spawn from inner points center:', carX, carY);
    }
  }
  
  // console.log('Final car position:', carX, carY);

  // 車オブジェクトの作成
  // console.log('Creating car at position:', carX, carY);
  car = this.matter.add.image(carX, carY, 'car');
  car.setOrigin(0.5, 0.5);
  car.setDisplaySize(36, 48);
  car.setRotation(-Math.PI / 2);
  car.setFrictionAir(0.025);
  car.setMass(30);
  car.setFixedRotation(false);
  car.body.render.sprite.xOffset = 0.5;
  car.body.render.sprite.yOffset = 0.5;
  car.setFriction(0.05);  // 0.08から0.05に下げてさらにスライドしやすく
  // console.log('Car created:', car);
  
  // スモーク管理の初期化
  smokeManager = createSmokeManager(this);
  
  // カメラ設定：車を追従
  this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  this.cameras.main.startFollow(car, true, 0.1, 0.1);
  this.cameras.main.setZoom(1.0);
  
  // ラップ履歴表示UI（過去5周分）
  lapHistoryTexts = [];
  for (let i = 0; i < 5; i++) {
    const lapText = this.add.text(20, 100 + (i * 25), `Lap ${i + 1}: --:--.--`, {
      fontSize: '16px',
      fill: '#666666',
      backgroundColor: '#f0f0f0',
      padding: { x: 8, y: 3 }
    });
    lapText.setScrollFactor(0); // カメラに固定
    lapText.setVisible(false); // 初期は非表示
    lapHistoryTexts.push(lapText);
  }
  
  // 現在のタイム表示
  timeText = this.add.text(20, 20, 'Time: --:--.--', {
    fontSize: '20px',
    fill: '#000000',
    backgroundColor: '#ffffff',
    padding: { x: 10, y: 5 }
  });
  timeText.setScrollFactor(0); // カメラに固定
  
  // ベストタイム表示
  bestTimeText = this.add.text(20, 55, 'Best: --:--.--', {
    fontSize: '18px',
    fill: '#0066cc',
    backgroundColor: '#ffffff',
    padding: { x: 10, y: 5 }
  });
  bestTimeText.setScrollFactor(0); // カメラに固定
  
  // ラップ管理機能の初期化（lapHistoryTexts作成後）
  const lapHistoryUpdater = createLapHistoryUpdater(lapHistoryTexts);
  
  // コントロールライン通過検出のイベント設定
  this.matter.world.on('collisionstart', function (event) {
    const pairs = event.pairs;
    
    for (let i = 0; i < pairs.length; i++) {
      const bodyA = pairs[i].bodyA;
      const bodyB = pairs[i].bodyB;
      
      // 車とコントロールラインの衝突を検出
      if ((bodyA === car.body && bodyB.controlLineId) || (bodyB === car.body && bodyA.controlLineId)) {
        const controlLineId = bodyA.controlLineId || bodyB.controlLineId;
        const result = handleControlLineCrossing(
          controlLineId,
          controlLines,
          raceStartTime,
          checkpointsPassed,
          bestLapTime,
          lapHistory
        );
        
        // 結果の反映
        if (result) {
          raceStartTime = result.raceStartTime;
          checkpointsPassed = result.checkpointsPassed;
          bestLapTime = result.bestLapTime;
          lapHistory = result.lapHistory;
          
          // UI更新
          lapHistoryUpdater(lapHistory, bestLapTime);
        }
      }
    }
  });
  
  // console.log('Camera setup: following car with bounds', WORLD_WIDTH, 'x', WORLD_HEIGHT);
}

function update() {
  // ゲームパッドの取得
  if (!gamepad && this.input.gamepad && this.input.gamepad.total > 0) {
    gamepad = this.input.gamepad.getPad(0);
  }
  
  // 入力の取得
  const steerInput = getSteeringInput(cursors, gamepad);
  const { accel, brake } = getGamepadButtons(gamepad, keyX, keyZ);
  
  const velocity = car.body.velocity;
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  const currentAngularVelocity = car.body.angularVelocity;
  
  // 車体の向きと進行方向の計算
  const heading = car.rotation + Math.PI / 2;
  const forward = { x: Math.cos(heading), y: Math.sin(heading) };
  const vForward = velocity.x * forward.x + velocity.y * forward.y;
  const side = { x: -Math.sin(heading), y: Math.cos(heading) };
  const vSide = velocity.x * side.x + velocity.y * side.y;
  const slipAngle = Math.atan2(vSide, vForward);
  
  // バック判定
  const isReversing = brake && speed < 1.0;
  
  // ステアリング計算
  const { angleDiff } = computeSteering({
    steerInput,
    isReversing,
    heading,
    maxSteerAngle: Math.PI / 3
  });
  
  // 角速度計算
  const angularDamping = 0.99906 - Math.min(speed / 18, 1) * 0.01706;
  const angularVelocity = computeAngularVelocity({
    currentAngularVelocity,
    angularDamping,
    angleDiff,
    slipAngle,
    vForward
  });
  car.setAngularVelocity(angularVelocity);
  
  // 直進安定化の適用
  const stabilization = computeStraightStabilization(car, steerInput, speed);
  if (stabilization.shouldApply) {
    car.setAngularVelocity(car.body.angularVelocity * stabilization.angularDamping);
    if (stabilization.shouldCorrectVelocity) {
      car.setVelocity(stabilization.correctedVelocity.x, stabilization.correctedVelocity.y);
    }
  }

  // 駆動力の適用
  const forceMagnitude = 0.018;
  const angle = car.rotation + Math.PI / 2;
  
  if (accel) {
    applyDriveForce({ car, angle, forceMagnitude });
  } else if (brake) {
    applyBrakeOrReverse({ car, angle, forceMagnitude, speed });
  } else {
    applyIdleFriction({ car });
  }
  // スモーク効果の更新
  smokeManager.update(car, slipAngle, speed, heading);

  // タイム表示の更新
  if (raceStartTime !== null) {
    const currentTime = Date.now() - raceStartTime;
    timeText.setText(`Time: ${formatTime(currentTime)}`);
  }
  
  if (bestLapTime !== null) {
    bestTimeText.setText(`Best: ${formatTime(bestLapTime)}`);
  }
}
