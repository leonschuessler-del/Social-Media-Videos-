import OpenAI, { toFile } from "openai";
import type { ImageProvider, ImageRequest, ImageResult, UsageReport } from "@content-os/core";
import { openaiClient, translateOpenAIError } from "./client.ts";

type Size = "1024x1024" | "1536x1024" | "1024x1536";

/** Standardgrößen der Images API; finale Video-Auflösung entsteht per Scale/Crop im Render. */
export function nearestSize(w: number, h: number): Size {
  const r = w / h;
  if (r > 1.15) return "1536x1024";
  if (r < 0.87) return "1024x1536";
  return "1024x1024";
}

/**
 * OpenAI Images API (gpt-image-2.5-flare default). Token-basierte Abrechnung wird, wenn geliefert, exakt gebucht;
 * sonst Näherung pro Bild über Preistabelle (model:quality).
 */
export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai";
  constructor(private readonly opts: { model?: string; apiKey?: string } = {}) {}
  get model() { return this.opts.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare"; }

  private usageFrom(res: OpenAI.Images.ImagesResponse, quality: string): UsageReport[] {
    const u = res.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    if (u?.output_tokens) {
      return [
        { provider: "openai", model: this.model, units: u.input_tokens ?? 0, unitType: "input_tokens" },
        { provider: "openai", model: this.model, units: u.output_tokens, unitType: "output_tokens" },
      ];
    }
    return [{ provider: "openai", model: `${this.model}:${quality}`, units: 1, unitType: "images" }];
  }

  async generate(req: ImageRequest): Promise<ImageResult> {
    const client = openaiClient(this.opts.apiKey);
    const size = nearestSize(req.width, req.height);
    const quality = req.quality ?? "medium";
    const prompt = req.negativePrompt ? `${req.prompt}\n\nAvoid: ${req.negativePrompt}` : req.prompt;
    try {
      const res = await client.images.generate({ model: this.model, prompt, size, quality, n: 1, output_format: "png" } as OpenAI.Images.ImageGenerateParamsNonStreaming);
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("Images API lieferte kein Bild");
      const [w, h] = size.split("x").map(Number) as [number, number];
      return { image: Buffer.from(b64, "base64"), mimeType: "image/png", width: w, height: h, model: this.model, usage: this.usageFrom(res, quality), revisedPrompt: res.data?.[0]?.revised_prompt };
    } catch (err) {
      translateOpenAIError(err, `images.generate(${this.model})`);
    }
  }

  async edit(req: ImageRequest & { referenceImages: Buffer[] }): Promise<ImageResult> {
    const client = openaiClient(this.opts.apiKey);
    const size = nearestSize(req.width, req.height);
    const quality = req.quality ?? "medium";
    try {
      const images = await Promise.all(req.referenceImages.map((b, i) => toFile(b, `ref_${i}.png`, { type: "image/png" })));
      const mask = req.mask ? await toFile(req.mask, "mask.png", { type: "image/png" }) : undefined;
      const res = await client.images.edit({ model: this.model, image: images, mask, prompt: req.prompt, size, quality, n: 1 } as OpenAI.Images.ImageEditParamsNonStreaming);
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("Images API (edit) lieferte kein Bild");
      const [w, h] = size.split("x").map(Number) as [number, number];
      return { image: Buffer.from(b64, "base64"), mimeType: "image/png", width: w, height: h, model: this.model, usage: this.usageFrom(res, quality) };
    } catch (err) {
      translateOpenAIError(err, `images.edit(${this.model})`);
    }
  }
}
