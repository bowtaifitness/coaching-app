# Bowtai Fitness

A personal training and fitness coaching platform that connects coaches with clients through custom workout programs, performance tracking, and real-time messaging.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Auth, Database, Edge Functions, Storage)
- **Payments:** Stripe (web checkout) + Apple In-App Purchases (iOS)
- **Mobile:** Capacitor (iOS)
- **Charts:** Chart.js + react-chartjs-2
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Clone the repository
2. Copy the environment template:
   ```bash
   cp .env.example .env.development
   ```
3. Fill in your Supabase and Stripe credentials in `.env.development`
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```

### Build

```bash
npm run build
npm run preview
```

### Mobile (iOS)

```bash
npm run mobile:sync   # Build web + sync to iOS project
npm run mobile:open   # Open in Xcode
```

## Project Structure

```
src/
├── components/
│   ├── Admin/          # Admin panels (invitations, trials, promotions)
│   ├── Auth/           # Login, signup, password reset
│   ├── Calendar/       # Calendar view
│   ├── Client/         # Client management, intake forms, detail views
│   ├── Dashboard/      # Coach + client dashboards
│   ├── Exercise/       # Exercise library CRUD
│   ├── Layout/         # Navbar, sidebar, bottom tabs
│   ├── Legal/          # Privacy policy
│   ├── Messages/       # Coach-client messaging
│   ├── Onboarding/     # Tutorial/onboarding flow
│   ├── Payments/       # Stripe + Apple IAP payment UI
│   ├── Performance/    # Performance metrics tracking + charts
│   ├── Profile/        # User profile management
│   ├── Promotions/     # Active promotion banners
│   ├── Subscription/   # Subscription gates
│   ├── Trial/          # Trial expiration notifications
│   └── Workout/        # Workout builder, templates, execution
├── contexts/           # React contexts (Auth, Workout, Video, Tutorial)
├── hooks/              # Custom hooks (SEO, network, trial, keyboard)
├── lib/                # Supabase client, Stripe, Capacitor shim, utils
├── types/              # TypeScript type definitions
└── utils/              # Program generator, progress tracking
```

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `VITE_GOOGLE_WEB_CLIENT_ID` | Google OAuth client ID |

## Phase 1 Feature Roadmap

- [x] **Exercise Library** — Full CRUD with video, categories, tags, movement patterns
- [x] **Workout Builder** — Coach creates templates, assigns to clients
- [x] **Workout Execution** — Client logs sets/reps/weight with timer
- [x] **Client Workout View** — Weekly/program views with completion tracking
- [ ] **Client Workout Logging** — Enhanced logging with notes and RPE
- [x] **Calendar Scheduling** — Workout calendar for coaches and clients
- [ ] **Copy/Paste Workouts** — Duplicate and reassign workouts easily
- [x] **Messaging** — Real-time coach-client messaging
- [x] **Exercise History & Progress Charts** — Performance metrics over time
- [x] **Client Management** — Add, assign, manage clients
- [x] **Auth & Payments** — Supabase auth + Stripe subscriptions
- [ ] **Enhanced Progress Charts** — More detailed gym metric visualizations

## License

Private — All rights reserved.
