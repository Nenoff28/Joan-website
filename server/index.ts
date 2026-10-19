import { startServer } from "./_core/index";

startServer().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
