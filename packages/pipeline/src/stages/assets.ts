import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Asset, Scene, Video } from "@content-os/core";
import { BlockedByProviderError, CapacityExhaustedError, ContentOsError, estimateUsd } from "@content-os/core";
import type { PipelineContext } from "../context.ts";
import { recordUsage } from "../llm.ts";

export function dims(format: Video["format"]): { width: number; height: number } {
  return format === "SHORT" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
}

function promptHash(prompt: string, w: number, h: number, style: string): string {
  return createHash("sha256").update(`${prompt}|${w}x${h}|${style}`).digest("hex").slice(0, 32);
}

/** Programmatische Infografik / Textkarte (exakte Labels, keine Diffusion). */
export async function renderInfographic(opts: { width: number; height: number; title: string; value: string; label: string; colors: { primary: string; accent: string; background: string; text: string }; font?: string }): Promise<Buffer> {
  const { width: W, height: H } = opts;
  const font = opts.font ?? "DejaVu Sans";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${opts.colors.background}"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="${W * 0.08}" y="${H * 0.3}" width="${W * 0.84}" height="${H * 0.4}" rx="${Math.round(H * 0.02)}" fill="rgba(255,255,255,0.06)" stroke="${opts.colors.primary}" stroke-width="3"/>
  <text x="${W / 2}" y="${H * 0.4}" text-anchor="middle" font-family="${font}" font-size="${Math.round(H / 22)}" fill="${opts.colors.text}">${esc(opts.title)}</text>
  <text x="${W / 2}" y="${H * 0.55}" text-anchor="middle" font-family="${font}" font-weight="bold" font-size="${Math.round(H / 7)}" fill="${opts.colors.accent}">${esc(opts.value)}</text>
  <text x="${W / 2}" y="${H * 0.64}" text-anchor="middle" font-family="${font}" font-size="${Math.round(H / 26)}" fill="${opts.colors.text}" opacity="0.85">${esc(opts.label)}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Asset-Stufe: pro Szene ein Bild (oder Clip). Reihenfolge: Asset-Library (gleicher Prompt-Hash) -> Infografik/Textkarte lokal -> Bild-Provider.
 * Kein Fremdanbieter-Fallback: Video-Methoden ohne freigegebenen Provider werden auf IMAGE_KENBURNS herabgestuft (dokumentiert im Audit-Log).
 */
export async function runAssets(ctx: PipelineContext, video: Video): Promise<Asset[]> {
  const [project, sb] = await Promise.all([ctx.store.projects.get(video.projectId), video.storyboardId ? ctx.store.storyboards.get(video.storyboardId) : undefined]);
  if (!project || !sb) throw new Error("Projekt/Storyboard fehlt");
  const storage = ctx.registry.pick("storage", ["s3", "local"], "storage");
  const { width, height } = dims(video.format);
  const created: Asset[] = [];
  const scenes = sb.scenes as (Scene & { infographic?: { title: string; value: string; label: string } })[];

  for (const scene of scenes) {
    if (ctx.isKilled()) throw new ContentOsError("KILL_SWITCH", "Kill Switch aktiv");
    if (scene.assetIds.length) continue; // idempotent: bereits erzeugt
    const keyBase = `projects/${project.slug}/videos/${video.id}/scenes/${String(scene.index).padStart(3, "0")}`;
    let asset: Asset | undefined;

    if (scene.method === "INFOGRAPHIC" || scene.method === "TEXT_CARD") {
      const info = scene.infographic ?? { title: scene.overlay?.text ?? "", value: scene.overlay?.text ?? "", label: scene.visualDescription.slice(0, 60) };
      const png = await renderInfographic({ width, height, ...info, colors: project.styleGuide.brandColors, font: project.styleGuide.fontFamily });
      const key = `${keyBase}_infographic.png`;
      const put = await storage.put(key, png, "image/png");
      asset = await ctx.store.assets.create({ projectId: project.id, kind: "infographic", storageKey: key, mimeType: "image/png", width, height, sizeBytes: put.sizeBytes, provider: "local", model: "svg", prompt: JSON.stringify(info), promptHash: promptHash(JSON.stringify(info), width, height, "infographic"), topicId: video.topicId, sceneId: scene.id, videoId: video.id, rights: { source: "own", attributionRequired: false }, usedInVideoIds: [video.id], tags: ["infographic", scene.visualStyleTag] });
    } else {
      const style = project.styleGuide.visualStyle;
      const hash = promptHash(scene.generationPrompt, width, height, style);
      // 1) Wiederverwendung aus Asset-Library (identischer Prompt) – spart Generierungskapazität, kein identisches Video da Kontext anders
      const reusable = await ctx.store.assets.findReusable({ projectId: project.id, kind: "image", promptHash: hash, excludeVideoId: video.id, limit: 1 });
      if (reusable[0]) {
        const r = reusable[0];
        asset = await ctx.store.assets.update(r.id, { usedInVideoIds: [...new Set([...r.usedInVideoIds, video.id])] });
        await ctx.store.audit.log({ actor: "system", action: "asset.reuse", entityType: "asset", entityId: r.id, details: { sceneId: scene.id, videoId: video.id } });
      } else {
        // 2) Bild generieren (OpenAI-first). Video-Methoden nur, wenn Provider frei.
        const wantsVideo = scene.method === "IMAGE_TO_VIDEO" || scene.method === "TEXT_TO_VIDEO";
        const imageProvider = ctx.registry.pick("image", ["openai", "mock"], "image.generate");
        const quality = video.format === "SHORT" ? "medium" : "medium";
        const estUsd = estimateUsd(imageProvider.name, `${(imageProvider as { model?: string }).model ?? "mock"}:${quality}`, "images", 1).usd;
        await ctx.budget.assertCanSpend({ estimatedCostEur: estUsd * ctx.env.USD_EUR_RATE, videoId: video.id, projectId: project.id, format: video.format, provider: imageProvider.name });
        const capKey = `${imageProvider.name}:image.generate`;
        const cap = await ctx.capacity.check(capKey);
        if (!cap.allowed) throw new CapacityExhaustedError(imageProvider.name, cap.reason ?? "Kapazität", cap.retryAfterSeconds);
        let img;
        try {
          await ctx.capacity.consume(capKey);
          img = await imageProvider.generate({ prompt: `${scene.generationPrompt}. Style: ${style}. No text, no watermark, no logos.`, negativePrompt: scene.negativePrompt, width, height, quality, style });
        } catch (err) {
          if (err instanceof CapacityExhaustedError) await ctx.capacity.reportLimit(capKey, err.retryAfterSeconds ?? 60);
          await recordUsage(ctx, [{ provider: imageProvider.name, model: "image", units: 1, unitType: "images" }], "image.generate", { projectId: project.id, videoId: video.id, stage: "ASSETS" }, { failed: true });
          throw err;
        }
        await recordUsage(ctx, img.usage, "image.generate", { projectId: project.id, videoId: video.id, stage: "ASSETS", format: video.format });
        // Auf Zielauflösung bringen (Cover-Crop), damit Render deterministisch ist
        const fitted = await sharp(img.image).resize(width, height, { fit: "cover" }).png().toBuffer();
        const key = `${keyBase}_image.png`;
        const put = await storage.put(key, fitted, "image/png");
        asset = await ctx.store.assets.create({ projectId: project.id, kind: "image", storageKey: key, mimeType: "image/png", width, height, sizeBytes: put.sizeBytes, provider: imageProvider.name, model: img.model, prompt: scene.generationPrompt, promptHash: hash, topicId: video.topicId, sceneId: scene.id, videoId: video.id, rights: { source: "generated", license: "provider-terms", attributionRequired: false }, usedInVideoIds: [video.id], tags: [scene.visualStyleTag, video.format.toLowerCase()] });

        if (wantsVideo) {
          try {
            const videoProvider = ctx.registry.pick("video", ["openai", "mock"], "video.image_to_video");
            const clipSec = Math.min(8, Math.max(4, Math.round(scene.durationSec)));
            const clip = await videoProvider.generate({ prompt: scene.generationPrompt, durationSec: clipSec, width, height, inputImage: fitted });
            await recordUsage(ctx, clip.usage, "video.image_to_video", { projectId: project.id, videoId: video.id, stage: "ASSETS", format: video.format });
            const vkey = `${keyBase}_clip.mp4`;
            const vput = await storage.put(vkey, clip.video, "video/mp4");
            const vasset = await ctx.store.assets.create({ projectId: project.id, kind: "video", storageKey: vkey, mimeType: "video/mp4", width, height, durationSec: clip.durationSec, sizeBytes: vput.sizeBytes, provider: videoProvider.name, model: clip.model, prompt: scene.generationPrompt, promptHash: hash, topicId: video.topicId, sceneId: scene.id, videoId: video.id, rights: { source: "generated", license: "provider-terms", attributionRequired: false }, usedInVideoIds: [video.id], tags: [scene.visualStyleTag, "clip"] });
            created.push(vasset);
            scene.assetIds.push(vasset.id);
          } catch (err) {
            if (err instanceof BlockedByProviderError || (err as { kind?: string }).kind === "PROVIDER_DISABLED") {
              await ctx.store.audit.log({ actor: "system", action: "scene.downgrade", entityType: "scene", entityId: scene.id, details: { from: scene.method, to: "IMAGE_KENBURNS", reason: String(err) } });
              scene.method = "IMAGE_KENBURNS";
            } else throw err;
          }
        }
      }
    }
    if (!asset) throw new ContentOsError("INTERNAL", `Kein Asset für Szene ${scene.id}`);
    created.push(asset);
    scene.assetIds.unshift(asset.id);
    // Fortschritt persistieren (idempotenter Neustart nach Kapazitätsstopp)
    await ctx.store.storyboards.update(sb.id, { scenes });
  }
  await ctx.store.storyboards.update(sb.id, { scenes });
  return created;
}
