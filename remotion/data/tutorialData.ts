export type TutorialStep = {
  title: string;
  description: string;
  screenshotSrc: string;
  highlightArea?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
};

export type TutorialData = {
  tutorialTitle: string;
  steps: TutorialStep[];
};

import customerPreview from '../../cypress/screenshots-mobile-after/mobile_qa.cy.ts/mobile-customers-list.png';
import salesPreview from '../../cypress/screenshots-mobile-after/mobile_qa.cy.ts/mobile-sales-top.png';

export const recordSaleTutorial: TutorialData = {
  tutorialTitle: 'How to Record a Sale',
  steps: [
    {
      title: 'Open Sales Tab',
      description: 'Navigate to the sales section from your main dashboard.',
      screenshotSrc: salesPreview,
      highlightArea: { top: '80%', left: '40%', width: '20%', height: '10%' },
    },
    {
      title: 'Select a Customer',
      description: 'Pick an existing customer or create a new one for the transaction.',
      screenshotSrc: customerPreview,
      highlightArea: { top: '20%', left: '5%', width: '90%', height: '15%' },
    },
    {
      title: 'Confirm & Branded Receipt',
      description: 'Once confirmed, BisaPilot generates your branded document instantly.',
      screenshotSrc: salesPreview,
    },
  ],
};
