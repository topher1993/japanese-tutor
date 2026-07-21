# Koi Voicebox setup

Koi uses the open-source [jamiepine/voicebox](https://github.com/jamiepine/voicebox)
server as an optional, self-hosted voice. Voicebox runs on the owner's Windows
PC; the Android app never contains Voicebox models, profile data, or access
credentials. When the PC, tunnel, model, or profile is unavailable, Koi falls
back automatically to the included bilingual Android voices.

## 1. Install and prepare Voicebox

1. Install the current Windows build from the Voicebox repository.
2. Open Voicebox and download the Qwen CustomVoice 0.6B model.
3. Create a preset profile named `Koi Tanuki` using a voice you are licensed to
   use. Do not clone a real person without their explicit permission.
4. Test the profile in both English and Japanese and copy its profile ID from
   the Voicebox profile/API response.
5. Keep Voicebox running on `http://127.0.0.1:17493`.

The Worker sends this delivery direction by default:

> Speak as Koi, a warm and youthful magical tanuki Japanese tutor. Sound calm,
> playful, encouraging, and confident without sounding childish. Use a neutral
> natural English accent for English words and authentic Japanese pronunciation
> for Japanese words. Keep the pacing conversational and clear for a language
> learner.

## 2. Create a protected HTTPS tunnel

### Option A: Cloudflare Access (requires a Cloudflare-managed domain)

Create a named Cloudflare Tunnel whose public hostname forwards only to
`http://127.0.0.1:17493`. Protect that hostname with a Cloudflare Access
application and a Service Auth policy. Create a service token for the Koi
Worker. Do not expose the Voicebox hostname with a public bypass policy.

Voicebox has no application authentication of its own. The integration fails
closed unless both Access service-token headers are configured, and it accepts
only an HTTPS tunnel URL.

### Option B: ngrok free tier (no domain purchase)

The ngrok free plan supplies one stable `ngrok-free.app` development hostname.
Forward that hostname to `http://127.0.0.1:17493` and attach an ngrok Traffic
Policy with an enforced `basic-auth` action. Use a dedicated random username
and a password of at least 16 characters; do not reuse an account password.
Requests without the correct credentials must receive `401 Unauthorized`
before they reach Voicebox.

## 3. Configure Worker secrets

From `cloudflare/koi-worker`, configure the common values as Worker secrets:

```powershell
npx wrangler secret put VOICEBOX_BASE_URL
npx wrangler secret put VOICEBOX_PROFILE_ID
```

For Cloudflare Access, configure:

```powershell
npx wrangler secret put VOICEBOX_AUTH_MODE # cloudflare-access
npx wrangler secret put VOICEBOX_ACCESS_CLIENT_ID
npx wrangler secret put VOICEBOX_ACCESS_CLIENT_SECRET
```

For ngrok Basic Auth, configure instead:

```powershell
npx wrangler secret put VOICEBOX_AUTH_MODE # basic
npx wrangler secret put VOICEBOX_BASIC_USERNAME
npx wrangler secret put VOICEBOX_BASIC_PASSWORD
```

Enter the HTTPS tunnel origin, the Koi profile ID, and the credentials enforced
by the selected tunnel gateway. Optional overrides are `VOICEBOX_ENGINE`,
`VOICEBOX_MODEL_SIZE`, and `VOICEBOX_INSTRUCT`; the safe defaults are
`qwen_custom_voice`, `0.6B`, and the Koi direction above.

`KOI_VOICEBOX_ENABLED` is already enabled in `wrangler.jsonc`, but missing or
invalid secrets always produce the bilingual system-voice fallback.

## 4. Deploy and verify

Deploy the Worker only after Voicebox and the tunnel are healthy. In the app,
ask a mixed-language question and press **Speak reply**. Verify:

- English explanations use a neutral English accent.
- Japanese examples retain natural Japanese pronunciation.
- stopping Voicebox or the tunnel produces the device fallback without an app
  error.
- no generation appears in Voicebox history.

Koi calls Voicebox's `/generate/stream` route, which returns WAV directly and
does not create a generation-history record. The Worker rejects non-audio
responses, limits audio to 8 MiB, times out after 45 seconds, and sends the WAV
to the current player as an in-memory data URL. The app does not write that URL
to chat history, analytics, SQLite, AsyncStorage, or a file.

## Free-operation boundary

Voicebox is MIT-licensed and has no per-generation API fee. The owner still
provides the Windows hardware, electricity, internet connection, and tunnel.
Koi never switches to a paid speech provider when Voicebox is unavailable.
