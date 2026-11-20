# Image Uploads

Feature 15 adds four authenticated PUT routes, listed in the root API documents and Bruno folder 15. Send multipart/form-data with one `file` field. Ownership comes from the login, never a body owner ID.

- Customers upload their avatar. Active restaurant owners upload their restaurant, product and offer images. Pending/Suspended owners cannot upload.
- Accept actual JPEG, PNG or WebP bytes up to 5MB, non-animated, up to 16,777,216 input pixels. Ignore client filenames/MIME claims. Sharp decodes, auto-rotates, resizes inside target-aware bounds (`avatar`: 512×512, `product`/`offer`: 1280×1280, `restaurant`: 1600×1600, without enlargement), strips metadata and writes WebP (`quality: 82`, `effort: 6`, `smartSubsample: true`) with a random UUID filename.
- Ten uploads per account per minute limit encoding load. This is an in-process safeguard for the single application instance.
- Return `{image_url}` in the success envelope and update the existing image URL field. No new table/migration.
- IMAGE_STORAGE_PATH is an absolute directory (default: `apps/api/storage/images` in the checkout). PUBLIC_BASE_URL builds URLs (default: `http://localhost:3000`; required HTTPS origin in production). Never trust request Host headers for URLs.
- `/images/<uuid>.webp` is public and outside `/api/v1`. Images must contain no private information; random names are not access control. Caddy serves them in production; the API serves them locally.
- Rejected database updates remove their new file. Older versions stay available so saved URLs do not break. Cleanup/deletion is not implemented; a crash between writing and committing may leave an unused file. Monitor disk usage; add a reviewed cleanup policy later.
- Invalid content: 422; oversized: 413; role/activation: 403; foreign/missing resource: 404; upload throttling: 429; invalid multipart: 400. No remote downloads/general file upload endpoint.

Production uses a persistent image volume, read-only for Caddy. Rebuilding/replacing the API preserves images. Backup automation is deferred. See [DEPLOYMENT.md](DEPLOYMENT.md).
