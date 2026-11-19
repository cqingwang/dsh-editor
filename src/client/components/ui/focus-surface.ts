/**
 * 在目标表面完成挂载后的下一帧聚焦。
 *
 * React 切换工具窗时，业务树往往要等 effect/样式步骤结束后才写入 ref。
 * 固定 `setTimeout(0)` 会偶发落到 BODY；这里用有界动画帧重试，并返回取消函数，
 * 让调用方可以在下一次切换或卸载时终止旧意图。
 */
export interface FocusableSurface {
  focus(options?: { preventScroll?: boolean }): void;
  isConnected?: boolean;
}

export interface FocusSurfaceWhenReadyOptions {
  requestFrame?: (callback: (timestamp: number) => void) => number;
  cancelFrame?: (handle: number) => void;
  maxAttempts?: number;
  onExhausted?: () => void;
}

export function focusSurfaceWhenReady(
  resolveSurface: () => FocusableSurface | null | undefined,
  options: FocusSurfaceWhenReadyOptions = {},
): () => void {
  const requestFrame = options.requestFrame ?? window.requestAnimationFrame.bind(window);
  const cancelFrame = options.cancelFrame ?? window.cancelAnimationFrame.bind(window);
  let remaining = Math.max(1, Math.floor(Number(options.maxAttempts ?? 60) || 60));
  let stopped = false;
  let frame = 0;

  const stop = (): void => {
    stopped = true;
    if (frame !== 0) cancelFrame(frame);
    frame = 0;
  };

  const attempt = (): void => {
    frame = 0;
    if (stopped) return;
    const surface = resolveSurface();
    if (surface !== null && surface !== undefined && surface.isConnected !== false) {
      surface.focus({ preventScroll: true });
      stopped = true;
      return;
    }
    if (remaining <= 1) {
      stopped = true;
      options.onExhausted?.();
      return;
    }
    remaining -= 1;
    frame = requestFrame(attempt);
  };

  frame = requestFrame(attempt);
  return stop;
}
