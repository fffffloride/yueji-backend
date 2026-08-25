import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_settlement_config")
export class DistributionSettlementConfig extends BaseEntity {
  @Column({ name: "cycle_type", length: 16, comment: "结算周期" })
  cycleType: string;

  @Column({ name: "settlement_day", type: "tinyint", comment: "结算星期或日期" })
  settlementDay: number;

  @Column({ name: "withdrawal_mode", length: 16, comment: "提现模式" })
  withdrawalMode: string;

  @Column({ name: "single_limit_amount", type: "int", comment: "单笔提现上限(分)" })
  singleLimitAmount: number;
}
