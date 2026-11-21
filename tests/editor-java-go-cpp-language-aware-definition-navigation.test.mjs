import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/code-navigation.ts', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const definitionNavigationSource = await readFile(
  new URL('../src/client/components/editor/editor-definition-navigation.ts', import.meta.url),
  'utf8',
);
const navigation = loadTypeScriptModule(source, [
  'definitionLanguageCandidates',
  'definitionSearchScopePatterns',
  'definitionSearchQuery',
  'definitionReceiverTypeAt',
  'findDefinitionInText',
  'rankDefinitionSearchMatches',
  'resolveWorkspaceDefinition',
]);

test('Java imports resolve package roots and static method imports', () => {
  const content = [
    'package com.acme.app;',
    'import com.acme.service.Helper;',
    'import static com.acme.util.Util.format;',
    'class Main {',
    '  void run() { Helper.work(); format("ok"); }',
    '}',
  ].join('\n');
  const sourcePath = 'src/main/java/com/acme/app/Main.java';

  const methodCandidates = navigation.definitionLanguageCandidates(content, sourcePath, 'work');
  assert.ok(
    methodCandidates.some(
      (candidate) => candidate.path === 'src/main/java/com/acme/service/Helper.java' && candidate.symbol === 'work',
    ),
  );

  const typeCandidates = navigation.definitionLanguageCandidates(content, sourcePath, 'Helper');
  assert.ok(
    typeCandidates.some(
      (candidate) => candidate.path === 'src/main/java/com/acme/service/Helper.java' && candidate.symbol === undefined,
    ),
  );

  const staticCandidates = navigation.definitionLanguageCandidates(content, sourcePath, 'format');
  assert.ok(
    staticCandidates.some(
      (candidate) => candidate.path === 'src/main/java/com/acme/util/Util.java' && candidate.symbol === 'format',
    ),
  );
});

test('C and C++ includes become direct declaration candidates', () => {
  const content = '#include "../include/helper.h"\n#include <acme/runtime.hpp>\nint main() { return helper(); }\n';
  const candidates = navigation.definitionLanguageCandidates(content, 'src/app/main.cpp', 'helper');

  assert.ok(candidates.some((candidate) => candidate.path === 'src/include/helper.h' && candidate.symbol === 'helper'));
  assert.ok(candidates.some((candidate) => candidate.path === 'acme/runtime.hpp' && candidate.symbol === 'helper'));
});

test('C and C++ headers resolve through ancestor source and include roots', () => {
  const content = '#include "net.h"\nvoid run(ncnn::Net& net) { net.load_param("model.param"); }\n';
  const candidates = navigation.definitionLanguageCandidates(
    content,
    'rustrun/crates/ncnn/examples/ppocrv5.cpp',
    'load_param',
  );

  assert.ok(
    candidates.some(
      (candidate) => candidate.path === 'rustrun/crates/ncnn/src/net.h' && candidate.symbol === 'load_param',
    ),
  );
});

test('C++ repeated include aliases read the target header once', async () => {
  const content = [
    '#include "./widget.h"',
    '#include "widget.h"',
    'void run() { Widget widget; widget.configure(1); }',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const readCounts = new Map();
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: call + 'configure'.length + 2,
    receiverType: 'Widget',
    readFile: async (candidate) => {
      readCounts.set(candidate, (readCounts.get(candidate) ?? 0) + 1);
      return candidate === 'examples/widget.h' ? 'class Widget {\npublic:\n  int configure(int mode);\n};\n' : null;
    },
    searchText: async () => {
      throw new Error('Repeated include should resolve directly from the normalized header');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 3,
    column: 7,
    endColumn: 16,
  });
  assert.equal(readCounts.get('examples/widget.h'), 1);
});

test('C++ include candidates deduplicate case aliases by filesystem identity', async () => {
  const content = [
    '#include "./Widget.h"',
    '#include "widget.h"',
    'void run() { Widget widget; widget.configure(1); }',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const readCounts = new Map();
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: call + 'configure'.length + 2,
    receiverType: 'Widget',
    pathIdentities: async (paths) =>
      paths.map((path) => ({
        path,
        identity: /(?:^|\/)(?:Widget|widget)\.h$/u.test(path) ? 'inode-widget' : path,
      })),
    readFile: async (candidate) => {
      readCounts.set(candidate, (readCounts.get(candidate) ?? 0) + 1);
      return /(?:^|\/)(?:Widget|widget)\.h$/u.test(candidate)
        ? 'class Widget {\npublic:\n  int configure(int mode);\n};\n'
        : null;
    },
    searchText: async () => {
      throw new Error('Case aliases should resolve from the same include file once');
    },
  });
  assert.match(result?.path ?? '', /(?:^|\/)(?:Widget|widget)\.h$/u);
  assert.equal(result?.line, 3);
  assert.equal(result?.column, 7);
  assert.equal(result?.endColumn, 16);
  assert.equal(
    [...readCounts.values()].reduce((total, count) => total + count, 0),
    1,
  );
});

test('C++ include candidates deduplicate symlink aliases without merging distinct files', async () => {
  const resolve = (content, identityAlias, readFile) => {
    const call = content.lastIndexOf('configure');
    return navigation.resolveWorkspaceDefinition({
      path: 'examples/run.cpp',
      content,
      symbol: 'configure',
      callOffset: call + 'configure'.length + 2,
      receiverType: 'Widget',
      pathIdentities: async (paths) => paths.map((path) => ({ path, identity: identityAlias(path) })),
      readFile,
      searchText: async () => {
        throw new Error('Filesystem identities should resolve the include candidate directly');
      },
    });
  };

  const linkedContent = [
    '#include "real.h"',
    '#include "link.h"',
    'void run() { Widget widget; widget.configure(1); }',
  ].join('\n');
  const linkedReads = [];
  const linked = await resolve(
    linkedContent,
    (path) => (/(?:^|\/)(?:real|link)\.h$/u.test(path) ? 'inode-widget' : path),
    async (candidate) => {
      linkedReads.push(candidate);
      return /(?:^|\/)(?:real|link)\.h$/u.test(candidate)
        ? 'class Widget {\npublic:\n  int configure(int mode);\n};\n'
        : null;
    },
  );
  assert.equal(linked?.line, 3);
  assert.equal(linkedReads.length, 1);

  const distinctContent = [
    '#include "Widget.h"',
    '#include "widget.h"',
    'void run() { Widget widget; widget.configure(1); }',
  ].join('\n');
  const distinctReads = [];
  const distinct = await resolve(
    distinctContent,
    (path) => path,
    async (candidate) => {
      distinctReads.push(candidate);
      return /(?:^|\/)(?:Widget|widget)\.h$/u.test(candidate)
        ? 'class Widget {\npublic:\n  int configure(int mode);\n};\n'
        : null;
    },
  );
  assert.equal(distinct?.line, 3);
  assert.equal(distinctReads.length, 2);
});

test('C++ declaration navigation prefers declarations over implementations', async () => {
  const content = [
    'int helper(int value) { return value; }',
    'int helper(int value);',
    'void run() { helper(1); }',
  ].join('\n');
  const call = content.lastIndexOf('helper');
  const declaration = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'helper',
    callOffset: call + 'helper'.length + 2,
    readFile: async () => null,
    searchText: async () => {
      throw new Error('Local declaration should resolve directly');
    },
  });
  assert.deepEqual(declaration, {
    path: 'examples/run.cpp',
    line: 2,
    column: 5,
    endColumn: 11,
  });

  const implementationOnly = ['int helper(int value) { return value; }', 'void run() { helper(1); }'].join('\n');
  const implementationCall = implementationOnly.lastIndexOf('helper');
  const implementation = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content: implementationOnly,
    symbol: 'helper',
    callOffset: implementationCall + 'helper'.length + 2,
    readFile: async () => null,
    searchText: async () => {
      throw new Error('Implementation-only navigation should resolve directly');
    },
  });
  assert.equal(implementation?.line, 1);
});

