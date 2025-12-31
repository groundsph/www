# ☕ Grounds

**Discover the Philippines' Best Cafes** — A community-driven platform for exploring the vibrant coffee culture across the Philippines.

---

## ✨ Features

- **Cafe Discovery** — Browse and discover cafes with ratings, reviews, and detailed amenity information.
- **Interactive Map** — Explore cafes on a Leaflet-powered map with clustering and user location support.
- **User Accounts** — Profile management, visit history, wishlists, and custom checklists.
- **Authentication** — Secure login via Email/Password, Social Login (Google, Discord), and **Passkey** support.
- **Role-Based Access** — Dedicated portals for **Users**, **Cafe Owners**, **Writers**, and **Admins**.
- **Blog & Stories** — Rich content platform for coffee culture stories and news.
- **Community Events** — Discover and track cafe events and meetups.
- **Responsive Design** — Fully optimized for mobile and desktop experiences.
- **Dark Mode** — Sleek UI with support for system preferences.

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Database:** PostgreSQL
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication:** [Better Auth](https://better-auth.com/)
- **Maps:** [Leaflet](https://leafletjs.com/) + [React Leaflet](https://react-leaflet.js.org/)
- **AI:** Google Generative AI (Gemini) + Groq (Llama 3) for content generation.
- **Email:** [Resend](https://resend.com/) + [React Email](https://react.email/)
- **Storage:** S3-compatible Cloud Storage
- **Package Manager:** [Bun](https://bun.sh/)

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (Required)
- PostgreSQL Database (Local or Cloud)

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

    Create a `.env.local` file in the root directory and add the necessary credentials. You will need keys for:
    - Database Connection (`DATABASE_URL`)
    - Better Auth (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
    - Social Providers (Google, Discord)
    - Object Storage (S3/R2 credentials)
    - AI Providers (Gemini, Groq)
    - Resend (Email)

4. **Initialize the Database:**

    Push the schema to your PostgreSQL database:

    ```bash
    bun run db-push
    ```

5. **Run the development server:**

    ```bash
    bun dev
    ```

    The app will be available at `https://localhost:3000`.

## 📜 Scripts

| Command          | Description                         |
| ---------------- | ----------------------------------- |
| `bun dev`        | Start development server with HTTPS |
| `bun build`      | Build for production                |
| `bun start`      | Start production server             |
| `bun lint`       | Run ESLint                          |
| `bun db-push`    | Push schema changes to database     |
| `bun db-migrate` | Run database migrations             |

## 📁 Project Structure

```
grounds-website/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # Backend API & Server Actions
│   ├── auth/               # Auth pages
│   ├── cafes/              # Cafe directory & details
│   ├── dashboard/          # User dashboard
│   ├── manage/             # Admin portal
│   ├── map/                # Map view
│   ├── owner/              # Owner portal
│   └── writer/             # Writer portal
├── components/             # Reusable React components
├── db/                     # Drizzle schema & connection
├── drizzle/                # Database migrations
├── emails/                 # React Email templates
├── lib/                    # Configuration (Auth, Utils)
├── utils/                  # Shared utilities
└── public/                 # Static assets
```

## 🤝 Contributing

Contributions are welcome! Please ensure you use **Bun** for package management and follow the existing code style.

## 📄 License

This project is private. All rights reserved.

---

<p align="center">
  Made with ❤️ for the Philippine coffee community
</p>
