type EmailDetail = {
  label: string;
  value: string;
};

type EmailAction = {
  label: string;
  url: string;
};

type TransactionalEmailInput = {
  title: string;
  preheader: string;
  intro: string[];
  details?: EmailDetail[];
  action?: EmailAction;
  secondaryNote?: string;
  safetyNote?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTransactionalEmail({
  title,
  preheader,
  intro,
  details = [],
  action,
  secondaryNote,
  safetyNote,
}: TransactionalEmailInput) {
  const detailRows = details
    .map(
      (detail) => `
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(detail.label)}</td>
          <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:700;text-align:right">${escapeHtml(detail.value)}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
        <tr>
          <td style="padding:24px 28px;border-bottom:1px solid #e2e8f0">
            <div style="display:inline-flex;align-items:center;gap:10px">
              <span style="display:inline-flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:8px;background:#10b981;color:#ffffff;font-weight:800">AB</span>
              <span style="font-size:16px;font-weight:800;color:#0f172a">ActiveBoard</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px">
            <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#0f172a">${escapeHtml(title)}</h1>
            ${intro.map((line) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#334155">${escapeHtml(line)}</p>`).join('')}
            ${
              details.length > 0
                ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">${detailRows}</table>`
                : ''
            }
            ${
              action
                ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;border-radius:10px;background:#10b981;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 18px">${escapeHtml(action.label)}</a></p>`
                : ''
            }
            ${secondaryNote ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b">${escapeHtml(secondaryNote)}</p>` : ''}
            ${
              safetyNote
                ? `<p style="margin:18px 0 0;padding:12px 14px;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:13px;line-height:1.6">${escapeHtml(safetyNote)}</p>`
                : ''
            }
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function renderPlainTextEmail({
  title,
  intro,
  details = [],
  action,
  secondaryNote,
  safetyNote,
}: TransactionalEmailInput) {
  return [
    title,
    '',
    ...intro,
    '',
    ...details.map((detail) => `${detail.label}: ${detail.value}`),
    details.length > 0 ? '' : null,
    action ? `${action.label}: ${action.url}` : null,
    secondaryNote ? `Note: ${secondaryNote}` : null,
    safetyNote ? `Security: ${safetyNote}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
