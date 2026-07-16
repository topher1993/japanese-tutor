# Application assets

Runtime assets are split between two locations:

- `src/assets/source/` contains reviewed source artwork grouped by purpose: adaptive icons, badges, illustrations, logos, mascots, splash art, and tab icons.
- top-level `assets/` contains the concrete PNG files referenced by `app.json`, including the v1 app icon, adaptive foreground/monochrome assets, favicon, and splash image.

`src/assets/manifest.ts` and `src/assets/assetRequireMap.ts` provide typed access for application screens. When adding an in-app asset, update the relevant map and its tests. Expo configuration assets are referenced directly from `app.json`.

Run the icon generator and its regression checks with:

```bash
node scripts/generate-icon-assets.mjs
node scripts/generate-icon-assets.mjs --check
```

Raw experimental generation output belongs under the ignored `src/assets/source/generated/` directory. Do not keep `_backup_*` copies beside reviewed assets; version control is the backup.
