import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
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
    mode: Phaser.Scale.RESIZE,
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
  // 背景画像
  const bg = this.add.image(0, 0, 'bg');
  bg.setOrigin(0, 0);
  bg.setDisplaySize(window.innerWidth, window.innerHeight);

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
  
  // アスペクト比を維持するスケーリング
  const scaleX = window.innerWidth / vbWidth;
  const scaleY = window.innerHeight / vbHeight;
  const baseScale = Math.min(scaleX, scaleY); // 基本スケール
  
  // 横に5%長くするため、X軸のスケールを調整
  const finalScaleX = baseScale * 1.05;
  const finalScaleY = baseScale;
  
  console.log('SVG scale factors:', { scaleX, scaleY, baseScale, finalScaleX, finalScaleY });

  // 画面四隅の参照用要素を検出・表示する関数
  function checkCornerReferences() {
    const cornerIds = ['corner-tl', 'corner-tr', 'corner-bl', 'corner-br', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
    const corners = [];
    
    cornerIds.forEach(id => {
      const elem = svgDoc.getElementById(id);
      if (elem) {
        let x = 0, y = 0;
        
        if (elem.tagName === 'circle' || elem.tagName === 'ellipse') {
          x = parseFloat(elem.getAttribute('cx')) || 0;
          y = parseFloat(elem.getAttribute('cy')) || 0;
        } else if (elem.tagName === 'rect') {
          x = parseFloat(elem.getAttribute('x')) || 0;
          y = parseFloat(elem.getAttribute('y')) || 0;
        } else if (elem.tagName === 'path') {
          const d = elem.getAttribute('d');
          const m = /M\s*([\d\.\-]+)[\s,]+([\d\.\-]+)/.exec(d);
          if (m) {
            x = parseFloat(m[1]);
            y = parseFloat(m[2]);
          }
        }
        
        corners.push({
          id: id,
          originalX: x,
          originalY: y,
          scaledX: x * finalScaleX,
          scaledY: y * finalScaleY
        });
        console.log(`Corner reference found: ${id} at (${x}, ${y}) -> scaled (${x * finalScaleX}, ${y * finalScaleY})`);
      }
    });
    
    return corners;
  }
  
  const cornerReferences = checkCornerReferences();
  
  // SVGのViewBox境界を表示用に計算
  const svgBounds = {
    topLeft: { x: vb[0] * finalScaleX, y: vb[1] * finalScaleY },
    topRight: { x: (vb[0] + vbWidth) * finalScaleX, y: vb[1] * finalScaleY },
    bottomLeft: { x: vb[0] * finalScaleX, y: (vb[1] + vbHeight) * finalScaleY },
    bottomRight: { x: (vb[0] + vbWidth) * finalScaleX, y: (vb[1] + vbHeight) * finalScaleY }
  };
  
  console.log('SVG ViewBox bounds (scaled):', svgBounds);
  console.log('Window dimensions:', { width: window.innerWidth, height: window.innerHeight });

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
            const x = currentX * finalScaleX;
            const y = currentY * finalScaleY;
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
    // 複雑な形状の場合は線分ごとに分割して作成
    for (let i = 0; i < innerPoints.length - 1; i++) {
      const p1 = innerPoints[i];
      const p2 = innerPoints[i + 1];
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      
      // 幅と高さを正しく設定（長さ, 厚さの順）
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
      
      // 幅と高さを正しく設定（長さ, 厚さの順）
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

  // ポリゴン確認用の線描画
  const graphics = this.add.graphics();
  graphics.lineStyle(2, 0xff0000, 1); // 赤色、太さ2
  if (isValidVertices(innerPoints)) {
    graphics.beginPath();
    graphics.moveTo(innerPoints[0].x, innerPoints[0].y);
    for (let i = 1; i < innerPoints.length; i++) {
      graphics.lineTo(innerPoints[i].x, innerPoints[i].y);
    }
    graphics.closePath();
    graphics.strokePath();
  }
  graphics.lineStyle(2, 0x0000ff, 1); // 青色、太さ2
  if (isValidVertices(outerPoints)) {
    graphics.beginPath();
    graphics.moveTo(outerPoints[0].x, outerPoints[0].y);
    for (let i = 1; i < outerPoints.length; i++) {
      graphics.lineTo(outerPoints[i].x, outerPoints[i].y);
    }
    graphics.closePath();
    graphics.strokePath();
  }

  // 画面四隅とViewBox境界の可視化
  const boundsGraphics = this.add.graphics();
  
  // SVGのViewBox境界を緑色で表示
  boundsGraphics.lineStyle(3, 0x00ff00, 1);
  boundsGraphics.strokeRect(
    svgBounds.topLeft.x, 
    svgBounds.topLeft.y, 
    svgBounds.topRight.x - svgBounds.topLeft.x, 
    svgBounds.bottomLeft.y - svgBounds.topLeft.y
  );
  
  // 現在の画面境界を黄色で表示
  boundsGraphics.lineStyle(2, 0xffff00, 1);
  boundsGraphics.strokeRect(0, 0, window.innerWidth, window.innerHeight);
  
  // 検出された四隅参照点をマゼンタの円で表示
  cornerReferences.forEach(corner => {
    boundsGraphics.fillStyle(0xff00ff);
    boundsGraphics.fillCircle(corner.scaledX, corner.scaledY, 8);
    
    // ラベルを追加
    const text = this.add.text(corner.scaledX + 10, corner.scaledY - 10, corner.id, {
      fontSize: '12px',
      color: '#ff00ff',
      backgroundColor: '#000000',
      padding: { x: 2, y: 2 }
    });
  });
  
  console.log('Visualization added: Green = SVG ViewBox, Yellow = Screen bounds, Magenta = Corner references');

  // 入力設定
  cursors = this.input.keyboard.createCursorKeys();
  keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  
  // ゲームパッド設定（安全にチェック）
  if (this.input.gamepad) {
    this.input.gamepad.start();
    this.input.gamepad.once('connected', pad => { gamepad = pad; });
  }

  // SVG内のspawn位置の取得（複数の可能な名前を試す）
  let carX = window.innerWidth / 2;
  let carY = window.innerHeight / 2;
  
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
      carX = cx * finalScaleX;
      carY = cy * finalScaleY;
      console.log('Spawn from circle - original:', cx, cy, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'ellipse') {
      const cx = parseFloat(spawnElem.getAttribute('cx')) || 0;
      const cy = parseFloat(spawnElem.getAttribute('cy')) || 0;
      carX = cx * finalScaleX;
      carY = cy * finalScaleY;
      console.log('Spawn from ellipse - original:', cx, cy, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'rect') {
      const x = parseFloat(spawnElem.getAttribute('x')) || 0;
      const y = parseFloat(spawnElem.getAttribute('y')) || 0;
      const width = parseFloat(spawnElem.getAttribute('width')) || 0;
      const height = parseFloat(spawnElem.getAttribute('height')) || 0;
      carX = (x + width/2) * finalScaleX;
      carY = (y + height/2) * finalScaleY;
      console.log('Spawn from rect - original:', x, y, 'center:', x + width/2, y + height/2, 'scaled:', carX, carY);
    } else if (spawnElem.tagName === 'path') {
      const d = spawnElem.getAttribute('d');
      console.log('Path d attribute:', d);
      const m = /M\s*([\d\.\-]+)[\s,]+([\d\.\-]+)/.exec(d);
      if (m) {
        const origX = parseFloat(m[1]);
        const origY = parseFloat(m[2]);
        carX = origX * finalScaleX;
        carY = origY * finalScaleY;
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
          carX = origX * finalScaleX;
          carY = origY * finalScaleY;
          console.log('Spawn from group transform - original:', origX, origY, 'scaled:', carX, carY);
        }
      }
    }
    
    // 境界チェックを削除して、実際の座標を使用
    console.log('Final spawn position (before bounds check):', carX, carY);
    console.log('Window dimensions:', window.innerWidth, window.innerHeight);
    
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
  car.setDisplaySize(30, 42);
  car.setRotation(-Math.PI / 2);
  car.setFrictionAir(0.025);
  car.setMass(30);
  car.setFixedRotation(false);
  car.body.render.sprite.xOffset = 0.5;
  car.body.render.sprite.yOffset = 0.5;
  car.setFriction(0.125);
  console.log('Car created:', car);
}

function update() {
  if (!gamepad && this.input.gamepad && this.input.gamepad.total > 0) {
    gamepad = this.input.gamepad.getPad(0);
  }
  const padAccel = gamepad && gamepad.buttons && gamepad.buttons.length > 0 ? gamepad.buttons[0].pressed : false;
  const rotationSpeed = 0.002;
  const forceMagnitude = 0.012;
  const velocity = car.body.velocity;
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  const currentAngularVelocity = car.body.angularVelocity;
  let angularDamping = 0.99906 - Math.min(speed / 18, 1) * 0.01706;
  let steerInput = 0;
  if (cursors.left.isDown) steerInput -= 1;
  if (cursors.right.isDown) steerInput += 1;
  if (gamepad && gamepad.axes && gamepad.axes.length > 0) {
    const sx = gamepad.axes[0].getValue();
    if (Math.abs(sx) > 0.1) steerInput += sx;
  }
  const maxSteerAngle = Math.PI / 3;
  const targetDirection = car.rotation + Math.PI / 2 + steerInput * maxSteerAngle;
  let heading = car.rotation + Math.PI / 2;
  let angleDiff = Math.atan2(Math.sin(targetDirection - heading), Math.cos(targetDirection - heading));
  const forward = { x: Math.cos(heading), y: Math.sin(heading) };
  const vForward = velocity.x * forward.x + velocity.y * forward.y;
  const side = { x: -Math.sin(heading), y: Math.cos(heading) };
  const vSide = velocity.x * side.x + velocity.y * side.y;
  let slipAngle = Math.atan2(vSide, vForward);
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
  const padBrake = gamepad && gamepad.buttons && gamepad.buttons.length > 1 ? gamepad.buttons[1].pressed : false;
  if (keyZ.isDown || padBrake) {
    car.setVelocity(car.body.velocity.x * 0.98, car.body.velocity.y * 0.98);
  }
  if (!(keyX.isDown || padAccel) && !(keyZ.isDown || padBrake)) {
    car.setVelocity(car.body.velocity.x * 0.995, car.body.velocity.y * 0.995);
  }
}
