This specification will be a recommended TEA publisher API.

The TEA specification is focused on the consumption API, which is the base of
conformance with the specification.

`openapi.yaml` here is **generated**. It is the consumption specification plus
the publication operations in `overlay.yaml`, merged by `build.mjs`.

```sh
cd spec/publisher
npm install
npm run build     # regenerate openapi.yaml
npm run check     # fail if it has drifted from spec/openapi.yaml
npm run lint      # redocly
```

## Why it is generated

It used to be a hand-maintained copy, and it drifted, as copies do. While the
consumption API moved to 0.4.0 the copy still carried schemas from 0.0.3, under
different names — `artifactFormat` beside the real `artifact-format`, `typeUuid`
beside `uuid`, a private `artifactChecksum` beside `checksum`. A combined
document then holds two definitions of the same concept, each free to move
independently, with nothing to say which one a publisher should believe.

Generating it removes the possibility rather than the symptom. Everything shared
is a `$ref` into the consumption specification's own definitions, so there is
exactly one definition of a product, a checksum or an artifact format, and the
publisher version *is* the consumer version because `build.mjs` copies it rather
than letting anyone choose one.

`build.mjs` refuses to build if `overlay.yaml` declares a schema, parameter,
response, request body or path method that the consumption specification already
owns. That is the drift check with teeth: the overlay may only add.

## Alignment corrections made when this was regenerated

- **Releases are split.** The draft had a single `/release`, but the consumption
  API distinguishes a product release from a component release. There are now
  `/productRelease` and `/componentRelease`, matching `productRelease` and
  `release` in the consumption schemas.
- **Collections are addressed through their release.** The consumption
  specification states that a collection's UUID matches the release it belongs
  to, and that an update only changes the version — so a collection is not an
  independently created object. Publishing one is now
  `PUT /productRelease/{uuid}/collection` (and the component equivalent), which
  publishes the next version, rather than `POST /collection`.
- **Errors reuse the consumption envelope.** The draft returned
  `application/json: {}` — an empty schema saying nothing about failures.
  `publisher-error-response` uses the same `{ error: <enum> }` shape as
  `error-response`, over an enumeration that repeats the consumption values
  (`OBJECT_UNKNOWN`, `OBJECT_NOT_SHAREABLE`) and adds the ones only a writer can
  hit, so a client branches on one enumeration rather than two.
- **`distribution` was renamed `access-policy`.** The consumption specification
  already uses `release-distribution` for something else entirely — a
  downloadable build with its own URL and checksums. Reusing the word for access
  control in a combined document would have been actively misleading.
- **The invalid delete indirection is gone.** `components.operations` is not a
  field OpenAPI defines, so the three `$ref`s pointing into it never resolved
  and every delete declared no responses at all. A generator reading the old
  draft produced deletes that returned nothing.

## What the publication overlay adds

### Artifacts

The draft could create products, components, releases and collections but had no
way to publish the artifact carrying the SBOM, VEX or attestation the exchange
exists to move.

Registering an artifact and uploading its bytes are separate operations. An SBOM
is routinely tens of megabytes, and a publisher who must resend all of it to
correct one metadata field will in practice not correct the field. Content is
`PUT` per format in its own media type rather than base64 inside JSON, which
would inflate it by a third for no benefit.

Stored bytes are immutable — a checksum a consumer already recorded must not
begin describing different content, so replacing content means a new format or a
new artifact. Uploads accept `Content-Digest` (RFC 9530) and a mismatch is
rejected, which is what makes a retry safe: a truncated transfer fails loudly
instead of publishing corruption under a checksum claiming otherwise.

### Signatures

`signatures/signature.md` asks for an indication of the hash algorithm, an
indicator of the certificate used, and the intermediate and signing
certificates. The consumption API exposes only a `signatureUrl`, so a consumer
must infer the scheme from the bytes before it can verify anything.
`artifact-signature` records the scheme, algorithm, key identifier, certificate
and chain, and the transparency-log entry where the scheme has one — which is
what turns a signature from something that exists into something checkable.

### Access policy

TEA describes how transparency data is fetched, not who is entitled to fetch it.
That is a reasonable boundary for a consumption API and an impossible one for a
publication API, where the same server holds material that is deliberately
public, material shared with named counterparties under agreement, and material
that is purely internal. Absent an answer, every publisher invents one.

Three visibilities — `private`, `shared` (to named organisation UUIDs, with
optional expiry) and `public` — plus `publishTo` for mirroring to other TEA
servers. Two rules carry the weight:

- **Inheritance narrows, never widens.** An artifact takes its collection's
  policy, a collection its release's, a release its product's. A child may
  restrict what it inherits and must not loosen it; a server rejects the attempt
  with `ACCESS_WIDENS_PARENT`. Without this, marking a product private would
  guarantee nothing, because any artifact beneath it could quietly be made
  public.
- **`public` is one-way in practice.** No later request recalls what has already
  been fetched, so a server should require a separate confirmation for that
  transition rather than treating it as an ordinary field update.

This needs no new consumer-side behaviour: a consumer denied by the policy gets
the consumption specification's existing `OBJECT_NOT_SHAREABLE`, which is
already in `unknown-error-type`.

`GET /accessPolicy/{uuid}` reports what an object *declares* alongside what it
*effectively* has and which ancestor that came from. The gap between declared
and effective is where accidental disclosure hides, so it is reported rather
than left to be reconstructed.

### Idempotency

`Idempotency-Key` on creates. Publication runs in pipelines, and pipelines
retry. Without it a timeout that actually succeeded yields a second object on
the next attempt — a duplicate found by a consumer rather than by the publisher.

## Known lint baseline

`npm run lint` reports 24 errors. All 24 are inherited: linting
`spec/openapi.yaml` on its own reports exactly the same 24, so the publication
overlay contributes none.

- 23 × `operation-summary` — consumption operations have no `summary`.
- 1 × `struct` — `pagination-details.nextPageToken` uses `nullable: false`,
  which OpenAPI 3.1 removed in favour of a type union.

These are worth fixing in the consumption specification rather than papering
over here, since patching them in this fork would put it at odds with upstream
on a file upstream owns.

## Open questions

- **No publisher-side read surface.** A publisher reconciling state has to go
  through the consumption API, which by design will not show it anything
  private — so there is currently no way to list what you have published.
- **`publishTo` does not define failure semantics.** Whether a failed mirror
  should block the local publication is unspecified.
- **Artifact versions.** The consumption API addresses artifacts as
  `/artifact/{uuid}/{artifactVersion}`, but the overlay's create and update do
  not yet say how a publisher advances that version.
