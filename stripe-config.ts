export interface StripeProduct {
  name: string;
  productId: string;
  price: number;
  interval: string;
  priceId: string;
  mode: 'subscription' | 'payment';
  features: string[];
}

export const STRIPE_PRODUCTS = {
  FITNESS_MONTHLY: {
    name: 'Bowtai Fitness Monthly',
    productId: '', // TODO: Set up new Stripe product
    price: 19.99,
    interval: 'month',
    priceId: '', // TODO: Set up new Stripe price
    mode: 'subscription' as const,
    features: [
      'Personalized workout programs',
      'Performance tracking & analytics',
      'Full exercise library access',
      'Mobile app access',
      'Coach messaging'
    ]
  },
  FITNESS_ANNUAL: {
    name: 'Bowtai Fitness Annual',
    productId: '', // TODO: Set up new Stripe product
    price: 199.99,
    interval: 'year',
    priceId: '', // TODO: Set up new Stripe price
    mode: 'subscription' as const,
    features: [
      'Everything in Monthly plan',
      'Personalized workout programs',
      'Performance tracking & analytics',
      'Full exercise library access',
      'Mobile app access',
      'Coach messaging',
      'Save over $39 vs monthly'
    ]
  }
};
