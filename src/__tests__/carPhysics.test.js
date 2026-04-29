/**
 * carPhysics.js のユニットテスト
 */

import { describe, it, expect } from 'vitest';
import {
  computeSteering,
  computeAngularVelocity,
  applyDriveForce,
  applyBrakeOrReverse,
  applyIdleFriction
} from '../carPhysics.js';
import {
  MAX_STEER_ANGLE,
  TRACTION_PARAMS,
  DRIVE_FORCE_MAGNITUDE,
  BRAKE_SPEED_THRESHOLD,
  REVERSE_FORCE_RATIO,
  BRAKE_DAMPING_FACTOR,
  IDLE_FRICTION_FACTOR
} from '../constants.js';

describe('computeSteering', () => {
  it('should return correct angleDiff for positive steer input', () => {
    const heading = 0;
    const steerInput = 1;
    const isReversing = false;

    const result = computeSteering({ steerInput, isReversing, heading });

    expect(result.steerInputForSteer).toBe(1);
    expect(result.angleDiff).toBeGreaterThan(0);
    expect(Math.abs(result.angleDiff)).toBeLessThanOrEqual(MAX_STEER_ANGLE);
  });

  it('should negate steerInput when reversing', () => {
    const heading = 0;
    const steerInput = 1;
    const isReversing = true;

    const result = computeSteering({ steerInput, isReversing, heading });

    expect(result.steerInputForSteer).toBe(-1);
    expect(result.angleDiff).toBeLessThan(0);
  });

  it('should return zero angleDiff for zero steer input', () => {
    const result = computeSteering({
      steerInput: 0,
      isReversing: false,
      heading: Math.PI / 4
    });

    expect(result.angleDiff).toBe(0);
    expect(result.steerInputForSteer).toBe(0);
  });
});

describe('computeAngularVelocity', () => {
  it('should apply damping to current angular velocity', () => {
    const result = computeAngularVelocity({
      currentAngularVelocity: 0.5,
      angularDamping: 0.9,
      angleDiff: 0,
      slipAngle: 0,
      vForward: 1.0
    });

    // angleDiff=0 なので steerRate 分は 0、damping のみ適用
    expect(result).toBeCloseTo(0.5 * 0.9);
  });

  it('should incorporate angleDiff when non-zero', () => {
    const result = computeAngularVelocity({
      currentAngularVelocity: 0,
      angularDamping: 1.0,
      angleDiff: 0.1,
      slipAngle: 0,
      vForward: 1.0
    });

    // currentAngularVelocity=0, damping=1.0 なので steerRate のみ
    expect(result).toBeGreaterThan(0);
  });

  it('should reduce traction at high slip angles', () => {
    const normal = computeAngularVelocity({
      currentAngularVelocity: 0,
      angularDamping: 1.0,
      angleDiff: 0.1,
      slipAngle: 0.1,
      vForward: 1.0
    });

    const highSlip = computeAngularVelocity({
      currentAngularVelocity: 0,
      angularDamping: 1.0,
      angleDiff: 0.1,
      slipAngle: 1.0,
      vForward: 1.0
    });

    expect(highSlip).toBeLessThan(normal);
  });
});

describe('applyDriveForce', () => {
  it('should apply force in the correct direction', () => {
    const appliedForces = [];
    const mockCar = {
      applyForce: (force) => {
        appliedForces.push(force);
      }
    };

    const angle = 0;
    applyDriveForce({ car: mockCar, angle });

    expect(appliedForces).toHaveLength(1);
    expect(appliedForces[0].x).toBeCloseTo(Math.cos(0) * DRIVE_FORCE_MAGNITUDE);
    expect(appliedForces[0].y).toBeCloseTo(Math.sin(0) * DRIVE_FORCE_MAGNITUDE);
  });
});

describe('applyBrakeOrReverse', () => {
  it('should apply reverse force when speed is below threshold', () => {
    const appliedForces = [];
    const mockCar = {
      applyForce: (force) => {
        appliedForces.push(force);
      }
    };

    applyBrakeOrReverse({ car: mockCar, angle: 0, speed: 0.5 });

    expect(appliedForces).toHaveLength(1);
    expect(appliedForces[0].x).toBeCloseTo(-Math.cos(0) * DRIVE_FORCE_MAGNITUDE * REVERSE_FORCE_RATIO);
  });

  it('should brake when speed is above threshold', () => {
    const velocityResults = [];
    const mockCar = {
      body: { velocity: { x: 5, y: 3 } },
      setVelocity: (vx, vy) => {
        velocityResults.push({ x: vx, y: vy });
      }
    };

    applyBrakeOrReverse({ car: mockCar, angle: 0, speed: 2.0 });

    expect(velocityResults).toHaveLength(1);
    expect(velocityResults[0].x).toBeCloseTo(5 * BRAKE_DAMPING_FACTOR);
    expect(velocityResults[0].y).toBeCloseTo(3 * BRAKE_DAMPING_FACTOR);
  });
});

describe('applyIdleFriction', () => {
  it('should reduce velocity by idle friction factor', () => {
    const velocityResults = [];
    const mockCar = {
      body: { velocity: { x: 4, y: 2 } },
      setVelocity: (vx, vy) => {
        velocityResults.push({ x: vx, y: vy });
      }
    };

    applyIdleFriction({ car: mockCar });

    expect(velocityResults).toHaveLength(1);
    expect(velocityResults[0].x).toBeCloseTo(4 * IDLE_FRICTION_FACTOR);
    expect(velocityResults[0].y).toBeCloseTo(2 * IDLE_FRICTION_FACTOR);
  });
});