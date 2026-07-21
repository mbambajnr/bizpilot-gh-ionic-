# BizPilot platform boundary

BizPilot has two delivery targets that share business logic and data contracts but do not share a browser shell.

## Enterprise web

- Framework: Next.js in `enterprise-web/`
- Local URL: `http://127.0.0.1:3000`
- Development: `npm run dev` or `npm run dev:web`
- Production build: `npm run build` or `npm run build:web`
- Production start: `npm run start:web`

The public website or enterprise application host must deploy the Next.js build. Unknown browser routes return the Next.js not-found page; they never load the Ionic application.

## Mobile applications

- Framework: Ionic React with Capacitor in the repository root
- Development: `npm run dev:mobile`
- Mobile asset build: `npm run build:mobile`
- Capacitor synchronization: `npm run mobile:sync`
- Open the iOS project: `npm run mobile:ios`
- Open the Android project: `npm run mobile:android`

The Ionic build output in `dist/` is a Capacitor application asset and must not be published as the enterprise website.
Building the Android package locally requires Android Studio, its Android SDK, and a compatible Java runtime.

## Deployment rule

Route browser traffic to the Next.js service. App Store and Play Store packages are built from the Ionic/Capacitor target. Authentication, authorization, business state, and integrations remain shared so workflows behave consistently across both products.
