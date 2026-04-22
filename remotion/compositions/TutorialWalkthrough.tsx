import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {AdShell, adColors} from '../components/AdShell';
import {AnimatedBlock} from '../components/AnimatedBlock';
import type {TutorialData} from '../data/tutorialData';

export const TutorialWalkthrough: React.FC<{
  data: TutorialData;
}> = ({data}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const stepDuration = 150; // 5 seconds per step
  
  return (
    <AdShell>
      <AbsoluteFill style={{background: '#08161c', padding: 60}}>
        
        {/* Header Bar */}
        <div style={{
          position: 'absolute',
          top: 60,
          left: 60,
          right: 60,
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
        }}>
           <h2 style={{color: adColors.gold, margin: 0, fontSize: 32, fontWeight: 900}}>{data.tutorialTitle}</h2>
           <div style={{color: '#fff', opacity: 0.6, fontSize: 24, fontWeight: 700}}>BisaPilot Academy</div>
        </div>

        {data.steps.map((step, index) => {
          const start = index * stepDuration;
          const progress = interpolate(frame - start, [0, stepDuration], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

          return (
            <Sequence key={index} from={start} durationInFrames={stepDuration}>
               <AbsoluteFill style={{display: 'flex', flexDirection: 'column', gap: 40, paddingTop: 120}}>
                  
                  {/* The Device Mockup */}
                  <div style={{
                    flex: 1, 
                    position: 'relative', 
                    borderRadius: 40, 
                    overflow: 'hidden', 
                    border: '8px solid #163641',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.5)'
                  }}>
                     <Img src={step.screenshotSrc} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                     
                     {/* Highlight Overlay */}
                     {step.highlightArea && (
                       <div style={{
                         position: 'absolute',
                         top: step.highlightArea.top,
                         left: step.highlightArea.left,
                         width: step.highlightArea.width,
                         height: step.highlightArea.height,
                         border: `4px solid ${adColors.gold}`,
                         borderRadius: 12,
                         boxShadow: `0 0 0 1000px rgba(0,0,0,0.6)`,
                         zIndex: 20
                       }} />
                     )}
                  </div>

                  {/* Instruction Card */}
                  <AnimatedBlock from="bottom" style={{zIndex: 50}}>
                    <div style={{
                      background: 'rgba(255,255,255,0.95)',
                      padding: 40,
                      borderRadius: 32,
                      boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                      color: adColors.ink,
                      position: 'relative',
                    }}>
                       <h3 style={{fontSize: 42, margin: '0 0 10px', fontWeight: 900, color: adColors.teal}}>{index + 1}. {step.title}</h3>
                       <p style={{fontSize: 28, margin: 0, opacity: 0.8, lineHeight: 1.3}}>{step.description}</p>
                       
                       {/* Progress Bar */}
                       <div style={{
                         position: 'absolute',
                         bottom: 0,
                         left: 0,
                         height: 8,
                         width: `${progress}%`,
                         background: adColors.gold,
                         borderRadius: '0 0 0 32px',
                       }} />
                    </div>
                  </AnimatedBlock>
               </AbsoluteFill>
            </Sequence>
          );
        })}

      </AbsoluteFill>
    </AdShell>
  );
};
