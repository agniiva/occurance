import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateAttractorDots(seed, width, height) {
  const rng = seededRandom(seed);

  const a = -2.0 + rng() * 1.5;
  const b = 0.5 + rng() * 1.5;
  const c = -1.5 + rng() * 1.0;
  const d = 0.5 + rng() * 1.5;

  let x = 0.1;
  let y = 0.1;

  const numPoints = 30000;
  const xs = [];
  const ys = [];

  for (let i = 0; i < numPoints; i++) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x);
    const ny = Math.sin(b * x) + d * Math.cos(b * y);
    x = nx;
    y = ny;
    if (i > 200) {
      xs.push(nx);
      ys.push(ny);
    }
  }

  let minX = xs[0], maxX = xs[0], minY = ys[0], maxY = ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] < minX) minX = xs[i];
    if (xs[i] > maxX) maxX = xs[i];
    if (ys[i] < minY) minY = ys[i];
    if (ys[i] > maxY) maxY = ys[i];
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const pad = 50;
  const drawW = width - pad * 2;
  const drawH = height - pad * 2;

  const gridSize = 5;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);
  const grid = new Uint16Array(cols * rows);

  for (let i = 0; i < xs.length; i++) {
    const px = pad + ((xs[i] - minX) / rangeX) * drawW;
    const py = pad + ((ys[i] - minY) / rangeY) * drawH;
    const col = Math.floor(px / gridSize);
    const row = Math.floor(py / gridSize);
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      grid[row * cols + col]++;
    }
  }

  let maxDensity = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > maxDensity) maxDensity = grid[i];
  }
  if (maxDensity === 0) maxDensity = 1;

  const logMax = Math.log(maxDensity + 1);
  const dots = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const density = grid[row * cols + col];
      if (density > 0) {
        const logD = Math.log(density + 1) / logMax;
        dots.push({
          cx: col * gridSize + gridSize / 2,
          cy: row * gridSize + gridSize / 2,
          r: 1 + logD * 2,
          opacity: 0.1 + logD * 0.85,
        });
      }
    }
  }

  return dots;
}

export default function handler(req) {
  const url = new URL(req.url);
  const title = url.searchParams.get('title') || 'Agniva Mahata';
  const width = 1200;
  const height = 630;
  const seed = hashString(title);
  const dots = generateAttractorDots(seed, width, height);

  const svgCircles = dots.map(d =>
    `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="rgba(255,255,255,${d.opacity.toFixed(3)})"/>`
  ).join('');

  const attractorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g>${svgCircles}</g></svg>`;
  const svgDataUrl = `data:image/svg+xml;base64,${btoa(attractorSvg)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          backgroundColor: '#0a0a0a',
          position: 'relative',
        }}
      >
        <img
          src={svgDataUrl}
          width={width}
          height={height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '250px',
            background: 'linear-gradient(to bottom, transparent, rgba(10,10,10,0.85) 50%, rgba(10,10,10,0.98))',
            display: 'flex',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '0 60px 40px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.2,
              marginBottom: 12,
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 18,
              color: 'rgba(255,255,255,0.4)',
              display: 'flex',
            }}
          >
            agnivamahata.com
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
      },
    }
  );
}
