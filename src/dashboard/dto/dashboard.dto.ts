import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID } from "class-validator";

export class TrackVisitDto {
  @IsUUID("4")
  visitorId: string;
}

export class DashboardOverviewQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === "" ? 7 : Number(value)))
  @IsInt()
  @IsIn([7, 30])
  days = 7;
}

export interface DashboardActivity {
  id: string;
  type: string;
  content: string;
  occurredAt: string;
  targetRoute?: string;
}

export interface DashboardTodoItem {
  id: string;
  type: string;
  title: string;
  status: string;
  occurredAt: string;
  targetRoute: string;
}
