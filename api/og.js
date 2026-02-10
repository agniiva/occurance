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

function generateDots(seed, width, height) {
  const rng = seededRandom(seed);
  const a = -2.0 + rng() * 1.5;
  const b = 0.5 + rng() * 1.5;
  const c = -1.5 + rng() * 1.0;
  const d = 0.5 + rng() * 1.5;

  let x = 0.1, y = 0.1;
  const xs = [], ys = [];

  for (let i = 0; i < 20000; i++) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x);
    const ny = Math.sin(b * x) + d * Math.cos(b * y);
    x = nx; y = ny;
    if (i > 200) { xs.push(nx); ys.push(ny); }
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
  const pad = 40;
  const gridSize = 8;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);
  const grid = new Uint16Array(cols * rows);

  for (let i = 0; i < xs.length; i++) {
    const px = pad + ((xs[i] - minX) / rangeX) * (width - pad * 2);
    const py = pad + ((ys[i] - minY) / rangeY) * (height - pad * 2);
    const col = Math.floor(px / gridSize);
    const row = Math.floor(py / gridSize);
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      grid[row * cols + col]++;
    }
  }

  let maxD = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > maxD) maxD = grid[i];
  }
  if (maxD === 0) maxD = 1;
  const logMax = Math.log(maxD + 1);

  const dots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const density = grid[row * cols + col];
      if (density > 0) {
        const logD = Math.log(density + 1) / logMax;
        dots.push({
          x: col * gridSize,
          y: row * gridSize,
          size: Math.round(2 + logD * 5),
          opacity: Math.round((0.15 + logD * 0.8) * 100) / 100,
        });
      }
    }
  }

  dots.sort((a, b) => b.opacity - a.opacity);
  return dots.slice(0, 600);
}

// Using React element objects instead of JSX (no compilation needed)
function h(type, props, ...children) {
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children.length === 0 ? undefined : children } };
}

export default function handler(req) {
  const url = new URL(req.url);
  const title = url.searchParams.get('title') || 'Agniva Mahata';
  const width = 1200;
  const height = 630;
  const seed = hashString(title);
  const dots = generateDots(seed, width, height);

  const dotElements = dots.map((dot, i) =>
    h('div', {
      key: i,
      style: {
        position: 'absolute',
        left: dot.x,
        top: dot.y,
        width: dot.size,
        height: dot.size,
        borderRadius: '50%',
        backgroundColor: `rgba(255,255,255,${dot.opacity})`,
      },
    })
  );

  const element = h('div', {
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      backgroundColor: '#0a0a0a',
      position: 'relative',
      overflow: 'hidden',
    },
  },
    // Attractor dots
    ...dotElements,
    // Gradient overlay
    h('div', {
      style: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '260px',
        background: 'linear-gradient(to bottom, transparent, rgba(10,10,10,0.9) 50%, #0a0a0a)',
        display: 'flex',
      },
    }),
    // Text container
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        padding: '0 60px 45px',
        position: 'relative',
      },
    },
      h('div', {
        style: {
          fontSize: 48,
          fontWeight: 700,
          color: 'white',
          lineHeight: 1.15,
          marginBottom: 14,
          display: 'flex',
        },
      }, title),
      h('div', {
        style: {
          fontSize: 20,
          color: 'rgba(255,255,255,0.35)',
          display: 'flex',
        },
      }, 'agnivamahata.com')
    )
  );

  return new ImageResponse(element, {
    width,
    height,
    headers: {
      'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
    },
  });
}
