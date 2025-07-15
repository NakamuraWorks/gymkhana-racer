import Phaser from 'phaser';

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
let smokeSprites = [];
let lastSmokeTime = 0;

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

  // SVGパース関数
  function parsePath(id) {
    const path = svgDoc.getElementById(id);
    if (!path) {
      console.warn(`Path with id '${id}' not found in SVG`);
      return null;
    }
    const d = path.getAttribute('d');
    if (!d) {
      console.warn(`Path '${id}' has no 'd' attribute`);
      return null;
    }
    const points = [];
    // より包括的な正規表現でパスをパース
    const regex = /([MLHVCSQTAZ])\s*([\d\.\-\s,]*)/gi;
    let match;
    let currentX = 0, currentY = 0;
    
    while ((match = regex.exec(d)) !== null) {
      const command = match[1].toUpperCase();
      const params = match[2].trim();
      
      if (command === 'M' || command === 'L') {
        const coords = params.split(/[\s,]+/).filter(s => s.length > 0);
        for (let i = 0; i < coords.length; i += 2) {
          if (i + 1 < coords.length) {
            currentX = parseFloat(coords[i]);
            currentY = parseFloat(coords[i + 1]);
            const x = currentX * adjustedScaleX + offsetX;
            const y = currentY * adjustedScaleY + offsetY;
            points.push({ x, y });
          }
        }
      }
    }
    
    // console.log(`Parsed ${points.length} points for path '${id}'`);
    return points.length >= 2 ? points : null;  // ラインは2点以上でOK
  }

  // ライン専用のパース関数（2点のラインに対応）
  function parseLineElement(id) {
    const elem = svgDoc.getElementById(id);
    if (!elem) {
      console.warn(`Element with id '${id}' not found in SVG`);
      return null;
    }

    let points = [];
    
    if (elem.tagName === 'line') {
      // line要素の場合
      const x1 = parseFloat(elem.getAttribute('x1')) || 0;
      const y1 = parseFloat(elem.getAttribute('y1')) || 0;
      const x2 = parseFloat(elem.getAttribute('x2')) || 0;
      const y2 = parseFloat(elem.getAttribute('y2')) || 0;
      
      points = [
        { x: x1 * adjustedScaleX + offsetX, y: y1 * adjustedScaleY + offsetY },
        { x: x2 * adjustedScaleX + offsetX, y: y2 * adjustedScaleY + offsetY }
      ];
      // console.log(`Parsed line element '${id}': (${x1},${y1}) to (${x2},${y2})`);
    } else if (elem.tagName === 'path') {
      // path要素の場合は既存のparsePath関数を使用
      return parsePath(id);
    }
    
    return points.length >= 2 ? points : null;
  }

  function isValidVertices(vertices) {
    return vertices && vertices.length >= 3;
  }

  const innerPoints = parsePath('collisionInner');
  const outerPoints = parsePath('collisionOuter');
  
  // コントロールライン用のパースと設定
  const startFinishLine = parseLineElement('startFinishLine');
  const checkpoint1 = parseLineElement('checkpoint1');
  const checkpoint2 = parseLineElement('checkpoint2');
  
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
  
  // ゲームパッド設定（安全にチェック）
  if (this.input.gamepad) {
    this.input.gamepad.start();
    this.input.gamepad.once('connected', pad => { gamepad = pad; });
  }

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
  
  // カメラ設定：車を追従
  this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  this.cameras.main.startFollow(car, true, 0.1, 0.1);
  this.cameras.main.setZoom(1.0);
  
  // コントロールライン通過検出のイベント設定
  this.matter.world.on('collisionstart', function (event) {
    const pairs = event.pairs;
    
    for (let i = 0; i < pairs.length; i++) {
      const bodyA = pairs[i].bodyA;
      const bodyB = pairs[i].bodyB;
      
      // 車とコントロールラインの衝突を検出
      if ((bodyA === car.body && bodyB.controlLineId) || (bodyB === car.body && bodyA.controlLineId)) {
        const controlLineId = bodyA.controlLineId || bodyB.controlLineId;
        handleControlLineCrossing(controlLineId);
      }
    }
  });
  
  // タイム表示UI
  timeText = this.add.text(20, 20, 'Time: --:--.--', {
    fontSize: '24px',
    fill: '#000000',
    backgroundColor: '#ffffff',
    padding: { x: 10, y: 5 }
  });
  timeText.setScrollFactor(0); // カメラに固定
  
  bestTimeText = this.add.text(20, 60, 'Best: --:--.--', {
    fontSize: '20px',
    fill: '#000000',
    backgroundColor: '#ffffff',
    padding: { x: 10, y: 5 }
  });
  bestTimeText.setScrollFactor(0); // カメラに固定
  
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
  
  // console.log('Camera setup: following car with bounds', WORLD_WIDTH, 'x', WORLD_HEIGHT);
}