test('C++ implementation navigation selects bodies without changing declaration behavior', async () => {
  const content = [
    'int helper(int value) { return value; }',
    'int helper(int value);',
    'void run() { helper(1); }',
  ].join('\n');
  const call = content.lastIndexOf('helper');
  const symbolOffset = call + 'helper'.length + 2;
  const resolve = (targetKind) =>
    navigation.resolveWorkspaceDefinition({
      path: 'examples/run.cpp',
      content,
      symbol: 'helper',
      callOffset: symbolOffset,
      targetKind,
      readFile: async () => null,
      searchText: async () => {
        throw new Error('Local declaration and implementation should resolve directly');
      },
    });

  assert.equal((await resolve('declaration'))?.line, 2);
  assert.equal((await resolve('implementation'))?.line, 1);
});

test('C++ implementation navigation skips declaration-only headers', async () => {
  const content = ['#include "helper.h"', 'void run() { helper(1); }'].join('\n');
  const call = content.lastIndexOf('helper');
  let searched = false;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'helper',
    callOffset: call + 'helper'.length + 2,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/helper.h') return 'int helper(int value);\n';
      if (candidate === 'examples/helper.cpp') return 'int helper(int value) { return value; }\n';
      return null;
    },
    searchText: async () => {
      searched = true;
      return [{ path: 'src/helper.cpp' }];
    },
  });
  assert.deepEqual(result, {
    path: 'examples/helper.cpp',
    line: 1,
    column: 5,
    endColumn: 11,
  });
  assert.equal(searched, false);
});

test('C++ implementation navigation follows transitive header siblings', async () => {
  const content = ['#include "net.h"', 'void run() { softmax->load_param(pd); }'].join('\n');
  const call = content.lastIndexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType: 'Layer',
    callOffset: call + 'load_param'.length + 2,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/net.h') return '#include "layer.h"\nclass Net {};\n';
      if (candidate === 'examples/net.cpp') {
        return '#include "net.h"\nint Net::load_param(const DataReader& dr) { return 0; }\n';
      }
      if (candidate === 'examples/layer.h') {
        return 'class Layer {\npublic:\n  virtual int load_param(const ParamDict& pd);\n};\n';
      }
      if (candidate === 'examples/layer.cpp') {
        return '#include "layer.h"\nint Layer::load_param(const ParamDict& pd) { return 0; }\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Transitive header sibling should resolve implementation directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 2,
    column: 12,
    endColumn: 22,
  });
});

test('C++ implementation navigation filters same-file receivers', async () => {
  const content = ['#include "layer.h"', 'void run(Layer* layer) {', '  layer->load_param(pd);', '}'].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType: 'Layer',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return 'class Layer {\npublic:\n  int load_param(const ParamDict& pd);\n};\n';
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'int Net::load_param(const ParamDict& pd) { return 0; }',
          'int Layer::load_param(const ParamDict& pd) { return 0; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Sibling implementation should filter by receiver directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 3,
    column: 12,
    endColumn: 22,
  });
});

test('C++ implementation navigation prefers qualified members over earlier free functions', async () => {
  const content = ['#include "layer.h"', 'void run(Layer* layer) {', '  layer->load_param(pd);', '}'].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType: 'Layer',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return ['class Layer {', 'public:', '  int load_param(const ParamDict& pd);', '};'].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'int load_param(const ParamDict& pd) { return 0; }',
          'int Layer::load_param(const ParamDict& pd) { return 1; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Qualified member implementation should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 3,
    column: 12,
    endColumn: 22,
  });
});

test('C++ implementation navigation keeps an unqualified inline member fallback', async () => {
  const content = ['#include "layer.h"', 'void run(Layer* layer) {', '  layer->load_param(pd);', '}'].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType: 'Layer',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return ['class Layer {', 'public:', '  int load_param(const ParamDict& pd) { return 1; }', '};'].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Inline member implementation should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.h',
    line: 3,
    column: 7,
    endColumn: 17,
  });
});

test('C++ implementation navigation filters unqualified inline members by enclosing class', async () => {
  const content = ['#include "layer.h"', 'void run(Layer* layer) {', '  layer->load_param(1);', '}'].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType: 'Layer',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'class Other {',
          'public:',
          '  int load_param(int value) { return 0; }',
          '};',
          'class Layer {',
          'public:',
          '  int load_param(int value) { return 1; }',
          '};',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Inline member scope should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.h',
    line: 7,
    column: 7,
    endColumn: 17,
  });
});

test('C++ implementation navigation reads class scope through a multiline base clause', async () => {
  const content = ['#include "layer.h"', 'void run(Layer* layer) {', '  layer->load_param(1);', '}'].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType: 'Layer',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'class Other {',
          'public:',
          '  int load_param(int value) { return 0; }',
          '};',
          'class Layer',
          '  : public Base',
          '{',
          'public:',
          '  int load_param(int value) { return 1; }',
          '};',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Multiline class scope should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.h',
    line: 9,
    column: 7,
    endColumn: 17,
  });
});

test('C++ implementation navigation reads class scope through declaration attributes', async () => {
  const content = ['#include "layer.h"', 'void run(Layer* layer) {', '  layer->load_param(1);', '}'].join('\n');
  const call = content.indexOf('load_param');
  for (const declaration of [
    'struct alignas(16) Layer {',
    'class __declspec(dllexport) Layer {',
    'struct __attribute__((packed)) Layer {',
    'class LAYER_API Layer {',
  ]) {
    const result = await navigation.resolveWorkspaceDefinition({
      path: 'examples/run.cpp',
      content,
      symbol: 'load_param',
      receiverType: 'Layer',
      callOffset: call + 'load_param'.length,
      targetKind: 'implementation',
      readFile: async (candidate) => {
        if (candidate === 'examples/layer.h') {
          return [
            'class Other {',
            'public:',
            '  int load_param(int value) { return 0; }',
            '};',
            declaration,
            'public:',
            '  int load_param(int value) { return 1; }',
            '};',
          ].join('\n');
        }
        return null;
      },
      searchText: async () => {
        throw new Error('Attributed class scope should resolve directly');
      },
    });
    assert.deepEqual(result, {
      path: 'examples/layer.h',
      line: 7,
      column: 7,
      endColumn: 17,
    });
  }
});

test('C++ implementation navigation matches qualified receiver namespaces', async () => {
  const content = ['#include "layer.h"', 'void run(alpha::Layer* layer) {', '  layer->load_param(nullptr);', '}'].join(
    '\n',
  );
  const call = content.indexOf('load_param');
  for (const receiverType of ['alpha::Layer', '::alpha::Layer']) {
    const result = await navigation.resolveWorkspaceDefinition({
      path: 'examples/run.cpp',
      content,
      symbol: 'load_param',
      receiverType,
      callOffset: call + 'load_param'.length,
      targetKind: 'implementation',
      readFile: async (candidate) => {
        if (candidate === 'examples/layer.h') {
          return [
            'namespace alpha {',
            'class Layer {',
            'public:',
            '  int load_param(const ParamDict& pd);',
            '};',
            '}',
          ].join('\n');
        }
        if (candidate === 'examples/layer.cpp') {
          return [
            '#include "layer.h"',
            'int beta::Layer::load_param(const ParamDict& pd) { return 0; }',
            'int alpha::Layer::load_param(const ParamDict& pd) { return 0; }',
          ].join('\n');
        }
        return null;
      },
      searchText: async () => {
        throw new Error('Qualified receiver implementation should resolve directly');
      },
    });
    assert.deepEqual(result, {
      path: 'examples/layer.cpp',
      line: 3,
      column: 19,
      endColumn: 29,
    });
  }
});

test('C++ implementation navigation supports class template receivers', async () => {
  const content = [
    '#include "layer.h"',
    'void run(alpha::Layer<int>* layer) {',
    '  layer->load_param(nullptr);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const receiverType = navigation.definitionReceiverTypeAt(content, call, 'load_param', true);
  assert.equal(receiverType, 'alpha::Layer');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType,
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'namespace alpha {',
          'template <class T>',
          'class Layer {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'template <class T>',
          'int beta::Layer<T>::load_param(const ParamDict& pd) { return 0; }',
          'int alpha::Layer<T>::load_param(const ParamDict& pd) { return 0; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Template receiver implementation should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 4,
    column: 22,
    endColumn: 32,
  });
});

test('C++ implementation navigation prefers explicit template specializations', async () => {
  const content = [
    '#include "layer.h"',
    'void run(alpha::Layer<int>* layer) {',
    '  layer->load_param(nullptr);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType: 'alpha::Layer',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'namespace alpha {',
          'template <class T>',
          'class Layer {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'template <class T>',
          'int alpha::Layer<T>::load_param(const ParamDict& pd) { return 0; }',
          'int alpha::Layer<int>::load_param(const ParamDict& pd) { return 1; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Specialized implementation should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 4,
    column: 24,
    endColumn: 34,
  });
});

