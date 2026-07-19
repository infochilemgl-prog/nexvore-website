import { describe, expect, it } from "vitest";
import { triageMaintenanceIssue, containsDangerousInstruction } from "../services/maintenance/triage";

describe("triageMaintenanceIssue", () => {
  it("classifies a gas smell as CRITICAL regardless of politeness", () => {
    expect(triageMaintenanceIssue("Hola, disculpen la molestia, huelo a gas en la cocina").urgency).toBe("CRITICAL");
  });

  it("classifies total power outage as HIGH", () => {
    expect(triageMaintenanceIssue("no hay electricidad en toda la cabana").urgency).toBe("HIGH");
  });

  it("classifies wifi issues as MEDIUM", () => {
    expect(triageMaintenanceIssue("el wifi no funciona").urgency).toBe("MEDIUM");
  });

  it("classifies a cosmetic issue as LOW", () => {
    expect(triageMaintenanceIssue("hay una mancha cosmetica en la pared").urgency).toBe("LOW");
  });

  it("deterministic rules win even with reassuring guest language", () => {
    // A guest downplaying a gas smell must still trigger CRITICAL.
    expect(triageMaintenanceIssue("no es nada grave pero siento olor a gas").urgency).toBe("CRITICAL");
  });
});

describe("containsDangerousInstruction", () => {
  it("flags electrical panel instructions", () => {
    expect(containsDangerousInstruction("abre el tablero electrico y revisa los fusibles")).toBe(true);
  });
  it("does not flag safe wifi instructions", () => {
    expect(containsDangerousInstruction("reinicia el router 10 segundos")).toBe(false);
  });
});
