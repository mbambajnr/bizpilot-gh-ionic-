import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(projectDir, '..');
const publicDir = path.join(projectDir, 'public');

await mkdir(publicDir, { recursive: true });
await cp(path.join(repositoryRoot, 'public'), publicDir, { recursive: true, force: true });

const landingScreenshots = [
  'cypress/screenshots-mobile-after/mobile_qa.cy.ts/mobile-customers-list.png',
  'cypress/screenshots-mobile-after/mobile_qa.cy.ts/mobile-sales-top.png',
  'cypress/screenshots-mobile-docs-after/mobile_qa_docs.cy.ts/mobile-waybill-detail-after.png',
];

for (const relativePath of landingScreenshots) {
  const destination = path.join(publicDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(repositoryRoot, relativePath), destination, { force: true });
}
