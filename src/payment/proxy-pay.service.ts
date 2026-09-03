import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { createHash, randomBytes } from "crypto";
import { DataSource } from "typeorm";

import { ProxyPayShare } from "./entities/proxy-pay-share.entity";
import { Payment } from "./entities/payment.entity";
import { MIN_PAYMENT_REMAINING_MS, PaymentStatus } from "./payment-status";
import { PaymentService } from "./payment.service";
import { BizOrder } from "@/order/entities/order.entity";
import { BizOrderItem } from "@/order/entities/order-item.entity";
import { OrderService } from "@/order/order.service";
import { OrderStatus } from "@/order/order-status";
import { GroupBuyMember } from "@/group-buy/entities/group-buy-member.entity";
import { Member } from "@/member/entities/member.entity";
import { WechatAccessTokenService } from "@/common/wechat/wechat-access-token.service";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

export const ProxyPayStatus = {
  WAITING: "WAITING",
  PAYING: "PAYING",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
} as const;

type ProxyPayStatusValue = (typeof ProxyPayStatus)[keyof typeof ProxyPayStatus];

const STATUS_LABEL: Record<ProxyPayStatusValue, string> = {
  WAITING: "等待好友付款",
  PAYING: "好友支付中",
  EXPIRED: "代付已过期",
  CANCELLED: "订单已取消",
  PAID: "付款成功",
  REFUNDED: "订单已退款",
};

