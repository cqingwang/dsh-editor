import React from 'react';
import { POPUP_BORDER, styles } from '../../ui/styles';
import { clampFloatingPopupGeometry, moveFloatingPopupGeometry, resizeFloatingPopupGeometry } from '../../commit';
import { FIND_POPUP_RESIZE_DIRECTIONS } from '../../find-tool';
import { trapDialogFocus } from '../ui/focus-trap';

export interface FloatingToolPopupGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FindToolPopupGeometry = FloatingToolPopupGeometry;

export interface FloatingToolPopupProps {
  open: boolean;
  kind: 'find' | 'searchEverywhere' | 'workspaceDirectory';
  geometry: FloatingToolPopupGeometry;
  surfaceStyle?: React.CSSProperties;
  backdrop?: boolean;
  onBackdropMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  trapFocus?: boolean;
  onRequestClose?: () => void;
  returnFocusElement?: HTMLElement | null;
  ariaLabel?: string;
  onGeometryChange: (geometry: FloatingToolPopupGeometry) => void;
  onGeometryCommit?: (geometry: FloatingToolPopupGeometry) => void;
  children: React.ReactElement<{
    onPopupDragStart?: (event: React.PointerEvent<HTMLElement>) => void;
  }> | null;
}

export interface FindToolPopupProps extends FloatingToolPopupProps {}

const FLOATING_TOOL_POPUP_BACKDROP_Z_INDEX = 2499;
const FLOATING_TOOL_POPUP_Z_INDEX = 2501;

const FLOATING_TOOL_POPUP_SURFACE_STYLE: React.CSSProperties = {
  zIndex: FLOATING_TOOL_POPUP_Z_INDEX,
  border: POPUP_BORDER,
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-base)',
  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.28)',
  overflow: 'hidden',
};

const FLOATING_POPUP_MOVE_IGNORE_SELECTOR =
  'button, input, textarea, select, a, [role="button"], [role="menuitem"], [role="tree"], [role="treeitem"], [role="listbox"], [role="option"], [role="tab"], [role="slider"], [data-dsh-file-tree]';

function floatingPopupResizeHandleStyle(direction: string): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 20,
    touchAction: 'none',
  };
  if (direction === 'n') {
    return {
      ...base,
      left: 8,
      right: 8,
      top: 0,
      height: 5,
      cursor: 'n-resize',
    };
  }
  if (direction === 's') {
    return {
      ...base,
      left: 8,
      right: 8,
      bottom: 0,
      height: 5,
      cursor: 's-resize',
    };
  }
  if (direction === 'e') {
    return {
      ...base,
      top: 8,
      bottom: 8,
      right: 0,
      width: 5,
      cursor: 'e-resize',
    };
  }
  if (direction === 'w') {
    return {
      ...base,
      top: 8,
      bottom: 8,
      left: 0,
      width: 5,
      cursor: 'w-resize',
    };
  }
  return {
    ...base,
    width: 10,
    height: 10,
    ...(direction.includes('n') ? { top: 0 } : { bottom: 0 }),
    ...(direction.includes('w') ? { left: 0 } : { right: 0 }),
    cursor: `${direction}-resize`,
  };
}

