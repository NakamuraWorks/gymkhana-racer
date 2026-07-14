/**
 * InputManager.js のユニットテスト.
 *
 * @fileoverview 入力管理ユーティリティのテスト.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// テストごとにモジュールを再読み込みして global state をリセット
const loadInputManager = () => {
  vi.resetModules();
  return import('../inputManager.js');
};

describe('InputManager', () => {
  let mockGetGamepads;
  let originalGetGamepads;

  beforeEach(() => {
    originalGetGamepads = navigator.getGamepads;
    mockGetGamepads = vi.fn();
    
    Object.defineProperty(global.navigator, 'getGamepads', {
      value: mockGetGamepads,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    if (originalGetGamepads) {
      Object.defineProperty(global.navigator, 'getGamepads', {
        value: originalGetGamepads,
        writable: true,
        configurable: true
      });
    } else {
      delete global.navigator.getGamepads;
    }
    
    vi.clearAllMocks();
  });

  describe('connectGamepad', () => {
    it('should return false when Gamepad API is not supported', async () => {
      Object.defineProperty(global.navigator, 'getGamepads', {
        value: undefined,
        writable: true,
        configurable: true
      });

      const { connectGamepad } = await loadInputManager();
      const result = connectGamepad();
      
      expect(result).toBe(false);
    });

    it('should return false when no gamepad is connected', async () => {
      mockGetGamepads.mockReturnValue([null, null]);
      
      const { connectGamepad } = await loadInputManager();
      const result = connectGamepad();
      
      expect(result).toBe(false);
    });

    it('should connect to first available gamepad', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array(16).fill({ pressed: false })
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { connectGamepad } = await loadInputManager();
      const result = connectGamepad();
      
      expect(result).toBe(true);
      expect(mockGetGamepads).toHaveBeenCalled();
    });

    it('should find gamepad at any index', async () => {
      const mockGamepad = {
        id: 'Second Gamepad',
        connected: true,
        axes: [0, 0],
        buttons: []
      };
      
      mockGetGamepads.mockReturnValue([null, mockGamepad]);
      
      const { connectGamepad } = await loadInputManager();
      const result = connectGamepad();
      
      expect(result).toBe(true);
    });
  });

  describe('updateGamepad', () => {
    it('should update native gamepad reference', async () => {
      const mockGamepad = {
        id: 'Updated Gamepad',
        connected: true,
        axes: [0.5, -0.3],
        buttons: [{ pressed: true }]
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { updateGamepad } = await loadInputManager();
      updateGamepad();
      
      expect(mockGetGamepads).toHaveBeenCalled();
    });

    it('should do nothing when Gamepad API is not supported', async () => {
      Object.defineProperty(global.navigator, 'getGamepads', {
        value: undefined,
        writable: true,
        configurable: true
      });
      
      const { updateGamepad } = await loadInputManager();
      expect(() => updateGamepad()).not.toThrow();
    });
  });

  describe('getSteeringInput', () => {
    it('should return 0 when no input', async () => {
      mockGetGamepads.mockReturnValue([null]);
      
      const { getSteeringInput } = await loadInputManager();
      const cursors = {
        left: { isDown: false },
        right: { isDown: false }
      };
      
      const result = getSteeringInput(cursors);
      
      expect(result).toBe(0);
    });

    it('should return -1 when left key is pressed', async () => {
      mockGetGamepads.mockReturnValue([null]);
      
      const { getSteeringInput } = await loadInputManager();
      const cursors = {
        left: { isDown: true },
        right: { isDown: false }
      };
      
      const result = getSteeringInput(cursors);
      
      expect(result).toBe(-1);
    });

    it('should return 1 when right key is pressed', async () => {
      mockGetGamepads.mockReturnValue([null]);
      
      const { getSteeringInput } = await loadInputManager();
      const cursors = {
        left: { isDown: false },
        right: { isDown: true }
      };
      
      const result = getSteeringInput(cursors);
      
      expect(result).toBe(1);
    });

    it('should combine keyboard and gamepad input', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [0.5, 0],
        buttons: []
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getSteeringInput, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const cursors = {
        left: { isDown: false },
        right: { isDown: true }
      };
      
      const result = getSteeringInput(cursors);
      
      expect(result).toBe(1);
    });

    it('should clip gamepad input within -1 to 1 range', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [0.8, 0],
        buttons: []
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getSteeringInput, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const cursors = {
        left: { isDown: true },
        right: { isDown: false }
      };
      
      const result = getSteeringInput(cursors);
      
      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should ignore small gamepad axis values', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [0.05, 0],
        buttons: []
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getSteeringInput, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const cursors = {
        left: { isDown: false },
        right: { isDown: false }
      };
      
      const result = getSteeringInput(cursors);
      
      expect(result).toBe(0);
    });
  });

  describe('getGamepadButtons', () => {
    it('should return false for both when no input', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: Array(16).fill({ pressed: false })
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: false };
      const keyZ = { isDown: false };
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.accel).toBe(false);
      expect(result.brake).toBe(false);
    });

    it('should detect keyboard accel (X key)', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: []
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: true };
      const keyZ = { isDown: false };
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.accel).toBe(true);
      expect(result.brake).toBe(false);
    });

    it('should detect keyboard brake (Z key)', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: []
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: false };
      const keyZ = { isDown: true };
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.accel).toBe(false);
      expect(result.brake).toBe(true);
    });

    it('should detect gamepad button 0 (A button) as accel', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: [
          { pressed: true },
          ...Array(15).fill({ pressed: false })
        ]
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: false };
      const keyZ = { isDown: false };
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.accel).toBe(true);
    });

    it('should detect gamepad button 2 (X button) as brake', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: [
          { pressed: false },
          { pressed: false },
          { pressed: true },
          ...Array(13).fill({ pressed: false })
        ]
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: false };
      const keyZ = { isDown: false };
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.brake).toBe(true);
    });

    it('should detect gamepad button 6 (left trigger) as accel', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: [
          ...Array(6).fill({ pressed: false }),
          { pressed: true },
          ...Array(10).fill({ pressed: false })
        ]
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: false };
      const keyZ = { isDown: false };
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.accel).toBe(true);
    });

    it('should detect gamepad button 7 (right trigger) as brake', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: [
          ...Array(7).fill({ pressed: false }),
          { pressed: true },
          ...Array(9).fill({ pressed: false })
        ]
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: false };
      const keyZ = { isDown: false };
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.brake).toBe(true);
    });

    it('should combine keyboard and gamepad inputs', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: [
          { pressed: false },
          ...Array(15).fill({ pressed: false })
        ]
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: true };
      const keyZ = { isDown: false };
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.accel).toBe(true);
    });

    it('should handle gamepad with insufficient buttons', async () => {
      const mockGamepad = {
        id: 'Minimal Gamepad',
        connected: true,
        axes: [],
        buttons: [
          { pressed: true },
          { pressed: true }
        ]
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { getGamepadButtons, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const keyX = { isDown: false };
      const keyZ = { isDown: false };
      
      expect(() => getGamepadButtons(keyX, keyZ)).not.toThrow();
      
      const result = getGamepadButtons(keyX, keyZ);
      
      expect(result.accel).toBe(true);
    });
  });

  describe('isGamepadConnected', () => {
    it('should return false when no gamepad connected', async () => {
      mockGetGamepads.mockReturnValue([null]);
      
      const { isGamepadConnected } = await loadInputManager();
      const result = isGamepadConnected();
      
      expect(result).toBe(false);
    });

    it('should return true after successful connection', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [],
        buttons: []
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { isGamepadConnected, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const result = isGamepadConnected();
      
      expect(result).toBe(true);
    });
  });

  describe('logGamepadState', () => {
    it('should log message when no gamepad connected', async () => {
      mockGetGamepads.mockReturnValue([null]);
      
      const { logGamepadState } = await loadInputManager();
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logGamepadState();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[InputManager] No gamepad connected'
      );
      
      consoleSpy.mockRestore();
    });

    it('should log gamepad state when connected', async () => {
      const mockGamepad = {
        id: 'Test Gamepad',
        connected: true,
        axes: [0.5, -0.3, 0.1, 0.2],
        buttons: [
          { pressed: true },
          { pressed: false },
          { pressed: true }
        ]
      };
      
      mockGetGamepads.mockReturnValue([mockGamepad]);
      
      const { logGamepadState, connectGamepad } = await loadInputManager();
      connectGamepad();
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logGamepadState();
      
      expect(consoleSpy).toHaveBeenCalled();
      const loggedArgs = consoleSpy.mock.calls[0];
      expect(loggedArgs[0]).toContain('[InputManager] Gamepad state:');
      
      consoleSpy.mockRestore();
    });
  });
});