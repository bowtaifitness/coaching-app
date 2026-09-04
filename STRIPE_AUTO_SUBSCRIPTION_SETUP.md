# Stripe Auto-Subscription Setup Guide

This guide will help you configure automatic subscription enrollment after free trials.

## Step 1: Create Your Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Create your account
3. Complete the business verification process

## Step 2: Create the $19.99/month Subscription Product

1. Log into your Stripe Dashboard: https://dashboard.stripe.com
2. Click on **Products** in the left sidebar
3. Click **+ Add product** button
4. Fill in the product details:
   - **Name**: `Golf Strength Training Monthly Subscription`
   - **Description**: `Monthly subscription for personalized golf strength training programs`

5. Set up pricing:
   - **Pricing model**: Standard pricing
   - **Price**: `$19.99`
   - **Billing period**: `Monthly` (recurring every 1 month)
   - **Currency**: USD

6. Click **Save product**

7. **IMPORTANT**: After saving, you'll see your product page with a **Price ID**
   - It will look like: `price_1AB2CD3EF4GH5IJ6KL7MN8`
   - **Copy this entire Price ID** - you'll need it in the next step

## Step 3: Get Your Stripe API Keys

1. In your Stripe Dashboard, click on **Developers** in the left sidebar
2. Click on **API keys**
3. You'll see two keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`) - Click "Reveal test key" to see it

4. **Copy both keys** - you'll need them for the next step

## Step 4: Configure Your Environment Variables

1. Open your `.env` file in your project
2. Replace the placeholder values with your actual Stripe keys:

```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
VITE_STRIPE_GOLF_SUBSCRIPTION_PRICE_ID=price_YOUR_ACTUAL_PRICE_ID_HERE
```

3. Save the file

## Step 5: Add Stripe Webhook (for Production)

To process subscription events automatically, you need to set up a webhook:

1. In Stripe Dashboard, go to **Developers** > **Webhooks**
2. Click **+ Add endpoint**
3. Enter your endpoint URL:
   ```
   https://YOUR_SUPABASE_PROJECT_URL.supabase.co/functions/v1/stripe-webhook
   ```
   Replace `YOUR_SUPABASE_PROJECT_URL` with your actual Supabase project URL

4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

5. Click **Add endpoint**

6. After creating, click on the webhook to see its **Signing secret**
   - It starts with `whsec_`
   - Copy this and add it to your Supabase Edge Function secrets

## Step 6: Add Secrets to Supabase

You need to add your Stripe keys to Supabase so the Edge Functions can use them:

1. Go to your Supabase Dashboard
2. Select your project
3. Go to **Project Settings** > **Edge Functions**
4. Add these secrets:
   - `STRIPE_SECRET_KEY`: Your Stripe secret key (sk_test_... or sk_live_...)
   - `STRIPE_WEBHOOK_SECRET`: Your webhook signing secret (whsec_...)

## Step 7: Set Up Automated Trial Expiration Processing

The `process-trial-expirations` Edge Function needs to run daily to automatically subscribe users after their trial ends.

### Option A: Manual Trigger (for testing)
Call the function manually from your admin panel or via API:
```bash
curl -X POST https://YOUR_SUPABASE_PROJECT_URL.supabase.co/functions/v1/process-trial-expirations \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

### Option B: Set Up a Cron Job (recommended for production)
Use a service like:
- **Supabase Cron** (if available in your plan)
- **GitHub Actions** with scheduled workflows
- **Render** or **Railway** cron jobs
- **External cron service** like cron-job.org

Schedule it to run daily at a specific time (e.g., 2:00 AM):
```
0 2 * * * curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/process-trial-expirations
```

## Step 8: Test the Flow

1. Create a test account as a client
2. Check the "auto-subscribe" checkbox during signup
3. Add a test credit card (use Stripe test cards: https://stripe.com/docs/testing)
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
4. Wait for trial expiration or manually trigger the process-trial-expirations function
5. Verify subscription was created in Stripe Dashboard

## Switching to Live Mode

When you're ready to accept real payments:

1. **Complete Stripe account activation**
2. **Switch to Live keys** in your `.env`:
   - Change `pk_test_` to `pk_live_`
   - Change `sk_test_` to `sk_live_`
3. **Create the product again in Live mode** in Stripe (test and live are separate)
4. **Update the Price ID** to the live price ID
5. **Create a new webhook** for the live endpoint
6. **Update Supabase secrets** with live keys

## Troubleshooting

### Users not being subscribed after trial
- Check that `process-trial-expirations` is running regularly
- Verify `auto_subscribe_after_trial` is `true` in profiles table
- Check `subscription_scheduled_at` is set to the correct date
- Check logs in Supabase Edge Functions

### Payment method not saved
- Verify Stripe publishable key is correct in `.env`
- Check that payment method was added during signup
- Look for errors in browser console

### Subscription created but not showing in app
- Verify webhook is configured correctly
- Check webhook signing secret is correct
- Check Stripe webhook logs for errors

## Support

For Stripe issues: https://support.stripe.com
For Supabase issues: https://supabase.com/docs/support
