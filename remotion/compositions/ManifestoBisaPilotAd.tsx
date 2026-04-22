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

const ManifestoChrome: React.FC<React.PropsWithChildren<{format: AdFormat}>> = ({children, format}) => {
  const isVertical = format === 'vertical';

  return (
    <div
      style={{
        padding: isVertical ? '0 40px' : '0 60px',
        maxWidth: 1000,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
};

const HUDLayer: React.FC<{opacity: number}> = ({opacity}) => {
  return (
    <AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
       <div style={{
         position: 'absolute',
         top: 40,
         left: 40,
         width: 100,
         height: 1,
         background: adColors.gold,
         opacity: 0.4
       }} />
       <div style={{
         position: 'absolute',
         top: 40,
         left: 40,
         width: 1,
         height: 100,
         background: adColors.gold,
         opacity: 0.4
       }} />
       <div style={{
         position: 'absolute',
         bottom: 40,
         right: 40,
         width: 100,
         height: 1,
         background: adColors.teal,
         opacity: 0.4
       }} />
       <div style={{
         position: 'absolute',
         bottom: 40,
         right: 40,
         width: 1,
         height: 100,
         background: adColors.teal,
         opacity: 0.4
       }} />
    </AbsoluteFill>
  );
};

export const ManifestoBisaPilotAd: React.FC<{
  content: BisaPilotAdContent;
  format: AdFormat;
}> = ({content, format}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  const introDuration = content.sceneTiming.intro;
  const propDuration = content.sceneTiming.proposition;
  const showcaseDuration = content.sceneTiming.showcase;
  const featuresDuration = content.sceneTiming.features;
  
  const introStart = 0;
  const propositionStart = introStart + introDuration;
  const showcaseStart = propositionStart + propDuration;
  const featuresStart = showcaseStart + showcaseDuration;
  const outroStart = featuresStart + featuresDuration;

  const isVertical = format === 'vertical';

  const globalFade = interpolate(frame, [0, 15], [0, 1]);

  return (
    <AdShell>
      <AbsoluteFill style={{opacity: globalFade, background: '#0a1a20'}}>
        {content.audioSrc && (
          <Audio src={staticFile(content.audioSrc.replace(/^\//, ''))} volume={content.audioVolume ?? 0.3} />
        )}

        <HUDLayer opacity={0.3} />

        {/* Scene 1: The Pulse */}
        <Sequence from={introStart} durationInFrames={introDuration}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
              <AnimatedBlock style={{textAlign: 'center', display: 'grid', gap: 24, placeItems: 'center'}}>
                 <Img src={content.logoSrc} style={{height: 160, filter: 'drop-shadow(0 0 30px rgba(30, 106, 127, 0.4))'}} />
                 <h1 style={{fontSize: 32, letterSpacing: '0.4em', color: adColors.gold, fontWeight: 300, textTransform: 'uppercase'}}>
                   {content.brandName}
                 </h1>
                 <p style={{fontSize: 24, letterSpacing: '0.1em', opacity: 0.6, color: '#fff'}}>
                   {content.heroEyebrow}
                 </p>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 2: The Vision */}
        <Sequence from={propositionStart} durationInFrames={propDuration}>
           <AbsoluteFill>
              {content.characterAssets?.resolved && (
                <Img 
                  src={content.characterAssets.resolved} 
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.4,
                    filter: 'grayscale(1) contrast(1.2)',
                    transform: `scale(${interpolate(frame, [propositionStart, propositionStart + propDuration], [1, 1.1])})`
                  }}
                />
              )}
              <AbsoluteFill style={{background: 'linear-gradient(45deg, rgba(16, 43, 53, 0.9), transparent)'}} />
              <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
                 <ManifestoChrome format={format}>
                    <AnimatedBlock delay={10}>
                       <h2 style={{fontSize: isVertical ? 82 : 96, color: '#fff', lineHeight: 0.9, letterSpacing: '-0.05em', marginBottom: 24}}>
                         {content.headline}
                       </h2>
                       <p style={{fontSize: 32, color: adColors.gold, fontWeight: 500, letterSpacing: '0.02em'}}>
                         {content.supportingText}
                       </p>
                    </AnimatedBlock>
                 </ManifestoChrome>
              </AbsoluteFill>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 3: The Flow (Showcase) */}
        <Sequence from={showcaseStart} durationInFrames={showcaseDuration}>
           <AbsoluteFill style={{display: 'grid', gridTemplateColumns: isVertical ? '1fr' : 'repeat(3, 1fr)', gap: 0}}>
              {content.screenshots.map((shot, i) => (
                <div key={shot.title} style={{position: 'relative', overflow: 'hidden', borderRight: isVertical ? 'none' : '1px solid rgba(255,255,255,0.05)'}}>
                   <Img 
                     src={shot.src} 
                     style={{
                       width: '100%', 
                       height: '100%', 
                       objectFit: 'cover',
                       opacity: 0.6,
                       filter: 'sepia(0.2) contrast(1.1)',
                       transform: `translateY(${interpolate(frame, [showcaseStart, showcaseStart + showcaseDuration], [0, -40 * (i+1)])}px)`
                     }} 
                   />
                   <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(16,43,53,0.9), transparent)', padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'}}>
                      <AnimatedBlock delay={i * 10}>
                         <strong style={{color: adColors.gold, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.2em'}}>{shot.label}</strong>
                         <h3 style={{color: '#fff', fontSize: 32, margin: '10px 0'}}>{shot.title}</h3>
                      </AnimatedBlock>
                   </AbsoluteFill>
                </div>
              ))}
           </AbsoluteFill>
        </Sequence>

        {/* Scene 4: The Scale */}
        <Sequence from={featuresStart} durationInFrames={featuresDuration}>
           <AbsoluteFill style={{background: adColors.tealDeep}}>
              <div style={{display: 'grid', gridTemplateColumns: isVertical ? '1fr' : '1fr 1fr', height: '100%'}}>
                 <div style={{position: 'relative', overflow: 'hidden'}}>
                    <Img src={content.characterAssets?.employee ?? ''} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6}} />
                    <AbsoluteFill style={{background: 'linear-gradient(to right, #143746, transparent)', padding: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                       <AnimatedBlock delay={5}>
                          <h4 style={{color: adColors.gold, fontSize: 48, margin: 0}}>{content.features[3].title}</h4>
                          <p style={{color: '#fff', fontSize: 24, opacity: 0.8}}>{content.features[3].body}</p>
                       </AnimatedBlock>
                    </AbsoluteFill>
                 </div>
                 <div style={{position: 'relative', overflow: 'hidden'}}>
                    <Img src={content.characterAssets?.client ?? ''} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4}} />
                    <AbsoluteFill style={{background: 'linear-gradient(to left, #143746, transparent)', padding: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'right'}}>
                       <AnimatedBlock delay={15}>
                          <h4 style={{color: adColors.gold, fontSize: 48, margin: 0}}>{content.features[0].title}</h4>
                          <p style={{color: '#fff', fontSize: 24, opacity: 0.8}}>{content.features[0].body}</p>
                       </AnimatedBlock>
                    </AbsoluteFill>
                 </div>
              </div>
           </AbsoluteFill>
        </Sequence>

        {/* Scene 5: Outro */}
        <Sequence from={outroStart} durationInFrames={content.sceneTiming.outro}>
           <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
              <AnimatedBlock style={{textAlign: 'center', maxWidth: 800}}>
                 <Img src={content.logoSrc} style={{height: 180, marginBottom: 40, filter: 'drop-shadow(0 0 50px rgba(30,106,127,0.5))'}} />
                 <h2 style={{fontSize: 82, color: '#fff', letterSpacing: '-0.04em', margin: '0 0 20px'}}>{content.ctaHeadline}</h2>
                 <p style={{fontSize: 28, color: adColors.gold, letterSpacing: '0.05em', marginBottom: 44}}>{content.ctaBody}</p>
                 <div style={{
                   border: `2px solid ${adColors.gold}`,
                   color: adColors.gold,
                   padding: '20px 50px',
                   borderRadius: 4,
                   fontSize: 24,
                   fontWeight: 800,
                   textTransform: 'uppercase',
                   letterSpacing: '0.3em'
                 }}>
                   {content.ctaLabel}
                 </div>
              </AnimatedBlock>
           </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>
    </AdShell>
  );
};
