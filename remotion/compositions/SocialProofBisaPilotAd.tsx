import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {AdShell, adColors} from '../components/AdShell';
import {AnimatedBlock} from '../components/AnimatedBlock';
import type {SocialProofData} from '../data/socialProofData';

const SectionChrome: React.FC<React.PropsWithChildren<{variant?: 'dark' | 'light'}>> = ({
  children,
  variant = 'light',
}) => {
  return (
    <div
      style={{
        borderRadius: 48,
        border: `1px solid ${variant === 'light' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
        background: variant === 'light' 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.85))' 
          : `linear-gradient(135deg, ${adColors.tealDeep}ee, #08161cdd)`,
        backdropFilter: 'blur(20px)',
        boxShadow: variant === 'light' 
          ? '0 30px 60px rgba(16, 43, 53, 0.1)' 
          : '0 40px 100px rgba(0, 0, 0, 0.5)',
        padding: '60px 40px',
        color: variant === 'light' ? adColors.ink : '#fff',
        width: '100%',
        maxWidth: 900,
      }}
    >
      {children}
    </div>
  );
};

export const SocialProofAd: React.FC<{
  data: SocialProofData;
}> = ({data}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const sceneDuration = 120; // 4 seconds per scene
  
  const countProgress = interpolate(frame, [0, sceneDuration - 20], [0, data.activeBusinesses], {
    extrapolateRight: 'clamp',
  });

  return (
    <AdShell>
      <AbsoluteFill style={{padding: 60, background: `radial-gradient(circle at 50% 50%, ${adColors.tealDeep} 0%, #08161c 100%)`}}>
        
        {/* Global Vignette */}
        <AbsoluteFill style={{
          boxShadow: 'inset 0 0 300px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
          zIndex: 10
        }} />

        {/* Scene 1: The Community Growth */}
        <Sequence from={0} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
              <AnimatedBlock scale>
                 <h2 style={{fontSize: 28, color: adColors.gold, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20}}>The Pilot Phase</h2>
                 <h1 style={{fontSize: 160, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.05em'}}>
                    {Math.floor(countProgress)}
                 </h1>
                 <p style={{fontSize: 42, color: '#fff', opacity: 0.8, letterSpacing: '-0.02em'}}>Successful Businesses Onboarded.</p>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 2: Regional Momentum */}
        <Sequence from={sceneDuration} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
              <div style={{width: '100%', maxWidth: 880}}>
                <AnimatedBlock from="left">
                   <h2 style={{fontSize: 48, color: '#fff', fontWeight: 800, marginBottom: 50, letterSpacing: '-0.03em'}}>Scaling Across Ghana.</h2>
                </AnimatedBlock>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30}}>
                   {data.topRegions.map((region, i) => (
                     <AnimatedBlock key={region} delay={i * 10} scale>
                        <div style={{
                          background: 'rgba(255,255,255,0.05)', 
                          border: `1px solid ${adColors.teal}`, 
                          padding: '40px 10px', 
                          borderRadius: 32,
                          backdropFilter: 'blur(10px)'
                        }}>
                           <p style={{color: adColors.gold, fontSize: 36, fontWeight: 900, margin: 0}}>{region}</p>
                        </div>
                     </AnimatedBlock>
                   ))}
                </div>
              </div>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 3: Transaction Volume */}
        <Sequence from={sceneDuration * 2} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
              <AnimatedBlock scale>
                <SectionChrome variant="dark">
                   <p style={{fontSize: 32, color: adColors.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 20}}>Movement Generated</p>
                   <h2 style={{fontSize: 110, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.04em'}}>{data.totalValueProcessed}</h2>
                   <p style={{fontSize: 32, opacity: 0.7, marginTop: 20}}>In operational volume processed through the pilot.</p>
                </SectionChrome>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 4: The Brand Promise */}
        <Sequence from={sceneDuration * 3} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
              <AnimatedBlock scale>
                 <h2 style={{fontSize: 72, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.04em'}}>Scaling Together.</h2>
                 <p style={{fontSize: 36, color: adColors.gold, marginTop: 24, fontWeight: 700}}>The future of African SME operations.</p>
                 <div style={{
                   marginTop: 60, 
                   background: '#fff', 
                   padding: '20px 50px', 
                   borderRadius: 24, 
                   color: adColors.ink, 
                   fontWeight: 900, 
                   fontSize: 42,
                 }}>
                    BisaPilot
                 </div>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

      </AbsoluteFill>
    </AdShell>
  );
};
