/**
 * 車両挙動関連ユーティリティ
 *
 * 車のステアリング、角速度、駆動・制動、慣性摩擦などを計算する純粋関数群。
 */

import {
  MAX_STEER_ANGLE,
  TRACTION_PARAMS,
  DRIVE_FORCE_MAGNITUDE,
  BRAKE_SPEED_THRESHOLD,
  REVERSE_FORCE_RATIO,
  BRAKE_DAMPING_FACTOR,
  IDLE_FRICTION_FACTOR,
  ANGULAR_DAMPING_BASE,
  ANGULAR_DAMPING_SPEED_FACTOR,
  ANGULAR_DAMPING_SPEED_THRESHOLD
} from './constants.js';

/**
 * ステアリング角を計算する。
 *
 * @param {Object} opts
 * @param {number} opts.steerInput - 入力デバイスのステアリング値 (-1 〜 1)
 * @param {boolean} opts.isReversing - 後進中かどうか
 * @param {number} opts.heading - 車の進行方向（ラジアン）
 * @param {number} [opts.maxSteerAngle=MAX_STEER_ANGLE] - 最大ステアリング角
 * @returns {Object} { steerInputForSteer, targetDirection, angleDiff }
 */
export function computeSteering({
  steerInput,
  isReversing,
  heading,
  maxSteerAngle = MAX_STEER_ANGLE
}) {
  // バック時はハンドル逆転
  const steerInputForSteer = isReversing ? -steerInput : steerInput;
  const targetDirection = heading + steerInputForSteer * maxSteerAngle;
  const angleDiff = Math.atan2(
    Math.sin(targetDirection - heading),
    Math.cos(targetDirection - heading)
  );
  return { steerInputForSteer, targetDirection, angleDiff };
}

/**
 * 角速度を計算する。
 *
 * @param {Object} opts
 * @param {number} opts.currentAngularVelocity - 現在の角速度
 * @param {number} opts.angularDamping - 角速度減衰係数
 * @param {number} opts.angleDiff - 目標方向との角度差
 * @param {number} opts.slipAngle - スリップ角
 * @param {number} opts.vForward - 前進方向速度成分
 * @param {Object} [opts.tractionParams=TRACTION_PARAMS] - トラクション係数
 * @returns {number} 新しい角速度
 */
export function computeAngularVelocity({
  currentAngularVelocity,
  angularDamping,
  angleDiff,
  slipAngle,
  vForward,
  tractionParams = TRACTION_PARAMS
}) {
  const slipLoss = 1.0 - Math.min(Math.abs(slipAngle) / (Math.PI / 2), 1.0) * tractionParams.slipLoss;
  const traction = Math.max(
    0,
    Math.min(1, (Math.abs(vForward) - tractionParams.tractionMin) / tractionParams.tractionMax)
  );
  const steerRate = tractionParams.base * traction * slipLoss;
  return currentAngularVelocity * angularDamping + angleDiff * steerRate;
}

/**
 * 駆動力を車に適用する。
 *
 * @param {Object} opts
 * @param {Phaser.Physics.Matter.Image} opts.car - 車の Matter body
 * @param {number} opts.angle - 進行方向（ラジアン）
 * @param {number} [opts.forceMagnitude=DRIVE_FORCE_MAGNITUDE] - 力の大きさ
 */
export function applyDriveForce({
  car,
  angle,
  forceMagnitude = DRIVE_FORCE_MAGNITUDE
}) {
  const forceX = Math.cos(angle) * forceMagnitude;
  const forceY = Math.sin(angle) * forceMagnitude;
  car.applyForce({ x: forceX, y: forceY });
}

/**
 * ブレーキまたは後進の力を車に適用する。
 *
 * @param {Object} opts
 * @param {Phaser.Physics.Matter.Image} opts.car - 車の Matter body
 * @param {number} opts.angle - 進行方向（ラジアン）
 * @param {number} opts.speed - 現在の速度
 * @param {number} [opts.forceMagnitude=DRIVE_FORCE_MAGNITUDE] - 力の大きさ
 * @param {number} [opts.threshold=BRAKE_SPEED_THRESHOLD] - ブレーキ/後進の切替閾値
 */
export function applyBrakeOrReverse({
  car,
  angle,
  forceMagnitude = DRIVE_FORCE_MAGNITUDE,
  speed,
  threshold = BRAKE_SPEED_THRESHOLD
}) {
  if (speed < threshold) {
    // 後進
    const backForceX = -Math.cos(angle) * forceMagnitude * REVERSE_FORCE_RATIO;
    const backForceY = -Math.sin(angle) * forceMagnitude * REVERSE_FORCE_RATIO;
    car.applyForce({ x: backForceX, y: backForceY });
  } else {
    // ブレーキ
    car.setVelocity(car.body.velocity.x * BRAKE_DAMPING_FACTOR, car.body.velocity.y * BRAKE_DAMPING_FACTOR);
  }
}

/**
 * _idle（アクセル・ブレーキなし）時の慣性摩擦を適用する。
 *
 * @param {Object} opts
 * @param {Phaser.Physics.Matter.Image} opts.car - 車の Matter body
 */
export function applyIdleFriction({ car }) {
  car.setVelocity(car.body.velocity.x * IDLE_FRICTION_FACTOR, car.body.velocity.y * IDLE_FRICTION_FACTOR);
}