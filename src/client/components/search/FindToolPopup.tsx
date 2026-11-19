import React from 'react';
import { styles } from '../../ui/styles';
import { clampFloatingPopupGeometry, moveFloatingPopupGeometry, resizeFloatingPopupGeometry } from '../../commit';
import { FIND_POPUP_RESIZE_DIRECTIONS } from '../../find-tool';

export interface FloatingToolPopupGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FindToolPopupGeometry = FloatingToolPopupGeometry;

export interface FloatingToolPopupProps {
  open: boolean;
  kind: 'find' | 'searchEverywhere';
  geometry: FloatingToolPopupGeometry;
  surfaceStyle?: React.CSSProperties;
  backdrop?: boolean;
  onBackdropMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onGeometryChange: (geometry: FloatingToolPopupGeometry) => void;
  onGeometryCommit?: (geometry: FloatingToolPopupGeometry) => void;
  children: React.ReactElement<{
    onPopupDragStart?: (event: React.PointerEvent<HTMLElement>) => void;
  }> | null;
}

export interface FindToolPopupProps extends FloatingToolPopupProps {}

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
  onGeometryChange,
  onGeometryCommit,
  children,
}: FloatingToolPopupProps) {
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const geometryRef = React.useRef(geometry);
  geometryRef.current = geometry;

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
      if (
        action === 'move' &&
        target !== null &&
        target.closest('button, input, textarea, select, a, [role="menuitem"]') !== null
      ) {
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

  if (!open || children === null) return null;

  return (
    <React.Fragment>
      {backdrop ? (
        <div
          style={{
            ...styles.paletteBackdrop,
            paddingTop: 0,
            zIndex: 2499,
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
        data-dsh-floating-tool-popup=''
        data-dsh-find-tool-popup={kind === 'find' ? '' : undefined}
        data-dsh-search-everywhere-popup={kind === 'searchEverywhere' ? '' : undefined}>
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
