import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("render topology", () => {
  it("declares a private control service and dashboard proxy wiring", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const renderYaml = readFileSync(resolve(currentDir, "../../../render.yaml"), "utf8");

    expect(renderYaml).toContain("bobbyexecute-control-staging");
    expect(renderYaml).toContain("bobbyexecute-control-production");
    expect(renderYaml).toContain("start:control");
    expect(renderYaml).toContain("RUNTIME_CONFIG_ENV");
    expect(renderYaml).toContain("CONTROL_SERVICE_HOSTNAME");
    expect(renderYaml).toContain("CONTROL_SERVICE_PORT");
    expect(renderYaml).toContain("CONTROL_TOKEN");
  });
});
