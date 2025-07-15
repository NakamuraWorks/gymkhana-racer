// 直進安定性処理ユーティリティ

export function computeStraightStabilization(car, steerInput, speed) {
  const velocity = car.body.velocity;
  const currentAngularVelocity = car.body.angularVelocity;
  const heading = car.rotation + Math.PI / 2;
  
  // 車体の向きと進行方向の計算
  const forward = { x: Math.cos(heading), y: Math.sin(heading) };
  const vForward = velocity.x * forward.x + velocity.y * forward.y;
  const side = { x: -Math.sin(heading), y: Math.cos(heading) };
  const vSide = velocity.x * side.x + velocity.y * side.y;
  const slipAngle = Math.atan2(vSide, vForward);
  
  // 進行方向と車体方向の差を計算
  const velocityAngle = Math.atan2(velocity.y, velocity.x);
  const directionDiff = Math.atan2(Math.sin(velocityAngle - heading), Math.cos(velocityAngle - heading));
  
  // 直進判定条件パラメータ
  const MAX_DIRECTION_DIFF = 0.1;
  const MAX_SLIP_ANGLE = 0.1;
  const MAX_ANGULAR_VELOCITY_STRAIGHT = 0.02;
  const MIN_STRAIGHT_SPEED = 1.5;
  
  const isGoingStraight =
    Math.abs(directionDiff) < MAX_DIRECTION_DIFF &&
    Math.abs(slipAngle) < MAX_SLIP_ANGLE &&
    Math.abs(currentAngularVelocity) < MAX_ANGULAR_VELOCITY_STRAIGHT &&
    Math.abs(steerInput) < 0.1 &&
    speed > MIN_STRAIGHT_SPEED;

  // 基本的な角速度減衰
  let angularDamping = 0.99906 - Math.min(speed / 18, 1) * 0.01706;
  
  // 直進時の追加安定化
  if (isGoingStraight) {
    angularDamping *= 0.7;
    const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    if (currentSpeed > 0.1) {
      // 完全収束処理
      if (Math.abs(directionDiff) < 0.05) {
        const newVx = Math.cos(heading) * currentSpeed;
        const newVy = Math.sin(heading) * currentSpeed;
        return { 
          shouldApply: true, 
          angularDamping, 
          shouldCorrectVelocity: true,
          correctedVelocity: { x: newVx, y: newVy } 
        };
      } else {
        // 通常の収束処理
        const forward = { x: Math.cos(heading), y: Math.sin(heading) };
        const forwardSpeed = velocity.x * forward.x + velocity.y * forward.y;
        const baseConvergenceRate = 0.03;
        const speedFactor = Math.min(speed / 10, 1.5);
        const convergenceRate = baseConvergenceRate * (1 + speedFactor);
        const targetVelocity = {
          x: forward.x * forwardSpeed,
          y: forward.y * forwardSpeed
        };
        const correctedVelocity = {
          x: velocity.x + (targetVelocity.x - velocity.x) * convergenceRate,
          y: velocity.y + (targetVelocity.y - velocity.y) * convergenceRate
        };
        return { 
          shouldApply: true, 
          angularDamping, 
          shouldCorrectVelocity: true,
          correctedVelocity 
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
