import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {AdShell, adColors} from '../components/AdShell';
import {AnimatedBlock} from '../components/AnimatedBlock';
import {ScreenshotCard} from '../components/ScreenshotCard';
import type {AdFormat, BisaPilotAdContent} from '../data/bisaPilotAds';

const formatPadding: Record<AdFormat, number> = {
  vertical: 72,
  square: 64,
  landscape: 68,
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
        borderRadius: isVertical ? 34 : 30,
        border: `1px solid ${variant === 'light' ? adColors.line : 'rgba(255,255,255,0.1)'}`,
        background: variant === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(16, 43, 53, 0.85)',
        backdropFilter: 'blur(12px)',
        boxShadow: variant === 'light' 
          ? '0 22px 50px rgba(15, 23, 42, 0.08)' 
          : '0 22px 60px rgba(0, 0, 0, 0.25)',
        padding: isVertical ? '42px 38px' : '36px 34px',
        color: variant === 'light' ? adColors.ink : '#fff',
      }}
    >
      {children}
    </div>
  );
};

export const PremiumBisaPilotAd: React.FC<{
  content: BisaPilotAdContent;
  format: AdFormat;
}> = ({content, format}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  const introStart = 0;
  const propositionStart = introStart + content.sceneTiming.intro;
  const showcaseStart = propositionStart + content.sceneTiming.proposition;
  const featuresStart = showcaseStart + content.sceneTiming.showcase;
  const outroStart = featuresStart + content.sceneTiming.features;

  const isLandscape = format === 'landscape';
  const isVertical = format === 'vertical';

  // Global Animations
  const fade = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AdShell>
      <AbsoluteFill
        style={{
          opacity: fade,
          padding: formatPadding[format],
        }}
      >
        {content.audioSrc ? (
          <Audio
            src={staticFile(content.audioSrc.replace(/^\//, ''))}
            volume={content.audioVolume ?? 0.3}
          />
        ) : null}

        {/* Scene 1: The Problem (Intro) */}
        <Sequence from={introStart} durationInFrames={content.sceneTiming.intro}>
          <AbsoluteFill 
            style={{
              display: 'grid', 
              gridTemplateColumns: isLandscape ? '1fr 1fr' : '1fr',
              gridTemplateRows: isLandscape ? '1fr' : '0.45fr 0.55fr',
              gap: isLandscape ? 40 : 24
            }}
          >
            <AnimatedBlock 
              style={{
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                gap: 24,
                paddingBottom: isVertical ? 0 : 40
              }}
            >
              <SectionChrome format={format} variant="dark">
                <p style={{margin: 0, color: adColors.gold, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 800, fontSize: 18}}>
                  {content.heroEyebrow}
                </p>
                <h1 style={{fontSize: isVertical ? 68 : 72, margin: '16px 0', lineHeight: 1, letterSpacing: '-0.04em'}}>
                  Drowning in <br /> 
                  <span style={{color: adColors.gold}}>Chaos?</span>
                </h1>
                <p style={{fontSize: isVertical ? 24 : 28, opacity: 0.8, lineHeight: 1.5}}>
                  Manual tracking is killing your growth. Stop guessing, start piloting.
                </p>
              </SectionChrome>
            </AnimatedBlock>
            {content.characterAssets?.stressed && (
              <AnimatedBlock from={isLandscape ? "right" : "bottom"} delay={10} style={{position: 'relative', overflow: 'hidden', borderRadius: 34}}>
                <Img 
                  src={content.characterAssets.stressed} 
                  style={{
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    objectPosition: 'center 20%',
                    transform: 'scale(1.04)', // Hides the corner watermark
                    filter: 'grayscale(0.4) contrast(1.1)',
                  }} 
                />
                <div style={{
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  right: 0, 
                  padding: 30, 
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                  borderRadius: '0 0 34px 34px'
                }}>
                  <p style={{color: '#fff', fontSize: 24, fontWeight: 600}}>Manual tracking is a trap.</p>
                </div>
              </AnimatedBlock>
            )}
          </AbsoluteFill>
        </Sequence>

        {/* Scene 2: The Resolution (Proposition) */}
        <Sequence from={propositionStart} durationInFrames={content.sceneTiming.proposition}>
          <AbsoluteFill 
            style={{
              display: 'grid', 
              gridTemplateColumns: isLandscape ? '1fr 1fr' : '1fr',
              gridTemplateRows: isLandscape ? '1fr' : '0.55fr 0.45fr',
              gap: isLandscape ? 40 : 24
            }}
          >
            {content.characterAssets?.resolved && (
              <AnimatedBlock from={isLandscape ? "left" : "top"} style={{position: 'relative', overflow: 'hidden', borderRadius: 34}}>
                <Img 
                  src={content.characterAssets.resolved} 
                  style={{
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    objectPosition: 'center 20%',
                    transform: 'scale(1.04)',
                  }} 
                />
                <div style={{
                  position: 'absolute', 
                  top: 30, 
                  left: 30, 
                  background: adColors.teal, 
                  color: '#fff', 
                  padding: '12px 24px', 
                  borderRadius: 999,
                  fontWeight: 800,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                }}>
                  THE BIZPILOT EFFECT
                </div>
              </AnimatedBlock>
            )}
            <AnimatedBlock delay={10} style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24}}>
              <SectionChrome format={format}>
                <Img src={content.logoSrc} style={{height: isVertical ? 48 : 64, width: 'fit-content', marginBottom: 20}} />
                <h2 style={{fontSize: isVertical ? 62 : 64, margin: '0 0 16px', color: adColors.teal, lineHeight: 1.1}}>
                  {content.headline}
                </h2>
                <p style={{fontSize: isVertical ? 26 : 30, color: adColors.inkSoft, lineHeight: 1.5}}>
                  {content.supportingText}
                </p>
              </SectionChrome>
            </AnimatedBlock>
          </AbsoluteFill>
        </Sequence>

        {/* Scene 3: The Engine (Showcase) */}
        <Sequence from={showcaseStart} durationInFrames={content.sceneTiming.showcase}>
          <AbsoluteFill style={{display: 'grid', gap: 30, alignContent: 'center'}}>
            <AnimatedBlock>
               <h2 style={{fontSize: 48, textAlign: 'center', color: adColors.ink, marginBottom: 20}}>
                 Powerful Operations. <span style={{color: adColors.teal}}>Simplified.</span>
               </h2>
            </AnimatedBlock>
            <div style={{display: 'grid', gridTemplateColumns: isLandscape ? 'repeat(3, 1fr)' : '1fr', gap: 24}}>
              {content.screenshots.map((shot, i) => (
                <AnimatedBlock key={shot.title} delay={i * 8}>
                  <ScreenshotCard 
                    src={shot.src}
                    title={shot.title}
                    label={shot.label}
                    caption={shot.caption}
                    compact
                  />
                </AnimatedBlock>
              ))}
            </div>
          </AbsoluteFill>
        </Sequence>

        {/* Scene 4: The Team & Clients (Features) */}
        <Sequence from={featuresStart} durationInFrames={content.sceneTiming.features}>
          <AbsoluteFill style={{display: 'grid', gridTemplateColumns: isLandscape ? '1fr 1fr' : '1fr', gap: 40, alignItems: 'center'}}>
            <div style={{display: 'grid', gap: 24}}>
              {content.characterAssets?.employee && (
                <AnimatedBlock from="left">
                   <div style={{display: 'flex', gap: 24, alignItems: 'center', background: '#fff', padding: 20, borderRadius: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', overflow: 'hidden'}}>
                      <Img src={content.characterAssets.employee} style={{width: 140, height: 140, borderRadius: 20, objectFit: 'cover', transform: 'scale(1.1)'}} />
                      <div>
                        <strong style={{fontSize: 24, display: 'block', color: adColors.teal}}>{content.features[3].title}</strong>
                        <p style={{margin: 0, fontSize: 18, color: adColors.inkSoft}}>{content.features[3].body}</p>
                      </div>
                   </div>
                </AnimatedBlock>
              )}
              {content.characterAssets?.client && (
                <AnimatedBlock from="left" delay={15}>
                   <div style={{display: 'flex', gap: 24, alignItems: 'center', background: '#fff', padding: 20, borderRadius: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', overflow: 'hidden'}}>
                      <Img src={content.characterAssets.client} style={{width: 140, height: 140, borderRadius: 20, objectFit: 'cover', transform: 'scale(1.1)'}} />
                      <div>
                        <strong style={{fontSize: 24, display: 'block', color: adColors.teal}}>{content.features[0].title}</strong>
                        <p style={{margin: 0, fontSize: 18, color: adColors.inkSoft}}>{content.features[0].body}</p>
                      </div>
                   </div>
                </AnimatedBlock>
              )}
            </div>
            <AnimatedBlock delay={20}>
              <SectionChrome format={format}>
                <h3 style={{fontSize: 48, margin: '0 0 20px'}}>{content.featureTitle}</h3>
                <div style={{display: 'grid', gap: 16}}>
                   {content.trustPoints.map(p => (
                     <div key={p} style={{display: 'flex', gap: 12, alignItems: 'center', fontSize: 22, fontWeight: 600}}>
                        <div style={{width: 12, height: 12, borderRadius: 99, background: adColors.gold}} />
                        {p}
                     </div>
                   ))}
                </div>
              </SectionChrome>
            </AnimatedBlock>
          </AbsoluteFill>
        </Sequence>

        {/* Scene 5: Outro */}
        <Sequence from={outroStart} durationInFrames={content.sceneTiming.outro}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
             <AnimatedBlock style={{textAlign: 'center', display: 'grid', gap: 32, placeItems: 'center', maxWidth: 800}}>
                <Img src={content.logoSrc} style={{height: 120}} />
                <h2 style={{fontSize: 72, margin: 0, letterSpacing: '-0.04em'}}>{content.ctaHeadline}</h2>
                <p style={{fontSize: 32, color: adColors.inkSoft}}>{content.ctaBody}</p>
                <div style={{
                  background: adColors.teal, 
                  color: '#fff', 
                  padding: '24px 60px', 
                  borderRadius: 99, 
                  fontSize: 32, 
                  fontWeight: 800,
                  boxShadow: '0 20px 40px rgba(30, 106, 127, 0.3)'
                }}>
                  {content.ctaLabel}
                </div>
                <p style={{fontSize: 18, color: adColors.gold, fontWeight: 700, letterSpacing: '0.1em'}}>
                   {content.ctaMicroLine}
                </p>
             </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>
    </AdShell>
  );
};
