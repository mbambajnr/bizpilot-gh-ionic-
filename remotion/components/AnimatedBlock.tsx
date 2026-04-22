import React, {PropsWithChildren} from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const AnimatedBlock: React.FC<
  PropsWithChildren<{
    delay?: number;
    from?: 'bottom' | 'right' | 'left';
    style?: React.CSSProperties;
  }>
> = ({children, delay = 0, from = 'bottom', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({
    fps,
    frame: frame - delay,
    config: {
      damping: 18,
      stiffness: 140,
      mass: 0.9,
    },
  });

  const translateDistance = 42;
  const x =
    from === 'right'
      ? interpolate(entrance, [0, 1], [translateDistance, 0])
      : from === 'left'
        ? interpolate(entrance, [0, 1], [-translateDistance, 0])
        : 0;
  const y = from === 'bottom' ? interpolate(entrance, [0, 1], [translateDistance, 0]) : 0;

  return (
    <div
      style={{
        opacity: entrance,
        transform: `translate(${x}px, ${y}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
