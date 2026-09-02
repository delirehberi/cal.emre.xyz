import { Hono } from 'hono';
import { Resend } from 'resend';
import { APP_CONFIG } from '../config';

export interface BookingConfirmationPayload {
  to: string;
  hostName: string;
  hostPubkey: string;
  hostEmail?: string;
  attendeeName: string;
  attendeePubkey?: string;
  attendeeNsec?: string;
  eventTitle: string;
  eventDescription?: string;
  startTime: number; // Unix timestamp in seconds
  endTime: number;   // Unix timestamp in seconds
  timezone: string;
  location?: string;
  icsContent: string;
  language?: 'en' | 'tr';
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export interface EmailEnv {
  ENABLE_EMAIL_NOTIFICATIONS?: string;
  RESEND_API_KEY?: string;
  SUPPORT_EMAIL?: string;
  ADMIN_EMAIL?: string;
}

/**
 * Validates the required fields of a booking confirmation payload.
 */
export function validateBookingPayload(payload: unknown): { valid: boolean; error?: string; data?: BookingConfirmationPayload } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  const p = payload as Partial<BookingConfirmationPayload>;

  if (!p.to || typeof p.to !== 'string' || !p.to.includes('@')) {
    return { valid: false, error: 'A valid attendee email address ("to") is required.' };
  }
  if (!p.hostName || typeof p.hostName !== 'string') {
    return { valid: false, error: 'Host name ("hostName") is required.' };
  }
  if (!p.hostPubkey || typeof p.hostPubkey !== 'string') {
    return { valid: false, error: 'Host public key ("hostPubkey") is required.' };
  }
  if (!p.attendeeName || typeof p.attendeeName !== 'string') {
    return { valid: false, error: 'Attendee name ("attendeeName") is required.' };
  }
  if (!p.eventTitle || typeof p.eventTitle !== 'string') {
    return { valid: false, error: 'Event title ("eventTitle") is required.' };
  }
  if (typeof p.startTime !== 'number' || isNaN(p.startTime) || p.startTime <= 0) {
    return { valid: false, error: 'Valid start time ("startTime" Unix epoch seconds) is required.' };
  }
  if (typeof p.endTime !== 'number' || isNaN(p.endTime) || p.endTime <= p.startTime) {
    return { valid: false, error: 'Valid end time ("endTime" Unix epoch seconds) greater than startTime is required.' };
  }
  if (!p.timezone || typeof p.timezone !== 'string') {
    return { valid: false, error: 'Timezone ("timezone") is required.' };
  }
  if (!p.icsContent || typeof p.icsContent !== 'string') {
    return { valid: false, error: 'ICS calendar content ("icsContent") is required.' };
  }

  const sanitized: BookingConfirmationPayload = {
    to: p.to.trim(),
    hostName: p.hostName.trim(),
    hostPubkey: p.hostPubkey.trim(),
    hostEmail: p.hostEmail?.trim(),
    attendeeName: p.attendeeName.trim(),
    attendeePubkey: p.attendeePubkey?.trim(),
    attendeeNsec: p.attendeeNsec?.trim(),
    eventTitle: p.eventTitle.trim(),
    eventDescription: p.eventDescription?.trim(),
    startTime: p.startTime,
    endTime: p.endTime,
    timezone: p.timezone.trim(),
    location: p.location?.trim(),
    icsContent: p.icsContent,
    language: p.language === 'tr' ? 'tr' : 'en',
  };

  return { valid: true, data: sanitized };
}

/**
 * Formats date and time interval for email presentation.
 */
export function formatEmailDateTime(
  startTime: number,
  endTime: number,
  timezone: string,
  language: 'en' | 'tr'
): { dateStr: string; timeStr: string; durationMinutes: number } {
  const startDate = new Date(startTime * 1000);
  const endDate = new Date(endTime * 1000);
  const durationMinutes = Math.round((endTime - startTime) / 60);

  const locale = language === 'tr' ? 'tr-TR' : 'en-US';

  const dateStr = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(startDate);

  const startTimeStr = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(startDate);

  const endTimeStr = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(endDate);

  const timeStr = `${startTimeStr} - ${endTimeStr} (${timezone})`;

  return { dateStr, timeStr, durationMinutes };
}

/**
 * Generates plain text and HTML content for the booking confirmation email.
 */
