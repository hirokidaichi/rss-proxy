import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { RSSParser } from "../parser.ts";
import { ValidationError } from "../types.ts";

const VALID_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>Test Description</description>
    <item>
      <title>Test Item 1</title>
      <link>https://example.com/article1</link>
      <description>Test Item Description 1</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Test Item 2</title>
      <link>https://example.com/article2</link>
      <description>Test Item Description 2</description>
      <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const INVALID_XML = `This is not XML`;

const INVALID_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<not-rss>
  <content>This is not RSS</content>
</not-rss>`;

const RSS_WITHOUT_CHANNEL = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
</rss>`;

const RSS_WITH_INVALID_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>123</title>
    <link>https://example.com</link>
    <description>Test Description</description>
    <item>
      <title>Test Item</title>
      <link>123</link>
      <description>Test Description</description>
    </item>
  </channel>
</rss>`;

Deno.test("RSSParser - Valid RSS", async () => {
  const doc = await RSSParser.parse(VALID_RSS);
  assertEquals(doc.rss?.channel?.title, "Test Feed");
  assertEquals(doc.rss?.channel?.link, "https://example.com");
  assertEquals(Array.isArray(doc.rss?.channel?.item), true);
  if (Array.isArray(doc.rss?.channel?.item)) {
    assertEquals(doc.rss?.channel?.item.length, 2);
    assertEquals(doc.rss?.channel?.item[0].title, "Test Item 1");
    assertEquals(
      doc.rss?.channel?.item[0].link,
      "https://example.com/article1",
    );
  }
});

Deno.test("RSSParser - Empty Content", async () => {
  await assertRejects(
    async () => await RSSParser.parse(""),
    ValidationError,
    "Empty content",
  );
});

Deno.test("RSSParser - Invalid XML", async () => {
  await assertRejects(
    async () => await RSSParser.parse(INVALID_XML),
    ValidationError,
    "Invalid XML format",
  );
});

Deno.test("RSSParser - Invalid RSS Structure", async () => {
  await assertRejects(
    async () => await RSSParser.parse(INVALID_RSS),
    ValidationError,
    "Invalid RSS format",
  );
});

Deno.test("RSSParser - RSS Without Channel", async () => {
  await assertRejects(
    async () => await RSSParser.parse(RSS_WITHOUT_CHANNEL),
    ValidationError,
    "Invalid RSS format",
  );
});

Deno.test("RSSParser - RSS With Invalid Types", async () => {
  const doc = await RSSParser.parse(RSS_WITH_INVALID_TYPES);
  assertEquals(typeof doc.rss?.channel?.title, "string");
  assertEquals(typeof doc.rss?.channel?.link, "string");
  if (Array.isArray(doc.rss?.channel?.item)) {
    assertEquals(typeof doc.rss?.channel?.item[0].link, "string");
  }
});

Deno.test("RSSParser - RSS With Special Characters", async () => {
  const rssWithSpecialChars = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test &amp; Feed</title>
    <link>https://example.com</link>
    <description>Test &lt;Description&gt;</description>
    <item>
      <title>Test "Item" 1</title>
      <link>https://example.com/article1</link>
      <description>Test &apos;Description&apos; 1</description>
    </item>
  </channel>
</rss>`;

  const doc = await RSSParser.parse(rssWithSpecialChars);
  assertEquals(doc.rss?.channel?.title, "Test & Feed");
  assertEquals(doc.rss?.channel?.description, "Test <Description>");
  if (Array.isArray(doc.rss?.channel?.item)) {
    assertEquals(doc.rss?.channel?.item[0].title, 'Test "Item" 1');
    assertEquals(doc.rss?.channel?.item[0].description, "Test 'Description' 1");
  }
});

Deno.test("RSSParser - Preserve pubDate", async () => {
  const doc = await RSSParser.parse(VALID_RSS);
  const items = doc.rss?.channel?.item;
  if (Array.isArray(items)) {
    assertEquals(items[0].pubDate, "Mon, 01 Jan 2024 00:00:00 GMT");
    assertEquals(items[1].pubDate, "Tue, 02 Jan 2024 00:00:00 GMT");
  }
});
