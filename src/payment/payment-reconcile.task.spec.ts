import { PaymentReconcileTask } from "./payment-reconcile.task";

describe("PaymentReconcileTask", () => {
  it("同一进程不重入且只由取得分布式锁的实例执行", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const paymentService = { reconcilePending: jest.fn(() => pending) };
    const client = {
      set: jest.fn().mockResolvedValue("OK"),
      eval: jest.fn().mockResolvedValue(1),
    };
    const task = new PaymentReconcileTask(
      paymentService as never,
      { getClient: () => client } as never
    );

    const first = task.runOnce();
    await Promise.resolve();
    await task.runOnce();
    expect(paymentService.reconcilePending).toHaveBeenCalledTimes(1);

    finish();
    await first;
    expect(client.eval).toHaveBeenCalledTimes(1);
  });

  it("未取得分布式锁时不扫描支付和退款", async () => {
    const paymentService = { reconcilePending: jest.fn() };
    const client = {
      set: jest.fn().mockResolvedValue(null),
      eval: jest.fn(),
    };
    const task = new PaymentReconcileTask(
      paymentService as never,
      { getClient: () => client } as never
    );

    await task.runOnce();

    expect(paymentService.reconcilePending).not.toHaveBeenCalled();
    expect(client.eval).not.toHaveBeenCalled();
  });
});
