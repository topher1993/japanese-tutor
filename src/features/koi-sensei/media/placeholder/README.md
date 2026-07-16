# Koi Sensei engineering GLB

`koi-sensei-placeholder.glb` is a deterministic, non-production asset used to
develop and verify the final avatar contract. It includes the required root and
body nodes, four cosmetic sockets, six named animation clips, a low-poly koi
silhouette, and no external resources.

Regenerate it from the repository root with:

```powershell
node src/features/koi-sensei/media/placeholder/generatePlaceholderGlb.mjs
```

The production asset must remain a local bundled GLB, satisfy the budgets in
`avatarManifest.ts`, and replace the placeholder only after contract validation.

