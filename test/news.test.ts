import assert from "node:assert/strict";
import test from "node:test";
import { extractNewsLinks, parseNewsDetail } from "../src/news.js";

test("extracts unique ak.hypergryph.com numeric news links only", () => {
  const html = `
    <a href="/news/9692">maintenance</a>
    <a href="https://ak.hypergryph.com/news/9692">duplicate</a>
    <a href="https://ak.hypergryph.com/news/abc">bad</a>
    <a href="https://example.com/news/1234">external</a>
    <a href="https://ak.hypergryph.com/news/3044?from=list">other</a>
  `;

  assert.deepEqual(extractNewsLinks(html), [
    { id: "9692", url: "https://ak.hypergryph.com/news/9692" },
    { id: "3044", url: "https://ak.hypergryph.com/news/3044" }
  ]);
});

test("extracts news links embedded in static script json", () => {
  const html = `
    <script>
      window.__NEWS__ = [{"link":"https://ak.hypergryph.com/news/9692"},{"link":"https://ak.hypergryph.com/news/3044"}];
    </script>
  `;

  assert.deepEqual(extractNewsLinks(html), [
    { id: "9692", url: "https://ak.hypergryph.com/news/9692" },
    { id: "3044", url: "https://ak.hypergryph.com/news/3044" }
  ]);
});

test("parses news title and content from detail html", () => {
  const html = `
    <html>
      <head><title>[明日方舟]05月01日06:00版本更新停机维护公告 - 明日方舟</title></head>
      <body>
        <main>
          <h1>[明日方舟]05月01日06:00版本更新停机维护公告</h1>
          <div class="content">维护时间：2026年05月01日06:00 ~ 12:00 维护期间无法登录游戏。</div>
        </main>
      </body>
    </html>
  `;

  const detail = parseNewsDetail("9692", "https://ak.hypergryph.com/news/9692", html);

  assert.equal(detail.title, "[明日方舟]05月01日06:00版本更新停机维护公告");
  assert.match(detail.content, /维护时间/);
  assert.match(detail.content, /无法登录/);
});
