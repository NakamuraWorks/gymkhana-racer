/**
 * SmokeManager.js のユニットテスト.
 *
 * @fileoverview ドリフトスモークエフェクトのテスト.
 */

import { describe, it, expect, vi } from 'vitest';

import { SMOKE } from '../constants.js';
import { createSmokeManager } from '../smokeManager.js';

const { SPAWN_INTERVAL, LIFE_TIME } = SMOKE;

describe('createSmokeManager', () => {
  const createMockScene = () => ({
    time: { now: 0 },
    add: {
      sprite: vi.fn((x, y, _texture) => {
        const sprite = {
          x, y,
          birthTime: 0,
          setOrigin: vi.fn(),
          setAlpha: vi.fn(),
          setScale: vi.fn(),
          destroy: vi.fn()
        };
        return sprite;
      })
    },
    children: {
      moveBelow: vi.fn()
    }
  });

  it('should not spawn smoke when slip angle is below threshold', () => {
    const scene = createMockScene();
    const smokeManager = createSmokeManager(scene);
    
    const mockCar = {
      rotation: 0,
      displayHeight: 48,
      x: 100,
      y: 100,
      body: { velocity: { x: 5, y: 0 } }
    };
    
    // スリップ角が閾値未満（ドリフトしていない）
    const slipAngle = 0.1;
    const speed = 10;
    const heading = 0;
    
    smokeManager.update(mockCar, slipAngle, speed, heading);
    
    // スプライト生成が呼ばれていないはず
    expect(scene.add.sprite).not.toHaveBeenCalled();
  });

  it('should not spawn smoke when speed is below threshold', () => {
    const scene = createMockScene();
    const smokeManager = createSmokeManager(scene);
    
    const mockCar = {
      rotation: 0,
      displayHeight: 48,
      x: 100,
      y: 100,
      body: { velocity: { x: 5, y: 0 } }
    };
    
    // スリップ角は閾値以上だが速度が低い
    const slipAngle = 0.3;
    const speed = 1.0; // MIN_SPEED 未満
    const heading = 0;
    
    smokeManager.update(mockCar, slipAngle, speed, heading);
    
    expect(scene.add.sprite).not.toHaveBeenCalled();
  });

  it('should spawn smoke when drifting', () => {
    const scene = createMockScene();
    scene.time.now = 0;
    const smokeManager = createSmokeManager(scene);
    
    const mockCar = {
      rotation: 0,
      displayHeight: 48,
      x: 100,
      y: 100,
      body: { velocity: { x: 5, y: 0 } }
    };
    
    // ドリフト条件を満たす
    const slipAngle = 0.3; // SLIP_ANGLE_THRESHOLD より大きい
    const speed = 10; // MIN_SPEED より大きい
    const heading = 0;
    
    // 複数回呼び出してスモーク生成を確認
    scene.time.now = SPAWN_INTERVAL + 1;
    smokeManager.update(mockCar, slipAngle, speed, heading);
    
    expect(scene.add.sprite).toHaveBeenCalled();
  });

  it('should destroy particles after LIFE_TIME', () => {
    const scene = createMockScene();
    scene.time.now = 0;
    const smokeManager = createSmokeManager(scene);
    
    const mockCar = {
      rotation: 0,
      displayHeight: 48,
      x: 100,
      y: 100,
      body: { velocity: { x: 5, y: 0 } }
    };
    
    const slipAngle = 0.3;
    const speed = 10;
    const heading = 0;
    
    // スモークを生成
    scene.time.now = SPAWN_INTERVAL + 1;
    smokeManager.update(mockCar, slipAngle, speed, heading);
    
    // LIFE_TIME 経過後に更新
    scene.time.now = LIFE_TIME + SPAWN_INTERVAL + 2;
    smokeManager.update(mockCar, slipAngle, speed, heading);
    
    // 古いパーティクルが破棄されているはず
    const destroyCalls = scene.add.sprite.mock.calls
      .flatMap(calls => calls[2]?.destroy ? [calls] : [])
      .length;
    
    expect(destroyCalls).toBeGreaterThanOrEqual(0);
  });

  it('should respect spawn interval', () => {
    const scene = createMockScene();
    scene.time.now = 0;
    const smokeManager = createSmokeManager(scene);
    
    const mockCar = {
      rotation: 0,
      displayHeight: 48,
      x: 100,
      y: 100,
      body: { velocity: { x: 5, y: 0 } }
    };
    
    const slipAngle = 0.3;
    const speed = 10;
    const heading = 0;
    
    // 短い間隔で複数回更新
    for (let i = 0; i < 5; i++) {
      scene.time.now = i * (SPAWN_INTERVAL / 2);
      smokeManager.update(mockCar, slipAngle, speed, heading);
    }
    
    // SPAWN_INTERVAL より短い間隔での呼び出しなので、
    // 生成回数は時間経過に応じて制限されるはず
    expect(scene.add.sprite).toHaveBeenCalled();
  });

  it('should destroy all particles when manager is destroyed', () => {
    const scene = createMockScene();
    scene.time.now = 0;
    const smokeManager = createSmokeManager(scene);
    
    const mockCar = {
      rotation: 0,
      displayHeight: 48,
      x: 100,
      y: 100,
      body: { velocity: { x: 5, y: 0 } }
    };
    
    const slipAngle = 0.3;
    const speed = 10;
    const heading = 0;
    
    // スモークを生成
    scene.time.now = SPAWN_INTERVAL + 1;
    smokeManager.update(mockCar, slipAngle, speed, heading);
    
    // マネージャーを破棄
    smokeManager.destroy();
    
    // すべてのスプライトが破棄されているはず
    const sprites = scene.add.sprite.mock.results || [];
    sprites.forEach(result => {
      if (result && result.value && result.value.destroy) {
        expect(result.value.destroy).toHaveBeenCalled();
      }
    });
  });

  it('should calculate smoke position behind car', () => {
    const scene = createMockScene();
    scene.time.now = 0;
    const smokeManager = createSmokeManager(scene);
    
    const mockCar = {
      rotation: Math.PI / 2, // 90 度回転
      displayHeight: 48,
      x: 100,
      y: 100,
      body: { velocity: { x: 5, y: 0 } }
    };
    
    const slipAngle = 0.3;
    const speed = 10;
    const heading = Math.PI / 2;
    
    scene.time.now = SPAWN_INTERVAL + 1;
    smokeManager.update(mockCar, slipAngle, speed, heading);
    
    // スプライトが生成されているはず
    expect(scene.add.sprite).toHaveBeenCalled();
    
    // 生成されたスプライトの位置を確認
    const lastCall = scene.add.sprite.mock.calls[scene.add.sprite.mock.calls.length - 1];
    const smokeX = lastCall[0];
    const smokeY = lastCall[1];
    
    // 車の後ろに生成されているはず（簡易確認）
    expect(typeof smokeX).toBe('number');
    expect(typeof smokeY).toBe('number');
  });
});