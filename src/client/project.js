/* project.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    /**
     * Resolve the visible paths of one Compact Directories chain.
     *
     * The chain stops at the first level whose children have not been loaded,
     * so a cache hit can render immediately while the host refresh continues.
     * @param {string} path - clicked directory path.
     * @param {Record<string, Array<object>>} children - cached listings by directory.
     * @param {number} limit - maximum number of implicit levels.
     * @returns {string[]} clicked path followed by every single-directory child.
     */
    function compactDirectoryExpansionPaths(path, children, limit = 64) {
      const expandedPaths = [path];
      let listing = Array.isArray(children[path]) ? children[path] : null;
      let guard = 0;
      while (Array.isArray(listing) && listing.length === 1 && listing[0]?.kind === 'directory' && guard < limit) {
        const nextPath = listing[0].path;
        if (typeof nextPath !== 'string' || nextPath === '' || expandedPaths.includes(nextPath)) break;
        expandedPaths.push(nextPath);
        listing = children[nextPath];
        guard += 1;
      }
      return expandedPaths;
    }

    /** Upper bounds for one operating-system drop into Project. */
    const WORKSPACE_DROP_MAX_ITEMS = 1000;
    const WORKSPACE_DROP_MAX_DEPTH = 32;

    /* File Browser's tus client defaults to 10 MiB chunks, one in-flight chunk,
       and retry delays of 0/1/2/4/8 seconds. The upload transport below follows
       those bounds while using dsh-editor's own authenticated host routes. */
    const WORKSPACE_UPLOAD_CHUNK_BYTES = 10 * 1024 * 1024;
    const WORKSPACE_UPLOAD_RETRY_DELAYS = [0, 1000, 2000, 4000, 8000];

    /**
     * Detect an operating-system file drag without depending on browser casing.
     * @param {DataTransfer|null|undefined} dataTransfer - current drag payload.
     * @returns {boolean} whether the drag carries files.
     */
    function dataTransferIncludesFiles(dataTransfer) {
      try {
        return Array.from(dataTransfer?.types ?? []).some((type) => String(type).toLowerCase() === 'files');
      } catch {
        return false;
      }
    }

    /** Resolve an OS drop on any tree row to its containing project directory. */
    function projectExternalDropDirectory(row) {
      const path = typeof row?.path === 'string' ? row.path : '';
      return row?.kind === 'directory' || row?.root === true ? path : dirname(path);
    }

    /** Resolve a toolbar drop from the selected tree row, or the root. */
    function projectToolbarDropDirectory(rows, selectedPath) {
      const row = Array.isArray(rows) ? rows.find((entry) => entry?.path === selectedPath) ?? null : null;
      return row === null ? '' : projectExternalDropDirectory(row);
    }

    /** Hide DSH's unrelated attachment mask while a file is over the Editor. */
    function beginEditorFileDrag(event) {
      if (dataTransferIncludesFiles(event.dataTransfer)) {
        document.body.classList.add('dsh-editor-file-drag');
      }
    }

    /** Clear the Editor drag class once the pointer leaves the whole workspace. */
    function endEditorFileDrag(event) {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      document.body.classList.remove('dsh-editor-file-drag');
    }

    /** Allow an invalid non-tree Editor drop to settle without navigating the page. */
    function allowEditorFileDragOver(event) {
      if (dataTransferIncludesFiles(event.dataTransfer)) event.preventDefault();
    }

    /** Clear transient drag state when a file is dropped anywhere in Editor. */
    function finishEditorFileDrag(event) {
      if (!dataTransferIncludesFiles(event.dataTransfer)) return;
      event.preventDefault();
      document.body.classList.remove('dsh-editor-file-drag');
    }

    /** Install global fallbacks for drags that end outside the workspace. */
    function bindEditorFileDragCleanup() {
      const clearFileDrag = (event) => {
        const target = event?.target instanceof Element ? event.target : null;
        if (
          event?.type === 'drop'
          && target?.closest?.('[data-dsh-editor-workspace]') !== null
        ) {
          window.setTimeout(() => {
            window.dispatchEvent(new Event('dragend', { bubbles: true, cancelable: true }));
          }, 0);
          return;
        }
        document.body.classList.remove('dsh-editor-file-drag');
      };
      window.addEventListener('drop', clearFileDrag, true);
      window.addEventListener('dragend', clearFileDrag, true);
      return () => {
        window.removeEventListener('drop', clearFileDrag, true);
        window.removeEventListener('dragend', clearFileDrag, true);
        clearFileDrag();
      };
    }
    const editorFileDragProps = {
      onDragEnter: beginEditorFileDrag,
      onDragLeave: endEditorFileDrag,
      onDragOver: allowEditorFileDragOver,
      onDrop: finishEditorFileDrag,
    };

    /**
     * Keep a dropped entry name as one safe path segment.
     * @param {unknown} value - FileSystemEntry/File name.
     * @returns {string} safe segment, or an empty string when it cannot be used.
     */
    function workspaceDropSegment(value) {
      const name = String(value ?? '').replaceAll('\\', '/');
      if (
        name === ''
        || name === '.'
        || name === '..'
        || name.includes('/')
        || name.includes('\0')
      ) return '';
      return name;
    }

    /**
     * Build one typed OS-drop failure with the context needed for localization.
     * @param {string} code - stable client error code.
     * @param {string} message - technical fallback message.
     * @param {object} [details] - path/name/limit fields for the localized copy.
     * @returns {Error} typed failure.
     */
    function workspaceDropFailure(code, message, details = {}) {
      const failure = new Error(message);
      failure.code = code;
      Object.assign(failure, details);
      return failure;
    }

    /**
     * Turn one captured-drop failure into the Project tree's localized copy.
     * @param {unknown} failure - enumeration/write failure.
     * @param {Function} t - locale translator.
     * @returns {string} message for the tree.
     */
    function uploadDropFailureMessage(failure, t) {
      if (failure?.code === 'dsh-editor/exists') return t('editor.uploadConflicts', { path: failure.path ?? '' });
      if (failure?.code === 'dsh-editor/upload-not-found') return t('editor.uploadTargetUnavailable', {});
      if (failure?.status === 404) return t('editor.uploadServiceUnavailable', {});
      if (failure?.code === 'dsh-editor/upload-offset') return t('editor.uploadOffsetChanged', {});
      if (
        failure?.code === 'dsh-editor/upload-incomplete'
        || failure?.code === 'dsh-editor/upload-length'
        || failure?.code === 'dsh-editor/upload-chunk-too-large'
      ) return t('editor.uploadIncomplete', {});
      if (failure?.code === 'dsh-editor/upload-too-many-items') return t('editor.uploadTooManyItems', { limit: failure.limit });
      if (failure?.code === 'dsh-editor/upload-too-deep') return t('editor.uploadTooDeep', { limit: failure.limit });
      if (failure?.code === 'dsh-editor/upload-invalid-name') return t('editor.uploadInvalidName', { name: failure.name });
      if (failure?.code === 'dsh-editor/upload-unreadable') return t('editor.uploadUnreadable', { path: failure.path });
      return failure instanceof Error ? failure.message : String(failure);
    }

    /**
     * Clamp uploaded bytes into one integer percentage.
     * @param {number} loaded - durable bytes uploaded.
     * @param {number} total - declared total bytes.
     * @returns {number} 0–100.
     */
    function uploadProgressPercent(loaded, total) {
      if (!Number.isFinite(loaded) || !Number.isFinite(total) || total <= 0) return 0;
      return Math.max(0, Math.min(100, Math.floor((loaded / total) * 100)));
    }

    /**
     * Render one byte count for the compact Project progress strip.
     * @param {number} value - byte count.
     * @returns {string} compact binary unit.
     */
    function formatUploadBytes(value) {
      const bytes = Math.max(0, Number(value) || 0);
      if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
      if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
      if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
      return `${Math.floor(bytes)} B`;
    }

    /**
     * Post one authenticated chunked-upload request.
     * @param {string} action - start, chunk, finish or abort.
     * @param {object} [options] - method, query, body and headers.
     * @returns {Promise<object>} host value.
     */
    async function requestWorkspaceUpload(action, options = {}) {
      const sessionId = currentSessionId();
      const workspaceId = currentEditorWorkspaceId();
      if (sessionId === '' && workspaceId === '') throw new Error('no active Session or workspace');
      const query = new URLSearchParams({ sessionId, workspaceId, ...(options.query ?? {}) });
      const response = await fetch(`api/dsh-editor/upload/${action}?${query}`, {
        method: options.method ?? 'POST',
        headers: options.headers ?? { 'content-type': 'application/json' },
        body: options.body,
        signal: options.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok !== true) {
        const failure = new Error(data?.error?.message ?? `upload API HTTP ${response.status}`);
        failure.code = data?.error?.code ?? 'dsh-editor/upload-http';
        failure.currentOffset = data?.error?.currentOffset;
        failure.status = response.status;
        throw failure;
      }
      return data.value;
    }

    /**
     * Whether one upload failure can benefit from another identical attempt.
     * Permanent HTTP 4xx responses must fail immediately; transport failures
     * and 5xx responses remain retryable.
     * @param {unknown} failure - upload request failure.
     * @returns {boolean} true when retrying may succeed.
     */
    function uploadFailureIsRetryable(failure) {
      const status = Number(failure?.status);
      return !Number.isInteger(status) || status < 400 || status >= 500;
    }

    /** Build one user-requested upload cancellation. */
    function uploadCancelledFailure() {
      const failure = new Error('upload cancelled');
      failure.code = 'dsh-editor/upload-cancelled';
      return failure;
    }

    /**
     * Wait for one retry backoff while remaining interruptible.
     *
     * A plain timer kept the Cancel button visible for up to eight seconds
     * after the user had already asked to stop. The same AbortSignal that
     * interrupts an in-flight chunk also settles this timer immediately.
     * @param {number} delay - requested delay in milliseconds.
     * @param {() => boolean} shouldCancel - reads the batch cancellation flag.
     * @param {AbortSignal|null|undefined} signal - batch abort signal.
     * @returns {Promise<void>} resolves after the delay or rejects on cancellation.
     */
    async function waitForWorkspaceUploadRetry(delay, shouldCancel, signal) {
      if (shouldCancel() || signal?.aborted) throw uploadCancelledFailure();
      const milliseconds = Math.max(0, Number(delay) || 0);
      if (milliseconds === 0) return;
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (failure) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          if (failure === undefined) resolve();
          else reject(failure);
        };
        const timer = window.setTimeout(() => {
          finish(shouldCancel() || signal?.aborted ? uploadCancelledFailure() : undefined);
        }, milliseconds);
        const onAbort = () => finish(uploadCancelledFailure());
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    }

    /**
     * Retry one idempotent upload request with File Browser's bounded backoff.
     * @param {() => Promise<object>} request - request attempt.
     * @returns {Promise<object>} successful value.
     */
    async function retryWorkspaceUploadRequest(request) {
      let retries = 0;
      while (true) {
        try {
          return await request();
        } catch (failure) {
          if (retries >= WORKSPACE_UPLOAD_RETRY_DELAYS.length || !uploadFailureIsRetryable(failure)) throw failure;
          const delay = WORKSPACE_UPLOAD_RETRY_DELAYS[retries];
          retries += 1;
          if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
        }
      }
    }

    /**
     * Upload one file sequentially in 10 MiB slices.
     *
     * The browser never materializes the whole file or a base64 copy. A stale
     * offset means an earlier response was lost after its bytes were synced, so
     * the client adopts the host's durable offset instead of replaying over it.
     * @param {File} file - dropped browser file.
     * @param {string} path - workspace-relative destination.
     * @param {(progress: {loaded: number, total: number}) => void} [onProgress] - per-file durable progress.
     * @param {() => boolean} shouldCancel - reads the batch cancellation flag.
     * @param {AbortSignal|null|undefined} signal - aborts the in-flight chunk request.
     * @returns {Promise<object>} uploaded file metadata.
     */
    async function uploadWorkspaceFile(file, path, onProgress, shouldCancel, signal) {
      if (shouldCancel()) throw uploadCancelledFailure();
      const started = await requestWorkspaceUpload('start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, size: file.size }),
      });
      const uploadId = started.uploadId;
      let offset = Number.isSafeInteger(started.offset) ? started.offset : 0;
      onProgress?.({ loaded: offset, total: file.size });
      try {
        while (offset < file.size) {
          if (shouldCancel()) throw uploadCancelledFailure();
          const end = Math.min(offset + WORKSPACE_UPLOAD_CHUNK_BYTES, file.size);
          const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
          let retries = 0;
          while (true) {
            if (shouldCancel()) throw uploadCancelledFailure();
            try {
              const value = await requestWorkspaceUpload('chunk', {
                method: 'PATCH',
                query: { uploadId, offset },
                headers: { 'content-type': 'application/octet-stream' },
                body: chunk,
                signal,
              });
              offset = value.offset;
              onProgress?.({ loaded: offset, total: file.size });
              break;
            } catch (failure) {
              if (shouldCancel() || signal?.aborted) throw uploadCancelledFailure();
              if (failure?.code === 'dsh-editor/upload-offset' && Number.isSafeInteger(failure.currentOffset)) {
                offset = failure.currentOffset;
                break;
              }
              if (retries >= WORKSPACE_UPLOAD_RETRY_DELAYS.length || !uploadFailureIsRetryable(failure)) throw failure;
              const delay = WORKSPACE_UPLOAD_RETRY_DELAYS[retries];
              retries += 1;
              await waitForWorkspaceUploadRetry(delay, shouldCancel, signal);
            }
          }
        }
        return await retryWorkspaceUploadRequest(() => requestWorkspaceUpload('finish', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploadId }),
        }));
      } catch (failure) {
        await requestWorkspaceUpload('abort', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploadId }),
        }).catch(() => {});
        if (shouldCancel() || signal?.aborted) throw uploadCancelledFailure();
        throw failure;
      }
    }

    /**
     * Capture DataTransfer entries while the browser still permits access.
     *
     * `webkitGetAsEntry()` must run synchronously inside the drop event. The
     * returned entries and files remain readable after React starts the async
     * traversal.
     * @param {DataTransfer|null|undefined} dataTransfer - dropped payload.
     * @returns {{entries: object[], files: File[]}} stable drop handles.
     */
    function captureDroppedWorkspaceHandles(dataTransfer) {
      const entries = [];
      for (const item of Array.from(dataTransfer?.items ?? [])) {
        if (item?.kind !== 'file' || typeof item.webkitGetAsEntry !== 'function') continue;
        const entry = item.webkitGetAsEntry();
        if (entry !== null && typeof entry === 'object') entries.push(entry);
      }
      return {
        entries,
        files: entries.length === 0 ? Array.from(dataTransfer?.files ?? []) : [],
      };
    }

    /**
     * Read every entry a directory reader exposes; the API returns batches.
     * @param {object} reader - FileSystemDirectoryReader.
     * @returns {Promise<object[]>} all child entries.
     */
    async function readDroppedDirectoryEntries(reader) {
      const entries = [];
      while (true) {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) return entries;
        entries.push(...batch);
        if (entries.length > WORKSPACE_DROP_MAX_ITEMS) {
          throw workspaceDropFailure(
            'dsh-editor/upload-too-many-items',
            `drop contains more than ${WORKSPACE_DROP_MAX_ITEMS} items`,
            { limit: WORKSPACE_DROP_MAX_ITEMS },
          );
        }
      }
    }

    /**
     * Recursively collect dropped files and empty directories.
     * @param {object} entry - FileSystemEntry.
     * @param {string} parent - workspace-relative parent path.
     * @param {number} depth - current directory depth.
     * @param {Map<string, object>} output - deduplicated entries by kind/path.
     * @param {() => void} assertBudget - enforces the per-drop item ceiling.
     * @returns {Promise<void>} resolves after the subtree is enumerated.
     */
    async function collectDroppedWorkspaceEntry(entry, parent, depth, output, assertBudget) {
      if (depth > WORKSPACE_DROP_MAX_DEPTH) {
        throw workspaceDropFailure(
          'dsh-editor/upload-too-deep',
          `drop is nested deeper than ${WORKSPACE_DROP_MAX_DEPTH} levels`,
          { limit: WORKSPACE_DROP_MAX_DEPTH },
        );
      }
      const name = workspaceDropSegment(entry?.name);
      if (name === '') {
        throw workspaceDropFailure(
          'dsh-editor/upload-invalid-name',
          'a dropped item has an invalid name',
          { name: String(entry?.name ?? '') },
        );
      }
      const path = parent === '' ? name : `${parent}/${name}`;
      if (entry.isDirectory === true) {
        assertBudget();
        output.set(`directory:${path}`, { path, kind: 'directory' });
        const reader = entry.createReader();
        const children = await readDroppedDirectoryEntries(reader);
        for (const child of children) {
          await collectDroppedWorkspaceEntry(child, path, depth + 1, output, assertBudget);
        }
        return;
      }
      if (entry.isFile !== true) return;
      assertBudget();
      if (typeof entry.file !== 'function') {
        throw workspaceDropFailure(
          'dsh-editor/upload-unreadable',
          'a dropped file cannot be read',
          { path },
        );
      }
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      output.set(`file:${path}`, { path, kind: 'file', file });
    }

    /**
     * Convert a captured operating-system drop into safe workspace-relative rows.
     * @param {{entries?: object[], files?: File[]}} handles - captured drop handles.
     * @returns {Promise<{entries: object[], directories: object[], files: object[]}>} enumerated drop.
     */
    async function collectDroppedWorkspaceEntries(handles) {
      const output = new Map();
      let itemCount = 0;
      const assertBudget = () => {
        itemCount += 1;
        if (itemCount > WORKSPACE_DROP_MAX_ITEMS) {
          throw workspaceDropFailure(
            'dsh-editor/upload-too-many-items',
            `drop contains more than ${WORKSPACE_DROP_MAX_ITEMS} items`,
            { limit: WORKSPACE_DROP_MAX_ITEMS },
          );
        }
      };
      for (const entry of Array.from(handles?.entries ?? [])) {
        await collectDroppedWorkspaceEntry(entry, '', 0, output, assertBudget);
      }
      if (Array.from(handles?.entries ?? []).length === 0) {
        for (const file of Array.from(handles?.files ?? [])) {
          const name = workspaceDropSegment(file?.name);
          if (name === '') {
            throw workspaceDropFailure(
              'dsh-editor/upload-invalid-name',
              'a dropped file has an invalid name',
              { name: String(file?.name ?? '') },
            );
          }
          assertBudget();
          output.set(`file:${name}`, { path: name, kind: 'file', file });
        }
      }
      const entries = [...output.values()].sort((left, right) => {
        const depth = left.path.split('/').length - right.path.split('/').length;
        return depth === 0 ? left.path.localeCompare(right.path) : depth;
      });
      return {
        entries,
        directories: entries.filter((entry) => entry.kind === 'directory'),
        files: entries.filter((entry) => entry.kind === 'file'),
      };
    }

    /**
     * Import one captured operating-system drop into the visible Project tree.
     *
     * The caller owns React state and supplies the same bounded `callFs` /
     * refresh primitives as every other tree action. This function performs
     * conflict preflight and exclusive writes, then refreshes only the drop
     * destination and selects the uploaded top-level entries.
     * @param {object} input - captured handles, target path, file API and UI sinks.
     * @returns {Promise<void>} resolves after the operation is surfaced.
     */
    async function uploadWorkspaceDropToProject(input) {
      const {
        handles,
        targetDirectory,
        callFs,
        refreshTree,
        loadGit,
        uploadBusyRef,
        setExpanded,
        setChildren,
        setEntries,
        setTreeError,
        flashStatus,
        applyTreeSelection,
        showHidden,
        sortMode,
        foldersFirst,
        showExcludedFiles,
        projectName,
        setUploadBusy,
        setUploadProgress,
        t,
      } = input;
      if (uploadBusyRef.current) {
        uploadBusyRef.ignoredDrops = (uploadBusyRef.ignoredDrops ?? 0) + 1;
        setTreeError(t('editor.uploadBusy'));
        return;
      }
      uploadBusyRef.current = true;
      uploadBusyRef.cancelRequested = false;
      const cancelController = new AbortController();
      uploadBusyRef.cancelController = cancelController;
      setUploadBusy(true);
      let uploadFailed = false;
      let uploadCancelled = false;
      let uploadedCount = 0;
      let uploadedTarget = projectName;
      try {
        const collected = await collectDroppedWorkspaceEntries(handles);
        if (collected.entries.length === 0) {
          setTreeError(t('editor.uploadNothingReadable'));
          return;
        }
        const destinationOf = (path) => (targetDirectory === '' ? path : `${targetDirectory}/${path}`);
        const destinations = collected.entries.map((entry) => destinationOf(entry.path));
        const described = await callFs({ op: 'exists', paths: destinations }).catch(() => []);
        const conflicts = (Array.isArray(described) ? described : [])
          .filter((entry) => entry?.exists === true)
          .map((entry) => entry.path);
        if (conflicts.length > 0) {
          setTreeError(t('editor.uploadConflicts', { path: conflicts[0] }));
          return;
        }
        if (collected.files.length === 0) {
          flashStatus(t('editor.uploadingItems', { count: collected.entries.length }));
        }
        for (const directory of collected.directories) {
          await callFs({ op: 'create', path: destinationOf(directory.path), kind: 'directory' });
        }
        const totalBytes = collected.files.reduce((sum, entry) => sum + entry.file.size, 0);
        let completedBytes = 0;
        for (let index = 0; index < collected.files.length; index += 1) {
          if (uploadBusyRef.cancelRequested === true) throw uploadCancelledFailure();
          const entry = collected.files[index];
          const publish = (loaded) => {
            setUploadProgress({
              name: basename(entry.path),
              index: index + 1,
              count: collected.files.length,
              loaded: completedBytes + loaded,
              total: totalBytes,
              fileLoaded: loaded,
              fileTotal: entry.file.size,
            });
          };
          publish(0);
          await uploadWorkspaceFile(
            entry.file,
            destinationOf(entry.path),
            ({ loaded }) => publish(loaded),
            () => uploadBusyRef.cancelRequested === true || cancelController.signal.aborted,
            cancelController.signal,
          );
          completedBytes += entry.file.size;
        }
        await refreshTree();
        await loadGit();
        if (targetDirectory !== '') {
          setExpanded((current) => new Set([...current, targetDirectory]));
          const listing = await callFs({
            op: 'list',
            path: targetDirectory,
            showHidden,
            sort: sortMode,
            foldersFirst,
            showExcluded: showExcludedFiles,
          });
          setChildren((current) => ({ ...current, [targetDirectory]: listing.entries ?? [] }));
        } else {
          const listing = await callFs({
            op: 'list',
            path: '',
            showHidden,
            sort: sortMode,
            foldersFirst,
            showExcluded: showExcludedFiles,
          });
          setEntries(listing.entries ?? []);
        }
        const topLevelPaths = [...new Set(collected.entries.map((entry) => destinationOf(entry.path.split('/')[0])))];
        const primary = topLevelPaths[topLevelPaths.length - 1] ?? null;
        applyTreeSelection(new Set(topLevelPaths), primary, primary);
        uploadedCount = collected.entries.length;
        uploadedTarget = targetDirectory === '' ? projectName : targetDirectory;
        flashStatus(t('editor.uploadComplete', {
          count: uploadedCount,
          target: uploadedTarget,
        }));
      } catch (failure) {
        if (failure?.code === 'dsh-editor/upload-cancelled') {
          uploadCancelled = true;
          flashStatus(t('editor.uploadCancelled'));
          return;
        }
        uploadFailed = true;
        setTreeError(uploadDropFailureMessage(failure, t));
      } finally {
        uploadBusyRef.current = false;
        uploadBusyRef.cancelRequested = false;
        uploadBusyRef.cancelController = null;
        setUploadBusy(false);
        setUploadProgress(null);
        const ignoredDrops = uploadBusyRef.ignoredDrops ?? 0;
        uploadBusyRef.ignoredDrops = 0;
        if (ignoredDrops > 0 && !uploadFailed && !uploadCancelled) {
          setTreeError(t('editor.uploadBusy'));
          flashStatus(t('editor.uploadCompleteIgnored', {
            count: uploadedCount,
            target: uploadedTarget,
            ignored: ignoredDrops,
          }));
        }
      }
    }

    function ProjectPanel({
      t,
      root,
      home,
      entries,
      children,
      expanded,
      rows,
      projectRows,
      projectView,
      onProjectViewChange,
      filteredView,
      supportsExpansion,
      emptyMessage,
      selectedPath,
      selection,
      hasActiveFile,
      git,
      loading,
      error,
      createState,
      onToggle,
      onOpen,
      onOpenPreview,
      onSelect,
      onOpenCreateMenu,
      onOpenOptions,
      optionsOpen,
      onCreateChange,
      onCreateCommit,
      onCreateCancel,
      onReveal,
      onExpandSelected,
      onExpandAll,
      canCollapseAll,
      onCollapseAll,
      onNotify,
      onRefresh,
      onHide,
      rowRefs,
      treeRef,
      onTreeKeyDown,
      onContextMenu,
      onRootContextMenu,
      rootContextMenuOpen,
      onDrop,
      onUpload,
      onCancelUpload,
      uploadBusy,
      uploadProgress,
      showHidden,
      sortMode,
      onManualReorder,
      foldersFirst,
      showExcludedFiles,
      onCycleSort,
      onToggleHidden,
      singleClickOpen,
      onToggleSingleClickOpen,
      openDirectoriesSingleClick,
      onToggleOpenDirectoriesSingleClick,
      compactDirectories,
      onCreateParent,
      onCreateTemplate,
      renameState,
      onRenameChange,
      onRenameCommit,
      onRenameCancel,
      deletedPaths,
      newPaths,
    }) {
      const projectName = basename(root) || 'Workspace';
      const progressPercent = uploadProgress === null || uploadProgress === undefined
        ? 0
        : uploadProgressPercent(uploadProgress.loaded, uploadProgress.total);
      const [search, setSearch] = React.useState('');
      const [viewMenu, setViewMenu] = React.useState(null);
      /* IDEA highlights the tree when a dragged row would land on the root. */
      const [rootDropActive, setRootDropActive] = React.useState(false);
      const [externalDropPath, setExternalDropPath] = React.useState(null);
      const [toolbarDropActive, setToolbarDropActive] = React.useState(false);
      const [manualDrop, setManualDrop] = React.useState(null);
      const uploadExternalWorkspaceDrop = (event, targetDirectory) => {
        const handles = captureDroppedWorkspaceHandles(event.dataTransfer);
        if (typeof onUpload === 'function') onUpload(handles, targetDirectory);
      };
      const toolbarDropDirectory = projectToolbarDropDirectory(projectRows, selectedPath);
      const handleToolbarDragOver = (event) => {
        if (!dataTransferIncludesFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        setToolbarDropActive(true);
      };
      const handleToolbarDragLeave = (event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setToolbarDropActive(false);
      };
      const handleToolbarDrop = (event) => {
        if (!dataTransferIncludesFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        setToolbarDropActive(false);
        if (typeof onUpload === 'function') {
          onUpload(captureDroppedWorkspaceHandles(event.dataTransfer), toolbarDropDirectory);
        }
      };
      const [searchOpen, setSearchOpen] = React.useState(false);
      const [searchEntries, setSearchEntries] = React.useState(null);
      const [searchPending, setSearchPending] = React.useState(false);
      const [searchError, setSearchError] = React.useState(null);
      const [searchTruncated, setSearchTruncated] = React.useState(false);
      const searchRef = React.useRef(null);
      const searchRequestRef = React.useRef(0);
      React.useEffect(() => bindShiftWheelScroll(treeRef.current), []);
      /* ⌘/Ctrl+F inside the tool window filters the tree in place, like IDEA. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          /* Shift+Cmd/Ctrl+F is IDEA's Find in Files. The Project speed search
             owns only the unshifted chord, even when focus is outside Monaco. */
          if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'f') return;
          const host = event.target instanceof Element ? event.target.closest('[data-dsh-editor-workspace]') : null;
          if (host === null) return;
          /* The editor owns ⌘F when its textarea has focus. */
          if (document.activeElement?.closest('.monaco-editor') != null) return;
          event.preventDefault();
          event.stopPropagation();
          setSearchOpen(true);
          window.setTimeout(() => searchRef.current?.focus(), 0);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, []);
      React.useEffect(() => {
        if (!searchOpen) return undefined;
        /* Project Options closes through ContextMenu, whose return-focus lands
           on the tree. If speed search was the surface being used, keep it as
           the active keyboard surface after the setting is applied. */
        /* Project Options restores tree focus immediately and again after
           120ms. Reclaim search focus after that second write. */
        const timer = window.setTimeout(() => searchRef.current?.focus(), 160);
        return () => window.clearTimeout(timer);
      }, [compactDirectories, searchOpen, showExcludedFiles, showHidden, sortMode]);
      const localRows = React.useMemo(() => filterTreeRows(rows, search), [rows, search]);
      const visibleRows = React.useMemo(
        () => (search.trim() === '' || searchEntries === null
          ? localRows
          : searchEntryRows(searchEntries, projectName, compactDirectories)),
        [compactDirectories, localRows, projectName, search, searchEntries],
      );
      React.useEffect(() => {
        const query = search.trim();
        const requestId = ++searchRequestRef.current;
        if (query === '') {
          setSearchEntries(null);
          setSearchPending(false);
          setSearchError(null);
          setSearchTruncated(false);
          return undefined;
        }
        if (filteredView === true) {
          /* Open Files / All Changed Files are already bounded filters. Searching
             them must not escape into a recursive project walk and show files
             that the selected view intentionally excludes. */
          setSearchEntries(null);
          setSearchPending(false);
          setSearchError(null);
          setSearchTruncated(false);
          return undefined;
        }
        setSearchEntries(null);
        setSearchPending(true);
        setSearchError(null);
        setSearchTruncated(false);
        const timer = window.setTimeout(() => {
          callFs({
            op: 'search',
            query,
            showHidden,
            showExcluded: showExcludedFiles,
            sort: sortMode,
            foldersFirst,
          }).then((value) => {
            if (searchRequestRef.current !== requestId) return;
            setSearchEntries(Array.isArray(value?.entries) ? value.entries : []);
            setSearchTruncated(value?.truncated === true);
            setSearchPending(false);
          }).catch((failure) => {
            if (searchRequestRef.current !== requestId) return;
            /* Keep the local filtered rows when the recursive walk fails; a
               transient host error must not blank a tree that is still usable. */
            setSearchEntries(null);
            setSearchPending(false);
            setSearchError(failure instanceof Error ? failure.message : String(failure));
            setSearchTruncated(false);
          });
        }, 160);
        return () => window.clearTimeout(timer);
      }, [filteredView, foldersFirst, search, showExcludedFiles, showHidden, sortMode]);
      const hits = React.useMemo(() => speedSearchHitRows(visibleRows, search), [search, visibleRows]);
      const selectSearchHit = React.useCallback((row) => {
        if (row === null || row === undefined) return;
        onSelect(row, {});
        window.setTimeout(() => rowRefs.current?.get(row.path)?.scrollIntoView?.({ block: 'nearest' }), 0);
      }, [onSelect, rowRefs]);
      /* IDEA's speed search moves the current row as soon as the query narrows
         to a hit; Enter then opens that row rather than some other first match. */
      React.useEffect(() => {
        if (search.trim() === '' || hits.length === 0) return;
        if (hits.some((row) => row.path === selectedPath)) return;
        selectSearchHit(hits[0]);
      }, [hits, search, selectedPath, selectSearchHit]);
      const closeTreeSearch = () => {
        setSearch('');
        setSearchOpen(false);
        window.setTimeout(() => treeRef.current?.focus(), 0);
      };
      const gitChanges = new Map((git?.changes ?? []).map((change) => [change.path, change.status]));
      /* A directory inherits the strongest status among its descendants (IDEA aggregates colours). */
      const directoryChanged = (path) => (git?.changes ?? []).some((change) => change.path.startsWith(`${path}/`));
      /**
       * Aggregate one directory's git state from everything below it.
       *
       * The order is IDEA's precedence: a conflict outranks a deletion, which
       * outranks an addition, which outranks a rename, which outranks a plain
       * modification. The row shows a badge even while the directory is
       * collapsed — that is the only place the state is visible then.
       * @param {string} path - workspace-relative directory path.
       * @returns {{label: string, color: string}|null} badge, or null when clean.
       */
      const directoryStatus = (path) => directoryTint((git?.changes ?? []).filter((change) => change.path.startsWith(`${path}/`)));
      const createParent = createState === null ? '' : createState.parent;
      /* Every directory the tree currently knows about, root first. */
      const directoryChoices = React.useMemo(() => {
        const seen = new Set(['']);
        const choices = [{ path: '', name: projectName }];
        for (const row of projectRows) {
          if (row.kind !== 'directory' || seen.has(row.path)) continue;
          seen.add(row.path);
          choices.push({ path: row.path, name: row.path });
        }
        return choices;
      }, [projectName, projectRows]);
      const viewDefinitions = projectViewDefinitions(t);
      const currentViewLabel = viewDefinitions.find((definition) => definition.id === projectView)?.label
        ?? t('editor.projectViewProjectFiles');
      return React.createElement(
        React.Fragment,
        null,
        viewMenu === null
          ? null
          : React.createElement(ContextMenu, { menu: viewMenu, onClose: () => setViewMenu(null), t }),
        React.createElement(PanelToolbar, {
          t,
          ariaLabel: t('editor.project'),
          icon: 'project',
          title: t('editor.project'),
          /* Leave one measured slot for the pinned Select Opened File action.
           * At the minimum Project width, 76% let the project path consume the
           * entire action row and pushed the target into "»". */
          titleActionStyle: { maxWidth: '68%' },
          titleAction: React.createElement(
            'span',
            { style: styles.projectViewTitle },
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dsh-editor-project-root-button',
                style: {
                  ...styles.projectRootButton,
                  ...(rootContextMenuOpen ? { background: 'var(--dsw-alias-state-business-primary)', color: '#fff' } : null),
                },
                title: root,
                'aria-label': t('editor.copyProjectPath'),
                'data-dsh-project-root-context-active': rootContextMenuOpen ? 'true' : undefined,
                onClick: () => copySearchResultText(root, onNotify, t),
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.focus();
                  onRootContextMenu({ x: event.clientX, y: event.clientY });
                },
                onKeyDown: (event) => {
                  if (event.key !== 'ContextMenu' && !(event.shiftKey === true && event.key === 'F10')) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  onRootContextMenu({ x: rect.left, y: rect.bottom + 4 });
                },
              },
              projectName,
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dsh-editor-project-view-button',
                style: styles.projectViewButton,
                title: `${t('editor.projectViewMenu')}: ${currentViewLabel}`,
                'aria-label': `${t('editor.projectViewMenu')}: ${currentViewLabel}`,
                'aria-haspopup': 'menu',
                'aria-expanded': viewMenu !== null,
                onClick: (event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setViewMenu({
                    x: Math.max(4, rect.left - 4),
                    y: rect.bottom + 4,
                    title: t('editor.projectViewMenu'),
                    items: viewDefinitions.map((definition) => ({
                      id: `project-view:${definition.id}`,
                      label: definition.label,
                      shortcut: definition.id === projectView ? '✓' : '',
                      disabled: definition.available !== true,
                      run: () => onProjectViewChange(definition.id),
                    })),
                  });
                },
              },
              React.createElement(Icon, { name: 'chevronDown', size: 10 }),
            ),
          ),
          left: [
            /* IDEA keeps the creation entry and "Select Opened File" visible.
               Navigation popups remain reachable from Options below. */
            { id: 'newEntry', group: 'create', icon: 'newFile', label: t('editor.newFileOrDirectory'), onClick: onOpenCreateMenu },
            {
              id: 'reveal',
              group: 'navigation',
              icon: 'target',
              label: t('editor.reveal'),
              /* IDEA keeps Select Opened File in the direct Project toolbar;
                 unlike New/Expand/Collapse it must not disappear first when the
                 tool window narrows. */
              pinned: true,
              disabled: hasActiveFile !== true,
              ariaKeyShortcuts: 'Alt+F1 1',
              onClick: onReveal,
            },
          ],
          right: [
            {
              id: 'expandSelected',
              group: 'navigation',
              icon: 'expand',
              label: t('editor.revealSelected'),
              disabled: !projectCanExpandSelection(rows, selection) || supportsExpansion !== true,
              onClick: onExpandSelected,
            },
            { id: 'collapse', group: 'navigation', icon: 'collapse', label: t('editor.collapseAll'), disabled: !canCollapseAll || supportsExpansion !== true, onClick: onCollapseAll },
            {
              id: 'options',
              group: 'window',
              icon: 'settings',
              label: t('editor.options'),
              ariaHasPopup: 'menu',
              ariaExpanded: optionsOpen === true,
              onClick: onOpenOptions,
            },
            { id: 'hide', group: 'window', icon: 'hide', label: t('editor.hide'), onClick: onHide },
          ],
          dropActive: toolbarDropActive,
          onDragEnter: handleToolbarDragOver,
          onDragLeave: handleToolbarDragLeave,
          onDragOver: handleToolbarDragOver,
          onDrop: handleToolbarDrop,
        }),
        uploadProgress === null || uploadProgress === undefined
          ? null
          : React.createElement(
              'div',
              { style: { padding: '5px 8px', borderBottom: '1px solid var(--dsw-alias-separator-secondary, rgba(127,127,127,0.22))' } },
              React.createElement(
                'div',
                { role: 'status', style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11, lineHeight: '16px', display: 'flex', gap: 6 } },
                React.createElement(
                  'span',
                  { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  t('editor.uploadProgressCurrent', {
                    name: uploadProgress.name,
                    index: uploadProgress.index,
                    count: uploadProgress.count,
                    loaded: formatUploadBytes(uploadProgress.loaded),
                    total: formatUploadBytes(uploadProgress.total),
                  }),
                ),
                React.createElement('span', { style: { flex: '0 0 auto' } }, `${progressPercent}%`),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    'data-dsh-upload-cancel': '',
                    'aria-label': t('editor.uploadCancel'),
                    title: t('editor.uploadCancel'),
                    onClick: onCancelUpload,
                    style: {
                      flex: '0 0 auto',
                      border: '1px solid var(--dsw-alias-separator-secondary, rgba(127,127,127,0.35))',
                      background: 'transparent',
                      color: 'inherit',
                      borderRadius: 4,
                      padding: '0 6px',
                      font: 'inherit',
                      cursor: 'pointer',
                    },
                  },
                  t('editor.uploadCancel'),
                ),
              ),
              React.createElement(
                'div',
                {
                  role: 'progressbar',
                  'aria-label': t('editor.uploadingItems', { count: uploadProgress.count }),
                  'aria-valuemin': 0,
                  'aria-valuemax': 100,
                  'aria-valuenow': progressPercent,
                  style: { height: 2, marginTop: 3, background: 'var(--dsw-alias-bg-hover, rgba(127,127,127,0.18))', borderRadius: 2, overflow: 'hidden' },
                },
                React.createElement('div', {
                  style: {
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'var(--dsw-alias-state-business-primary)',
                    transition: 'width 120ms linear',
                  },
                }),
              ),
            ),
        searchOpen
          ? React.createElement(
              'div',
              { style: styles.treeSearchRow },
              React.createElement(Icon, { name: 'search', size: 12 }),
              React.createElement('input', {
                ref: searchRef,
                style: { ...styles.findInput, flex: '1 1 auto', width: 'auto' },
                placeholder: t('editor.treeSearchPlaceholder'),
                value: search,
                'aria-label': t('editor.treeSearch'),
                onChange: (event) => setSearch(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeTreeSearch();
                  } else if (
                    hits.length > 0
                    && (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                  ) {
                    event.preventDefault();
                    const direction = event.key === 'ArrowDown' ? 'next' : 'previous';
                    const targetPath = speedSearchTarget(visibleRows, search, selectedPath, direction);
                    selectSearchHit(hits.find((row) => row.path === targetPath));
                  } else if (event.key === 'Enter') {
                    /* Enter opens the current hit, IDEA's speed-search behaviour —
                       and "jumps" means opens it: selecting a row leaves the
                       editor showing the previous file. */
                    event.preventDefault();
                    const hit = hits.find((row) => row.path === selectedPath) ?? hits[0];
                    if (hit === undefined) return;
                    onSelect(hit, {});
                    /* Close the box so the opened file (or folder) owns the keyboard. */
                    setSearch('');
                    setSearchOpen(false);
                    /* Expand a CLOSED folder; an open one stays open (toggling would
                       close it, the opposite of "jump to this directory"). */
                    const action = revealInTree({ ...hit, open: expanded.has(hit.path) });
                    if (action === 'expand') onToggle(hit.path);
                    else if (action === 'open') onOpen(hit.path);
                    /* Hand the keyboard back to the tree: the search box is gone, and
                       leaving focus on a detached input strands the arrow keys. */
                    window.setTimeout(() => treeRef.current?.focus(), 0);
                  }
                },
              }),
              React.createElement(
                'button',
                { type: 'button', style: styles.conflictAction, onClick: closeTreeSearch },
                '×',
              ),
            )
          : null,
        createState !== null
          ? React.createElement(
              'div',
              { style: styles.createRow },
              React.createElement(Icon, { name: createState.kind === 'directory' ? 'newFolder' : 'newFile', size: 14 }),
              React.createElement('input', {
                style: styles.createInput,
                value: createState.value,
                placeholder: createState.kind === 'directory' ? t('editor.newFolder') : t('editor.newFile'),
                autoFocus: true,
                onChange: (event) => onCreateChange(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onCreateCommit();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    onCreateCancel();
                  }
                },
              }),
              /* The parent is selectable here: the row that was selected when the box
                 opened is only a guess, and a wrong guess creates the file elsewhere. */
              React.createElement(
                'select',
                {
                  style: styles.createParentSelect,
                  value: createParent,
                  'aria-label': t('editor.createIn'),
                  title: t('editor.createIn'),
                  onChange: (event) => onCreateParent(event.target.value),
                },
                directoryChoices.map((directory) =>
                  React.createElement(
                    'option',
                    { key: directory.path === '' ? 'root' : directory.path, value: directory.path },
                    directory.path === '' ? projectName : directory.path,
                  ),
                ),
              ),
              /* IDEA asks WHICH template before it creates a file; a checkbox is
                 the cheapest honest version of that choice: on = the extension's
                 skeleton, off = an empty file. Hidden for directories, which have
                 no content to template. */
              createState.kind === 'file' && onCreateTemplate !== undefined
                ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: { ...styles.createTemplateToggle, ...(createState.template === false ? null : styles.createTemplateToggleOn) },
                      title: createState.template === false ? t('editor.templateOn') : t('editor.templateOff'),
                      'aria-pressed': createState.template !== false,
                      onClick: () => onCreateTemplate(createState.template === false),
                    },
                    '{ }',
                  )
                : null,
            )
          : null,
        React.createElement(
          'div',
          {
            className: 'dsh-editor-tool-scroll',
            ref: treeRef,
            tabIndex: 0,
            style: { ...styles.treeScroll, ...(rootDropActive ? styles.treeRootDrop : null) },
            onKeyDown: onTreeKeyDown,
            onContextMenu: (event) => {
              if (event.target instanceof Element && event.target.closest('.dsh-editor-tree-row') !== null) return;
              event.preventDefault();
              event.stopPropagation();
              treeRef.current?.focus();
              onRootContextMenu({ x: event.clientX, y: event.clientY });
            },
            role: 'tree',
            'aria-label': t('editor.project'),
            'aria-busy': uploadBusy ? 'true' : undefined,
            onDragOver: (event) => {
              const externalFiles = dataTransferIncludesFiles(event.dataTransfer);
              if (!externalFiles && !event.dataTransfer?.types?.includes('text/plain')) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = externalFiles ? 'copy' : 'move';
              if (externalFiles) {
                setExternalDropPath('');
                setRootDropActive(true);
              } else if (sortMode !== 'manual') setRootDropActive(true);
            },
            onDragLeave: (event) => {
              if (event.currentTarget.contains(event.relatedTarget)) return;
              setRootDropActive(false);
              setExternalDropPath(null);
            },
            onDrop: (event) => {
              const externalFiles = dataTransferIncludesFiles(event.dataTransfer);
              const raw = externalFiles ? '' : event.dataTransfer?.getData('text/plain') ?? '';
              const sources = raw.split('\n').filter((entry) => entry !== '');
              const overRow = event.target instanceof Element ? event.target.closest('.dsh-editor-tree-row') !== null : false;
              setRootDropActive(false);
              if (overRow) return;
              event.preventDefault();
              if (sources.length === 0) {
                setExternalDropPath(null);
                if (externalFiles) uploadExternalWorkspaceDrop(event, '');
                return;
              }
              if (sortMode !== 'manual') onDrop(sources, '');
            },
          },
          shouldShowTreeLoading({ loading, rowCount: visibleRows.length })
            ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading'))
            : null,
          loading !== true && error === null && search.trim() === '' && visibleRows.length === 0
            && typeof emptyMessage === 'string' && emptyMessage !== ''
            ? React.createElement('div', { style: styles.treeMessage }, emptyMessage)
            : null,
          error !== null ? React.createElement('div', { style: styles.treeMessage }, error) : null,
          searchError !== null && search.trim() !== ''
            ? React.createElement('div', { style: styles.treeMessage }, `${t('editor.treeSearchFailed')}: ${searchError}`)
            : null,
          treeSearchMiss({ query: search, rows: visibleRows, loading: searchPending })
            ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches'))
            : null,
          searchTruncated ? React.createElement('div', { style: styles.treeMessage }, t('editor.treeSearchTruncated')) : null,
          visibleRows.map((row, rowIndex) => {
            if (row.kind === 'placeholder') {
              return React.createElement(
                'div',
                {
                  key: row.path,
                  className: 'dsh-editor-tree-row dsh-editor-tree-row-placeholder',
                  'data-dsh-placeholder': row.path,
                  style: { ...styles.treeRow, paddingLeft: 8 + row.depth * 14, color: 'var(--dsw-alias-label-tertiary)', fontStyle: 'italic', cursor: 'default' },
                },
                t('editor.emptyDirectory'),
              );
            }
            const selected = selection.has(row.path);
            const primary = row.path === selectedPath;
            const status = gitChanges.get(row.path);
            const isDirectory = row.kind === 'directory';
            const open = row.searchOpen === true || expanded.has(row.path);
            const projectRowPosition = projectTreePosition(visibleRows, rowIndex);
            return React.createElement(
              'div',
              {
                key: row.path === '' ? '__root__' : row.path,
                ref: (element) => {
                  if (element !== null) rowRefs.current.set(row.path, element);
                  else rowRefs.current.delete(row.path);
                },
                className: selected
                  ? primary
                    ? 'dsh-editor-tree-row dsh-editor-tree-row-selected'
                    : 'dsh-editor-tree-row dsh-editor-tree-row-selected dsh-editor-tree-row-extended'
                  : 'dsh-editor-tree-row',
                style: {
                  ...styles.treeRow,
                  ...(selected ? (primary ? styles.treeRowSelected : styles.treeRowSelectedSoft) : null),
                  ...(externalDropPath === row.path
                    ? { position: 'relative' }
                    : null),
                  ...(manualDrop?.path === row.path
                    ? manualDrop.edge === 'after'
                      ? { boxShadow: 'inset 0 -2px 0 var(--dsw-alias-state-business-primary)' }
                      : { boxShadow: 'inset 0 2px 0 var(--dsw-alias-state-business-primary)' }
                    : null),
                },
                title: row.path === '' ? root : row.path,
                role: 'treeitem',
                'aria-level': projectRowPosition.level,
                'aria-posinset': projectRowPosition.posinset,
                'aria-setsize': projectRowPosition.setsize,
                'aria-expanded': isDirectory ? open : undefined,
                'aria-selected': selected,
                onClick: (event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  if (isDirectory) {
                    if (row.root !== true && openDirectoriesSingleClick === true) onToggle(row.path);
                  }
                  else if (singleClickOpen === true) onOpenPreview(row.path);
                },
                /* IDEA keeps the keyboard in the TREE after a row click: the arrow
                   keys, the typeahead and ⇧F6/⌫ all belong to the selected row.
                   Opening the file used to move focus into Monaco, so the tree's
                   advertised keys (F2, Delete, ⌘F, typeahead) never reached it. */
                onMouseDown: (event) => {
                  if (event.button !== 0) return;
                  if (event.target instanceof Element && event.target.closest('input') !== null) return;
                  treeRef.current?.focus();
                  onSelect(row, event);
                },
                /* IDEA's default Project gesture opens a file on double-click;
                   "Open Files with Single Click" is an explicit preference. This
                   must not start a rename: the old inline editor also committed
                   on blur, so clicking rows could silently rename them. */
                onDoubleClick: (event) => {
                  if (row.root) return;
                  if (isDirectory && openDirectoriesSingleClick !== true) onToggle(row.path);
                  else if (!isDirectory && singleClickOpen !== true) onOpen(row.path);
                  /* Keep the second click from toggling the directory back. */
                  event.stopPropagation();
                },
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  /* Right-clicking outside the selection moves it; inside it acts on all rows. */
                  if (!selection.has(row.path)) onSelect(row, {});
                  onContextMenu({ row, x: event.clientX, y: event.clientY });
                },
                draggable: !row.root,
                onDragStart: (event) => {
                  /* Dragging a row inside a multi-row selection moves the whole selection. */
                  const payload = selection.has(row.path) && selection.size > 1
                    ? rows.filter((entry) => selection.has(entry.path) && entry.path !== '').map((entry) => entry.path)
                    : [row.path];
                  event.dataTransfer?.setData('text/plain', payload.join('\n'));
                  event.dataTransfer.effectAllowed = 'move';
                },
                onDragEnd: () => {
                  setManualDrop(null);
                  setRootDropActive(false);
                  setExternalDropPath(null);
                },
                onDragOver: (event) => {
                  if (dataTransferIncludesFiles(event.dataTransfer)) {
                    event.preventDefault();
                    event.stopPropagation();
                    const targetDirectory = projectExternalDropDirectory(row);
                    event.dataTransfer.dropEffect = 'copy';
                    setManualDrop(null);
                    setExternalDropPath(targetDirectory);
                    return;
                  }
                  if (!event.dataTransfer?.types?.includes('text/plain')) return;
                  if (sortMode === 'manual') {
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const edge = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                    event.dataTransfer.dropEffect = 'move';
                    setManualDrop({ path: row.path, edge });
                    return;
                  }
                  if (!isDirectory) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                },
                onDragLeave: (event) => {
                  if (event.currentTarget.contains(event.relatedTarget)) return;
                  if (manualDrop?.path === row.path) setManualDrop(null);
                  if (externalDropPath !== null) setExternalDropPath(null);
                },
                onDrop: (event) => {
                  if (dataTransferIncludesFiles(event.dataTransfer)) {
                    event.preventDefault();
                    event.stopPropagation();
                    setExternalDropPath(null);
                    const targetDirectory = projectExternalDropDirectory(row);
                    const handles = captureDroppedWorkspaceHandles(event.dataTransfer);
                    if (typeof onUpload === 'function') onUpload(handles, targetDirectory);
                    return;
                  }
                  if (sortMode === 'manual') {
                    event.preventDefault();
                    event.stopPropagation();
                    const sources = (event.dataTransfer?.getData('text/plain') ?? '').split('\n').filter((entry) => entry !== '');
                    const edge = manualDrop?.path === row.path ? manualDrop.edge : 'before';
                    setManualDrop(null);
                    if (sources.length > 0) onManualReorder(sources, row.path, edge);
                    return;
                  }
                  if (!isDirectory) return;
                  event.preventDefault();
                  /* One path per line: the drop handler moves each of them. */
                  const sources = (event.dataTransfer?.getData('text/plain') ?? '').split('\n').filter((entry) => entry !== '');
                  if (sources.length === 0 || sources.includes(row.path)) return;
                  onDrop(sources, row.path);
                },
              },
              /* Indentation FIRST, then the chevron: with the guides after it every
                 row's arrow sat at the same left edge, so a nested folder looked like a
                 sibling and the hierarchy only showed as trailing whitespace. */
              row.depth > 0
                ? Array.from({ length: row.depth }, (_, index) => {
                    const kind = guideKind({ continues: row.continues, index, depth: row.depth });
                    return React.createElement('span', {
                      key: index,
                      style: kind === 'line' ? styles.indentGuide : styles.indentGuideStop,
                    });
                  })
                : null,
              row.root
                ? null
                : isDirectory
                ? React.createElement(
                    'span',
                    {
                      style: { ...styles.chevron, color: selected ? '#fff' : 'var(--dsw-alias-label-tertiary)' },
                      role: 'button',
                      tabIndex: -1,
                      'aria-label': open ? t('editor.collapseFolder') : t('editor.expandFolder'),
                      title: open ? t('editor.collapseFolder') : t('editor.expandFolder'),
                      onClick: (event) => {
                        event.stopPropagation();
                        onToggle(row.path);
                      },
                    },
                    React.createElement(Icon, { name: open ? 'chevronDown' : 'chevronRight', size: 10 }),
                  )
                /* Files keep the column so their icon lines up with sibling folders. */
                : React.createElement('span', { style: { ...styles.chevron, opacity: 0 } }),
              React.createElement(EntryIcon, { entry: row, expanded: open }),
              renameState !== null && renameState.path === row.path
                ? React.createElement('input', {
                    style: styles.renameInput,
                    value: renameState.value,
                    autoFocus: true,
                    onClick: (event) => event.stopPropagation(),
                    onChange: (event) => onRenameChange(event.target.value),
                    onBlur: () => onRenameCommit(),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onRenameCommit();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        onRenameCancel();
                      }
                    },
                  })
                : React.createElement(
                    'span',
                    {
                      style: {
                        ...styles.treeName,
                        ...(row.root ? styles.treeRootName : null),
                        /* The root's folder name is the part that identifies the
                           project; only the path beside it may be truncated. */
                        ...(row.root ? styles.treeRootLabel : null),
                        ...(selected ? { color: '#fff' } : null),
                        /* Files and folders alike: a change tints the name, never a letter. */
                        ...(treeNameColor({ status, selected }) === null ? null : { color: treeNameColor({ status, selected }) }),
                        ...(isDirectory && !selected && status === undefined && directoryStatus(row.path) !== null
                          ? { color: directoryStatus(row.path).color }
                          : null),
                        /* IDEA strikes through a file that vanished from disk. */
                        ...(deletedPaths?.has?.(row.path) ? { textDecoration: 'line-through', opacity: 0.6 } : null),
                        /* A file created outside the editor is tinted once, like IDEA's "new" hint. */
                        ...(newPaths?.has?.(row.path) ? { color: '#1a7f37' } : null),
                      },
                    },
                    /* Speed search underlines what matched; the rest keeps its colour. */
                    search.trim() === ''
                      ? row.name
                      : highlightParts(row.name, search).map((part, index) =>
                          part.match
                            ? React.createElement('span', { key: index, style: styles.treeNameMatch }, part.text)
                            : React.createElement('span', { key: index }, part.text),
                        ),
                  ),
              row.root
                ? React.createElement(
                    React.Fragment,
                    null,
                    branchLabel(git) !== '' ? React.createElement('span', { style: { ...styles.branchChip, marginLeft: 6 } }, branchLabel(git)) : null,
                    React.createElement(
                      'span',
                      { style: { ...styles.treeRootPath, color: selected ? 'rgba(255,255,255,0.72)' : undefined }, title: root },
                      splitRootLabel(root, home).path,
                    ),
                  )
                : null,
              externalDropPath === row.path
                ? React.createElement('span', {
                    'data-dsh-project-file-drop-line': row.path,
                    'aria-hidden': true,
                    style: {
                      position: 'absolute',
                      left: 8 + row.depth * 14 + 18,
                      right: 8,
                      bottom: 0,
                      height: 2,
                      borderRadius: 2,
                      background: 'var(--dsw-alias-state-business-primary)',
                      pointerEvents: 'none',
                    },
                  })
                : null,
            );
          }),
        ),
      );
    }

    /**
     * IDEA-style context menu: one flat list of items with separators, icons and
     * disabled states, positioned at the pointer and dismissed on outside click.
     */
    /**
     * What a key press means for the currently focused menu level.
     *
     * IDEA's menus are navigable without the mouse: → opens a submenu (or steps into
     * its first item), ← returns to the parent level, and Esc closes ONE level so a
     * nested choice can be abandoned without losing the whole menu.
     * @param {string} key - the pressed key.
     * @param {{hasChildren: boolean, open: boolean}} state - the focused item.
     * @returns {'open'|'close'|'back'|'dismiss'|'first-child'|null} the action.
     */