test('C++ implementation navigation keeps nested template arguments in receiver qualification', async () => {
  const content = [
    '#include "layer.h"',
    'void run(alpha::Layer<alpha::Config<int>>* layer) {',
    '  layer->load_param(nullptr);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'namespace alpha {',
          'template <class T>',
          'class Layer {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'int beta::Layer<beta::Config<int>>::load_param(const ParamDict& pd) { return 0; }',
          'template <class T>',
          'int alpha::Layer<T>::load_param(const ParamDict& pd) { return 0; }',
          'int alpha::Layer<alpha::Config<int>>::load_param(const ParamDict& pd) { return 1; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Nested template receiver implementation should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 5,
    column: 39,
    endColumn: 49,
  });
});

test('C++ implementation navigation recognizes long generic template parameter names', async () => {
  const content = [
    '#include "layer.h"',
    'void run(alpha::Layer<alpha::Config<int>>* layer) {',
    '  layer->load_param(nullptr);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'namespace alpha {',
          'template <class T>',
          'class Layer {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'template <>',
          'int alpha::Layer<alpha::Pair<int,int>>::load_param(const ParamDict& pd) { return 0; }',
          'template <typename ElementType>',
          'int alpha::Layer<ElementType>::load_param(const ParamDict& pd) { return 1; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Generic template implementation should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 5,
    column: 32,
    endColumn: 42,
  });
});

test('C++ implementation navigation keeps outer template parameters ahead of template-template parameters', async () => {
  const content = [
    '#include "layer.h"',
    'void run(alpha::Layer<alpha::Config<int>>* layer) {',
    '  layer->load_param(nullptr);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'namespace alpha {',
          'template <class T>',
          'class Layer {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'template <>',
          'int alpha::Layer<alpha::Pair<int,int>>::load_param(const ParamDict& pd) { return 0; }',
          'template <template <class> class Container, class ElementType>',
          'int alpha::Layer<Container<ElementType>>::load_param(const ParamDict& pd) { return 1; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Template-template parameter implementation should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 5,
    column: 43,
    endColumn: 53,
  });
});

test('C++ implementation navigation merges consecutive outer template parameter lists', async () => {
  const content = [
    '#include "layer.h"',
    'void run(alpha::Layer<alpha::Config<int>>* layer) {',
    '  layer->load_param(1);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'namespace alpha {',
          'template <class T>',
          'class Layer {',
          'public:',
          '  template <class U>',
          '  int load_param(U value);',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'template <>',
          'int alpha::Layer<alpha::Pair<int,int>>::load_param(int value) { return 0; }',
          'template <class ElementType>',
          'template <class ValueType>',
          'int alpha::Layer<ElementType>::load_param(int value) { return 1; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Consecutive template parameter lists should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 6,
    column: 32,
    endColumn: 42,
  });
});

test('C++ implementation navigation excludes concrete specializations for a different receiver type', async () => {
  const content = [
    '#include "layer.h"',
    'void run(alpha::Layer<alpha::Config<int>>* layer) {',
    '  layer->load_param(1);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'namespace alpha {',
          'template <class T>',
          'class Layer {',
          'public:',
          '  template <class U>',
          '  int load_param(U value);',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'template <>',
          'int alpha::Layer<alpha::Pair<int,int>>::load_param(int value) { return 0; }',
          'template <class ElementType>',
          'template <class ValueType>',
          'int alpha::Layer<ElementType>::load_param(ValueType value) { return 1; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Mismatched concrete specialization should be excluded');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 6,
    column: 32,
    endColumn: 42,
  });
});

test('C++ implementation navigation supports nested template receivers', async () => {
  const content = [
    '#include "layer.h"',
    'void run(alpha::Outer<int>::Inner* layer) {',
    '  layer->load_param(nullptr);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const receiverType = navigation.definitionReceiverTypeAt(content, call, 'load_param', true);
  assert.equal(receiverType, 'alpha::Outer::Inner');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType,
    callOffset: call + 'load_param'.length,
    targetKind: 'implementation',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return [
          'namespace alpha {',
          'template <class T>',
          'class Outer {',
          'public:',
          '  class Inner {',
          '  public:',
          '    int load_param(const ParamDict& pd);',
          '  };',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/layer.cpp') {
        return [
          '#include "layer.h"',
          'template <class T>',
          'int beta::Outer<T>::Inner::load_param(const ParamDict& pd) { return 0; }',
          'int alpha::Outer<T>::Inner::load_param(const ParamDict& pd) { return 0; }',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Nested template receiver implementation should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/layer.cpp',
    line: 4,
    column: 29,
    endColumn: 39,
  });
});

test('C++ declaration search ranks headers ahead of implementation files', () => {
  const matches = [{ path: 'src/helper.cpp' }, { path: 'include/helper.h' }];
  const ranked = navigation.rankDefinitionSearchMatches(matches, 'src/main.cpp');
  assert.equal(ranked[0].path, 'include/helper.h');
  const implementation = navigation.rankDefinitionSearchMatches(matches, 'src/main.cpp', 'implementation');
  assert.equal(implementation[0].path, 'src/helper.cpp');
});

test('C++ receiver type disambiguates methods declared in sibling headers', async () => {
  const content = [
    '#include "layer.h"',
    '#include "net.h"',
    'void run() {',
    '  ncnn::Net ppocrv5_det;',
    '  ppocrv5_det.load_param("model.param");',
    '}',
  ].join('\n');
  const offset = content.lastIndexOf('load_param');
  assert.equal(navigation.definitionReceiverTypeAt(content, offset + 3, 'load_param'), 'Net');

  const result = await navigation.resolveWorkspaceDefinition({
    path: 'rustrun/crates/ncnn/examples/ppocrv5.cpp',
    content,
    symbol: 'load_param',
    receiverType: 'Net',
    readFile: async (candidate) => {
      if (candidate === 'rustrun/crates/ncnn/src/layer.h') {
        return 'class Layer {\npublic:\n  virtual int load_param(const ParamDict& pd);\n};\n';
      }
      if (candidate === 'rustrun/crates/ncnn/src/net.h') {
        return 'class NCNN_EXPORT Net {\npublic:\n  int load_param(const char* path);\n};\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Sibling headers should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'rustrun/crates/ncnn/src/net.h',
    line: 3,
    column: 7,
    endColumn: 17,
  });
});

test('C++ receiver declarations support pointers references const and class members', () => {
  const pointer = ['ncnn::Layer* softmax = ncnn::create_layer("Softmax");', 'softmax->load_param(pd);'].join('\n');
  const pointerOffset = pointer.indexOf('load_param');
  assert.equal(navigation.definitionReceiverTypeAt(pointer, pointerOffset, 'load_param'), 'Layer');

  const reference = ['const ncnn::Net& detector = other;', 'detector.load_param("model.param");'].join('\n');
  const referenceOffset = reference.indexOf('load_param');
  assert.equal(navigation.definitionReceiverTypeAt(reference, referenceOffset, 'load_param'), 'Net');

  const member = [
    'class Runner {',
    '  const ncnn::Net& detector;',
    '  void run() { detector.load_param("model.param"); }',
    '};',
  ].join('\n');
  const memberOffset = member.indexOf('load_param');
  assert.equal(navigation.definitionReceiverTypeAt(member, memberOffset, 'load_param'), 'Net');
});

test('C++ receiver types flow to later declarators in the same statement', () => {
  const matrices = ['ncnn::Mat score, points;', 'int height = points.h;'].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(matrices, matrices.indexOf('h;'), 'h'), 'Mat');

  const vectors = ['std::vector<float> x_, y_;', 'y_.push_back(1.0f);'].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(vectors, vectors.indexOf('push_back'), 'push_back'), 'vector');
});

test('C++ auto declarations infer directly initialized receiver types', () => {
  const direct = ['auto detector = ncnn::Net();', 'detector.load_param("model.param");'].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(direct, direct.indexOf('load_param'), 'load_param'), 'Net');

  const constructed = ['auto* layer = new ncnn::Layer();', 'layer->load_param(pd);'].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(constructed, constructed.indexOf('load_param'), 'load_param'),
    'Layer',
  );

  const cast = ['auto* layer = static_cast<ncnn::Layer*>(source);', 'layer->load_param(pd);'].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(cast, cast.indexOf('load_param'), 'load_param'), 'Layer');

  const unique = ['auto detector = std::make_unique<ncnn::Net>();', 'detector->load_param("model.param");'].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(unique, unique.indexOf('load_param'), 'load_param'), 'Net');
});