// コントロールライン通過処理
function handleControlLineCrossing(controlLineId) {
  const currentTime = Date.now();
  
  // console.log(`Control line crossed: ${controlLineId}`);
  
  // 対応するコントロールラインを見つける
  const line = controlLines.find(l => l.id === controlLineId);
  if (!line) return;
  
  if (controlLineId === 'startFinish') {
    if (raceStartTime === null) {
      // レース開始
      raceStartTime = currentTime;
      checkpointsPassed = 0;
      controlLines.forEach(l => l.passed = false);
      line.passed = true;
      // console.log('Race started!');
    } else if (checkpointsPassed === controlLines.filter(l => l.type === 'checkpoint').length) {
      // ラップ完了（全チェックポイント通過済み）
      currentLapTime = currentTime - raceStartTime;
      
      // ラップ履歴に追加（最新5周分を保持）
      lapHistory.unshift(currentLapTime);
      if (lapHistory.length > 5) {
        lapHistory.pop();
      }
      
      // ラップ履歴表示を更新
      updateLapHistoryDisplay();
      
      if (bestLapTime === null || currentLapTime < bestLapTime) {
        bestLapTime = currentLapTime;
        // console.log(`New best lap time: ${formatTime(bestLapTime)}`);
      } else {
        // console.log(`Lap completed: ${formatTime(currentLapTime)} (Best: ${formatTime(bestLapTime)})`);
      }
      
      // 新しいラップを開始
      raceStartTime = currentTime;
      checkpointsPassed = 0;
      controlLines.forEach(l => l.passed = false);
      line.passed = true;
    }
  } else if (line.type === 'checkpoint' && !line.passed && raceStartTime !== null) {
    // チェックポイント通過
    line.passed = true;
    checkpointsPassed++;
    // console.log(`Checkpoint ${checkpointsPassed} passed!`);
  }
}

