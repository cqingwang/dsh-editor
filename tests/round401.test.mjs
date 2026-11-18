import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const stripeSource = await readFile(new URL('../src/client/components/ui/ActivityStripe.tsx', import.meta.url), 'utf8');

test('the Harness close utility has a themed visible keyboard focus ring', () => {
  assert.match(source, /'\.dsh-editor-stripe-close:focus-visible \{',/);
  assert.match(source, /'  outline: 1px solid var\(--dsw-alias-state-business-primary\) !important;',/);
  assert.match(source, /'  outline-offset: -3px !important;',/);
  assert.match(source, /'  background: var\(--dsw-alias-interactive-bg-hover\) !important;',/);
});

test('the close utility remains a native keyboard-focusable button', () => {
  assert.match(stripeSource, /className='dsh-editor-stripe-item dsh-editor-stripe-close'/);
  assert.match(stripeSource, /onClick=\{onCloseEditor\}/);
  assert.doesNotMatch(stripeSource, /dsh-editor-stripe-close'[\s\S]{0,300}?tabIndex=/);
});
