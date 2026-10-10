import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const PLUS_BADGE_ID = '6a8a50a35d48898fb1742efa';

async function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const sig = parts.find(p => p.startsWith('v1='))?.slice(3);
  if (!timestamp || !sig) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expected === sig;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature');
    const secret = secrets.get('STRIPE_WEBHOOK_SECRET');
    if (!secret || !(await verifyStripeSignature(payload, signature, secret))) {
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }
    const event = JSON.parse(payload);
    if (event.type !== 'checkout.session.completed') {
      return Response.json({ received: true });
    }
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    if (!userId) {
      console.error('stripeWebhook: no user_id in metadata');
      return Response.json({ error: 'No user_id' }, { status: 400 });
    }

    const profiles = await base44.asServiceRole.entities.PlayerProfile.filter({ user_id: userId });
    if (profiles.length === 0) {
      console.error('stripeWebhook: no profile for user', userId);
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    await base44.asServiceRole.entities.PlayerProfile.update(profile.id, { plus_permanent: true, plus_until: '9999-12-31T23:59:59Z' });

    const existing = await base44.asServiceRole.entities.PlayerBadge.filter({ user_id: userId, badge_id: PLUS_BADGE_ID });
    if (existing.length === 0) {
      await base44.asServiceRole.entities.PlayerBadge.create({ user_id: userId, badge_id: PLUS_BADGE_ID });
    }

    return Response.json({ received: true, granted: true });
  } catch (error) {
    console.error('stripeWebhook error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}