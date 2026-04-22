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
import type {BusinessWrappedData} from '../data/wrappedData';

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

export const BizPilotWrapped: React.FC<{
  data: BusinessWrappedData;
}> = ({data}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const sceneDuration = 120; // 4 seconds per scene
  
  const introStart = 0;
  const salesStart = introStart + sceneDuration;
  const productStart = salesStart + sceneDuration;
  const efficiencyStart = productStart + sceneDuration;
  const outroStart = efficiencyStart + sceneDuration;

  const fade = interpolate(frame % sceneDuration, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AdShell>
      <AbsoluteFill style={{padding: 60, background: `radial-gradient(circle at 50% 50%, ${adColors.tealDeep} 0%, #08161c 100%)`}}>
        
        {/* Global Vignette */}
        <AbsoluteFill style={{
          boxShadow: 'inset 0 0 300px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
          zIndex: 10
        }} />

        {/* Scene 1: The Opener */}
        <Sequence from={introStart} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
              <AnimatedBlock scale>
                 <h1 style={{fontSize: 96, fontWeight: 900, color: adColors.gold, margin: 0}}>{data.monthName}</h1>
                 <h2 style={{fontSize: 42, color: '#fff', opacity: 0.8, letterSpacing: '0.1em'}}>WRAPPED</h2>
                 <div style={{height: 4, width: 100, background: adColors.teal, margin: '40px auto'}} />
                 <p style={{fontSize: 32, color: '#fff'}}>{data.businessName}</p>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 2: Sales Success */}
        <Sequence from={salesStart} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
              <AnimatedBlock from="bottom">
                <SectionChrome variant="dark">
                   <p style={{fontSize: 28, color: adColors.gold, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 20px'}}>Sales Success</p>
                   <h2 style={{fontSize: 100, fontWeight: 900, margin: 0, letterSpacing: '-0.04em'}}>
                      GHS {data.totalSalesValue.toLocaleString()}
                   </h2>
                   <p style={{fontSize: 32, opacity: 0.8, marginTop: 20}}>
                      Processed across <strong>{data.totalOrders}</strong> successful orders.
                   </p>
                </SectionChrome>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 3: Top Product */}
        <Sequence from={productStart} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
              <AnimatedBlock scale>
                <SectionChrome>
                   <p style={{fontSize: 28, color: adColors.teal, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 20px'}}>Stock Leader</p>
                   <h2 style={{fontSize: 84, fontWeight: 900, margin: 0, letterSpacing: '-0.04em', lineHeight: 1.1, color: adColors.ink}}>
                      {data.topProduct.name}
                   </h2>
                   <p style={{fontSize: 36, color: adColors.inkSoft, marginTop: 30}}>
                      You moved <strong>{data.topProduct.quantitySold}</strong> units this month!
                   </p>
                </SectionChrome>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 4: Efficiency */}
        <Sequence from={efficiencyStart} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
              <AnimatedBlock from="left">
                <SectionChrome variant="dark">
                   <p style={{fontSize: 28, color: adColors.gold, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 20px'}}>Operational Clarity</p>
                   <h2 style={{fontSize: 100, fontWeight: 900, margin: 0, color: '#fff'}}>
                      {data.efficiencyScore}%
                   </h2>
                   <p style={{fontSize: 32, opacity: 0.8, marginTop: 20}}>
                      Efficiency score. You saved approximately <strong>{data.savedHours} hours</strong> from manual work.
                   </p>
                </SectionChrome>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 5: Outro */}
        <Sequence from={outroStart} durationInFrames={sceneDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
              <AnimatedBlock scale>
                 <h2 style={{fontSize: 72, fontWeight: 900, color: '#fff', margin: 0}}>Keep Piloting.</h2>
                 <p style={{fontSize: 32, color: adColors.gold, marginTop: 20, fontWeight: 700}}>Your Scaling Partner</p>
                 <div style={{marginTop: 60, background: '#fff', padding: '20px 40px', borderRadius: 20, color: adColors.ink, fontWeight: 900, fontSize: 32}}>
                    BisaPilot
                 </div>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

      </AbsoluteFill>
    </AdShell>
  );
};
