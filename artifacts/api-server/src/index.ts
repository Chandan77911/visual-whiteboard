import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT ?? 5010);

app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
