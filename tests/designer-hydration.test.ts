import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import DesignerScreen from "../components/designer/DesignerScreen";

test("the initial studio HTML is identical on server and client hydration renders", () => {
  const server = renderToString(createElement(DesignerScreen));
  const client = renderToString(createElement(DesignerScreen));
  expect(server).toContain("data-id=");
  expect(client).toBe(server);
});
