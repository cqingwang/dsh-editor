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
