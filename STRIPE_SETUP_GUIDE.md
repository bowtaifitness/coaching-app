# Stripe Configuration Guide for Birdies by Bowtai

## Step 1: Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/register)
2. Sign up for a new account or log into existing account
3. Complete account verification if required

## Step 2: Get Your API Keys

1. Go to [API Keys](https://dashboard.stripe.com/apikeys) in your Stripe Dashboard
2. Copy your **Publishable key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)

## Step 3: Create Products and Prices

### Basic Coaching Package
1. Go to [Products](https://dashboard.stripe.com/products) in Stripe Dashboard
2. Click "Add product"
3. Fill in:
   - **Name**: Basic Coaching
   - **Description**: Perfect for getting started with professional golf coaching
   - **Pricing model**: Recurring
   - **Price**: $99.00
   - **Billing period**: Monthly
4. Click "Save product"
5. **Copy the Price ID** (starts with `price_`) - you'll need this!

### Premium Coaching Package
1. Click "Add product" again
2. Fill in:
   - **Name**: Premium Coaching
   - **Description**: Comprehensive coaching with personalized attention
   - **Pricing model**: Recurring
   - **Price**: $199.00
   - **Billing period**: Monthly
3. Click "Save product"
4. **Copy the Price ID** (starts with `price_`) - you'll need this!

### Elite Coaching Package
1. Click "Add product" again
2. Fill in:
   - **Name**: Elite Coaching
   - **Description**: Premium one-on-one coaching for serious golfers
   - **Pricing model**: Recurring
   - **Price**: $399.00
   - **Billing period**: Monthly
3. Click "Save product"
4. **Copy the Price ID** (starts with `price_`) - you'll need this!

## Step 4: Set Up Webhook Endpoint

1. Go to [Webhooks](https://dashboard.stripe.com/webhooks) in Stripe Dashboard
2. Click "Add endpoint"
3. **Endpoint URL**: `https://bowtaifitness-golf-t-291z.bolt.host/functions/v1/stripe-webhooks`
4. **Events to send**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. **Copy the Webhook Secret** (starts with `whsec_`) - you'll need this!

## Step 5: Update Your Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Step 6: Update Price IDs in Code

After creating your products, update the price IDs in `src/lib/stripe.ts`:

```typescript
export const STRIPE_PRODUCTS = {
  BASIC_COACHING: {
    // ... other properties
    priceId: 'price_YOUR_BASIC_PRICE_ID_HERE',
  },
  PREMIUM_COACHING: {
    // ... other properties  
    priceId: 'price_YOUR_PREMIUM_PRICE_ID_HERE',
  },
  ELITE_COACHING: {
    // ... other properties
    priceId: 'price_YOUR_ELITE_PRICE_ID_HERE',
  }
};
```

## Step 7: Test Your Integration

### Test Mode (Recommended First)
1. Use test API keys (starting with `pk_test_` and `sk_test_`)
2. Use test card numbers:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - **Requires 3D Secure**: `4000 0025 0000 3155`
3. Use any future expiry date and any 3-digit CVC

### Live Mode (After Testing)
1. Switch to live API keys (starting with `pk_live_` and `sk_live_`)
2. Update webhook endpoint to use live mode
3. Test with real payment methods

## Step 8: Verify Everything Works

1. **Checkout Flow**: Try subscribing to each package
2. **Customer Portal**: Test managing subscriptions
3. **Webhooks**: Check webhook logs in Stripe Dashboard
4. **Database Updates**: Verify subscription status updates in your profiles table

## Important Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Test thoroughly in test mode before going live
- Monitor webhook delivery in Stripe Dashboard

## Troubleshooting

### Common Issues:
1. **"Stripe not configured"** - Check environment variables are set correctly
2. **Webhook failures** - Verify endpoint URL and selected events
3. **Payment failures** - Check Stripe Dashboard logs for details
4. **Database not updating** - Check webhook secret and RLS policies

### Support Resources:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Test Card Numbers](https://stripe.com/docs/testing#cards)

---

**Next Steps**: Follow this guide step by step, and your Stripe integration will be fully functional!