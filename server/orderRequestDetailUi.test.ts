import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  resolve(process.cwd(), "client/src/App.tsx"),
  "utf8"
);
const adminSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Admin.tsx"),
  "utf8"
);
const detailSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/AdminOrderDetail.tsx"),
  "utf8"
);

describe("order request detail UI", () => {
  it("registers a dedicated protected request URL before the generic admin section", () => {
    const detailRoute =
      '<Route path="/admin/requests/:id" component={AdminOrderDetailClientRoute} />';
    expect(appSource).toContain(detailRoute);
    expect(appSource.indexOf(detailRoute)).toBeLessThan(
      appSource.indexOf(
        '<Route path={"/admin/:section"} component={AdminClientRoute} />'
      )
    );
  });

  it("turns the request queue into navigation to the separate record", () => {
    const orderCard = adminSource.slice(
      adminSource.indexOf("function OrderCard"),
      adminSource.indexOf("function ContactEnquiryCard")
    );
    expect(adminSource).toContain("href={`/admin/requests/${order.id}`}");
    expect(adminSource).toContain(
      'className="admin-order-card admin-order-card-link"'
    );
    expect(orderCard).not.toContain(
      'placeholder="видимо само за администратори"'
    );
  });

  it("shows every item snapshot and an append-only status/comment timeline", () => {
    expect(detailSource).toContain("Артикули в заявката");
    expect(detailSource).toContain("Технически данни и параметри");
    expect(detailSource).toContain("История на статусите и коментарите");
    expect(detailSource).toContain("Най-новите са най-горе");
    expect(detailSource).toContain(
      "Авторът се добавя автоматично от активния профил."
    );
    expect(detailSource).toContain("Добави в историята");
    expect(detailSource).toContain("utils.admin.orderDetail.invalidate");
  });

  it("does not render an editor for a prior history entry", () => {
    expect(detailSource).toContain("order.history.map(entry");
    expect(detailSource).toContain("entry.authorName");
    expect(detailSource).toContain("entry.comment");
    expect(detailSource).not.toContain("onChange={event => setHistory");
  });
});
