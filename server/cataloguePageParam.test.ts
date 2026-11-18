import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Category.tsx"), "utf8");

// Opening /products?page=N directly showed page 1: an effect reset the page on first render.
describe("catalogue ?page= deep links", () => {
  it("does not reset the page to 1 on first render", () => {
    expect(source).not.toContain("useEffect(() => { setPage(1); }, [promotion]);");
    expect(source).toContain("if (lastPromotion.current !== promotion) { lastPromotion.current = promotion; setPage(1); }");
    expect(source).toContain("const [page, setPage] = useState(requestedPage);");
  });
});
