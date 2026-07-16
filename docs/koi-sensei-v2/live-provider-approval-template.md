# MiniMax approval request

Send this from the subscription owner's account before enabling live Koi chat.
Save the complete written response in the private release evidence store; do not
commit account identifiers, keys, invoices, or support-ticket attachments.

## Suggested message

> I have an active yearly MiniMax Plus Token Plan. I am building an optional
> Japanese-learning tutor for a closed beta capped at 50 authenticated people.
> Requests will pass through my backend, be limited to two concurrent provider
> calls, and be dynamically reduced or stopped as included quota falls. There
> will be no automated/batch use and no attempt to bypass rate limits.
>
> I will not permit any pay-as-you-go charge, top-up, prepaid Credit, shared
> Credit, or paid fallback. Please confirm in writing:
>
> 1. May one Plus Token Plan key serve this capped, multi-user interactive beta?
> 2. Can all Credits access be disabled for that key so calls hard-stop when the
>    included subscription quota is unavailable?
> 3. Which response fields from `GET /v1/token_plan/remains` are authoritative
>    remaining values for the five-hour, weekly, and Speech 2.8 windows?
> 4. Does the Plus plan's included Speech 2.8 quota cover TTS calls from this
>    beta, and which endpoint/model identifiers must be used?
> 5. Is `MiniMax-M2.7` through the Anthropic-compatible messages endpoint the
>    correct subscription-covered text route for this use case?
> 6. Are there additional fair-use, user-count, disclosure, retention, or safety
>    requirements for this beta?

## Approval record

- Asked on:
- MiniMax ticket/reference:
- Respondent:
- Multi-user use approved: **yes / no**
- Maximum approved users:
- Credits can be disabled or proven unavailable: **yes / no**
- Confirmed text model/endpoint:
- Confirmed TTS model/endpoint and daily characters:
- Confirmed quota response semantics:
- Restrictions and expiry:
- Reviewed by:

Any missing, ambiguous, expired, or negative answer keeps
`KOI_PROVIDER_MODE=mock` in production.

