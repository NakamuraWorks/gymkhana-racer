/**
 * スモーク効果管理ユーティリティ
 *
 * ドリフト時に車の後方からスモークパーティクルを発生・更新する。
 * 手動でパーティクルを管理して時間ベースの消滅を実現。
 *
 * @fileoverview ドリフトスモークエフェクト
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
 * 手動でパーティクルを管理して時間ベースの消滅を実現。
 *
 * @param {Phaser.Scene} scene - Phaser シーン
 * @returns {Object} smokeManager インスタンス
 */
export function createSmokeManager(scene) {
  /** @type {Phaser.GameObjects.Sprite[]} パーティクルスプライト配列 */
  const particles = [];
  let lastSpawnTime = 0;

  return {
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
      const now = scene.time.now;

      // パーティクルの位置計算
      const carLength = car.displayHeight || 48;
      const backOffset = -carLength * 0.2;
      const smokeX = car.x + Math.cos(heading) * backOffset;
      const smokeY = car.y + Math.sin(heading) * backOffset;

      if (isSliding) {
        // ドリフト中のみスモークを発生
        if (now - lastSpawnTime > SPAWN_INTERVAL) {
          if (particles.length >= 20) {
            // 最も古いパーティクルを削除
            const oldest = particles.shift();
            if (oldest) oldest.destroy();
          }

          const smoke = scene.add.sprite(smokeX, smokeY, 'smoke');
          smoke.setOrigin(0.5, 0.5);
          smoke.setAlpha(MAX_ALPHA);
          smoke.setScale(START_SIZE / smoke.width);
          smoke.birthTime = now;
          particles.push(smoke);
          scene.children.moveBelow(smoke, car);
          lastSpawnTime = now;
        }
      }

      // 全パーティクルを更新・削除
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const age = now - p.birthTime;

        // 時間ベースのスケール変化
        let pxScale;
        if (age < EXPAND_TIME) {
          const scale = age / EXPAND_TIME;
          pxScale = (START_SIZE + (MAX_SIZE - START_SIZE) * scale) / p.width;
        } else {
          pxScale = MAX_SIZE / p.width;
        }
        p.setScale(pxScale);

        // 時間ベースのアルファ変化（LIFE_TIME後に完全消滅）
        const alpha = Math.max(0, MAX_ALPHA * (1 - age / LIFE_TIME));
        p.setAlpha(alpha);

        // LIFE_TIME経過したら削除
        if (age > LIFE_TIME) {
          p.destroy();
          particles.splice(i, 1);
        }
      }
    },

    /**
     * スモークマネージャーを破棄する。
     */
    destroy() {
      for (const p of particles) {
        p.destroy();
      }
      particles.length = 0;
    }
  };
}