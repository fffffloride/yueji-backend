import { createHmac } from "node:crypto";
import {
  ReadinessController,
  ReadinessService,
  validReadinessSignature,
} from "./readiness.service";

describe("release readiness", () => {
  const secret = "test-only-readiness-key";
  const sign = (stamp: string) =>
    createHmac("sha256", secret).update(`yueji-release-readiness:v1:${stamp}`).digest("hex");

  it("accepts scoped short-lived signatures and rejects stale or malformed signatures", () => {
    const stamp = String(Math.floor(Date.now() / 1000));
    const old = String(Math.floor(Date.now() / 1000) - 60);
    expect(validReadinessSignature(secret, stamp, sign(stamp))).toBe(true);
    expect(validReadinessSignature(secret, old, sign(old))).toBe(false);
    expect(validReadinessSignature(secret, stamp, "Bearer admin-token")).toBe(false);
    expect(validReadinessSignature(secret, stamp, "a".repeat(64))).toBe(false);
  });

  it("does not run business queries for an unauthenticated request", async () => {
    const readiness = { checkBusiness: jest.fn() };
    const controller = new ReadinessController(
      readiness as any,
      {
        getOrThrow: () => secret,
      } as any
    );
    await expect(controller.check(undefined, undefined)).rejects.toThrow();
    expect(readiness.checkBusiness).not.toHaveBeenCalled();
  });

  it("refuses startup when a mapped column is missing, including on empty tables", async () => {
    const db = {
      entityMetadatas: [
        { tableName: "appointment_config", columns: [{ databaseName: "slot_capacity" }] },
      ],
      driver: { escape: (name: string) => `\`${name}\`` },
      query: jest.fn().mockRejectedValue(new Error("Unknown column slot_capacity")),
    };
    const service = new ReadinessService(db as any, {} as any, {} as any);
    await expect(service.onApplicationBootstrap()).rejects.toThrow("Unknown column");
  });

  it("uses real order detail and appointment business paths without returning their data", async () => {
    const appointments = {
      getConfig: jest.fn(),
      getAdminSummary: jest.fn(),
      pageQuery: jest.fn(),
    };
    const orders = {
      adminPage: jest.fn().mockResolvedValue({ data: [{ id: "123", contactMobile: "private" }] }),
      getDetail: jest.fn().mockResolvedValue({ contactMobile: "private" }),
    };
    const db = { entityMetadatas: [], query: jest.fn().mockResolvedValue([{ slot_capacity: 1 }]) };
    const service = new ReadinessService(db as any, appointments as any, orders as any);
    expect(await service.checkBusiness()).toEqual({ ready: true });
    expect(orders.getDetail).toHaveBeenCalledWith("123");
    expect(appointments.pageQuery).toHaveBeenCalled();
  });
});
