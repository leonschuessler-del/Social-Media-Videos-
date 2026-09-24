/**
 * END-TO-END VERTICAL SLICE (offline, Mock-Provider, echter FFmpeg-Render):
 * THEMA -> RESEARCH -> FACT CHECK -> SCRIPT -> STORYBOARD -> VISUALS -> VOICE -> EDIT -> QA -> REVIEW (SAFE MODE) -> APPROVE -> "YOUTUBE READY" (Mock-Upload)
 */
import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMemoryStore, loadEnv } from "@content-os/core";
import { buildRegistry } from "@content-os/providers";
import { probe } from "@content-os/render";
import { createContext, type PipelineContext } from "./context.ts";
import { MockLLMProvider } from "./mock/mock-llm.ts";
import { createTopic } from "./stages/topic.ts";
import { createVideoForTopic, reviewDecision, runStage, runUntil } from "./runner.ts";
import { seedProject01 } from "./seed.ts";
import { ELEVATOR_TOPIC } from "./fixtures/elevator.ts";

let ctx: PipelineContext;
let projectId: string;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "contentos-e2e-"));
  const env = loadEnv({ ...process.env, NODE_ENV: "test", PROVIDER_MODE: "mock", STORAGE_DRIVER: "local", STORAGE_LOCAL_ROOT: root, ENABLED_PROVIDERS: "openai,local,mock", MUSIC_LIBRARY_DIR: join(root, "no-music"), SFX_LIBRARY_DIR: join(root, "no-sfx"), RENDER_THREADS: "2" } as NodeJS.ProcessEnv);
  const store = createMemoryStore();
  const registry = buildRegistry(env, { mockLLM: new MockLLMProvider() });
  ctx = createContext({ env, store, registry });
  const project = await seedProject01(store);
  projectId = project.id;
  await store.channels.create({ projectId, platform: "youtube", name: "Test Channel", defaultPrivacy: "private", defaultPublishHourLocal: 17, timezone: "Europe/Berlin", active: true });
});

describe("Vertical Slice: SHORT (Aufzugseil)", () => {
  it("läuft vollständig bis REVIEW (SAFE MODE) und produziert ein echtes MP4 9:16", async () => {
    const topic = await createTopic(ctx, { projectId, title: ELEVATOR_TOPIC.title, angle: ELEVATOR_TOPIC.angle, format: "SHORT" });
    const video = await createVideoForTopic(ctx, topic.id);
    expect(video.stage).toBe("SELECTED");
    const done = await runUntil(ctx, video.id, "REVIEW");
    const audit = await ctx.store.audit.list({ entityId: video.id });
    expect(done.status, JSON.stringify({ stage: done.stage, status: done.status, reason: done.statusReason, audit: audit.slice(-3) })).not.toBe("DEAD_LETTER");
    expect(done.stage).toBe("REVIEW");
    expect(done.status).toBe("QUEUED");

    const research = await ctx.store.research.get(done.researchId!);
    expect(research!.claims.length).toBeGreaterThan(3);
    expect(research!.claims.every((c) => c.verdict)).toBe(true);
    const script = await ctx.store.scripts.get(done.scriptId!);
    expect(script!.sections[0]!.kind).toBe("HOOK");
    const sb = await ctx.store.storyboards.get(done.storyboardId!);
    expect(sb!.scenes.length).toBeGreaterThanOrEqual(6);
    expect(sb!.scenes.every((s) => s.assetIds.length > 0)).toBe(true);

    const render = await ctx.store.assets.get(done.renderAssetId!);
    const storage = ctx.registry.pick("storage", ["local"], "storage");
    const path = await storage.localPath(render!.storageKey);
    const info = await probe(path);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
    expect(info.hasAudio).toBe(true);
    expect(info.durationSec).toBeGreaterThan(20);
    expect(info.durationSec).toBeLessThanOrEqual(60);
    expect((await stat(path)).size).toBeGreaterThan(100_000);

    const qa = await ctx.store.qa.get(done.qaReportId!);
    expect(qa!.checks.map((c) => c.check)).toEqual(expect.arrayContaining(["TECHNICAL", "AUDIO", "RIGHTS", "POLICY", "FACT", "VISUAL", "DUPLICATION", "REPETITION"]));
    expect(qa!.decision, qa!.reasons.join("; ")).toBe("PASS");
    expect(done.qualityScore).toBeGreaterThan(0.6);
    expect(done.metadata?.selectedTitle).toContain("Shorts");
    expect(done.metadata?.description).toContain("KI-generierte");
    expect(done.thumbnailAssetId).toBeTruthy();

    // Kosten vollständig protokolliert (Mock = 0 €, aber Einträge vorhanden)
    const costs = await ctx.store.costs.list({ videoId: video.id });
    expect(costs.length).toBeGreaterThan(10);
    const sum = await ctx.store.costs.summarize({ videoId: video.id });
    expect(sum.images).toBeGreaterThanOrEqual(6);
    expect(sum.ttsCharacters).toBeGreaterThan(200);
    expect(sum.costEur).toBe(0);
    expect(done.experiment?.hookType).toBe("QUESTION");
    expect(done.experiment?.durationSec).toBeGreaterThan(20);
  }, 300_000);

  it("Freigabe -> READY -> Mock-Upload -> SCHEDULED (YouTube-ready)", async () => {
    const [v] = await ctx.store.videos.list({ projectId, stage: "REVIEW" });
    expect(v).toBeTruthy();
    const approved = await reviewDecision(ctx, v!.id, { reviewer: "leon", decision: "APPROVE" });
    expect(approved.stage).toBe("READY");
    const out = await runStage(ctx, v!.id);
    expect(out.to).toBe("SCHEDULED");
    expect(out.video.externalVideoId).toMatch(/^mock_/);
    expect(out.video.scheduledFor).toBeTruthy();
    const reviews = await ctx.store.reviews.listByVideo(v!.id);
    expect(reviews[0]?.decision).toBe("APPROVE");
  }, 60_000);

  it("Originalität: identisches Thema wird abgelehnt", async () => {
    const dup = await createTopic(ctx, { projectId, title: "Was passiert wenn ein Aufzugseil reißt", format: "SHORT" });
    expect(dup.originalityCheck?.passed).toBe(false);
    await expect(createVideoForTopic(ctx, dup.id)).rejects.toThrow(/Originalität/);
  });
});
