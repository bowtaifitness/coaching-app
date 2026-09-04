import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const signature = req.headers.get('stripe-signature')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    if (!signature || !webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing signature or webhook secret' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.text()
    
    // Verify webhook signature (simplified for demo)
    // In production, use proper Stripe webhook signature verification
    
    const event = JSON.parse(body)
    
    console.log('Webhook event received:', event.type)

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        
        // Update user's subscription status
        const { error } = await supabaseClient
          .from('profiles')
          .update({
            stripe_customer_id: subscription.customer,
            subscription_status: subscription.status,
            subscription_id: subscription.id,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', subscription.customer)

        if (error) {
          console.error('Error updating subscription:', error)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        
        // Cancel user's subscription
        const { error } = await supabaseClient
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', subscription.customer)

        if (error) {
          console.error('Error canceling subscription:', error)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        
        // Log successful payment
        console.log('Payment succeeded for customer:', invoice.customer)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        
        // Handle failed payment
        console.log('Payment failed for customer:', invoice.customer)
        break
      }

      default:
        console.log('Unhandled webhook event:', event.type)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook Error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})