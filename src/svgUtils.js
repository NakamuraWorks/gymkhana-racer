// SVGパース関連ユーティリティ
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
          const x = currentX * scaleX + offsetX;
          const y = currentY * scaleY + offsetY;
          points.push({ x, y });
        }
      }
    }
  }
  return points.length >= 2 ? points : null;
}

export function parseLineElement(svgDoc, id, scaleX, scaleY, offsetX = 0, offsetY = 0) {
  const elem = svgDoc.getElementById(id);
  if (!elem) return null;
  let points = [];
  if (elem.tagName === 'line') {
    const x1 = parseFloat(elem.getAttribute('x1')) || 0;
    const y1 = parseFloat(elem.getAttribute('y1')) || 0;
    const x2 = parseFloat(elem.getAttribute('x2')) || 0;
    const y2 = parseFloat(elem.getAttribute('y2')) || 0;
    points = [
      { x: x1 * scaleX + offsetX, y: y1 * scaleY + offsetY },
      { x: x2 * scaleX + offsetX, y: y2 * scaleY + offsetY }
    ];
  } else if (elem.tagName === 'path') {
    return parsePath(svgDoc, id, scaleX, scaleY, offsetX, offsetY);
  }
  return points.length >= 2 ? points : null;
}

export function isValidVertices(vertices) {
  return vertices && vertices.length >= 3;
}