test('C++ auto declarations support multiline initializers and known factory returns', () => {
  const multiline = ['auto detector =', '    ncnn::Net();', 'detector.load_param("model.param");'].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(multiline, multiline.indexOf('load_param'), 'load_param'), 'Net');

  const multilineNew = ['auto* layer =', '    new ncnn::Layer();', 'layer->load_param(pd);'].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(multilineNew, multilineNew.indexOf('load_param'), 'load_param'),
    'Layer',
  );

  const factory = [
    'static ncnn::Net create_detector();',
    'auto detector = create_detector();',
    'detector.load_param("model.param");',
  ].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(factory, factory.indexOf('load_param'), 'load_param'), 'Net');
});

test('C++ auto declarations do not guess unknown or forward-declared factories', () => {
  const unknown = ['auto detector = create_detector();', 'detector.load_param("model.param");'].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(unknown, unknown.indexOf('load_param'), 'load_param'), '');

  const forward = [
    'auto detector = create_detector();',
    'detector.load_param("model.param");',
    'static ncnn::Net create_detector();',
  ].join('\n');
  assert.equal(navigation.definitionReceiverTypeAt(forward, forward.indexOf('load_param'), 'load_param'), '');
});

test('C++ template receivers unwrap smart pointers and degrade generic templates', async () => {
  const vector = ['std::vector<float> values;', 'values.push_back(1.0f);'].join('\n');
  const vectorOffset = vector.indexOf('push_back');
  assert.equal(navigation.definitionReceiverTypeAt(vector, vectorOffset, 'push_back'), 'vector');
  assert.equal(navigation.definitionReceiverTypeAt(vector, vectorOffset, 'push_back', true), '');

  const classTemplate = ['alpha::Layer<int>* layer;', 'layer->load_param(pd);'].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(classTemplate, classTemplate.indexOf('load_param'), 'load_param', true),
    'alpha::Layer',
  );

  const content = [
    '#include "layer.h"',
    '#include "net.h"',
    'void run() {',
    '  std::unique_ptr<ncnn::Net> detector;',
    '  detector->load_param(pd);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const receiverType = navigation.definitionReceiverTypeAt(content, call + 'load_param'.length + 2, 'load_param', true);
  assert.equal(receiverType, 'ncnn::Net');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: call + 'load_param'.length + 2,
    receiverType,
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return 'namespace ncnn {\nclass Layer {\npublic:\n  int load_param(const ParamDict& pd);\n};\n}\n';
      }
      if (candidate === 'examples/net.h') {
        return 'namespace ncnn {\nclass Net {\npublic:\n  int load_param(const ParamDict& pd);\n};\n}\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Smart pointer receiver should resolve the element type directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/net.h',
    line: 4,
    column: 7,
    endColumn: 17,
  });
});

test('C++ receiver aliases resolve using and typedef targets', () => {
  const usingAlias = ['using Detector = ncnn::Net;', 'Detector detector;', 'detector.load_param(pd);'].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(usingAlias, usingAlias.indexOf('load_param'), 'load_param', true),
    'ncnn::Net',
  );

  const typedefAlias = ['typedef ncnn::Layer LayerAlias;', 'LayerAlias layer;', 'layer.load_param(pd);'].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(typedefAlias, typedefAlias.indexOf('load_param'), 'load_param', true),
    'ncnn::Layer',
  );

  const smartPointerAlias = [
    'using LayerPtr = std::unique_ptr<ncnn::Layer>;',
    'LayerPtr layer;',
    'layer->load_param(pd);',
  ].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(smartPointerAlias, smartPointerAlias.indexOf('load_param'), 'load_param', true),
    'ncnn::Layer',
  );
});

test('C++ receiver aliases stay bounded across chains and unsafe templates', () => {
  const chain = [
    'using NetAlias = ncnn::Net;',
    'using Detector = NetAlias;',
    'Detector detector;',
    'detector.load_param(pd);',
  ].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(chain, chain.indexOf('load_param'), 'load_param', true),
    'ncnn::Net',
  );

  const genericAlias = ['using Values = std::vector<int>;', 'Values values;', 'values.push_back(1);'].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(genericAlias, genericAlias.indexOf('push_back'), 'push_back', true),
    '',
  );

  const inactive = [
    '#if 0',
    'using Detector = ncnn::Net;',
    '#else',
    'using Detector = ncnn::Layer;',
    '#endif',
    'Detector detector;',
    'detector.load_param(pd);',
  ].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(inactive, inactive.indexOf('load_param'), 'load_param', true),
    'ncnn::Layer',
  );

  const forwardAlias = ['Detector detector;', 'detector.load_param(pd);', 'using Detector = ncnn::Net;'].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(forwardAlias, forwardAlias.indexOf('load_param'), 'load_param', true),
    'Detector',
  );
});

test('C++ namespace receiver aliases preserve the declaring scope', async () => {
  const content = [
    '#include "alpha_net.h"',
    '#include "ncnn_net.h"',
    'namespace ncnn {',
    'using Detector = Net;',
    'Detector detector;',
    'detector.load_param(pd);',
    '}',
  ].join('\n');
  const offset = content.indexOf('load_param');
  const receiverType = navigation.definitionReceiverTypeAt(content, offset, 'load_param', true);
  assert.equal(receiverType, 'ncnn::Net');

  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: offset,
    receiverType,
    readFile: async (candidate) => {
      if (candidate === 'examples/alpha_net.h') {
        return 'namespace alpha {\nclass Net {\npublic:\n  int load_param(const ParamDict& pd);\n};\n}\n';
      }
      if (candidate === 'examples/ncnn_net.h') {
        return 'namespace ncnn {\nclass Net {\npublic:\n  int load_param(const ParamDict& pd);\n};\n}\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Namespace-relative alias should disambiguate the concrete header');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/ncnn_net.h',
    line: 4,
    column: 7,
    endColumn: 17,
  });
});

