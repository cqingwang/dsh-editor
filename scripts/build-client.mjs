#!/usr/bin/env node
/**
 * Build the single DSH browser client artifact from business modules.
 *
 * DSH's lazy-CJS browser contract requires one `lib/client.js` file. Source is
 * kept in typed `src/client/*.ts` and `src/client/*.tsx` modules; every part executes inside
 * the same factory scope, so shared closures and React hooks remain intact
 * without a runtime loader. The explicit manifest below is the execution
 * order; filenames stay semantic instead of carrying numeric ordering prefixes.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformAsync } from '@babel/core';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = join(root, 'src', 'client');
const outputPath = join(root, 'lib', 'client.js');
const files = [
  'foundation.ts',
  'locales.ts',
  'code-navigation.ts',
  'inline-styles.ts',
  'editor-core.ts',
  'project.ts',
  'diff.ts',
  'commit.ts',
  'find-tool.ts',
  'terminal.ts',
  'editor-workspace.tsx',
  'injected-css.ts',
  'controller.ts',
];
const uiExports = [
  'Icon',
  'ActivityStripe',
  'ToolbarButton',
  'TreeMessage',
  'panelToolbarFit',
  'PanelToolbar',
  'toolbarActionActive',
  'DiffViewModeControl',
  'selectCompactActions',
  'groupCompactActions',
  'CompactActionBar',
  'PathLabel',
  'splitPathLabel',
  'LineCounts',
  'ContextMenu',
  'submenuKeyAction',
  'menuStep',
  'submenuGeometry',
  'submenuSide',
  'EntryIcon',
  'fileBadge',
  'GitStatusBadge',
  'gitStatusInfo',
  'diffSideLabels',
  'diffViewStateKey',
  'transferDiffLine',
  'canCompareWithHead',
  'badgeFor',
  'allPathsUnversioned',
  'pathsScheduledForRemoval',
  'selectionStateOf',
  'subtotalOf',
  'commitMetrics',
];
const availableFiles = readdirSync(partsDir)
  .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
  .sort((left, right) => left.localeCompare(right, 'en'));
const missingFiles = files.filter((name) => !availableFiles.includes(name));
const unlistedFiles = availableFiles.filter((name) => !files.includes(name));
const legacyJavaScriptFiles = readdirSync(partsDir, { recursive: true })
  .filter((name) => typeof name === 'string' && (name.endsWith('.js') || name.endsWith('.jsx')))
  .sort((left, right) => left.localeCompare(right, 'en'));

if (missingFiles.length > 0) {
  console.error(`build-client: manifest references missing modules: ${missingFiles.join(', ')}`);
  process.exit(1);
}

if (unlistedFiles.length > 0) {
  console.error(`build-client: unlisted modules in src/client: ${unlistedFiles.join(', ')}`);
  process.exit(1);
}

if (legacyJavaScriptFiles.length > 0) {
  console.error(
    `build-client: legacy JavaScript modules are retired; migrate them to TypeScript: ${legacyJavaScriptFiles.join(', ')}`,
  );
  process.exit(1);
}

const header = `window.__ModuleLoader__.load({
  id: 'dsh-editor',
  factory: (require) => {
`;

async function moduleSourceForBuild(name) {
  if (!name.endsWith('.ts') && !name.endsWith('.tsx')) {
    throw new Error(`build-client: expected a TypeScript module, received ${name}`);
  }
  const source = readFileSync(join(partsDir, name), 'utf8');
  const result = await transformAsync(source, {
    filename: name,
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: name.endsWith('.tsx'), allExtensions: true }],
      ...(name.endsWith('.tsx') ? ['@babel/plugin-transform-react-jsx'] : []),
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  });
  const compiled = (result.code ?? '')
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/^export\s+(?=(?:(?:async\s+)?function|const|let|var|class)\b)/gm, '')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
    .replace(/export\s*\{\s*\};\s*$/gm, '')
    .trimEnd();
  return compiled
    .split('\n')
    .map((line) => (line === '' ? '' : `    ${line}`))
    .join('\n');
}

const body = (
  await Promise.all(
    files.map(
      async (name) =>
        `\n    /* ─────────────────────── ${name} ─────────────────────── */\n${await moduleSourceForBuild(name)}\n`,
    ),
  )
).join('');

const editorTabModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'editor-tab-model.ts'), 'utf8'),
  {
    filename: 'editor-tab-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorTabModelBody = (editorTabModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (editorTabModelBody === '') {
  console.error('build-client: Babel produced an empty editor tab model');
  process.exit(1);
}
const indentedEditorTabModel = editorTabModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorTabModelModule = `\n    /* ─────────────────────── components/editor/editor-tab-model.ts ─────────────────────── */\n${indentedEditorTabModel}\n`;

const editorStyleModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'editor-style-model.ts'), 'utf8'),
  {
    filename: 'editor-style-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorStyleModelBody = (editorStyleModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (editorStyleModelBody === '') {
  console.error('build-client: Babel produced an empty editor style model');
  process.exit(1);
}
const indentedEditorStyleModel = editorStyleModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorStyleModelModule = `\n    /* ─────────────────────── components/editor/editor-style-model.ts ─────────────────────── */\n${indentedEditorStyleModel}\n`;

const projectPanelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'project', 'ProjectPanel.tsx'), 'utf8'),
  {
    filename: 'ProjectPanel.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const projectPanelBody = (projectPanelResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ ProjectPanel \};\s*$/gm, '')
  .trimEnd();
if (projectPanelBody === '') {
  console.error('build-client: Babel produced an empty ProjectPanel module');
  process.exit(1);
}
const indentedProjectPanel = projectPanelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const projectPanelModule = `\n    /* ─────────────────────── components/project/ProjectPanel.tsx ─────────────────────── */\n${indentedProjectPanel}\n`;

const projectOptionsMenuResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'project', 'project-options-menu.ts'), 'utf8'),
  {
    filename: 'project-options-menu.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const projectOptionsMenuBody = (projectOptionsMenuResult.code ?? '')
  .replace(/^export /gm, '')
  .trimEnd();
if (projectOptionsMenuBody === '') {
  console.error('build-client: Babel produced an empty project options menu module');
  process.exit(1);
}
const indentedProjectOptionsMenu = projectOptionsMenuBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const projectOptionsMenuModule = `\n    /* ─────────────────────── components/project/project-options-menu.ts ─────────────────────── */\n${indentedProjectOptionsMenu}\n`;

const commitPanelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitPanel.tsx'), 'utf8'),
  {
    filename: 'CommitPanel.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitPanelBody = (commitPanelResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ CommitPanel \};\s*$/gm, '')
  .trimEnd();
if (commitPanelBody === '') {
  console.error('build-client: Babel produced an empty CommitPanel module');
  process.exit(1);
}
const indentedCommitPanel = commitPanelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitPanelModule = `\n    /* ─────────────────────── components/commit/CommitPanel.tsx ─────────────────────── */\n${indentedCommitPanel}\n`;

const commitOptionsMenuResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-options-menu.ts'), 'utf8'),
  {
    filename: 'commit-options-menu.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitOptionsMenuBody = (commitOptionsMenuResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (commitOptionsMenuBody === '') {
  console.error('build-client: Babel produced an empty commit options menu module');
  process.exit(1);
}
const indentedCommitOptionsMenu = commitOptionsMenuBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitOptionsMenuModule = `\n    /* ─────────────────────── components/commit/commit-options-menu.ts ─────────────────────── */\n${indentedCommitOptionsMenu}\n`;

const stashShelveMenuResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'stash-shelve-menu.ts'), 'utf8'),
  {
    filename: 'stash-shelve-menu.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const stashShelveMenuBody = (stashShelveMenuResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (stashShelveMenuBody === '') {
  console.error('build-client: Babel produced an empty stash/shelve menu module');
  process.exit(1);
}
const indentedStashShelveMenu = stashShelveMenuBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const stashShelveMenuModule = `\n    /* ─────────────────────── components/commit/stash-shelve-menu.ts ─────────────────────── */\n${indentedStashShelveMenu}\n`;

const commitLogMenuResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'log-menu.ts'), 'utf8'),
  {
    filename: 'log-menu.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogMenuBody = (commitLogMenuResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (commitLogMenuBody === '') {
  console.error('build-client: Babel produced an empty commit log menu module');
  process.exit(1);
}
const indentedCommitLogMenu = commitLogMenuBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogMenuModule = `\n    /* ─────────────────────── components/commit/log-menu.ts ─────────────────────── */\n${indentedCommitLogMenu}\n`;

const commitFileMenuResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'file-menu.ts'), 'utf8'),
  {
    filename: 'file-menu.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitFileMenuBody = (commitFileMenuResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (commitFileMenuBody === '') {
  console.error('build-client: Babel produced an empty commit file menu module');
  process.exit(1);
}
const indentedCommitFileMenu = commitFileMenuBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitFileMenuModule = `\n    /* ─────────────────────── components/commit/file-menu.ts ─────────────────────── */\n${indentedCommitFileMenu}\n`;

const commitLogGraphControllerResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-log-graph-controller.ts'), 'utf8'),
  {
    filename: 'commit-log-graph-controller.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogGraphControllerBody = (commitLogGraphControllerResult.code ?? '')
  .replace(/^export /gm, '')
  .trimEnd();
if (commitLogGraphControllerBody === '') {
  console.error('build-client: Babel produced an empty commit log graph controller module');
  process.exit(1);
}
const indentedCommitLogGraphController = commitLogGraphControllerBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogGraphControllerModule = `\n    /* ─────────────────────── components/commit/commit-log-graph-controller.ts ─────────────────────── */\n${indentedCommitLogGraphController}\n`;

const commitLogFlatControllerResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-log-flat-controller.ts'), 'utf8'),
  {
    filename: 'commit-log-flat-controller.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogFlatControllerBody = (commitLogFlatControllerResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (commitLogFlatControllerBody === '') {
  console.error('build-client: Babel produced an empty commit log flat controller module');
  process.exit(1);
}
const indentedCommitLogFlatController = commitLogFlatControllerBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogFlatControllerModule = `\n    /* ─────────────────────── components/commit/commit-log-flat-controller.ts ─────────────────────── */\n${indentedCommitLogFlatController}\n`;

const commitLogListCommandModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-log-list-command-model.ts'), 'utf8'),
  {
    filename: 'commit-log-list-command-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogListCommandModelBody = (commitLogListCommandModelResult.code ?? '')
  .replace(/^export /gm, '')
  .trimEnd();
if (commitLogListCommandModelBody === '') {
  console.error('build-client: Babel produced an empty commit log list command model');
  process.exit(1);
}
const indentedCommitLogListCommandModel = commitLogListCommandModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogListCommandModelModule = `\n    /* ─────────────────────── components/commit/commit-log-list-command-model.ts ─────────────────────── */\n${indentedCommitLogListCommandModel}\n`;

const commitLogScopeAnnouncementResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-log-scope-announcement.ts'), 'utf8'),
  {
    filename: 'commit-log-scope-announcement.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogScopeAnnouncementBody = (commitLogScopeAnnouncementResult.code ?? '')
  .replace(/^export /gm, '')
  .trimEnd();
if (commitLogScopeAnnouncementBody === '') {
  console.error('build-client: Babel produced an empty commit log scope announcement model');
  process.exit(1);
}
const indentedCommitLogScopeAnnouncement = commitLogScopeAnnouncementBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogScopeAnnouncementModule = `\n    /* ─────────────────────── components/commit/commit-log-scope-announcement.ts ─────────────────────── */\n${indentedCommitLogScopeAnnouncement}\n`;

const commitLogShortcutModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-log-shortcut-model.ts'), 'utf8'),
  {
    filename: 'commit-log-shortcut-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogShortcutModelBody = (commitLogShortcutModelResult.code ?? '')
  .replace(/^export /gm, '')
  .trimEnd();
if (commitLogShortcutModelBody === '') {
  console.error('build-client: Babel produced an empty commit log shortcut model');
  process.exit(1);
}
const indentedCommitLogShortcutModel = commitLogShortcutModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogShortcutModelModule = `\n    /* ─────────────────────── components/commit/commit-log-shortcut-model.ts ─────────────────────── */\n${indentedCommitLogShortcutModel}\n`;

const commitLogSelectionModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-log-selection-model.ts'), 'utf8'),
  {
    filename: 'commit-log-selection-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogSelectionModelBody = (commitLogSelectionModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (commitLogSelectionModelBody === '') {
  console.error('build-client: Babel produced an empty commit log selection model');
  process.exit(1);
}
const indentedCommitLogSelectionModel = commitLogSelectionModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogSelectionModelModule = `\n    /* ─────────────────────── components/commit/commit-log-selection-model.ts ─────────────────────── */\n${indentedCommitLogSelectionModel}\n`;

const commitLogViewModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-log-view-model.ts'), 'utf8'),
  {
    filename: 'commit-log-view-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogViewModelBody = (commitLogViewModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (commitLogViewModelBody === '') {
  console.error('build-client: Babel produced an empty commit log view model');
  process.exit(1);
}
const indentedCommitLogViewModel = commitLogViewModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogViewModelModule = `\n    /* ─────────────────────── components/commit/commit-log-view-model.ts ─────────────────────── */\n${indentedCommitLogViewModel}\n`;

const commitLogViewPreferencesResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-log-view-preferences.ts'), 'utf8'),
  {
    filename: 'commit-log-view-preferences.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogViewPreferencesBody = (commitLogViewPreferencesResult.code ?? '')
  .replace(/^export /gm, '')
  .trimEnd();
if (commitLogViewPreferencesBody === '') {
  console.error('build-client: Babel produced an empty commit log view preferences module');
  process.exit(1);
}
const indentedCommitLogViewPreferences = commitLogViewPreferencesBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogViewPreferencesModule = `\n    /* ─────────────────────── components/commit/commit-log-view-preferences.ts ─────────────────────── */\n${indentedCommitLogViewPreferences}\n`;

const namePromptResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'NamePrompt.tsx'), 'utf8'),
  {
    filename: 'NamePrompt.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const namePromptBody = (namePromptResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ NamePrompt \};\s*$/gm, '')
  .trimEnd();
if (namePromptBody === '') {
  console.error('build-client: Babel produced an empty NamePrompt module');
  process.exit(1);
}
const indentedNamePrompt = namePromptBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const namePromptModule = `\n    /* ─────────────────────── components/commit/NamePrompt.tsx ─────────────────────── */\n${indentedNamePrompt}\n`;

const revisionPickerResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'RevisionPicker.tsx'), 'utf8'),
  {
    filename: 'RevisionPicker.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const revisionPickerBody = (revisionPickerResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ RevisionPicker \};\s*$/gm, '')
  .trimEnd();
if (revisionPickerBody === '') {
  console.error('build-client: Babel produced an empty RevisionPicker module');
  process.exit(1);
}
const indentedRevisionPicker = revisionPickerBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const revisionPickerModule = `\n    /* ─────────────────────── components/commit/RevisionPicker.tsx ─────────────────────── */\n${indentedRevisionPicker}\n`;

const commitSearchModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-search-model.ts'), 'utf8'),
  {
    filename: 'commit-search-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitSearchModelBody = (commitSearchModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (commitSearchModelBody === '') {
  console.error('build-client: Babel produced an empty commit search model');
  process.exit(1);
}
const indentedCommitSearchModel = commitSearchModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitSearchModelModule = `\n    /* ─────────────────────── components/commit/commit-search-model.ts ─────────────────────── */\n${indentedCommitSearchModel}\n`;

const moveToPickerResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'MoveToPicker.tsx'), 'utf8'),
  {
    filename: 'MoveToPicker.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const moveToPickerBody = (moveToPickerResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ MoveToPicker \};\s*$/gm, '')
  .trimEnd();
if (moveToPickerBody === '') {
  console.error('build-client: Babel produced an empty MoveToPicker module');
  process.exit(1);
}
const indentedMoveToPicker = moveToPickerBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const moveToPickerModule = `\n    /* ─────────────────────── components/commit/MoveToPicker.tsx ─────────────────────── */\n${indentedMoveToPicker}\n`;

const codePreviewCodeResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CodePreviewCode.tsx'), 'utf8'),
  {
    filename: 'CodePreviewCode.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const codePreviewCodeBody = (codePreviewCodeResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ CodePreviewCode \};\s*$/gm, '')
  .trimEnd();
if (codePreviewCodeBody === '') {
  console.error('build-client: Babel produced an empty CodePreviewCode module');
  process.exit(1);
}
const indentedCodePreviewCode = codePreviewCodeBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const codePreviewCodeModule = `\n    /* ─────────────────────── components/commit/CodePreviewCode.tsx ─────────────────────── */\n${indentedCodePreviewCode}\n`;

const editorStatusFactsResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorStatusFacts.tsx'), 'utf8'),
  {
    filename: 'EditorStatusFacts.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorStatusFactsBody = (editorStatusFactsResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ EditorStatusFacts \};\s*$/gm, '')
  .trimEnd();
if (editorStatusFactsBody === '') {
  console.error('build-client: Babel produced an empty EditorStatusFacts module');
  process.exit(1);
}
const indentedEditorStatusFacts = editorStatusFactsBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorStatusFactsModule = `\n    /* ─────────────────────── components/editor/EditorStatusFacts.tsx ─────────────────────── */\n${indentedEditorStatusFacts}\n`;

const markdownModeSwitchResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'MarkdownModeSwitch.tsx'), 'utf8'),
  {
    filename: 'MarkdownModeSwitch.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const markdownModeSwitchBody = (markdownModeSwitchResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ MarkdownModeSwitch \};\s*$/gm, '')
  .trimEnd();
if (markdownModeSwitchBody === '') {
  console.error('build-client: Babel produced an empty MarkdownModeSwitch module');
  process.exit(1);
}
const indentedMarkdownModeSwitch = markdownModeSwitchBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const markdownModeSwitchModule = `\n    /* ─────────────────────── components/editor/MarkdownModeSwitch.tsx ─────────────────────── */\n${indentedMarkdownModeSwitch}\n`;

const imagePreviewPaneResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'ImagePreviewPane.tsx'), 'utf8'),
  {
    filename: 'ImagePreviewPane.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const imagePreviewPaneBody = (imagePreviewPaneResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ ImagePreviewPane \};\s*$/gm, '')
  .trimEnd();
if (imagePreviewPaneBody === '') {
  console.error('build-client: Babel produced an empty ImagePreviewPane module');
  process.exit(1);
}
const indentedImagePreviewPane = imagePreviewPaneBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const imagePreviewPaneModule = `\n    /* ─────────────────────── components/editor/ImagePreviewPane.tsx ─────────────────────── */\n${indentedImagePreviewPane}\n`;

const markdownPreviewPaneResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'MarkdownPreviewPane.tsx'), 'utf8'),
  {
    filename: 'MarkdownPreviewPane.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const markdownPreviewPaneBody = (markdownPreviewPaneResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ MarkdownPreviewPane \};\s*$/gm, '')
  .trimEnd();
if (markdownPreviewPaneBody === '') {
  console.error('build-client: Babel produced an empty MarkdownPreviewPane module');
  process.exit(1);
}
const indentedMarkdownPreviewPane = markdownPreviewPaneBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const markdownPreviewPaneModule = `\n    /* ─────────────────────── components/editor/MarkdownPreviewPane.tsx ─────────────────────── */\n${indentedMarkdownPreviewPane}\n`;

const workspaceFileModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'workspace-file-model.ts'), 'utf8'),
  {
    filename: 'workspace-file-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const workspaceFileModelBody = (workspaceFileModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (workspaceFileModelBody === '') {
  console.error('build-client: Babel produced an empty workspace file model');
  process.exit(1);
}
const indentedWorkspaceFileModel = workspaceFileModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const workspaceFileModelModule = `\n    /* ─────────────────────── components/editor/workspace-file-model.ts ─────────────────────── */\n${indentedWorkspaceFileModel}\n`;

const workspaceImagePreviewResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'workspace-image-preview.tsx'), 'utf8'),
  {
    filename: 'workspace-image-preview.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const workspaceImagePreviewBody = (workspaceImagePreviewResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export /gm, '')
  .trimEnd();
if (workspaceImagePreviewBody === '') {
  console.error('build-client: Babel produced an empty workspace image preview');
  process.exit(1);
}
const indentedWorkspaceImagePreview = workspaceImagePreviewBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const workspaceImagePreviewModule = `\n    /* ─────────────────────── components/editor/workspace-image-preview.tsx ─────────────────────── */\n${indentedWorkspaceImagePreview}\n`;

const editorPathModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'editor-path-model.ts'), 'utf8'),
  {
    filename: 'editor-path-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorPathModelBody = (editorPathModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (editorPathModelBody === '') {
  console.error('build-client: Babel produced an empty editor path model');
  process.exit(1);
}
const indentedEditorPathModel = editorPathModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorPathModelModule = `\n    /* ─────────────────────── components/editor/editor-path-model.ts ─────────────────────── */\n${indentedEditorPathModel}\n`;

const editorDocumentModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'editor-document-model.ts'), 'utf8'),
  {
    filename: 'editor-document-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorDocumentModelBody = (editorDocumentModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (editorDocumentModelBody === '') {
  console.error('build-client: Babel produced an empty editor document model');
  process.exit(1);
}
const indentedEditorDocumentModel = editorDocumentModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorDocumentModelModule = `\n    /* ─────────────────────── components/editor/editor-document-model.ts ─────────────────────── */\n${indentedEditorDocumentModel}\n`;

const markdownScrollModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'markdown-scroll-model.ts'), 'utf8'),
  {
    filename: 'markdown-scroll-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const markdownScrollModelBody = (markdownScrollModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (markdownScrollModelBody === '') {
  console.error('build-client: Babel produced an empty Markdown scroll model');
  process.exit(1);
}
const indentedMarkdownScrollModel = markdownScrollModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const markdownScrollModelModule = `\n    /* ─────────────────────── components/editor/markdown-scroll-model.ts ─────────────────────── */\n${indentedMarkdownScrollModel}\n`;

const editorNavigationModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'editor-navigation-model.ts'), 'utf8'),
  {
    filename: 'editor-navigation-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorNavigationModelBody = (editorNavigationModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (editorNavigationModelBody === '') {
  console.error('build-client: Babel produced an empty editor navigation model');
  process.exit(1);
}
const indentedEditorNavigationModel = editorNavigationModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorNavigationModelModule = `\n    /* ─────────────────────── components/editor/editor-navigation-model.ts ─────────────────────── */\n${indentedEditorNavigationModel}\n`;

const editorFileTemplateModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'editor-file-template-model.ts'), 'utf8'),
  {
    filename: 'editor-file-template-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorFileTemplateModelBody = (editorFileTemplateModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (editorFileTemplateModelBody === '') {
  console.error('build-client: Babel produced an empty editor file template model');
  process.exit(1);
}
const indentedEditorFileTemplateModel = editorFileTemplateModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorFileTemplateModelModule = `\n    /* ─────────────────────── components/editor/editor-file-template-model.ts ─────────────────────── */\n${indentedEditorFileTemplateModel}\n`;

const editorLanguageModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'editor-language-model.ts'), 'utf8'),
  {
    filename: 'editor-language-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorLanguageModelBody = (editorLanguageModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (editorLanguageModelBody === '') {
  console.error('build-client: Babel produced an empty editor language model');
  process.exit(1);
}
const indentedEditorLanguageModel = editorLanguageModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorLanguageModelModule = `\n    /* ─────────────────────── components/editor/editor-language-model.ts ─────────────────────── */\n${indentedEditorLanguageModel}\n`;

const annotatePreviewResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'diff', 'AnnotatePreview.tsx'), 'utf8'),
  {
    filename: 'AnnotatePreview.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const annotatePreviewBody = (annotatePreviewResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ AnnotatePreview \};\s*$/gm, '')
  .trimEnd();
if (annotatePreviewBody === '') {
  console.error('build-client: Babel produced an empty AnnotatePreview module');
  process.exit(1);
}
const indentedAnnotatePreview = annotatePreviewBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const annotatePreviewModule = `\n    /* ─────────────────────── components/diff/AnnotatePreview.tsx ─────────────────────── */\n${indentedAnnotatePreview}\n`;

const repositoryVersionPreviewResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'diff', 'RepositoryVersionPreview.tsx'), 'utf8'),
  {
    filename: 'RepositoryVersionPreview.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const repositoryVersionPreviewBody = (repositoryVersionPreviewResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ RepositoryVersionPreview \};\s*$/gm, '')
  .trimEnd();
if (repositoryVersionPreviewBody === '') {
  console.error('build-client: Babel produced an empty RepositoryVersionPreview module');
  process.exit(1);
}
const indentedRepositoryVersionPreview = repositoryVersionPreviewBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const repositoryVersionPreviewModule = `\n    /* ─────────────────────── components/diff/RepositoryVersionPreview.tsx ─────────────────────── */\n${indentedRepositoryVersionPreview}\n`;

const diffPreviewResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'diff', 'DiffPreview.tsx'), 'utf8'),
  {
    filename: 'DiffPreview.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const diffPreviewBody = (diffPreviewResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ DiffPreview \};\s*$/gm, '')
  .trimEnd();
if (diffPreviewBody === '') {
  console.error('build-client: Babel produced an empty DiffPreview module');
  process.exit(1);
}
const indentedDiffPreview = diffPreviewBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const diffPreviewModule = `\n    /* ─────────────────────── components/diff/DiffPreview.tsx ─────────────────────── */\n${indentedDiffPreview}\n`;

const projectSelectionModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'project', 'project-selection-model.ts'), 'utf8'),
  {
    filename: 'project-selection-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const projectSelectionModelBody = (projectSelectionModelResult.code ?? '').replace(/^export /gm, '').trimEnd();
if (projectSelectionModelBody === '') {
  console.error('build-client: Babel produced an empty project selection model');
  process.exit(1);
}
const indentedProjectSelectionModel = projectSelectionModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const projectSelectionModelModule = `\n    /* ─────────────────────── components/project/project-selection-model.ts ─────────────────────── */\n${indentedProjectSelectionModel}\n`;

const terminalScreenResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'terminal', 'TerminalScreen.tsx'), 'utf8'),
  {
    filename: 'TerminalScreen.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const terminalScreenBody = (terminalScreenResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ TerminalScreen \};\s*$/gm, '')
  .trimEnd();
if (terminalScreenBody === '') {
  console.error('build-client: Babel produced an empty TerminalScreen module');
  process.exit(1);
}
const indentedTerminalScreen = terminalScreenBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const terminalScreenModule = `\n    /* ─────────────────────── components/terminal/TerminalScreen.tsx ─────────────────────── */\n${indentedTerminalScreen}\n`;

const editorTerminalTabResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'terminal', 'EditorTerminalTab.tsx'), 'utf8'),
  {
    filename: 'EditorTerminalTab.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorTerminalTabBody = (editorTerminalTabResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ EditorTerminalTab \};\s*$/gm, '')
  .trimEnd();
if (editorTerminalTabBody === '') {
  console.error('build-client: Babel produced an empty EditorTerminalTab module');
  process.exit(1);
}
const indentedEditorTerminalTab = editorTerminalTabBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorTerminalTabModule = `\n    /* ─────────────────────── components/terminal/EditorTerminalTab.tsx ─────────────────────── */\n${indentedEditorTerminalTab}\n`;

const editorTerminalAreaResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'terminal', 'EditorTerminalArea.tsx'), 'utf8'),
  {
    filename: 'EditorTerminalArea.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorTerminalAreaBody = (editorTerminalAreaResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorTerminalArea \};\s*$/gm, '')
  .trimEnd();
if (editorTerminalAreaBody === '') {
  console.error('build-client: Babel produced an empty EditorTerminalArea module');
  process.exit(1);
}
const indentedEditorTerminalArea = editorTerminalAreaBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorTerminalAreaModule = `\n    /* ─────────────────────── components/terminal/EditorTerminalArea.tsx ─────────────────────── */\n${indentedEditorTerminalArea}\n`;

const editorTerminalDockResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'terminal', 'EditorTerminalDock.tsx'), 'utf8'),
  {
    filename: 'EditorTerminalDock.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorTerminalDockBody = (editorTerminalDockResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorTerminalDock \};\s*$/gm, '')
  .trimEnd();
if (editorTerminalDockBody === '') {
  console.error('build-client: Babel produced an empty EditorTerminalDock module');
  process.exit(1);
}
const indentedEditorTerminalDock = editorTerminalDockBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorTerminalDockModule = `\n    /* ─────────────────────── components/terminal/EditorTerminalDock.tsx ─────────────────────── */\n${indentedEditorTerminalDock}\n`;

const terminalPanelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'terminal', 'TerminalPanel.tsx'), 'utf8'),
  {
    filename: 'TerminalPanel.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const terminalPanelBody = (terminalPanelResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ TerminalPanel \};\s*$/gm, '')
  .trimEnd();
if (terminalPanelBody === '') {
  console.error('build-client: Babel produced an empty TerminalPanel module');
  process.exit(1);
}
const indentedTerminalPanel = terminalPanelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const terminalPanelModule = `\n    /* ─────────────────────── components/terminal/TerminalPanel.tsx ─────────────────────── */\n${indentedTerminalPanel}\n`;

const searchEverywhereResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'SearchEverywhere.tsx'), 'utf8'),
  {
    filename: 'SearchEverywhere.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const searchEverywhereBody = (searchEverywhereResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ SearchEverywhere \};\s*$/gm, '')
  .trimEnd();
if (searchEverywhereBody === '') {
  console.error('build-client: Babel produced an empty SearchEverywhere module');
  process.exit(1);
}
const indentedSearchEverywhere = searchEverywhereBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const searchEverywhereModule = `\n    /* ─────────────────────── components/search/SearchEverywhere.tsx ─────────────────────── */\n${indentedSearchEverywhere}\n`;

const showUsagesPopupResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'ShowUsagesPopup.tsx'), 'utf8'),
  {
    filename: 'ShowUsagesPopup.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const showUsagesPopupBody = (showUsagesPopupResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ ShowUsagesPopup \};\s*$/gm, '')
  .trimEnd();
if (showUsagesPopupBody === '') {
  console.error('build-client: Babel produced an empty ShowUsagesPopup module');
  process.exit(1);
}
const indentedShowUsagesPopup = showUsagesPopupBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const showUsagesPopupModule = `\n    /* ─────────────────────── components/search/ShowUsagesPopup.tsx ─────────────────────── */\n${indentedShowUsagesPopup}\n`;

const quickOpenResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'QuickOpen.tsx'), 'utf8'),
  {
    filename: 'QuickOpen.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const quickOpenBody = (quickOpenResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ QuickOpen \};\s*$/gm, '')
  .trimEnd();
if (quickOpenBody === '') {
  console.error('build-client: Babel produced an empty QuickOpen module');
  process.exit(1);
}
const indentedQuickOpen = quickOpenBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const quickOpenModule = `\n    /* ─────────────────────── components/search/QuickOpen.tsx ─────────────────────── */\n${indentedQuickOpen}\n`;

const findScopeEditorResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'FindScopeEditor.tsx'), 'utf8'),
  {
    filename: 'FindScopeEditor.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const findScopeEditorBody = (findScopeEditorResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ FindScopeEditor \};\s*$/gm, '')
  .trimEnd();
if (findScopeEditorBody === '') {
  console.error('build-client: Babel produced an empty FindScopeEditor module');
  process.exit(1);
}
const indentedFindScopeEditor = findScopeEditorBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const findScopeEditorModule = `\n    /* ─────────────────────── components/search/FindScopeEditor.tsx ─────────────────────── */\n${indentedFindScopeEditor}\n`;

const findToolWindowResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'FindToolWindow.tsx'), 'utf8'),
  {
    filename: 'FindToolWindow.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const findToolWindowBody = (findToolWindowResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ FindToolWindow \};\s*$/gm, '')
  .trimEnd();
if (findToolWindowBody === '') {
  console.error('build-client: Babel produced an empty FindToolWindow module');
  process.exit(1);
}
const indentedFindToolWindow = findToolWindowBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const findToolWindowModule = `\n    /* ─────────────────────── components/search/FindToolWindow.tsx ─────────────────────── */\n${indentedFindToolWindow}\n`;

const commitGraphFoldBarResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitGraphFoldBar.tsx'), 'utf8'),
  {
    filename: 'CommitGraphFoldBar.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitGraphFoldBarBody = (commitGraphFoldBarResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ CommitGraphFoldBar \};\s*$/gm, '')
  .trimEnd();
if (commitGraphFoldBarBody === '') {
  console.error('build-client: Babel produced an empty CommitGraphFoldBar module');
  process.exit(1);
}
const indentedCommitGraphFoldBar = commitGraphFoldBarBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitGraphFoldBarModule = `\n    /* ─────────────────────── components/commit/CommitGraphFoldBar.tsx ─────────────────────── */\n${indentedCommitGraphFoldBar}\n`;

const commitGraphStateModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'commit-graph-state-model.ts'), 'utf8'),
  {
    filename: 'commit-graph-state-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitGraphStateModelBody = (commitGraphStateModelResult.code ?? '')
  .replace(/^export /gm, '')
  .trimEnd();
if (commitGraphStateModelBody === '') {
  console.error('build-client: Babel produced an empty commit graph state model');
  process.exit(1);
}
const indentedCommitGraphStateModel = commitGraphStateModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitGraphStateModelModule = `\n    /* ─────────────────────── components/commit/commit-graph-state-model.ts ─────────────────────── */\n${indentedCommitGraphStateModel}\n`;

const commitGraphRowResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitGraphRow.tsx'), 'utf8'),
  {
    filename: 'CommitGraphRow.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitGraphRowBody = (commitGraphRowResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ CommitGraphRow \};\s*$/gm, '')
  .trimEnd();
if (commitGraphRowBody === '') {
  console.error('build-client: Babel produced an empty CommitGraphRow module');
  process.exit(1);
}
const indentedCommitGraphRow = commitGraphRowBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitGraphRowModule = `\n    /* ─────────────────────── components/commit/CommitGraphRow.tsx ─────────────────────── */\n${indentedCommitGraphRow}\n`;

const commitGraphResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitGraph.tsx'), 'utf8'),
  {
    filename: 'CommitGraph.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitGraphBody = (commitGraphResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ CommitGraph \};\s*$/gm, '')
  .trimEnd();
if (commitGraphBody === '') {
  console.error('build-client: Babel produced an empty CommitGraph module');
  process.exit(1);
}
const indentedCommitGraph = commitGraphBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitGraphModule = `\n    /* ─────────────────────── components/commit/CommitGraph.tsx ─────────────────────── */\n${indentedCommitGraph}\n`;

const commitLogResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitLog.tsx'), 'utf8'),
  {
    filename: 'CommitLog.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogBody = (commitLogResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ CommitLog \};\s*$/gm, '')
  .trimEnd();
if (commitLogBody === '') {
  console.error('build-client: Babel produced an empty CommitLog module');
  process.exit(1);
}
const indentedCommitLog = commitLogBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogModule = `\n    /* ─────────────────────── components/commit/CommitLog.tsx ─────────────────────── */\n${indentedCommitLog}\n`;

const commitLogDetailPaneResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitLogDetailPane.tsx'), 'utf8'),
  {
    filename: 'CommitLogDetailPane.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogDetailPaneBody = (commitLogDetailPaneResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ CommitLogDetailPane \};\s*$/gm, '')
  .trimEnd();
if (commitLogDetailPaneBody === '') {
  console.error('build-client: Babel produced an empty CommitLogDetailPane module');
  process.exit(1);
}
const indentedCommitLogDetailPane = commitLogDetailPaneBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogDetailPaneModule = `\n    /* ─────────────────────── components/commit/CommitLogDetailPane.tsx ─────────────────────── */\n${indentedCommitLogDetailPane}\n`;

const commitLogToolbarResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitLogToolbar.tsx'), 'utf8'),
  {
    filename: 'CommitLogToolbar.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogToolbarBody = (commitLogToolbarResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export \{ CommitLogToolbar \};\s*$/gm, '')
  .trimEnd();
if (commitLogToolbarBody === '') {
  console.error('build-client: Babel produced an empty CommitLogToolbar module');
  process.exit(1);
}
const indentedCommitLogToolbar = commitLogToolbarBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogToolbarModule = `\n    /* ─────────────────────── components/commit/CommitLogToolbar.tsx ─────────────────────── */\n${indentedCommitLogToolbar}\n`;

const commitLogFlatRowResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitLogFlatRow.tsx'), 'utf8'),
  {
    filename: 'CommitLogFlatRow.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogFlatRowBody = (commitLogFlatRowResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ CommitLogFlatRow \};\s*$/gm, '')
  .trimEnd();
if (commitLogFlatRowBody === '') {
  console.error('build-client: Babel produced an empty CommitLogFlatRow module');
  process.exit(1);
}
const indentedCommitLogFlatRow = commitLogFlatRowBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogFlatRowModule = `\n    /* ─────────────────────── components/commit/CommitLogFlatRow.tsx ─────────────────────── */\n${indentedCommitLogFlatRow}\n`;

const commitLogListStateResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'CommitLogListState.tsx'), 'utf8'),
  {
    filename: 'CommitLogListState.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const commitLogListStateBody = (commitLogListStateResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ CommitLogListState \};\s*$/gm, '')
  .trimEnd();
if (commitLogListStateBody === '') {
  console.error('build-client: Babel produced an empty CommitLogListState module');
  process.exit(1);
}
const indentedCommitLogListState = commitLogListStateBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitLogListStateModule = `\n    /* ─────────────────────── components/commit/CommitLogListState.tsx ─────────────────────── */\n${indentedCommitLogListState}\n`;

const measuringScreenResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'terminal', 'MeasuringScreen.tsx'), 'utf8'),
  {
    filename: 'MeasuringScreen.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const measuringScreenBody = (measuringScreenResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ MeasuringScreen \};\s*$/gm, '')
  .trimEnd();
if (measuringScreenBody === '') {
  console.error('build-client: Babel produced an empty MeasuringScreen module');
  process.exit(1);
}
const indentedMeasuringScreen = measuringScreenBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const measuringScreenModule = `\n    /* ─────────────────────── components/terminal/MeasuringScreen.tsx ─────────────────────── */\n${indentedMeasuringScreen}\n`;

const editorErrorBoundaryResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorErrorBoundary.tsx'), 'utf8'),
  {
    filename: 'EditorErrorBoundary.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorErrorBoundaryBody = (editorErrorBoundaryResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorErrorBoundary \};\s*$/gm, '')
  .trimEnd();
if (editorErrorBoundaryBody === '') {
  console.error('build-client: Babel produced an empty EditorErrorBoundary module');
  process.exit(1);
}
const indentedEditorErrorBoundary = editorErrorBoundaryBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorErrorBoundaryModule = `\n    /* ─────────────────────── components/editor/EditorErrorBoundary.tsx ─────────────────────── */\n${indentedEditorErrorBoundary}\n`;

const editorMountResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorMount.tsx'), 'utf8'),
  {
    filename: 'EditorMount.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorMountBody = (editorMountResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorMount \};\s*$/gm, '')
  .trimEnd();
if (editorMountBody === '') {
  console.error('build-client: Babel produced an empty EditorMount module');
  process.exit(1);
}
const indentedEditorMount = editorMountBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorMountModule = `\n    /* ─────────────────────── components/editor/EditorMount.tsx ─────────────────────── */\n${indentedEditorMount}\n`;

const editorGotoLinePopupResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorGotoLinePopup.tsx'), 'utf8'),
  {
    filename: 'EditorGotoLinePopup.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorGotoLinePopupBody = (editorGotoLinePopupResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorGotoLinePopup \};\s*$/gm, '')
  .trimEnd();
if (editorGotoLinePopupBody === '') {
  console.error('build-client: Babel produced an empty EditorGotoLinePopup module');
  process.exit(1);
}
const indentedEditorGotoLinePopup = editorGotoLinePopupBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorGotoLinePopupModule = `\n    /* ─────────────────────── components/editor/EditorGotoLinePopup.tsx ─────────────────────── */\n${indentedEditorGotoLinePopup}\n`;

const editorFindBarResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorFindBar.tsx'), 'utf8'),
  {
    filename: 'EditorFindBar.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorFindBarBody = (editorFindBarResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorFindBar \};\s*$/gm, '')
  .trimEnd();
if (editorFindBarBody === '') {
  console.error('build-client: Babel produced an empty EditorFindBar module');
  process.exit(1);
}
const indentedEditorFindBar = editorFindBarBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorFindBarModule = `\n    /* ─────────────────────── components/editor/EditorFindBar.tsx ─────────────────────── */\n${indentedEditorFindBar}\n`;

const editorStatusBarResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorStatusBar.tsx'), 'utf8'),
  {
    filename: 'EditorStatusBar.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorStatusBarBody = (editorStatusBarResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorStatusBar \};\s*$/gm, '')
  .trimEnd();
if (editorStatusBarBody === '') {
  console.error('build-client: Babel produced an empty EditorStatusBar module');
  process.exit(1);
}
const indentedEditorStatusBar = editorStatusBarBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorStatusBarModule = `\n    /* ─────────────────────── components/editor/EditorStatusBar.tsx ─────────────────────── */\n${indentedEditorStatusBar}\n`;

const editorFileTabResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorFileTab.tsx'), 'utf8'),
  {
    filename: 'EditorFileTab.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorFileTabBody = (editorFileTabResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorFileTab \};\s*$/gm, '')
  .trimEnd();
if (editorFileTabBody === '') {
  console.error('build-client: Babel produced an empty EditorFileTab module');
  process.exit(1);
}
const indentedEditorFileTab = editorFileTabBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorFileTabModule = `\n    /* ─────────────────────── components/editor/EditorFileTab.tsx ─────────────────────── */\n${indentedEditorFileTab}\n`;

const editorTabStripResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorTabStrip.tsx'), 'utf8'),
  {
    filename: 'EditorTabStrip.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorTabStripBody = (editorTabStripResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorTabStrip \};\s*$/gm, '')
  .trimEnd();
if (editorTabStripBody === '') {
  console.error('build-client: Babel produced an empty EditorTabStrip module');
  process.exit(1);
}
const indentedEditorTabStrip = editorTabStripBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorTabStripModule = `\n    /* ─────────────────────── components/editor/EditorTabStrip.tsx ─────────────────────── */\n${indentedEditorTabStrip}\n`;

const editorDiffTabResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorDiffTab.tsx'), 'utf8'),
  {
    filename: 'EditorDiffTab.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorDiffTabBody = (editorDiffTabResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorDiffTab \};\s*$/gm, '')
  .trimEnd();
if (editorDiffTabBody === '') {
  console.error('build-client: Babel produced an empty EditorDiffTab module');
  process.exit(1);
}
const indentedEditorDiffTab = editorDiffTabBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorDiffTabModule = `\n    /* ─────────────────────── components/editor/EditorDiffTab.tsx ─────────────────────── */\n${indentedEditorDiffTab}\n`;

const editorConflictBarsResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorConflictBars.tsx'), 'utf8'),
  {
    filename: 'EditorConflictBars.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorConflictBarsBody = (editorConflictBarsResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorConflictBars \};\s*$/gm, '')
  .trimEnd();
if (editorConflictBarsBody === '') {
  console.error('build-client: Babel produced an empty EditorConflictBars module');
  process.exit(1);
}
const indentedEditorConflictBars = editorConflictBarsBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorConflictBarsModule = `\n    /* ─────────────────────── components/editor/EditorConflictBars.tsx ─────────────────────── */\n${indentedEditorConflictBars}\n`;

const editorSplitHeaderResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorSplitHeader.tsx'), 'utf8'),
  {
    filename: 'EditorSplitHeader.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorSplitHeaderBody = (editorSplitHeaderResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorSplitHeader \};\s*$/gm, '')
  .trimEnd();
if (editorSplitHeaderBody === '') {
  console.error('build-client: Babel produced an empty EditorSplitHeader module');
  process.exit(1);
}
const indentedEditorSplitHeader = editorSplitHeaderBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorSplitHeaderModule = `\n    /* ─────────────────────── components/editor/EditorSplitHeader.tsx ─────────────────────── */\n${indentedEditorSplitHeader}\n`;

const editorSplitPaneResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorSplitPane.tsx'), 'utf8'),
  {
    filename: 'EditorSplitPane.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorSplitPaneBody = (editorSplitPaneResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorSplitPane \};\s*$/gm, '')
  .trimEnd();
if (editorSplitPaneBody === '') {
  console.error('build-client: Babel produced an empty EditorSplitPane module');
  process.exit(1);
}
const indentedEditorSplitPane = editorSplitPaneBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorSplitPaneModule = `\n    /* ─────────────────────── components/editor/EditorSplitPane.tsx ─────────────────────── */\n${indentedEditorSplitPane}\n`;

const editorMainPaneResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorMainPane.tsx'), 'utf8'),
  {
    filename: 'EditorMainPane.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorMainPaneBody = (editorMainPaneResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorMainPane \};\s*$/gm, '')
  .trimEnd();
if (editorMainPaneBody === '') {
  console.error('build-client: Babel produced an empty EditorMainPane module');
  process.exit(1);
}
const indentedEditorMainPane = editorMainPaneBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorMainPaneModule = `\n    /* ─────────────────────── components/editor/EditorMainPane.tsx ─────────────────────── */\n${indentedEditorMainPane}\n`;

const editorSplitDividerResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorSplitDivider.tsx'), 'utf8'),
  {
    filename: 'EditorSplitDivider.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorSplitDividerBody = (editorSplitDividerResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorSplitDivider \};\s*$/gm, '')
  .trimEnd();
if (editorSplitDividerBody === '') {
  console.error('build-client: Babel produced an empty EditorSplitDivider module');
  process.exit(1);
}
const indentedEditorSplitDivider = editorSplitDividerBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorSplitDividerModule = `\n    /* ─────────────────────── components/editor/EditorSplitDivider.tsx ─────────────────────── */\n${indentedEditorSplitDivider}\n`;

const editorDiffAreaResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorDiffArea.tsx'), 'utf8'),
  {
    filename: 'EditorDiffArea.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorDiffAreaBody = (editorDiffAreaResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorDiffArea \};\s*$/gm, '')
  .trimEnd();
if (editorDiffAreaBody === '') {
  console.error('build-client: Babel produced an empty EditorDiffArea module');
  process.exit(1);
}
const indentedEditorDiffArea = editorDiffAreaBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorDiffAreaModule = `\n    /* ─────────────────────── components/editor/EditorDiffArea.tsx ─────────────────────── */\n${indentedEditorDiffArea}\n`;

const editorAnnotateAreaResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorAnnotateArea.tsx'), 'utf8'),
  {
    filename: 'EditorAnnotateArea.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorAnnotateAreaBody = (editorAnnotateAreaResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorAnnotateArea \};\s*$/gm, '')
  .trimEnd();
if (editorAnnotateAreaBody === '') {
  console.error('build-client: Babel produced an empty EditorAnnotateArea module');
  process.exit(1);
}
const indentedEditorAnnotateArea = editorAnnotateAreaBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorAnnotateAreaModule = `\n    /* ─────────────────────── components/editor/EditorAnnotateArea.tsx ─────────────────────── */\n${indentedEditorAnnotateArea}\n`;

const findToolDockResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'FindToolDock.tsx'), 'utf8'),
  {
    filename: 'FindToolDock.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const findToolDockBody = (findToolDockResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ FindToolDock \};\s*$/gm, '')
  .trimEnd();
if (findToolDockBody === '') {
  console.error('build-client: Babel produced an empty FindToolDock module');
  process.exit(1);
}
const indentedFindToolDock = findToolDockBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const findToolDockModule = `\n    /* ─────────────────────── components/search/FindToolDock.tsx ─────────────────────── */\n${indentedFindToolDock}\n`;

const findToolPopupResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'FindToolPopup.tsx'), 'utf8'),
  {
    filename: 'FindToolPopup.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const findToolPopupBody = (findToolPopupResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ FindToolPopup \};\s*$/gm, '')
  .trimEnd();
if (findToolPopupBody === '') {
  console.error('build-client: Babel produced an empty FindToolPopup module');
  process.exit(1);
}
const indentedFindToolPopup = findToolPopupBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const findToolPopupModule = `\n    /* ─────────────────────── components/search/FindToolPopup.tsx ─────────────────────── */\n${indentedFindToolPopup}\n`;

const editorFileSurfaceResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorFileSurface.tsx'), 'utf8'),
  {
    filename: 'EditorFileSurface.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorFileSurfaceBody = (editorFileSurfaceResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorFileSurface \};\s*$/gm, '')
  .trimEnd();
if (editorFileSurfaceBody === '') {
  console.error('build-client: Babel produced an empty EditorFileSurface module');
  process.exit(1);
}
const indentedEditorFileSurface = editorFileSurfaceBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorFileSurfaceModule = `\n    /* ─────────────────────── components/editor/EditorFileSurface.tsx ─────────────────────── */\n${indentedEditorFileSurface}\n`;

const editorWorkspaceShellResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorWorkspaceShell.tsx'), 'utf8'),
  {
    filename: 'EditorWorkspaceShell.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorWorkspaceShellBody = (editorWorkspaceShellResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorWorkspaceShell \};\s*$/gm, '')
  .trimEnd();
if (editorWorkspaceShellBody === '') {
  console.error('build-client: Babel produced an empty EditorWorkspaceShell module');
  process.exit(1);
}
const indentedEditorWorkspaceShell = editorWorkspaceShellBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorWorkspaceShellModule = `\n    /* ─────────────────────── components/editor/EditorWorkspaceShell.tsx ─────────────────────── */\n${indentedEditorWorkspaceShell}\n`;

const editorWorkspaceBodyResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorWorkspaceBody.tsx'), 'utf8'),
  {
    filename: 'EditorWorkspaceBody.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorWorkspaceBodyBody = (editorWorkspaceBodyResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorWorkspaceBody \};\s*$/gm, '')
  .trimEnd();
if (editorWorkspaceBodyBody === '') {
  console.error('build-client: Babel produced an empty EditorWorkspaceBody module');
  process.exit(1);
}
const indentedEditorWorkspaceBody = editorWorkspaceBodyBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorWorkspaceBodyModule = `\n    /* ─────────────────────── components/editor/EditorWorkspaceBody.tsx ─────────────────────── */\n${indentedEditorWorkspaceBody}\n`;

const editorToolWindowPanelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorToolWindowPanel.tsx'), 'utf8'),
  {
    filename: 'EditorToolWindowPanel.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorToolWindowPanelBody = (editorToolWindowPanelResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorToolWindowPanel \};\s*$/gm, '')
  .trimEnd();
if (editorToolWindowPanelBody === '') {
  console.error('build-client: Babel produced an empty EditorToolWindowPanel module');
  process.exit(1);
}
const indentedEditorToolWindowPanel = editorToolWindowPanelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorToolWindowPanelModule = `\n    /* ─────────────────────── components/editor/EditorToolWindowPanel.tsx ─────────────────────── */\n${indentedEditorToolWindowPanel}\n`;

const editorToolWindowResizerResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorToolWindowResizer.tsx'), 'utf8'),
  {
    filename: 'EditorToolWindowResizer.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorToolWindowResizerBody = (editorToolWindowResizerResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorToolWindowResizer \};\s*$/gm, '')
  .trimEnd();
if (editorToolWindowResizerBody === '') {
  console.error('build-client: Babel produced an empty EditorToolWindowResizer module');
  process.exit(1);
}
const indentedEditorToolWindowResizer = editorToolWindowResizerBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorToolWindowResizerModule = `\n    /* ─────────────────────── components/editor/EditorToolWindowResizer.tsx ─────────────────────── */\n${indentedEditorToolWindowResizer}\n`;

const editorWorkspaceMainColumnResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorWorkspaceMainColumn.tsx'), 'utf8'),
  {
    filename: 'EditorWorkspaceMainColumn.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorWorkspaceMainColumnBody = (editorWorkspaceMainColumnResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorWorkspaceMainColumn \};\s*$/gm, '')
  .trimEnd();
if (editorWorkspaceMainColumnBody === '') {
  console.error('build-client: Babel produced an empty EditorWorkspaceMainColumn module');
  process.exit(1);
}
const indentedEditorWorkspaceMainColumn = editorWorkspaceMainColumnBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorWorkspaceMainColumnModule = `\n    /* ─────────────────────── components/editor/EditorWorkspaceMainColumn.tsx ─────────────────────── */\n${indentedEditorWorkspaceMainColumn}\n`;

const editorWorkspaceSurfaceResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorWorkspaceSurface.tsx'), 'utf8'),
  {
    filename: 'EditorWorkspaceSurface.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorWorkspaceSurfaceBody = (editorWorkspaceSurfaceResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorWorkspaceSurface \};\s*$/gm, '')
  .trimEnd();
if (editorWorkspaceSurfaceBody === '') {
  console.error('build-client: Babel produced an empty EditorWorkspaceSurface module');
  process.exit(1);
}
const indentedEditorWorkspaceSurface = editorWorkspaceSurfaceBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorWorkspaceSurfaceModule = `\n    /* ─────────────────────── components/editor/EditorWorkspaceSurface.tsx ─────────────────────── */\n${indentedEditorWorkspaceSurface}\n`;

const editorErrorBannerResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'EditorErrorBanner.tsx'), 'utf8'),
  {
    filename: 'EditorErrorBanner.tsx',
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      '@babel/plugin-transform-react-jsx',
    ],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorErrorBannerBody = (editorErrorBannerResult.code ?? '')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import[^;\n]*;\s*/g, '')
  .replace(/^export \{ EditorErrorBanner \};\s*$/gm, '')
  .trimEnd();
if (editorErrorBannerBody === '') {
  console.error('build-client: Babel produced an empty EditorErrorBanner module');
  process.exit(1);
}
const indentedEditorErrorBanner = editorErrorBannerBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorErrorBannerModule = `\n    /* ─────────────────────── components/editor/EditorErrorBanner.tsx ─────────────────────── */\n${indentedEditorErrorBanner}\n`;

const uiResult = await build({
  entryPoints: [join(partsDir, 'components', 'ui', 'index.tsx')],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: ['es2020'],
  external: ['react', 'react-dom/client', '@deepseek-ai/*'],
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: false,
  treeShaking: false,
  keepNames: true,
  legalComments: 'none',
  logLevel: 'silent',
});
const uiBundle = uiResult.outputFiles?.[0]?.text?.trimEnd() ?? '';
if (uiBundle === '') {
  console.error('build-client: esbuild produced an empty UI bundle');
  process.exit(1);
}
const indentedUiBundle = uiBundle
  .split('\n')
  .map((line) => (line === '' ? '' : `      ${line}`))
  .join('\n');
const uiPrelude = `
    const __dshUiModule = (() => {
      const module = { exports: {} };
      const exports = module.exports;
${indentedUiBundle}
      return module.exports;
    })();
    const { ${uiExports.join(', ')} } = __dshUiModule;
