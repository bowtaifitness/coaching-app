# Birdies by Bowtai - Development & Production Setup Guide

## Overview
This guide walks you through setting up and managing separate development and production environments for your app.

---

## Part 1: Initial Setup (Do This Once)

### Step 1: Get Your Dev Project Credentials

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your NEW dev project
3. Click on "Project Settings" (gear icon in sidebar)
4. Click "API" in the settings menu
5. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (looks like: `eyJhbGc...`)

### Step 2: Update .env.development File

1. Open `.env.development` in your project
2. Replace the placeholder values:
   ```
   VITE_SUPABASE_URL=https://your-dev-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your-dev-anon-key
   STRIPE_SECRET_KEY=sk_test_...your-stripe-test-key
   ```

### Step 3: Apply All Migrations to Dev Database

You have **101 migration files** that need to be applied to your dev database.

**Option A: Combine and Apply (Recommended)**

1. Create a single SQL file with all migrations:
   ```bash
   cat supabase/migrations/*.sql > combined_migrations.sql
   ```

2. Open your dev project in Supabase dashboard
3. Go to "SQL Editor"
4. Create a "New query"
5. Copy and paste the entire content of `combined_migrations.sql`
6. Click "Run"

**Option B: Apply One by One (More Control)**

1. Open your dev project's SQL Editor
2. Open each migration file in `supabase/migrations/` folder (starting with oldest date)
3. Copy the SQL content
4. Paste and run in SQL Editor
5. Repeat for all 101 files (yes, it's tedious but thorough)

### Step 4: Verify Dev Database

After applying migrations, verify your dev database has all tables:

1. In Supabase dashboard, go to "Table Editor"
2. You should see tables like:
   - profiles
   - clients
   - workouts
   - exercises
   - workout_programs
   - (and many more)

---

## Part 2: Daily Development Workflow

### Working in Development Mode

```bash
# This automatically uses .env.development
npm run dev
```

**What happens:**
- Vite automatically loads `.env.development`
- Connects to your dev Supabase project
- Uses Stripe test mode
- Safe to experiment and break things

### Making Database Changes

When you need to modify the database schema:

1. **Create Migration**: I'll create a new migration file in `supabase/migrations/`
2. **Test in Dev**: The migration applies to your dev database
3. **Verify**: Test thoroughly with dev data
4. **Document**: Keep track of which migrations are new

### Testing Features

- Create test user accounts in dev
- Use fake/test data
- Test Stripe payments with test credit cards
- Break things without worry

---

## Part 3: Deploying to Production

### Before Deploying

**Checklist:**
- [ ] All features tested thoroughly in dev
- [ ] No console errors in browser
- [ ] New migrations documented
- [ ] Stripe webhooks tested with test mode
- [ ] Edge functions tested in dev

### Step 1: Apply New Migrations to Production

1. Identify which migrations are NEW (created after initial dev setup)
2. Open production Supabase project dashboard
3. Go to SQL Editor
4. Run each NEW migration (copy SQL and run)
5. Verify tables/columns were created successfully

### Step 2: Deploy Edge Functions (if changed)

If you modified any edge functions in `supabase/functions/`:

1. I can deploy them to production using the MCP tools
2. Update environment variables if needed
3. Test webhooks with Stripe live mode

### Step 3: Build and Deploy Frontend

```bash
# Build production version
npm run build

# This creates the 'dist' folder with your production app
```

Then deploy the `dist` folder to your hosting provider.

### Step 4: Update Production Environment Variables

If deploying to a hosting service (Vercel, Netlify, etc.):

1. Add these environment variables in your hosting dashboard:
   ```
   VITE_SUPABASE_URL=https://auth.birdiesbybowtai.com
   VITE_SUPABASE_ANON_KEY=eyJhbG...your-production-anon-key
   STRIPE_SECRET_KEY=sk_live_...your-live-stripe-key
   ```

---

## Part 4: Environment Switching Reference

### File Structure
```
project/
├── .env                    # Keep for local dev (not committed)
├── .env.development        # Dev credentials (not committed)
├── .env.production         # Production credentials (not committed)
├── supabase/
│   ├── migrations/         # All migration files
│   └── functions/          # Edge functions
```

### When Working Locally

**Development:**
```bash
npm run dev
# Uses: .env.development
```

**Production Build:**
```bash
npm run build
# Uses: .env.production
```

### Which Environment Am I Using?

Look at the Supabase URL in your browser's Network tab:
- Dev: Your new dev project URL
- Production: `https://auth.birdiesbybowtai.com`

---

## Part 5: Best Practices

### Database Changes
- ✅ Always test in dev first
- ✅ Never modify production database directly
- ✅ Keep migrations organized by date
- ✅ Document breaking changes

### Data Safety
- ✅ Never use production credentials in dev
- ✅ Backup production before major changes
- ✅ Test destructive operations in dev only
- ✅ Use Stripe test mode in dev

### Code Changes
- ✅ Test all features in dev environment
- ✅ Build locally before deploying (`npm run build`)
- ✅ Check for console errors
- ✅ Verify environment variables are correct

---

## Part 6: Common Issues & Solutions

### "Can't connect to database"
- Check which .env file is being used
- Verify Supabase URL and anon key are correct
- Check if project is paused (free tier)

### "Migration failed"
- Migrations might be out of order
- A table/column might already exist
- Check SQL Editor for specific error message

### "Changes not showing up"
- Make sure you're looking at the right environment
- Clear browser cache
- Rebuild the app (`npm run build`)

### "Stripe webhook not working"
- Verify webhook URL points to correct environment
- Check webhook signing secret matches
- Use test mode webhooks in dev, live mode in production

---

## Need Help?

When you need to:
- Apply new migrations
- Deploy edge functions
- Troubleshoot environment issues
- Make database changes

Just let me know and I'll guide you through it!
