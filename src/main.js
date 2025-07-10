import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#ffffff',
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 0 }
    }
  },
  scene: {
    preload,
    create,
    update
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);

let cursors, keyX, keyZ;
let car;

function preload() {
  this.load.image('car', 'car.png');
}

function create() {
  // 入力設定
  cursors = this.input.keyboard.createCursorKeys();
  keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);

  // 車のスプライト
  car = this.matter.add.image(window.innerWidth / 2, window.innerHeight / 2, 'car');
  car.setOrigin(0.5, 0.5);
  car.setDisplaySize(128, 128); // 車のサイズを128x128pxに設定
  car.setRotation(-Math.PI / 2); // 表示用：左に90度回転（-π/2ラジアン）
  car.setFrictionAir(0.01); // 空気抵抗をさらに減らす
  car.setMass(30);
  car.setFixedRotation(false); // Matter用：回転を許可
  
  // 物理ボディの中心点を画像の中央に設定
  car.body.render.sprite.xOffset = 0.5;
  car.body.render.sprite.yOffset = 0.5;
  
  // 横滑りを発生させるために摩擦を調整
  car.setFriction(0.05); // 摩擦をさらに下げる
}

function update() {
  const rotationSpeed = 0.001; // 修正前の1割増し（0.05 → 0.055）
  const forceMagnitude = 0.008;
  const angularDamping = 0.98; // 角速度の減衰率（1に近いほど長く回転が続く）

  // 現在の速度を取得
  const velocity = car.body.velocity;
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  const currentAngularVelocity = car.body.angularVelocity;
  
  // 左右旋回（速度に比例して旋回力を調整）
  // 速度0.5から開始して、2.8で最大旋回速度に到達するよう滑らかに補間
  const minSpeed = 0.5;
  const maxSpeed = 1.5; // 修正後の最大速度（1.0に変更）
  const speedFactor = Math.max(0, Math.min(1, (speed - minSpeed) / (maxSpeed - minSpeed)));
  const speedBasedRotation = rotationSpeed * speedFactor;
  
  if (cursors.left.isDown && speed > 0.3) {
    // 左旋回：現在の角速度が右回転の場合はカウンターステア効果
    if (currentAngularVelocity > 0) {
      // カウンターステア：より強い減衰
      car.setAngularVelocity(currentAngularVelocity * 0.85 - speedBasedRotation);
    } else {
      car.setAngularVelocity(currentAngularVelocity - speedBasedRotation);
    }
  } else if (cursors.right.isDown && speed > 0.3) {
    // 右旋回：現在の角速度が左回転の場合はカウンターステア効果
    if (currentAngularVelocity < 0) {
      // カウンターステア：より強い減衰
      car.setAngularVelocity(currentAngularVelocity * 0.85 + speedBasedRotation);
    } else {
      car.setAngularVelocity(currentAngularVelocity + speedBasedRotation);
    }
  } else {
    // キーが離されている場合：角速度を徐々に減衰させる（完全には止めない）
    car.setAngularVelocity(currentAngularVelocity * angularDamping);
  }

  // アクセル（Xキー）
  if (keyX.isDown) {
    const angle = car.rotation + Math.PI / 2; // 物理演算用の角度補正
    const forceX = Math.cos(angle) * forceMagnitude;
    const forceY = Math.sin(angle) * forceMagnitude;
    car.applyForce({ x: forceX, y: forceY });
  }

  // ブレーキ（Zキー）→速度を減少させる
  if (keyZ.isDown) {
    car.setVelocity(car.body.velocity.x * 0.95, car.body.velocity.y * 0.95);
  }
}