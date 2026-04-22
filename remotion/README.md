# BisaPilot Remotion Ads

This folder contains a reusable Remotion ad system for BisaPilot.

## Structure

- `index.ts`: Remotion entry point
- `Root.tsx`: Registers the available ad compositions
- `data/bisaPilotAds.ts`: Structured ad content, screenshot assets, timings, and format presets
- `components/`: Shared visual building blocks for scenes
- `compositions/BisaPilotProductAd.tsx`: Reusable product ad composition

## Current variant

- `BisaPilotOverview15Vertical`
- `BisaPilotOverview15Square`
- `BisaPilotOverview15Landscape`

Each composition uses the same content model and scene sequence:

1. Intro / headline
2. Product value proposition
3. Screenshot showcase
4. Feature summary
5. CTA outro

## Run studio

```bash
npm run remotion:studio
```

## Render examples

```bash
npm run remotion:render:overview:vertical
npm run remotion:render:overview:square
npm run remotion:render:overview:landscape
```

## Swap text and screenshots

Edit `data/bisaPilotAds.ts`:

- `headline`
- `supportingText`
- `ctaHeadline`
- `ctaLabel`
- `screenshots`
- `sceneTiming`

You can add more ad presets in the same file and register them in `Root.tsx`.

## Future extension

The current setup is ready to expand to:

- 30-second variants
- more aspect ratios
- alternative CTA endings
- industry-specific versions
- upgraded screenshots or video assets
