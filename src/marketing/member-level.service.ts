import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Not, Repository } from "typeorm";

import { MemberLevelSaveDto, PageDto } from "./dto/marketing.dto";
import { MemberLevel } from "./entities/member-level.entity";
import { Member } from "@/member/entities/member.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class MemberLevelService {
  constructor(
    @InjectRepository(MemberLevel)
    private readonly levelRepository: Repository<MemberLevel>,
    private readonly dataSource: DataSource
  ) {}

  async page(query: PageDto) {
    const [data, total] = await this.levelRepository.findAndCount({
      where: { isDeleted: 0 },
      order: { thresholdAmount: "ASC", sort: "ASC" },
      skip: (query.pageNum - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { data, page: { pageNum: query.pageNum, pageSize: query.pageSize, total } };
  }

  list() {
    return this.levelRepository.find({
      where: { isDeleted: 0, status: 1 },
      order: { thresholdAmount: "ASC", sort: "ASC" },
    });
  }

  async create(dto: MemberLevelSaveDto) {
    await this.assertThresholdAvailable(dto.thresholdAmount);
    try {
      return await this.levelRepository.save(this.levelRepository.create({ ...dto, isDeleted: 0 }));
    } catch (error) {
      if (this.isDuplicateEntry(error)) throw this.userError("累计实付门槛不能重复");
      throw error;
    }
  }

  async update(id: string, dto: MemberLevelSaveDto) {
    const level = await this.get(id);
    await this.assertThresholdAvailable(dto.thresholdAmount, id);
    Object.assign(level, dto);
    try {
      return await this.levelRepository.save(level);
    } catch (error) {
      if (this.isDuplicateEntry(error)) throw this.userError("累计实付门槛不能重复");
      throw error;
    }
  }

  async remove(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const level = await manager.findOne(MemberLevel, {
        where: { id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!level) throw this.userError("会员等级不存在");
      const used = await manager.count(Member, { where: { levelId: id, isDeleted: 0 } });
      if (used > 0) throw this.userError("该等级已有会员使用，不能删除");
      level.isDeleted = 1;
      await manager.save(level);
      return true;
    });
  }

  private async get(id: string) {
    const level = await this.levelRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!level) throw this.userError("会员等级不存在");
    return level;
  }

  private async assertThresholdAvailable(thresholdAmount: number, excludeId?: string) {
    const where = excludeId
      ? { thresholdAmount, id: Not(excludeId), isDeleted: 0 }
      : { thresholdAmount, isDeleted: 0 };
    if (await this.levelRepository.findOne({ where })) {
      throw this.userError("累计实付门槛不能重复");
    }
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }

  private isDuplicateEntry(error: unknown): boolean {
    const candidate = error as { code?: string; driverError?: { code?: string } };
    return (candidate.driverError?.code ?? candidate.code) === "ER_DUP_ENTRY";
  }
}
