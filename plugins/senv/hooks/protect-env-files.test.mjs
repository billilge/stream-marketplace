import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { decide } from './protect-env-files.mjs';

/** senv.json이 있는 apps/web과 senv.json이 없는 저장소 루트 */
async function repo(config = { project: 'web' }) {
  const root = await mkdtemp(join(tmpdir(), 'senv-hook-'));
  const web = join(root, 'apps', 'web');
  await mkdir(web, { recursive: true });
  await writeFile(join(web, 'senv.json'), JSON.stringify(config));
  return { root, web };
}

const read = (cwd, file_path) => ({ cwd, tool_name: 'Read', tool_input: { file_path } });
const bash = (cwd, command) => ({ cwd, tool_name: 'Bash', tool_input: { command } });

describe('파일 도구 (Read·Edit·Write·Grep)', () => {
  it('senv 프로젝트의 .env 파일은 막고, senv 명령을 안내한다', async () => {
    const { web } = await repo();
    for (const name of ['.env', '.env.local', '.env.local.properties', '.env.production']) {
      const result = decide(read(web, join(web, name)));
      assert.equal(result.block, true, name);
      assert.match(result.reason, /senv list/);
    }
  });

  it('senv.json의 output은 이름이 .env가 아니어도 막는다', async () => {
    const { web } = await repo({ project: 'web', output: 'config/local.properties' });
    assert.equal(decide(read(web, 'config/local.properties')).block, true);
  });

  it('예시 파일(.env.example 등)과 일반 파일은 막지 않는다', async () => {
    const { web } = await repo();
    for (const name of ['.env.example', '.env.local.sample', '.env.template', 'src/main.ts']) {
      assert.equal(decide(read(web, name)).block, false, name);
    }
  });

  it('senv.json이 없는 곳의 .env는 막지 않는다', async () => {
    const { root } = await repo();
    assert.equal(decide(read(root, join(root, '.env.local'))).block, false);
  });

  it('Edit·Write·Grep도 같은 규칙이고, 다른 도구는 보지 않는다', async () => {
    const { web } = await repo();
    const file = join(web, '.env.local');
    assert.equal(decide({ cwd: web, tool_name: 'Edit', tool_input: { file_path: file } }).block, true);
    assert.equal(decide({ cwd: web, tool_name: 'Write', tool_input: { file_path: file } }).block, true);
    assert.equal(decide({ cwd: web, tool_name: 'Grep', tool_input: { path: file } }).block, true);
    assert.equal(decide({ cwd: web, tool_name: 'Glob', tool_input: { pattern: '.env*' } }).block, false);
  });
});

describe('Bash', () => {
  it('값 파일을 가리키는 명령은 막는다', async () => {
    const { web } = await repo();
    for (const command of [
      'cat .env.local',
      'grep API_URL .env.local',
      'source .env.local',
      '. ./.env.local',
      'head -n 3 "./.env.local"',
      'echo x > .env.local',
      'cp .env.local /tmp/x',
      'pnpm build && cat .env.local | base64',
    ]) {
      assert.equal(decide(bash(web, command)).block, true, command);
    }
  });

  it('cd로 옮긴 뒤의 상대 경로도 따라간다', async () => {
    const { root } = await repo();
    assert.equal(decide(bash(root, 'cd apps/web && cat .env.local')).block, true);
  });

  it('senv 명령과 파일 내용을 읽지 않는 명령(ls·stat·test·chmod)은 막지 않는다', async () => {
    const { web } = await repo();
    for (const command of [
      'senv pull --output .env.local',
      'senv diff --file=.env.local',
      'ls -la .env.local',
      'stat .env.local',
      'test -f .env.local && echo ok',
      'chmod 600 .env.local',
      'cat .env.example',
      'pnpm test',
    ]) {
      assert.equal(decide(bash(web, command)).block, false, command);
    }
  });
});

describe('입력', () => {
  it('모양이 다른 입력은 막지 않는다 (훅이 세션을 망가뜨리지 않는다)', () => {
    assert.equal(decide({}).block, false);
    assert.equal(decide({ tool_name: 'Read', tool_input: {} }).block, false);
    assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 42 } }).block, false);
  });
});

describe('훅 실행 (Claude Code가 부르는 방식)', () => {
  const script = fileURLToPath(new URL('./protect-env-files.mjs', import.meta.url));
  const run = (input) => spawnSync(process.execPath, [script], { input: JSON.stringify(input), encoding: 'utf8' });

  it('막을 때는 종료 코드 2와 이유(stderr)', async () => {
    const { web } = await repo();
    const result = run(read(web, '.env.local'));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /senv list/);
  });

  it('허용할 때와 JSON이 아닐 때는 종료 코드 0', async () => {
    const { web } = await repo();
    assert.equal(run(read(web, 'src/main.ts')).status, 0);
    assert.equal(spawnSync(process.execPath, [script], { input: 'not json' }).status, 0);
  });
});
