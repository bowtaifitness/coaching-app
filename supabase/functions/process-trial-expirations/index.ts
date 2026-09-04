import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing trial expirations...');

    const now = new Date().toISOString();

    const { data: expiredTrials, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, subscription_price_id, subscription_scheduled_at')
      .eq('role', 'client')
      .not('subscription_price_id', 'is', null)
      .not('subscription_scheduled_at', 'is', null)
      .lte('subscription_scheduled_at', now)
      .is('subscription_tier', null);

    if (fetchError) {
      console.error('Error fetching expired trials:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch expired trials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${expiredTrials?.length || 0} expired trials to process`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    if (!expiredTrials || expiredTrials.length === 0) {
      return new Response(JSON.stringify({ message: 'No expired trials to process', results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const profile of expiredTrials) {
      results.processed++;

      try {
        const { data: customer } = await supabase
          .from('stripe_customers')
          .select('customer_id')
          .eq('user_id', profile.id)
          .is('deleted_at', null)
          .maybeSingle();

        if (!customer || !customer.customer_id) {
          throw new Error('No Stripe customer found for user');
        }

        const stripeCustomer = await stripe.customers.retrieve(customer.customer_id);

        if (stripeCustomer.deleted) {
          throw new Error('Stripe customer has been deleted');
        }

        const paymentMethods = await stripe.paymentMethods.list({
          customer: customer.customer_id,
          type: 'card',
        });

        if (paymentMethods.data.length === 0) {
          throw new Error('No payment method on file');
        }

        const subscription = await stripe.subscriptions.create({
          customer: customer.customer_id,
          items: [{ price: profile.subscription_price_id }],
          default_payment_method: paymentMethods.data[0].id,
          metadata: {
            userId: profile.id,
            autoCreated: 'true',
            createdAt: new Date().toISOString(),
          },
        });

        console.log(`Created subscription ${subscription.id} for user ${profile.id}`);

        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'basic',
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (updateProfileError) {
          console.error(`Failed to update profile for user ${profile.id}:`, updateProfileError);
        }

        const { error: updateSubscriptionError } = await supabase
          .from('stripe_subscriptions')
          .update({
            subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('customer_id', customer.customer_id);

        if (updateSubscriptionError) {
          console.error(`Failed to update subscription record:`, updateSubscriptionError);
        }

        results.succeeded++;
      } catch (error: any) {
        console.error(`Failed to process user ${profile.id}:`, error.message);
        results.failed++;
        results.errors.push({
          userId: profile.id,
          error: error.message,
        });
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({
        message: 'Trial expirations processed',
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Process trial expirations error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