// 時間をフォーマットする関数
function formatTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const ms = Math.floor((milliseconds % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// ラップ履歴表示を更新する関数
function updateLapHistoryDisplay() {
  for (let i = 0; i < lapHistoryTexts.length; i++) {
    if (i < lapHistory.length) {
      const lapTime = lapHistory[i];
      const isBest = lapTime === bestLapTime;
      
      lapHistoryTexts[i].setText(`Lap ${lapHistory.length - i}: ${formatTime(lapTime)}`);
      lapHistoryTexts[i].setVisible(true);
      
      // ベストタイムは色を変更
      if (isBest) {
        lapHistoryTexts[i].setStyle({
          fontSize: '16px',
          fill: '#00aa00',
          backgroundColor: '#e0ffe0',
          padding: { x: 8, y: 3 }
        });
      } else {
        lapHistoryTexts[i].setStyle({
          fontSize: '16px',
          fill: '#666666',
          backgroundColor: '#f0f0f0',
          padding: { x: 8, y: 3 }
        });
      }
    } else {
      lapHistoryTexts[i].setVisible(false);
    }
  }
}

function update() {
  if (!gamepad && this.input.gamepad && this.input.gamepad.total > 0) {
    gamepad = this.input.gamepad.getPad(0);
  }
  const padAccel = gamepad && gamepad.buttons && gamepad.buttons.length > 0 ? gamepad.buttons[0].pressed : false;
  const padBrake = gamepad && gamepad.buttons && gamepad.buttons.length > 2 ? gamepad.buttons[2].pressed : false;
  const rotationSpeed = 0.002;
  const forceMagnitude = 0.018;  // 0.012から0.018に増加（1.5倍）
  const velocity = car.body.velocity;
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  const currentAngularVelocity = car.body.angularVelocity;
  // ステアリング入力の取得
  let steerInput = 0;
  if (cursors.left.isDown) steerInput -= 1;
  if (cursors.right.isDown) steerInput += 1;
  if (gamepad && gamepad.axes && gamepad.axes.length > 0) {
    const sx = gamepad.axes[0].getValue();
    if (Math.abs(sx) > 0.1) steerInput += sx;
  }
  // 車体の向きと進行方向の計算
  let heading = car.rotation + Math.PI / 2;
  const forward = { x: Math.cos(heading), y: Math.sin(heading) };
  const vForward = velocity.x * forward.x + velocity.y * forward.y;
  const side = { x: -Math.sin(heading), y: Math.cos(heading) };
  const vSide = velocity.x * side.x + velocity.y * side.y;
  // 進行方向の角度を計算
  const velocityAngle = Math.atan2(velocity.y, velocity.x);
  // 車体の向きと進行方向の差を計算
  let directionDiff = Math.atan2(Math.sin(velocityAngle - heading), Math.cos(velocityAngle - heading));
  // スリップ角の計算
  let slipAngle = Math.atan2(vSide, vForward);

  // 直進安定性の計算：車体方向と進行方向が近く、ステアリング入力が少ない場合
  // 直進判定条件パラメータ
  const MAX_DIRECTION_DIFF = 0.1;                  // 方向差の閾値
  const MAX_SLIP_ANGLE = 0.1;                      // スリップ角の閾値
  const MAX_ANGULAR_VELOCITY_STRAIGHT = 0.02;      // 直進とみなす最大角速度
  const MIN_STRAIGHT_SPEED = 1.5;                  // 直進判定最小速度
  // 直進安定性の計算：方向差・スリップ角・角速度が小さく、ステア入力が少ない場合
  const isGoingStraight =
    Math.abs(directionDiff) < MAX_DIRECTION_DIFF &&
    Math.abs(slipAngle) < MAX_SLIP_ANGLE &&
    Math.abs(currentAngularVelocity) < MAX_ANGULAR_VELOCITY_STRAIGHT &&
    Math.abs(steerInput) < 0.1 &&
    speed > MIN_STRAIGHT_SPEED;

  // 基本的な角速度減衰
  let angularDamping = 0.99906 - Math.min(speed / 18, 1) * 0.01706;
  // 直進時の追加安定化（さらに強化）
  if (isGoingStraight) {
    angularDamping *= 0.7; // 0.85→0.7で減衰を強化
    const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    if (currentSpeed > 0.1) {
      // 完全収束処理：車体の向きと進行方向が十分近い場合はvelocityベクトルをheading方向に揃える
      if (Math.abs(directionDiff) < 0.05) {
        // heading方向に完全に揃える
        const newVx = Math.cos(heading) * currentSpeed;
        const newVy = Math.sin(heading) * currentSpeed;
        car.setVelocity(newVx, newVy);
      } else {
        // 通常の収束処理
        const forwardSpeed = velocity.x * forward.x + velocity.y * forward.y;
        const baseConvergenceRate = 0.03; // 0.02→0.03で収束力を強化
        const speedFactor = Math.min(speed / 10, 1.5);
        const convergenceRate = baseConvergenceRate * (1 + speedFactor);
        const targetVelocity = {
          x: forward.x * forwardSpeed,
          y: forward.y * forwardSpeed
        };
        car.setVelocity(
          velocity.x + (targetVelocity.x - velocity.x) * convergenceRate,
          velocity.y + (targetVelocity.y - velocity.y) * convergenceRate
        );
      }
    }
  }

  // --- スモーク発生・管理 ---
  const slipThreshold = 0.25; // スリップ角
  let isSliding = Math.abs(slipAngle) > slipThreshold && speed > 2.0;
  // 出現頻度を半分に（120msごと）
  const smokeInterval = 120; // ms
  const now = Date.now();
  const startSmokeSize = 60; // px（出現時）
  const maxSmokeSize = 120; // px（最大）
  const maxAlpha = 0.7; // 70%
  const smokeLife = 1500; // 消滅までの合計時間(ms)
  const expandTime = 500; // 拡大完了までの時間(ms)
  if (isSliding && (now - lastSmokeTime > smokeInterval)) {
    if (smokeSprites.length >= 5) {
      const oldest = smokeSprites.shift();
      if (oldest) oldest.destroy();
    }
    // 車体の中心から20%後ろの位置
    const carLength = car.displayHeight || 48; // デフォルト48px
    const backOffset = -carLength * 0.2; // 20%後ろ
    const smokeX = car.x + Math.cos(heading) * backOffset;
    const smokeY = car.y + Math.sin(heading) * backOffset;
    // スモークを車体の下レイヤーに
    const smoke = car.scene.add.sprite(smokeX, smokeY, 'smoke');
    smoke.setOrigin(0.5, 0.5);
    smoke.setAlpha(maxAlpha);
    // 60pxから開始
    const initialScale = startSmokeSize / smoke.width;
    smoke.setScale(initialScale);
    smoke.birthTime = now;
    smokeSprites.push(smoke);
    lastSmokeTime = now;
    // レイヤーを車体の下に
    car.scene.children.moveBelow(smoke, car);
  }
  // 拡大→最大サイズ維持→消滅
  for (let i = smokeSprites.length - 1; i >= 0; i--) {
    const smoke = smokeSprites[i];
    const age = now - smoke.birthTime;
    // 0.5秒で最大サイズに拡大、その後維持
    let pxScale;
    if (age < expandTime) {
      const scale = age / expandTime; // 0→1
      pxScale = (startSmokeSize + (maxSmokeSize - startSmokeSize) * scale) / smoke.width;
    } else {
      pxScale = maxSmokeSize / smoke.width;
    }
    smoke.setScale(pxScale);
    // 徐々に薄く（smokeLifeでmaxAlpha→0）
    const alpha = Math.max(0, maxAlpha * (1 - age / smokeLife));
    smoke.setAlpha(alpha);
    if (age > smokeLife) {
      smoke.destroy();
      smokeSprites.splice(i, 1);
    }
  }
  
  // バック時はハンドル逆転
  let isReversing = false;
  if (keyZ.isDown || padBrake) {
    // 停車時はバック
    if (speed < 1.0) {
      isReversing = true;
    }
  }
  let steerInputForSteer = steerInput;
  if (isReversing) {
    steerInputForSteer = -steerInput;
  }
  // ステアリング計算
  const maxSteerAngle = Math.PI / 3;
  const targetDirection = heading + steerInputForSteer * maxSteerAngle;
  let angleDiff = Math.atan2(Math.sin(targetDirection - heading), Math.cos(targetDirection - heading));
  
  let slipLoss = 1.0 - Math.min(Math.abs(slipAngle) / (Math.PI / 2), 1.0) * 0.7;
  let traction = Math.max(0, Math.min(1, (Math.abs(vForward) - 0.05) / 0.7));
  let steerRate = 0.00264 * traction * slipLoss;
  
  car.setAngularVelocity(currentAngularVelocity * angularDamping + angleDiff * steerRate);
  if (keyX.isDown || padAccel) {
    const angle = car.rotation + Math.PI / 2;
    const forceX = Math.cos(angle) * forceMagnitude;
    const forceY = Math.sin(angle) * forceMagnitude;
    car.applyForce({ x: forceX, y: forceY });
  }
  // ...existing code...
  if (keyZ.isDown || padBrake) {
    // 現在の速度が低い場合（停車時）はバック
    if (speed < 1.0) {
      const angle = car.rotation + Math.PI / 2;
      const backForceX = -Math.cos(angle) * forceMagnitude * 0.3;  // 通常の30%の力でバック
      const backForceY = -Math.sin(angle) * forceMagnitude * 0.3;
      car.applyForce({ x: backForceX, y: backForceY });
    } else {
      // 通常時はブレーキ
      car.setVelocity(car.body.velocity.x * 0.98, car.body.velocity.y * 0.98);
    }
  }
  if (!(keyX.isDown || padAccel) && !(keyZ.isDown || padBrake)) {
    car.setVelocity(car.body.velocity.x * 0.995, car.body.velocity.y * 0.995);
  }
  
  // タイム表示の更新
  if (raceStartTime !== null) {
    const currentTime = Date.now() - raceStartTime;
    timeText.setText(`Time: ${formatTime(currentTime)}`);
  }
  
  if (bestLapTime !== null) {
    bestTimeText.setText(`Best: ${formatTime(bestLapTime)}`);
  }
}
