# alex / stuff

A small static home for projects and experiments.

## Routes

- `/` — a hello and a short project list
- `/drive/` — the playable Three.js driving experiment
- `/projects/local-ai/` — Adventure Studio and Image Studio
- `/lab/` — a steering interface sketch

The sliders in `/lab/` move a drawing. They do not run model inference. Adventure Studio and Image Studio run on a local Windows workstation; the public portfolio links to their project page rather than exposing the local models.

## Run locally

From the repository root:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/`.

## Next

Give the local Adventure Studio app a simple home screen, then build a separate Steering Lab using a hook-capable local text backend. The first functional experiment should compare baseline and steered responses with the same prompt and seed. Later work can add model-specific vectors and neurons, activation views, and saved settings.
