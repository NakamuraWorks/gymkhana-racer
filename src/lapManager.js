// ラップタイム管理・UI表示関連ユーティリティ

// 時間をフォーマットする関数
export function formatTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const ms = Math.floor((milliseconds % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// コントロールライン通過処理
export function handleControlLineCrossing(
  controlLineId,
  controlLines,
  raceStartTime,
  checkpointsPassed,
  bestLapTime,
  lapHistory
) {
  const currentTime = Date.now();
  
  // 対応するコントロールラインを見つける
  const line = controlLines.find(l => l.id === controlLineId);
  if (!line) return null;
  
  if (controlLineId === 'startFinish') {
    if (raceStartTime === null) {
      // レース開始
      raceStartTime = currentTime;
      checkpointsPassed = 0;
      controlLines.forEach(l => l.passed = false);
      line.passed = true;
    } else if (checkpointsPassed === controlLines.filter(l => l.type === 'checkpoint').length) {
      // ラップ完了（全チェックポイント通過済み）
      const currentLapTime = currentTime - raceStartTime;
      
      // ラップ履歴に追加（最新5周分を保持）
      lapHistory.unshift(currentLapTime);
      if (lapHistory.length > 5) {
        lapHistory.pop();
      }
      
      if (bestLapTime === null || currentLapTime < bestLapTime) {
        bestLapTime = currentLapTime;
      }
      
      // 新しいラップを開始
      raceStartTime = currentTime;
      checkpointsPassed = 0;
      controlLines.forEach(l => l.passed = false);
      line.passed = true;
    }
  } else if (line.type === 'checkpoint' && !line.passed && raceStartTime !== null) {
    // チェックポイント通過
    line.passed = true;
    checkpointsPassed++;
  }
  
  return { raceStartTime, checkpointsPassed, lapHistory, bestLapTime };
}

// ラップ履歴表示を更新する関数
export function createLapHistoryUpdater(lapHistoryTexts) {
  return function updateLapHistoryDisplay(lapHistory, bestLapTime) {
    for (let i = 0; i < lapHistoryTexts.length; i++) {
      if (i < lapHistory.length) {
        const lapTime = lapHistory[i];
        const isBest = lapTime === bestLapTime;
        
        lapHistoryTexts[i].setText(`Lap ${lapHistory.length - i}: ${formatTime(lapTime)}`);
        lapHistoryTexts[i].setVisible(true);
        
        // ベストタイムは色を変更
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
