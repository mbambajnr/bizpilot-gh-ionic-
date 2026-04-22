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

const SectionChrome: React.FC<React.PropsWithChildren<{format: AdFormat}>> = ({children, format}) => {
  const isVertical = format === 'vertical';

  return (
    <div
      style={{
        borderRadius: isVertical ? 34 : 30,
        border: `1px solid ${adColors.line}`,
        background: 'rgba(255,255,255,0.9)',
        boxShadow: '0 22px 50px rgba(15, 23, 42, 0.08)',
        padding: isVertical ? '38px 34px' : '34px 32px',
      }}
    >
      {children}
    </div>
  );
};

export const BisaPilotProductAd: React.FC<{
  content: BisaPilotAdContent;
  format: AdFormat;
}> = ({content, format}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const fade = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const globalLift = spring({
    fps,
    frame,
    config: {
      damping: 22,
      stiffness: 120,
      mass: 0.9,
    },
  });

  const introStart = 0;
  const propositionStart = introStart + content.sceneTiming.intro;
  const showcaseStart = propositionStart + content.sceneTiming.proposition;
  const featuresStart = showcaseStart + content.sceneTiming.showcase;
  const outroStart = featuresStart + content.sceneTiming.features;

  const isLandscape = format === 'landscape';
  const isVertical = format === 'vertical';
  const isSquare = format === 'square';

  return (
    <AdShell>
      <AbsoluteFill
        style={{
          opacity: fade,
          padding: formatPadding[format],
          transform: `translateY(${interpolate(globalLift, [0, 1], [18, 0])}px)`,
        }}
      >
        {content.audioSrc ? (
          <Audio
            src={staticFile(content.audioSrc.replace(/^\//, ''))}
            volume={content.audioVolume ?? 0.3}
          />
        ) : null}

        <div
          style={{
            position: 'absolute',
            top: isVertical ? 42 : 28,
            right: isVertical ? 36 : 28,
            width: isVertical ? 180 : 128,
            height: isVertical ? 180 : 128,
            opacity: 0.08,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 18px 28px rgba(16, 50, 65, 0.08))',
          }}
        >
          <Img
            src={content.logoSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>

        <Sequence from={introStart} durationInFrames={content.sceneTiming.intro}>
          <AbsoluteFill
            style={{
              display: 'grid',
              gridTemplateColumns: isLandscape ? '1.02fr 0.98fr' : '1fr',
              gap: isVertical ? 30 : 26,
              alignItems: 'stretch',
            }}
          >
            <AnimatedBlock
              style={{
                display: 'grid',
                gap: 22,
                alignContent: 'center',
              }}
            >
              <SectionChrome format={format}>
                <div style={{display: 'grid', gap: 22}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
                    <Img
                      src={content.logoSrc}
                      style={{
                        width: isVertical ? 124 : 92,
                        height: isVertical ? 124 : 92,
                        borderRadius: 28,
                        background: '#fff',
                        padding: isVertical ? 16 : 12,
                        boxShadow: '0 18px 36px rgba(16, 50, 65, 0.16)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{display: 'grid', gap: 8}}>
                      <p
                        style={{
                          margin: 0,
                          color: adColors.teal,
                          fontSize: 20,
                          fontWeight: 800,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {content.heroEyebrow}
                      </p>
                      <strong
                        style={{
                          fontSize: isVertical ? 42 : 34,
                          lineHeight: 1,
                          letterSpacing: '-0.04em',
                          color: adColors.ink,
                        }}
                      >
                        {content.brandName}
                      </strong>
                    </div>
                  </div>

                  <h1
                    style={{
                      margin: 0,
                      fontSize: isLandscape ? 88 : isVertical ? 96 : 82,
                      lineHeight: 0.92,
                      letterSpacing: '-0.055em',
                      color: adColors.ink,
                      maxWidth: isLandscape ? '8.6ch' : isSquare ? '9ch' : '9.2ch',
                    }}
                  >
                    {content.headline}
                  </h1>

                  <p
                    style={{
                      margin: 0,
                      fontSize: isVertical ? 34 : 29,
                      lineHeight: 1.48,
                      color: adColors.inkSoft,
                      maxWidth: isLandscape ? '31ch' : '27ch',
                    }}
                  >
                    {content.supportingText}
                  </p>

                  <div
                    style={{
                      display: 'inline-flex',
                      width: 'fit-content',
                      maxWidth: '100%',
                      alignItems: 'center',
                      gap: 10,
                      padding: '14px 18px',
                      borderRadius: 999,
                      background: 'rgba(30, 106, 127, 0.08)',
                      color: '#244854',
                      fontWeight: 700,
                      fontSize: 24,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: adColors.gold,
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    {content.trustCue}
                  </div>
                </div>
              </SectionChrome>
            </AnimatedBlock>

            <AnimatedBlock
              delay={8}
              from="right"
              style={{
                display: 'grid',
                gap: 18,
                borderRadius: 34,
                padding: 26,
                background:
                  'radial-gradient(circle at top, rgba(30, 106, 127, 0.18), transparent 30%), linear-gradient(180deg, #143746 0%, #163d4b 100%)',
                boxShadow: '0 28px 60px rgba(16, 50, 65, 0.22)',
                color: '#eff7f8',
                alignContent: 'start',
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                  <Img
                    src={content.logoSrc}
                    style={{
                      width: isVertical ? 92 : 72,
                      height: isVertical ? 92 : 72,
                      objectFit: 'contain',
                      borderRadius: 20,
                      background: 'rgba(255,255,255,0.96)',
                      padding: 10,
                      boxShadow: '0 14px 28px rgba(0,0,0,0.16)',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                  <p style={{margin: 0, color: 'rgba(239,247,248,0.82)', fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 800}}>
                    Inside {content.brandName}
                  </p>
                  <h2 style={{margin: '8px 0 0', fontSize: 42, lineHeight: 1.05}}>Live workspace preview</h2>
                  </div>
                </div>
                <div
                  style={{
                    borderRadius: 999,
                    padding: '10px 14px',
                    background: 'rgba(239, 247, 248, 0.12)',
                    color: '#f8c26b',
                    fontSize: 20,
                    fontWeight: 700,
                    height: 'fit-content',
                  }}
                >
                  Product overview
                </div>
              </div>

              <Img
                src={content.screenshots[0].src}
                style={{
                  width: '100%',
                  height: isLandscape ? 660 : isVertical ? 780 : 560,
                  objectFit: 'cover',
                  objectPosition: content.screenshots[0].objectPosition ?? 'top center',
                  borderRadius: 24,
                  boxShadow: '0 18px 36px rgba(0,0,0,0.18)',
                }}
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {[
                  ['Customers', 'History ready'],
                  ['Sales', 'Connected'],
                  ['Documents', 'Branded'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      background: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <p style={{margin: 0, color: 'rgba(239,247,248,0.68)', fontSize: 18}}>{label}</p>
                    <strong style={{fontSize: 26}}>{value}</strong>
                  </div>
                ))}
              </div>
            </AnimatedBlock>
          </AbsoluteFill>
        </Sequence>

        <Sequence from={propositionStart} durationInFrames={content.sceneTiming.proposition}>
          <AbsoluteFill style={{display: 'grid', gap: 22, alignContent: 'center'}}>
            <AnimatedBlock>
              <SectionChrome format={format}>
                <div style={{display: 'grid', gap: 14}}>
                  <p style={{margin: 0, color: adColors.teal, fontSize: 20, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase'}}>
                    {content.propositionEyebrow}
                  </p>
                  <h2 style={{margin: 0, fontSize: isLandscape ? 72 : 76, lineHeight: 1.02, letterSpacing: '-0.045em', color: adColors.ink}}>
                    {content.propositionTitle}
                  </h2>
                  <p style={{margin: 0, fontSize: 30, lineHeight: 1.55, color: adColors.inkSoft, maxWidth: '32ch'}}>
                    {content.propositionBody}
                  </p>
                </div>
              </SectionChrome>
            </AnimatedBlock>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isLandscape ? 'repeat(3, minmax(0, 1fr))' : '1fr',
                gap: 16,
              }}
            >
              {content.trustPoints.map((point, index) => (
                <AnimatedBlock
                  key={point}
                  delay={index * 4 + 4}
                  style={{
                    borderRadius: 20,
                    padding: '18px 20px',
                    border: `1px solid ${adColors.line}`,
                    background: 'rgba(255,255,255,0.74)',
                    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)',
                    color: '#355462',
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {point}
                </AnimatedBlock>
              ))}
            </div>
          </AbsoluteFill>
        </Sequence>

        <Sequence from={showcaseStart} durationInFrames={content.sceneTiming.showcase}>
          <AbsoluteFill style={{display: 'grid', gap: 20, alignContent: 'center'}}>
            <AnimatedBlock>
              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    marginBottom: 4,
                  }}
                >
                  <Img
                    src={content.logoSrc}
                    style={{
                      width: 82,
                      height: 82,
                      objectFit: 'contain',
                      borderRadius: 20,
                      background: '#fff',
                      padding: 10,
                      boxShadow: '0 14px 28px rgba(16,50,65,0.12)',
                    }}
                  />
                  <strong
                    style={{
                      fontSize: 34,
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      color: adColors.ink,
                    }}
                  >
                    {content.brandName}
                  </strong>
                </div>
                <p style={{margin: 0, color: adColors.teal, fontSize: 20, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase'}}>
                  Screenshot showcase
                </p>
                <h2 style={{margin: 0, fontSize: isVertical ? 64 : 60, lineHeight: 1.04, letterSpacing: '-0.04em', color: adColors.ink}}>
                  {content.showcaseTitle}
                </h2>
                <p style={{margin: 0, color: adColors.inkSoft, fontSize: 28, lineHeight: 1.55, maxWidth: '30ch'}}>
                  {content.showcaseBody}
                </p>
              </div>
            </AnimatedBlock>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isLandscape ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                gap: 18,
              }}
            >
              {content.screenshots.slice(1).map((shot, index) => (
                <AnimatedBlock key={shot.title} delay={index * 5 + 4}>
                  <ScreenshotCard
                    src={shot.src}
                    label={shot.label}
                    title={shot.title}
                    caption={shot.caption}
                    compact={isLandscape || isSquare}
                    objectPosition={shot.objectPosition}
                  />
                </AnimatedBlock>
              ))}
            </div>
          </AbsoluteFill>
        </Sequence>

        <Sequence from={featuresStart} durationInFrames={content.sceneTiming.features}>
          <AbsoluteFill style={{display: 'grid', gap: 18, alignContent: 'center'}}>
            <AnimatedBlock>
              <p style={{margin: 0, color: adColors.teal, fontSize: 20, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase'}}>
                Feature summary
              </p>
              <h2 style={{margin: '12px 0 0', fontSize: isVertical ? 68 : 62, lineHeight: 1.02, letterSpacing: '-0.04em', color: adColors.ink}}>
                {content.featureTitle}
              </h2>
            </AnimatedBlock>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isLandscape ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
                gap: 18,
              }}
            >
              {content.features.map((feature, index) => (
                <AnimatedBlock
                  key={feature.title}
                  delay={index * 4 + 2}
                  style={{
                    borderRadius: 24,
                    padding: 24,
                    border: `1px solid ${adColors.line}`,
                    background: 'rgba(255,255,255,0.88)',
                    boxShadow: '0 16px 36px rgba(15,23,42,0.08)',
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <strong style={{fontSize: 28, color: adColors.ink}}>{feature.title}</strong>
                  <p style={{margin: 0, fontSize: 22, lineHeight: 1.5, color: adColors.inkSoft}}>{feature.body}</p>
                </AnimatedBlock>
              ))}
            </div>
          </AbsoluteFill>
        </Sequence>

        <Sequence from={outroStart} durationInFrames={content.sceneTiming.outro}>
          <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
            <AnimatedBlock
              style={{
                width: '100%',
                borderRadius: 34,
                padding: isVertical ? '52px 40px' : '44px 38px',
                border: `1px solid ${adColors.line}`,
                background:
                  'radial-gradient(circle at top left, rgba(30, 106, 127, 0.12), transparent 34%), rgba(255,255,255,0.95)',
                boxShadow: '0 24px 52px rgba(15, 23, 42, 0.1)',
                textAlign: 'center',
                display: 'grid',
                gap: 16,
                placeItems: 'center',
              }}
            >
              <Img
                src={content.logoSrc}
                style={{
                  width: isVertical ? 190 : 148,
                  height: isVertical ? 190 : 148,
                  borderRadius: 34,
                  background: '#fff',
                  padding: isVertical ? 24 : 18,
                  boxShadow: '0 22px 46px rgba(16, 50, 65, 0.18)',
                }}
              />
              <p style={{margin: 0, color: adColors.teal, fontSize: 22, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase'}}>
                {content.ctaEyebrow}
              </p>
              <h2 style={{margin: 0, fontSize: isVertical ? 82 : 74, lineHeight: 0.96, letterSpacing: '-0.055em', color: adColors.ink}}>
                {content.ctaHeadline}
              </h2>
              <p style={{margin: 0, maxWidth: '25ch', color: adColors.inkSoft, fontSize: 28, lineHeight: 1.55}}>
                {content.ctaBody}
              </p>
              {content.ctaMicroLine ? (
                <p
                  style={{
                    margin: 0,
                    color: '#6b8089',
                    fontSize: 20,
                    lineHeight: 1.4,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {content.ctaMicroLine}
                </p>
              ) : null}
              <div
                style={{
                  marginTop: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  borderRadius: 999,
                  padding: '16px 26px',
                  background: adColors.teal,
                  color: adColors.white,
                  fontSize: 24,
                  fontWeight: 800,
                  boxShadow: '0 18px 36px rgba(30, 106, 127, 0.24)',
                }}
              >
                {content.ctaLabel}
              </div>
            </AnimatedBlock>
          </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>
    </AdShell>
  );
};