`;

const footer = `
    return {
      apply,
      inject,
    };
  },
});
`;

const output = `${header}${editorTabModelModule}${editorStyleModelModule}${body}${projectPanelModule}${projectOptionsMenuModule}${commitPanelModule}${commitOptionsMenuModule}${stashShelveMenuModule}${commitLogMenuModule}${commitFileMenuModule}${commitLogGraphControllerModule}${commitLogFlatControllerModule}${commitLogListCommandModelModule}${commitLogScopeAnnouncementModule}${commitLogShortcutModelModule}${commitLogSelectionModelModule}${commitLogViewModelModule}${commitLogViewPreferencesModule}${namePromptModule}${commitSearchModelModule}${revisionPickerModule}${moveToPickerModule}${codePreviewCodeModule}${editorStatusFactsModule}${markdownModeSwitchModule}${imagePreviewPaneModule}${markdownPreviewPaneModule}${workspaceFileModelModule}${workspaceImagePreviewModule}${editorPathModelModule}${editorDocumentModelModule}${markdownScrollModelModule}${editorNavigationModelModule}${editorFileTemplateModelModule}${editorLanguageModelModule}${annotatePreviewModule}${repositoryVersionPreviewModule}${diffPreviewModule}${projectSelectionModelModule}${terminalScreenModule}${editorTerminalTabModule}${editorTerminalAreaModule}${editorTerminalDockModule}${terminalPanelModule}${searchEverywhereModule}${showUsagesPopupModule}${quickOpenModule}${findScopeEditorModule}${findToolWindowModule}${commitGraphStateModelModule}${commitGraphFoldBarModule}${commitGraphRowModule}${commitGraphModule}${commitLogModule}${commitLogDetailPaneModule}${commitLogToolbarModule}${commitLogFlatRowModule}${commitLogListStateModule}${measuringScreenModule}${editorErrorBoundaryModule}${editorMountModule}${editorGotoLinePopupModule}${editorFindBarModule}${editorStatusBarModule}${editorFileTabModule}${editorTabStripModule}${editorDiffTabModule}${editorConflictBarsModule}${editorSplitHeaderModule}${editorSplitPaneModule}${editorMainPaneModule}${editorSplitDividerModule}${editorDiffAreaModule}${editorAnnotateAreaModule}${findToolDockModule}${findToolPopupModule}${editorFileSurfaceModule}${editorWorkspaceShellModule}${editorWorkspaceBodyModule}${editorToolWindowPanelModule}${editorToolWindowResizerModule}${editorWorkspaceMainColumnModule}${editorWorkspaceSurfaceModule}${editorErrorBannerModule}${uiPrelude}${footer}`;
const check = process.argv.includes('--check');

if (check) {
  const current = readFileSync(outputPath, 'utf8');
  if (current !== output) {
    console.error('build-client: lib/client.js is stale; run npm run build:client');
    process.exit(1);
  }
  console.log(`build-client: ${files.length} modules verified against lib/client.js`);
} else {
  writeFileSync(outputPath, output, 'utf8');
  console.log(
    `build-client: ${files.length} modules -> lib/client.js (${(Buffer.byteLength(output) / 1024).toFixed(1)} KB)`,
  );
}

if (process.argv.includes('--list')) console.log(files.join('\n'));
