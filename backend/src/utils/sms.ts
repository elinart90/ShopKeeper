const SMS_API_KEY = process.env.SMS_ONLINE_GH_API_KEY!;
const SMS_SENDER = process.env.SMS_SENDER_ID || 'ShopKeeper';

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('0')) return '233' + cleaned.slice(1);
  return cleaned;
}

function isValidPhone(phone: string): boolean {
  return /^\d{9,15}$/.test(phone);
}

export async function sendSms(phone: string, message: string) {
  const normalized = normalizePhone(phone);

  if (!isValidPhone(normalized)) {
    throw new Error(`Invalid phone number: ${phone}`);
  }

  const response = await fetch('https://api.smsonlinegh.com/v5/message/sms/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `key ${SMS_API_KEY}`,
    },
    body: JSON.stringify({
      text: message,
      type: 0,
      sender: SMS_SENDER,
      destinations: [normalized],
    }),
  });

  const data = await response.json() as any;
  console.log('[SMS] Response:', JSON.stringify(data));

  const success =
    response.ok &&
    data?.handshake?.id === 0 &&
    data?.handshake?.label === 'HSHK_OK';

  if (!success) {
    throw new Error(`SMS failed: ${JSON.stringify(data?.handshake)}`);
  }

  return data;
}