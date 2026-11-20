import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const popup = await read('src/client/components/search/FindToolPopup.tsx');
const searchEverywhere = await read('src/client/components/search/SearchEverywhere.tsx');
const findTool = await read('src/client/components/search/FindToolWindow.tsx');
const workspace = await read('src/client/editor-workspace.tsx');
const workspaceDirectoryPicker = await read('src/client/components/project/WorkspaceDirectoryPicker.tsx');
const commit = await read('src/client/commit.ts');
const inlineStyles = await read('src/client/inline-styles.ts');
const uiStyles = await read('src/client/ui/styles.ts');

test('FloatingToolPopup owns shared drag, resize and backdrop behavior', () => {
  assert.match(popup, /function FloatingToolPopup\(/u);
  assert.match(popup, /const FLOATING_TOOL_POPUP_SURFACE_STYLE: React\.CSSProperties/u);
  assert.match(popup, /border: POPUP_BORDER/u);
  assert.match(
    uiStyles,
    /POPUP_BORDER =\s+'1px solid var\(--dsw-alias-border-selected, var\(--dsw-alias-border-l4, var\(--dsw-alias-border-l3\)\)\)'/u,
  );
  assert.match(popup, /\.\.\.FLOATING_TOOL_POPUP_SURFACE_STYLE/u);
  assert.match(popup, /FIND_POPUP_RESIZE_DIRECTIONS\.map/u);
  assert.match(popup, /moveFloatingPopupGeometry/u);
  assert.match(popup, /resizeFloatingPopupGeometry/u);
  assert.match(popup, /onGeometryChange/u);
  assert.match(popup, /onGeometryCommit/u);
  assert.match(popup, /data-dsh-floating-tool-popup=''/u);
  assert.match(popup, /onBackdropMouseDown/u);
  assert.match(popup, /styles\.paletteBackdrop/u);
  assert.match(popup, /pointerEvents: onBackdropMouseDown === undefined \? 'none' : 'auto'/u);
  assert.match(
    popup,
    /\.\.\.surfaceStyle,[\s\S]*?position: 'fixed',[\s\S]*?left: geometry\.x,[\s\S]*?top: geometry\.y,[\s\S]*?width: geometry\.width,[\s\S]*?height: geometry\.height,[\s\S]*?transform: 'none',/u,
  );
});

test('FloatingToolPopup owns one stacking contract for every business surface', () => {
  assert.match(popup, /const FLOATING_TOOL_POPUP_BACKDROP_Z_INDEX = 2499;/u);
  assert.match(popup, /const FLOATING_TOOL_POPUP_Z_INDEX = 2501;/u);
  assert.match(popup, /zIndex: FLOATING_TOOL_POPUP_BACKDROP_Z_INDEX,/u);
  assert.match(
    popup,
    /const FLOATING_TOOL_POPUP_SURFACE_STYLE: React\.CSSProperties = \{[\s\S]*?zIndex: FLOATING_TOOL_POPUP_Z_INDEX,/u,
  );
  for (const source of [inlineStyles, uiStyles]) {
    const findStyle = source.slice(source.indexOf('findToolPopup: {'), source.indexOf('findToolToolbar: {'));
    const searchStyle = source.slice(
      source.indexOf('searchEverywherePopup: {'),
      source.indexOf('searchEverywhereTabs: {'),
    );
    assert.doesNotMatch(findStyle, /zIndex:/u);
    assert.doesNotMatch(searchStyle, /zIndex:/u);
  }
  const pickerSurfaceStart = workspaceDirectoryPicker.indexOf('surfaceStyle={{');
  const pickerSurfaceEnd = workspaceDirectoryPicker.indexOf('}}>', pickerSurfaceStart);
  assert.ok(pickerSurfaceStart >= 0 && pickerSurfaceEnd > pickerSurfaceStart);
  assert.doesNotMatch(workspaceDirectoryPicker.slice(pickerSurfaceStart, pickerSurfaceEnd), /zIndex:/u);
});

test('Search Everywhere uses the same floating popup and drag surface', () => {
  assert.match(searchEverywhere, /onPopupDragStart/u);
  assert.match(searchEverywhere, /data-dsh-search-drag-surface/u);
  assert.doesNotMatch(searchEverywhere, /styles\.paletteBackdrop/u);
  assert.match(workspace, /SEARCH_EVERYWHERE_POPUP_GEOMETRY_STORAGE_KEY/u);
  assert.match(workspace, /readFloatingPopupGeometry/u);
  assert.match(workspace, /writeFloatingPopupGeometry/u);
  assert.match(workspace, /<FloatingToolPopup[\s\S]*?kind='searchEverywhere'/u);
  assert.match(workspace, /<FloatingToolPopup[\s\S]*?kind='find'/u);
});

test('Find and Search Everywhere share one backdrop implementation', () => {
  assert.match(workspace, /kind='searchEverywhere'[\s\S]{0,900}?backdrop=\{true\}/u);
  assert.match(workspace, /kind='find'[\s\S]{0,900}?backdrop=\{true\}/u);
  assert.match(workspace, /kind='searchEverywhere'[\s\S]{0,900}?onBackdropMouseDown=\{dismissSearchEverywhere\}/u);
  assert.match(workspace, /kind='find'[\s\S]{0,900}?onBackdropMouseDown=\{closeFindToolWindow\}/u);
  assert.doesNotMatch(workspace, /styles\.paletteBackdrop/u);
  assert.doesNotMatch(searchEverywhere, /styles\.paletteBackdrop/u);
  assert.doesNotMatch(findTool, /styles\.paletteBackdrop/u);
});

test('business popup content leaves border, background and shadow to the shared surface', () => {
  assert.doesNotMatch(searchEverywhere, /\.\.\.styles\.palette,/u);
  for (const source of [inlineStyles, uiStyles]) {
    const findSurface = source.slice(source.indexOf('findToolPopup: {'), source.indexOf('findToolToolbar: {'));
    const searchSurface = source.slice(
      source.indexOf('searchEverywherePopup: {'),
      source.indexOf('searchEverywhereTabs: {'),
    );
    for (const style of [findSurface, searchSurface]) {
      assert.doesNotMatch(style, /border:/u);
      assert.doesNotMatch(style, /borderRadius:/u);
      assert.doesNotMatch(style, /background:/u);
      assert.doesNotMatch(style, /boxShadow:/u);
    }
  }
});

test('Find delegates resize handles instead of duplicating them', () => {
  assert.doesNotMatch(findTool, /data-dsh-find-popup-resize/u);
  assert.doesNotMatch(findTool, /const popupResizeHandleStyle/u);
  assert.match(findTool, /onPopupDragStart/u);
});

test('generic geometry APIs retain Find defaults and support separate popup defaults', () => {
  assert.match(commit, /export function readFloatingPopupGeometry\(/u);
  assert.match(commit, /export function writeFloatingPopupGeometry\(/u);
  assert.match(commit, /export function clampFloatingPopupGeometry\(/u);
  assert.match(commit, /export function moveFloatingPopupGeometry\(/u);
  assert.match(commit, /export function resizeFloatingPopupGeometry\(/u);
  assert.match(commit, /FIND_POPUP_DEFAULT_WIDTH = 510/u);
  assert.match(commit, /FIND_POPUP_DEFAULT_HEIGHT = 440/u);
});

test('FloatingToolPopup reclamps geometry when the viewport shrinks', () => {
  assert.match(popup, /window\.addEventListener\('resize', handleViewportResize\)/u);
  assert.match(popup, /window\.removeEventListener\('resize', handleViewportResize\)/u);
  assert.match(popup, /clampFloatingPopupGeometry\(\s*current,\s*window\.innerWidth,\s*window\.innerHeight,?\s*\)/u);
  assert.match(popup, /onGeometryChange\(clampedGeometry\)/u);
  assert.equal((popup.match(/addEventListener\('resize'/gu) ?? []).length, 1);
  assert.equal((workspace.match(/addEventListener\('resize'/gu) ?? []).length, 0);
  assert.doesNotMatch(workspace, /onViewportResize/u);
});

test('business floating surface styles never own geometry', () => {
  for (const source of [inlineStyles, uiStyles]) {
    const findStyle = source.slice(source.indexOf('findToolPopup: {'), source.indexOf('findToolToolbar: {'));
    const searchStyle = source.slice(
      source.indexOf('searchEverywherePopup: {'),
      source.indexOf('searchEverywhereTabs: {'),
    );
    for (const style of [findStyle, searchStyle]) {
      assert.doesNotMatch(style, /position:/u);
      assert.doesNotMatch(style, /boxSizing:/u);
      assert.doesNotMatch(style, /left:/u);
      assert.doesNotMatch(style, /top:/u);
      assert.doesNotMatch(style, /transform:/u);
      assert.doesNotMatch(style, /(?:^|\s)width:/u);
      assert.doesNotMatch(style, /(?:^|\s)height:/u);
      assert.doesNotMatch(style, /minWidth:/u);
      assert.doesNotMatch(style, /minHeight:/u);
      assert.doesNotMatch(style, /maxHeight:/u);
    }
  }
});
