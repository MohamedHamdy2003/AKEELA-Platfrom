import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createTransport } from 'nodemailer';
import {
  buildOtpEmail,
  HERO_CID,
  LOGO_CID,
} from '../src/modules/auth/otp-mail.template';

test('OTP email template builds branded RTL HTML, plain-text fallback, and inline CID images for both purposes', () => {
  const verify = buildOtpEmail('Email_Verification', '482910', 600);
  assert.ok(verify.subject.includes('Verify'));
  assert.match(verify.text, /code is 482910/);
  assert.ok(verify.html.includes('dir="rtl"'));
  assert.ok(verify.html.includes('482910'));
  assert.ok(verify.html.includes('10 دقائق'));
  assert.ok(verify.html.includes(`cid:${LOGO_CID}`));
  assert.ok(verify.html.includes(`cid:${HERO_CID}`));
  assert.equal(verify.attachments.length, 2);
  assert.ok(
    verify.attachments.every(
      (item) =>
        Buffer.isBuffer(item.content) && item.contentDisposition === 'inline',
    ),
  );

  const reset = buildOtpEmail('Password_Reset', '903157', 600);
  assert.ok(reset.subject.includes('Reset'));
  assert.match(reset.text, /code is 903157/);
  assert.ok(reset.html.includes('إعادة تعيين كلمة المرور'));
  assert.ok(reset.html.includes('903157'));
  assert.equal(reset.attachments.length, 2);
  assert.notEqual(
    verify.attachments[1]!.filename,
    reset.attachments[1]!.filename,
  );
});

test('OTP email MIME compiles cleanly under Nodemailer disableFileAccess and disableUrlAccess', async () => {
  const transport = createTransport({
    streamTransport: true,
    buffer: true,
  });
  const content = buildOtpEmail('Email_Verification', '654321', 600);
  const info = await transport.sendMail({
    from: 'AKEELA <sender@gmail.com>',
    to: 'customer@example.com',
    subject: content.subject,
    text: content.text,
    html: content.html,
    attachments: content.attachments,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  assert.ok(Buffer.isBuffer(info.message));
  const raw = info.message.toString('utf8');
  assert.ok(raw.includes(`Content-ID: <${LOGO_CID}>`));
  assert.ok(raw.includes(`Content-ID: <${HERO_CID}>`));
  assert.ok(raw.includes('multipart/related'));
  assert.ok(raw.includes('multipart/alternative'));
  assert.ok(
    info.message.byteLength < 85 * 1024,
    `Total MIME size (${info.message.byteLength} bytes) should stay compact for Gmail.`,
  );
});
