# AGENTS — @to-much-talker/crypto

Security-critical package. AES-256-GCM encryption using ONLY Node.js built-in `crypto` module.

## Security Rules

- NEVER log key material — no `console.log(key)`, no pino logging of key bytes
- ALWAYS use `KeyRing` to decrypt stored records (handles key version lookup)
- NEVER accept user-supplied keys without `parseMasterKey` validation first
- IV MUST be 12 random bytes (96-bit) for GCM — never reuse IVs
- Auth tag MUST be validated (GCM provides authenticated encryption)
- Decryption failure returns `Result.err(EncryptionError)` — NEVER throws

## Key Rotation Procedure

1. Generate new key: `node -e "import('@to-much-talker/crypto').then(m => console.log(m.generateMasterKey()))"`
2. Set `MASTER_ENC_KEY=<new-key>` and `MASTER_ENC_KEY_VERSION=<N+1>` in env
3. Load old key version in `KeyRing` for decrypting old records
4. New records are encrypted with the new key version
5. Old records are re-encrypted lazily on next read

## Envelope Format

- Format: `v1:<base64-iv>:<base64-ciphertext>:<base64-auth-tag>`
- `v1` is the ENVELOPE FORMAT version (not the key version)
- Key version stored separately in the DB column `api_key_version`
