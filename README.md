# Rose DNA

Rose DNA turns paired FASTQ reads into a timed musical sequence and an
interactive Three.js rose. Its Visual Layers control can independently show a
full-scene Stepwise base/complement background and a lower-third Strudel
visualization. MP4 exports reproduce whichever visual layers were enabled when
the export began.

## Development

Node 20.19 or newer is required.

```sh
npm install
npm test
npm run lint
npm run build
```

## License and source availability

Rose DNA is free software licensed under
[AGPL-3.0-or-later](./LICENSE). The complete corresponding source is this
repository, including the browser-side visualization and export integration.
If you deploy a modified version over a network, provide its users access to
the corresponding modified source as required by the license.

Third-party components retain their own licenses; see
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Original Vite notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
