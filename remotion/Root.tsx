import React from 'react';
import {Composition} from 'remotion';

import {BisaPilotProductAd} from './compositions/BisaPilotProductAd';
import {PremiumBisaPilotAd} from './compositions/PremiumBisaPilotAd';
import {ManifestoBisaPilotAd} from './compositions/ManifestoBisaPilotAd';
import {ComingSoonBisaPilotAd} from './compositions/ComingSoonBisaPilotAd';
import {BizPilotWrapped} from './compositions/BizPilotWrapped';
import {TutorialWalkthrough} from './compositions/TutorialWalkthrough';
import {SocialProofAd} from './compositions/SocialProofBisaPilotAd';
import {ModernClarityAd} from './compositions/ModernClarityAd';
import {sampleWrapped2026} from './data/wrappedData';
import {recordSaleTutorial} from './data/tutorialData';
import {currentSocialProof} from './data/socialProofData';
import {
  adFormatDimensions,
  bisaPilotAdLibrary,
  type AdFormat,
} from './data/bisaPilotAds';

const fps = 30;

const formats: AdFormat[] = ['vertical', 'square', 'landscape'];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {formats.map((format) => {
        const dimensions = adFormatDimensions[format];
        const durationInFrames =
          bisaPilotAdLibrary.overview15.sceneTiming.intro +
          bisaPilotAdLibrary.overview15.sceneTiming.proposition +
          bisaPilotAdLibrary.overview15.sceneTiming.showcase +
          bisaPilotAdLibrary.overview15.sceneTiming.features +
          bisaPilotAdLibrary.overview15.sceneTiming.outro;

        return (
          <Composition
            key={`overview-${format}`}
            id={`BisaPilotOverview15${format[0].toUpperCase()}${format.slice(1)}`}
            component={BisaPilotProductAd}
            durationInFrames={durationInFrames}
            fps={fps}
            width={dimensions.width}
            height={dimensions.height}
            defaultProps={{
              content: bisaPilotAdLibrary.overview15,
              format,
            }}
          />
        );
      })}

      {formats.map((format) => {
        const dimensions = adFormatDimensions[format];
        const durationInFrames =
          bisaPilotAdLibrary.premium15.sceneTiming.intro +
          bisaPilotAdLibrary.premium15.sceneTiming.proposition +
          bisaPilotAdLibrary.premium15.sceneTiming.showcase +
          bisaPilotAdLibrary.premium15.sceneTiming.features +
          bisaPilotAdLibrary.premium15.sceneTiming.outro;

        return (
          <Composition
            key={`premium-${format}`}
            id={`BisaPilotPremium15${format[0].toUpperCase()}${format.slice(1)}`}
            component={PremiumBisaPilotAd}
            durationInFrames={durationInFrames}
            fps={fps}
            width={dimensions.width}
            height={dimensions.height}
            defaultProps={{
              content: bisaPilotAdLibrary.premium15,
              format,
            }}
          />
        );
      })}

      {formats.map((format) => {
        const dimensions = adFormatDimensions[format];
        const durationInFrames =
          bisaPilotAdLibrary.manifesto15.sceneTiming.intro +
          bisaPilotAdLibrary.manifesto15.sceneTiming.proposition +
          bisaPilotAdLibrary.manifesto15.sceneTiming.showcase +
          bisaPilotAdLibrary.manifesto15.sceneTiming.features +
          bisaPilotAdLibrary.manifesto15.sceneTiming.outro;

        return (
          <Composition
            key={`manifesto-${format}`}
            id={`BisaPilotManifesto15${format[0].toUpperCase()}${format.slice(1)}`}
            component={ManifestoBisaPilotAd}
            durationInFrames={durationInFrames}
            fps={fps}
            width={dimensions.width}
            height={dimensions.height}
            defaultProps={{
              content: bisaPilotAdLibrary.manifesto15,
              format,
            }}
          />
        );
      })}

      {formats.map((format) => {
        const dimensions = adFormatDimensions[format];
        const durationInFrames =
          bisaPilotAdLibrary.comingSoon.sceneTiming.intro +
          bisaPilotAdLibrary.comingSoon.sceneTiming.proposition +
          bisaPilotAdLibrary.comingSoon.sceneTiming.showcase +
          bisaPilotAdLibrary.comingSoon.sceneTiming.features +
          bisaPilotAdLibrary.comingSoon.sceneTiming.outro;

        return (
          <Composition
            key={`coming-soon-${format}`}
            id={`BisaPilotComingSoon15${format[0].toUpperCase()}${format.slice(1)}`}
            component={ComingSoonBisaPilotAd}
            durationInFrames={durationInFrames}
            fps={fps}
            width={dimensions.width}
            height={dimensions.height}
            defaultProps={{
              content: bisaPilotAdLibrary.comingSoon,
              format,
            }}
          />
        );
      })}

      <Composition
        id="BizPilotMonthlyWrapped"
        component={BizPilotWrapped}
        durationInFrames={600}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: sampleWrapped2026,
        }}
      />

      <Composition
        id="BisaPilotTutorial"
        component={TutorialWalkthrough}
        durationInFrames={recordSaleTutorial.steps.length * 150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: recordSaleTutorial,
        }}
      />

      <Composition
        id="BizPilotSocialProof"
        component={SocialProofAd}
        durationInFrames={480}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: currentSocialProof,
        }}
      />

      {formats.map((format) => {
        const dimensions = adFormatDimensions[format];
        return (
          <Composition
            key={`modern-clarity-${format}`}
            id={`BisaPilotModernClarity${format[0].toUpperCase()}${format.slice(1)}`}
            component={ModernClarityAd}
            durationInFrames={780}
            fps={fps}
            width={dimensions.width}
            height={dimensions.height}
            defaultProps={{
              content: bisaPilotAdLibrary.comingSoon,
            }}
          />
        );
      })}
    </>
  );
};
