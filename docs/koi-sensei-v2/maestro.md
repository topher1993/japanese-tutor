# Koi Sensei device smoke test

The checked-in `.maestro/koi-sensei-smoke.yaml` flow exercises a clean-device
onboarding, Home entry, the GLB avatar, age/consent gate, deterministic mock
chat, and grounded source display without contacting Firebase or MiniMax.

Run it against an installed development build:

```powershell
maestro test .maestro\koi-sensei-smoke.yaml
```

The flow targets Android application id `koi.sensei_personal123`. Build it with
`EXPO_PUBLIC_KOI_STAGE=mock`; a personal-live build intentionally stops at
verified Firebase sign-in instead of consuming MiniMax quota during this mock
flow.

The first live-service device run is a separate release gate. It must not be
enabled until the hosting and MiniMax approval gates in `release-runbook.md`
are satisfied.
