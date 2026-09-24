import sharp from "sharp";

export interface ThumbnailSpec {
  baseImage: Buffer;
  width: number; // 1280
  height: number; // 720
  headline: string; // max ~4 Wörter, groß
  accentColor: string;
  textColor: string;
  variant: "left_text" | "bottom_band" | "center_burst";
  fontFamily?: string;
}

function escapeXml(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/** Programmatische Thumbnail-Komposition: Basisbild + Kontrast-Text, mobil lesbar, 3 Varianten. */
export async function composeThumbnail(spec: ThumbnailSpec): Promise<Buffer> {
  const { width: W, height: H } = spec;
  const base = await sharp(spec.baseImage).resize(W, H, { fit: "cover" }).modulate({ saturation: 1.15 }).toBuffer();
  const words = spec.headline.split(/\s+/);
  const lines = words.length > 3 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [spec.headline];
  const font = spec.fontFamily ?? "DejaVu Sans";
  const fs = spec.variant === "center_burst" ? Math.round(H / 5) : Math.round(H / 6);
  let svg = "";
  if (spec.variant === "left_text") {
    const y0 = H / 2 - ((lines.length - 1) * fs * 1.1) / 2;
    svg = `<rect x="0" y="0" width="${W * 0.55}" height="${H}" fill="rgba(0,0,0,0.55)"/>` + lines.map((l, i) => `<text x="${W * 0.05}" y="${y0 + i * fs * 1.1}" font-size="${fs}" font-weight="900" font-family="${font}" fill="${i === lines.length - 1 ? spec.accentColor : spec.textColor}" stroke="#000" stroke-width="${Math.round(fs / 14)}" paint-order="stroke">${escapeXml(l)}</text>`).join("");
  } else if (spec.variant === "bottom_band") {
    svg = `<rect x="0" y="${H * 0.68}" width="${W}" height="${H * 0.32}" fill="${spec.accentColor}"/>` + lines.map((l, i) => `<text x="${W / 2}" y="${H * 0.68 + fs * 0.95 + i * fs * 1.05}" text-anchor="middle" font-size="${Math.round(fs * 0.85)}" font-weight="900" font-family="${font}" fill="#000">${escapeXml(l)}</text>`).join("");
  } else {
    const y0 = H / 2 + fs / 3 - ((lines.length - 1) * fs * 1.05) / 2;
    svg = lines.map((l, i) => `<text x="${W / 2}" y="${y0 + i * fs * 1.05}" text-anchor="middle" font-size="${fs}" font-weight="900" font-family="${font}" fill="${spec.textColor}" stroke="${spec.accentColor}" stroke-width="${Math.round(fs / 10)}" paint-order="stroke">${escapeXml(l)}</text>`).join("");
  }
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg}</svg>`);
  return sharp(base).composite([{ input: overlay }]).jpeg({ quality: 90 }).toBuffer();
}
