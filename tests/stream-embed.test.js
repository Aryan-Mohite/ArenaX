// Pure unit tests (no database needed): npm test runs these too.
import test from "node:test";
import assert from "node:assert/strict";
import { parseStreamUrl } from "../src/utils/streamEmbed.js";

const emb = (url) => parseStreamUrl(url);

test("YouTube video formats", () => {
  for (const u of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=5",
    "https://youtube.com/live/dQw4w9WgXcQ",
    "https://m.youtube.com/embed/dQw4w9WgXcQ",
  ]) assert.deepEqual(emb(u), { platform: "youtube", embeddable: true, kind: "video", id: "dQw4w9WgXcQ" }, u);
});

test("YouTube channel live + non-embeddable handle", () => {
  assert.deepEqual(emb("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/live"),
    { platform: "youtube", embeddable: true, kind: "channel", id: "UCabcdefghijklmnopqrstuv" });
  assert.deepEqual(emb("https://www.youtube.com/@somecreator/live"), { platform: "youtube", embeddable: false });
});

test("Twitch channel (lowercased), video, reserved paths", () => {
  assert.deepEqual(emb("https://www.twitch.tv/SomeChannel"), { platform: "twitch", embeddable: true, kind: "channel", id: "somechannel" });
  assert.deepEqual(emb("https://twitch.tv/videos/123456789"), { platform: "twitch", embeddable: true, kind: "video", id: "123456789" });
  assert.equal(emb("https://twitch.tv/directory").embeddable, false);
  assert.equal(emb("https://twitch.tv/").embeddable, false);
});

test("Kick channel and reserved", () => {
  assert.deepEqual(emb("https://kick.com/some_user"), { platform: "kick", embeddable: true, kind: "channel", id: "some_user" });
  assert.equal(emb("https://kick.com/categories").embeddable, false);
});

test("Other platforms are link-out only", () => {
  assert.deepEqual(emb("https://www.facebook.com/gaming/x"), { platform: "facebook", embeddable: false });
  assert.deepEqual(emb("https://tiktok.com/@a/live"), { platform: "other", embeddable: false });
});

test("Rejects invalid / dangerous input", () => {
  for (const bad of [null, undefined, 42, "", "not a url", "javascript:alert(1)", "ftp://twitch.tv/x", "data:text/html,<script>", "x".repeat(2100)])
    assert.equal(emb(bad), null, String(bad).slice(0, 30));
});

test("Lookalike hosts and injection in ids are not embeddable", () => {
  assert.equal(emb("https://twitch.tv.evil.com/chan").embeddable, false);
  assert.equal(emb("https://evil.com/twitch.tv/chan").embeddable, false);
  assert.equal(emb("https://youtube.com/watch?v=abc%22%3E%3Cscript%3E").embeddable, false);
  assert.equal(emb("https://twitch.tv/a%22onload%3D1").embeddable, false);
  assert.equal(emb("https://youtube.com/watch?v=dQw4w9WgXcQ&x=1").id, "dQw4w9WgXcQ");
});
