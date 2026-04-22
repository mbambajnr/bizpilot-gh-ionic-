import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {adColors} from '../components/AdShell';
import {AnimatedBlock} from '../components/AnimatedBlock';
import type {BisaPilotAdContent} from '../data/bisaPilotAds';

const GlossyOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame % 150, [0, 75, 150], [0.1, 0.3, 0.1]);
  const sweep = interpolate(frame % 150, [0, 150], [-100, 200]);
  
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
       <div style={{
         position: 'absolute',
         top: 0,
         left: `${sweep}%`,
         width: '50%',
         height: '100%',
         background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
         transform: 'skewX(-20deg)',
         opacity,
       }} />
    </AbsoluteFill>
  );
};

const LuxurySurface: React.FC<React.PropsWithChildren<{style?: React.CSSProperties}>> = ({children, style}) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame % 120, [0, 60, 120], [0.4, 0.8, 0.4]);
  
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(22, 54, 65, 0.5), rgba(8, 22, 28, 0.9))',
      borderRadius: 40,
      padding: '70px 60px',
      border: `1px solid rgba(214, 130, 69, ${glow})`,
      backdropFilter: 'blur(40px)',
      boxShadow: `0 50px 120px rgba(0,0,0,0.8), 0 0 40px rgba(214, 130, 69, ${glow * 0.2})`,
      ...style
    }}>
      {children}
    </div>
  );
};

