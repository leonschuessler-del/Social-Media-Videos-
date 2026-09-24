import { describe, expect, it } from "vitest";
import { parseReachCsv } from "./youtube.ts";

describe("parseReachCsv", () => {
  it("aggregiert Impressions und gewichtet CTR je Video und Tag", () => {
    const csv = "date,channel_id,video_id,traffic_source_type,video_thumbnail_impressions,video_thumbnail_impressions_ctr\n20260920,UC1,vidA,1,1000,0.05\n20260920,UC1,vidA,3,500,0.02\n20260920,UC1,vidB,1,200,0.1\n";
    const rows = parseReachCsv(csv);
    const a = rows.find((r) => r.videoId === "vidA")!;
    expect(a.impressions).toBe(1500);
    expect(a.ctr).toBeCloseTo((50 + 10) / 1500, 6);
    expect(rows.find((r) => r.videoId === "vidB")!.impressions).toBe(200);
  });
  it("leere/unerwartete CSV => []", () => {
    expect(parseReachCsv("")).toEqual([]);
    expect(parseReachCsv("foo,bar\n1,2")).toEqual([]);
  });
});
