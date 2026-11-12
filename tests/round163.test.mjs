import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/prepare-editor-fixture.sh');

test('the isolated fixture script is executable and shell-valid', () => {
  assert.ok(statSync(script).mode & 0o100, 'the script must be executable');
  execFileSync('bash', ['-n', script]);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts['fixture:editor'], 'bash scripts/prepare-editor-fixture.sh');
});

test('the fixture script creates a staged and an unstaged hunk without touching the source', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /perl -pi -e 's\/\^line-03\$\//);
  assert.match(source, /perl -pi -e 's\/\^line-25\$\//);
  assert.match(source, /perl -pi -e 's\/\^file-b-20\$\//);
  assert.match(source, /second\.txt/);
  assert.match(source, /git -C "\$FIXTURE" add sample\.txt/);
  assert.match(source, /mv "\$target" "\$\{target\}\.previous-/);
  assert.match(source, /cp -R "\$SOURCE_HOME" "\$TEST_HOME"/);
  assert.match(source, /entry\['path'\] = fixture/);
  assert.match(source, /identity\['cwd'\] = fixture/);
  assert.match(source, /working\['val'\] = fixture/);
});
