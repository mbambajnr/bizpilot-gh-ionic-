import customerPreview from '../../cypress/screenshots-mobile-after/mobile_qa.cy.ts/mobile-customers-list.png';
import salesPreview from '../../cypress/screenshots-mobile-after/mobile_qa.cy.ts/mobile-sales-top.png';
import waybillPreview from '../../cypress/screenshots-mobile-docs-after/mobile_qa_docs.cy.ts/mobile-waybill-detail-after.png';
import logo from '../../public/assets/logo.png';

// Premium Visual Artist Assets
import premiumLogo from '../assets/Logo.png';
import happyClient from '../assets/ibiza02.png';
import happyOwner from '../assets/ibiza01.png';
import stressedOwner from '../assets/image.png';
import empoweredEmployee from '../assets/te.png';

export type AdFormat = 'vertical' | 'square' | 'landscape';

export type ShowcaseShot = {
  src: string;
  label: string;
  title: string;
  caption: string;
  objectPosition?: string;
};

export type FeaturePoint = {
  title: string;
  body: string;
};

export type AdSceneTiming = {
  intro: number;
  proposition: number;
  showcase: number;
  features: number;
  outro: number;
};

export type BisaPilotAdContent = {
  slug: string;
  brandName: string;
  logoSrc: string;
  audioSrc?: string;
  audioVolume?: number;
  heroEyebrow: string;
  headline: string;
  supportingText: string;
  trustCue: string;
  propositionEyebrow: string;
  propositionTitle: string;
  propositionBody: string;
  trustPoints: string[];
  showcaseTitle: string;
  showcaseBody: string;
  screenshots: ShowcaseShot[];
  featureTitle: string;
  features: FeaturePoint[];
  ctaEyebrow: string;
  ctaHeadline: string;
  ctaBody: string;
  ctaLabel: string;
  ctaMicroLine?: string;
  sceneTiming: AdSceneTiming;
  // Professional Artist Layer
  characterAssets?: {
    stressed: string;
    resolved: string;
    client: string;
    employee: string;
  };
};

export const adFormatDimensions: Record<AdFormat, {width: number; height: number}> = {
  vertical: {width: 1080, height: 1920},
  square: {width: 1080, height: 1080},
  landscape: {width: 1920, height: 1080},
};

export const bisaPilotOverview15: BisaPilotAdContent = {
  slug: 'bisapilot-overview-15',
  brandName: 'BisaPilot',
  logoSrc: logo,
  audioSrc: '/audio/bisapilot-sax-theme.wav',
  audioVolume: 0.24,
  heroEyebrow: 'Business operations in one calm workspace',
  headline: 'Everything your business runs on, in one place.',
  supportingText:
    'BisaPilot brings together customers, sales, stock, quotations, invoices, team permissions, and branded documents into one clean workspace so you can run operations with clarity.',
  trustCue: 'Your scaling partner for structure, visibility, and control.',
  propositionEyebrow: 'What the workspace fixes',
  propositionTitle: 'Run the business in one connected operating flow.',
  propositionBody:
    'Move from customer record to quotation, sale, invoice, stock movement, and follow-up without breaking context or relying on disconnected tools.',
  trustPoints: [
    'Customers, sales, and stock stay connected',
    'Documents stay branded and business-ready',
    'Permissions reflect real employee roles',
  ],
  showcaseTitle: 'See the product as a working business surface.',
  showcaseBody:
    'BisaPilot is strongest when daily work stays visible: customer standing, sales capture, and document output all moving inside the same workspace.',
  screenshots: [
    {
      src: customerPreview,
      label: 'Customer workflow',
      title: 'Track account standing, history, and follow-up context in one place.',
      caption: 'Designed for quick scanning and cleaner customer control, not scattered contact notes.',
      objectPosition: 'top center',
    },
    {
      src: salesPreview,
      label: 'Sales workflow',
      title: 'Capture sales cleanly and keep stock and document flow aligned.',
      caption: 'Built for practical selling activity, including walk-in sales, payment capture, and invoice continuity.',
      objectPosition: 'top center',
    },
    {
      src: waybillPreview,
      label: 'Document output',
      title: 'Send out branded business documents that still feel operationally useful.',
      caption: 'Invoices, quotations, and waybills carry the business identity forward while staying readable on real screens.',
      objectPosition: 'top center',
    },
  ],
  featureTitle: 'What BisaPilot covers',
  features: [
    {
      title: 'Customers and follow-up',
      body: 'Track balances, contact context, and account history without losing the operational trail.',
    },
    {
      title: 'Sales and quotations',
      body: 'Turn intent into confirmed sales with clearer document and payment continuity.',
    },
    {
      title: 'Inventory and stock visibility',
      body: 'See what is moving, what is low, and what needs attention before stock issues spread.',
    },
    {
      title: 'Permissions and accountability',
      body: 'Give each employee the visibility their role actually needs and keep access controlled as the team grows.',
    },
  ],
  ctaEyebrow: 'BisaPilot',
  ctaHeadline: 'BisaPilot',
  ctaBody: 'Run customers, sales, stock, documents, and team access from one clear operating system.',
  ctaLabel: 'Start your workspace',
  ctaMicroLine: 'Your scaling partner',
  sceneTiming: {
    intro: 66,
    proposition: 66,
    showcase: 144,
    features: 78,
    outro: 96,
  },
};

