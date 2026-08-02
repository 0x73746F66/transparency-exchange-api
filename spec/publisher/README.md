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
- **A product release can state its components.** The consumption API lists
  `components` among `productRelease`'s required members, and the draft's
  create body had no way to set it — so every release a conformant publisher
  could produce had to be served with an empty list, which is a claim about the
  product rather than a gap in the record.
- **An artifact can say which distributions it describes.** `distributionIds`
  exists in the consumption `artifact` and was unreachable from the publication
  API. It matters where an SBOM is not one document: a Windows installer and a
  source tarball of the same release have different contents.

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
  been fetched, so that transition requires `confirm=public` rather than being
  an ordinary field update. The mechanism is named, not merely asked for: an
  unspecified requirement is one every publisher satisfies differently, which
  is the failure this document exists to avoid.

This needs no new consumer-side behaviour: a consumer denied by the policy gets
the consumption specification's existing `OBJECT_NOT_SHAREABLE`, which is
already in `unknown-error-type`.

`GET /accessPolicy/{uuid}` reports what an object *declares* alongside what it
*effectively* has and which ancestor that came from. The gap between declared
and effective is where accidental disclosure hides, so it is reported rather
than left to be reconstructed.

Mirroring to other TEA servers is `publishTo`, naming targets registered
through `/publicationTargets`. Registration is separate from use because a
credential is involved, and because handing an object to another server is a
decision that outlives the object — once a copy lands there, this server's
policy no longer governs it. Mirroring is asynchronous and never blocks the
local write: refusing to record a publisher's own release because a mirror is
unreachable would make every target a single point of failure for publication
itself. State is reported per target on the object's access policy, and a
server that does not mirror answers `MIRRORING_UNSUPPORTED` rather than
accepting the request and doing nothing.

### The publisher read surface

`GET /publications` and `GET /publications/{uuid}/releases` report what this
organisation has published together with the policy in force for each.

The consumption API cannot answer this. It answers what a *reader* is entitled
to see, and the thing a publisher most needs to verify — that something private
really is private — is exactly what a consumption response cannot show, because
an object correctly withheld and an object that was never created look
identical from outside.

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

## The one change this makes to the consumption specification

`spec/openapi.yaml` gains an empty alternative in its global `security`, so
authentication is optional rather than mandatory.

Without it the publication API cannot mean what it says. `visibility: public`
is defined as "readable without authentication", and the discovery sequence a
consumer follows — take the domain out of a TEI, fetch that host's discovery
document, call the root it names — has no step at which a credential could be
obtained. A specification that requires one on every operation closes the only
entry point it defines, and any server that actually serves a public object
anonymously is then non-conformant for doing the right thing.

It is a widening, so no conformant client or server is broken by it: a server
may still refuse every anonymous request, and one that answers is now allowed
to. The publication operations are unaffected — `build.mjs` gives every
operation the overlay contributes an explicit `bearerAuth`/`basicAuth`
requirement, so anonymous writes are never conformant.

## Open questions

- **Artifact versions.** The consumption API addresses artifacts as
  `/artifact/{uuid}/{artifactVersion}`, but the overlay's create and update do
  not yet say how a publisher advances that version. The rule is probably that
  content is immutable and a new revision is a new version, but "probably" is
  not a specification.
- **Mirror authentication is one-directional.** A target is registered with a
  credential this server presents. Nothing says how the receiving server
  decides whether to accept a mirrored object, or how it records that the
  object came from elsewhere rather than being published to it directly.
