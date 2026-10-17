import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const app = readFileSync("client/src/App.tsx", "utf8");
const layout = readFileSync("client/src/components/DashboardLayout.tsx", "utf8");
describe("administrator SSR safety", () => {
  it("does not render the lazy administrator module before hydration", () => {
    expect(app).toContain("function AdminClientRoute()");
    expect(app).toContain("const [ready, setReady] = useState(false)");
    expect(app).toContain("setReady(true)");
    expect(app).toContain("if (!ready) return");
    expect(app).toContain('component={AdminClientRoute}');
    expect(app).not.toMatch(/<Route[^>]*component=\{Admin\}/);
  });
  it("uses an SSR-safe sidebar width and resolves staff access rather than Manus-only UI roles", () => {
    expect(layout).toContain("useState(DEFAULT_WIDTH)");
    expect(layout).toContain("trpc.staff.me.useQuery");
    expect(layout).toContain("canVisitAdminSection");
    expect(layout).not.toContain('user.role !== "admin"');
    expect(layout).not.toMatch(/useState\(\(\)\s*=>\s*\{\s*const saved = localStorage/);
  });
});
