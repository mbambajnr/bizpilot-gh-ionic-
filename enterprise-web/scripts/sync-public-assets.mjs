import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(projectDir, '..');
const publicDir = path.join(projectDir, 'public');

await mkdir(publicDir, { recursive: true });
await cp(path.join(repositoryRoot, 'public'), publicDir, { recursive: true, force: true });

// Remove stale mobile-screenshot artifacts from a previous copy step that
// pulled Cypress screenshots into public/. The mobile/Cypress app has been
// removed and these images are not referenced anywhere in the web app.
await rm(path.join(publicDir, 'cypress'), { recursive: true, force: true });
