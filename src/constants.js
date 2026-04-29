// ============================================================
// ゲーム全体で使用する定数
// ============================================================

// --- ワールド設定 ---
export const WORLD_WIDTH = 3840;
export const WORLD_HEIGHT = 2160;

// --- カンバス設定 ---
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

// --- 車の物理パラメータ ---
export const CAR_DISPLAY_WIDTH = 36;
export const CAR_DISPLAY_HEIGHT = 48;
export const CAR_MASS = 30;
export const CAR_FRICTION_AIR = 0.025;
export const CAR_FRICTION = 0.05;

// --- 駆動・制動 ---
export const DRIVE_FORCE_MAGNITUDE = 0.018;
export const BRAKE_SPEED_THRESHOLD = 1.0;
export const REVERSE_FORCE_RATIO = 0.3;
export const BRAKE_DAMPING_FACTOR = 0.98;
export const IDLE_FRICTION_FACTOR = 0.995;

// --- ステアリング ---
export const MAX_STEER_ANGLE = Math.PI / 3;

// --- 角速度 ---
export const ANGULAR_DAMPING_BASE = 0.99906;
export const ANGULAR_DAMPING_SPEED_FACTOR = 0.01706;
export const ANGULAR_DAMPING_SPEED_THRESHOLD = 18;

// --- トラクション ---
export const TRACTION_PARAMS = {
  base: 0.00264,
  slipLoss: 0.7,
  tractionMin: 0.05,
  tractionMax: 0.7
};

// --- 直進安定化 ---
export const STABILIZATION = {
  MAX_DIRECTION_DIFF: 0.1,
  MAX_SLIP_ANGLE: 0.1,
  MAX_ANGULAR_VELOCITY_STRAIGHT: 0.02,
  MIN_STRAIGHT_SPEED: 1.5,
  STEER_INPUT_THRESHOLD: 0.1,
  ANGULAR_DAMPING_EXTRA: 0.7,
  FAST_CONVERGE_THRESHOLD: 0.05,
  MIN_SPEED_FOR_CORRECTION: 0.1,
  BASE_CONVERGENCE_RATE: 0.03,
  CONVERGENCE_SPEED_FACTOR: 1.5,
  CONVERGENCE_SPEED_THRESHOLD: 10
};

// --- スモークエフェクト ---
export const SMOKE = {
  SLIP_ANGLE_THRESHOLD: 0.25,
  MIN_SPEED: 2.0,
  SPAWN_INTERVAL: 120, // ms
  START_SIZE: 60, // px
  MAX_SIZE: 120, // px
  MAX_ALPHA: 0.7,
  LIFE_TIME: 1500, // ms
  EXPAND_TIME: 500 // ms
};

// --- ラップ管理 ---
export const LAP_HISTORY_MAX = 5;

// --- コントロールライン ---
export const CONTROL_LINE_HEIGHT = 20;