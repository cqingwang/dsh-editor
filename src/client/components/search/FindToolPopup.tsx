import React from 'react';
import { styles } from '../../ui/styles';

export interface FindToolPopupGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FindToolPopupProps {
  open: boolean;
  geometry: FindToolPopupGeometry;
  onPopupDragStart: (event: any) => void;
  onPopupResizeStart: (event: any, direction: string) => void;
  children: React.ReactElement<any> | null;
}

function FindToolPopup({ open, geometry, onPopupDragStart, onPopupResizeStart, children }: FindToolPopupProps) {
  if (!open || children === null) return null;
  return (
    <div
      style={{
        ...styles.findToolPopup,
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        transform: 'none',
      }}
      data-dsh-find-tool-popup=''>
      {React.cloneElement(children, {
        onPopupDragStart,
        onPopupResizeStart,
      })}
    </div>
  );
}

export { FindToolPopup };
