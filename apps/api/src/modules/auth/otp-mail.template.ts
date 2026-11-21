import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Attachment } from 'nodemailer/lib/mailer';

export const LOGO_CID = 'akeela-logo@akeelaonline.tech';
export const HERO_CID = 'akeela-hero@akeelaonline.tech';

export interface OtpEmailMessage {
  subject: string;
  text: string;
  html: string;
  attachments: Attachment[];
}

const assetCache = new Map<string, Buffer | null>();

function loadEmailAsset(filename: string): Buffer | null {
  if (assetCache.has(filename)) return assetCache.get(filename) ?? null;
  const candidates = [
    join(__dirname, '..', '..', '..', '..', 'assets', 'email', filename),
    join(__dirname, '..', '..', '..', '..', '..', 'assets', 'email', filename),
    resolve(process.cwd(), 'assets', 'email', filename),
    resolve(process.cwd(), 'apps', 'api', 'assets', 'email', filename),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const buffer = readFileSync(candidate);
      assetCache.set(filename, buffer);
      return buffer;
    }
  }
  assetCache.set(filename, null);
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatArabicDuration(ttlSeconds: number): string {
  if (ttlSeconds >= 60 && ttlSeconds % 60 === 0) {
    const minutes = ttlSeconds / 60;
    if (minutes === 1) return 'دقيقة واحدة';
    if (minutes === 2) return 'دقيقتين';
    if (minutes <= 10) return `${minutes} دقائق`;
    return `${minutes} دقيقة`;
  }
  if (ttlSeconds <= 10) return `${ttlSeconds} ثوانٍ`;
  return `${ttlSeconds} ثانية`;
}

