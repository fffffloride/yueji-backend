"use strict";

const fs = require("node:fs");
const startupError = "/tmp/yueji-backend-startup-error.log";
try {
  fs.unlinkSync(startupError);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const failStartup = (reason) => {
  const name = String(reason?.name || "Error").replace(/[\r\n]/g, " ").slice(0, 120);
  const message = String(reason?.message || reason || "Unknown startup error")
    .replace(/[\r\n]/g, " ")
    .slice(0, 2000);
  try {
    fs.writeFileSync(startupError, JSON.stringify({ name, message }) + "\n", { mode: 0o644 });
  } finally {
    process.exit(1);
  }
};
process.once("uncaughtException", failStartup);
process.once("unhandledRejection", failStartup);

// Keep older servers safe until their EnvironmentFile explicitly selects WeChat.
// Legacy mock/empty values must never prevent a production process from starting.
if (process.env.PAYMENT_DRIVER?.toLowerCase() !== "wechat") {
  process.env.PAYMENT_DRIVER = "disabled";
}
require("./application.js");
