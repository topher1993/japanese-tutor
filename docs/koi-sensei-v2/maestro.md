# Koi Sensei device smoke test

The checked-in `.maestro/koi-sensei-smoke.yaml` flow exercises a clean-device
onboarding, Home entry, the GLB avatar, age/consent gate, deterministic mock
chat, and grounded source display without contacting Firebase or MiniMax.

Run it against an installed development build:

```powershell
maestro test .maestro\koi-sensei-smoke.yaml
```

The first live-service device run is a separate release gate. It must not be
enabled until the hosting and MiniMax approval gates in `release-runbook.md`
are satisfied.

