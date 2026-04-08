function encodeSvg(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createProductImage(label: string, accent = '#f4c95d', base = '#173028') {
  const initials = label
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${base}" />
          <stop offset="100%" stop-color="#0c1814" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="38" fill="url(#bg)" />
      <circle cx="182" cy="60" r="40" fill="${accent}" fill-opacity="0.82" />
      <rect x="36" y="98" width="168" height="92" rx="24" fill="#f6f4ef" fill-opacity="0.14" />
      <text x="36" y="78" fill="#eef6f1" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="700">${label}</text>
      <text x="36" y="160" fill="#eef6f1" font-size="58" font-family="Arial, Helvetica, sans-serif" font-weight="700">${initials}</text>
    </svg>
  `;

  return encodeSvg(svg);
}
