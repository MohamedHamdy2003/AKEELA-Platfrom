# Security maintenance

## Temporary dependency exception

The owner approved the following limited exception on **2026-11-18**, through **2026-12-18 UTC**. Re-review before expiry and remove when an upstream fix is available.

- [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): picomatch through 4.0.7 can cause excessive backtracking when supplied crafted extglob patterns. The advisory currently lists no patched version; npm's suggested TypeORM downgrade is not a compatible fix for this project.
- Scope reviewed: TypeORM entity/migration discovery uses repository-defined file patterns in apps/api/src/database/database.options.ts. Frontend/build tools also use picomatch, but no API accepts user-supplied glob patterns. User names/search fields/filenames are not passed to these glob APIs.
- This is an exposure assessment, not an upstream fix. Do not introduce user-controlled glob/file-pattern evaluation. Reassess if that boundary changes.
- npm run audit:runtime still runs the real npm runtime audit. It permits only this exact advisory before expiry and fails for any other moderate/high/critical finding, expired exception or unreadable audit result. It reports the exception visibly; do not describe the dependency set as having zero findings.

Credentials, JWTs, OTPs, private environment files and SSH keys must never be committed or printed. See [auth](AUTH.md) and [deployment](DEPLOYMENT.md) for operational requirements.
