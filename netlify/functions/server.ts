import type { Handler } from "@netlify/functions";
import serverless from "serverless-http";
import { createProductionApp } from "../../server/_core/index";

let handlerPromise: Promise<Handler> | undefined;

const getHandler = async () => {
  if (!handlerPromise) {
    handlerPromise = createProductionApp().then(app => serverless(app, { basePath: "/.netlify/functions/server" }));
  }
  return handlerPromise;
};

export const handler: Handler = async (event, context) => {
  const handler = await getHandler();
  return handler(event, context);
};
