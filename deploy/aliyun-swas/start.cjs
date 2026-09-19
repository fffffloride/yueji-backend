"use strict";

// Keep older servers safe until their EnvironmentFile explicitly selects WeChat.
// An explicit disabled/wechat value is preserved; production still rejects mock.
process.env.PAYMENT_DRIVER ||= "disabled";
require("./application.js");
