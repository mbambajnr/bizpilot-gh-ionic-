import React, {PropsWithChildren} from 'react';
import {AbsoluteFill} from 'remotion';

export const adColors = {
  ink: '#102b35',
  inkSoft: '#4f6873',
  teal: '#1e6a7f',
  tealDeep: '#143746',
  gold: '#d68245',
  white: '#f8fbfc',
  line: 'rgba(16, 50, 65, 0.1)',
  // Modern Clarity Palette
  brand: '#4f46e5', // Indigo
  accent: '#fb7185', // Rose/Coral
  surface: '#ffffff',
  bg: '#f9fafb',
};

export const AdShell: React.FC<PropsWithChildren> = ({children}) => {
  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at top left, rgba(26, 95, 122, 0.16), transparent 34%), radial-gradient(circle at top right, rgba(214, 130, 69, 0.14), transparent 28%), linear-gradient(180deg, #f6fafb 0%, #edf4f6 52%, #f7fafc 100%)',
        color: adColors.ink,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
