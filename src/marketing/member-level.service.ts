import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";

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
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>
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
    return this.levelRepository.save(this.levelRepository.create({ ...dto, isDeleted: 0 }));
  }

  async update(id: string, dto: MemberLevelSaveDto) {
    const level = await this.get(id);
    await this.assertThresholdAvailable(dto.thresholdAmount, id);
    Object.assign(level, dto);
    return this.levelRepository.save(level);
  }

  async remove(id: string) {
    const level = await this.get(id);
    const used = await this.memberRepository.count({ where: { levelId: id, isDeleted: 0 } });
    if (used > 0) throw this.userError("该等级已有会员使用，不能删除");
    level.isDeleted = 1;
    await this.levelRepository.save(level);
    return true;
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
}
