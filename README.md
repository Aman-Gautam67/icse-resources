# ICSE & ISC Resources — Open Educational Portal

[![Astro](https://img.shields.io/badge/Astro-5.x-orange.svg)](https://astro.build/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38B2AC.svg)](https://tailwindcss.com/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Edge-F38020.svg)](https://pages.cloudflare.com/)

A lightning-fast, open educational web portal providing comprehensive and organized **study resources** for **ICSE Class 10** students. The platform curates over **6,100+ educational files** across 11 core academic subjects—including chapter revision notes, textbook solutions, council specimen papers, and an extensive repository of school prelim papers.

<div align="center">
  <a href="https://class10icse.pages.dev/">Live Website</a> &nbsp;|&nbsp;
  <a href="#features">Features</a> &nbsp;|&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;|&nbsp;
  <a href="#tech-stack">Tech Stack</a> &nbsp;|&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;|&nbsp;
  <a href="#testing">Testing</a> &nbsp;|&nbsp;
  <a href="#credits">Credits</a>
</div>

---

## Features

- **Hierarchical Resource Library**: Browse study materials preserved in their original nested folder structure (subjects, chapters, acts/scenes, and year/school-wise preliminary papers). Folders are closed by default for clean and focused navigation.
- **Categorized Featured Books**: Specialized section divided into:
  - **Notes**: Physics Wallah (PW) Endgame series.
  - **Sample Papers & Question Banks**: Curated reference workbooks and practice sets.
- **Spotlight Search (`Ctrl+K` / `Cmd+K`)**: Fast, client-side fuzzy search across all 6,100+ files powered by Fuse.js with instant keyboard navigation.
- **Smart Single-Click Downloads with Failover**:
  - Unified download action that eliminates confusing server selection buttons.
  - Silent background trigger via hidden iframe (avoids popup blockers and prevents unwanted blank tabs).
  - Built-in failover modal that automatically downloads from Server 1 and seamlessly prompts the student to switch to Server 2 only if the primary source fails.
  - Conceals source server URLs to preserve site aesthetic and privacy.
- **First-Time Feature Tutorial & Registry**:
  - Interactive "What's New in v2.0" feature tour modal with animations and progress indicators.
  - Client-side persistent user registry (`localStorage`) so returning students are never interrupted.
  - Fully accessible controls (**Next**, **Skip**, **Get Started**) with tour replay support from the Info dialog.
- **Dual-Shard Internet Archive Mirrors**: Resilient redundancy with verified archive mirrors attached directly to the catalog data.
- **Zero-FOUC Dark/Light Mode**: Synchronous theme evaluation in the document head prevents flash of unstyled content across page transitions.
- **CISCE Official Directory**: Direct access to specimen question papers, updated syllabus regulations, and Analysis of Pupil Performance (APF) reports.
- **Interactive Educational Quizzes**: Embeds subject-wise quizzes to test concepts and verify exam readiness.

---

## Architecture

The project has been migrated from a single-page React application to **Astro SSG** utilizing the **Islands Architecture**:

- **Static Pre-rendering (`prerender = true`)**: Core routes (`/`, `/study-materials`, `/cisce`, `/about`, `/contact`, `/privacy`, `/quizzes`, `/404`) are pre-rendered into pure HTML at build time for maximum SEO performance, zero client bundle weight on initial paint, and instant Cloudflare Edge delivery.
- **Selective React Islands (`client:load` / `client:idle`)**: Highly interactive components (Search Modal, Resource Library, Download Modal, Tutorial Modal, Theme Toggle, App Modals) hydrate progressively on demand.
- **Dual Cloudflare Deployment**: Compatible with Cloudflare Pages static and SSR adapter bindings (`@astrojs/cloudflare`).

---

## Tech Stack

| Component | Technology |
|---|---|
| **Framework** | [Astro](https://astro.build/) (v5.x) |
| **UI Islands** | [React](https://reactjs.org/) (v18.3.1) with TypeScript |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) (v3.4.17) + CSS Keyframes |
| **Search Engine** | [Fuse.js](https://fusejs.io/) (v7.2.0) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Edge Deployment** | [Cloudflare Pages](https://pages.cloudflare.com/) (`@astrojs/cloudflare`) |
| **Validation** | [Zod](https://zod.dev/) (v3.25.76) |
| **Testing** | Node.js Test Runner + JSDOM + Vitest |

---

## Getting Started

### Prerequisites
- Node.js 18.x or later
- npm 9.x or later

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Jivaansh-Yadav/icse-resources.git
   cd icse-resources
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:4321` in your browser.

4. **Build for production**:
   ```bash
   npm run build
   ```
   Compiles static assets into the `dist/` directory.

5. **Preview production build locally**:
   ```bash
   npm run preview
   ```

---

## Testing

The repository maintains an extensive test suite across 4 verification tiers:

```bash
# Run comprehensive E2E test suite (127 tests across 24 suites)
npm test

# Run interactive React islands contract suite (41 tests)
node tests/islands.test.mjs

# Run tutorial modal & user registry tests (3 tests)
node tests/tutorial-user-registry.test.mjs

# Run resource catalog schema checks
node --test tests/resource-catalog.test.mjs

# Run layout & zero-FOUC theme hydration tests
node tests/m2_layout_theme.test.mjs
```

---

## Credits

- **Curator & Developer**: **Jivaansh Yadav** ([jivaanshyadav@gmail.com](mailto:jivaanshyadav@gmail.com))
- **Co-developer**: **Aman Gautam** ([a10687959@gmail.com](mailto:a10687959@gmail.com))

Maintained as a free, open-source educational initiative for ICSE students.
