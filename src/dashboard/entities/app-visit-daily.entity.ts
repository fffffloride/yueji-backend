import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("app_visit_daily")
@Index("uk_app_visit_daily_date_visitor", ["visitDate", "visitorId"], { unique: true })
export class AppVisitDaily {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({ name: "visit_date", type: "date", comment: "访问日期" })
  visitDate: string;

  @Column({ name: "visitor_id", length: 36, comment: "匿名访客UUID" })
  visitorId: string;

  @Column({ name: "pv_count", type: "int", default: 1, comment: "当日页面浏览量" })
  pvCount: number;

  @Column({ name: "first_visit_time", type: "datetime", comment: "当日首次访问时间" })
  firstVisitTime: Date;

  @Column({ name: "last_visit_time", type: "datetime", comment: "当日最近访问时间" })
  lastVisitTime: Date;
}
