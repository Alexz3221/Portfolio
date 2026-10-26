# alex / stuff

A small static home for projects, experiments, and notes.

## Routes

- `/` — a hello and a short project list
- `/drive/` — the playable Three.js driving experiment
- `/projects/local-ai/` — the local creative tools
- `/lab/` — the separate interpretability project
- `/blog/` — notes and story scraps

The local tool links point to the visitor's own `127.0.0.1`. No model or GPU endpoint is exposed by GitHub Pages.

## Write a blog post

1. Add `blog/posts/your-slug.md`. Plain paragraphs, `##` headings, `-` lists, `>` quotes, and Markdown links are supported.
2. Add its slug, title, date, and short description to `blog/posts.json` (newest first).
3. Commit to `main`; the Pages workflow publishes it.

## Run locally

From the repository root:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/`.
