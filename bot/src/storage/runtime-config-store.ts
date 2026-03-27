import { createClient, type RedisClientType } from "redis";

export interface RuntimeSignalState {
  reloadNonce: number;
  paused: boolean;
  pauseScope?: "soft" | "hard";
  pauseReason?: string;
  killSwitch: boolean;
  killSwitchReason?: string;
  lastAppliedVersionId?: string;
  lastValidVersionId?: string;
  pendingApply: boolean;
  pendingReason?: string;
}

export interface RuntimeConfigStore {
  kind: "redis" | "memory";
  load(): Promise<RuntimeSignalState | null>;
  save(state: RuntimeSignalState): Promise<void>;
  loadSync(): RuntimeSignalState | null;
  saveSync(state: RuntimeSignalState): void;
  readState?(): Promise<RuntimeSignalState | null>;
  writeState?(state: RuntimeSignalState): Promise<void>;
}

function cloneState(state: RuntimeSignalState): RuntimeSignalState {
  return JSON.parse(JSON.stringify(state)) as RuntimeSignalState;
}

export class InMemoryRuntimeConfigStore implements RuntimeConfigStore {
  kind = "memory" as const;

  private state: RuntimeSignalState = {
    reloadNonce: 0,
    paused: false,
    killSwitch: false,
    pendingApply: false,
  };

  async load(): Promise<RuntimeSignalState | null> {
    return this.readState();
  }

  async save(state: RuntimeSignalState): Promise<void> {
    await this.writeState(state);
  }

  loadSync(): RuntimeSignalState | null {
    return cloneState(this.state);
  }

  saveSync(state: RuntimeSignalState): void {
    this.state = cloneState(state);
  }

  async readState(): Promise<RuntimeSignalState | null> {
    return cloneState(this.state);
  }

  async writeState(state: RuntimeSignalState): Promise<void> {
    this.state = cloneState(state);
  }
}

export class RedisRuntimeConfigStore implements RuntimeConfigStore {
  kind = "redis" as const;

  private client: RedisClientType;
  private ready = false;

  constructor(redisUrl: string, private readonly keyPrefix = "runtime") {
    this.client = createClient({ url: redisUrl });
  }

  private key(name: string): string {
    return `${this.keyPrefix}:${name}`;
  }

  private async ensureReady(): Promise<void> {
    if (this.ready) {
      return;
    }
    if (!this.client.isOpen) {
      await this.client.connect();
    }
    this.ready = true;
  }

  private serialize(state: RuntimeSignalState): string {
    return JSON.stringify(state);
  }

  private deserialize(raw: string | null): RuntimeSignalState | null {
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as RuntimeSignalState;
  }

  async load(): Promise<RuntimeSignalState | null> {
    return this.readState();
  }

  async save(state: RuntimeSignalState): Promise<void> {
    await this.writeState(state);
  }

  loadSync(): RuntimeSignalState | null {
    throw new Error("RedisRuntimeConfigStore.loadSync() is not available; use load()");
  }

  saveSync(_state: RuntimeSignalState): void {
    throw new Error("RedisRuntimeConfigStore.saveSync() is not available; use save()");
  }

  async readState(): Promise<RuntimeSignalState | null> {
    await this.ensureReady();
    const [rawState, rawReloadNonce, rawPaused, rawKillSwitch, rawLastAppliedVersionId, rawLastValidVersionId, rawPendingApply] =
      await this.client.mGet([
        this.key("state"),
        this.key("reload_nonce"),
        this.key("pause"),
        this.key("kill_switch"),
        this.key("last_applied_version"),
        this.key("last_valid_version"),
        this.key("pending_apply"),
      ]);

    if (rawState) {
      return this.deserialize(rawState as string);
    }

    if (rawReloadNonce == null && rawPaused == null && rawKillSwitch == null && rawLastAppliedVersionId == null && rawLastValidVersionId == null && rawPendingApply == null) {
      return null;
    }

    return {
      reloadNonce: Number(rawReloadNonce ?? 0),
      paused: String(rawPaused ?? "false") === "true",
      killSwitch: String(rawKillSwitch ?? "false") === "true",
      lastAppliedVersionId: rawLastAppliedVersionId ?? undefined,
      lastValidVersionId: rawLastValidVersionId ?? undefined,
      pendingApply: String(rawPendingApply ?? "false") === "true",
    };
  }

  async writeState(state: RuntimeSignalState): Promise<void> {
    await this.ensureReady();
    const pipeline = this.client.multi();
    pipeline.set(this.key("state"), this.serialize(state));
    pipeline.set(this.key("reload_nonce"), String(state.reloadNonce));
    pipeline.set(this.key("pause"), String(state.paused));
    pipeline.set(this.key("kill_switch"), String(state.killSwitch));
    if (state.lastAppliedVersionId) {
      pipeline.set(this.key("last_applied_version"), state.lastAppliedVersionId);
    } else {
      pipeline.del(this.key("last_applied_version"));
    }
    if (state.lastValidVersionId) {
      pipeline.set(this.key("last_valid_version"), state.lastValidVersionId);
    } else {
      pipeline.del(this.key("last_valid_version"));
    }
    pipeline.set(this.key("pending_apply"), String(state.pendingApply));
    if (state.pauseScope) {
      pipeline.set(this.key("pause_scope"), state.pauseScope);
    } else {
      pipeline.del(this.key("pause_scope"));
    }
    if (state.pauseReason) {
      pipeline.set(this.key("pause_reason"), state.pauseReason);
    } else {
      pipeline.del(this.key("pause_reason"));
    }
    if (state.killSwitchReason) {
      pipeline.set(this.key("kill_switch_reason"), state.killSwitchReason);
    } else {
      pipeline.del(this.key("kill_switch_reason"));
    }
    if (state.pendingReason) {
      pipeline.set(this.key("pending_reason"), state.pendingReason);
    } else {
      pipeline.del(this.key("pending_reason"));
    }
    await pipeline.exec();
  }
}

export async function createRuntimeConfigStore(redisUrl?: string): Promise<RuntimeConfigStore> {
  if (!redisUrl || redisUrl.trim() === "") {
    return new InMemoryRuntimeConfigStore();
  }

  const store = new RedisRuntimeConfigStore(redisUrl);
  await store.readState().catch((error) => {
    throw new Error(`Failed to connect runtime config store: ${error instanceof Error ? error.message : String(error)}`);
  });
  return store;
}
