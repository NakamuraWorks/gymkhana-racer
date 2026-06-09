/**
 * 入力処理ユーティリティ
 *
 * キーボードおよびゲームパッドの入力を統合・抽象化する。
 * ネイティブ Gamepad API を直接使用して Phaser 依存を解消。
 *
 * @fileoverview 入力管理ユーティリティ
 */

// ネイティブ Gamepad リファレンス
let nativeGamepad = null;

/**
 * ゲームパッドを接続する（ネイティブ Gamepad API 使用）。
 * インデックス 0 のゲームパッドを優先して取得。
 *
 * @returns {boolean} 接続成功したかどうか
 */
export function connectGamepad() {
  if (typeof navigator.getGamepads === 'undefined') {
    console.log('[InputManager] Gamepad API not supported');
    return false;
  }

  const gamepads = navigator.getGamepads();
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) {
      nativeGamepad = gamepads[i];
      console.log('[InputManager] Gamepad connected:', nativeGamepad.id);
      return true;
    }
  }

  console.log('[InputManager] No gamepad found');
  return false;
}

/**
 * ゲームパッド状態を更新する（update ループで呼び出し）。
 */
export function updateGamepad() {
  if (typeof navigator.getGamepads === 'undefined') return;

  const gamepads = navigator.getGamepads();
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) {
      nativeGamepad = gamepads[i];
      return;
    }
  }
}

/**
 * ステアリング入力を取得する。
 *
 * @param {Object} cursors - キーボード矢印キー
 * @returns {number} ステアリング値（-1 〜 1 の範囲）
 */
export function getSteeringInput(cursors) {
  let steerInput = 0;

  if (cursors.left.isDown) steerInput -= 1;
  if (cursors.right.isDown) steerInput += 1;

  // ネイティブゲームパッドからステアリング取得
  if (nativeGamepad && nativeGamepad.axes && nativeGamepad.axes.length > 0) {
    const sx = nativeGamepad.axes[0];
    if (Math.abs(sx) > 0.1) {
      steerInput += sx;
    }
  }

  // -1 〜 1 にクリップ
  return Math.max(-1, Math.min(1, steerInput));
}

/**
 * アクセル・ブレーキ入力を取得する。
 *
 * @param {Object} keyX - アクセルキー（X）
 * @param {Object} keyZ - ブレーキキー（Z）
 * @returns {{ accel: boolean, brake: boolean }}
 */
export function getGamepadButtons(keyX, keyZ) {
  // ゲームパッドのボタンインデックス（標準コントローラレイアウト）:
  // 0: Aボタン (通常アクセル)
  // 1: Bボタン
  // 2: Xボタン (通常ブレーキ)
  // 3: Yボタン
  // 6: 左トリガー (代替アクセル)
  // 7: 右トリガー (代替ブレーキ)
  let padAccel = false;
  let padBrake = false;

  if (nativeGamepad) {
    // ボタンインデックス 0 (Aボタン) または 6 (左トリガー)
    if (nativeGamepad.buttons.length > 0) {
      padAccel = !!nativeGamepad.buttons[0].pressed;
    }
    if (nativeGamepad.buttons.length > 6) {
      padAccel = padAccel || !!nativeGamepad.buttons[6].pressed;
    }

    // ボタンインデックス 2 (Xボタン) または 7 (右トリガー)
    if (nativeGamepad.buttons.length > 2) {
      padBrake = !!nativeGamepad.buttons[2].pressed;
    }
    if (nativeGamepad.buttons.length > 7) {
      padBrake = padBrake || !!nativeGamepad.buttons[7].pressed;
    }
  }

  const accel = keyX.isDown || padAccel;
  const brake = keyZ.isDown || padBrake;

  return { accel, brake };
}

/**
 * ゲームパッドが接続されているか確認。
 *
 * @returns {boolean} 接続されているかどうか
 */
export function isGamepadConnected() {
  return nativeGamepad !== null;
}

/**
 * ゲームパッドの状態をログ出力（デバッグ用）。
 */
export function logGamepadState() {
  if (!nativeGamepad) {
    console.log('[InputManager] No gamepad connected');
    return;
  }

  const axes = nativeGamepad.axes ? nativeGamepad.axes.map((a, i) => `a${i}:${a.toFixed(2)}`) : [];
  const buttons = nativeGamepad.buttons ? nativeGamepad.buttons.map((b, i) => `b${i}:${b.pressed ? 1 : 0}`) : [];
  console.log('[InputManager] Gamepad state:', {
    id: nativeGamepad.id,
    connected: nativeGamepad.connected,
    axes: axes.join(', '),
    buttons: buttons.join(', ')
  });
}