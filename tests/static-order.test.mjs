import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + (readFileSync(join(root, 'lib/client.js'), 'utf8') + '\n' + readFileSync(join(root, 'tests/fixtures/find-tool.legacy.js'), 'utf8')));

/**
 * Find every `useCallback`/`useMemo` that lists a hook declared *after* it as a dependency.
 *
 * A dependency array is evaluated while the component renders, so naming a
 * `const` that has not been initialised yet throws a ReferenceError and React
 * unmounts the whole subtree — the panel goes blank with no visible message.
 * This has happened four times in this file, so it is checked mechanically.
 * @param {string} text - full client source.
 * @returns {Array<{component: string, dependency: string, hookLine: number, declaredAt: number}>} violations.
 */
function lateDependencies(text) {
  const lines = text.split('\n');
  const starts = [];
  lines.forEach((line, index) => {
    const match = /^    function ([A-Za-z_$][\w$]*)\(/u.exec(line);
    if (match !== null) starts.push({ name: match[1], line: index });
  });
  const violations = [];
  starts.forEach((component, position) => {
    const end = position + 1 < starts.length ? starts[position + 1].line : lines.length;
    const declared = new Map();
    for (let index = component.line; index < end; index += 1) {
      const match = /^\s*(?:const|let)\s+(?:\[([A-Za-z_$][\w$]*)[^\]]*\]|([A-Za-z_$][\w$]*))\s*=\s*React\.use/u.exec(lines[index]);
      if (match === null) continue;
      for (const name of [match[1], match[2]]) if (typeof name === 'string' && !declared.has(name)) declared.set(name, index);
    }
    for (let index = component.line; index < end; index += 1) {
      if (!/React\.use(Callback|Memo)\(/u.test(lines[index])) continue;
      /* The dependency array may be formatted two ways:
           }, [a, b]);            (inline, the common shape)
           },                      (closing brace)
           [a, b],                 (array on its own line)
         Both must be seen; an earlier version only matched the inline one. */
      for (let cursor = index + 1; cursor < Math.min(index + 600, end); cursor += 1) {
        const inline = /^\s*\}, \[(.*)$/u.exec(lines[cursor]);
        let body = null;
        if (inline !== null) {
          body = inline[1];
        } else if (/^\s*\},\s*$/u.test(lines[cursor]) && /^\s*\[/u.test(lines[cursor + 1] ?? '')) {
          body = (lines[cursor + 1] ?? '').replace(/^\s*\[/u, '');
        }
        if (body === null) continue;
        /* Multi-line arrays collect until the closing bracket. */
        if (!body.includes(']')) {
          for (let follow = cursor + (inline === null ? 2 : 1); follow < Math.min(cursor + 40, end); follow += 1) {
            body += ` ${lines[follow]}`;
            if (lines[follow].includes(']')) break;
          }
        }
        const closed = /^([\s\S]*)\]\)?;?,?\s*$/u.exec(body);
        const list = (closed === null ? body : closed[1]).split(',').map((entry) => entry.trim()).filter(Boolean);
        for (const name of list) {
          const declaredAt = declared.get(name);
          if (declaredAt !== undefined && declaredAt > index) {
            violations.push({ component: component.name, dependency: name, hookLine: index + 1, declaredAt: declaredAt + 1 });
          }
        }
        break;
      }
    }
  });
  return violations;
}

test('no useCallback depends on a hook declared after it', () => {
  assert.deepEqual(lateDependencies(source), [], 'a late dependency throws during render and blanks the panel');
});

test('the order check recognises this file and can catch a regression', () => {
  /* Never let the check pass vacuously because the scan found nothing to look at. */
  const seen = new Set();
  for (const line of source.split('\n')) {
    const match = /^    function ([A-Za-z_$][\w$]*)\(/u.exec(line);
    if (match !== null) seen.add(match[1]);
  }
  for (const name of ['EditorWorkspace', 'TerminalPanel', 'CommitPanel', 'ProjectPanel', 'DiffPreview', 'QuickOpen']) {
    assert.ok(seen.has(name), `scan is broken: ${name} was not recognised`);
  }

  /* A synthetic regression must be reported, or the guard proves nothing. */
  const broken = [
    '    function Demo() {',
    '      const handler = React.useCallback(() => {',
    '        void helper();',
    '      }, [helper]);',
    '      const helper = React.useCallback(() => {}, []);',
    '      return null;',
    '    }',
  ].join('\n');
  const found = lateDependencies(broken);
  assert.equal(found.length, 1);
  assert.equal(found[0].dependency, 'helper');
  assert.equal(found[0].component, 'Demo');

  /* The corrected order passes. */
  const fixed = [
    '    function Demo() {',
    '      const helper = React.useCallback(() => {}, []);',
    '      const handler = React.useCallback(() => {',
    '        void helper();',
    '      }, [helper]);',
    '      return null;',
    '    }',
  ].join('\n');
  assert.deepEqual(lateDependencies(fixed), []);
});

test('the guard reproduces the historical dismissExternal regression', () => {
  /* Round 17 shipped this exact shape: reload listed a callback declared below it,
     React threw during render, and the whole Editor became an empty host. */
  const broken = [
    '    function EditorWorkspace() {',
    '      const reloadActiveFromDisk = React.useCallback(async () => {',
    '        return;',
    '      }, [dismissExternal, loadGit]);',
    '      const dismissExternal = React.useCallback((path) => {}, []);',
    '      return null;',
    '    }',
  ].join('\n');
  const found = lateDependencies(broken);
  assert.equal(found.length, 1);
  assert.equal(found[0].dependency, 'dismissExternal');

  const fixed = [
    '    function EditorWorkspace() {',
    '      const dismissExternal = React.useCallback((path) => {}, []);',
    '      const reloadActiveFromDisk = React.useCallback(async () => {',
    '        return;',
    '      }, [dismissExternal, loadGit]);',
    '      return null;',
    '    }',
  ].join('\n');
  assert.deepEqual(lateDependencies(fixed), []);
});

test('the scan sees a dependency array that spans several lines', () => {
  const broken = [
    '    function Demo() {',
    '      const handler = React.useCallback(() => {',
    '        void helper();',
    '      }, [',
    '        helper,',
    '        other,',
    '      ]);',
    '      const helper = React.useCallback(() => {}, []);',
    '      const other = React.useCallback(() => {}, []);',
    '      return null;',
    '    }',
  ].join('\n');
  const found = lateDependencies(broken).map((entry) => entry.dependency).sort();
  assert.deepEqual(found, ['helper', 'other']);
});
