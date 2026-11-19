import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/project/workspace-directory-model.ts', import.meta.url),
  'utf8',
);
const helpers = loadTypeScriptModule(source, [
  'directoryBaseName',
  'directoryPathIsWithin',
  'directoryPathParent',
  'flattenDirectoryTreeRows',
  'isDesktopHarnessSurface',
  'isDirectoryBrowseUnavailable',
  'normalizeHostDirectoryListing',
  'workspaceDirectoryAutocompleteQuery',
  'workspaceDirectorySuggestions',
]);

test('the runtime surface detection trusts the host platform marker', () => {
  assert.equal(
    helpers.isDesktopHarnessSurface({
      hasAttribute(name) {
        return name === 'data-platform';
      },
    }),
    true,
  );
  assert.equal(
    helpers.isDesktopHarnessSurface({
      hasAttribute() {
        return false;
      },
    }),
    false,
  );
  assert.equal(helpers.isDesktopHarnessSurface(null), false);
});

test('host directory listings are normalized to directories only', () => {
  const listing = helpers.normalizeHostDirectoryListing(
    {
      path: '/workspace',
      home: '/Users/test',
      entries: [
        { name: 'src', path: '/workspace/src' },
        { name: 'README.md', path: '/workspace/README.md', kind: 'file' },
        { name: '.git', path: '/workspace/.git', hidden: true },
      ],
    },
    '/fallback',
  );

  assert.equal(listing.path, '/workspace');
  assert.equal(listing.home, '/Users/test');
  assert.deepEqual(listing.entries, [
    { name: '.git', path: '/workspace/.git', hidden: true },
    { name: 'src', path: '/workspace/src', hidden: false },
  ]);
});

test('only the Host native-picker capability refusal triggers the private bridge fallback', () => {
  assert.equal(
    helpers.isDirectoryBrowseUnavailable(
      new Error('directory browse failed: directory-picker/unavailable: native only'),
    ),
    true,
  );
  assert.equal(helpers.isDirectoryBrowseUnavailable(new Error('permission denied')), false);
  assert.equal(helpers.isDirectoryBrowseUnavailable(null), false);
});

test('directory path helpers resolve parents, containment and completion queries', () => {
  assert.equal(helpers.directoryPathParent('/Users/chan/src'), '/Users/chan');
  assert.equal(helpers.directoryPathParent('/Users'), '/');
  assert.equal(helpers.directoryPathParent('/'), '/');
  assert.equal(helpers.directoryPathIsWithin('/Users/chan', '/Users/chan/src'), true);
  assert.equal(helpers.directoryPathIsWithin('/Users/chan', '/Users/chan2'), false);
  assert.deepEqual(helpers.workspaceDirectoryAutocompleteQuery('~/Doc', '/Users/chan'), {
    requestPath: '/Users/chan',
    prefix: 'Doc',
  });
  assert.deepEqual(helpers.workspaceDirectoryAutocompleteQuery('~/Documents/', '/Users/chan'), {
    requestPath: '/Users/chan/Documents',
    prefix: '',
  });
  assert.equal(helpers.workspaceDirectoryAutocompleteQuery('Doc', '/Users/chan'), null);
  assert.equal(helpers.workspaceDirectoryAutocompleteQuery('./Doc', '/Users/chan'), null);
  assert.equal(helpers.workspaceDirectoryAutocompleteQuery('../Doc', '/Users/chan'), null);
  assert.deepEqual(helpers.workspaceDirectoryAutocompleteQuery('/Users/chan/Doc', '/Users/chan'), {
    requestPath: '/Users/chan',
    prefix: 'Doc',
  });
});

test('directory suggestions filter by prefix, visibility and display home as ~', () => {
  const suggestions = helpers.workspaceDirectorySuggestions(
    [
      { name: 'Documents', path: '/Users/chan/Documents', hidden: false },
      { name: 'Downloads', path: '/Users/chan/Downloads', hidden: false },
      { name: '.docker', path: '/Users/chan/.docker', hidden: true },
    ],
    'Do',
    '/Users/chan',
    false,
  );
  assert.deepEqual(
    suggestions.map((entry) => entry.displayPath),
    ['~/Documents', '~/Downloads'],
  );
  assert.equal(
    helpers.workspaceDirectorySuggestions(
      [{ name: '.docker', path: '/Users/chan/.docker', hidden: true }],
      '.d',
      '/Users/chan',
      false,
    ).length,
    1,
  );
});

test('directory rows expose the same hierarchy contract consumed by Project', () => {
  const rows = helpers.flattenDirectoryTreeRows({
    rootPath: '/workspace',
    rootName: 'workspace',
    expanded: new Set(['/workspace', '/workspace/src']),
    showHidden: false,
    childrenByPath: new Map([
      [
        '/workspace',
        [
          { name: 'src', path: '/workspace/src', hidden: false },
          { name: '.git', path: '/workspace/.git', hidden: true },
        ],
      ],
      ['/workspace/src', [{ name: 'project', path: '/workspace/src/project', hidden: false }]],
    ]),
  });

  assert.deepEqual(
    rows.map((row) => ({
      path: row.path,
      name: row.name,
      depth: row.depth,
      kind: row.kind,
      root: row.root === true,
    })),
    [
      { path: '/workspace', name: 'workspace', depth: 0, kind: 'directory', root: true },
      { path: '/workspace/src', name: 'src', depth: 1, kind: 'directory', root: false },
      { path: '/workspace/src/project', name: 'project', depth: 2, kind: 'directory', root: false },
    ],
  );
});
