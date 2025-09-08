# 🌩️ Gryt Documentation

This is the official documentation site for **Gryt**, a modern WebRTC-based voice chat platform. Built with [Fumadocs](https://github.com/fuma-nama/fumadocs) and Next.js.

## 🚀 Quick Start

Run the development server:

```bash
npm run dev
# or
bun dev
# or
pnpm dev
```

Open http://localhost:3000 with your browser to see the documentation.

## 📁 Project Structure

- `content/docs/`: All documentation content in MDX format
- `src/lib/source.ts`: Content source adapter for Fumadocs
- `src/lib/layout.shared.tsx`: Shared layout configuration with Gryt branding
- `src/app/docs/`: Documentation layout and pages
- `src/app/(home)/`: Landing page (redirects to /docs)
- `public/`: Static assets including Gryt favicon

## 🎨 Customization

The documentation is customized with Gryt's branding:

- **Colors**: Blue gradient theme matching Gryt's design
- **Typography**: Mulish font family for consistency
- **Logo**: Custom Gryt logo with gradient styling
- **Navigation**: GitHub and Discord links in header
- **Sidebar**: Gryt branding banner

## 📚 Content Management

Documentation is organized into sections:

- **Getting Started**: Quick start guides and deployment
- **Components**: Detailed documentation for each system component
- **Features**: In-depth feature explanations
- **Development**: Architecture and API reference
- **Support**: Troubleshooting and FAQ

## 🔧 Configuration

Key configuration files:

- `source.config.ts`: Fumadocs MDX configuration
- `package.json`: Project metadata and dependencies
- `tailwind.config.js`: Styling configuration (if needed)

## 📖 Learn More

- [Fumadocs Documentation](https://fumadocs.vercel.app) - Learn about Fumadocs
- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js
- [Gryt Project](https://github.com/sivert-io/WebSocket-Voice) - Main Gryt repository
