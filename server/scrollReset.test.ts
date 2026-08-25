import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("global route scroll reset", () => {
  it("resets the window to the top whenever Wouter reports a new location", () => {
    expect(appSource).toContain('import { Route, Switch, useLocation } from "wouter"');
    expect(appSource).toContain("function ScrollToTop()");
    expect(appSource).toContain("const [location] = useLocation()");
    expect(appSource).toContain("useLayoutEffect");
    expect(appSource).toContain('root.style.scrollBehavior = "auto"');
    expect(appSource).toContain("window.scrollTo(0, 0)");
    expect(appSource).toContain("window.requestAnimationFrame(() => window.scrollTo(0, 0))");
    expect(appSource).toContain("}, [location])");
  });

  it("mounts the reset once above every storefront and administrator route", () => {
    expect(appSource).toContain("<ScrollToTop />");
    expect(appSource).toContain('<Route path={"/products"} component={AllProducts} />');
    expect(appSource).toContain('<Route path={"/admin/:section"} component={Admin} />');
  });
});
