export const config = { runtime: 'edge' };

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function generateAttractor(seed, width, height, numPoints) {
  const rng = seededRandom(seed);

  // Clifford attractor parameters derived from seed
  const a = -2 + rng() * 4;
  const b = -2 + rng() * 4;
  const c = -2 + rng() * 4;
  const d = -2 + rng() * 4;

  let x = rng() * 0.1;
  let y = rng() * 0.1;

  const points = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  // Generate points
  for (let i = 0; i < numPoints; i++) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x);
    const ny = Math.sin(b * x) + d * Math.cos(b * y);
    x = nx;
    y = ny;

    if (i > 100) { // skip initial transient
      points.push({ x: nx, y: ny });
      minX = Math.min(minX, nx);
      maxX = Math.max(maxX, nx);
      minY = Math.min(minY, ny);
      maxY = Math.max(maxY, ny);
    }
  }

  // Map to canvas coordinates with padding
  const pad = 80;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  return points.map(p => ({
    x: pad + ((p.x - minX) / rangeX) * (width - pad * 2),
    y: pad + ((p.y - minY) / rangeY) * (height - pad * 2)
  }));
}

function createSVG(title, width, height, seed) {
  const points = generateAttractor(seed, width, height, 50000);

  // Create a density grid for the glow effect
  const gridSize = 4;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);
  const grid = new Array(cols * rows).fill(0);

  for (const p of points) {
    const col = Math.floor(p.x / gridSize);
    const row = Math.floor(p.y / gridSize);
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      grid[row * cols + col]++;
    }
  }

  const maxDensity = Math.max(...grid.filter(v => v > 0));

  // Build SVG circles for dense areas
  let circles = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const density = grid[row * cols + col];
      if (density > 0) {
        const intensity = Math.min(density / (maxDensity * 0.3), 1);
        const alpha = 0.05 + intensity * 0.85;
        const radius = 1 + intensity * 1.5;
        const cx = col * gridSize + gridSize / 2;
        const cy = row * gridSize + gridSize / 2;
        circles += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(255,255,255,${alpha.toFixed(3)})" />`;
      }
    }
  }

  // Escape title for SVG
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Word wrap title
  const maxCharsPerLine = 30;
  const words = safeTitle.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  const lineHeight = 48;
  const totalTextHeight = lines.length * lineHeight;
  const textStartY = height - 60 - totalTextHeight;

  let titleText = '';
  lines.forEach((line, i) => {
    titleText += `<text x="60" y="${textStartY + i * lineHeight}" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="bold" fill="white" opacity="0.95">${line}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#0a0a0a" />
    <g>${circles}</g>
    <rect x="0" y="${textStartY - 80}" width="${width}" height="${height - textStartY + 80}" fill="url(#textGrad)" />
    <defs>
      <linearGradient id="textGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0a0a0a" stop-opacity="0" />
        <stop offset="30%" stop-color="#0a0a0a" stop-opacity="0.7" />
        <stop offset="100%" stop-color="#0a0a0a" stop-opacity="0.95" />
      </linearGradient>
    </defs>
    ${titleText}
    <text x="60" y="${height - 30}" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="white" opacity="0.5">agnivamahata.com</text>
  </svg>`;
}

export default function handler(req) {
  const url = new URL(req.url);
  const title = url.searchParams.get('title') || 'Agniva Mahata';
  const width = 1200;
  const height = 630;
  const seed = hashString(title);

  const svg = createSVG(title, width, height, seed);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}
