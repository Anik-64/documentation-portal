# Interactive Documentation Portal

A modern, responsive web application for managing and displaying documentation with built-in rich text editing.

## Features

- Clean, SEO-friendly URLs (`/docs/your-section-slug`)
- Sidebar tree navigation with nested sections
- Real-time rich text editing using Quill.js
- Dynamic content loading from Google Cloud Storage
- Shareable direct links to individual sections
- In-memory caching for fast navigation
- Floating toast notifications
- Attractive UI with Tailwind CSS

## Tech Stack

- **Frontend**: HTML, Tailwind CSS, Quill.js (rich text editor)
- **Backend**: Node.js + Express + EJS (server-side rendering for SEO)
- **Database**: PostgreSQL
- **Storage**: Google Cloud Storage (for HTML content files)

## How It Works

1. **Public View**  
   Each section has its own clean URL (e.g., `/docs/api-authentication`)  
   Server renders the full page with content, title, meta description & keywords (great for SEO & sharing)

2. **Navigation**  
   Client-side JavaScript handles section switching (no full reload)  
   Updates browser URL with clean slug  
   Caches section list in memory for fast clicks

3. **Content Storage**  
   Rich text content is saved as HTML files in Google Cloud Storage  
   Each section has a unique public URL fetched on demand

## Docker Support

This project includes a `Dockerfile` for easy containerization.

### Pull the Image

```bash
docker pull beekeeper27/docportal:v1
```

### Run the Container

You must provide your environment variables using a `.env` file:    

```bash
docker run -d \
  --name docportal \
  -p 5000:5000 \
  --env-file /path/to/your/.env \
  beekeeper27/docportal:v1
```
Replace `/path/to/your/.env` with the actual path to your .env file on the host machine. The `.env.example` file in the repo shows all required keys (without values) so you can easily create your own `.env`.