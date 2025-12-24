# ☕ Grounds

**Discover the Philippines' Best Cafes** — A community-driven platform for exploring the vibrant coffee culture across the Philippines.

---

## ✨ Features

- **Cafe Discovery** — Browse and discover cafes with ratings, reviews, and detailed information
- **Interactive Map** — Explore cafes on a Leaflet-powered map with your current location
- **Daily Featured Cafes** — Curated highlights that rotate daily
- **User Profiles** — Create an account, track visited cafes, and build your wishlist
- **Reviews & Ratings** — Share your cafe experiences with the community
- **Badges & Achievements** — Earn badges for your cafe adventures
- **Cafe Passport** — Track your favorites and wishlist
- **Admin Dashboard** — Moderate submissions, reviews, and manage content
- **Responsive Design** — Optimized for both mobile and desktop experiences

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) with App Router
- **Language:** TypeScript
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend:** [Supabase](https://supabase.com/) (SSR integration)
- **Maps:** [Leaflet](https://leafletjs.com/) + [React Leaflet](https://react-leaflet.js.org/)
- **Animations:** [Motion](https://motion.dev/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Email:** [Resend](https://resend.com/) + [React Email](https://react.email/)
- **Payments:** [Polar](https://polar.sh/) (supporter subscriptions)
- **Package Manager:** [Bun](https://bun.sh/)

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- Supabase project (for backend functionality)

### Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/AdrianBonpin/grounds-website.git
    cd grounds-website
    ```

2. **Install dependencies:**

    ```bash
    bun install
    ```

3. **Set up environment variables:**

    Create a `.env.local` file with your credentials:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    RESEND_API_KEY=your_resend_api_key
    POLAR_ACCESS_TOKEN=your_polar_access_token
    ```

4. **Run the development server:**

    ```bash
    bun dev
    ```

    The app will be available at `https://localhost:3000` (HTTPS enabled by default).

## 📜 Scripts

| Command              | Description                             |
| -------------------- | --------------------------------------- |
| `bun dev`            | Start development server with HTTPS     |
| `bun build`          | Build for production                    |
| `bun start`          | Start production server                 |
| `bun lint`           | Run ESLint                              |
| `bun merge`          | Merge dev branch to prod and push       |
| `bun supabase-types` | Generate TypeScript types from Supabase |

## 📁 Project Structure

```
grounds-website/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard
│   ├── api/                # API routes and server actions
│   ├── auth/               # Authentication pages
│   ├── cafes/              # Cafe directory and details
│   ├── contact/            # Contact page
│   ├── donate/             # Donation page
│   ├── map/                # Interactive map
│   ├── profile/            # User profiles
│   └── submit/             # Cafe submission
├── components/             # Reusable React components
├── emails/                 # React Email templates
├── hooks/                  # Custom React hooks
├── utils/                  # Utility functions and types
├── public/                 # Static assets
└── assets/                 # Project assets
```

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

This project is private. All rights reserved.

---

<p align="center">
  Made with ❤️ for the Philippine coffee community
</p>
