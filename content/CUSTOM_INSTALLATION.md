# Custom installation

The Atelier project page on the Dorios Studios website offers a custom download after the official download links. Players can select each material family independently, then choose its finishes, shapes and colors. Tool categories can also be selected independently. Everything is selected initially. The page remembers the selection for the current source fingerprint and can save and load a selection JSON file.

The result is one `.mcaddon` containing the selected behavior and resource packs. For example, all Andesite finishes and shapes can be combined with full Concrete blocks only. Minecraft's existing vanilla blocks remain available regardless of the selection.

## Compiler

Install the project's dependencies with `npm ci`. Generate the website resources with:

```sh
npm run builder:prepare -- --out /path/to/website/static/atelier-builder
```

The output contains a catalog, a versioned source ZIP, a standalone browser worker and the compression library's license. The website runs the compiler in that worker when a visitor requests a download. No server-side build or GitHub token is needed by visitors. The source archive is loaded only when building a package.

To compile a saved selection directly:

```sh
node tools/build-custom-package.mjs --selection Atelier-selection.json --out Atelier-Custom.mcaddon
```

`tools/package-builder/catalog.mjs` derives the choices from the BP definitions, the stone-family catalog, the active color palette and the existing translations. New, unclassified materials fail with an explicit family-assignment error rather than silently disappearing. `selection.mjs` handles selection and `compiler.mjs` builds the package; neither imports Minecraft's runtime API.

The compiler retains selected definitions, finds finite crafting paths from vanilla ingredients and includes necessary custom ingredients automatically. It excludes recipes whose inputs or outputs are absent, filters creative groups and their icons, trims block/item atlases and textures, rebuilds the texture list, and keeps the scripts imported by the selected tools. The chisel's cycles and aliases are filtered to the installed custom blocks. A blocks-only package omits the script module and API dependencies. Other shared resource definitions can remain in the resource pack.

The generated BP includes `atelier_selection.json`, recording the source version, selection and automatically included definitions. The completion panel also lists those automatic additions.

## Source and replacement

The website's `prepare-atelier-builder.mjs` accepts `ATELIER_PROJECT_PATH` and otherwise looks for the local sibling checkout. Its deployment workflow checks out `DoriosStudios/Dorios-Atelier` at `main` and prepares the resources during the website build. The builder displays the source pack version and Minecraft requirement; the official project card can describe a different published release. The fingerprint ties the catalog, compiler and archive together, and an outdated open page requests a reload instead of combining versions.

Custom downloads preserve the source pack UUIDs, versions, namespace and block identifiers. They replace the full Atelier installation. Minecraft may require removing the previously imported pack from storage before accepting another selection with the same version. Activate only the selected installation, and back up existing worlds before omitting content already placed in them.

Generated website resources and example packages belong in ignored output directories, not in source control. Publish the Atelier compiler changes before deploying a website revision that depends on them.
