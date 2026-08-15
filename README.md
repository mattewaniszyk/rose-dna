# Rose DNA

Rose DNA turns paired FASTQ reads into a timed musical sequence and an
interactive Three.js rose. Its Visual Layers control can independently show a
full-scene Stepwise base/complement background and a lower-third Strudel
visualization. MP4 exports reproduce whichever visual layers were enabled when
the export began.

## FASTQ fixtures

The fixture menu includes the three paired examples from the Rieseberg Lab
`fastq-examples` repository and a 2,000-pair subset of the public
[`Rosa gallica` run ERR14041549](https://www.ebi.ac.uk/ena/browser/view/ERR14041549).
The ERR14041549 subset is stored in `public/data` as separate, gzip-compressed
R1 and R2 files so the browser does not have to download and buffer the linked
3.7 GB interleaved FASTQ.

To recreate a compact pair from an interleaved FASTQ whose consecutive records
are R1 then R2:

```sh
npm run sample:interleaved-fastq -- \
  ERR14041549.fastq 2000 \
  public/data/ERR14041549_R1.sample.fastq.gz \
  public/data/ERR14041549_R2.sample.fastq.gz
```

This step both selects the requested number of complete pairs and compresses
the outputs. Compression alone would reduce transfer size, but would not make
the full run appropriate for the app's current whole-file browser parser.

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
