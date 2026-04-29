/**
 * svgUtils.js のユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { parsePath, parseLineElement, parseSpawnPoint, isValidVertices } from '../svgUtils.js';

/**
 * テスト用 SVG Document を生成するヘルパー
 */
function createMockSVG(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'image/svg+xml');
}

describe('parsePath', () => {
  it('should return null when path element not found', () => {
    const svg = createMockSVG('<svg></svg>');
    const result = parsePath(svg, 'nonexistent', 1, 1);
    expect(result).toBeNull();
  });

  it('should return null when path has no d attribute', () => {
    const svg = createMockSVG('<svg><path id="test"/></svg>');
    const result = parsePath(svg, 'test', 1, 1);
    expect(result).toBeNull();
  });

  it('should parse M and L commands', () => {
    const svg = createMockSVG(
      '<svg><path id="test" d="M 0 0 L 100 0 L 100 100 L 0 100 Z"/></svg>'
    );
    const result = parsePath(svg, 'test', 1, 1);

    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 100, y: 0 });
  });

  it('should apply scale and offset', () => {
    const svg = createMockSVG(
      '<svg><path id="test" d="M 10 20 L 30 40"/></svg>'
    );
    const result = parsePath(svg, 'test', 2, 2, 100, 200);

    expect(result).not.toBeNull();
    expect(result[0]).toEqual({ x: 10 + 100, y: 20 + 200 }); // (120, 240) ... wait: 10*2+100=120, 20*2+200=240
    expect(result[0].x).toBe(120);
    expect(result[0].y).toBe(240);
    expect(result[1].x).toBe(160);
    expect(result[1].y).toBe(280);
  });

  it('should parse C (cubic bezier) command end point', () => {
    const svg = createMockSVG(
      '<svg><path id="test" d="M 0 0 C 50 0, 50 100, 100 100"/></svg>'
    );
    const result = parsePath(svg, 'test', 1, 1);

    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 100, y: 100 });
  });

  it('should return null when fewer than 2 points', () => {
    const svg = createMockSVG(
      '<svg><path id="test" d="M 0 0"/></svg>'
    );
    const result = parsePath(svg, 'test', 1, 1);
    expect(result).toBeNull();
  });
});

describe('parseLineElement', () => {
  it('should return null when element not found', () => {
    const svg = createMockSVG('<svg></svg>');
    const result = parseLineElement(svg, 'nonexistent', 1, 1);
    expect(result).toBeNull();
  });

  it('should parse line element', () => {
    const svg = createMockSVG(
      '<svg><line id="test" x1="0" y1="0" x2="100" y2="100"/></svg>'
    );
    const result = parseLineElement(svg, 'test', 1, 1);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 100, y: 100 });
  });

  it('should apply scale and offset to line', () => {
    const svg = createMockSVG(
      '<svg><line id="test" x1="10" y1="20" x2="30" y2="40"/></svg>'
    );
    const result = parseLineElement(svg, 'test', 2, 2, 0, 0);

    expect(result[0]).toEqual({ x: 20, y: 40 });
    expect(result[1]).toEqual({ x: 60, y: 80 });
  });

  it('should handle path element', () => {
    const svg = createMockSVG(
      '<svg><path id="test" d="M 0 0 L 50 50"/></svg>'
    );
    const result = parseLineElement(svg, 'test', 1, 1);

    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should return null for unsupported element type', () => {
    const svg = createMockSVG(
      '<svg><circle id="test" cx="50" cy="50" r="25"/></svg>'
    );
    const result = parseLineElement(svg, 'test', 1, 1);
    expect(result).toBeNull();
  });
});

describe('parseSpawnPoint', () => {
  it('should return null when spawn element not found', () => {
    const svg = createMockSVG('<svg></svg>');
    const result = parseSpawnPoint(svg, 1, 1);
    expect(result).toBeNull();
  });

  it('should parse circle spawn point', () => {
    const svg = createMockSVG(
      '<svg><circle id="spawn" cx="100" cy="200" r="10"/></svg>'
    );
    const result = parseSpawnPoint(svg, 1, 1);

    expect(result).not.toBeNull();
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('should parse rect spawn point (center)', () => {
    const svg = createMockSVG(
      '<svg><rect id="spawn" x="50" y="60" width="100" height="80"/></svg>'
    );
    const result = parseSpawnPoint(svg, 1, 1);

    expect(result).not.toBeNull();
    expect(result.x).toBe(100); // 50 + 100/2
    expect(result.y).toBe(100); // 60 + 80/2
  });

  it('should apply scale and offset', () => {
    const svg = createMockSVG(
      '<svg><circle id="spawn" cx="50" cy="50" r="10"/></svg>'
    );
    const result = parseSpawnPoint(svg, 2, 2, 100, 100);

    expect(result.x).toBe(200); // 50*2 + 100
    expect(result.y).toBe(200); // 50*2 + 100
  });
});

describe('isValidVertices', () => {
  it('should return false for null', () => {
    expect(isValidVertices(null)).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(isValidVertices([])).toBe(false);
  });

  it('should return false for fewer than 3 points', () => {
    expect(isValidVertices([{ x: 0, y: 0 }])).toBe(false);
    expect(isValidVertices([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it('should return true for 3 or more points', () => {
    expect(isValidVertices([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toBe(true);
    expect(isValidVertices(new Array(10).fill({ x: 0, y: 0 }))).toBe(true);
  });
});