@Injectable()
export class ProxyPayService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly accessTokenService: WechatAccessTokenService
  ) {}

  async createShare(ownerMemberId: string, orderId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, orderId, ownerMemberId);
      if (
        order.status !== OrderStatus.UNPAID ||
        order.payAmount <= 0 ||
        this.orderDeadline(order).getTime() - Date.now() < MIN_PAYMENT_REMAINING_MS
      ) {
        throw this.userError("当前订单不可发起好友代付");
      }
      if (
        await manager.exists(GroupBuyMember, {
          where: { orderId: order.id, isDeleted: 0 },
        })
      ) {
        throw this.userError("拼团订单暂不支持好友代付");
      }

      for (let attempt = 0; attempt < 8; attempt++) {
        const token = randomBytes(16).toString("base64url");
        try {
          await manager.save(
            manager.create(ProxyPayShare, {
              orderId: order.id,
              ownerMemberId: order.memberId,
              tokenHash: this.hashToken(token),
              expiresAt: this.orderDeadline(order),
              isDeleted: 0,
            })
          );
          return { token, expiresAt: this.orderDeadline(order) };
        } catch (error) {
          if (!this.isDuplicateEntry(error) || attempt === 7) throw error;
        }
      }
      throw new Error("生成好友代付分享令牌失败");
    });
  }

  async preview(token: string) {
    const { share, order } = await this.resolveShare(token);
    const [owner, items, state] = await Promise.all([
      this.dataSource.manager.findOne(Member, {
        where: { id: share.ownerMemberId, isDeleted: 0 },
      }),
      this.dataSource.manager.find(BizOrderItem, {
        where: { orderId: share.orderId, isDeleted: 0 },
        order: { id: "ASC" },
      }),
      this.deriveStatus(share, order),
    ]);
    return {
      status: state.status,
      statusLabel: STATUS_LABEL[state.status],
      ownerNickname: owner?.nickname ?? "",
      ownerAvatar: owner?.avatar ?? null,
      payAmount: order.payAmount,
      expiresAt: share.expiresAt,
      items: items.map((item) => ({
        id: String(item.id),
        productName: item.productName,
        productImage: item.productImage ?? null,
        skuName: item.skuName ?? null,
        quantity: item.quantity,
      })),
      canPay: state.canPay,
    };
  }

  async status(token: string) {
    const { share, order } = await this.resolveShare(token);
    const state = await this.deriveStatus(share, order);
    return {
      status: state.status,
      statusLabel: STATUS_LABEL[state.status],
      expiresAt: share.expiresAt,
      canPay: state.canPay,
      paidAt: state.status === ProxyPayStatus.PAID ? (order.payTime ?? null) : undefined,
    };
  }

  async createPayment(payerMemberId: string, payerOpenid: string, token: string) {
    const { share, order } = await this.resolveShare(token);
    const state = await this.deriveStatus(share, order);
    if (!state.canPay) throw this.userError(STATUS_LABEL[state.status]);
    if (
      await this.dataSource.manager.exists(GroupBuyMember, {
        where: { orderId: order.id, isDeleted: 0 },
      })
    ) {
      throw this.userError("拼团订单暂不支持好友代付");
    }
    return this.paymentService.createForPayer(
      payerMemberId,
      payerOpenid,
      order.id,
      share.ownerMemberId
    );
  }

  async posterCode(ownerMemberId: string, token: string): Promise<Buffer> {
    const { share, order } = await this.resolveShare(token);
    if (String(share.ownerMemberId) !== String(ownerMemberId)) {
      throw this.invalidShareError();
    }
    const state = await this.deriveStatus(share, order);
    if (!state.canPay) throw this.userError(STATUS_LABEL[state.status]);

    const accessToken = await this.accessTokenService.getAccessToken();
    let response;
    try {
      response = await axios.post<ArrayBuffer>(
        "https://api.weixin.qq.com/wxa/getwxacodeunlimit",
        {
          scene: token,
          page: "pages-sub/order/proxy-pay/index",
          check_path: false,
        },
        {
          params: { access_token: accessToken },
          responseType: "arraybuffer",
          timeout: 10_000,
        }
      );
    } catch {
      throw this.providerError("生成微信小程序码失败");
    }
    const body = Buffer.from(response.data);
    const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
    if (!contentType.startsWith("image/") || body.length < 8) {
      throw this.providerError("微信未返回有效的小程序码");
    }
    return body;
  }

  private async resolveShare(token: string) {
    const share = await this.dataSource.manager.findOne(ProxyPayShare, {
      where: { tokenHash: this.hashToken(token), isDeleted: 0 },
    });
    if (!share) throw this.invalidShareError();
    const order = await this.dataSource.manager.findOne(BizOrder, {
      where: { id: share.orderId, isDeleted: 0 },
    });
    if (!order || String(order.memberId) !== String(share.ownerMemberId)) {
      throw this.invalidShareError();
    }
    return { share, order };
  }

  private async deriveStatus(share: ProxyPayShare, order: BizOrder) {
    let status: ProxyPayStatusValue;
    if (order.status === OrderStatus.REFUNDED) {
      status = ProxyPayStatus.REFUNDED;
    } else if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.VERIFIED ||
      order.status === OrderStatus.COMPLETED
    ) {
      status = ProxyPayStatus.PAID;
    } else if (order.status === OrderStatus.CANCELLED) {
      status =
        share.expiresAt.getTime() <= Date.now() || order.cancelReason === "支付超时自动取消"
          ? ProxyPayStatus.EXPIRED
          : ProxyPayStatus.CANCELLED;
    } else if (share.expiresAt.getTime() - Date.now() < MIN_PAYMENT_REMAINING_MS) {
      status = ProxyPayStatus.EXPIRED;
    } else {
      const active = await this.dataSource.manager.findOne(Payment, {
        where: { orderId: order.id, status: PaymentStatus.PENDING, isDeleted: 0 },
      });
      status =
        active?.expireTime && active.expireTime.getTime() > Date.now()
          ? ProxyPayStatus.PAYING
          : ProxyPayStatus.WAITING;
    }
    return {
      status,
      // 公开状态不知道访问者是谁；PAYING 时同一付款人可复用，其他付款人由支付接口拒绝。
      canPay: status === ProxyPayStatus.WAITING || status === ProxyPayStatus.PAYING,
    };
  }

  private orderDeadline(order: BizOrder): Date {
    const timeout = Number(this.configService.get<number>("ORDER_PAY_TIMEOUT_MINUTES", 30));
    return new Date(new Date(order.createTime).getTime() + timeout * 60_000);
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private isDuplicateEntry(error: unknown): boolean {
    const candidate = error as { code?: string; driverError?: { code?: string } };
    return (candidate.driverError?.code ?? candidate.code) === "ER_DUP_ENTRY";
  }

  private invalidShareError(): BusinessException {
    return this.userError("好友代付分享不存在或已失效");
  }

  private userError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }

  private providerError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.THIRD_PARTY_SERVICE_ERROR, msg });
  }
}
