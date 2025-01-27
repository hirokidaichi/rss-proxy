import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { RSSTransformer } from "../transformer.ts";
import { RSSDocument } from "../types.ts";

const TEST_BASE_URL = "http://localhost:8000";

const SAMPLE_RSS_DOC: RSSDocument = {
  rss: {
    channel: {
      title: "Test Feed",
      link: "https://example.com",
      description: "Test Description",
      item: [
        {
          title: "Test Item 1",
          link: "https://example.com/article1",
          description: "Test Description 1"
        },
        {
          title: "Test Item 2",
          link: "https://example.com/article2",
          description: "Test Description 2"
        }
      ]
    }
  }
};

const SINGLE_ITEM_RSS_DOC: RSSDocument = {
  rss: {
    channel: {
      title: "Test Feed",
      link: "https://example.com",
      description: "Test Description",
      item: {
        title: "Test Item",
        link: "https://example.com/article",
        description: "Test Description"
      }
    }
  }
};

Deno.test("RSSTransformer - Transform Multiple Items", () => {
  const transformer = new RSSTransformer(TEST_BASE_URL);
  const { transformed, originalUrls } = transformer.transform(SAMPLE_RSS_DOC);

  // 変換されたリンクの確認
  const items = transformed.rss?.channel?.item;
  if (Array.isArray(items)) {
    assertEquals(
      items[0].link,
      `${TEST_BASE_URL}/content/?contentURL=${encodeURIComponent("https://example.com/article1")}`
    );
    assertEquals(
      items[1].link,
      `${TEST_BASE_URL}/content/?contentURL=${encodeURIComponent("https://example.com/article2")}`
    );
  }

  // オリジナルURLのセットを確認
  assertEquals(originalUrls.has("https://example.com/article1"), true);
  assertEquals(originalUrls.has("https://example.com/article2"), true);
  assertEquals(originalUrls.size, 2);
});

Deno.test("RSSTransformer - Transform Single Item", () => {
  const transformer = new RSSTransformer(TEST_BASE_URL);
  const { transformed, originalUrls } = transformer.transform(SINGLE_ITEM_RSS_DOC);

  // 変換されたリンクの確認
  const item = transformed.rss?.channel?.item;
  if (!Array.isArray(item) && item) {
    assertEquals(
      item.link,
      `${TEST_BASE_URL}/content/?contentURL=${encodeURIComponent("https://example.com/article")}`
    );
  }

  // オリジナルURLのセットを確認
  assertEquals(originalUrls.has("https://example.com/article"), true);
  assertEquals(originalUrls.size, 1);
});

Deno.test("RSSTransformer - XML String Generation", () => {
  const transformer = new RSSTransformer(TEST_BASE_URL);
  const { transformed } = transformer.transform(SAMPLE_RSS_DOC);
  const xmlString = transformer.toXmlString(transformed);

  // XML宣言とRSS要素の確認
  assertStringIncludes(xmlString, '<?xml version="1.0" encoding="UTF-8"?>');
  assertStringIncludes(xmlString, '<rss version="2.0">');

  // チャンネル情報の確認
  assertStringIncludes(xmlString, '<title>Test Feed</title>');
  assertStringIncludes(xmlString, '<link>https://example.com</link>');
  assertStringIncludes(xmlString, '<description>Test Description</description>');

  // 変換されたアイテムの確認
  const expectedLink1 = `${TEST_BASE_URL}/content/?contentURL=${encodeURIComponent("https://example.com/article1")}`;
  const expectedLink2 = `${TEST_BASE_URL}/content/?contentURL=${encodeURIComponent("https://example.com/article2")}`;
  
  assertStringIncludes(xmlString, `<link>${expectedLink1}</link>`);
  assertStringIncludes(xmlString, `<link>${expectedLink2}</link>`);
});

Deno.test("RSSTransformer - XML Special Characters Escaping", () => {
  const specialCharsDoc: RSSDocument = {
    rss: {
      channel: {
        title: "Test & Feed",
        link: "https://example.com",
        description: "Test <Description>",
        item: {
          title: 'Test "Item"',
          link: "https://example.com/article",
          description: "Test 'Description'"
        }
      }
    }
  };

  const transformer = new RSSTransformer(TEST_BASE_URL);
  const xmlString = transformer.toXmlString(specialCharsDoc);

  // エスケープされた特殊文字の確認
  assertStringIncludes(xmlString, "<title>Test &amp; Feed</title>");
  assertStringIncludes(xmlString, "<description>Test &lt;Description&gt;</description>");
  assertStringIncludes(xmlString, '<title>Test &quot;Item&quot;</title>');
  assertStringIncludes(xmlString, "<description>Test &apos;Description&apos;</description>");
});

Deno.test("RSSTransformer - Empty Document", () => {
  const emptyDoc: RSSDocument = {
    rss: {
      channel: {
        title: "",
        link: "",
        description: "",
      }
    }
  };

  const transformer = new RSSTransformer(TEST_BASE_URL);
  const xmlString = transformer.toXmlString(emptyDoc);

  // 空の要素が正しく出力されることを確認
  assertStringIncludes(xmlString, "<title></title>");
  assertStringIncludes(xmlString, "<link></link>");
  assertStringIncludes(xmlString, "<description></description>");
});