function formatEnglishDuration(ttlSeconds: number): string {
  if (ttlSeconds >= 60 && ttlSeconds % 60 === 0) {
    const minutes = ttlSeconds / 60;
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return `${ttlSeconds} seconds`;
}

export function buildOtpEmail(
  purpose: string,
  code: string,
  ttlSeconds: number,
): OtpEmailMessage {
  const isVerify = purpose === 'Email_Verification';
  const safeCode = escapeHtml(code);
  const arabicDuration = formatArabicDuration(ttlSeconds);
  const englishDuration = formatEnglishDuration(ttlSeconds);

  const subject = isVerify
    ? 'أكيلة | رمز تأكيد بريدك الإلكتروني — AKEELA Verify Email'
    : 'أكيلة | رمز استعادة كلمة المرور — AKEELA Reset Password';

  const preheader = isVerify
    ? `رمز تأكيد بريدك الإلكتروني في منصة أكيلة صالح لمدة ${arabicDuration} — لا تشاركه مع أي شخص.`
    : `رمز إعادة تعيين كلمة المرور لحسابك في منصة أكيلة صالح لمدة ${arabicDuration} — لا تشاركه مع أي شخص.`;

  const badgeLabel = isVerify
    ? 'تأكيد البريد الإلكتروني'
    : 'استعادة كلمة المرور';
  const badgeBg = isVerify ? '#e7faf0' : '#fff0d2';
  const badgeColor = isVerify ? '#006d46' : '#914800';

  const heading = isVerify
    ? 'أهلاً بك في منصة أكيلة!'
    : 'إعادة تعيين كلمة المرور';

  const intro = isVerify
    ? 'يسعدنا انضمامك إلينا. لإكمال تفعيل بريدك الإلكتروني والبدء في استخدام حسابك بأمان، يُرجى إدخال رمز التحقق التالي داخل التطبيق:'
    : 'تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في أكيلة. لإتمام العملية بأمان، يُرجى إدخال رمز التحقق التالي داخل التطبيق:';

  const securityTip = isVerify
    ? 'لا تشارك هذا الرمز مع أي شخص، وفريق أكيلة لن يطلب منك رمز التحقق أبداً. إذا لم تقم بإنشاء حساب على أكيلة يمكنك تجاهل هذه الرسالة بأمان.'
    : 'لا تشارك هذا الرمز مع أي شخص، وفريق أكيلة لن يطلب منك رمز التحقق أبداً. إذا لم تطلب إعادة تعيين كلمة المرور يمكنك تجاهل هذه الرسالة وسيبقى حسابك آمناً.';

  const logo = loadEmailAsset('logo.png');
  const heroFilename = isVerify ? 'verify-hero.jpg' : 'reset-hero.jpg';
  const hero = loadEmailAsset(heroFilename);

  const attachments: Attachment[] = [];
  if (logo) {
    attachments.push({
      filename: 'akeela-logo.png',
      content: logo,
      cid: LOGO_CID,
      contentType: 'image/png',
      contentDisposition: 'inline',
    });
  }
  if (hero) {
    attachments.push({
      filename: heroFilename,
      content: hero,
      cid: HERO_CID,
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
    });
  }

  const text = [
    isVerify
      ? 'أهلاً بك في منصة أكيلة (AKEELA)!'
      : 'طلب إعادة تعيين كلمة المرور — منصة أكيلة (AKEELA)',
    '',
    intro,
    '',
    `رمز التحقق: ${code}`,
    `صالح لمدة: ${arabicDuration} (${englishDuration})`,
    '',
    securityTip,
    '',
    `Your AKEELA code is ${code}. It expires in ${ttlSeconds} seconds. If you did not request it, ignore this email.`,
  ].join('\n');

  const englishFooterLabel = isVerify
    ? 'verification code'
    : 'password reset code';

  const logoMarkup = logo
    ? `<img src="cid:${LOGO_CID}" alt="أكيلة — AKEELA" width="116" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;max-width:116px;" />`
    : `<div style="font-size:26px;font-weight:800;color:#17332b;letter-spacing:1px;">أكيلة · AKEELA</div>`;

  const heroMarkup = hero
    ? `<tr>
        <td style="padding:0 28px 22px 28px;" align="center">
          <img src="cid:${HERO_CID}" alt="${escapeHtml(badgeLabel)}" width="524" style="display:block;width:100%;max-width:524px;height:auto;border:1px solid #e4eae5;border-radius:14px;outline:none;text-decoration:none;" />
        </td>
      </tr>`
    : '';

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(subject)}</title>
    <style>
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 16px 10px !important; }
        .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .otp-digits { font-size: 32px !important; letter-spacing: 8px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f7f4;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;color:#17332b;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#f3f7f4;">
      ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f7f4;width:100%;border-collapse:collapse;">
      <tr>
        <td class="email-shell" align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background-color:#ffffff;border:1px solid #e2eae4;border-radius:20px;overflow:hidden;border-collapse:separate;">
            <tr>
              <td style="height:5px;background-color:#008657;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style="padding:26px 28px 18px 28px;">
                ${logoMarkup}
              </td>
            </tr>
            ${heroMarkup}
            <tr>
              <td class="email-pad" align="center" style="padding:0 36px 8px 36px;">
                <span style="display:inline-block;padding:6px 16px;border-radius:999px;background-color:${badgeBg};color:${badgeColor};font-size:13px;font-weight:700;line-height:1.4;">
                  ${escapeHtml(badgeLabel)}
                </span>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:8px 36px 10px 36px;">
                <h1 style="margin:0;font-size:24px;font-weight:800;line-height:1.4;color:#17332b;">
                  ${escapeHtml(heading)}
                </h1>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:0 36px 24px 36px;">
                <p style="margin:0;font-size:15px;line-height:1.85;color:#4a5d55;">
                  ${escapeHtml(intro)}
                </p>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:0 36px 24px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2fbf6;border:1.5px dashed #008657;border-radius:16px;border-collapse:separate;">
                  <tr>
                    <td align="center" style="padding:22px 16px 20px 16px;">
                      <div style="font-size:13px;font-weight:700;color:#006d46;margin-bottom:10px;">
                        رمز التحقق الخاص بك
                      </div>
                      <div class="otp-digits" dir="ltr" style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:38px;font-weight:800;letter-spacing:10px;line-height:1.25;color:#17332b;padding-left:10px;">
                        ${safeCode}
                      </div>
                      <div style="margin-top:12px;font-size:13px;color:#596c64;">
                        صالح لمدة <strong style="color:#17332b;">${escapeHtml(arabicDuration)}</strong> فقط
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:0 36px 26px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffdf9;border:1px solid #eceae4;border-radius:12px;overflow:hidden;border-collapse:separate;">
                  <tr>
                    <td dir="rtl" style="padding:14px 16px;border-right:4px solid #cf480d;font-size:13px;line-height:1.75;color:#596c64;text-align:right;">
                      <strong style="color:#914800;">تنبيه أمني:</strong>
                      ${escapeHtml(securityTip)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:0 36px;">
                <div style="height:1px;background-color:#e8efea;font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:18px 36px 26px 36px;">
                <p style="margin:0 0 6px 0;font-size:12px;line-height:1.7;color:#596c64;" dir="ltr">
                  Your AKEELA ${englishFooterLabel} is <strong style="color:#17332b;">${safeCode}</strong> (expires in ${escapeHtml(englishDuration)}).
                </p>
                <p style="margin:0;font-size:12px;line-height:1.7;color:#7d8f87;">
                  منصة أكيلة (<bdi>AKEELA Platform</bdi>) · رسالة تلقائية، يُرجى عدم الرد عليها.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html, attachments };
}
