#!/usr/bin/env node
/**
 * PreToolUse 훅: senv가 관리하는 값 파일을 Claude가 읽거나 고치지 못하게 막는다.
 *
 * 막는 파일: senv.json이 있는 폴더(또는 그 아래)의 `.env`, `.env.*` 파일과 senv.json의 output.
 * `.env.example`처럼 예시용 이름은 막지 않는다. senv.json이 없는 저장소에는 영향이 없다.
 *
 * Bash는 명령을 `&&`, `||`, `;`, `|` 단위로 나눠, 값 파일을 가리키는 부분의 첫 단어가
 * 내용을 읽지 않는 명령(senv, ls, stat, test, chmod)이 아니면 막는다. 완벽한 해석은 아니므로
 * 저장소의 .claude/settings.json에 permissions.deny도 함께 둔다.
 *
 * 막을 때는 종료 코드 2로 끝내고 이유를 stderr에 쓴다. Claude Code는 그 이유를 Claude에게 보여준다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_FILE = 'senv.json';
const DEFAULT_OUTPUT = { dotenv: '.env.local', properties: '.env.local.properties' };
const EXAMPLE_PARTS = new Set(['example', 'sample', 'template', 'dist', 'defaults']);
const FILE_TOOLS = { Read: 'file_path', Edit: 'file_path', MultiEdit: 'file_path', Write: 'file_path', Grep: 'path' };
/** 파일 내용을 읽지 않는 명령. 첫 단어가 이것이면 값 파일 이름이 있어도 막지 않는다 */
const SAFE_COMMANDS = new Set(['senv', 'ls', 'stat', 'test', '[', 'chmod']);

const reason = (file) =>
  [
    `senv: ${file}은(는) senv가 관리하는 값 파일이라 읽거나 고치지 않습니다.`,
    '키 목록은 `senv list`(값 가림), 서버와의 차이는 `senv diff`(키 이름만), 실행은 `senv run -- <명령>`을 쓰세요.',
    '값을 바꿔야 하면 사용자에게 확인을 받은 뒤 `senv set`을 쓰세요.',
  ].join('\n');

/** @returns {{ block: boolean, reason?: string }} */
export function decide(input) {
  try {
    const cwd = typeof input?.cwd === 'string' ? input.cwd : process.cwd();
    const tool = input?.tool_name;
    const toolInput = input?.tool_input ?? {};

    const field = FILE_TOOLS[tool];
    if (field) {
      const file = toolInput[field];
      if (typeof file === 'string' && isProtected(resolve(cwd, file))) {
        return { block: true, reason: reason(file) };
      }
      return { block: false };
    }

    if (tool === 'Bash' && typeof toolInput.command === 'string') {
      const file = protectedFileInCommand(toolInput.command, cwd);
      if (file) return { block: true, reason: reason(file) };
    }
  } catch {
    // 훅의 오류로 세션을 막지 않는다
  }
  return { block: false };
}

function isProtected(path) {
  const root = findSenvRoot(dirname(path));
  if (!root) return false;
  if (path === configuredOutput(root)) return true;
  return isEnvFileName(basename(path));
}

/** `.env`, `.env.local`, `.env.local.properties`는 값 파일, `.env.example` 같은 이름은 예시 */
function isEnvFileName(name) {
  if (name === '.env') return true;
  if (!name.startsWith('.env.')) return false;
  return !name
    .slice('.env.'.length)
    .split('.')
    .some((part) => EXAMPLE_PARTS.has(part));
}

function findSenvRoot(dir) {
  for (let current = dir; ; current = dirname(current)) {
    if (existsSync(resolve(current, CONFIG_FILE))) return current;
    if (dirname(current) === current) return null;
  }
}

function configuredOutput(root) {
  try {
    const config = JSON.parse(readFileSync(resolve(root, CONFIG_FILE), 'utf8'));
    const output = config.output ?? DEFAULT_OUTPUT[config.format] ?? DEFAULT_OUTPUT.dotenv;
    return typeof output === 'string' && !isAbsolute(output) ? resolve(root, output) : null;
  } catch {
    return null;
  }
}

function protectedFileInCommand(command, startDir) {
  let cwd = startDir;
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean).map(unquote);
    const [first, second] = words;
    if (!first) continue;
    if (first === 'cd') {
      if (second) cwd = resolve(cwd, second);
      continue;
    }
    if (SAFE_COMMANDS.has(first)) continue;
    for (const word of words.slice(1)) {
      // `--file=.env.local`, `>.env.local`, `<.env.local`
      const candidate = word.includes('=') ? word.slice(word.indexOf('=') + 1) : word;
      const path = candidate.replace(/^[<>]+/, '');
      if (path && !path.startsWith('-') && isProtected(resolve(cwd, path))) return path;
    }
  }
  return null;
}

function unquote(word) {
  return word.replace(/^['"]|['"]$/g, '');
}

async function main() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    return;
  }
  const result = decide(input);
  if (result.block) {
    process.stderr.write(`${result.reason}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
