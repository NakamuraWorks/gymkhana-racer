// 車両挙動関連ユーティリティ

export function computeSteering({
  steerInput,
  isReversing,
  heading,
  maxSteerAngle = Math.PI / 3
}) {
  // バック時はハンドル逆転
  let steerInputForSteer = isReversing ? -steerInput : steerInput;
  const targetDirection = heading + steerInputForSteer * maxSteerAngle;
  let angleDiff = Math.atan2(Math.sin(targetDirection - heading), Math.cos(targetDirection - heading));
  return { steerInputForSteer, targetDirection, angleDiff };
}

export function computeAngularVelocity({
  currentAngularVelocity,
  angularDamping,
  angleDiff,
  slipAngle,
  vForward,
  tractionParams = { base: 0.00264, slipLoss: 0.7, tractionMin: 0.05, tractionMax: 0.7 }
}) {
  let slipLoss = 1.0 - Math.min(Math.abs(slipAngle) / (Math.PI / 2), 1.0) * tractionParams.slipLoss;
  let traction = Math.max(0, Math.min(1, (Math.abs(vForward) - tractionParams.tractionMin) / tractionParams.tractionMax));
  let steerRate = tractionParams.base * traction * slipLoss;
  return currentAngularVelocity * angularDamping + angleDiff * steerRate;
}

export function applyDriveForce({
  car,
  angle,
  forceMagnitude
}) {
  const forceX = Math.cos(angle) * forceMagnitude;
  const forceY = Math.sin(angle) * forceMagnitude;
  car.applyForce({ x: forceX, y: forceY });
}

export function applyBrakeOrReverse({
  car,
  angle,
  forceMagnitude,
  speed,
  threshold = 1.0
}) {
  if (speed < threshold) {
    // バック
    const backForceX = -Math.cos(angle) * forceMagnitude * 0.3;
    const backForceY = -Math.sin(angle) * forceMagnitude * 0.3;
    car.applyForce({ x: backForceX, y: backForceY });
  } else {
    // ブレーキ
    car.setVelocity(car.body.velocity.x * 0.98, car.body.velocity.y * 0.98);
  }
}

export function applyIdleFriction({ car }) {
  car.setVelocity(car.body.velocity.x * 0.995, car.body.velocity.y * 0.995);
}
