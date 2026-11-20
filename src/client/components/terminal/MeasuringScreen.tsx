import React from 'react';
import { styles } from '../../ui/styles';
import { EDITOR_BASE_FONT_WEIGHT, EDITOR_TERMINAL_FONT_STACK } from '../editor/editor-style-model';
import { loadXterm, type TerminalEmulator } from '../../find-tool';

export interface MeasuringScreenProps {
  fontSize: number;
  onGrid?: (grid: { cols: number; rows: number }) => void;
}

function MeasuringScreenView({ fontSize, onGrid }: MeasuringScreenProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const handlersRef = React.useRef<{ onGrid?: (grid: { cols: number; rows: number }) => void }>({
    onGrid,
  });
  handlersRef.current = {
    onGrid,
  };
  React.useEffect(() => {
    const node = hostRef.current;
    if (node === null) return undefined;
    let disposed = false;
    let emulator: TerminalEmulator | null = null;
    let observer: ResizeObserver | null = null;
    loadXterm().then(
      ({ Terminal, FitAddon }) => {
        if (disposed || node === null) return;
        const nextEmulator = new Terminal({
          fontFamily: EDITOR_TERMINAL_FONT_STACK,
          fontSize,
          fontWeight: EDITOR_BASE_FONT_WEIGHT,
          lineHeight: 1.25,
          scrollback: 1,
        });
        const fit = new FitAddon();
        nextEmulator.loadAddon(fit);
        nextEmulator.open(node);
        emulator = nextEmulator;
        const measure = () => {
          if (node.clientWidth === 0 || node.clientHeight === 0) return;
          fit.fit();
          handlersRef.current.onGrid?.({
            cols: Math.max(2, Math.min(500, nextEmulator.cols)),
            rows: Math.max(1, Math.min(200, nextEmulator.rows)),
          });
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
  return (
    <div
      ref={hostRef}
      style={styles.terminalMeasure}
      aria-hidden='true'
      data-dsh-terminal-measure=''
    />
  );
}

const MeasuringScreen = MeasuringScreenView;

export { MeasuringScreen };
