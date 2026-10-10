import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const PRICE_ID = 'price_1U9rDz6BDMFSdYishzhgGvms';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const origin = (body.origin || 'https://icecreametissofun.base44.app').replace(/\/$/, '');

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('line_items[0][price]', PRICE_ID);
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', `${origin}/plus?plus=success`);
    params.set('cancel_url', `${origin}/plus?plus=cancel`);
    params.set('metadata[base44_app_id]', secrets.get('BASE44_APP_ID') || '');
    params.set('metadata[user_id]', user.id);
    params.set('metadata[username]', user.full_name || '');

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`,
        'Stripe-Version': '2025-10-29.clover',
        'Idempotency-Key': crypto.randomUUID(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const session = await sessionRes.json();
    if (!sessionRes.ok) {
      console.error('Stripe checkout error', session.error?.message);
      return Response.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
    }
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createPlusCheckout error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}