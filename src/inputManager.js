// 入力処理ユーティリティ

export function getSteeringInput(cursors, gamepad) {
  let steerInput = 0;
  if (cursors.left.isDown) steerInput -= 1;
  if (cursors.right.isDown) steerInput += 1;
  if (gamepad && gamepad.axes && gamepad.axes.length > 0) {
    const sx = gamepad.axes[0].getValue();
    if (Math.abs(sx) > 0.1) steerInput += sx;
  }
  return steerInput;
}

export function getGamepadButtons(gamepad, keyX, keyZ) {
  const padAccel = gamepad && gamepad.buttons && gamepad.buttons.length > 0 ? gamepad.buttons[0].pressed : false;
  const padBrake = gamepad && gamepad.buttons && gamepad.buttons.length > 2 ? gamepad.buttons[2].pressed : false;
  
  // キーボード入力と統合
  const accel = keyX.isDown || padAccel;
  const brake = keyZ.isDown || padBrake;
  
  return { accel, brake };
}

export function initializeGamepad(scene) {
  let gamepad = null;
  if (scene.input.gamepad) {
    scene.input.gamepad.start();
    scene.input.gamepad.once('connected', pad => { gamepad = pad; });
  }
  return gamepad;
}
