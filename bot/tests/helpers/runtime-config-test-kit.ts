import { parseConfig, type Config } from "../../src/config/config-schema.js";
import { InMemoryRuntimeConfigRepository } from "../../src/persistence/runtime-config-repository.js";
import { InMemoryRuntimeConfigStore } from "../../src/storage/runtime-config-store.js";
import { RuntimeConfigManager } from "../../src/runtime/runtime-config-manager.js";

export const TEST_RUNTIME_ENV = "runtime-config-test";
export const TEST_CONTROL_TOKEN = "runtime-config-control-token";

export function createRuntimeConfigBootConfig(): Config {
  return parseConfig({
    NODE_ENV: "test",
  });
}

export async function createRuntimeConfigTestManager(options: {
  environment?: string;
  bootstrapActor?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<{
  manager: RuntimeConfigManager;
  repository: InMemoryRuntimeConfigRepository;
  store: InMemoryRuntimeConfigStore;
}> {
  const repository = new InMemoryRuntimeConfigRepository();
  const store = new InMemoryRuntimeConfigStore();
  const environment = options.environment ?? TEST_RUNTIME_ENV;
  const manager = new RuntimeConfigManager(createRuntimeConfigBootConfig(), {
    repository,
    store,
    environment,
    bootstrapActor: options.bootstrapActor ?? "test-bootstrap",
    env:
      options.env ??
      ({
        NODE_ENV: "test",
        RUNTIME_CONFIG_ENV: environment,
      } as NodeJS.ProcessEnv),
  });

  await manager.initialize();
  return { manager, repository, store };
}

export function controlHeaders(token = TEST_CONTROL_TOKEN): HeadersInit {
  return { "x-control-token": token };
}
