# Azarraga Glass & Aluminum Supply - Estimation & Management App

Official web application and estimation system for **Azarraga Glass & Aluminum Supply**, providing glass and aluminum product configuration, cost estimation, quotation generation, and catalog management.

---

## 🛠 Tech Stack

### Core Framework & Runtime
- **Next.js 16 (App Router)** & **React 19**
- **TypeScript** (Strict mode)
- **Vinext** & **Vite 8**
- **Cloudflare Workers & Pages runtime**

### UI & Styling
- **Tailwind CSS v4**
- **Radix UI** & **shadcn/ui** components
- **Lucide Icons** (`lucide-react`)
- **Sonner** (Toast notifications)
- **Recharts** (Reporting and analytics)

### Database & Storage
- **Cloudflare D1** (Serverless SQLite)
- **Drizzle ORM** & **Drizzle Kit** (Type-safe schema definitions and SQL migrations)
- **Cloudflare R2** (Object storage for product images and logos)

---

## 📁 Code Tree

```text
azarraga-app-official/
├── app/
│   ├── api/                      # REST API endpoints
│   │   ├── admin/
│   │   │   ├── overview/         # Dashboard statistics & analytics
│   │   │   └── settings/         # Company profile & logo management
│   │   ├── attributes/           # Aluminum series, glass types, finishes, lock types
│   │   ├── catalog/              # Public & operational product catalog query
│   │   ├── categories/           # Product categories (Windows, Doors, Custom, etc.)
│   │   ├── products/             # Product specifications, base pricing & images
│   │   └── quotations/           # Quotation creation and history
│   ├── globals.css               # Global theme and styling
│   ├── layout.tsx                # Root layout definition
│   └── page.tsx                  # Interactive estimator, catalog browser & quote engine
├── components/
│   ├── ui/                       # Reusable shadcn/ui component library
│   └── admin-dashboard.tsx       # Administrative control center
├── db/
│   ├── index.ts                  # Cloudflare D1 database client initialization
│   └── schema.ts                 # Drizzle ORM relational schema definitions
├── drizzle/                      # Drizzle SQL migration files and schema snapshots
│   ├── 0000_late_whistler.sql
│   ├── 0001_abnormal_blink.sql
│   └── meta/
├── hooks/
│   └── use-mobile.ts             # Responsive viewport detection hook
├── lib/
│   ├── catalog-db.ts             # Database queries & initial catalog seed data
│   ├── catalog-types.ts          # Core domain models and TypeScript interfaces
│   └── utils.ts                  # Classnames and utility helper functions
├── public/                       # Static assets and reference diagrams
├── scripts/                      # Environment and build scripts
├── cloudflare-env.d.ts           # Cloudflare Worker environment typings (D1, R2)
├── drizzle.config.ts             # Drizzle Kit configuration
├── package.json                  # Package manifest and dependencies
├── tsconfig.json                 # TypeScript compiler configuration
└── vite.config.ts                # Vite & Vinext Cloudflare build configuration
```

---

## ✨ Features

- **Product Catalog**: Windows (sliding, awning, jalousie, fixed, folding), doors (bi-fold, sliding, casement, swing, roll-up, hanging), and custom glass & aluminum fabrications.
- **Dynamic Quotation Builder**: Real-time dimension calculations (sq. ft. / unit based), custom glass specifications, frame finishes, and lock hardware options.
- **Admin Dashboard**: Manage company details, product listings, pricing rules, categories, and attributes.
- **Edge Deployment**: Designed for fast, low-latency execution with Cloudflare D1 and R2 storage bindings.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `>=22.13.0`
- pnpm

### Development

```bash
# Install dependencies
npm run install:ci

# Start development server
npm run dev

# Generate Drizzle migrations
npm run db:generate

# Build for deployment
npm run build
```
