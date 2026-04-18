#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestPath = path.join(root, '.codex', 'shared-core-consumer.json');

function run() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sharedCoreRoot = path.resolve(root, manifest.sharedCoreSource);
  const output = execFileSync('node', [path.join(sharedCoreRoot, 'scripts', 'tools', 'validate-consumer-linkage.mjs'), '--consumer', root], { cwd: sharedCoreRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(output.trim());
}

run();
