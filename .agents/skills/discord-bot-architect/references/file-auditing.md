# Inbound file audit contract

Read this reference whenever bot code accepts a Discord attachment, user-supplied file/image URL, upload or other untrusted bytes. The audit is an explicit application step; Discord and `CommandContext` do not run it automatically.

## When the audit is mandatory

Run a domain-specific audit before the bot does any of the following with user-controlled bytes:

- decodes or transforms them;
- persists or caches them;
- proxies or echoes them to another user;
- uploads them to Discord or another API;
- supplies them to a parser, image library or other downstream service.

Apply the rule to both slash-command attachments and prefix-message attachments. Keep the audit in a shared helper so all entry points enforce the same policy.

Merely observing an attachment in a Discord event does not require downloading it. If the bot does not consume or forward its contents, do not fetch it only to audit it.

## Current audited image path

The currently supported inbound file operation is importing emoji images. Use `fetchDiscordEmojiDataUri` from `apps/bot/src/utils/emojis/emoji-image.ts`; never fetch the attachment separately or pass its original URL/data directly to `guild.emojis.create` or `application.emojis.create`.

For a Discord `Attachment`, always pass Discord's metadata as consistency hints:

~~~ts
const dataUri = await fetchDiscordEmojiDataUri(attachment.url, {
  contentType: attachment.contentType,
  size: attachment.size,
  consumer: 'emoji-add',
});

if (!dataUri) {
  await sendErrorReply(ctx, title, 'A imagem enviada é inválida ou não pôde ser auditada.');
  return;
}

// Only the sanitized data URI may cross the side-effect boundary.
await ctx.guild.emojis.create({ attachment: dataUri, name: emojiName });
~~~

For a user-supplied image URL or custom emoji tag, call `fetchDiscordEmojiDataUri(source, { consumer: 'emoji-add' })` without inventing `contentType` or `size` hints. Defer slash replies before this network work.

The helper returns a sanitized Discord-compatible data URI or `null`. Treat `null` as a final rejection: send a generic safe error and stop. Do not retry by passing through the original buffer or URL, do not relax the policy based on the filename/extension, and do not log file bytes or signed CDN URLs.

## Audit rejection logging

The central helper emits one structured `console.warn` only after the input is finally rejected. Callers must pass the static `consumer` identifier so the event can be traced without logging user or guild identity.

~~~text
🛡️ [FileAudit] {"event":"untrusted_image_rejected","consumer":"emoji-add","sourceKind":"discord_attachment","reason":"malformed_or_truncated_image","declaredContentType":"image/png","declaredSize":64}
~~~

The `reason` is the technical evidence and must remain machine-readable. Never label a user as malicious: the audit proves that an input violated policy, not the sender's intent. Do not add file bytes, filenames, raw/signed URLs, tokens, user IDs or guild IDs to this log.

## What the emoji audit enforces

The helper currently:

- accepts only HTTP(S) sources without embedded credentials;
- limits the streamed source body to 10 MiB, even when `Content-Length` is absent or incorrect;
- allowlists PNG, JPEG, GIF, WEBP and AVIF MIME types;
- requires attachment size/MIME hints, HTTP MIME and the format detected by Sharp to agree;
- rejects empty, truncated, malformed, oversized or over-complex images using dimension, frame and total-pixel limits;
- fully decodes and re-encodes the image, stripping metadata and trailing/polyglot payloads;
- emits only a sanitized GIF or WEBP of at most 128x128 and safely below Discord's 256 KiB emoji limit.

These checks are content validation and sanitization, not a claim that a user upload matches a pre-existing checksum. There is no trusted expected hash for a new upload.

## Adding another file type

Do not reuse the emoji helper for arbitrary documents, archives, audio or video. Before adding a new consumer, create one central validator appropriate to that format and make the consumer depend on its validated/sanitized result.

At minimum, a new validator must define:

- an explicit MIME/format allowlist and maximum source size;
- bounded streaming rather than an unbounded `response.arrayBuffer()`;
- signature or parser-based content detection independent of filename and declared MIME;
- agreement checks for any supplied size/MIME hints;
- resource-complexity limits relevant to the parser, such as dimensions, frames, pages, entries or decompressed bytes;
- a sanitized output or a validated typed result that cannot be confused with raw input;
- fail-closed behavior before storage, forwarding or external API mutations.

If a format cannot be safely parsed or sanitized with the project's current dependencies, reject it until an appropriate validator is deliberately adopted. Do not silently broaden the allowlist.

## Verification required for file changes

In addition to the normal bot build and `git diff --check`, exercise the validator with:

- one valid file per supported format;
- spoofed or mismatched MIME/type hints;
- an empty and a truncated file;
- a body over the byte limit, including a response without a trustworthy `Content-Length`;
- metadata/body size mismatch;
- format-specific complexity above the configured limit;
- trailing payload/polyglot input, verifying that only sanitized output reaches the side effect.

Search all consumers of the validator after changing its contract. New slash and prefix paths must both reject the same invalid input.
