/**
 * lapManager.js のユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { formatTime, handleControlLineCrossing, createLapHistoryUpdater } from '../lapManager.js';
import { LAP_HISTORY_MAX } from '../constants.js';

describe('formatTime', () => {
  it('should format zero milliseconds', () => {
    expect(formatTime(0)).toBe('0:00.00');
  });

  it('should format seconds and milliseconds', () => {
    expect(formatTime(12345)).toBe('0:12.34');
  });

  it('should format minutes, seconds and milliseconds', () => {
    expect(formatTime(125000)).toBe('2:05.00');
  });

  it('should pad seconds and milliseconds with zeros', () => {
    expect(formatTime(60100)).toBe('1:00.10');
  });

  it('should handle large values', () => {
    expect(formatTime(3661234)).toBe('61:01.23');
  });
});

describe('handleControlLineCrossing', () => {
  const makeControlLines = () => [
    { id: 'startFinish', type: 'startFinish', passed: false },
    { id: 'checkpoint1', type: 'checkpoint', passed: false },
    { id: 'checkpoint2', type: 'checkpoint', passed: false },
  ];

  it('should return null for unknown controlLineId', () => {
    const result = handleControlLineCrossing(
      'unknown',
      makeControlLines(),
      null,
      0,
      null,
      [],
      1000
    );
    expect(result).toBeNull();
  });

  it('should start race when crossing startFinish first time', () => {
    const controlLines = makeControlLines();
    const result = handleControlLineCrossing(
      'startFinish',
      controlLines,
      null,
      0,
      null,
      [],
      5000
    );

    expect(result.raceStartTime).toBe(5000);
    expect(result.checkpointsPassed).toBe(0);
    expect(result.bestLapTime).toBeNull();
    expect(result.lapHistory).toEqual([]);
    expect(controlLines[0].passed).toBe(true);
    expect(controlLines[1].passed).toBe(false);
    expect(controlLines[2].passed).toBe(false);
  });

  it('should not complete lap without passing all checkpoints', () => {
    const controlLines = makeControlLines();
    // First start the race
    handleControlLineCrossing('startFinish', controlLines, null, 0, null, [], 1000);

    // Cross startFinish again without checkpoints
    const result = handleControlLineCrossing(
      'startFinish',
      controlLines,
      1000,
      0,
      null,
      [],
      6000
    );

    expect(result).toBeNull();
  });

  it('should complete lap after passing all checkpoints', () => {
    const controlLines = makeControlLines();
    // Start race
    handleControlLineCrossing('startFinish', controlLines, null, 0, null, [], 1000);
    // Pass checkpoint1
    handleControlLineCrossing('checkpoint1', controlLines, 1000, 0, null, [], 2000);
    // Pass checkpoint2
    handleControlLineCrossing('checkpoint2', controlLines, 1000, 1, null, [], 3000);
    // Cross startFinish - lap complete
    const result = handleControlLineCrossing(
      'startFinish',
      controlLines,
      1000,
      2,
      null,
      [],
      6000
    );

    expect(result.raceStartTime).toBe(6000);
    expect(result.checkpointsPassed).toBe(0);
    expect(result.bestLapTime).toBe(5000);
    expect(result.lapHistory).toEqual([5000]);
  });

  it('should update bestLapTime when new lap is faster', () => {
    const controlLines = makeControlLines();
    // Start race
    handleControlLineCrossing('startFinish', controlLines, null, 0, null, [], 0);
    handleControlLineCrossing('checkpoint1', controlLines, 0, 0, null, [], 1000);
    handleControlLineCrossing('checkpoint2', controlLines, 0, 1, null, [], 2000);
    // First lap: 5000ms
    let result = handleControlLineCrossing(
      'startFinish', controlLines, 0, 2, null, [], 5000
    );

    // Reset checkpoints for second lap
    controlLines[1].passed = false;
    controlLines[2].passed = false;

    handleControlLineCrossing('checkpoint1', controlLines, 5000, 0, result.bestLapTime, result.lapHistory, 6000);
    handleControlLineCrossing('checkpoint2', controlLines, 5000, 1, result.bestLapTime, result.lapHistory, 7000);
    // Second lap: 3000ms (faster)
    result = handleControlLineCrossing(
      'startFinish', controlLines, 5000, 2, result.bestLapTime, result.lapHistory, 8000
    );

    expect(result.bestLapTime).toBe(3000);
    expect(result.lapHistory).toHaveLength(2);
  });

  it('should respect LAP_HISTORY_MAX limit', () => {
    const controlLines = makeControlLines();
    let raceStart = 0;
    let checkpoints = 0;
    let best = null;
    let history = [];

    for (let lap = 0; lap < LAP_HISTORY_MAX + 2; lap++) {
      handleControlLineCrossing('startFinish', controlLines, raceStart, checkpoints, best, history, raceStart + 100);
      raceStart = raceStart + 100;
      checkpoints = 0;

      controlLines.forEach(l => l.passed = false);
      controlLines[0].passed = true;

      handleControlLineCrossing('checkpoint1', controlLines, raceStart, 0, best, history, raceStart + 200);
      handleControlLineCrossing('checkpoint2', controlLines, raceStart, 1, best, history, raceStart + 300);

      const result = handleControlLineCrossing(
        'startFinish', controlLines, raceStart, 2, best, history, raceStart + 1000
      );

      raceStart = result.raceStartTime;
      checkpoints = result.checkpointsPassed;
      best = result.bestLapTime;
      history = result.lapHistory;
    }

    expect(history).toHaveLength(LAP_HISTORY_MAX);
  });

  it('should pass checkpoint correctly', () => {
    const controlLines = makeControlLines();
    // Start race first
    handleControlLineCrossing('startFinish', controlLines, null, 0, null, [], 1000);

    const result = handleControlLineCrossing(
      'checkpoint1',
      controlLines,
      1000,
      0,
      null,
      [],
      2000
    );

    expect(result.checkpointsPassed).toBe(1);
    expect(controlLines[1].passed).toBe(true);
  });
});

describe('createLapHistoryUpdater', () => {
  it('should create a function that updates lap history texts', () => {
    const mockTexts = [];
    for (let i = 0; i < 5; i++) {
      mockTexts.push({
        text: '',
        visible: false,
        setText: function(msg) { this.text = msg; },
        setVisible: function(v) { this.visible = v; },
        setStyle: function() { return this; }
      });
    }

    const updater = createLapHistoryUpdater(mockTexts);
    updater([10000, 9000], 9000);

    expect(mockTexts[0].visible).toBe(true);
    expect(mockTexts[1].visible).toBe(true);
    expect(mockTexts[2].visible).toBe(false);
    expect(mockTexts[0].text).toContain('10:00.00');
    expect(mockTexts[1].text).toContain('9:00.00');
  });
});