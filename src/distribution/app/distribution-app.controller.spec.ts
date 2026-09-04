import "reflect-metadata";
import { PATH_METADATA } from "@nestjs/common/constants";
import { DistributionAppController } from "./distribution-app.controller";
import { IS_MEMBER_API_KEY } from "@/common/decorators/member-auth.decorator";

describe("distribution app access", () => {
  it("requires member authentication and exposes no agent application route", () => {
    expect(Reflect.getMetadata(IS_MEMBER_API_KEY, DistributionAppController)).toBe(true);
    const prototype = DistributionAppController.prototype;
    const routes = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== "constructor")
      .map((name) => Reflect.getMetadata(PATH_METADATA, prototype[name]));
    expect(routes).not.toContain("applications");
    expect(routes).toContain("profile");
    expect(routes).toContain("withdrawals");
  });
});
