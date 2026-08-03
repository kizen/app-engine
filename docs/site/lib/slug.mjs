/**
 * GitHub-compatible heading slugs.
 *
 * The source docs contain ~620 hand-written anchor links (`[x](04-worker-runtime-api.md#4-http)`)
 * that were authored against GitHub's rendering. Any deviation here silently breaks them, so this
 * mirrors the `github-slugger` algorithm rather than inventing a nicer one:
 *
 *   1. lowercase
 *   2. delete every character that isn't a letter, number, `-`, `_`, or space
 *   3. replace each remaining space with `-`
 *
 * Step 2 deliberately runs before step 3 and neither step collapses runs of separators, which is
 * why `## Recipe 1 — New plugin skeleton` yields `recipe-1--new-plugin-skeleton` (double hyphen:
 * the em dash vanishes but both surrounding spaces survive). Collapsing them would be prettier and
 * would break real links.
 */

const STRIP = /[^\p{L}\p{N}\-_ ]/gu;

/** Slugify one heading's text. Not dedup-aware — use {@link Slugger} for a document. */
export function slugify(text) {
  return String(text).toLowerCase().replace(STRIP, '').replace(/ /g, '-');
}

/**
 * Per-document slug generator. GitHub disambiguates repeated headings by appending `-1`, `-2`, …
 * in document order, so slugs are only correct if every heading in a file passes through one
 * shared instance in source order.
 *
 * Counting occurrences of the *emitted* slug (not just the base) is what makes this match
 * github-slugger when a suffixed slug collides with a real heading. For headings
 * `["Foo", "Foo", "Foo-1"]`, keying on the base alone yields `foo`, `foo-1`, `foo-1` — a duplicate
 * `id`, where an anchor to the third heading silently jumps to the second. The loop below yields
 * `foo`, `foo-1`, `foo-1-1`, as GitHub does.
 */
export class Slugger {
  #occurrences = new Map();

  slug(text) {
    const base = slugify(text);
    let result = base;
    while (this.#occurrences.has(result)) {
      const next = (this.#occurrences.get(base) ?? 0) + 1;
      this.#occurrences.set(base, next);
      result = `${base}-${next}`;
    }
    this.#occurrences.set(result, 0);
    return result;
  }
}
