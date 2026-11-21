import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptModule } from './ts-source.mjs';

const sessionsSource = await readFile(
  new URL('../src/client/components/search/use-find-tool-sessions.ts', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const componentSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const stylesSource = await readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8');

test('Find sessions preserve independent searches and close the active tab into its neighbor', () => {
  const { findToolSessionReducer } = loadTypeScriptModule(sessionsSource, ['findToolSessionReducer']);
  let state = { sessions: [], activeId: null };
  state = findToolSessionReducer(state, {
    type: 'set',
    id: 'search-1',
    updater: () => ({ query: 'alpha', matches: ['a'] }),
  });
  state = findToolSessionReducer(state, {
    type: 'open',
    id: 'search-2',
    state: { query: 'beta', matches: ['b'] },
  });

  assert.equal(state.activeId, 'search-2');
  assert.deepEqual(
    state.sessions.map((session) => session.state.query),
    ['alpha', 'beta'],
  );

  state = findToolSessionReducer(state, { type: 'select', id: 'search-1' });
  assert.deepEqual(state.sessions.find((session) => session.id === 'search-1').state.matches, ['a']);

  state = findToolSessionReducer(state, { type: 'close', id: 'search-1' });
  assert.equal(state.activeId, 'search-2');
  assert.deepEqual(
    state.sessions.map((session) => session.state.query),
    ['beta'],
  );

  state = findToolSessionReducer(state, { type: 'close', id: 'search-2' });
  assert.deepEqual(state, { sessions: [], activeId: null });
});

test('Find dock renders tabs, shared filters, and minimize in one read-only non-wrapping header', () => {
  const headerStart = componentSource.indexOf('data-dsh-find-dock-header');
  const headerEnd = componentSource.indexOf('data-dsh-find-scope=', headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart);
  const header = componentSource.slice(headerStart, headerEnd);
  const tabList = header.indexOf("role='tablist'");
  const count = header.indexOf("className='dsh-editor-find-tool-count'");
  const filters = header.indexOf('{searchFilterControls}');
  const fileMask = header.indexOf('{fileMaskControl}');
  const minimize = header.indexOf("label={t(minimized ? 'editor.findToolRestore' : 'editor.findToolMinimize')}");
  for (const position of [tabList, count, filters, fileMask, minimize]) assert.ok(position >= 0);
  assert.ok(tabList < count && count < filters && filters < fileMask);
  assert.ok(fileMask < minimize);
  assert.match(componentSource, /const searchFilterControls = \([\s\S]*?icon='matchCase'[\s\S]*?icon='wholeWords'/u);
  assert.match(componentSource, /data-dsh-find-file-mask=''/u);

  assert.doesNotMatch(header, /role='combobox'|data-dsh-find-dock-query/u);
  assert.doesNotMatch(header, /data-dsh-find-dock-scope|findScopeModeGroup/u);
  assert.match(header, /onCloseFindToolTab/);
  assert.doesNotMatch(header, /onNewFindToolTab|findToolNewSearchTab/u);
  assert.match(
    componentSource,
    /tab\?\.scrollIntoView\?\.\(\{ block: 'nearest', inline: 'nearest' \}\);\s+tab\?\.focus\?\.\(\{ preventScroll: true \}\);/u,
  );
  assert.match(stylesSource, /findToolDockHeader: \{[\s\S]*?flexWrap: 'nowrap'/u);
  assert.match(
    stylesSource,
    /findToolDockHeader: \{[\s\S]*?background: 'var\(--dsw-alias-interactive-bg-hover-solid\)'/u,
  );
  assert.match(stylesSource, /findToolDockTabList: \{[\s\S]*?flex: '1 1 auto'[\s\S]*?maxWidth: 'none'/u);
  assert.match(stylesSource, /findToolDockTabLabel: \{[\s\S]*?maxWidth: 120,[\s\S]*?textOverflow: 'ellipsis'/u);
  assert.match(stylesSource, /findToolDockScroll: \{[\s\S]*?overflowX: 'auto'/u);
  assert.match(stylesSource, /findToolDockFixedTools: \{[\s\S]*?flex: '0 0 auto'/u);
});

test('Workspace owns the Find session set instead of replacing the current search on every open', () => {
  assert.match(
    workspaceSource,
    /const findToolSessions = useFindToolSessions<FindToolState>\(\);\s+const findTool = findToolSessions\.active;\s+const setFindTool = findToolSessions\.setActive;/u,
  );
  assert.match(workspaceSource, /findToolSessions\.open\(nextFindTool\)/u);
  assert.match(workspaceSource, /tabs=\{findToolSessions\.sessions\}/u);
  assert.match(workspaceSource, /activeTabId=\{findToolSessions\.activeId\}/u);
});

test('New dock searches append while a popup draft can close back to the existing dock', () => {
  assert.match(
    workspaceSource,
    /if \(surface === 'dock' \|\| findToolSessionsRef\.current\.active\?\.surface === 'dock'\)\s+findToolSessions\.open\(nextFindTool\)/u,
  );
  assert.match(
    workspaceSource,
    /if \(findTool\?\.surface === 'dock'\)\s+return openFindTool\(selectedQuery, 'find', null, 'query', 'popup', true\);/u,
  );
  assert.match(workspaceSource, /if \(closeFindPopupSession\(findToolSessionsRef\.current\)\) return;/u);
});