export function generateEmailTemplates(payload: BookingConfirmationPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const isTr = payload.language === 'tr';
  const { dateStr, timeStr, durationMinutes } = formatEmailDateTime(
    payload.startTime,
    payload.endTime,
    payload.timezone,
    payload.language || 'en'
  );

  const eduLink = isTr ? APP_CONFIG.educationalLinks.tr : APP_CONFIG.educationalLinks.en;
  const supportEmail = APP_CONFIG.supportEmail;

  const subject = isTr
    ? `Onaylandı: ${payload.eventTitle} (${payload.hostName})`
    : `Confirmed: ${payload.eventTitle} with ${payload.hostName}`;

  // Guest keys onboarding section
  const guestSectionHtml = payload.attendeeNsec
    ? `
    <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #166534; font-size: 16px;">
        ${isTr ? '🔐 Nostr Egemen Kimliğiniz Oluşturuldu' : '🔐 Your Sovereign Nostr Identity Was Created'}
      </h3>
      <p style="color: #15803d; font-size: 14px; margin-bottom: 12px; line-height: 1.5;">
        ${
          isTr
            ? 'Bu randevu açık Nostr protokolü (NIP-52) üzerinden kaydedildi. Sizin için güvenli bir anahtar çifti oluşturduk. Gizli anahtarınızı (nsec) asla kimseyle paylaşmayın.'
            : 'This appointment was booked via the open Nostr protocol (NIP-52). A sovereign keypair was generated for you. Never share your private key (nsec) with anyone.'
        }
      </p>
      <div style="background-color: #ffffff; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; margin-bottom: 8px; font-family: monospace; font-size: 12px; word-break: break-all;">
        <strong>Public Key (npub):</strong><br/>
        <span>${payload.attendeePubkey || ''}</span>
      </div>
      <div style="background-color: #ffffff; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 12px; word-break: break-all; color: #991b1b;">
        <strong>Private Key (nsec - Keep Secret!):</strong><br/>
        <span>${payload.attendeeNsec}</span>
      </div>
      <p style="margin-top: 12px; margin-bottom: 0; font-size: 13px;">
        <a href="${eduLink}" style="color: #16a34a; font-weight: 600; text-decoration: underline;" target="_blank">
          ${isTr ? 'Nostr Hakkında Daha Fazla Bilgi Edinin →' : 'Learn More About Nostr →'}
        </a>
      </p>
    </div>
    `
    : '';

  const guestSectionText = payload.attendeeNsec
    ? `
--------------------------------------------------
${isTr ? 'NOSTR EGEMEN KİMLİĞİNİZ' : 'YOUR SOVEREIGN NOSTR IDENTITY'}
--------------------------------------------------
${
  isTr
    ? 'Bu randevu açık Nostr protokolü (NIP-52) üzerinden kaydedildi. Sizin için güvenli bir anahtar çifti oluşturduk. Gizli anahtarınızı (nsec) asla kimseyle paylaşmayın.'
    : 'This appointment was booked via the open Nostr protocol (NIP-52). A sovereign keypair was generated for you. Never share your private key (nsec) with anyone.'
}

Public Key (npub): ${payload.attendeePubkey || ''}
Private Key (nsec): ${payload.attendeeNsec}

${isTr ? 'Nostr Rehberi:' : 'Learn Nostr:'} ${eduLink}
`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
      <span style="font-weight: 700; font-size: 20px; color: #4338ca;">cal.emre.xyz</span>
    </div>

    <h2 style="color: #0f172a; margin-top: 0; font-size: 22px;">
      ${isTr ? 'Randevunuz Onaylandı!' : 'Appointment Confirmed!'}
    </h2>
    
    <p style="font-size: 15px; color: #475569;">
      ${isTr ? `Merhaba <strong>${payload.attendeeName}</strong>,` : `Hi <strong>${payload.attendeeName}</strong>,`}
    </p>
    <p style="font-size: 15px; color: #475569;">
      ${
        isTr
          ? `<strong>${payload.hostName}</strong> ile randevunuz başarıyla planlandı. Takvim davetiyesi (.ics) bu e-postaya eklenmiştir.`
          : `Your meeting with <strong>${payload.hostName}</strong> has been successfully scheduled. A calendar invite (.ics) is attached.`
      }
    </p>

    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <h3 style="margin-top: 0; margin-bottom: 12px; color: #334155; font-size: 17px;">
        ${payload.eventTitle}
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 100px;">${isTr ? 'Tarih:' : 'Date:'}</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">${isTr ? 'Saat:' : 'Time:'}</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${timeStr}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">${isTr ? 'Süre:' : 'Duration:'}</td>
          <td style="padding: 6px 0; color: #0f172a;">${durationMinutes} ${isTr ? 'dakika' : 'minutes'}</td>
        </tr>
        ${
          payload.location
            ? `<tr>
                <td style="padding: 6px 0; color: #64748b;">${isTr ? 'Konum/Bağlantı:' : 'Location:'}</td>
                <td style="padding: 6px 0; color: #0f172a;">${payload.location}</td>
              </tr>`
            : ''
        }
      </table>
      ${
        payload.eventDescription
          ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #cbd5e1; font-size: 13px; color: #475569;">
               <strong>${isTr ? 'Notlar:' : 'Notes:'}</strong> ${payload.eventDescription}
             </div>`
          : ''
      }
    </div>

    ${guestSectionHtml}

    <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 16px; font-size: 13px; color: #94a3b8; text-align: center;">
      <p style="margin: 4px 0;">
        ${isTr ? 'Destek veya sorularınız için:' : 'Questions or support:'} 
        <a href="mailto:${supportEmail}" style="color: #6366f1;">${supportEmail}</a>
      </p>
      <p style="margin: 4px 0;">
        Powered by Nostr NIP-52 • <a href="https://${APP_CONFIG.name}" style="color: #6366f1;">${APP_CONFIG.name}</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${isTr ? 'RANDEVUNUZ ONAYLANDI' : 'APPOINTMENT CONFIRMED'}
==================================================

${isTr ? `Merhaba ${payload.attendeeName},` : `Hi ${payload.attendeeName},`}

${
  isTr
    ? `${payload.hostName} ile randevunuz başarıyla planlandı. Takvim davetiyesi (.ics) bu e-postaya eklenmiştir.`
    : `Your meeting with ${payload.hostName} has been successfully scheduled. A calendar invite (.ics) is attached.`
}

${isTr ? 'Etkinlik:' : 'Event:'} ${payload.eventTitle}
${isTr ? 'Tarih:' : 'Date:'} ${dateStr}
${isTr ? 'Saat:' : 'Time:'} ${timeStr}
${isTr ? 'Süre:' : 'Duration:'} ${durationMinutes} ${isTr ? 'dakika' : 'minutes'}
${payload.location ? `${isTr ? 'Konum:' : 'Location:'} ${payload.location}\n` : ''}
${payload.eventDescription ? `${isTr ? 'Notlar:' : 'Notes:'} ${payload.eventDescription}\n` : ''}
${guestSectionText}
--------------------------------------------------
${isTr ? 'Destek:' : 'Support:'} ${supportEmail}
${APP_CONFIG.name} - Nostr NIP-52 Calendar System
`;

  return { subject, html, text };
}

/**
 * Dispatches a booking confirmation email via Resend if enabled.
 */
export async function sendBookingConfirmationEmail(
  payload: BookingConfirmationPayload,
  env: EmailEnv
): Promise<EmailDispatchResult> {
  const isEnabled = env.ENABLE_EMAIL_NOTIFICATIONS?.toLowerCase() === 'true';

  if (!isEnabled) {
    return {
      success: true,
      skipped: true,
      reason: 'Email notifications are disabled via configuration (ENABLE_EMAIL_NOTIFICATIONS="false").',
    };
  }

  if (!env.RESEND_API_KEY) {
    return {
      success: true,
      skipped: true,
      reason: 'RESEND_API_KEY is not set.',
    };
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { subject, html, text } = generateEmailTemplates(payload);

    // Convert ICS text content to base64 for email attachment
    const icsBase64 = typeof Buffer !== 'undefined'
      ? Buffer.from(payload.icsContent, 'utf-8').toString('base64')
      : btoa(unescape(encodeURIComponent(payload.icsContent)));

    const fromAddress = env.SUPPORT_EMAIL
      ? `cal.emre.xyz <${env.SUPPORT_EMAIL}>`
      : `cal.emre.xyz <${APP_CONFIG.supportEmail}>`;

    const adminEmail = (
      env.ADMIN_EMAIL ||
      env.SUPPORT_EMAIL ||
      APP_CONFIG.adminEmail ||
      APP_CONFIG.supportEmail ||
      'z@emre.xyz'
    ).trim();

    const bccList: string[] = [];
    if (adminEmail && adminEmail.toLowerCase() !== payload.to.toLowerCase()) {
      bccList.push(adminEmail);
    }

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [payload.to],
      bcc: bccList.length > 0 ? bccList : undefined,
      replyTo: [payload.to],
      subject,
      html,
      text,
      attachments: [
        {
          filename: 'invite.ics',
          content: icsBase64,
        },
      ],
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Hono router for email endpoints.
 */
export const emailRouter = new Hono<{ Bindings: EmailEnv }>();

async function handleBookingConfirmation(c: any) {
  try {
    const body = await c.req.json();
    const validation = validateBookingPayload(body);

    if (!validation.valid || !validation.data) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const result = await sendBookingConfirmationEmail(validation.data, c.env);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 500);
    }

    return c.json({
      success: true,
      messageId: result.messageId,
      skipped: result.skipped,
      reason: result.reason,
    });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Invalid JSON request body',
      },
      400
    );
  }
}

emailRouter.post('/booking-confirmation', handleBookingConfirmation);
emailRouter.post('/', handleBookingConfirmation);
