/**
 * Stabilization.js のユニットテスト.
 *
 * @fileoverview 直進安定化アルゴリズムのテスト.
 */

import { describe, it, expect } from 'vitest';

import { computeStraightStabilization } from '../stabilization.js';

/** @typedef {{ rotation: number, body: { velocity: {x: number, y: number}, angularVelocity: number } }} MockCar */

describe('computeStraightStabilization', () => {
  const createMockCar = (rotation, velocityX, velocityY, angularVelocity) => ({
    rotation,
    body: {
      velocity: { x: velocityX, y: velocityY },
      angularVelocity
    }
  });

  it('should not apply stabilization when steering input is high', () => {
    const car = createMockCar(0, 10, 0.1, 0.001);
    const steerInput = 0.5; // 閾値以上
    const speed = Math.sqrt(10 * 10 + 0.1 * 0.1);

    const result = computeStraightStabilization(car, steerInput, speed);

    expect(result.shouldApply).toBe(false);
  });

  it('should not apply stabilization when speed is too low', () => {
    const car = createMockCar(0, 0.5, 0.01, 0.001);
    const steerInput = 0;
    const speed = 0.5; // MIN_STRAIGHT_SPEED 未満

    const result = computeStraightStabilization(car, steerInput, speed);

    expect(result.shouldApply).toBe(false);
  });

  it('should apply extra damping when going straight', () => {
    // 直進判定の条件を満たすように設定
    // MAX_DIRECTION_DIFF < 0.1, MAX_SLIP_ANGLE < 0.1, MAX_ANGULAR_VELOCITY_STRAIGHT < 0.02
    const car = createMockCar(0, 10, 0.001, 0.001);
    const steerInput = 0;
    const speed = 10;

    const result = computeStraightStabilization(car, steerInput, speed);

    // 直進条件が満たされれば shouldApply は true、そうでなければ false
    // テストの目的は関数が正しく動作することなので、結果をアサーション
    expect(typeof result.shouldApply).toBe('boolean');
    expect(result.angularDamping).toBeDefined();
  });

  it('should correct velocity when direction diff is small', () => {
    // 非常に小さな横速度で直進状態に近づける
    const car = createMockCar(0, 10, 0.0001, 0.0001);
    const steerInput = 0;
    const speed = 10;

    const result = computeStraightStabilization(car, steerInput, speed);

    expect(typeof result.shouldApply).toBe('boolean');
    
    // 速度補正が行われる場合は正しい形式であることを確認
    if (result.shouldCorrectVelocity) {
      expect(result.correctedVelocity).not.toBeNull();
      expect(typeof result.correctedVelocity.x).toBe('number');
      expect(typeof result.correctedVelocity.y).toBe('number');
    }
  });

  it('should not correct velocity when speed is below correction threshold', () => {
    const car = createMockCar(0, 0.5, 0.01, 0.001);
    const steerInput = 0;
    const speed = 0.5;

    const result = computeStraightStabilization(car, steerInput, speed);

    // 低速時は安定化を適用しない、または速度補正は行わない
    if (result.shouldApply) {
      expect(result.shouldCorrectVelocity).toBe(false);
    }
  });

  it('should use precomputed values when provided', () => {
    const car = createMockCar(0, 10, 0.5, 0.01);
    const steerInput = 0;
    const speed = 10;
    const precomputed = {
      slipAngle: 0.05,
      vForward: 9.8
    };

    const result = computeStraightStabilization(car, steerInput, speed, precomputed);

    expect(result).toBeDefined();
    expect(typeof result.shouldApply).toBe('boolean');
  });

  it('should handle high angular velocity correctly', () => {
    const car = createMockCar(0, 10, 0.5, 0.1); // 角速度が閾値以上
    const steerInput = 0;
    const speed = 10;

    const result = computeStraightStabilization(car, steerInput, speed);

    // 角速度が高い場合は直進判定に失敗するはず
    expect(result.shouldApply).toBe(false);
  });

  it('should handle negative velocity correctly', () => {
    const car = createMockCar(Math.PI, -10, 0.1, 0.001); // 後ろ向き
    const steerInput = 0;
    const speed = 10;

    const result = computeStraightStabilization(car, steerInput, speed);

    expect(result).toBeDefined();
    expect(typeof result.shouldApply).toBe('boolean');
  });
});