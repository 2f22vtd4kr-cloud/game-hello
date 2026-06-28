import type { GameState, PlacedBuilding } from "./store";
import { BUILDINGS } from "./buildings";
import { TILE_W, TILE_H } from "./constants";

export function isoToScreen(col: number, row: number, tW: number, tH: number) {
  return {
    x: (col - row) * (tW / 2),
    y: (col + row) * (tH / 2),
  };
}

export function screenToIso(sx: number, sy: number, tW: number, tH: number) {
  const col = (sx / (tW / 2) + sy / (tH / 2)) / 2;
  const row = (sy / (tH / 2) - sx / (tW / 2)) / 2;
  return { col: Math.floor(col), row: Math.floor(row) };
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, tW: number, tH: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + tW / 2, cy + tH / 2);
  ctx.lineTo(cx, cy + tH);
  ctx.lineTo(cx - tW / 2, cy + tH / 2);
  ctx.closePath();
}

function drawGroundTile(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  tW: number, tH: number,
  color: string,
  highlight = false,
  hover = false,
) {
  drawDiamond(ctx, cx, cy, tW, tH);
  ctx.fillStyle = color;
  ctx.fill();
  if (hover) {
    drawDiamond(ctx, cx, cy, tW, tH);
    ctx.fillStyle = "rgba(232,98,42,0.15)";
    ctx.fill();
  }
  ctx.strokeStyle = highlight ? "rgba(232,98,42,0.8)" : "rgba(255,255,255,0.07)";
  ctx.lineWidth = highlight ? 1.5 : 0.5;
  ctx.stroke();
}

function drawEmojiBuilding(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  tW: number, tH: number,
  emoji: string,
  level: number,
  ts: number,
) {
  const emojiSize = Math.max(18, Math.round(tH * 0.85 * ts));
  const labelSize = Math.max(9, Math.round(11 * ts));

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 6;
  ctx.font = `${emojiSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(emoji, px, py + tH * 0.15);
  ctx.restore();

  const badgeX = px;
  const badgeY = py + tH * 1.05;
  const badgeW = Math.max(28, 22 * ts);
  const badgeH = Math.max(13, 12 * ts);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `700 ${labelSize}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`Ур.${level}`, badgeX, badgeY);
  ctx.restore();
}

export function renderFrame(
  canvas: HTMLCanvasElement,
  state: GameState,
  timestamp: number,
  selectedTile: { col: number; row: number } | null,
  hoverTile: { col: number; row: number } | null,
  tileW: number,
  tileH: number,
  offsetX: number,
  offsetY: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const gridSize = Math.max(4, Math.min(14, 4 + state.level - 1));
  const cx = canvas.width / dpr / 2 + offsetX;
  const cy = offsetY;

  const buildingMap: Record<string, PlacedBuilding> = {};
  for (const b of state.buildings) {
    const def = BUILDINGS[b.id];
    if (!def) continue;
    for (let dc = 0; dc < def.tileSize; dc++) {
      for (let dr = 0; dr < def.tileSize; dr++) {
        buildingMap[`${b.col + dc},${b.row + dr}`] = b;
      }
    }
  }

  const ts = tileW / TILE_W;

  for (let col = 0; col < gridSize; col++) {
    for (let row = 0; row < gridSize; row++) {
      const { x, y } = isoToScreen(col, row, tileW, tileH);
      const px = cx + x; const py = cy + y;
      const isSelected = selectedTile?.col === col && selectedTile?.row === row;
      const isHover = hoverTile?.col === col && hoverTile?.row === row;
      const isOccupied = !!buildingMap[`${col},${row}`];
      const baseColor = (col + row) % 2 === 0 ? "#1a1a2e" : "#16162a";
      drawGroundTile(ctx, px, py, tileW, tileH, isSelected ? "#2d1a4a" : baseColor, isSelected, isHover && !isOccupied);
    }
  }

  const rendered = new Set<string>();
  const sortedBuildings = [...state.buildings].sort((a, b) => (a.col + a.row) - (b.col + b.row));

  for (const building of sortedBuildings) {
    if (rendered.has(building.uid)) continue;
    rendered.add(building.uid);
    const def = BUILDINGS[building.id];
    if (!def) continue;
    const midCol = building.col + (def.tileSize - 1) / 2;
    const midRow = building.row + (def.tileSize - 1) / 2;
    const { x, y } = isoToScreen(midCol, midRow, tileW, tileH);
    const px = cx + x; const py = cy + y;

    for (let dc = 0; dc < def.tileSize; dc++) {
      for (let dr = 0; dr < def.tileSize; dr++) {
        const { x: tx, y: ty } = isoToScreen(building.col + dc, building.row + dr, tileW, tileH);
        drawGroundTile(ctx, cx + tx, cy + ty, tileW, tileH, "#241f3a");
      }
    }

    drawEmojiBuilding(ctx, px, py, tileW, tileH, def.icon, building.level, ts);
  }

  for (const p of state.particles ?? []) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.font = `${p.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const emoji = p.type === "coin" ? "💰" : p.type === "xp" ? "⭐" : p.type === "smoke" ? "💨" : p.type === "oil_drop" ? "🛢️" : "✨";
    ctx.fillText(emoji, p.x, p.y);
    ctx.restore();
  }

  ctx.restore();
}

export function getCanvasCoords(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  tileW: number,
  tileH: number,
  offsetX: number,
  offsetY: number,
): { col: number; row: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const px = (clientX - rect.left);
  const py = (clientY - rect.top);
  const cx = canvas.width / dpr / 2 + offsetX;
  const cy = offsetY;
  return screenToIso(px - cx, py - cy, tileW, tileH);
}
