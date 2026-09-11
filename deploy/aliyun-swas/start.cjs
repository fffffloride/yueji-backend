"use strict";

// This deployment has no merchant setup yet; keep payment disabled with the release.
process.env.PAYMENT_DRIVER = "disabled";
require("./application.js");
