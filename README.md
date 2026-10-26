# Alexz3221 portfolio

A static project hub published with GitHub Pages.

## Routes

- `/` — portfolio landing, featured projects, and steering interface preview
- `/drive/` — playable Three.js driving experiment
- `/projects/local-ai/` — overview of Adventure Studio and Image Studio

The steering controls on the public page are an **interface preview**. They update a diagram and do not run model inference. Adventure Studio and Image Studio run locally on a Windows workstation, so the public site describes them without claiming that visitors can access their models.

## Run locally

From the repository root:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/Portfolio/` only when serving from a parent directory named `Portfolio`; when serving from the repository root, open `http://localhost:8000/`.

## Next steps

1. Give the local Adventure Studio app a project-neutral home screen and navigation to Story, Image Studio, and a separate Steering Lab.
2. Build Steering Lab against a hook-capable local text backend, beginning with baseline and steered comparisons on the same prompt and seed.
3. Add model-specific vector and neuron interventions, activation readouts, saved experiment settings, and honest model availability states.
4. Add screenshots, source links, or downloadable builds to these project pages when they are ready to share.

The public portfolio stays static; local model inference stays on the workstation.
