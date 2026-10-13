Affiliate payout rules are tested against a local emulator, never a production project.

Install `firebase-tools` and `@firebase/rules-unit-testing` in a separate test-tools directory. Firebase CLI 14 supports Java 17; newer CLI versions may require Java 21. Point the emulator configuration at the repository's `firestore.rules`, use project `demo-notaknot`, and run `tests/affiliatePaymentRules.emulator.cjs` with `NODE_PATH` pointing at the test-tools directory's `node_modules`.

The test uses `FIRESTORE_EMULATOR_HOST` supplied by `firebase emulators:exec`. It checks approved verified staff/root writes, denied affiliate/unknown/disabled/unverified/anonymous writes, and unchanged public order creation with no forged payout fields.

The calculation and VietQR boundary tests run with the usual command:

```
node --import tsx --test tests/*.test.ts tests/*.test.cjs
```

Publishing the website does not publish Firebase rules. Review and publish `firestore.rules` separately to enforce the new payout field restrictions in production.
