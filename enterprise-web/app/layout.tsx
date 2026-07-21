import type { Metadata } from 'next';

import './workflow.css';

export const metadata: Metadata = {
  title: 'BizPilot Enterprise',
  description: 'Enterprise operations, inventory, finance, and commerce control.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const runtimeEnv = JSON.stringify({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    apiBaseUrl: process.env.NEXT_PUBLIC_BIZPILOT_API_BASE_URL,
  }).replace(/</g, '\\u003c');

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `globalThis.__BIZPILOT_PUBLIC_ENV__=${runtimeEnv}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
