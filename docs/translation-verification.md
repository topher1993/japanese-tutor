# Translation verification status

The previous report in this file is retired. Its generator compared Latin
romaji directly with kana and then treated dictionary attribution as sufficient
evidence for 438 “fuzzy” matches. Those results were not valid reading
verification and must not be used as editorial approval.

`scripts/verify-japanese-phrases.py` now passes only exact romanized reading
matches. Partial matches, missing romanizer support, and dictionary misses are
sent to human review; there is no attribution-only pass state.

To produce current evidence, install `scripts/requirements-romanizer.txt`, run
the verifier with network access, and review every non-exact result before
replacing this status document with a generated report.
