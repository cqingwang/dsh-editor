/* find-tool.js MeasuringScreen legacy oracle. */

    function MeasuringScreen({ fontSize, onGrid }) {
      const hostRef = React.useRef(null);
      const handlersRef = React.useRef({ onGrid });
      handlersRef.current = { onGrid };
      React.useEffect(() => {
        const node = hostRef.current;
        if (node === null) return undefined;
        let disposed = false;
        let emulator = null;
        let observer = null;
        loadXterm().then(
          ({ Terminal, FitAddon }) => {
            if (disposed || node === null) return;
            emulator = new Terminal({
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize,
              lineHeight: 1.25,
              scrollback: 1,
            });
            const fit = new FitAddon();
            emulator.loadAddon(fit);
            emulator.open(node);
            const measure = () => {
              if (node.clientWidth === 0 || node.clientHeight === 0) return;
              fit.fit();
              handlersRef.current.onGrid?.({ cols: Math.max(2, Math.min(500, emulator.cols)), rows: Math.max(1, Math.min(200, emulator.rows)) });
            };
            measure();
            if (typeof ResizeObserver !== 'undefined') {
              observer = new ResizeObserver(measure);
              observer.observe(node);
            }
          },
          () => {
            /* Measuring is an optimisation: a failure keeps the 80×24 fallback. */
          },
        );
        return () => {
          disposed = true;
          observer?.disconnect();
          emulator?.dispose();
        };
      }, [fontSize]);
      return React.createElement('div', {
        ref: hostRef,
        style: styles.terminalMeasure,
        'aria-hidden': 'true',
        'data-dsh-terminal-measure': '',
      });
    }

/* MEASURING_SCREEN_BOUNDARY */
