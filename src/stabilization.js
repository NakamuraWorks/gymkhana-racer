/**
 * 直進安定性処理ユーティリティ
 *
 * 入力が中立で直進している際に、車の揺らぎを抑制する補正を適用する。
 */

import {
  STABILIZATION,
  ANGULAR_DAMPING_BASE,
  ANGULAR_DAMPING_SPEED_FACTOR,
  ANGULAR_DAMPING_SPEED_THRESHOLD
} from './constants.js';

const {
  MAX_DIRECTION_DIFF,
  MAX_SLIP_ANGLE,
  MAX_ANGULAR_VELOCITY_STRAIGHT,
  MIN_STRAIGHT_SPEED,
  STEER_INPUT_THRESHOLD,
  ANGULAR_DAMPING_EXTRA,
  FAST_CONVERGE_THRESHOLD,
  MIN_SPEED_FOR_CORRECTION,
  BASE_CONVERGENCE_RATE,
  CONVERGENCE_SPEED_FACTOR,
  CONVERGENCE_SPEED_THRESHOLD
} = STABILIZATION;

/**
 * 直進安定化補正を計算する。
 *
 * @param {Phaser.Physics.Matter.Image} car - 車の Matter body
 * @param {number} steerInput - 現在のステアリング入力値
 * @param {number} speed - 現在の速度
 * @param {Object} [precomputed] - 呼び出し元で既に計算した値（重複計算回避）
 * @param {number} [precomputed.slipAngle] - スリップ角
 * @param {number} [precomputed.vForward] - 前進方向速度成分
 * @returns {{
 *   shouldApply: boolean,
 *   angularDamping: number,
 *   shouldCorrectVelocity: boolean,
 *   correctedVelocity: { x: number, y: number } | null
 * }}
 */
export function computeStraightStabilization(car, steerInput, speed, precomputed = {}) {
  const velocity = car.body.velocity;
  const currentAngularVelocity = car.body.angularVelocity;
  const heading = car.rotation + Math.PI / 2;

  // 車体の前進方向ベクトル
  const forwardX = Math.cos(heading);
  const forwardY = Math.sin(heading);

  // 前進方向・横方向の速度成分
  const vForward = precomputed.vForward !== undefined
    ? precomputed.vForward
    : velocity.x * forwardX + velocity.y * forwardY;

  const slipAngle = precomputed.slipAngle !== undefined
    ? precomputed.slipAngle
    : Math.atan2(
        velocity.x * (-forwardY) + velocity.y * forwardX,
        vForward
      );

  // 進行方向と車体方向の差
  const velocityAngle = Math.atan2(velocity.y, velocity.x);
  const directionDiff = Math.atan2(
    Math.sin(velocityAngle - heading),
    Math.cos(velocityAngle - heading)
  );

  // 直進判定
  const isGoingStraight =
    Math.abs(directionDiff) < MAX_DIRECTION_DIFF &&
    Math.abs(slipAngle) < MAX_SLIP_ANGLE &&
    Math.abs(currentAngularVelocity) < MAX_ANGULAR_VELOCITY_STRAIGHT &&
    Math.abs(steerInput) < STEER_INPUT_THRESHOLD &&
    speed > MIN_STRAIGHT_SPEED;

  // 基本的な角速度減衰
  let angularDamping = ANGULAR_DAMPING_BASE -
    Math.min(speed / ANGULAR_DAMPING_SPEED_THRESHOLD, 1) * ANGULAR_DAMPING_SPEED_FACTOR;

  if (isGoingStraight) {
    angularDamping *= ANGULAR_DAMPING_EXTRA;

    if (speed > MIN_SPEED_FOR_CORRECTION) {
      if (Math.abs(directionDiff) < FAST_CONVERGE_THRESHOLD) {
        // 完全収束：速度ベクトルを車体方向に強制揃える
        return {
          shouldApply: true,
          angularDamping,
          shouldCorrectVelocity: true,
          correctedVelocity: {
            x: forwardX * speed,
            y: forwardY * speed
          }
        };
      } else {
        // 通常収束：目標速度に漸近
        const speedFactor = Math.min(speed / CONVERGENCE_SPEED_THRESHOLD, CONVERGENCE_SPEED_FACTOR);
        const convergenceRate = BASE_CONVERGENCE_RATE * (1 + speedFactor);
        const targetVx = forwardX * vForward;
        const targetVy = forwardY * vForward;

        return {
          shouldApply: true,
          angularDamping,
          shouldCorrectVelocity: true,
          correctedVelocity: {
            x: velocity.x + (targetVx - velocity.x) * convergenceRate,
            y: velocity.y + (targetVy - velocity.y) * convergenceRate
          }
        };
      }
    }
  }

  return {
    shouldApply: false,
    angularDamping,
    shouldCorrectVelocity: false,
    correctedVelocity: null
  };
}