export const ModernClarityAd: React.FC<{
  content: BisaPilotAdContent;
}> = ({content}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const sceneDuration = 180; // Extended to 6 seconds per scene
  const isVertical = height > width;

  // Cinematic Zoom across entire duration
  const camZoom = interpolate(frame, [0, 800], [1, 1.15], {extrapolateRight: 'clamp'});
  const camRotate = interpolate(frame, [0, 600], [-1, 1]);

  return (
    <AbsoluteFill style={{background: '#020708', padding: 80, fontFamily: 'Inter, sans-serif', color: '#fff', overflow: 'hidden'}}>
      
      {/* 3D Atmosphere Layer */}
      <AbsoluteFill style={{
          transform: `scale(${camZoom * 1.05}) rotate(${camRotate * 0.5}deg)`,
          opacity: 0.15,
          background: 'radial-gradient(circle at 70% 30%, #dfac3c 0%, transparent 60%)',
          filter: 'blur(100px)'
      }} />

      <GlossyOverlay />

      {/* Scene 1: Flash Reveal */}
      <Sequence from={0} durationInFrames={sceneDuration}>
        <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
           <div style={{transform: `scale(${camZoom})`, display: 'grid', gap: 48, placeItems: 'center', textAlign: 'center'}}>
              <AnimatedBlock scale>
                 <Img 
                    src={content.logoSrc} 
                    style={{
                      height: isVertical ? 200 : 250, 
                      filter: `drop-shadow(0 0 ${interpolate(frame, [0, 60], [0, 50])}px rgba(214, 130, 69, 0.8))`
                    }} 
                 />
              </AnimatedBlock>
              
              <div style={{
                height: 1, 
                width: interpolate(frame, [30, 90], [0, 300], {extrapolateLeft: 'clamp'}), 
                background: `linear-gradient(to right, transparent, ${adColors.gold}, transparent)`
              }} />

              <AnimatedBlock delay={40} from="bottom">
                <h1 style={{
                   fontSize: isVertical ? 72 : 100, 
                   fontWeight: 900, 
                   margin: 0, 
                   letterSpacing: '0.15em',
                   textTransform: 'uppercase',
                   background: 'linear-gradient(to bottom, #fff, #dfac3c)',
                   WebkitBackgroundClip: 'text',
                   WebkitTextFillColor: 'transparent',
                   filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))'
                 }}>
                   {content.brandName}
                 </h1>
              </AnimatedBlock>
           </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: 3D Depth Character Reveal */}
      <Sequence from={sceneDuration} durationInFrames={sceneDuration}>
        <AbsoluteFill style={{display: 'grid', gridTemplateColumns: isVertical ? '1fr' : '1.1fr 1fr', gap: 60, alignItems: 'center'}}>
           {content.characterAssets?.employee && (
             <div style={{
               position: 'relative',
               height: '100%', 
               borderRadius: 48, 
               overflow: 'hidden', 
               boxShadow: '0 60px 120px rgba(0,0,0,0.7)',
               transform: `scale(${camZoom * 0.95}) rotate(${camRotate * -0.2}deg)`
             }}>
                <Img src={content.characterAssets.employee} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                <AbsoluteFill style={{
                  background: `linear-gradient(to top, #020708, transparent)`,
                  opacity: 0.8
                }} />
                {/* Internal Light Streak */}
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '10%',
                  width: '2px',
                  height: '200%',
                  background: adColors.gold,
                  opacity: 0.3,
                  transform: 'rotate(25deg)',
                  boxShadow: `0 0 30px ${adColors.gold}`
                }} />
             </div>
           )}
           <AnimatedBlock from="right">
              <LuxurySurface>
                 <h2 style={{fontSize: 68, fontWeight: 900, color: adColors.gold, margin: '0 0 24px', letterSpacing: '-0.04em'}}>Built to Scale.</h2>
                 <p style={{fontSize: 34, color: '#fff', opacity: 0.9, lineHeight: 1.4, fontWeight: 500}}>
                   Finally, the structure your passion deserves.
                 </p>
              </LuxurySurface>
           </AnimatedBlock>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Hyper-Focused Product */}
      <Sequence from={sceneDuration * 2} durationInFrames={sceneDuration}>
        <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
            <div style={{
              width: '95%', 
              height: '90%', 
              position: 'relative', 
              borderRadius: 56, 
              overflow: 'hidden', 
              border: '1px solid rgba(214, 130, 69, 0.3)',
              transform: `scale(${camZoom * 1.05})`,
              boxShadow: '0 80px 160px rgba(0,0,0,0.9)'
            }}>
               <Img 
                  src={content.screenshots[0].src} 
                  style={{
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    filter: 'brightness(0.2) saturate(0)'
                  }} 
               />
               <AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
                  <AnimatedBlock scale>
                    <div style={{background: 'rgba(2, 7, 8, 0.85)', padding: '60px 80px', borderRadius: 40, backdropFilter: 'blur(25px)', border: `1px solid ${adColors.gold}55`}}>
                       <h3 style={{fontSize: 72, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.04em'}}>Command Center</h3>
                       <div style={{height: 4, width: 80, background: adColors.gold, margin: '30px auto'}} />
                       <p style={{fontSize: 28, color: adColors.gold, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4em'}}>Unified Operations</p>
                    </div>
                  </AnimatedBlock>
               </AbsoluteFill>
            </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: The Final Word */}
      <Sequence from={sceneDuration * 3} durationInFrames={sceneDuration}>
         <AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
            <div style={{transform: `scale(${camZoom * 0.9})`, display: 'grid', gap: 40, placeItems: 'center'}}>
               <AnimatedBlock scale>
                  <Img src={content.logoSrc} style={{height: 180, filter: 'drop-shadow(0 20px 50px rgba(223, 172, 60, 0.4))'}} />
               </AnimatedBlock>
               
               <AnimatedBlock delay={20}>
                 <h2 style={{
                   fontSize: 84, 
                   fontWeight: 900, 
                   color: '#fff', 
                   margin: 0, 
                   letterSpacing: '-0.05em',
                   textShadow: '0 15px 30px rgba(0,0,0,0.5)'
                 }}>
                   Your Scaling Partner.
                 </h2>
               </AnimatedBlock>
               
               <div style={{height: 1, width: 300, background: `linear-gradient(to right, transparent, ${adColors.gold}, transparent)`, marginTop: 20}} />
               
               <AnimatedBlock scale delay={40}>
                 <div style={{
                   background: `linear-gradient(135deg, #dfac3c, #f3d082)`, 
                   padding: '30px 100px', 
                   borderRadius: 24, 
                   color: '#000', 
                   fontWeight: 900, 
                   fontSize: 44,
                   boxShadow: `0 40px 80px ${adColors.gold}55`,
                   letterSpacing: '-0.02em',
                   marginTop: 40
                 }}>
                   BisaPilot
                 </div>
               </AnimatedBlock>
            </div>
         </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
