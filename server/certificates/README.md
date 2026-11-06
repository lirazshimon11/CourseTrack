# HIT intermediate-chain supplement

`letsencrypt-hit-chain.crt` contains PUBLIC CA certificates, not secrets or private keys.

On 2026-11-06, `www.hit.ac.il` presented its `*.hit.ac.il` leaf (issuer Let's Encrypt YE1) without the required intermediate chain. Node rejected it with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

The two certificates were downloaded over normally verified HTTPS from the issuer's official repository:

- https://letsencrypt.org/certs/gen-y/int-ye1.pem
- https://letsencrypt.org/certs/gen-y/root-ye-by-x2.pem

The official chain is documented at https://letsencrypt.org/certificates/:
`HIT leaf → YE1 → Root YE (cross-signed) → ISRG Root X2`.

Recorded SHA-256 fingerprints:

- YE1: `A2:37:2D:06:43:1E:97:16:36:5E:EE:D4:7E:C0:20:35:14:97:D1:82:FC:C0:38:E4:57:E5:81:68:A0:3C:AC:07`
- Root YE cross-signed by X2: `0F:C0:90:1C:CA:2B:AE:9E:9F:DB:B0:2D:50:D0:2F:10:94:F7:B3:66:72:08:69:91:B9:E8:97:62:6D:C4:85:F0`

`server/hit-tls.mjs` verifies both CA signatures to an existing root in Node's bundled trust store and checks their validity before use. The supplemental agent is used only for the approved HIT hosts, and only following a missing-chain error. TLS and hostname verification remain enabled; partial chains are not accepted. There are no process-wide trust changes and Supabase requests use their normal transport.

YE1 expires on 2028-09-02. If HIT starts serving a complete chain, the normal connection works without this supplement. If it switches to an unbundled issuer while still omitting its chain, or the bundle expires, the request fails closed; update the verified issuer bundle or have HIT fix its server configuration. Never bypass certificate validation or trust a leaf certificate directly.

Vercel's `includeFiles` explicitly includes the `.crt` file in the server function bundle.
