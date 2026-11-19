import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const picker = await readFile(new URL('src/client/components/project/WorkspaceDirectoryPicker.tsx', root), 'utf8');
const locales = await readFile(new URL('src/client/locales.ts', root), 'utf8');

test('a missing Host directory route becomes actionable restart guidance', () => {
  assert.match(picker, /message\.includes\('workspace directory API HTTP 404'\)/u);
  assert.match(picker, /t\('editor\.workspaceDirectoryApiUnavailable'\)/u);
  assert.match(locales, /workspaceDirectoryApiUnavailable: '目录服务尚未加载，请重启 Harness 后重试'/u);
  assert.match(
    locales,
    /workspaceDirectoryApiUnavailable: 'The directory service is not loaded yet\. Restart Harness and try again\.'/u,
  );
});
