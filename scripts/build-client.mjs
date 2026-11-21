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
import { parse } from '@babel/parser';
import { build } from 'esbuild';
import { findMissingSeparatelyBundledEntries, findUnbundledRuntimeModules } from './client-bundle-closure.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = join(root, 'src', 'client');
const outputPath = join(root, 'lib', 'client.js');
const separateBundleEntryModule = 'components/ui/index.tsx';
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
  'POPUP_ICON_SIZE',
  'ActivityStripe',
  'ToolbarButton',
  'TreeMessage',
  'panelToolbarFit',
  'PanelToolbar',
  'toolbarActionActive',
  'DiffViewModeControl',
  'DockResizeHandle',
  'focusSurfaceWhenReady',
  'resolveFocusSurface',
  'dialogFocusableElements',
  'nextDialogFocusTarget',
  'trapDialogFocus',
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
  'changeModel',
  'canCompareWithHead',
  'badgeFor',
  'allPathsUnversioned',
  'pathsScheduledForRemoval',
  'selectionStateOf',
  'subtotalOf',
  'commitMetrics',
];
const availableFiles = readdirSync(partsDir)
  .filter((name) => (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.d.ts'))
  .sort((left, right) => left.localeCompare(right, 'en'));
const missingFiles = files.filter((name) => !availableFiles.includes(name));
const unlistedFiles = availableFiles.filter((name) => !files.includes(name));
const legacyJavaScriptFiles = readdirSync(partsDir, { recursive: true })
  .filter((name) => typeof name === 'string' && (name.endsWith('.js') || name.endsWith('.jsx')))
  .sort((left, right) => left.localeCompare(right, 'en'));
const separateBundleEntryPath = join(partsDir, ...separateBundleEntryModule.split('/'));
const missingSeparateEntries = findMissingSeparatelyBundledEntries({
  clientDir: partsDir,
  separatelyBundledEntries: [separateBundleEntryModule],
});
if (missingSeparateEntries.length > 0) {
  console.error(`build-client: separate bundle entry is missing: ${separateBundleEntryModule}`);
  process.exit(1);
}
const clientCompilerOptions = JSON.parse(readFileSync(join(root, 'tsconfig.client.json'), 'utf8')).compilerOptions;
const monacoTypeScriptConfig = {
  target: clientCompilerOptions.target,
  jsx: clientCompilerOptions.jsx,
  jsxImportSource: clientCompilerOptions.jsxImportSource,
  downlevelIteration: clientCompilerOptions.downlevelIteration,
  allowSyntheticDefaultImports: clientCompilerOptions.allowSyntheticDefaultImports,
  resolveJsonModule: clientCompilerOptions.resolveJsonModule,
};

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
    /* Generated from tsconfig.client.json; do not duplicate in source. */
    globalThis.__dshEditorTypeScriptConfig = ${JSON.stringify(monacoTypeScriptConfig)};
`;

/**
 * Remove only statement-level module syntax from compiled module text.
 *
 * The merged DSH factory cannot keep import/export declarations, but a text
 * regex would also alter the word "export" inside strings or comments. Parse
 * the compiled JavaScript and replace only AST-owned ranges, preserving line
 * breaks for readable diagnostics.
 * @param {string} source - compiled JavaScript module.
 * @returns {string} module body without import/export syntax.
 */
function stripModuleSyntax(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  let result = '';
  let cursor = 0;
  const eraseRange = (value) => '\n'.repeat((value.match(/\n/gu) ?? []).length);
  for (const statement of ast.program.body) {
    if (statement.type === 'ImportDeclaration' || statement.type === 'ExportAllDeclaration') {
      result += source.slice(cursor, statement.start);
      result += eraseRange(source.slice(statement.start, statement.end));
      cursor = statement.end;
      continue;
    }
    if (statement.type === 'ExportNamedDeclaration') {
      result += source.slice(cursor, statement.start);
      if (statement.declaration === null) {
        result += eraseRange(source.slice(statement.start, statement.end));
        cursor = statement.end;
      } else {
        result += eraseRange(source.slice(statement.start, statement.declaration.start));
        cursor = statement.declaration.start;
      }
      continue;
    }
    if (statement.type === 'ExportDefaultDeclaration') {
      result += source.slice(cursor, statement.start);
      result += eraseRange(source.slice(statement.start, statement.declaration.start));
      cursor = statement.declaration.start;
    }
  }
  return `${result}${source.slice(cursor)}`;
}

async function moduleSourceForBuild(name) {
  if (!name.endsWith('.ts') && !name.endsWith('.tsx')) {
    throw new Error(`build-client: expected a TypeScript module, received ${name}`);
  }
  const source = readFileSync(join(partsDir, name), 'utf8');
  /* Source imports document module dependencies for TS/ESLint, but the DSH
     artifact executes these modules in one factory scope. Remove the
     declarations before Babel so stripping them does not leave line gaps. */
  const sourceWithoutImports = stripModuleSyntax(source);
  const result = await transformAsync(sourceWithoutImports, {
    filename: name,
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: name.endsWith('.tsx'), allExtensions: true }],
      ...(name.endsWith('.tsx') ? ['@babel/plugin-transform-react-jsx'] : []),
    ],
    generatorOpts: {
      retainLines: true,
      compact: false,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  });
  const compiled = stripModuleSyntax(result.code ?? '').trimEnd();
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
const editorTabModelBody = stripModuleSyntax(editorTabModelResult.code ?? '').trimEnd();
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
const editorStyleModelBody = stripModuleSyntax(editorStyleModelResult.code ?? '').trimEnd();
if (editorStyleModelBody === '') {
  console.error('build-client: Babel produced an empty editor style model');
  process.exit(1);
}
const indentedEditorStyleModel = editorStyleModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorStyleModelModule = `\n    /* ─────────────────────── components/editor/editor-style-model.ts ─────────────────────── */\n${indentedEditorStyleModel}\n`;

const editorThemeModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'editor', 'editor-theme-model.ts'), 'utf8'),
  {
    filename: 'editor-theme-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const editorThemeModelBody = stripModuleSyntax(editorThemeModelResult.code ?? '').trimEnd();
if (editorThemeModelBody === '') {
  console.error('build-client: Babel produced an empty editor theme model');
  process.exit(1);
}
const indentedEditorThemeModel = editorThemeModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorThemeModelModule = `\n    /* ─────────────────────── components/editor/editor-theme-model.ts ─────────────────────── */\n${indentedEditorThemeModel}\n`;

const workspaceDirectoryModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'project', 'workspace-directory-model.ts'), 'utf8'),
  {
    filename: 'workspace-directory-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const workspaceDirectoryModelBody = stripModuleSyntax(workspaceDirectoryModelResult.code ?? '').trimEnd();
if (workspaceDirectoryModelBody === '') {
  console.error('build-client: Babel produced an empty workspace directory model');
  process.exit(1);
}
const indentedWorkspaceDirectoryModel = workspaceDirectoryModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const workspaceDirectoryModelModule = `\n    /* ─────────────────────── components/project/workspace-directory-model.ts ─────────────────────── */\n${indentedWorkspaceDirectoryModel}\n`;

const fileTreeViewResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'project', 'FileTreeView.tsx'), 'utf8'),
  {
    filename: 'FileTreeView.tsx',
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
const fileTreeViewBody = stripModuleSyntax(fileTreeViewResult.code ?? '').trimEnd();
if (fileTreeViewBody === '') {
  console.error('build-client: Babel produced an empty FileTreeView module');
  process.exit(1);
}
const indentedFileTreeView = fileTreeViewBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const fileTreeViewModule = `\n    /* ─────────────────────── components/project/FileTreeView.tsx ─────────────────────── */\n${indentedFileTreeView}\n`;

const workspaceDirectoryPickerResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'project', 'WorkspaceDirectoryPicker.tsx'), 'utf8'),
  {
    filename: 'WorkspaceDirectoryPicker.tsx',
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
const workspaceDirectoryPickerBody = stripModuleSyntax(workspaceDirectoryPickerResult.code ?? '').trimEnd();
if (workspaceDirectoryPickerBody === '') {
  console.error('build-client: Babel produced an empty WorkspaceDirectoryPicker module');
  process.exit(1);
}
const indentedWorkspaceDirectoryPicker = workspaceDirectoryPickerBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const workspaceDirectoryPickerModule = `\n    /* ─────────────────────── components/project/WorkspaceDirectoryPicker.tsx ─────────────────────── */\n${indentedWorkspaceDirectoryPicker}\n`;

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
const projectPanelBody = stripModuleSyntax(projectPanelResult.code ?? '').trimEnd();
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
const projectOptionsMenuBody = stripModuleSyntax(projectOptionsMenuResult.code ?? '').trimEnd();
if (projectOptionsMenuBody === '') {
  console.error('build-client: Babel produced an empty project options menu module');
  process.exit(1);
}
const indentedProjectOptionsMenu = projectOptionsMenuBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const projectOptionsMenuModule = `\n    /* ─────────────────────── components/project/project-options-menu.ts ─────────────────────── */\n${indentedProjectOptionsMenu}\n`;

const projectUploadDropResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'project', 'use-project-upload-drop.ts'), 'utf8'),
  {
    filename: 'use-project-upload-drop.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const projectUploadDropBody = stripModuleSyntax(projectUploadDropResult.code ?? '').trimEnd();
if (projectUploadDropBody === '') {
  console.error('build-client: Babel produced an empty project upload drop module');
  process.exit(1);
}
const indentedProjectUploadDrop = projectUploadDropBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const projectUploadDropModule = `\n    /* ─────────────────────── components/project/use-project-upload-drop.ts ─────────────────────── */\n${indentedProjectUploadDrop}\n`;

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
const commitPanelBody = stripModuleSyntax(commitPanelResult.code ?? '').trimEnd();
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
const commitOptionsMenuBody = stripModuleSyntax(commitOptionsMenuResult.code ?? '').trimEnd();
if (commitOptionsMenuBody === '') {
  console.error('build-client: Babel produced an empty commit options menu module');
  process.exit(1);
}
const indentedCommitOptionsMenu = commitOptionsMenuBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const commitOptionsMenuModule = `\n    /* ─────────────────────── components/commit/commit-options-menu.ts ─────────────────────── */\n${indentedCommitOptionsMenu}\n`;

const gitActionFailureReporterResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'commit', 'use-git-action-failure-reporter.ts'), 'utf8'),
  {
    filename: 'use-git-action-failure-reporter.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const gitActionFailureReporterBody = stripModuleSyntax(gitActionFailureReporterResult.code ?? '').trimEnd();
if (gitActionFailureReporterBody === '') {
  console.error('build-client: Babel produced an empty Git action failure reporter module');
  process.exit(1);
}
const indentedGitActionFailureReporter = gitActionFailureReporterBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const gitActionFailureReporterModule = `\n    /* ─────────────────────── components/commit/use-git-action-failure-reporter.ts ─────────────────────── */\n${indentedGitActionFailureReporter}\n`;

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
const stashShelveMenuBody = stripModuleSyntax(stashShelveMenuResult.code ?? '').trimEnd();
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
const commitLogMenuBody = stripModuleSyntax(commitLogMenuResult.code ?? '').trimEnd();
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
const commitFileMenuBody = stripModuleSyntax(commitFileMenuResult.code ?? '').trimEnd();
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
const commitLogGraphControllerBody = stripModuleSyntax(commitLogGraphControllerResult.code ?? '').trimEnd();
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
const commitLogFlatControllerBody = stripModuleSyntax(commitLogFlatControllerResult.code ?? '').trimEnd();
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
const commitLogListCommandModelBody = stripModuleSyntax(commitLogListCommandModelResult.code ?? '').trimEnd();
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
const commitLogScopeAnnouncementBody = stripModuleSyntax(commitLogScopeAnnouncementResult.code ?? '').trimEnd();
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
const commitLogShortcutModelBody = stripModuleSyntax(commitLogShortcutModelResult.code ?? '').trimEnd();
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
const commitLogSelectionModelBody = stripModuleSyntax(commitLogSelectionModelResult.code ?? '').trimEnd();
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
const commitLogViewModelBody = stripModuleSyntax(commitLogViewModelResult.code ?? '').trimEnd();
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
const commitLogViewPreferencesBody = stripModuleSyntax(commitLogViewPreferencesResult.code ?? '').trimEnd();
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
const namePromptBody = stripModuleSyntax(namePromptResult.code ?? '').trimEnd();
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
const revisionPickerBody = stripModuleSyntax(revisionPickerResult.code ?? '').trimEnd();
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
const commitSearchModelBody = stripModuleSyntax(commitSearchModelResult.code ?? '').trimEnd();
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
const moveToPickerBody = stripModuleSyntax(moveToPickerResult.code ?? '').trimEnd();
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
const codePreviewCodeBody = stripModuleSyntax(codePreviewCodeResult.code ?? '').trimEnd();
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
const editorStatusFactsBody = stripModuleSyntax(editorStatusFactsResult.code ?? '').trimEnd();
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
const markdownModeSwitchBody = stripModuleSyntax(markdownModeSwitchResult.code ?? '').trimEnd();
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
const imagePreviewPaneBody = stripModuleSyntax(imagePreviewPaneResult.code ?? '').trimEnd();
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
const markdownPreviewPaneBody = stripModuleSyntax(markdownPreviewPaneResult.code ?? '').trimEnd();
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
const workspaceFileModelBody = stripModuleSyntax(workspaceFileModelResult.code ?? '').trimEnd();
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
const workspaceImagePreviewBody = stripModuleSyntax(workspaceImagePreviewResult.code ?? '').trimEnd();
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
const editorPathModelBody = stripModuleSyntax(editorPathModelResult.code ?? '').trimEnd();
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
const editorDocumentModelBody = stripModuleSyntax(editorDocumentModelResult.code ?? '').trimEnd();
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
const markdownScrollModelBody = stripModuleSyntax(markdownScrollModelResult.code ?? '').trimEnd();
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
const editorNavigationModelBody = stripModuleSyntax(editorNavigationModelResult.code ?? '').trimEnd();
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
const editorFileTemplateModelBody = stripModuleSyntax(editorFileTemplateModelResult.code ?? '').trimEnd();
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
const editorLanguageModelBody = stripModuleSyntax(editorLanguageModelResult.code ?? '').trimEnd();
if (editorLanguageModelBody === '') {
  console.error('build-client: Babel produced an empty editor language model');
  process.exit(1);
}
const indentedEditorLanguageModel = editorLanguageModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorLanguageModelModule = `\n    /* ─────────────────────── components/editor/editor-language-model.ts ─────────────────────── */\n${indentedEditorLanguageModel}\n`;

const editorDefinitionNavigationModule = `\n    /* ─────────────────────── components/editor/editor-definition-navigation.ts ─────────────────────── */\n${await moduleSourceForBuild('components/editor/editor-definition-navigation.ts')}\n`;

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
const annotatePreviewBody = stripModuleSyntax(annotatePreviewResult.code ?? '').trimEnd();
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
const repositoryVersionPreviewBody = stripModuleSyntax(repositoryVersionPreviewResult.code ?? '').trimEnd();
if (repositoryVersionPreviewBody === '') {
  console.error('build-client: Babel produced an empty RepositoryVersionPreview module');
  process.exit(1);
}
const indentedRepositoryVersionPreview = repositoryVersionPreviewBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const repositoryVersionPreviewModule = `\n    /* ─────────────────────── components/diff/RepositoryVersionPreview.tsx ─────────────────────── */\n${indentedRepositoryVersionPreview}\n`;

const combinedDiffColorModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'diff', 'combined-diff-color-model.ts'), 'utf8'),
  {
    filename: 'combined-diff-color-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const combinedDiffColorModelBody = stripModuleSyntax(combinedDiffColorModelResult.code ?? '').trimEnd();
if (combinedDiffColorModelBody === '') {
  console.error('build-client: Babel produced an empty combined diff color model');
  process.exit(1);
}
const indentedCombinedDiffColorModel = combinedDiffColorModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const combinedDiffColorModelModule = `\n    /* ─────────────────────── components/diff/combined-diff-color-model.ts ─────────────────────── */\n${indentedCombinedDiffColorModel}\n`;

const conflictMarkerModelResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'diff', 'conflict-marker-model.ts'), 'utf8'),
  {
    filename: 'conflict-marker-model.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const conflictMarkerModelBody = stripModuleSyntax(conflictMarkerModelResult.code ?? '').trimEnd();
if (conflictMarkerModelBody === '') {
  console.error('build-client: Babel produced an empty conflict marker model');
  process.exit(1);
}
const indentedConflictMarkerModel = conflictMarkerModelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const conflictMarkerModelModule = `\n    /* ─────────────────────── components/diff/conflict-marker-model.ts ─────────────────────── */\n${indentedConflictMarkerModel}\n`;

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
const diffPreviewBody = stripModuleSyntax(diffPreviewResult.code ?? '').trimEnd();
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
const projectSelectionModelBody = stripModuleSyntax(projectSelectionModelResult.code ?? '').trimEnd();
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
const terminalScreenBody = stripModuleSyntax(terminalScreenResult.code ?? '').trimEnd();
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
const editorTerminalTabBody = stripModuleSyntax(editorTerminalTabResult.code ?? '').trimEnd();
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
const editorTerminalAreaBody = stripModuleSyntax(editorTerminalAreaResult.code ?? '').trimEnd();
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
const editorTerminalDockBody = stripModuleSyntax(editorTerminalDockResult.code ?? '').trimEnd();
if (editorTerminalDockBody === '') {
  console.error('build-client: Babel produced an empty EditorTerminalDock module');
  process.exit(1);
}
const indentedEditorTerminalDock = editorTerminalDockBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const editorTerminalDockModule = `\n    /* ─────────────────────── components/terminal/EditorTerminalDock.tsx ─────────────────────── */\n${indentedEditorTerminalDock}\n`;

const persistentTerminalDockOpenResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'terminal', 'use-persistent-terminal-dock-open.ts'), 'utf8'),
  {
    filename: 'use-persistent-terminal-dock-open.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const persistentTerminalDockOpenBody = stripModuleSyntax(persistentTerminalDockOpenResult.code ?? '').trimEnd();
if (persistentTerminalDockOpenBody === '') {
  console.error('build-client: Babel produced an empty persistent terminal dock open module');
  process.exit(1);
}
const indentedPersistentTerminalDockOpen = persistentTerminalDockOpenBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const persistentTerminalDockOpenModule = `\n    /* ─────────────────────── components/terminal/use-persistent-terminal-dock-open.ts ─────────────────────── */\n${indentedPersistentTerminalDockOpen}\n`;

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
const terminalPanelBody = stripModuleSyntax(terminalPanelResult.code ?? '').trimEnd();
if (terminalPanelBody === '') {
  console.error('build-client: Babel produced an empty TerminalPanel module');
  process.exit(1);
}
const indentedTerminalPanel = terminalPanelBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const terminalPanelModule = `\n    /* ─────────────────────── components/terminal/TerminalPanel.tsx ─────────────────────── */\n${indentedTerminalPanel}\n`;

const searchFileResultItemResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'SearchFileResultItem.tsx'), 'utf8'),
  {
    filename: 'SearchFileResultItem.tsx',
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
const searchFileResultItemBody = stripModuleSyntax(searchFileResultItemResult.code ?? '').trimEnd();
if (searchFileResultItemBody === '') {
  console.error('build-client: Babel produced an empty SearchFileResultItem module');
  process.exit(1);
}
const indentedSearchFileResultItem = searchFileResultItemBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const searchFileResultItemModule = `\n    /* ─────────────────────── components/search/SearchFileResultItem.tsx ─────────────────────── */\n${indentedSearchFileResultItem}\n`;

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
const searchEverywhereBody = stripModuleSyntax(searchEverywhereResult.code ?? '').trimEnd();
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
const showUsagesPopupBody = stripModuleSyntax(showUsagesPopupResult.code ?? '').trimEnd();
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
const quickOpenBody = stripModuleSyntax(quickOpenResult.code ?? '').trimEnd();
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
const findScopeEditorBody = stripModuleSyntax(findScopeEditorResult.code ?? '').trimEnd();
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
const findToolWindowBody = stripModuleSyntax(findToolWindowResult.code ?? '').trimEnd();
if (findToolWindowBody === '') {
  console.error('build-client: Babel produced an empty FindToolWindow module');
  process.exit(1);
}
const indentedFindToolWindow = findToolWindowBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const findToolWindowModule = `\n    /* ─────────────────────── components/search/FindToolWindow.tsx ─────────────────────── */\n${indentedFindToolWindow}\n`;

const searchReplaceConfirmationResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'search-replace-confirmation.ts'), 'utf8'),
  {
    filename: 'search-replace-confirmation.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const searchReplaceConfirmationBody = stripModuleSyntax(searchReplaceConfirmationResult.code ?? '').trimEnd();
if (searchReplaceConfirmationBody === '') {
  console.error('build-client: Babel produced an empty search replacement confirmation module');
  process.exit(1);
}
const indentedSearchReplaceConfirmation = searchReplaceConfirmationBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const searchReplaceConfirmationModule = `\n    /* ─────────────────────── components/search/search-replace-confirmation.ts ─────────────────────── */\n${indentedSearchReplaceConfirmation}\n`;

const searchScopeInvalidationResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'search-scope.ts'), 'utf8'),
  {
    filename: 'search-scope.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const searchScopeInvalidationBody = stripModuleSyntax(searchScopeInvalidationResult.code ?? '').trimEnd();
if (searchScopeInvalidationBody === '') {
  console.error('build-client: Babel produced an empty search scope invalidation module');
  process.exit(1);
}
const indentedSearchScopeInvalidation = searchScopeInvalidationBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const searchScopeInvalidationModule = `\n    /* ─────────────────────── components/search/search-scope.ts ─────────────────────── */\n${indentedSearchScopeInvalidation}\n`;

const searchEverywhereFileCandidatesResult = await transformAsync(
  readFileSync(join(partsDir, 'components', 'search', 'use-search-everywhere-file-candidates.ts'), 'utf8'),
  {
    filename: 'use-search-everywhere-file-candidates.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    generatorOpts: {
      retainLines: true,
      jsescOption: { quotes: 'single', minimal: true },
    },
    configFile: false,
    babelrc: false,
  },
);
const searchEverywhereFileCandidatesBody = stripModuleSyntax(searchEverywhereFileCandidatesResult.code ?? '').trimEnd();
if (searchEverywhereFileCandidatesBody === '') {
  console.error('build-client: Babel produced an empty Search Everywhere file-candidates module');
  process.exit(1);
}
const indentedSearchEverywhereFileCandidates = searchEverywhereFileCandidatesBody
  .split('\n')
  .map((line) => (line === '' ? '' : `    ${line}`))
  .join('\n');
const searchEverywhereFileCandidatesModule = `\n    /* ─────────────────────── components/search/use-search-everywhere-file-candidates.ts ─────────────────────── */\n${indentedSearchEverywhereFileCandidates}\n`;

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
const commitGraphFoldBarBody = stripModuleSyntax(commitGraphFoldBarResult.code ?? '').trimEnd();
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
const commitGraphStateModelBody = stripModuleSyntax(commitGraphStateModelResult.code ?? '').trimEnd();
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
const commitGraphRowBody = stripModuleSyntax(commitGraphRowResult.code ?? '').trimEnd();
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
const commitGraphBody = stripModuleSyntax(commitGraphResult.code ?? '').trimEnd();
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
const commitLogBody = stripModuleSyntax(commitLogResult.code ?? '').trimEnd();
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
const commitLogDetailPaneBody = stripModuleSyntax(commitLogDetailPaneResult.code ?? '').trimEnd();
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
const commitLogToolbarBody = stripModuleSyntax(commitLogToolbarResult.code ?? '').trimEnd();
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
const commitLogFlatRowBody = stripModuleSyntax(commitLogFlatRowResult.code ?? '').trimEnd();
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
const commitLogListStateBody = stripModuleSyntax(commitLogListStateResult.code ?? '').trimEnd();
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
const measuringScreenBody = stripModuleSyntax(measuringScreenResult.code ?? '').trimEnd();
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
const editorErrorBoundaryBody = stripModuleSyntax(editorErrorBoundaryResult.code ?? '').trimEnd();
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
const editorMountBody = stripModuleSyntax(editorMountResult.code ?? '').trimEnd();
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
const editorGotoLinePopupBody = stripModuleSyntax(editorGotoLinePopupResult.code ?? '').trimEnd();
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
const editorFindBarBody = stripModuleSyntax(editorFindBarResult.code ?? '').trimEnd();
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
const editorStatusBarBody = stripModuleSyntax(editorStatusBarResult.code ?? '').trimEnd();
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
const editorFileTabBody = stripModuleSyntax(editorFileTabResult.code ?? '').trimEnd();
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
const editorTabStripBody = stripModuleSyntax(editorTabStripResult.code ?? '').trimEnd();
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
const editorDiffTabBody = stripModuleSyntax(editorDiffTabResult.code ?? '').trimEnd();
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
const editorConflictBarsBody = stripModuleSyntax(editorConflictBarsResult.code ?? '').trimEnd();
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
const editorSplitHeaderBody = stripModuleSyntax(editorSplitHeaderResult.code ?? '').trimEnd();
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
const editorSplitPaneBody = stripModuleSyntax(editorSplitPaneResult.code ?? '').trimEnd();
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
const editorMainPaneBody = stripModuleSyntax(editorMainPaneResult.code ?? '').trimEnd();
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
const editorSplitDividerBody = stripModuleSyntax(editorSplitDividerResult.code ?? '').trimEnd();
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
const editorDiffAreaBody = stripModuleSyntax(editorDiffAreaResult.code ?? '').trimEnd();
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
const editorAnnotateAreaBody = stripModuleSyntax(editorAnnotateAreaResult.code ?? '').trimEnd();
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
const findToolDockBody = stripModuleSyntax(findToolDockResult.code ?? '').trimEnd();
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
const findToolPopupBody = stripModuleSyntax(findToolPopupResult.code ?? '').trimEnd();
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
const editorFileSurfaceBody = stripModuleSyntax(editorFileSurfaceResult.code ?? '').trimEnd();
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
const editorWorkspaceShellBody = stripModuleSyntax(editorWorkspaceShellResult.code ?? '').trimEnd();
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
const editorWorkspaceBodyBody = stripModuleSyntax(editorWorkspaceBodyResult.code ?? '').trimEnd();
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
const editorToolWindowPanelBody = stripModuleSyntax(editorToolWindowPanelResult.code ?? '').trimEnd();
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
const editorToolWindowResizerBody = stripModuleSyntax(editorToolWindowResizerResult.code ?? '').trimEnd();
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
const editorWorkspaceMainColumnBody = stripModuleSyntax(editorWorkspaceMainColumnResult.code ?? '').trimEnd();
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
const editorWorkspaceSurfaceBody = stripModuleSyntax(editorWorkspaceSurfaceResult.code ?? '').trimEnd();
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
const editorErrorBannerBody = stripModuleSyntax(editorErrorBannerResult.code ?? '').trimEnd();
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
  entryPoints: [separateBundleEntryPath],
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

const output = `${header}${editorTabModelModule}${editorStyleModelModule}${editorThemeModelModule}${body}${workspaceDirectoryModelModule}${fileTreeViewModule}${projectPanelModule}${projectOptionsMenuModule}${projectUploadDropModule}${commitPanelModule}${commitOptionsMenuModule}${gitActionFailureReporterModule}${stashShelveMenuModule}${commitLogMenuModule}${commitFileMenuModule}${commitLogGraphControllerModule}${commitLogFlatControllerModule}${commitLogListCommandModelModule}${commitLogScopeAnnouncementModule}${commitLogShortcutModelModule}${commitLogSelectionModelModule}${commitLogViewModelModule}${commitLogViewPreferencesModule}${namePromptModule}${commitSearchModelModule}${revisionPickerModule}${moveToPickerModule}${codePreviewCodeModule}${editorStatusFactsModule}${markdownModeSwitchModule}${imagePreviewPaneModule}${markdownPreviewPaneModule}${workspaceFileModelModule}${workspaceImagePreviewModule}${editorPathModelModule}${editorDocumentModelModule}${markdownScrollModelModule}${editorNavigationModelModule}${editorFileTemplateModelModule}${editorLanguageModelModule}${editorDefinitionNavigationModule}${annotatePreviewModule}${repositoryVersionPreviewModule}${combinedDiffColorModelModule}${conflictMarkerModelModule}${diffPreviewModule}${projectSelectionModelModule}${terminalScreenModule}${editorTerminalTabModule}${editorTerminalAreaModule}${editorTerminalDockModule}${persistentTerminalDockOpenModule}${terminalPanelModule}${searchFileResultItemModule}${searchEverywhereModule}${showUsagesPopupModule}${quickOpenModule}${findScopeEditorModule}${findToolWindowModule}${searchReplaceConfirmationModule}${searchScopeInvalidationModule}${searchEverywhereFileCandidatesModule}${commitGraphStateModelModule}${commitGraphFoldBarModule}${commitGraphRowModule}${commitGraphModule}${commitLogModule}${commitLogDetailPaneModule}${commitLogToolbarModule}${commitLogFlatRowModule}${commitLogListStateModule}${measuringScreenModule}${editorErrorBoundaryModule}${editorMountModule}${editorGotoLinePopupModule}${editorFindBarModule}${editorStatusBarModule}${editorFileTabModule}${editorTabStripModule}${editorDiffTabModule}${editorConflictBarsModule}${editorSplitHeaderModule}${editorSplitPaneModule}${editorMainPaneModule}${editorSplitDividerModule}${editorDiffAreaModule}${editorAnnotateAreaModule}${findToolDockModule}${findToolPopupModule}${workspaceDirectoryPickerModule}${editorFileSurfaceModule}${editorWorkspaceShellModule}${editorWorkspaceBodyModule}${editorToolWindowPanelModule}${editorToolWindowResizerModule}${editorWorkspaceMainColumnModule}${editorWorkspaceSurfaceModule}${editorErrorBannerModule}${uiPrelude}${footer}`;
const emittedModuleNames = [...output.matchAll(/\/\* ─+ ([^\s]+\.(?:ts|tsx)) ─+ \*\//gu)].map((match) => match[1]);
const unbundledRuntimeModules = findUnbundledRuntimeModules({
  clientDir: partsDir,
  entryModules: files,
  includedModules: emittedModuleNames,
  separatelyBundledEntries: [separateBundleEntryModule],
});
if (unbundledRuntimeModules.length > 0) {
  console.error(
    `build-client: imported runtime modules are missing from the bundle: ${unbundledRuntimeModules.join(', ')}`,
  );
  process.exit(1);
}
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
