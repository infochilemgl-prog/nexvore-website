import { describe, expect, it } from "vitest";
import { evaluatePermission } from "../config/permissions";

describe("evaluatePermission", () => {
  it("always allows LEVEL_0 reads", () => {
    const d = evaluatePermission("read_reservation", { actorType: "AGENT" });
    expect(d.allowed).toBe(true);
    expect(d.requiresApproval).toBe(false);
  });

  it("LEVEL_2 actions always require approval, never auto-execute", () => {
    const d = evaluatePermission("request_contractor_quote", { actorType: "AGENT" });
    expect(d.requiresApproval).toBe(true);
  });

  it("LEVEL_3 refund is blocked entirely when ENABLE_FINANCIAL_ACTIONS is false (default)", () => {
    const d = evaluatePermission("issue_refund", { actorType: "AGENT" });
    expect(d.allowed).toBe(false);
  });

  it("LEVEL_3 share_access_code is blocked when ENABLE_DOOR_CODE_SHARING is false (default)", () => {
    const d = evaluatePermission("share_access_code", { actorType: "AGENT" });
    expect(d.allowed).toBe(false);
  });
});