test('C++ namespace receiver aliases qualify nested target prefixes', async () => {
  const content = [
    '#include "alpha_net.h"',
    '#include "ncnn_net.h"',
    'namespace ncnn {',
    'using Detector = detail::Net;',
    'Detector detector;',
    'detector.load_param(pd);',
    '}',
  ].join('\n');
  const offset = content.indexOf('load_param');
  const receiverType = navigation.definitionReceiverTypeAt(content, offset, 'load_param', true);
  assert.equal(receiverType, 'ncnn::detail::Net');

  const alreadyQualified = [
    'namespace ncnn {',
    'using Detector = ncnn::Net;',
    'Detector detector;',
    'detector.configure();',
    '}',
  ].join('\n');
  assert.equal(
    navigation.definitionReceiverTypeAt(alreadyQualified, alreadyQualified.indexOf('configure'), 'configure', true),
    'ncnn::Net',
  );

  const standardTarget = ['namespace ncnn {', 'using Text = std::string;', 'Text text;', 'text.size();', '}'].join(
    '\n',
  );
  assert.equal(
    navigation.definitionReceiverTypeAt(standardTarget, standardTarget.indexOf('size'), 'size', true),
    'std::string',
  );

  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: offset,
    receiverType,
    readFile: async (candidate) => {
      if (candidate === 'examples/alpha_net.h') {
        return [
          'namespace alpha {',
          'namespace detail {',
          'class Net {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/ncnn_net.h') {
        return [
          'namespace ncnn {',
          'namespace detail {',
          'class Net {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
          '}',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Nested namespace-relative alias should disambiguate the concrete header');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/ncnn_net.h',
    line: 5,
    column: 7,
    endColumn: 17,
  });
});

test('C++ global receiver aliases retain absolute namespace targets', async () => {
  const content = [
    '#include "alpha_net.h"',
    '#include "ncnn_net.h"',
    '#include "global_net.h"',
    'namespace ncnn {',
    'using Detector = ::detail::Net;',
    'Detector detector;',
    'detector.load_param(pd);',
    '}',
  ].join('\n');
  const offset = content.indexOf('load_param');
  const receiverType = navigation.definitionReceiverTypeAt(content, offset, 'load_param', true);
  assert.equal(receiverType, '::detail::Net');

  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: offset,
    receiverType,
    readFile: async (candidate) => {
      if (candidate === 'examples/alpha_net.h') {
        return [
          'namespace alpha {',
          'namespace detail {',
          'class Net {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/ncnn_net.h') {
        return [
          'namespace ncnn {',
          'namespace detail {',
          'class Net {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/global_net.h') {
        return [
          'namespace detail {',
          'class Net {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Global alias should disambiguate the absolute namespace header');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/global_net.h',
    line: 4,
    column: 7,
    endColumn: 17,
  });
});

test('C++ receiver aliases in included headers disambiguate concrete types', async () => {
  const content = [
    '#include "layer.h"',
    '#include "detector.h"',
    'void run() {',
    '  Detector detector;',
    '  detector.load_param(pd);',
    '}',
  ].join('\n');
  const offset = content.indexOf('load_param');
  const receiverType = navigation.definitionReceiverTypeAt(content, offset, 'load_param', true);
  assert.equal(receiverType, 'Detector');

  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: offset,
    receiverType,
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return 'class Layer {\npublic:\n  int load_param(const ParamDict& pd);\n};\n';
      }
      if (candidate === 'examples/detector.h') {
        return '#include "net.h"\nusing Detector = ncnn::Net;\n';
      }
      if (candidate === 'examples/net.h') {
        return 'namespace ncnn {\nclass Net {\npublic:\n  int load_param(const ParamDict& pd);\n};\n}\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Header alias should resolve the concrete receiver type directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/net.h',
    line: 4,
    column: 7,
    endColumn: 17,
  });
});

test('C++ receiver aliases follow included alias chains before candidate ranking', async () => {
  const content = [
    '#include "layer.h"',
    '#include "detector.h"',
    'void run() {',
    '  Detector detector;',
    '  detector.load_param(pd);',
    '}',
  ].join('\n');
  const offset = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: offset,
    receiverType: 'Detector',
    readFile: async (candidate) => {
      if (candidate === 'examples/layer.h') {
        return 'class Layer {\npublic:\n  int load_param(const ParamDict& pd);\n};\n';
      }
      if (candidate === 'examples/detector.h') {
        return '#include "net_alias.h"\nusing Detector = NetAlias;\n';
      }
      if (candidate === 'examples/net_alias.h') {
        return '#include "net.h"\nusing NetAlias = ncnn::Net;\n';
      }
      if (candidate === 'examples/net.h') {
        return 'namespace ncnn {\nclass Net {\npublic:\n  int load_param(const ParamDict& pd);\n};\n}\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Included alias chain should resolve before global search');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/net.h',
    line: 4,
    column: 7,
    endColumn: 17,
  });
});

test('C++ receiver disambiguation follows transitive includes to the concrete type', async () => {
  const content = [
    '#include "net.h"',
    'void run() {',
    '  ncnn::Layer* softmax = ncnn::create_layer("Softmax");',
    '  softmax->load_param(pd);',
    '}',
  ].join('\n');
  const offset = content.indexOf('load_param');
  const receiverType = navigation.definitionReceiverTypeAt(content, offset, 'load_param');
  assert.equal(receiverType, 'Layer');

  const result = await navigation.resolveWorkspaceDefinition({
    path: 'rustrun/crates/ncnn/examples/nanodet.cpp',
    content,
    symbol: 'load_param',
    receiverType,
    readFile: async (candidate) => {
      if (candidate === 'rustrun/crates/ncnn/src/net.h') {
        return '#include "layer.h"\nclass Layer;\nclass Net {\npublic:\n  int load_param(const ParamDict& pd);\n};\n';
      }
      if (candidate === 'rustrun/crates/ncnn/src/layer.h') {
        return 'class Layer {\npublic:\n  virtual int load_param(const ParamDict& pd);\n};\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Transitive include should resolve without global search');
    },
  });
  assert.deepEqual(result, {
    path: 'rustrun/crates/ncnn/src/layer.h',
    line: 3,
    column: 15,
    endColumn: 25,
  });
});

test('C++ overload resolution prefers the declaration matching the call site arguments', async () => {
  const content = [
    '#include "net.h"',
    'void run() {',
    '  ncnn::Net detector;',
    '  detector.load_param("model.param");',
    '}',
  ].join('\n');
  const callOffset = content.indexOf('load_param');
  const symbolOffset = callOffset + 'load_param'.length + 2;
  const receiverType = navigation.definitionReceiverTypeAt(content, symbolOffset, 'load_param');
  assert.equal(receiverType, 'Net');

  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    receiverType,
    callOffset: symbolOffset,
    readFile: async (candidate) =>
      candidate === 'examples/net.h'
        ? 'class Net {\npublic:\n  int load_param(const DataReader& dr);\n  int load_param(const char* protopath);\n};\n'
        : null,
    searchText: async () => {
      throw new Error('Overload should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/net.h',
    line: 4,
    column: 7,
    endColumn: 17,
  });
});

test('C++ overload resolution infers identifier argument types from local declarations', async () => {
  const content = [
    '#include "net.h"',
    'void run(FILE* fp) {',
    '  ncnn::Net detector;',
    '  int ret = detector.load_param(fp);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const symbolOffset = call + 'load_param'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: symbolOffset,
    receiverType: 'Net',
    readFile: async (candidate) =>
      candidate === 'examples/net.h'
        ? 'class Net {\npublic:\n  int load_param(const DataReader& dr);\n  int load_param(FILE* fp);\n};\n'
        : null,
    searchText: async () => {
      throw new Error('Identifier argument overload should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/net.h',
    line: 4,
    column: 7,
    endColumn: 17,
  });
});

test('C++ overload resolution treats omitted default parameters as compatible', async () => {
  const content = ['#include "widget.h"', 'void run(Widget& widget) { widget.configure("fast"); }'].join('\n');
  const call = content.indexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) =>
      candidate === 'examples/widget.h'
        ? 'class Widget {\npublic:\n  int configure(int mode);\n  int configure(const char* name, int mode = 0);\n};\n'
        : null,
    searchText: async () => {
      throw new Error('Default-parameter overload should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 4,
    column: 7,
    endColumn: 16,
  });
});

test('C++ overload resolution prefers a base-class parameter over an unrelated pointer', async () => {
  const content = [
    '#include "net.h"',
    'void run(FILE* fp) {',
    '  DataReaderFromStdio dr(fp);',
    '  ncnn::Net detector;',
    '  detector.load_param(dr);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const symbolOffset = call + 'load_param'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: symbolOffset,
    receiverType: 'Net',
    readFile: async (candidate) =>
      candidate === 'examples/net.h'
        ? 'class Net {\npublic:\n  int load_param(FILE* fp);\n  int load_param(const DataReader& dr);\n};\n'
        : null,
    searchText: async () => {
      throw new Error('Base-class overload should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/net.h',
    line: 4,
    column: 7,
    endColumn: 17,
  });
});

test('C++ overload resolution follows explicit inheritance without relying on type names', async () => {
  const content = [
    '#include "widget.h"',
    '#include "canvas.h"',
    'void run() {',
    '  Canvas canvas;',
    '  Widget widget;',
    '  widget.configure(canvas);',
    '}',
  ].join('\n');
  const call = content.indexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) => {
      if (candidate === 'examples/widget.h') {
        return 'class Widget {\npublic:\n  int configure(const Wrong& value);\n  int configure(const Surface& surface);\n};\n';
      }
      if (candidate === 'examples/canvas.h') {
        return [
          '/*',
          'class Canvas : public Wrong {',
          '*/',
          'const char* fake = "class Canvas : public Wrong {";',
          'class Canvas : public Surface {',
          '};',
          'class Surface {',
          '};',
          'class Wrong {',
          '};',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Inheritance-aware overload should resolve directly from includes');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 4,
    column: 7,
    endColumn: 16,
  });
});

test('C++ inheritance ignores base classes from opposite preprocessor branches', async () => {
  const content = [
    '#include "widget.h"',
    'void run(Widget& widget) {',
    '#if FEATURE_FAST',
    '  widget.configure(widget);',
    '#else',
    '  widget.configure(widget);',
    '#endif',
    '}',
  ].join('\n');
  const call = content.indexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) =>
      candidate === 'examples/widget.h'
        ? [
            'class FastBase {};',
            'class SlowBase {};',
            '#if FEATURE_FAST',
            'class Widget : public FastBase {',
            'public:',
            '  int configure(const SlowBase& value);',
            '  int configure(const FastBase& value);',
            '};',
            '#else',
            'class Widget : public SlowBase {',
            'public:',
            '  int configure(const SlowBase& value);',
            '  int configure(const FastBase& value);',
            '};',
            '#endif',
          ].join('\n')
        : null,
    searchText: async () => {
      throw new Error('Conditional inheritance should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 7,
    column: 7,
    endColumn: 16,
  });
});

test('C++ inheritance disambiguates same-named types by namespace', async () => {
  const content = [
    '#include "widget.h"',
    '#include "alpha_canvas.h"',
    '#include "beta_canvas.h"',
    'void run() {',
    '  alpha::Canvas canvas;',
    '  Widget widget;',
    '  widget.configure(canvas);',
    '}',
  ].join('\n');
  const call = content.indexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) => {
      if (candidate === 'examples/widget.h') {
        return [
          'class Widget {',
          'public:',
          '  int configure(const Wrong& value);',
          '  int configure(const Surface& surface);',
          '};',
        ].join('\n');
      }
      if (candidate === 'examples/alpha_canvas.h') {
        return ['namespace alpha {', 'class Canvas : public Surface {', '};', 'class Surface {', '};', '}'].join('\n');
      }
      if (candidate === 'examples/beta_canvas.h') {
        return ['namespace beta {', 'class Canvas : public Wrong {', '};', 'class Wrong {', '};', '}'].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Namespace-aware inheritance should resolve directly from includes');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 4,
    column: 7,
    endColumn: 16,
  });
});

