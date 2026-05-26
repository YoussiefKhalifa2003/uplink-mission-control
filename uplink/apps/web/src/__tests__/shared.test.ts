import { describe, it, expect } from "vitest";
import { computeCommsScore } from "@uplink/shared";

describe("shared utilities", () => {
  it("computes comms score", () => {
    expect(computeCommsScore(5, 550, -8)).toBeGreaterThan(0);
  });
});
