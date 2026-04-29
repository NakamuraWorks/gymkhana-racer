/**
 * 入力処理ユーティリティ
 *
 * キーボードおよびゲームパッドの入力を統合・抽象化する。
 */

/**
 * ステアリング入力を取得する。
 *
 * @param {Phaser.Input.Keyboard.CursorKeys} cursors - キーボード矢印キー
 * @param {Phaser.Input.Gamepad.Gamepad|null} gamepad - ゲームパッド（未接続時は null）
 * @returns {number} ステアリング値（-1 〜 1 の範囲）
 */
export function getSteeringInput(cursors, gamepad) {
  let steerInput = 0;

  if (cursors.left.isDown) steerInput -= 1;
  if (cursors.right.isDown) steerInput += 1;

  if (gamepad && gamepad.axes && gamepad.axes.length > 0) {
    const sx = gamepad.axes[0].getValue();
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
 * @param {Phaser.Input.Gamepad.Gamepad|null} gamepad - ゲームパッド
 * @param {Phaser.Input.Keyboard.Key} keyX - アクセルキー（X）
 * @param {Phaser.Input.Keyboard.Key} keyZ - ブレーキキー（Z）
 * @returns {{ accel: boolean, brake: boolean }}
 */
export function getGamepadButtons(gamepad, keyX, keyZ) {
  const padAccel = safeGetButton(gamepad, 0);
  const padBrake = safeGetButton(gamepad, 2);

  const accel = keyX.isDown || padAccel;
  const brake = keyZ.isDown || padBrake;

  return { accel, brake };
}

/**
 * ゲームパッドのボタン状態を安全に取得する。
 *
 * @param {Phaser.Input.Gamepad.Gamepad|null} gamepad - ゲームパッド
 * @param {number} index - ボタンインデックス
 * @returns {boolean} ボタンが押されているかどうか
 */
function safeGetButton(gamepad, index) {
  if (!gamepad) return false;
  if (!gamepad.buttons) return false;
  if (index < 0 || index >= gamepad.buttons.length) return false;
  return !!gamepad.buttons[index].pressed;
}

/**
 * ゲームパッド入力を初期化する。
 *
 * @param {Phaser.Scene} scene - Phaser シーン
 * @returns {Phaser.Input.Gamepad.Gamepad|null} 接続されたゲームパッド、ない場合は null
 */
export function initializeGamepad(scene) {
  if (!scene.input.gamepad) {
    return null;
  }

  scene.input.gamepad.start();

  // すでに接続されているパッドがある場合は即座に返す
  if (scene.input.gamepad.total > 0) {
    return scene.input.gamepad.getPad(0);
  }

  return null;
}