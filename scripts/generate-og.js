const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

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

function generateOG(title, outputPath) {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const seed = hashString(title);
  const rng = seededRandom(seed);

  // Dark background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  // Clifford attractor
  const a = -2.0 + rng() * 1.5;
  const b = 0.5 + rng() * 1.5;
  const c = -1.5 + rng() * 1.0;
  const d = 0.5 + rng() * 1.5;

  let x = 0.1, y = 0.1;
  const numPoints = 80000;
  const xs = [], ys = [];

  for (let i = 0; i < numPoints; i++) {
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
  const pad = 50;

  // Density grid
  const gridSize = 3;
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

  // Draw attractor dots
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const density = grid[row * cols + col];
      if (density > 0) {
        const logD = Math.log(density + 1) / logMax;
        const alpha = 0.08 + logD * 0.88;
        const radius = 0.8 + logD * 1.8;
        const cx = col * gridSize + gridSize / 2;
        const cy = row * gridSize + gridSize / 2;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }
    }
  }

  // Gradient overlay for text area
  const gradientY = height - 250;
  const gradient = ctx.createLinearGradient(0, gradientY, 0, height);
  gradient.addColorStop(0, 'rgba(10, 10, 10, 0)');
  gradient.addColorStop(0.4, 'rgba(10, 10, 10, 0.85)');
  gradient.addColorStop(1, 'rgba(10, 10, 10, 0.98)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, gradientY, width, 250);

  // Title text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = 'bold 48px "Inter", "Segoe UI", system-ui, sans-serif';

  // Word wrap
  const maxWidth = width - 120;
  const words = title.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = 56;
  const textStartY = height - 55 - (lines.length - 1) * lineHeight - 30;

  lines.forEach((line, i) => {
    ctx.fillText(line, 60, textStartY + i * lineHeight);
  });

  // Site name
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '20px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('agnivamahata.com', 60, height - 30);

  // Save
  const buffer = canvas.toBuffer('image/png');
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath} (${Math.round(buffer.length / 1024)}KB)`);
}

// Get all writing posts and generate OG images
const contentDir = path.join(__dirname, '..', 'content', 'writing');
const outputDir = path.join(__dirname, '..', 'static', 'og');

const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const content = fs.readFileSync(path.join(contentDir, file), 'utf-8');
  const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (titleMatch) {
    const title = titleMatch[1];
    const slug = file.replace('.md', '');
    generateOG(title, path.join(outputDir, `${slug}.png`));
  }
}

// Also generate homepage OG
generateOG('Agniva Mahata', path.join(outputDir, 'home.png'));
// About page
generateOG('About', path.join(outputDir, 'about.png'));
// Links page
generateOG('Links', path.join(outputDir, 'links.png'));
// Writing index
generateOG('Writing', path.join(outputDir, 'writing.png'));
