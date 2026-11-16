import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist`);
  return source.slice(start, end);
}

test('the Editor host is reused across asynchronous React commits', () => {
  const ensureHost = block('function ensureHost(body) {', 'function idleHost()');
  assert.match(ensureHost, /host !== null && root !== null/);
  assert.match(ensureHost, /if \(hostParent !== null && host\.parentElement !== hostParent\)/);
  assert.match(ensureHost, /hostParent\.appendChild\(host\)/);
  assert.doesNotMatch(ensureHost, /childElementCount/);
  assert.doesNotMatch(ensureHost, /requestAnimationFrame/);
});

test('the Editor workspace has a local recoverable render-error boundary', () => {
  assert.match(source, /class EditorErrorBoundary extends React\.Component/);
  assert.match(source, /static getDerivedStateFromError\(error\)/);
  assert.match(source, /t\('editor\.loadFailed'\)/);
  assert.match(source, /t\('editor\.reloadEditor'\)/);
  assert.match(
    source,
    /React\.createElement\(\s*EditorErrorBoundary,[\s\S]*?React\.createElement\(EditorWorkspace,/,
  );
});

test('the render-error fallback keeps the Chat panel outside its failure scope', () => {
  const boundary = block(
    'class EditorErrorBoundary extends React.Component',
    '    /** The editor workspace:',
  );
  assert.doesNotMatch(boundary, /data-conversation-region="chat"/);
  assert.match(boundary, /role: 'alert'/);
  assert.match(boundary, /onClick: this\.reload/);
});

test('the boundary renders a recoverable alert instead of an empty host', () => {
  const boundarySource = block(
    'class EditorErrorBoundary extends React.Component',
    '    /** The editor workspace:',
  ).replace(/\n      \}\n    \}\n$/, '\n      }\n    }');
  class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
    }

    setState(updater) {
      const update = typeof updater === 'function' ? updater(this.state) : updater;
      this.state = { ...this.state, ...update };
    }
  }
  const React = {
    Component,
    createElement(type, props, ...children) {
      return { type, props: { ...props, children } };
    },
    cloneElement(child, props) {
      return { ...child, ...props };
    },
  };
  const styles = new Proxy({}, { get: () => ({}) });
  const Boundary = new Function(
    'React',
    'styles',
    `${boundarySource}\nreturn EditorErrorBoundary;`,
  )(React, styles);
  const boundary = new Boundary({
    t: (key) => key,
    workspaceId: 'workspace',
    children: { type: 'EditorWorkspace' },
  });
  boundary.state = { ...boundary.state, ...Boundary.getDerivedStateFromError(new Error('render exploded')) };
  const tree = boundary.render();
  assert.equal(tree.props.role, 'alert');
  assert.equal(tree.props.children[0].props.children[0], 'editor.loadFailed');
  const button = tree.props.children.find((child) => child?.type === 'button');
  assert.equal(button.props.children[0], 'editor.reloadEditor');
  button.props.onClick();
  assert.equal(boundary.state.error, null);
  assert.equal(boundary.state.generation, 1);
});
