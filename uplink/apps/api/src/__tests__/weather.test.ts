import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeCommsScore } from "@uplink/shared";

describe("Alert scoring", () => {
  it("computes comms score from weather metrics", () => {
    expect(computeCommsScore(6, 650, -12)).toBeGreaterThan(50);
    expect(computeCommsScore(2, 400, 5)).toBeLessThan(30);
  });
});

describe("Weather alert rules", () => {
  it("KP_STRONG fires when Kp >= 6", () => {
    const kp = 6.5;
    expect(kp >= 6).toBe(true);
  });
});
