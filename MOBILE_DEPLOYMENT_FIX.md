# Mobile Deployment Fix

## Issue
The app wasn't loading on mobile devices after deployment.

## Root Causes
1. Missing SPA (Single Page Application) routing configuration
2. Missing icon files causing asset loading failures
3. Manifest.json referencing non-existent icons

## Fixes Applied

### 1. SPA Routing Configuration
Added routing configuration files for common hosting platforms:

- **Netlify**: `netlify.toml` - Redirects all routes to index.html
- **Vercel**: `vercel.json` - Rewrites all routes to index.html
- **Generic**: `public/_redirects` - Fallback redirect file

### 2. Removed Missing Asset References
- Removed icon references from HTML that don't exist
- Removed icon references from notification system
- Kept manifest.json but made icons optional

### 3. Production Build Command
Use this command for production deployment:
```bash
npm run build:prod
```

## Deployment Steps

### For Netlify
1. Run `npm run build:prod`
2. Deploy the `dist` folder
3. The `netlify.toml` will automatically configure routing

### For Vercel
1. Run `npm run build:prod`
2. Deploy the `dist` folder
3. The `vercel.json` will automatically configure routing

### For Other Hosts
1. Run `npm run build:prod`
2. Deploy the `dist` folder
3. Configure your server to:
   - Serve from the `dist` directory
   - Redirect all routes to `index.html` (SPA routing)
   - The `_redirects` file may work automatically

## Testing
After deploying:
1. Test on desktop browser
2. Test on mobile browser (iOS Safari, Android Chrome)
3. Test different routes directly (not just homepage)
4. Check browser console for any errors

## Environment Variables
Ensure your hosting platform has these variables set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY` (for Stripe functionality)

Note: Since the app uses Vite, environment variables must be prefixed with `VITE_` to be available in the browser.
