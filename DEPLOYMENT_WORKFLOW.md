# Development & Production Workflow

This guide explains how to work with separate development and production environments.

## Environment Setup

### Development Environment
- **Supabase Project**: `qzgduzlvaqbruekcttyi` (Dev)
- **Purpose**: Make changes, test features, experiment
- **Database**: Separate dev database with test data
- **Stripe**: Test mode keys
- **URL**: Run locally in Bolt

### Production Environment
- **Supabase Project**: `fwsibymwzxxafphpokdf` (Prod)
- **Purpose**: Live app for real users
- **Database**: Production database with real user data
- **Stripe**: Live mode keys
- **URL**: Deployed to hosting service

## Daily Workflow

### 1. Development (in Bolt)
Work in this Bolt project as your dev environment:
```bash
npm run dev
```
- Make changes to code
- Test features
- Update database schema via migrations
- Use test data and test Stripe keys

### 2. Testing Changes
Before deploying to production:
```bash
npm run build
```
- Ensure build completes without errors
- Test all features work correctly
- Verify database migrations are safe

### 3. Deploy to Production
When ready to push changes to live users:

**Option A: Using Vercel (Recommended)**
1. Connect this repo to Vercel
2. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL=https://fwsibymwzxxafphpokdf.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<prod-anon-key>`
3. Deploy automatically on push to main branch

**Option B: Using Netlify**
1. Connect this repo to Netlify
2. Set build command: `npm run build:prod`
3. Set environment variables in Netlify dashboard
4. Deploy automatically on push to main branch

**Option C: Manual Build & Upload**
1. Build for production: `npm run build:prod`
2. Upload `dist/` folder to your hosting provider
3. Ensure environment variables are set on the server

## Database Migration Workflow

### Development
1. Make schema changes in dev Supabase project
2. Test thoroughly with migrations
3. Note all migration files created

### Production
When ready to apply to production:
1. Switch to production Supabase project in dashboard
2. Run the same migrations in production
3. Test the production app immediately after

## Environment Variables

### Local Development (.env)
```
VITE_SUPABASE_URL=https://auth.birdiesbybowtai.com
VITE_SUPABASE_ANON_KEY=<dev-key>
```

### Production Deployment
Set these in your hosting provider's dashboard:
```
VITE_SUPABASE_URL=https://fwsibymwzxxafphpokdf.supabase.co
VITE_SUPABASE_ANON_KEY=<prod-key>
STRIPE_SECRET_KEY=<live-stripe-key>
```

## Quick Reference

| Task | Command | Environment |
|------|---------|-------------|
| Develop locally | `npm run dev` | Dev |
| Build for testing | `npm run build` | Dev |
| Build for production | `npm run build:prod` | Prod |
| Preview production build | `npm run preview:prod` | Prod |

## Important Reminders

✅ **DO:**
- Always test in dev before deploying to prod
- Keep dev and prod databases in sync structurally
- Use test Stripe keys in dev
- Back up production database before major migrations

❌ **DON'T:**
- Never test experimental features directly in prod
- Don't use production API keys in dev
- Don't make database changes directly in prod without testing in dev first
- Don't commit `.env` files to git (they're in `.gitignore`)

## Recommended Hosting Providers

1. **Vercel** - Best for React apps, free tier available
2. **Netlify** - Easy setup, good free tier
3. **Cloudflare Pages** - Fast global CDN
4. **AWS Amplify** - If you need AWS integration

## Git Workflow (Recommended)

```bash
# Development
git checkout dev
# Make changes, test
git commit -m "Add new feature"
git push origin dev

# When ready for production
git checkout main
git merge dev
git push origin main  # Triggers auto-deploy to production
```

## Troubleshooting White Screen on Mobile

### Recent Fixes Applied:

1. **Error Boundary** - Catches React errors and displays friendly error screen
2. **Environment Variable Validation** - Shows error if env vars missing
3. **Global Error Handlers** - Catches unhandled errors
4. **Console Logging** - Added diagnostic logging
5. **SPA Routing** - Fixed routing configuration for all hosting platforms

### How to Debug on Mobile:

#### iOS Safari:
1. Connect iPhone to Mac
2. Open Safari on Mac → Develop → [Your iPhone] → [Your Website]
3. Check Console for errors

#### Android Chrome:
1. Connect Android to computer
2. Chrome → `chrome://inspect` → Click "inspect"
3. Check Console for errors

### Common Issues:

**White Screen After Login:**
- Check browser console for errors
- Verify environment variables are set in hosting platform
- Clear browser cache and reload
- Check if JavaScript is enabled

**Environment Variables Missing:**
- Hosting platform must have `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set
- Variables must be prefixed with `VITE_` for Vite to expose them
- Redeploy after adding environment variables

**SPA Routing Issues:**
- Ensure `netlify.toml`, `vercel.json`, or `_redirects` file is in dist folder
- Configure server to route all requests to index.html

## Need Help?

- Supabase Dashboard Dev: https://supabase.com/dashboard/project/qzgduzlvaqbruekcttyi
- Supabase Dashboard Prod: https://supabase.com/dashboard/project/fwsibymwzxxafphpokdf
- Stripe Dashboard: https://dashboard.stripe.com
