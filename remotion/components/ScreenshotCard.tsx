import React from 'react';
import {Img} from 'remotion';

import {adColors} from './AdShell';

export const ScreenshotCard: React.FC<{
  src: string;
  label: string;
  title: string;
  caption: string;
  compact?: boolean;
  objectPosition?: string;
}> = ({src, label, title, caption, compact = false, objectPosition = 'top center'}) => {
  return (
    <div
      style={{
        display: 'grid',
        gap: compact ? 12 : 14,
        padding: compact ? 18 : 22,
        borderRadius: 24,
        border: `1px solid ${adColors.line}`,
        background: 'rgba(255,255,255,0.86)',
        boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)',
        height: '100%',
      }}
    >
      <div style={{display: 'grid', gap: 6}}>
        <p
          style={{
            margin: 0,
            color: adColors.teal,
            fontSize: compact ? 20 : 22,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </p>
        <h3
          style={{
            margin: 0,
            color: adColors.ink,
            fontSize: compact ? 28 : 34,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            color: adColors.inkSoft,
            fontSize: compact ? 20 : 22,
            lineHeight: 1.45,
          }}
        >
          {caption}
        </p>
      </div>
      <div
        style={{
          borderRadius: 22,
          padding: 8,
          background: 'linear-gradient(180deg, rgba(19,55,70,0.08), rgba(19,55,70,0.02))',
          boxShadow: 'inset 0 0 0 1px rgba(16,50,65,0.06)',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: compact ? 420 : 620,
            objectFit: 'cover',
            objectPosition,
            borderRadius: 18,
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};
