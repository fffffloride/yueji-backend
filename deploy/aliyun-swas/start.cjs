"use strict";

// Keep older servers safe until their EnvironmentFile explicitly selects WeChat.
// Legacy mock/empty values must never prevent a production process from starting.
if (process.env.PAYMENT_DRIVER?.toLowerCase() !== "wechat") {
  process.env.PAYMENT_DRIVER = "disabled";
}
require("./application.js");
