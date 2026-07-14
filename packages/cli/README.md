# @democraft/cli

Minimal CLI for inspecting, statically validating, and capturing compiled demos.

```bash
democraft inspect ./demos/create-project/demo.js
democraft targets ./demos/create-project/demo.js --json
democraft validate ./demos/create-project/demo.js --static --json
democraft capture ./demos/create-project/demo.js --output-dir .democraft/runs/create-project
democraft timeline ./demos/create-project/demo.js --manifest .democraft/runs/create-project/manifest.json --output-file .democraft/timelines/create-project.landscape.json
democraft preview --manifest .democraft/runs/create-project/manifest.json --timeline .democraft/timelines/create-project.landscape.json --output-file .democraft/previews/create-project.html
democraft render --manifest .democraft/runs/create-project/manifest.json --timeline .democraft/timelines/create-project.landscape.json --output-file .democraft/renders/create-project.mp4
```

When running TypeScript demo files directly during development, invoke the CLI source with `tsx`.
