/**
 * スモーク効果管理ユーティリティ
 *
 * ドリフト時に車の後方からスモークパーティクルを発生・更新する。
 * WebGL ParticleEmitter を使用することで draw call を削減し、GPU 加速を有効化する。
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
 * Phaser ParticleEmitter を使用し、GPU バッチレンダリングに対応。
 *
 * @param {Phaser.Scene} scene - Phaser シーン
 * @returns {Object} smokeManager インスタンス
 */
export function createSmokeManager(scene) {
  /** @type {Phaser.GameObjects.Particles.ParticleEmitter | null} */
  let emitter = null;

  try {
    const particleSystem = scene.add.particles('smoke');
    emitter = particleSystem.createEmitter({
      scale: {
        from: START_SIZE / 64,
        to: MAX_SIZE / 64
      },
      alpha: {
        from: MAX_ALPHA,
        to: 0
      },
      lifespan: 3000, // 3秒で自動消滅
      frequency: SPAWN_INTERVAL,
      quantity: 1,
      maxParticles: 20,
      emitting: false
    });
  } catch {
    emitter = null;
  }

  // フォールバック用スプライト配列（WebGL 利用不可時）
  const fallbackSprites = [];
  let lastTime = 0;

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

      if (emitter) {
        // WebGL ParticleEmitter パス
        const carLength = car.displayHeight || 48;
        const backOffset = -carLength * 0.2;
        const smokeX = car.x + Math.cos(heading) * backOffset;
        const smokeY = car.y + Math.sin(heading) * backOffset;

        emitter.emitX = smokeX;
        emitter.emitY = smokeY;

        if (isSliding) {
          // ドリフト中のみ発生（lifespan: 3000ms で自動消滅）
          emitter.start();
        } else {
          // 非ドリフト時は発生停止（既存パーティクルは3秒で自動消滅）
          emitter.stop();
        }
      } else if (isSliding) {
        // フォールバック: 個別スプライト
        const now = scene.time.now;

        if (now - lastTime > SPAWN_INTERVAL) {
          if (fallbackSprites.length >= 5) {
            const oldest = fallbackSprites.shift();
            if (oldest) oldest.destroy();
          }

          const carLength = car.displayHeight || 48;
          const backOffset = -carLength * 0.2;
          const smokeX = car.x + Math.cos(heading) * backOffset;
          const smokeY = car.y + Math.sin(heading) * backOffset;

          const smoke = scene.add.sprite(smokeX, smokeY, 'smoke');
          smoke.setOrigin(0.5, 0.5);
          smoke.setAlpha(MAX_ALPHA);
          const initialScale = START_SIZE / smoke.width;
          smoke.setScale(initialScale);
          smoke.birthTime = now;
          fallbackSprites.push(smoke);
          lastTime = now;
          scene.children.moveBelow(smoke, car);
        }

        for (let i = fallbackSprites.length - 1; i >= 0; i--) {
          const smoke = fallbackSprites[i];
          const age = now - smoke.birthTime;

          let pxScale;
          if (age < EXPAND_TIME) {
            const scale = age / EXPAND_TIME;
            pxScale = (START_SIZE + (MAX_SIZE - START_SIZE) * scale) / smoke.width;
          } else {
            pxScale = MAX_SIZE / smoke.width;
          }
          smoke.setScale(pxScale);

          const alpha = Math.max(0, MAX_ALPHA * (1 - age / LIFE_TIME));
          smoke.setAlpha(alpha);

          if (age > LIFE_TIME) {
            smoke.destroy();
            fallbackSprites.splice(i, 1);
          }
        }
      }
    },

    /**
     * スモークマネージャーを破棄する。
     */
    destroy() {
      if (emitter) {
        emitter.stop();
        emitter.destroy();
        emitter = null;
      }
      for (const sprite of fallbackSprites) {
        sprite.destroy();
      }
      fallbackSprites.length = 0;
    }
  };
}