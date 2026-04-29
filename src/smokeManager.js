/**
 * スモーク効果管理ユーティリティ
 *
 * ドリフト時に車の後方からスモークパーティクルを発生・更新する。
 */

import { SMOKE } from './constants.js';

const {
  SLIP_ANGLE_THRESHOLD,
  MIN_SPEED,
  SPAWN_INTERVAL,
  START_SIZE,
  MAX_SIZE,
  MAX_ALPHA,
  LIFE_TIME,
  EXPAND_TIME
} = SMOKE;

/**
 * スモークマネージャーを生成する。
 *
 * @param {Phaser.Scene} scene - Phaser シーン
 * @returns {Object} smokeManager インスタンス
 */
export function createSmokeManager(scene) {
  return {
    sprites: [],
    lastTime: 0,
    scene: scene,

    /**
     * 毎フレーム呼び出されるスモーク更新関数。
     *
     * @param {Phaser.Physics.Matter.Image} car - 車
     * @param {number} slipAngle - 現在のスリップ角
     * @param {number} speed - 現在の速度
     * @param {number} heading - 車の進行方向（ラジアン）
     */
    update(car, slipAngle, speed, heading) {
      const isSliding = Math.abs(slipAngle) > SLIP_ANGLE_THRESHOLD && speed > MIN_SPEED;
      const now = this.scene.time.now;

      // スモーク生成
      if (isSliding && (now - this.lastTime > SPAWN_INTERVAL)) {
        // 最大スプライト数に達したら最古のを削除
        if (this.sprites.length >= 5) {
          const oldest = this.sprites.shift();
          if (oldest) oldest.destroy();
        }

        // 車体の中心から後ろの位置にスモークを生成
        const carLength = car.displayHeight || 48;
        const backOffset = -carLength * 0.2;
        const smokeX = car.x + Math.cos(heading) * backOffset;
        const smokeY = car.y + Math.sin(heading) * backOffset;

        const smoke = this.scene.add.sprite(smokeX, smokeY, 'smoke');
        smoke.setOrigin(0.5, 0.5);
        smoke.setAlpha(MAX_ALPHA);

        const initialScale = START_SIZE / smoke.width;
        smoke.setScale(initialScale);
        smoke.birthTime = now;
        this.sprites.push(smoke);
        this.lastTime = now;

        // レイヤーを車体の下に
        this.scene.children.moveBelow(smoke, car);
      }

      // スモーク更新・削除
      for (let i = this.sprites.length - 1; i >= 0; i--) {
        const smoke = this.sprites[i];
        const age = now - smoke.birthTime;

        // サイズ変更
        let pxScale;
        if (age < EXPAND_TIME) {
          const scale = age / EXPAND_TIME;
          pxScale = (START_SIZE + (MAX_SIZE - START_SIZE) * scale) / smoke.width;
        } else {
          pxScale = MAX_SIZE / smoke.width;
        }
        smoke.setScale(pxScale);

        // 透明度変更（フェードアウト）
        const alpha = Math.max(0, MAX_ALPHA * (1 - age / LIFE_TIME));
        smoke.setAlpha(alpha);

        // 寿命を超えたら削除
        if (age > LIFE_TIME) {
          smoke.destroy();
          this.sprites.splice(i, 1);
        }
      }
    }
  };
}