export interface ShareCardData {
  playerName: string;
  avatarDataUrl: string | null;
  itemName: string;
  marketName: string;
  city: string;
  askingPrice: number;
  finalPrice: number;
  savingsPct: number;
  badge: string | null;
  success: boolean;
  stealth: boolean;
  origin: string;
}

const W = 1080;
const H = 1350;
const PAD = 84;

const CREAM = "#f4efe3";
const PAPER = "#fffdf7";
const INK = "#141210";
const INK_40 = "rgba(20,18,16,0.4)";
const INK_60 = "rgba(20,18,16,0.6)";
const MARIGOLD = "#ff6a13";
const GREEN = "#0e9f4f";
const PINK = "#ff2d6f";

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Decode fully before drawing, so a card can never render a half-loaded avatar. */
async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.src = src;
    if (typeof img.decode === "function") {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("avatar failed to load"));
      });
    }
    return img.naturalWidth > 0 ? img : null;
  } catch {
    return null;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  bg: string,
  fg: string,
  font: string
) {
  ctx.font = font;
  const padX = 28;
  const h = 64;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = INK;
  ctx.fillRect(x + 6, y + 6, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 2);
  ctx.textBaseline = "alphabetic";
  return w;
}

function avatarCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = CREAM;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) {
    // cover-fit the source into the circle
    const scale = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "rgba(20,18,16,0.28)";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.18, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.62, r * 0.6, r * 0.45, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export async function renderShareCard(d: ShareCardData): Promise<HTMLCanvasElement> {
  // Fonts must be ready or canvas silently falls back to a system face.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* proceed with fallback fonts */
    }
  }

  const display = cssVar("--font-display", "system-ui, sans-serif");
  const mono = cssVar("--font-data", "monospace");
  const serif = cssVar("--font-editorial", "Georgia, serif");

  const avatar = d.avatarDataUrl ? await loadImage(d.avatarDataUrl) : null;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  // Background + frame
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(20,18,16,0.07)";
  for (let y = 40; y < H; y += 52) {
    for (let x = 40; x < W; x += 52) {
      ctx.fillRect(x, y, 3, 3);
    }
  }
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  let y = PAD + 40;

  if (!d.stealth) {
    ctx.fillStyle = INK;
    ctx.font = `800 52px ${display}`;
    ctx.fillText("MOL BHAV", PAD, y);
    const wm = ctx.measureText("MOL BHAV").width;
    ctx.fillStyle = MARIGOLD;
    ctx.fillText(".", PAD + wm, y);

    ctx.fillStyle = INK_40;
    ctx.font = `700 24px ${mono}`;
    ctx.fillText(d.success ? "S C O R E C A R D" : "B A N N E D", PAD, y + 54);
    y += 130;
  } else {
    ctx.fillStyle = INK_40;
    ctx.font = `700 26px ${mono}`;
    ctx.fillText("T O D A Y ' S   H A U L", PAD, y);
    y += 70;
  }

  // Avatar + player
  const r = 92;
  avatarCircle(ctx, avatar, PAD + r, y + r, r);
  ctx.fillStyle = INK;
  ctx.font = `800 62px ${display}`;
  ctx.fillText(d.playerName, PAD + r * 2 + 40, y + r + 8);
  if (!d.stealth) {
    ctx.fillStyle = INK_60;
    ctx.font = `400 34px ${serif}`;
    ctx.fillText(`at ${d.marketName}`, PAD + r * 2 + 40, y + r + 56);
  }
  y += r * 2 + 70;

  // Item
  ctx.fillStyle = INK;
  ctx.font = `800 76px ${display}`;
  const lines = wrap(ctx, d.itemName, W - PAD * 2);
  for (const ln of lines) {
    ctx.fillText(ln, PAD, y);
    y += 86;
  }

  ctx.fillStyle = INK_60;
  ctx.font = `400 38px ${serif}`;
  ctx.fillText(`${d.marketName} · ${d.city}`, PAD, y + 14);
  y += 86;

  // Dashed rule
  ctx.strokeStyle = "rgba(20,18,16,0.25)";
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += 66;

  if (d.stealth) {
    // Clean haul: what it is, where it's from, what was paid. Nothing else.
    ctx.fillStyle = INK_40;
    ctx.font = `700 26px ${mono}`;
    ctx.fillText(d.success ? "P A I D" : "W A L K E D   A W A Y", PAD, y);
    if (d.success) {
      ctx.fillStyle = INK;
      ctx.font = `800 128px ${display}`;
      ctx.fillText(`₹${d.finalPrice}`, PAD, y + 128);
    }
  } else if (d.success) {
    ctx.fillStyle = INK_40;
    ctx.font = `700 26px ${mono}`;
    ctx.fillText("A S K I N G", PAD, y);
    ctx.fillStyle = INK_60;
    ctx.font = `700 54px ${display}`;
    const askText = `₹${d.askingPrice}`;
    ctx.fillText(askText, PAD, y + 58);
    const aw = ctx.measureText(askText).width;
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(PAD - 6, y + 40);
    ctx.lineTo(PAD + aw + 6, y + 40);
    ctx.stroke();

    ctx.fillStyle = INK_40;
    ctx.font = `700 26px ${mono}`;
    ctx.fillText("P A I D", PAD, y + 122);
    ctx.fillStyle = MARIGOLD;
    ctx.font = `800 128px ${display}`;
    ctx.fillText(`₹${d.finalPrice}`, PAD, y + 240);

    pill(
      ctx,
      PAD,
      y + 278,
      `${d.savingsPct.toFixed(0)}% OFF`,
      GREEN,
      PAPER,
      `800 34px ${display}`
    );
    if (d.badge) {
      pill(ctx, PAD, y + 362, d.badge, PAPER, INK, `800 34px ${display}`);
    }
  } else {
    ctx.fillStyle = PINK;
    ctx.font = `800 130px ${display}`;
    ctx.fillText("NO DEAL.", PAD, y + 108);
    ctx.fillStyle = INK_60;
    ctx.font = `400 40px ${serif}`;
    ctx.fillText("Thrown out of the shop.", PAD, y + 172);
    if (d.badge) {
      pill(ctx, PAD, y + 218, d.badge, PAPER, INK, `800 34px ${display}`);
    }
  }

  // Footer — stealth cards carry no branding or link by design.
  if (!d.stealth) {
    ctx.fillStyle = INK_40;
    ctx.font = `700 26px ${mono}`;
    ctx.fillText(d.origin.replace(/^https?:\/\//, ""), PAD, H - PAD - 6);
  }

  return canvas;
}

export function shareMessage(d: {
  success: boolean;
  itemName: string;
  marketName: string;
  finalPrice: number;
  savingsPct: number;
  origin: string;
}): string {
  if (!d.success) {
    return `I got kicked out of ${d.marketName} on Mol Bhav 🤡 Think you can do better? → ${d.origin}`;
  }
  return `I haggled a ${d.itemName} down to ₹${d.finalPrice} at ${d.marketName} on Mol Bhav 💪 (${d.savingsPct.toFixed(0)}% off). Think you can do better? → ${d.origin}`;
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
