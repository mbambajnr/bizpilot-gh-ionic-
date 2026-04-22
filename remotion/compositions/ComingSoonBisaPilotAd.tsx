import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {AdShell, adColors} from '../components/AdShell';
import {AnimatedBlock} from '../components/AnimatedBlock';
import type {AdFormat, BisaPilotAdContent} from '../data/bisaPilotAds';

const formatPadding: Record<AdFormat, number> = {
  vertical: 72,
  square: 64,
  landscape: 68,
};

const BrandFilter: React.FC<React.PropsWithChildren> = ({children}) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      filter: 'contrast(1.05) saturate(1.1) brightness(0.95)',
    }}>
      {children}
      <AbsoluteFill style={{
        background: 'rgba(30, 106, 127, 0.1)', // Subtle teal tint
        mixBlendMode: 'overlay',
      }} />
    </div>
  );
};

const SectionChrome: React.FC<React.PropsWithChildren<{format: AdFormat; variant?: 'dark' | 'light'}>> = ({
  children,
  format,
  variant = 'light',
}) => {
  const isVertical = format === 'vertical';

  return (
    <div
      style={{
        borderRadius: isVertical ? 36 : 32,
        border: `1px solid ${variant === 'light' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
        background: variant === 'light' 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.8))' 
          : `linear-gradient(135deg, ${adColors.tealDeep}ee, #08161cdd)`,
        backdropFilter: 'blur(18px)',
        boxShadow: variant === 'light' 
          ? '0 20px 50px rgba(16, 43, 53, 0.08)' 
          : '0 30px 60px rgba(0, 0, 0, 0.3)',
        padding: isVertical ? '48px 42px' : '40px 38px',
        color: variant === 'light' ? adColors.ink : '#fff',
      }}
    >
      {children}
    </div>
  );
};

export const ComingSoonBisaPilotAd: React.FC<{
  content: BisaPilotAdContent;
  format: AdFormat;
}> = ({content, format}) => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  
  const introStart = 0;
  const teaserStart = introStart + content.sceneTiming.intro;
  const promiseStart = teaserStart + content.sceneTiming.showcase;
  const missionStart = promiseStart + content.sceneTiming.proposition;
  const outroStart = missionStart + content.sceneTiming.features;

  const isLandscape = format === 'landscape';
  const isVertical = format === 'vertical';

  // Global Animations
  const fade = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Parallax / Zoom logic
  const zoom = interpolate(frame, [0, 600], [1, 1.15]);

  return (
    <AdShell>
      <AbsoluteFill
        style={{
          opacity: fade,
          padding: formatPadding[format],
          background: `radial-gradient(circle at 50% 40%, ${adColors.tealDeep} 0%, #08161c 100%)`,
        }}
      >
        {content.audioSrc ? (
          <Audio
            src={staticFile(content.audioSrc.replace(/^\//, ''))}
            volume={content.audioVolume ?? 0.3}
          />
        ) : null}

        {/* Brand Vignette - Blends everything into the focus area */}
        <AbsoluteFill style={{
          boxShadow: 'inset 0 0 200px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
          zIndex: 10
        }} />

        {/* Global atmospheric stardust/grain */}
        <AbsoluteFill style={{opacity: 0.04, pointerEvents: 'none', background: 'url(https://www.transparenttextures.com/patterns/stardust.png)', zIndex: 11}} />

        {/* Scene 1: The Brand Reveal */}
        <Sequence from={introStart} durationInFrames={content.sceneTiming.intro}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
             <div style={{textAlign: 'center', display: 'grid', gap: 40, placeItems: 'center', maxWidth: 900}}>
                <AnimatedBlock delay={5}>
                   <Img src={content.logoSrc} style={{height: isVertical ? 160 : 200, filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.4))'}} />
                </AnimatedBlock>
                
                <AnimatedBlock delay={15}>
                  <div style={{
                    background: 'linear-gradient(90deg, rgba(214, 130, 69, 0.15), rgba(214, 130, 69, 0.25))', 
                    padding: '14px 40px', 
                    borderRadius: 99, 
                    border: `1px solid ${adColors.gold}88`,
                    color: adColors.gold,
                    fontSize: 26,
                    fontWeight: 900,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                  }}>
                     COMING SOON
                  </div>
                </AnimatedBlock>

                <AnimatedBlock delay={25}>
                  <h1 style={{
                    fontSize: isVertical ? 72 : 96, 
                    margin: 0, 
                    letterSpacing: '-0.05em', 
                    color: '#fff', 
                    lineHeight: 0.9,
                    fontWeight: 800,
                    textShadow: '0 10px 30px rgba(0,0,0,0.3)'
                  }}>
                     {content.heroEyebrow}
                  </h1>
                </AnimatedBlock>
             </div>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 2: The Sneak Peek (Teaser) */}
        <Sequence from={teaserStart} durationInFrames={content.sceneTiming.showcase}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
              <AnimatedBlock from="bottom" style={{position: 'relative', width: '100%', height: '85%', borderRadius: 48, overflow: 'hidden', border: `1px solid rgba(255,255,255,0.1)`, boxShadow: '0 40px 100px rgba(0,0,0,0.5)'}}>
                 <BrandFilter>
                   <Img 
                      src={content.screenshots[0].src} 
                      style={{
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover', 
                        filter: 'blur(12px) brightness(0.6)',
                        transform: `scale(${zoom})`
                      }} 
                   />
                 </BrandFilter>
                 <AbsoluteFill style={{background: `linear-gradient(to bottom, transparent 30%, ${adColors.tealDeep}cc)`}} />
                 <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 60}}>
                    <h2 style={{fontSize: 64, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1}}>
                      A New Operating Flow.<br />
                      <span style={{color: adColors.gold}}>Landing Soon.</span>
                    </h2>
                 </div>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 3: The Promise */}
        <Sequence from={promiseStart} durationInFrames={content.sceneTiming.proposition}>
           <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <AnimatedBlock scale delay={5}>
                <SectionChrome format={format} variant="dark">
                   <h2 style={{fontSize: 72, margin: '0 0 24px', fontWeight: 900, letterSpacing: '-0.04em', color: adColors.gold}}>{content.headline}</h2>
                   <p style={{fontSize: 36, opacity: 0.9, lineHeight: 1.4, fontWeight: 500}}>
                     One unified workspace to command your <br />
                     <span style={{color: '#fff', fontWeight: 700}}>sales, stock, and customers.</span>
                   </p>
                </SectionChrome>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 4: The Impact */}
        <Sequence from={missionStart} durationInFrames={content.sceneTiming.features}>
           <AbsoluteFill style={{display: 'grid', gridTemplateColumns: isLandscape ? '1fr 1fr' : '1fr', gap: 40, alignItems: 'center'}}>
              {content.characterAssets?.resolved && (
                <AnimatedBlock from="left" style={{height: '92%', borderRadius: 44, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)'}}>
                  <BrandFilter>
                    <Img 
                      src={content.characterAssets.resolved} 
                      style={{
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        transform: `scale(${zoom})`
                      }} 
                    />
                  </BrandFilter>
                </AnimatedBlock>
              )}
              <div style={{display: 'flex', flexDirection: 'column', gap: 40}}>
                 <AnimatedBlock delay={10}>
                   <SectionChrome format={format}>
                      <h3 style={{fontSize: 54, fontWeight: 800, margin: '0 0 16px', color: adColors.teal, letterSpacing: '-0.02em'}}>Stop guessing. <br />Start piloting.</h3>
                      <p style={{fontSize: 28, color: adColors.inkSoft, lineHeight: 1.5}}>Built for the modern African SME owner who wants <strong style={{color: adColors.ink}}>clarity, not chaos.</strong></p>
                   </SectionChrome>
                 </AnimatedBlock>
              </div>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 5: Outro */}
        <Sequence from={outroStart} durationInFrames={content.sceneTiming.outro}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
             <div style={{textAlign: 'center', display: 'grid', gap: 48, placeItems: 'center', maxWidth: 900}}>
                <AnimatedBlock scale>
                   <Img src={content.logoSrc} style={{height: 140, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.2))'}} />
                </AnimatedBlock>
                
                <AnimatedBlock delay={10}>
                  <h2 style={{fontSize: 88, fontWeight: 900, margin: 0, letterSpacing: '-0.05em', color: '#fff'}}>{content.ctaHeadline}</h2>
                </AnimatedBlock>

                <AnimatedBlock delay={20}>
                  <p style={{fontSize: 36, color: adColors.inkSoft, maxWidth: 700, margin: '0 auto'}}>{content.ctaBody}</p>
                </AnimatedBlock>

                <AnimatedBlock delay={35}>
                  <div style={{
                    background: `linear-gradient(135deg, ${adColors.gold}, #e5a06d)`, 
                    color: '#fff', 
                    padding: '28px 85px', 
                    borderRadius: 99, 
                    fontSize: 38, 
                    fontWeight: 900,
                    boxShadow: `0 25px 60px ${adColors.gold}44`,
                  }}>
                    {content.ctaLabel}
                  </div>
                </AnimatedBlock>

                <AnimatedBlock delay={50} style={{display: 'flex', alignItems: 'center', gap: 15}}>
                  <div style={{height: 1, width: 40, background: adColors.teal, opacity: 0.5}} />
                  <p style={{fontSize: 22, color: adColors.teal, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', margin: 0}}>
                     YOUR SCALING PARTNER
                  </p>
                  <div style={{height: 1, width: 40, background: adColors.teal, opacity: 0.5}} />
                </AnimatedBlock>
             </div>
           </AbsoluteFill>
        </Sequence>

      </AbsoluteFill>
    </AdShell>
  );
};


