function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderEmailTemplate({ businessName, logoUrl, subject, message }) {
  const safeBusinessName = escapeHtml(businessName || 'BizPilot');
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replaceAll('\n', '<br />');
  const logoMarkup =
    logoUrl && /^https?:\/\//.test(logoUrl)
      ? `<img src="${escapeHtml(logoUrl)}" alt="${safeBusinessName} logo" style="width:72px;height:72px;object-fit:contain;border-radius:16px;background:#ffffff;padding:8px;border:1px solid #dbe4ea;" />`
      : '';

  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#f5f8fb;padding:32px;color:#102331;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dbe4ea;">
        <div style="padding:24px 28px;background:linear-gradient(145deg,#0d2433 0%,#17384a 100%);color:#ffffff;">
          <div style="display:flex;align-items:center;gap:16px;">
            ${logoMarkup}
            <div>
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;">BizPilot Email</p>
              <h1 style="margin:0;font-size:28px;line-height:1.1;">${safeBusinessName}</h1>
            </div>
          </div>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5f7280;">Subject</p>
          <h2 style="margin:0 0 22px;font-size:24px;color:#102331;">${safeSubject}</h2>
          <div style="font-size:16px;line-height:1.7;color:#233949;">${safeMessage}</div>
        </div>
      </div>
    </div>
  `;
}
