/**
 * ラップタイム管理・UI表示関連ユーティリティ
 *
 * コントロールライン通過の判定、ラップタイム計算、
 * ベストタイム管理、ラップ履歴のUI表示などを担当する。
 */

import { LAP_HISTORY_MAX } from './constants.js';

/**
 * ミリ秒を `分:秒.ミリ` 形式の文字列にフォーマットする。
 *
 * @param {number} milliseconds - ミリ秒単位の時間
 * @returns {string} フォーマット済み時間文字列
 */
export function formatTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const ms = Math.floor((milliseconds % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * コントロールライン通過を処理する。
 *
 * @param {string} controlLineId - 通過したコントロールラインの ID
 * @param {Array} controlLines - コントロールライン配列
 * @param {number|null} raceStartTime - レース開始時刻（Phaser.time.now）
 * @param {number} checkpointsPassed - 通過済みチェックポイント数
 * @param {number|null} bestLapTime - ベストラップタイム
 * @param {Array} lapHistory - ラップ履歴配列
 * @param {number} now - 現在時刻（Phaser.time.now）
 * @returns {Object|null} 更新された状態オブジェクト、または null
 */
export function handleControlLineCrossing(
  controlLineId,
  controlLines,
  raceStartTime,
  checkpointsPassed,
  bestLapTime,
  lapHistory,
  now
) {
  // 対応するコントロールラインを見つける
  const line = controlLines.find(l => l.id === controlLineId);
  if (!line) return null;

  if (controlLineId === 'startFinish') {
    if (raceStartTime === null) {
      // レース開始
      const newRaceStartTime = now;
      const newCheckpointsPassed = 0;
      controlLines.forEach(l => l.passed = false);
      line.passed = true;

      return {
        raceStartTime: newRaceStartTime,
        checkpointsPassed: newCheckpointsPassed,
        bestLapTime,
        lapHistory: [...lapHistory]
      };
    } else if (checkpointsPassed === controlLines.filter(l => l.type === 'checkpoint').length) {
      // ラップ完了（全チェックポイント通過済み）
      const currentLapTime = now - raceStartTime;

      // ラップ履歴に追加（最新が先頭、最大 LAP_HISTORY_MAX 件保持）
      const newLapHistory = [currentLapTime, ...lapHistory];
      if (newLapHistory.length > LAP_HISTORY_MAX) {
        newLapHistory.pop();
      }

      const newBestLapTime = (bestLapTime === null || currentLapTime < bestLapTime)
        ? currentLapTime
        : bestLapTime;

      // 新しいラップを開始
      controlLines.forEach(l => l.passed = false);
      line.passed = true;

      return {
        raceStartTime: now,
        checkpointsPassed: 0,
        bestLapTime: newBestLapTime,
        lapHistory: newLapHistory
      };
    }
  } else if (line.type === 'checkpoint' && !line.passed && raceStartTime !== null) {
    // チェックポイント通過
    line.passed = true;

    return {
      raceStartTime,
      checkpointsPassed: checkpointsPassed + 1,
      bestLapTime,
      lapHistory: [...lapHistory]
    };
  }

  return null;
}

/**
 * ラップ履歴表示を更新する関数を生成する。
 *
 * @param {Array<Phaser.GameObjects.Text>} lapHistoryTexts - UI テキストオブジェクト配列
 * @returns {Function} updateLapHistoryDisplay 関数
 */
export function createLapHistoryUpdater(lapHistoryTexts) {
  return function updateLapHistoryDisplay(lapHistory, bestLapTime) {
    for (let i = 0; i < lapHistoryTexts.length; i++) {
      if (i < lapHistory.length) {
        const lapTime = lapHistory[i];
        const isBest = lapTime === bestLapTime;

        // i=0 が最新ラップ、i が大きくなるほど古いラップ
        // 表示上は「Lap 1」= 最も古い完了ラップ から番号を振る
        const lapNumber = i + 1;

        lapHistoryTexts[i].setText(`Lap ${lapNumber}: ${formatTime(lapTime)}`);
        lapHistoryTexts[i].setVisible(true);

        if (isBest) {
          lapHistoryTexts[i].setStyle({
            fontSize: '16px',
            fill: '#00aa00',
            backgroundColor: '#e0ffe0',
            padding: { x: 8, y: 3 }
          });
        } else {
          lapHistoryTexts[i].setStyle({
            fontSize: '16px',
            fill: '#666666',
            backgroundColor: '#f0f0f0',
            padding: { x: 8, y: 3 }
          });
        }
      } else {
        lapHistoryTexts[i].setVisible(false);
      }
    }
  };
}