function FloatingToolPopup({
  open,
  kind,
  geometry,
  surfaceStyle,
  backdrop = false,
  onBackdropMouseDown,
  trapFocus = false,
  onRequestClose,
  returnFocusElement = null,
  ariaLabel,
  onGeometryChange,
  onGeometryCommit,
  children,
}: FloatingToolPopupProps) {
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const geometryRef = React.useRef(geometry);
  const returnFocusElementRef = React.useRef(returnFocusElement);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const wasOpenRef = React.useRef(false);
  geometryRef.current = geometry;
  returnFocusElementRef.current = returnFocusElement;

  React.useEffect(() => {
    if (open) {
      if (!wasOpenRef.current) {
        const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        previousFocusRef.current =
          returnFocusElementRef.current ??
          (activeElement !== null && activeElement !== document.body ? activeElement : null);
        wasOpenRef.current = true;
      }
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const target = returnFocusElementRef.current ?? previousFocusRef.current;
    previousFocusRef.current = null;
    window.setTimeout(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    }, 0);
  }, [open]);

  React.useEffect(
    () => () => {
      if (!wasOpenRef.current) return;
      wasOpenRef.current = false;
      const target = returnFocusElementRef.current ?? previousFocusRef.current;
      previousFocusRef.current = null;
      window.setTimeout(() => {
        if (target?.isConnected) target.focus({ preventScroll: true });
      }, 0);
    },
    [],
  );

  React.useEffect(() => {
    if (!open || trapFocus !== true || onRequestClose === undefined) return undefined;
    const handleDocumentEscape = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
    };
    document.addEventListener('keydown', handleDocumentEscape);
    return () => document.removeEventListener('keydown', handleDocumentEscape);
  }, [onRequestClose, open, trapFocus]);

  React.useEffect(() => {
    if (!open) return;

    const handleViewportResize = (): void => {
      const current = geometryRef.current;
      const clampedGeometry = clampFloatingPopupGeometry(current, window.innerWidth, window.innerHeight);
      if (
        clampedGeometry.x === current.x &&
        clampedGeometry.y === current.y &&
        clampedGeometry.width === current.width &&
        clampedGeometry.height === current.height
      ) {
        return;
      }
      geometryRef.current = clampedGeometry;
      onGeometryChange(clampedGeometry);
    };

    handleViewportResize();
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [onGeometryChange, open]);

  const startInteraction = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, requestedDirection = 'move'): void => {
      if (event.button !== 0) return;
      const action =
        requestedDirection === 'move'
          ? 'move'
          : FIND_POPUP_RESIZE_DIRECTIONS.includes(requestedDirection)
            ? requestedDirection
            : null;
      if (action === null) return;
      const target = event.target instanceof Element ? event.target : null;
      if (action === 'move' && target !== null && target.closest(FLOATING_POPUP_MOVE_IGNORE_SELECTOR) !== null) {
        return;
      }
      const surface = surfaceRef.current;
      if (surface === null) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = surface.getBoundingClientRect();
      const startGeometry = clampFloatingPopupGeometry(
        { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        window.innerWidth,
        window.innerHeight,
      );
      const startX = event.clientX;
      const startY = event.clientY;
      let latest = startGeometry;
      let moved = false;
      const previousCursor = document.body.style.cursor;
      document.body.style.cursor = action === 'move' ? 'move' : `${action}-resize`;
      const onPointerMove = (moveEvent: PointerEvent): void => {
        moved = true;
        latest =
          action === 'move'
            ? moveFloatingPopupGeometry(
                startGeometry,
                moveEvent.clientX - startX,
                moveEvent.clientY - startY,
                window.innerWidth,
                window.innerHeight,
              )
            : resizeFloatingPopupGeometry(
                startGeometry,
                moveEvent.clientX - startX,
                moveEvent.clientY - startY,
                action,
                window.innerWidth,
                window.innerHeight,
              );
        onGeometryChange(latest);
      };
      const finish = (): void => {
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', finish, true);
        window.removeEventListener('pointercancel', finish, true);
        document.body.style.cursor = previousCursor;
        if (moved) onGeometryCommit?.(latest);
      };
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', finish, true);
      window.addEventListener('pointercancel', finish, true);
    },
    [onGeometryChange, onGeometryCommit],
  );
  const handlePopupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && onRequestClose !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
      return;
    }
    if (trapFocus !== true) return;
    trapDialogFocus(event, surfaceRef.current, { focusWhenOutside: true });
  };

  if (!open || children === null) return null;

  return (
    <React.Fragment>
      {backdrop ? (
        <div
          style={{
            ...styles.paletteBackdrop,
            paddingTop: 0,
            zIndex: FLOATING_TOOL_POPUP_BACKDROP_Z_INDEX,
            pointerEvents: onBackdropMouseDown === undefined ? 'none' : 'auto',
          }}
          data-dsh-floating-tool-backdrop=''
          onMouseDown={onBackdropMouseDown}
        />
      ) : null}
      <div
        ref={surfaceRef}
        style={{
          ...surfaceStyle,
          ...FLOATING_TOOL_POPUP_SURFACE_STYLE,
          position: 'fixed',
          boxSizing: 'border-box',
          minWidth: 0,
          minHeight: 0,
          left: geometry.x,
          top: geometry.y,
          width: geometry.width,
          height: geometry.height,
          transform: 'none',
        }}
        role={trapFocus === true ? 'dialog' : undefined}
        aria-modal={trapFocus === true ? 'true' : undefined}
        aria-label={ariaLabel}
        data-dsh-floating-tool-popup=''
        data-dsh-find-tool-popup={kind === 'find' ? '' : undefined}
        data-dsh-search-everywhere-popup={kind === 'searchEverywhere' ? '' : undefined}
        data-dsh-workspace-directory-picker-popup={kind === 'workspaceDirectory' ? '' : undefined}
        onKeyDown={handlePopupKeyDown}>
        {React.cloneElement(children, {
          onPopupDragStart: (event: React.PointerEvent<HTMLElement>) => startInteraction(event),
        })}
        {FIND_POPUP_RESIZE_DIRECTIONS.map((direction) => (
          <div
            key={`floating-popup-resize:${direction}`}
            data-dsh-floating-popup-resize={direction}
            aria-hidden={true}
            style={floatingPopupResizeHandleStyle(direction)}
            onPointerDown={(event) => startInteraction(event, direction)}
          />
        ))}
      </div>
    </React.Fragment>
  );
}

const FindToolPopup = FloatingToolPopup;

export { FloatingToolPopup, FindToolPopup };
