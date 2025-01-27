// クライアントテストスクリプト
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";

const SERVER_URL = "http://localhost:8000";
const TEST_FEED_URL = "https://techcrunch.com/feed/";

async function runTests() {
  console.log("Starting client tests...\n");

  // RSSエンドポイントのテスト
  console.log("Testing /rss/ endpoint:");
  try {
    // 正常系テスト
    console.log(`Fetching RSS from: ${TEST_FEED_URL}`);
    const rssResponse = await fetch(`${SERVER_URL}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`);
    console.log(`RSS Test - Status: ${rssResponse.status}`);
    
    if (rssResponse.ok) {
      const content = await rssResponse.text();
      console.log("\nRSS Response Headers:");
      for (const [key, value] of rssResponse.headers.entries()) {
        console.log(`${key}: ${value}`);
      }
      console.log("\nRSS Content Preview (first 500 chars):");
      console.log(content.substring(0, 500) + "...");

      // XMLをパースしてアイテム数を表示
      const doc = parse(content);
      const items = doc.rss?.channel?.item || [];
      const itemCount = Array.isArray(items) ? items.length : 1;
      console.log(`\nFound ${itemCount} items in the feed`);

      // 最初のアイテムの詳細を表示
      if (itemCount > 0) {
        const firstItem = Array.isArray(items) ? items[0] : items;
        console.log("\nFirst Item Details:");
        console.log("Title:", firstItem.title);
        
        // 変換前のURLを抽出（変換されたURLから元のURLを取得）
        const transformedLink = firstItem.link;
        const originalUrl = transformedLink ? 
          decodeURIComponent(new URL(transformedLink).searchParams.get("contentURL") || "") :
          "";
        
        console.log("Original Link:", originalUrl);
        console.log("Transformed Link:", transformedLink);
        
        // 元のURLを使用してcontentエンドポイントをテスト
        if (originalUrl) {
          console.log("\nTesting /content/ endpoint with the original URL:");
          const contentResponse = await fetch(`${SERVER_URL}/content/?contentURL=${encodeURIComponent(originalUrl)}`);
          console.log(`Content Test - Status: ${contentResponse.status}`);
          
          if (contentResponse.ok) {
            const content = await contentResponse.text();
            console.log("\nContent Response Headers:");
            for (const [key, value] of contentResponse.headers.entries()) {
              console.log(`${key}: ${value}`);
            }
            console.log("\nContent Preview (first 500 chars):");
            console.log(content.substring(0, 500) + "...");
          } else {
            console.log("Error Response:", await contentResponse.text());
          }
        }
      }
    } else {
      console.log("Error Response:", await rssResponse.text());
    }

    // エラー系テスト（不正なURL）
    console.log("\nTesting with invalid URL:");
    const invalidRssResponse = await fetch(`${SERVER_URL}/rss/?feedURL=invalid-url`);
    console.log(`RSS Test (Invalid URL) - Status: ${invalidRssResponse.status}`);
    console.log("Error Response:", await invalidRssResponse.text());

  } catch (error) {
    console.error("Error during tests:", error);
  }
}

// テストの実行
console.log("RSS Proxy Client Tests");
console.log("=====================\n");
runTests().catch(console.error);