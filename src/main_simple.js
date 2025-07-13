import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
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
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

let cursors;
let car;

function preload() {
  this.load.image('car', 'car.png');
  this.load.image('bg', 'background.png');
  this.load.text('collisionSVG', 'collision.svg');
}

function create() {
  // 背景画像
  const bg = this.add.image(400, 300, 'bg');
  bg.setScale(0.4); // 画面に収まるようにスケール調整
  
  // 車の作成
  car = this.matter.add.image(400, 300, 'car');
  car.setScale(0.1);
  car.setFriction(0.1);
  car.setFrictionAir(0.02);
  
  // 入力設定
  cursors = this.input.keyboard.createCursorKeys();
  
  console.log('Basic game setup complete');
}

function update() {
  if (!car) return;

  const speed = 0.01;
  const rotationSpeed = 0.05;
  
  // 回転
  if (cursors.left.isDown) {
    car.setAngularVelocity(-rotationSpeed);
  } else if (cursors.right.isDown) {
    car.setAngularVelocity(rotationSpeed);
  } else {
    car.setAngularVelocity(car.body.angularVelocity * 0.9);
  }
  
  // 前進・後退
  if (cursors.up.isDown) {
    this.matter.applyForce(car, car.body.position, {
      x: Math.cos(car.rotation) * speed,
      y: Math.sin(car.rotation) * speed
    });
  } else if (cursors.down.isDown) {
    this.matter.applyForce(car, car.body.position, {
      x: -Math.cos(car.rotation) * speed * 0.5,
      y: -Math.sin(car.rotation) * speed * 0.5
    });
  }
}
