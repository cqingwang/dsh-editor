#!/usr/bin/env bash
# Prepare an isolated Commit-diff fixture without touching the real workspace.
#
# Usage:
#   scripts/prepare-editor-fixture.sh [source-home] [fixture-dir] [home-dir]
#
# The defaults reproduce the round-161/162 verification setup:
#   source home: /tmp/dsh-editor-test-home
#   fixture:     /private/tmp/dsh-editor-r162-fixture
#   test home:   /private/tmp/dsh-editor-r162-home
#
# The fixture starts with one staged hunk and one separated unstaged hunk, both
# in sample.txt. The copied home is rewritten so its only workspace points at
# the fixture. Both targets are MOVED ASIDE, never deleted, so an earlier test
# run can be inspected afterwards.
set -euo pipefail

SOURCE_HOME="${1:-/tmp/dsh-editor-test-home}"
FIXTURE="${2:-/private/tmp/dsh-editor-r162-fixture}"
TEST_HOME="${3:-/private/tmp/dsh-editor-r162-home}"

if [[ ! -d "$SOURCE_HOME/profiles/editor-test" ]]; then
  echo "missing editor-test profile under: $SOURCE_HOME" >&2
  exit 1
fi

move_aside() {
  local target="$1"
  if [[ -e "$target" ]]; then
    mv "$target" "${target}.previous-$(date +%s)"
  fi
}

move_aside "$FIXTURE"
mkdir -p "$FIXTURE"
git -C "$FIXTURE" init -q
git -C "$FIXTURE" config user.email test@example.com
git -C "$FIXTURE" config user.name Test

for n in $(seq -w 1 30); do
  printf 'line-%s\n' "$n"
done > "$FIXTURE/sample.txt"
for n in $(seq -w 1 30); do
  printf 'file-b-%s\n' "$n"
done > "$FIXTURE/second.txt"
git -C "$FIXTURE" add sample.txt second.txt
git -C "$FIXTURE" commit -qm baseline

# Hunk 1: staged, so the index differs from HEAD.
perl -pi -e 's/^line-03$/line-03 STAGED/' "$FIXTURE/sample.txt"
git -C "$FIXTURE" add sample.txt
# Hunk 2: left unstaged, separated from hunk 1 by unchanged context.
perl -pi -e 's/^line-25$/line-25 WORKTREE/' "$FIXTURE/sample.txt"
# A second path exercises history across diff targets during undo/redo.
perl -pi -e 's/^file-b-20$/file-b-20 CHANGED/' "$FIXTURE/second.txt"

move_aside "$TEST_HOME"
cp -R "$SOURCE_HOME" "$TEST_HOME"
cp "$TEST_HOME/storages/workspace.json" "$TEST_HOME/storages/workspace.json.before-fixture"

python3 - "$TEST_HOME" "$FIXTURE" <<'PY'
import json
import sys
from pathlib import Path

home = Path(sys.argv[1])
fixture = sys.argv[2]

workspace_path = home / 'storages/workspace.json'
workspace = json.loads(workspace_path.read_text())
for entry in workspace['tables']['workspaces'].values():
    entry['path'] = fixture
    entry['title'] = 'r162-fixture'
workspace_path.write_text(json.dumps(workspace, indent=2) + '\n')

for path in (home / 'storages/session_projcache/sessions').glob('session-*.json'):
    payload = json.loads(path.read_text())
    record = payload.get('record', {})
    identity = record.get('identity')
    working = record.get('rows', {}).get('workingDirectory')
    cwd = identity.get('cwd') if isinstance(identity, dict) else None
    workdir = working.get('val') if isinstance(working, dict) else None
    # The copied home can carry sessions from more than one prior fixture; a
    # literal r45-repo match leaves those behind and the browser then opens the
    # REAL workspace during what was meant to be an isolated run. Redirect every
    # recorded workspace path, while leaving unrelated system cwd values alone.
    for value in (cwd, workdir):
        if isinstance(value, str) and (
            value == '/Users/chan/Documents/project/r45-repo'
            or '/dsh-editor-r1' in value
        ):
            if isinstance(identity, dict) and identity.get('cwd') == value:
                identity['cwd'] = fixture
            if isinstance(working, dict) and working.get('val') == value:
                working['val'] = fixture
    path.write_text(json.dumps(payload, separators=(',', ':')) + '\n')
PY

printf 'fixture:   %s\n' "$FIXTURE"
printf 'test home: %s\n' "$TEST_HOME"
printf '\nNext:\n'
printf '  DSH_HOME=%q dsh --profile editor-test --host 127.0.0.1 --port 63083 --no-open\n' "$TEST_HOME"
printf '\nExpected initial state:\n'
git -C "$FIXTURE" status --short
printf '  staged line 3:  %s\n' "$(git -C "$FIXTURE" show :sample.txt | sed -n '3p')"
printf '  worktree line 25: %s\n' "$(sed -n '25p' "$FIXTURE/sample.txt")"
