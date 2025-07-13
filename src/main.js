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
      debug: {
        showBody: true,
        showStaticBody: true,
        showVelocity: true
      }
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

function preload() {
  this.load.image('car', 'car.png');
  this.load.image('bg', 'background.png');
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
  console.log('SVG elements with IDs:');
  const allElements = svgDoc.querySelectorAll('[id]');
  allElements.forEach(elem => {
    console.log(`- ${elem.tagName} with id: ${elem.id}`);
  });
  
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
  
  console.log('4K Map scale factors:', { scaleX, scaleY, baseScale, finalScaleX, finalScaleY });
  console.log('World size:', { width: WORLD_WIDTH, height: WORLD_HEIGHT });

  // square要素を基準とした配置調整（4K用に簡略化）
  let adjustedScaleX = finalScaleX;
  let adjustedScaleY = finalScaleY;
  let offsetX = 0;
  let offsetY = 0;
  
  console.log('Using 4K scaling:', { adjustedScaleX, adjustedScaleY, offsetX, offsetY });

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
    
    console.log(`Parsed ${points.length} points for path '${id}'`);
    return points.length >= 3 ? points : null;
  }

  function isValidVertices(vertices) {
    return vertices && vertices.length >= 3;
  }

  const innerPoints = parsePath('collisionInner');
  const outerPoints = parsePath('collisionOuter');

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
    console.log('Inner collision created with', innerPoints.length, 'segments');
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
    console.log('Outer collision created with', outerPoints.length, 'segments');
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
  
  console.log('Checking spawn element with ID:', foundSpawnId);
  console.log('Spawn element:', spawnElem);
  
  if (spawnElem) {
    console.log('Spawn element found, tagName:', spawnElem.tagName);
    console.log('All attributes:', Array.from(spawnElem.attributes).map(attr => `${attr.name}="${attr.value}"`));
    
    if (spawnElem.tagName === 'circle') {
      const cx = parseFloat(spawnElem.getAttribute('cx')) || 0;
      const cy = parseFloat(spawnElem.getAttribute('cy')) || 0;
      carX = cx * adjustedScaleX + offsetX;
      carY = cy * adjustedScaleY + offsetY;
      console.log('Spawn from circle - original:', cx, cy, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'ellipse') {
      const cx = parseFloat(spawnElem.getAttribute('cx')) || 0;
      const cy = parseFloat(spawnElem.getAttribute('cy')) || 0;
      carX = cx * adjustedScaleX + offsetX;
      carY = cy * adjustedScaleY + offsetY;
      console.log('Spawn from ellipse - original:', cx, cy, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'rect') {
      const x = parseFloat(spawnElem.getAttribute('x')) || 0;
      const y = parseFloat(spawnElem.getAttribute('y')) || 0;
      const width = parseFloat(spawnElem.getAttribute('width')) || 0;
      const height = parseFloat(spawnElem.getAttribute('height')) || 0;
      carX = (x + width/2) * adjustedScaleX + offsetX;
      carY = (y + height/2) * adjustedScaleY + offsetY;
      console.log('Spawn from rect - original:', x, y, 'center:', x + width/2, y + height/2, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'path') {
      const d = spawnElem.getAttribute('d');
      console.log('Path d attribute:', d);
      const m = /M\s*([\d\.\-]+)[\s,]+([\d\.\-]+)/.exec(d);
      if (m) {
        const origX = parseFloat(m[1]);
        const origY = parseFloat(m[2]);
        carX = origX * adjustedScaleX + offsetX;
        carY = origY * adjustedScaleY + offsetY;
        console.log('Spawn from path - original:', origX, origY, 'scaled:', carX, carY);
      }
    } else if (spawnElem.tagName === 'g') {
      // グループ要素の場合、transform属性を確認
      const transform = spawnElem.getAttribute('transform');
      console.log('Group transform:', transform);
      if (transform) {
        const translateMatch = /translate\(([\d\.\-]+)[\s,]*([\d\.\-]+)\)/.exec(transform);
        if (translateMatch) {
          const origX = parseFloat(translateMatch[1]);
          const origY = parseFloat(translateMatch[2]);
          carX = origX * adjustedScaleX + offsetX;
          carY = origY * adjustedScaleY + offsetY;
          console.log('Spawn from group transform - original:', origX, origY, 'scaled:', carX, carY);
        }
      }
    }
    
    console.log('Final spawn position:', carX, carY);
    console.log('World dimensions:', WORLD_WIDTH, WORLD_HEIGHT);
    
  } else {
    console.warn('No spawn element found with any of these IDs:', possibleSpawnIds);
    if (isValidVertices(innerPoints)) {
      const sum = innerPoints.reduce((acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }), { x: 0, y: 0 });
      carX = sum.x / innerPoints.length;
      carY = sum.y / innerPoints.length;
      console.log('Fallback: spawn from inner points center:', carX, carY);
    }
  }
  
  console.log('Final car position:', carX, carY);

  // 車オブジェクトの作成
  console.log('Creating car at position:', carX, carY);
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
  console.log('Car created:', car);
  
  // カメラ設定：車を追従
  this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  this.cameras.main.startFollow(car, true, 0.1, 0.1);
  this.cameras.main.setZoom(1.0);
  
  console.log('Camera setup: following car with bounds', WORLD_WIDTH, 'x', WORLD_HEIGHT);
}

function update() {
  if (!gamepad && this.input.gamepad && this.input.gamepad.total > 0) {
    gamepad = this.input.gamepad.getPad(0);
  }
  const padAccel = gamepad && gamepad.buttons && gamepad.buttons.length > 0 ? gamepad.buttons[0].pressed : false;
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
  const isGoingStraight = Math.abs(directionDiff) < 0.1 && Math.abs(steerInput) < 0.2 && speed > 1.0;
  
  // 基本的な角速度減衰
  let angularDamping = 0.99906 - Math.min(speed / 18, 1) * 0.01706;
  
  // 直進時の追加安定化
  if (isGoingStraight) {
    // 直進時は角速度をより強く減衰させる
    angularDamping *= 0.92;
    
    // 車両が向いている方向に速度を収束させる
    const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    if (currentSpeed > 0.1) {
      // 車体の前進方向と現在の速度方向の内積（前進成分）
      const forwardSpeed = velocity.x * forward.x + velocity.y * forward.y;
      
      // 車体方向への収束率（0.02 = 2%ずつ車体方向に収束）
      const convergenceRate = 0.02;
      
      // 目標速度：車体が向いている方向に現在の速度の大きさで進む
      const targetVelocity = {
        x: forward.x * forwardSpeed,
        y: forward.y * forwardSpeed
      };
      
      // 現在の速度から目標速度への補間
      car.setVelocity(
        velocity.x + (targetVelocity.x - velocity.x) * convergenceRate,
        velocity.y + (targetVelocity.y - velocity.y) * convergenceRate
      );
    }
  }
  
  // ステアリング計算
  const maxSteerAngle = Math.PI / 3;
  const targetDirection = heading + steerInput * maxSteerAngle;
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
  const padBrake = gamepad && gamepad.buttons && gamepad.buttons.length > 2 ? gamepad.buttons[2].pressed : false;
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
}