test('C++ inheritance qualifies nested base namespaces', async () => {
  const content = [
    '#include "widget.h"',
    '#include "canvas.h"',
    'void run() {',
    '  ncnn::Canvas canvas;',
    '  Widget widget;',
    '  widget.configure(canvas);',
    '}',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  for (const baseType of ['detail::Surface', 'ncnn::detail::Surface', '::ncnn::detail::Surface']) {
    const result = await navigation.resolveWorkspaceDefinition({
      path: 'examples/run.cpp',
      content,
      symbol: 'configure',
      callOffset: call + 'configure'.length + 2,
      receiverType: 'Widget',
      readFile: async (candidate) => {
        if (candidate === 'examples/widget.h') {
          return [
            'class Wrong {};',
            'class Widget {',
            'public:',
            '  int configure(const Wrong& value);',
            '  int configure(const Base& value);',
            '};',
          ].join('\n');
        }
        if (candidate === 'examples/canvas.h') {
          return [
            'namespace ncnn {',
            'namespace detail {',
            'class Base {};',
            'class Surface : public Base {};',
            '}',
            `class Canvas : public ${baseType} {};`,
            '}',
          ].join('\n');
        }
        return null;
      },
      searchText: async () => {
        throw new Error('Nested inheritance should resolve directly from includes');
      },
    });
    assert.deepEqual(result, {
      path: 'examples/widget.h',
      line: 5,
      column: 7,
      endColumn: 16,
    });
  }
});

test('C++ global receiver types retain their inheritance chain', async () => {
  const content = [
    '#include "widget.h"',
    '#include "canvas.h"',
    'void run() {',
    '  ::detail::Canvas canvas;',
    '  Widget widget;',
    '  widget.configure(canvas);',
    '}',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: call + 'configure'.length + 2,
    receiverType: 'Widget',
    readFile: async (candidate) => {
      if (candidate === 'examples/widget.h') {
        return [
          'class Wrong {};',
          'class Widget {',
          'public:',
          '  int configure(const Wrong& value);',
          '  int configure(const Base& value);',
          '};',
        ].join('\n');
      }
      if (candidate === 'examples/canvas.h') {
        return [
          'namespace detail {',
          'class Base {};',
          'class Surface : public Base {};',
          'class Canvas : public ::detail::Surface {};',
          '}',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Global receiver inheritance should resolve directly from includes');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 5,
    column: 7,
    endColumn: 16,
  });
});

test('C++ qualified receivers select the matching namespace header', async () => {
  const content = [
    '#include "beta_canvas.h"',
    '#include "alpha_canvas.h"',
    'void run() {',
    '  alpha::Canvas canvas;',
    '  canvas.configure(1);',
    '}',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const receiverType = navigation.definitionReceiverTypeAt(content, symbolOffset, 'configure', true);
  assert.equal(receiverType, 'alpha::Canvas');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType,
    readFile: async (candidate) => {
      if (candidate === 'examples/alpha_canvas.h') {
        return '#pragma once\n#include <string>\nnamespace alpha {\nclass Canvas {\npublic:\n  int configure(int mode);\n};\n}\n';
      }
      if (candidate === 'examples/beta_canvas.h') {
        return '#pragma once\n#include <string>\nnamespace beta {\nclass Canvas {\npublic:\n  int configure(int mode);\n};\n}\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Qualified receiver should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/alpha_canvas.h',
    line: 6,
    column: 7,
    endColumn: 16,
  });
});

test('C++ inline namespace types are visible through enclosing namespaces', async () => {
  const content = [
    '#include "alpha.h"',
    '#include "net.h"',
    'void run() {',
    '  ncnn::Layer layer;',
    '  layer.load_param(pd);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  for (const receiverType of ['ncnn::Layer', 'ncnn::v1::Layer']) {
    const result = await navigation.resolveWorkspaceDefinition({
      path: 'examples/run.cpp',
      content,
      symbol: 'load_param',
      callOffset: call + 'load_param'.length,
      receiverType,
      readFile: async (candidate) => {
        if (candidate === 'examples/alpha.h') {
          return [
            'namespace alpha {',
            'class Layer {',
            'public:',
            '  int load_param(const ParamDict& pd);',
            '};',
            '}',
          ].join('\n');
        }
        if (candidate === 'examples/net.h') {
          return [
            'namespace ncnn {',
            'inline namespace v1 {',
            'class Layer {',
            'public:',
            '  int load_param(const ParamDict& pd);',
            '};',
            '}',
            '}',
          ].join('\n');
        }
        return null;
      },
      searchText: async () => {
        throw new Error('Inline namespace types should resolve directly from includes');
      },
    });
    assert.deepEqual(result, {
      path: 'examples/net.h',
      line: 5,
      column: 7,
      endColumn: 17,
    });
  }
});

test('C++ inline namespace aliases are visible through enclosing namespaces', async () => {
  const content = [
    '#include "alpha.h"',
    '#include "net.h"',
    'void run() {',
    '  ncnn::Detector detector;',
    '  detector.load_param(pd);',
    '}',
  ].join('\n');
  const call = content.indexOf('load_param');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'load_param',
    callOffset: call + 'load_param'.length,
    receiverType: 'ncnn::Detector',
    readFile: async (candidate) => {
      if (candidate === 'examples/alpha.h') {
        return [
          'namespace alpha {',
          'class Detector {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          '}',
        ].join('\n');
      }
      if (candidate === 'examples/net.h') {
        return [
          'namespace ncnn {',
          'inline namespace v1 {',
          'class Layer {',
          'public:',
          '  int load_param(const ParamDict& pd);',
          '};',
          'using Detector = Layer;',
          '}',
          '}',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Inline namespace aliases should resolve directly from includes');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/net.h',
    line: 5,
    column: 7,
    endColumn: 17,
  });
});

test('C++ inline namespace types retain inheritance chains', async () => {
  const content = [
    '#include "widget.h"',
    '#include "canvas.h"',
    'void run() {',
    '  ncnn::Layer canvas;',
    '  Widget widget;',
    '  widget.configure(canvas);',
    '}',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: call + 'configure'.length,
    receiverType: 'Widget',
    readFile: async (candidate) => {
      if (candidate === 'examples/widget.h') {
        return [
          'class Wrong {};',
          'class Widget {',
          'public:',
          '  int configure(const Wrong& value);',
          '  int configure(const Base& value);',
          '};',
        ].join('\n');
      }
      if (candidate === 'examples/canvas.h') {
        return [
          'namespace ncnn {',
          'inline namespace v1 {',
          'class Base {};',
          'class Layer : public Base {};',
          '}',
          '}',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Inline namespace inheritance should resolve directly from includes');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 5,
    column: 7,
    endColumn: 16,
  });
});

test('C++ deep inheritance chains retain the deepest base type', async () => {
  const content = [
    '#include "widget.h"',
    '#include "types.h"',
    'void run() {',
    '  A value;',
    '  Widget widget;',
    '  widget.configure(value);',
    '}',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: call + 'configure'.length,
    receiverType: 'Widget',
    readFile: async (candidate) => {
      if (candidate === 'examples/widget.h') {
        return [
          'class Wrong {};',
          'class Widget {',
          'public:',
          '  int configure(const Wrong& value);',
          '  int configure(const Root& value);',
          '};',
        ].join('\n');
      }
      if (candidate === 'examples/types.h') {
        return [
          'class Root {};',
          'class E : public Root {};',
          'class D : public E {};',
          'class C : public D {};',
          'class B : public C {};',
          'class A : public B {};',
        ].join('\n');
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Deep inheritance should resolve directly from includes');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 5,
    column: 7,
    endColumn: 16,
  });
});

test('C++ conditional namespace declarations prefer the matching branch header', async () => {
  const content = [
    '#include "conditional_canvas.h"',
    '#include "alpha_canvas.h"',
    'void run() {',
    '#if FEATURE_FAST',
    '  alpha::Canvas canvas;',
    '  canvas.configure(1);',
    '#else',
    '  alpha::Canvas canvas;',
    '  canvas.configure(1);',
    '#endif',
    '}',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: call + 'configure'.length + 2,
    receiverType: 'alpha::Canvas',
    readFile: async (candidate) => {
      if (candidate === 'examples/conditional_canvas.h') {
        return [
          '#if FEATURE_FAST',
          'namespace alpha {',
          'class Canvas {',
          'public:',
          '  int configure(int mode);',
          '};',
          '}',
          '#else',
          'namespace beta {',
          'class Canvas {',
          'public:',
          '  int configure(int mode);',
          '};',
          '}',
          '#endif',
        ].join('\n');
      }
      if (candidate === 'examples/alpha_canvas.h') {
        return 'namespace alpha {\nclass Canvas {\npublic:\n  int configure(int mode);\n};\n}\n';
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Conditional namespace candidate should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/alpha_canvas.h',
    line: 4,
    column: 7,
    endColumn: 16,
  });
});

test('C++ definitions ignore statically disabled preprocessor branches', async () => {
  const content = ['#include "widget.h"', 'void run() { Widget widget; widget.configure(1); }'].join('\n');
  const call = content.lastIndexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) =>
      candidate === 'examples/widget.h'
        ? [
            'class Widget {',
            'public:',
            '#if 0',
            '  int configure(int old_mode);',
            '#else',
            '  int configure(int mode);',
            '#endif',
            '};',
          ].join('\n')
        : null,
    searchText: async () => {
      throw new Error('Disabled preprocessor branch should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 6,
    column: 7,
    endColumn: 16,
  });
});

test('C++ definitions evaluate simple numeric preprocessor macros', async () => {
  const content = ['#include "widget.h"', 'void run() { Widget widget; widget.configure(1); }'].join('\n');
  const call = content.lastIndexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) =>
      candidate === 'examples/widget.h'
        ? [
            '#define USE_OLD_OVERLOAD 0',
            'class Widget {',
            'public:',
            '#if USE_OLD_OVERLOAD',
            '  int configure(int old_mode);',
            '#else',
            '  int configure(int mode);',
            '#endif',
            '};',
          ].join('\n')
        : null,
    searchText: async () => {
      throw new Error('Numeric macro branch should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 7,
    column: 7,
    endColumn: 16,
  });
});

test('C++ definitions prefer the call site conditional branch', async () => {
  const content = [
    '#include "widget.h"',
    'void run(Widget& widget) {',
    '#if FEATURE_FAST',
    '  widget.configure(1);',
    '#else',
    '  widget.configure(1);',
    '#endif',
    '}',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) =>
      candidate === 'examples/widget.h'
        ? [
            'class Widget {',
            'public:',
            '#if FEATURE_FAST',
            '  int configure(int fast_mode);',
            '#else',
            '  int configure(int slow_mode);',
            '#endif',
            '};',
          ].join('\n')
        : null,
    searchText: async () => {
      throw new Error('Conditional declarations should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/widget.h',
    line: 6,
    column: 7,
    endColumn: 16,
  });
});

test('C++ include candidates ignore disabled preprocessor branches', async () => {
  const content = [
    '#if 0',
    '#include "fast_widget.h"',
    '#else',
    '#include "slow_widget.h"',
    '#endif',
    'void run(Widget& widget) { widget.configure(1); }',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) =>
      candidate === 'examples/fast_widget.h' || candidate === 'examples/slow_widget.h'
        ? 'class Widget {\npublic:\n  int configure(int mode);\n};\n'
        : null,
    searchText: async () => {
      throw new Error('Conditional includes should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/slow_widget.h',
    line: 3,
    column: 7,
    endColumn: 16,
  });
});

test('C++ include candidates prefer the call site conditional branch', async () => {
  const content = [
    '#if FEATURE_FAST',
    '#include "fast_widget.h"',
    '#else',
    '#include "slow_widget.h"',
    '#endif',
    'void run(Widget& widget) {',
    '#if FEATURE_FAST',
    '  widget.configure(1);',
    '#else',
    '  widget.configure(1);',
    '#endif',
    '}',
  ].join('\n');
  const call = content.lastIndexOf('configure');
  const symbolOffset = call + 'configure'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'configure',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) =>
      candidate === 'examples/fast_widget.h' || candidate === 'examples/slow_widget.h'
        ? 'class Widget {\npublic:\n  int configure(int mode);\n};\n'
        : null,
    searchText: async () => {
      throw new Error('Conditional includes should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/slow_widget.h',
    line: 3,
    column: 7,
    endColumn: 16,
  });
});

test('C++ overload resolution accepts extra arguments for variadic functions', async () => {
  const content = ['#include "trace.h"', 'void run() { trace("value", "left", "right"); }'].join('\n');
  const call = content.lastIndexOf('trace');
  const symbolOffset = call + 'trace'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'trace',
    callOffset: symbolOffset,
    readFile: async (candidate) =>
      candidate === 'examples/trace.h'
        ? 'void trace(int level, int line, int code);\nvoid trace(const char* format, ...);\n'
        : null,
    searchText: async () => {
      throw new Error('Variadic overload should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/trace.h',
    line: 2,
    column: 6,
    endColumn: 11,
  });
});

test('C++ non-variadic overload wins when both parameter sets are viable', async () => {
  const content = ['#include "trace.h"', 'void run() { trace("value"); }'].join('\n');
  const call = content.lastIndexOf('trace');
  const symbolOffset = call + 'trace'.length + 2;
  const header = [
    'void trace(const char* format, int level = 0, int code = 0, ...);',
    'void trace(const char* format, int level = 0);',
  ].join('\n');
  const resolve = (sourceContent, offset) =>
    navigation.resolveWorkspaceDefinition({
      path: 'examples/run.cpp',
      content: sourceContent,
      symbol: 'trace',
      callOffset: offset,
      readFile: async (candidate) => (candidate === 'examples/trace.h' ? header : null),
      searchText: async () => {
        throw new Error('Variadic overload should resolve directly from the include');
      },
    });

  assert.deepEqual(await resolve(content, symbolOffset), {
    path: 'examples/trace.h',
    line: 2,
    column: 6,
    endColumn: 11,
  });

  const extraContent = ['#include "trace.h"', 'void run() { trace("value", 1, 2, 3); }'].join('\n');
  const extraCall = extraContent.lastIndexOf('trace');
  assert.deepEqual(await resolve(extraContent, extraCall + 'trace'.length + 2), {
    path: 'examples/trace.h',
    line: 1,
    column: 6,
    endColumn: 11,
  });
});

test('C++ null pointer arguments prefer a typed pointer over void pointer', async () => {
  const content = ['#include "binder.h"', 'void run() { Widget widget; widget.bind(nullptr); }'].join('\n');
  const call = content.lastIndexOf('bind');
  const symbolOffset = call + 'bind'.length + 2;
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'examples/run.cpp',
    content,
    symbol: 'bind',
    callOffset: symbolOffset,
    receiverType: 'Widget',
    readFile: async (candidate) =>
      candidate === 'examples/binder.h'
        ? 'class Widget {\npublic:\n  int bind(void* value);\n  int bind(Layer* value);\n};\n'
        : null,
    searchText: async () => {
      throw new Error('Null-pointer overload should resolve directly from the include');
    },
  });
  assert.deepEqual(result, {
    path: 'examples/binder.h',
    line: 4,
    column: 7,
    endColumn: 11,
  });
});

test('Go import paths provide bounded search scope without assuming a module root', () => {
  const content = [
    'package api',
    'import "example.com/acme/project/internal/store"',
    'func Load() { store.Fetch() }',
  ].join('\n');
  const patterns = navigation.definitionSearchScopePatterns(content, 'services/api/load.go');

  assert.ok(patterns.includes('internal/store/**'));
  assert.ok(patterns.includes('**/internal/store/**'));
  assert.ok(navigation.definitionSearchQuery('Fetch', 'services/api/load.go').length <= 256);
});

test('Rust crate-root re-exports resolve through lib.rs without guessing a filename', async () => {
  const content = ['use crate::Extractor;', 'pub fn create(&self) -> Extractor { todo!() }'].join('\n');
  const sourcePath = 'rustrun/crates/ncnnrs/src/net.rs';
  const candidates = navigation.definitionLanguageCandidates(content, sourcePath, 'Extractor');
  const patterns = navigation.definitionSearchScopePatterns(content, sourcePath);

  assert.equal(
    candidates.some((candidate) => candidate.path === 'rustrun/crates/ncnnrs/src/Extractor.rs'),
    false,
  );
  assert.ok(patterns.includes('rustrun/crates/ncnnrs/src/**'));

  const reads = [];
  const result = await navigation.resolveWorkspaceDefinition({
    path: sourcePath,
    content,
    symbol: 'Extractor',
    readFile: async (candidate) => {
      reads.push(candidate);
      if (candidate === 'rustrun/crates/ncnnrs/src/lib.rs') return 'pub use extractor::*;\n';
      if (candidate === 'rustrun/crates/ncnnrs/src/extractor.rs') {
        return "pub struct Extractor<'a> { value: &'a str }\n";
      }
      return null;
    },
    searchText: async () => {
      throw new Error('Rust re-export should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'rustrun/crates/ncnnrs/src/extractor.rs',
    line: 1,
    column: 12,
    endColumn: 21,
  });
  assert.equal(reads.includes('rustrun/crates/ncnnrs/src/Extractor.rs'), false);
});

test('Shell source directives resolve functions from the sourced script', () => {
  const content = ['ROOT_DIR="$(pwd)"', 'source "$ROOT_DIR/lib_config.sh"', 'read_config "output"'].join('\n');
  const sourcePath = 'deploy.sh';
  const candidates = navigation.definitionLanguageCandidates(content, sourcePath, 'read_config');
  const patterns = navigation.definitionSearchScopePatterns(content, sourcePath);

  assert.ok(candidates.some((candidate) => candidate.path === 'lib_config.sh' && candidate.symbol === 'read_config'));
  assert.ok(patterns.includes('lib_config.sh'));
});

test('Python absolute imports resolve from the detected package root', async () => {
  const content = ['from ppocr.data.simple_dataset import SimpleDataSet', 'from .imaug import create_operators'].join(
    '\n',
  );
  const sourcePath = 'PaddleOCR/ppocr/data/__init__.py';
  const reads = [];
  const result = await navigation.resolveWorkspaceDefinition({
    path: sourcePath,
    content,
    symbol: 'SimpleDataSet',
    readFile: async (candidate) => {
      reads.push(candidate);
      return candidate === 'PaddleOCR/ppocr/data/simple_dataset.py' ? 'class SimpleDataSet:\n    pass\n' : null;
    },
    searchText: async () => {
      throw new Error('Python import should resolve directly');
    },
  });

  assert.deepEqual(result, {
    path: 'PaddleOCR/ppocr/data/simple_dataset.py',
    line: 1,
    column: 7,
    endColumn: 20,
  });
  assert.ok(reads.includes('PaddleOCR/ppocr/data/simple_dataset.py'));
});

test('Java, C++ and C declarations include methods and header prototypes', () => {
  assert.equal(
    navigation.findDefinitionInText(
      'public class Helper {\n  public <T> java.util.List<T> work(T value) { return null; }\n}\n',
      'work',
      'Helper.java',
    )?.line,
    2,
  );
  assert.equal(navigation.findDefinitionInText('void Widget::paint() {}\n', 'paint', 'widget.cpp')?.column, 14);
  assert.deepEqual(navigation.findDefinitionInText('int helper(int value);\n', 'helper', 'helper.h'), {
    path: 'helper.h',
    line: 1,
    column: 5,
    endColumn: 11,
  });
});

test('C++ class fields participate in member definition lookup', () => {
  assert.deepEqual(navigation.findDefinitionInText('class Mat {\npublic:\n  int h;\n};\n', 'h', 'mat.h'), {
    path: 'mat.h',
    line: 3,
    column: 7,
    endColumn: 8,
  });
});

test('Workspace resolution follows Java, Go and C language imports before global search', async () => {
  const javaResult = await navigation.resolveWorkspaceDefinition({
    path: 'src/main/java/com/acme/app/Main.java',
    content: 'package com.acme.app;\nimport com.acme.service.Helper;\nclass Main { void run() { Helper.work(); } }\n',
    symbol: 'work',
    readFile: async (path) =>
      path === 'src/main/java/com/acme/service/Helper.java'
        ? 'package com.acme.service;\nclass Helper { void work() {} }\n'
        : null,
    searchText: async () => {
      throw new Error('Java import should resolve directly');
    },
  });
  assert.deepEqual(javaResult, {
    path: 'src/main/java/com/acme/service/Helper.java',
    line: 2,
    column: 21,
    endColumn: 25,
  });

  const goSearches = [];
  const goResult = await navigation.resolveWorkspaceDefinition({
    path: 'services/api/load.go',
    content: 'package api\nimport "example.com/acme/project/internal/store"\nfunc Load() { store.Fetch() }\n',
    symbol: 'Fetch',
    readFile: async (path) => (path === 'internal/store/store.go' ? 'package store\nfunc Fetch() {}\n' : null),
    searchText: async (query, options) => {
      goSearches.push({ query, options });
      return [{ path: 'internal/store/store.go', line: 2, column: 6 }];
    },
  });
  assert.ok(goSearches[0].options.scopeIncludePatterns.includes('**/internal/store/**'));
  assert.deepEqual(goResult, {
    path: 'internal/store/store.go',
    line: 2,
    column: 6,
    endColumn: 11,
  });

  const cResult = await navigation.resolveWorkspaceDefinition({
    path: 'src/app/main.c',
    content: '#include "../include/helper.h"\nint main() { return helper(1); }\n',
    symbol: 'helper',
    readFile: async (path) => (path === 'src/include/helper.h' ? '#pragma once\nint helper(int value);\n' : null),
    searchText: async () => {
      throw new Error('C include should resolve directly');
    },
  });
  assert.deepEqual(cResult, {
    path: 'src/include/helper.h',
    line: 2,
    column: 5,
    endColumn: 11,
  });

  const hppResult = await navigation.resolveWorkspaceDefinition({
    path: 'src/app/widget.cpp',
    content: '#include "widget.hpp"\nint main() { return paint(1); }\n',
    symbol: 'paint',
    readFile: async (path) => (path === 'src/app/widget.hpp' ? '#pragma once\nint paint(int value);\n' : null),
    searchText: async () => {
      throw new Error('C++ header include should resolve directly');
    },
  });
  assert.deepEqual(hppResult, {
    path: 'src/app/widget.hpp',
    line: 2,
    column: 5,
    endColumn: 10,
  });
});

test('The editor forwards language search scopes to the host text search', () => {
  assert.match(workspaceSource, /searchText: definitionSearchText/u);
  assert.match(workspaceSource, /pathIdentities: definitionPathIdentities/u);
  assert.match(definitionNavigationSource, /scopeIncludePatterns: options\?\.scopeIncludePatterns/u);
  assert.match(
    definitionNavigationSource,
    /includeExcluded: \(options\?\.scopeIncludePatterns\?\.length \?\? 0\) > 0/u,
  );
});
