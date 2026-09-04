import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check for required environment variables first
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!stripeSecretKey) {
      console.error('Missing STRIPE_SECRET_KEY environment variable')
      return new Response(
        JSON.stringify({ error: 'Stripe configuration missing - STRIPE_SECRET_KEY not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    console.log('Processing action:', action)

    const stripeHeaders = {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    switch (action) {
      case 'products': {
        // Fetch products and prices
        console.log('Fetching Stripe products...')
        const productsResponse = await fetch('https://api.stripe.com/v1/products?active=true&expand[]=data.default_price', {
          headers: stripeHeaders,
        })
        const products = await productsResponse.json()

        if (!productsResponse.ok) {
          console.error('Stripe products API error:', products)
          throw new Error(`Stripe API error: ${products.error?.message || 'Unknown error'}`)
        }

        return new Response(
          JSON.stringify(products),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'customers': {
        // Fetch customers (for coach view)
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'coach') {
          return new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Fetching Stripe customers...')
        const customersResponse = await fetch('https://api.stripe.com/v1/customers?limit=100', {
          headers: stripeHeaders,
        })
        const customers = await customersResponse.json()

        if (!customersResponse.ok) {
          console.error('Stripe customers API error:', customers)
          throw new Error(`Stripe API error: ${customers.error?.message || 'Unknown error'}`)
        }

        return new Response(
          JSON.stringify(customers),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'subscriptions': {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role, stripe_customer_id')
          .eq('id', user.id)
          .single()

        let subscriptionsUrl = 'https://api.stripe.com/v1/subscriptions?status=active&limit=100'

        // Clients may ONLY see their own subscriptions. If no Stripe customer
        // is linked, return an empty list instead of leaking everyone's data.
        if (profile?.role === 'client') {
          if (!profile?.stripe_customer_id) {
            return new Response(
              JSON.stringify({ data: [], has_more: false }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          subscriptionsUrl += `&customer=${profile.stripe_customer_id}`
        }

        console.log('Fetching Stripe subscriptions from:', subscriptionsUrl)
        const subscriptionsResponse = await fetch(subscriptionsUrl, {
          headers: stripeHeaders,
        })
        const subscriptions = await subscriptionsResponse.json()

        if (!subscriptionsResponse.ok) {
          console.error('Stripe subscriptions API error:', subscriptions)
          throw new Error(`Stripe API error: ${subscriptions.error?.message || 'Unknown error'}`)
        }

        return new Response(
          JSON.stringify(subscriptions),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'payments': {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role, stripe_customer_id')
          .eq('id', user.id)
          .single()

        let paymentsUrl = 'https://api.stripe.com/v1/payment_intents?limit=100'

        // Clients may ONLY see their own payments. If no Stripe customer is
        // linked, return an empty list instead of leaking everyone's data.
        if (profile?.role === 'client') {
          if (!profile?.stripe_customer_id) {
            return new Response(
              JSON.stringify({ data: [], has_more: false }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          paymentsUrl += `&customer=${profile.stripe_customer_id}`
        }

        console.log('Fetching Stripe payments from:', paymentsUrl)
        const paymentsResponse = await fetch(paymentsUrl, {
          headers: stripeHeaders,
        })
        const payments = await paymentsResponse.json()

        if (!paymentsResponse.ok) {
          console.error('Stripe payments API error:', payments)
          throw new Error(`Stripe API error: ${payments.error?.message || 'Unknown error'}`)
        }

        return new Response(
          JSON.stringify(payments),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'revenue': {
        // Coach-only revenue data
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'coach') {
          return new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get current month revenue
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

        console.log('Fetching current month revenue...')
        const currentMonthRevenue = await fetch(`https://api.stripe.com/v1/charges?created[gte]=${Math.floor(startOfMonth.getTime() / 1000)}&limit=100`, {
          headers: stripeHeaders,
        })
        const currentCharges = await currentMonthRevenue.json()

        if (!currentMonthRevenue.ok) {
          console.error('Stripe current month charges API error:', currentCharges)
          throw new Error(`Stripe API error: ${currentCharges.error?.message || 'Unknown error'}`)
        }

        console.log('Fetching last month revenue...')
        const lastMonthRevenue = await fetch(`https://api.stripe.com/v1/charges?created[gte]=${Math.floor(startOfLastMonth.getTime() / 1000)}&created[lte]=${Math.floor(endOfLastMonth.getTime() / 1000)}&limit=100`, {
          headers: stripeHeaders,
        })
        const lastMonthCharges = await lastMonthRevenue.json()

        if (!lastMonthRevenue.ok) {
          console.error('Stripe last month charges API error:', lastMonthCharges)
          throw new Error(`Stripe API error: ${lastMonthCharges.error?.message || 'Unknown error'}`)
        }

        const thisMonth = currentCharges.data?.reduce((sum: number, charge: any) => sum + (charge.amount_received || 0), 0) / 100 || 0
        const lastMonth = lastMonthCharges.data?.reduce((sum: number, charge: any) => sum + (charge.amount_received || 0), 0) / 100 || 0
        const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0

        return new Response(
          JSON.stringify({
            thisMonth,
            lastMonth,
            growth,
            currentCharges: currentCharges.data || [],
            lastMonthCharges: lastMonthCharges.data || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Stripe API Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})