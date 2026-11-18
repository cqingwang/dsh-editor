import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');

/**
 * Read one style object from the `styles` literal by brace balance.
 *
 * Comments are stripped first: the fix's own comment quotes the old
 * `marginRight: 6`, and a regex over the raw text would match the explanation
 * instead of the code.
 * @param {string} name - style key.
 * @returns {string} the style object source without comments.
 */
function styleBlock(name) {
  const start = source.indexOf(`      ${name}: {`);
  assert.notEqual(start, -1, `${name} is missing`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1).replace(/\/\*[\s\S]*?\*\//gu, '');
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/* ── indent guides: same depth must mean same x ─────────────────────────── */

test('both remaining indent columns occupy the same width', () => {
  /* A user screenshot had the last child of a subtree (README.md) sitting right of
     its siblings. Two independent causes, both in this file:
       1. `indentGuideCorner` carried `marginRight: 6` — last-child rows shifted.
       2. `content-box` sizing: a bordered 14px guide took 15px, an unbordered one
          14px — rows shifted by 1px depending on whether their column continued. */
  for (const name of ['indentGuide', 'indentGuideStop']) {
    const block = styleBlock(name);
    const width = /(?:^|\s)width: (\d+)/.exec(block);
    assert.notEqual(width, null, `${name} needs an explicit width`);
    assert.equal(Number(width[1]), 14, `${name} width must stay 14`);
    const margin = /marginRight: (\d+)/.exec(block);
    assert.ok(margin === null || Number(margin[1]) === 0, `${name} must not add a right margin`);
    /* Both bordered columns need border-box, or the border adds to the footprint. */
    assert.match(block, /boxSizing: 'border-box'/, `${name} must use border-box`);
  }
});

test('indent guides never draw an elbow', () => {
  assert.match(
    projectPanelSource,
    /const kind = guideKind\(\{[\s\S]*?continues: row\.continues,[\s\S]*?index,[\s\S]*?depth: row\.depth,[\s\S]*?\}\);/,
  );
  assert.match(projectPanelSource, /kind === 'line' \? styles\.indentGuide : styles\.indentGuideStop/);
  assert.doesNotMatch(projectPanelSource, /corner|indentGuideCorner/);
});

/* ── the collapse button sits on the tab labels, not on the strip ───────── */

test('the collapse button still has a comfortable click target', () => {
  const start = source.indexOf('function ensureChatToggle(');
  const block = source.slice(start, start + 4200);
  const width = /width:(\d+)px/.exec(block);
  const height = /height:(\d+)px/.exec(block);
  assert.notEqual(width, null, 'the toggle needs a fallback width');
  assert.notEqual(height, null, 'the toggle needs a fallback height');
  assert.ok(Number(width[1]) >= 24, `width ${width[1]}px should be at least 24px`);
  assert.ok(Number(height[1]) >= 24, `height ${height[1]}px should be at least 24px`);
});

test('the collapse button adopts the tab strip’s own tab height', () => {
  /* Explicit 28px made the button TALLER than a tab: the strip then pinned it to
     its top and the glyph landed ~4 CSS px below the labels (measured 39.5 vs 31.5
     device px at 2x). The box is read from a sibling tab instead of hard-coded. */
  const helper = source.slice(source.indexOf('function matchTabMetrics('), source.indexOf('* Insert the collapse/expand button'));
  assert.match(helper, /querySelector\('button\[role="tab"\]'\)/);
  assert.match(helper, /window\.getComputedStyle\(painted\)\.lineHeight/);
  /* Round 140 refined this: a host tab is 35px tall and hangs -10px above the
     25px strip, so copying its BOX (or its margin) made our button overhang the
     same way. The button now copies the strip's line box and the label's
     line-height, which is what actually puts the glyph on the text. */
  assert.match(helper, /const painted = tab\.querySelector\('span'\)/);
  assert.match(helper, /button\.style\.height = `\$\{Math\.round\(line \+ 8\)\}px`/);

  const create = source.slice(source.indexOf('function ensureChatToggle('), source.indexOf('Position the grab strip'));
  assert.match(create, /matchTabMetrics\(chatToggle, tablist\)/);
  /* And once more on every state sync: the host re-renders the strip. */
  assert.match(source, /matchTabMetrics\(chatToggle, chatToggle\.parentElement\)/);
});

test('the collapse button is out of flow, so it cannot re-flow the tabs', () => {
  /* As an in-flow flex child of the host's `flex-wrap: wrap` strip the button was
     the item that forced a new line: at ~380px the row doubled its height and the
     tabs moved onto a second line (measured rowH 25 -> 60 -> 116). Absolute
     positioning removes it from the strip's line breaking entirely. */
  const create = source.slice(source.indexOf('function ensureChatToggle('), source.indexOf('Position the grab strip'));
  assert.match(create, /position:absolute/);
  assert.match(create, /right:6px/);
  assert.match(create, /width:28px/);
  /* Its containing block is the tab ROW, not the tablist (which is only as wide
     as the tabs themselves). */
  assert.match(create, /tablist\.parentElement \?\? tablist\)\.appendChild\(chatToggle\)/);
  const css = source.slice(source.indexOf('function installStyles('), source.indexOf('document.head.appendChild(style)'));
  /* ...and the row reserves the button's width, or it would cover the last tab. */
  assert.match(css, /\[data-conversation-tabs\] \{ padding-right: 40px; box-sizing: border-box; \}/);
  assert.match(css, /\[data-conversation-tabs\] \{ position: relative; \}/);
});