export const bisaPilotPremium15: BisaPilotAdContent = {
  ...bisaPilotOverview15,
  slug: 'bisapilot-premium-15',
  logoSrc: premiumLogo,
  audioSrc: '/audio/bisapilot-premium-voiceover.mp3',
  headline: 'Control the Chaos. Command the Success.',
  heroEyebrow: 'Your scaling partner',
  supportingText: 'From manual stress to automated success. One workspace for your entire operation.',
  characterAssets: {
    stressed: stressedOwner,
    resolved: happyOwner,
    client: happyClient,
    employee: empoweredEmployee,
  },
  sceneTiming: {
    intro: 75,
    proposition: 75,
    showcase: 120,
    features: 90,
    outro: 90,
  },
};

export const bisaPilotManifesto15: BisaPilotAdContent = {
  ...bisaPilotOverview15,
  slug: 'bisapilot-manifesto-15',
  logoSrc: premiumLogo,
  audioSrc: '/audio/bisapilot-premium-voiceover.mp3',
  headline: 'The Quiet Engine of Your Success.',
  heroEyebrow: 'Your scaling partner',
  supportingText: 'Software that breathes with your business. Silent. Powerful. Built to last.',
  ctaHeadline: 'Pilot Your Passion.',
  ctaBody: 'The modern operating system for the ambitious African SME.',
  characterAssets: {
    stressed: stressedOwner,
    resolved: happyOwner,
    client: happyClient,
    employee: empoweredEmployee,
  },
  sceneTiming: {
    intro: 60,
    proposition: 90,
    showcase: 120,
    features: 90,
    outro: 90,
  },
};

export const bisaPilotComingSoon: BisaPilotAdContent = {
  ...bisaPilotOverview15,
  slug: 'bisapilot-coming-soon',
  logoSrc: premiumLogo,
  audioSrc: '/audio/bisapilot-premium-voiceover.mp3',
  headline: 'The Future of Your Business is Landing.',
  heroEyebrow: 'Your scaling partner',
  supportingText: 'One unified workspace to command your sales, stock, and customers. Coming soon to Ghana.',
  ctaHeadline: 'Ready to Pilot?',
  ctaBody: 'Join the next generation of successful African SMEs.',
  ctaLabel: 'Join the waitlist',
  ctaMicroLine: 'Your scaling partner',
  characterAssets: {
    stressed: stressedOwner,
    resolved: happyOwner,
    client: happyClient,
    employee: empoweredEmployee,
  },
  sceneTiming: {
    intro: 90,
    proposition: 90,
    showcase: 60,
    features: 90,
    outro: 120,
  },
};

export const bisaPilotAdLibrary = {
  overview15: bisaPilotOverview15,
  premium15: bisaPilotPremium15,
  manifesto15: bisaPilotManifesto15,
  comingSoon: bisaPilotComingSoon,
};
