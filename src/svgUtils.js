/**
 * SVGパース関連ユーティリティ
 *
 * コース定義用 SVG からコリジョンポイント、コントロールライン、
 * スポーン位置などを解析する。
 */

/**
 * SVG の `<path>` 要素からポイント配列を解析する。
 *
 * @param {Document} svgDoc - パース済みの SVG Document
 * @param {string} id - 対象 path 要素の id
 * @param {number} scaleX - 横方向スケーリング係数
 * @param {number} scaleY - 縦方向スケーリング係数
 * @param {number} [offsetX=0] - 横方向オフセット
 * @param {number} [offsetY=0] - 縦方向オフセット
 * @returns {Array<{x: number, y: number}>|null} ポイント配列、解析失敗時は null
 */
export function parsePath(svgDoc, id, scaleX, scaleY, offsetX = 0, offsetY = 0) {
  const path = svgDoc.getElementById(id);
  if (!path) return null;

  const d = path.getAttribute('d');
  if (!d) return null;

  const points = [];
  const regex = /([MLHVCSQTAZ])\s*([\d\.\-\s,]*)/gi;
  let match;
  let currentX = 0, currentY = 0;

  while ((match = regex.exec(d)) !== null) {
    const command = match[1].toUpperCase();
    const params = match[2].trim();

    if (command === 'M' || command === 'L') {
      const coords = params.split(/[\s,]+/).filter(s => s.length > 0);
      for (let i = 0; i < coords.length; i += 2) {
        if (i + 1 < coords.length) {
          currentX = parseFloat(coords[i]);
          currentY = parseFloat(coords[i + 1]);
          points.push({
            x: currentX * scaleX + offsetX,
            y: currentY * scaleY + offsetY
          });
        }
      }
    } else if (command === 'C') {
      const coords = params.split(/[\s,]+/).filter(s => s.length > 0);
      if (coords.length >= 6) {
        currentX = parseFloat(coords[4]);
        currentY = parseFloat(coords[5]);
        points.push({
          x: currentX * scaleX + offsetX,
          y: currentY * scaleY + offsetY
        });
      }
    }
  }

  return points.length >= 2 ? points : null;
}

/**
 * SVG の `<line>` または `<path>` 要素から線分の端点ペアを解析する。
 *
 * @param {Document} svgDoc - パース済みの SVG Document
 * @param {string} id - 対象要素の id
 * @param {number} scaleX - 横方向スケーリング係数
 * @param {number} scaleY - 縦方向スケーリング係数
 * @param {number} [offsetX=0] - 横方向オフセット
 * @param {number} [offsetY=0] - 縦方向オフセット
 * @returns {Array<{x: number, y: number}>|null} 端点配列、解析失敗時は null
 */
export function parseLineElement(svgDoc, id, scaleX, scaleY, offsetX = 0, offsetY = 0) {
  const elem = svgDoc.getElementById(id);
  if (!elem) return null;

  if (elem.tagName === 'line') {
    const x1 = parseFloat(elem.getAttribute('x1')) || 0;
    const y1 = parseFloat(elem.getAttribute('y1')) || 0;
    const x2 = parseFloat(elem.getAttribute('x2')) || 0;
    const y2 = parseFloat(elem.getAttribute('y2')) || 0;

    return [
      { x: x1 * scaleX + offsetX, y: y1 * scaleY + offsetY },
      { x: x2 * scaleX + offsetX, y: y2 * scaleY + offsetY }
    ];
  }

  if (elem.tagName === 'path') {
    return parsePath(svgDoc, id, scaleX, scaleY, offsetX, offsetY);
  }

  return null;
}

/**
 * SVG から車のスポーン位置を解析する。
 *
 * `id="spawn"` を持つ `<circle>`, `<ellipse>`, `<rect>`, `<path>` に対応する。
 *
 * @param {Document} svgDoc - パース済みの SVG Document
 * @param {number} scaleX - 横方向スケーリング係数
 * @param {number} scaleY - 縦方向スケーリング係数
 * @param {number} [offsetX=0] - 横方向オフセット
 * @param {number} [offsetY=0] - 縦方向オフセット
 * @returns {{x: number, y: number}|null} スポーン位置、見つからない場合は null
 */
export function parseSpawnPoint(svgDoc, scaleX, scaleY, offsetX = 0, offsetY = 0) {
  const spawnElem = svgDoc.getElementById('spawn');
  if (!spawnElem) return null;

  let x = 0, y = 0;

  if (spawnElem.tagName === 'circle' || spawnElem.tagName === 'ellipse') {
    x = parseFloat(spawnElem.getAttribute('cx')) || 0;
    y = parseFloat(spawnElem.getAttribute('cy')) || 0;
  } else if (spawnElem.tagName === 'rect') {
    x = (parseFloat(spawnElem.getAttribute('x')) || 0) +
        (parseFloat(spawnElem.getAttribute('width')) || 0) / 2;
    y = (parseFloat(spawnElem.getAttribute('y')) || 0) +
        (parseFloat(spawnElem.getAttribute('height')) || 0) / 2;
  } else if (spawnElem.tagName === 'path') {
    const points = parsePath(svgDoc, 'spawn', 1, 1, 0, 0);
    if (points && points.length > 0) {
      let sumX = 0, sumY = 0;
      points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
      });
      x = sumX / points.length;
      y = sumY / points.length;
    }
  }

  return {
    x: x * scaleX + offsetX,
    y: y * scaleY + offsetY
  };
}

/**
 * ポイント配列がコリジョンウォールとして有効かどうかを判定する。
 * 3点以上必要。
 *
 * @param {Array|null} vertices - ポイント配列
 * @returns {boolean} 有効かどうか
 */
export function isValidVertices(vertices) {
  return vertices && vertices.length >= 3;
}