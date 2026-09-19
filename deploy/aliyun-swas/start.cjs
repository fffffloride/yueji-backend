"use strict";

// Keep the packaged entrypoint stable while allowing the server EnvironmentFile
// to select disabled/wechat. Production validation still rejects mock payments.
require("./application.js");
