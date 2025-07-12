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
  },
  input: {
    gamepad: true
  }
};

const game = new Phaser.Game(config);

let cursors, keyX, keyZ;
let car;
let gamepad;  // ゲームパッド

function preload() {
  this.load.image('car', 'car.png');
  this.load.image('bg', 'background.png'); // 背景画像を読み込み
}

function create() {
  // 背景画像を画面中央に表示（ウィンドウサイズに合わせて拡大）
  const bg = this.add.image(window.innerWidth / 2, window.innerHeight / 2, 'bg');
  bg.setOrigin(0.5, 0.5);
  bg.setDisplaySize(window.innerWidth, window.innerHeight);
  // 入力設定
  cursors = this.input.keyboard.createCursorKeys();
  keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  // ゲームパッド設定
  this.input.gamepad.start();
  this.input.gamepad.once('connected', pad => { gamepad = pad; });


  // 車のスプライト
  car = this.matter.add.image(window.innerWidth / 2, window.innerHeight / 2, 'car');
  car.setOrigin(0.5, 0.5);
  car.setDisplaySize(42, 42); // 車のサイズを128x128pxに設定
  car.setRotation(-Math.PI / 2); // 表示用：左に90度回転（-π/2ラジアン）
  car.setFrictionAir(0.025); // 空気抵抗を減らして最高速UP
  car.setMass(30);
  car.setFixedRotation(false); // Matter用：回転を許可
  
  // 物理ボディの中心点を画像の中央に設定
  car.body.render.sprite.xOffset = 0.5;
  car.body.render.sprite.yOffset = 0.5;
  
  // 横滑りを発生させるために摩擦を調整
  car.setFriction(0.125); // 摩擦を増やす
}

function update() {
  // 未設定gamepadがあれば取得
  if (!gamepad && this.input.gamepad.total > 0) {
    gamepad = this.input.gamepad.getPad(0);
  }
  // アクセル入力（ゲームパッド）の状態を先に取得
  const padAccel = gamepad && gamepad.buttons && gamepad.buttons.length > 0 ? gamepad.buttons[0].pressed : false;

  const rotationSpeed = 0.002;
  const forceMagnitude = 0.012; // アクセルON時の前進加速力（加速を弱める）

  // 物理演算用の各種値
  const velocity = car.body.velocity; // 速度ベクトル
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y); // 速度の大きさ
  const currentAngularVelocity = car.body.angularVelocity; // 現在の角速度（ヨー速度）
  // 速度に応じて角速度減衰率を変化（低速で強く、高速で弱く）、全体的には若干弱め
  let angularDamping = 0.99906 - Math.min(speed / 18, 1) * 0.01706;
  
  // --- ステアは「進みたい方向ベクトル」指示のみ、旋回はトラクション依存 ---
  // ステア入力値（-1:左, 0:直進, +1:右）
  let steerInput = 0;
  if (cursors.left.isDown) steerInput -= 1;
  if (cursors.right.isDown) steerInput += 1;
  if (gamepad && gamepad.axes && gamepad.axes.length > 0) {
    const sx = gamepad.axes[0].getValue();
    if (Math.abs(sx) > 0.1) steerInput += sx;
  }
  // 最大ステア角（ラジアン）
  const maxSteerAngle = Math.PI / 3; // 60度
  // 目標進行方向（車体向き＋ステア角）
  const targetDirection = car.rotation + Math.PI / 2 + steerInput * maxSteerAngle;
  // 現在の車体の物理的向き
  let heading = car.rotation + Math.PI / 2;
  // 車体向きと目標進行方向の差分（旋回すべき角度）
  let angleDiff = Math.atan2(Math.sin(targetDirection - heading), Math.cos(targetDirection - heading));
  // 前進成分（車体向き方向の速度、トラクションの強さ）
  const forward = { x: Math.cos(heading), y: Math.sin(heading) };
  const vForward = velocity.x * forward.x + velocity.y * forward.y;
  // 横滑り成分（車体に対して横方向の速度）
  const side = { x: -Math.sin(heading), y: Math.cos(heading) };
  const vSide = velocity.x * side.x + velocity.y * side.y;
  // スリップアングル（進行方向と車体向きのズレ）
  let slipAngle = Math.atan2(vSide, vForward);
  // スリップアングルが大きいと旋回効果を減衰
  let slipLoss = 1.0 - Math.min(Math.abs(slipAngle) / (Math.PI / 2), 1.0) * 0.7;
  // トラクション（前進成分が強いほど旋回が効く）
  let traction = Math.max(0, Math.min(1, (Math.abs(vForward) - 0.05) / 0.7)); // 低速でも舵効きを良く
  // 旋回感度（トラクション・スリップアングルで減衰、車両ごとに調整可能）
  let steerRate = 0.00264 * traction * slipLoss; // 舵の効きをさらに20%強化
  // 旋回反応（慣性＋目標方向への補正）
  car.setAngularVelocity(currentAngularVelocity * angularDamping + angleDiff * steerRate);

  // アクセル（Xキー）
  if (keyX.isDown || padAccel) {
    const angle = car.rotation + Math.PI / 2; // 物理演算用の角度補正
    const forceX = Math.cos(angle) * forceMagnitude;
    const forceY = Math.sin(angle) * forceMagnitude;
  // ゲームパッド左スティックX軸
    car.applyForce({ x: forceX, y: forceY });
  }

  if (gamepad && gamepad.axes && gamepad.axes.length > 0) {
    const sx = gamepad.axes[0].getValue();
    if (Math.abs(sx) > 0.1) steerInput += sx;
  }
  // ブレーキ（Zキー）
  const padBrake = gamepad && gamepad.buttons && gamepad.buttons.length > 1 ? gamepad.buttons[1].pressed : false;
  if (keyZ.isDown || padBrake) {
    car.setVelocity(car.body.velocity.x * 0.98, car.body.velocity.y * 0.98);
  }

  // スロットルオフ時の自然減速をもっと弱く（アクセルもブレーキも押していない場合のみ）
  if (!(keyX.isDown || padAccel) && !(keyZ.isDown || padBrake)) {
    car.setVelocity(car.body.velocity.x * 0.995, car.body.velocity.y * 0.995);
  }
}