This specification will be a recommended TEA publisher API.

The TEA specification is focused on the consumption API, which is the base of
conformance with the specification.

NOTE: This is a copy of the OpenAPI specification including both consumption and publication APIs.

## Status of this draft

The document now validates as OpenAPI 3.1. It previously did not, and the way it
failed mattered: `components.operations` is not a field OpenAPI defines, so the
three `$ref`s pointing into it did not resolve and every delete operation
declared **no responses at all**. A generator reading it produced deletes that
returned nothing, which is why the draft could not be exercised end to end.

Validated with `npx @redocly/cli lint spec/publisher/openapi.yaml` — 9 errors
before, 0 after. The remaining warnings are query parameters carried over from
the consumption API that no publication path uses; they are left in place
because this file is meant to grow into a combined document.

## What was fixed

- **Deletes have responses.** The invalid `components.operations` indirection is
  replaced by an explicit shared `204` alongside the existing 401 and 404.
- **Errors have a shape.** Error responses previously carried
  `application/json: {}` — an empty schema, saying nothing about what comes
  back. There is now an `error` schema with a machine-readable `code`, because
  publication happens in release pipelines and a failure has to be actionable
  without a human reading prose.
- **Every operation has a summary**, and the server entry is a templated
  `https://{host}/tea/v{version}` matching the address a consumer reaches after
  reading `/.well-known/tea`, rather than a bare localhost URL.

## What was added, and why

### Artifacts

The draft could create products, components, releases and collections but had no
way to publish an **artifact** — the only object that carries the SBOM, VEX or
attestation the whole exchange exists to move.

Creating an artifact and uploading its bytes are deliberately separate. An SBOM
is routinely tens of megabytes, and a publisher who must resend all of it to
correct one metadata field will in practice not correct the field. Content is
`PUT` per format in its own media type rather than base64 inside JSON, which
would inflate it by a third for no benefit.

Stored bytes are immutable. A checksum a consumer has already recorded must not
start describing different content, so replacing content means a new format or a
new artifact, never an overwrite in place.

Uploads accept `Content-Digest` (RFC 9530) and the server must reject a
mismatch. That is what makes a retry safe: a truncated transfer fails loudly
instead of publishing corrupt content under a checksum claiming otherwise.

### Signatures

The consumption API exposes only `signatureUrl`, so a consumer can find a
signature but must infer the scheme from the bytes before verifying it. The
publisher knows the scheme, and `artifactSignature` records it — with the key
identifier, certificate chain and transparency-log entry where the scheme has
them. Stating it turns a signature from something that exists into something
that can be checked.

### Distribution

TEA describes how transparency data is fetched, not who is entitled to fetch it.
That is a reasonable boundary for a consumption API and an impossible one for a
publication API: the same server holds material that is deliberately public,
material shared with named counterparties under agreement, and material that is
purely internal. Every publisher otherwise invents this, incompatibly.

`distribution` gives three visibilities — `private`, `shared` (to named
organisation UUIDs, with optional expiry) and `public` — plus `publishTo` for
mirroring to other TEA servers.

Two rules carry the weight:

- **Inheritance narrows, never widens.** An artifact takes its collection's
  distribution, a collection its release's, a release its product's. A child may
  restrict what it inherits and must not loosen it; a server rejects the attempt
  with `DISTRIBUTION_WIDENS_PARENT`. Without this, marking a product private
  would guarantee nothing, because any artifact beneath it could quietly be made
  public.
- **`public` is one-way in practice.** No later request recalls what has already
  been fetched, so a server should require a distinct confirmation for that
  transition rather than treating it as an ordinary field update.

`GET /distribution/{uuid}` reports what an object *declares* alongside what it
*effectively* has, and which ancestor that came from. The gap between declared
and effective is exactly where accidental disclosure hides, so it is reported
rather than left to be reconstructed.

### Idempotency

`Idempotency-Key` on creates. Publication runs in pipelines, and pipelines
retry. Without it a timeout that actually succeeded yields a second product on
the next attempt — a duplicate found by a consumer rather than by the publisher.

## Open questions

- **Releases are not split.** The consumption API distinguishes product releases
  from component releases; this draft has a single `/release`. Left alone here
  because changing it rewrites existing request bodies, but they are different
  object types and a publisher has to say which one it is creating.
- **No publisher-side read surface.** A publisher reconciling state has to go
  through the consumption API, which by design will not show it anything
  private — so there is currently no way to list what you have published.
- **`publishTo` describes mirroring but not its failure semantics.** Whether a
  failed mirror should block the local publication is unspecified.
