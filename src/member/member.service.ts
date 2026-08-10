import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Member } from "./entities/member.entity";
import { MemberQueryDto } from "./dto/member-query.dto";
import { MemberProfileDto } from "./dto/member-profile.dto";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);

  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>
  ) {}

  async findById(id: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { id, isDeleted: 0 } });
  }

  async getById(id: string): Promise<Member> {
    const member = await this.findById(id);
    if (!member) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "会员不存在" });
    }
    return member;
  }

  async findByOpenid(openid: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { openid, isDeleted: 0 } });
  }

  async findByMobile(mobile: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { mobile, isDeleted: 0 } });
  }

  /**
   * 按 openid 查找会员，不存在则创建
   */
  async findOrCreateByOpenid(openid: string, unionid?: string | null): Promise<Member> {
    const existing = await this.findByOpenid(openid);
    if (existing) {
      if (unionid && !existing.unionid) {
        existing.unionid = unionid;
        await this.memberRepository.save(existing);
      }
      return existing;
    }

    const member = this.memberRepository.create({
      openid,
      unionid: unionid || null,
      nickname: "微信用户",
      status: 1,
      points: 0,
      isDeleted: 0,
    });
    await this.memberRepository.save(member);
    this.logger.log(`创建新会员：memberId=${member.id}, openid=${openid}`);
    return member;
  }

  /**
   * 为会员绑定手机号
   */
  async attachMobile(memberId: string, mobile: string): Promise<Member> {
    const member = await this.getById(memberId);
    member.mobile = mobile;
    await this.memberRepository.save(member);
    return member;
  }

  async touchLastLogin(memberId: string): Promise<void> {
    await this.memberRepository.update(memberId, { lastLoginTime: new Date() });
  }

  /**
   * C端：更新会员资料
   */
  async updateProfile(memberId: string, dto: MemberProfileDto): Promise<Member> {
    const member = await this.getById(memberId);
    if (dto.nickname !== undefined) member.nickname = dto.nickname;
    if (dto.avatar !== undefined) member.avatar = dto.avatar;
    if (dto.gender !== undefined) member.gender = dto.gender;
    await this.memberRepository.save(member);
    return member;
  }

  /**
   * B端：会员分页查询
   */
  async pageQuery(query: MemberQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.memberRepository.createQueryBuilder("member").where("member.isDeleted = 0");

    if (query.keywords) {
      qb.andWhere("(member.nickname LIKE :kw OR member.mobile LIKE :kw)", {
        kw: `%${query.keywords}%`,
      });
    }
    if (query.status !== undefined) {
      qb.andWhere("member.status = :status", { status: query.status });
    }

    const [list, total] = await qb
      .orderBy("member.createTime", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: list,
      page: { pageNum, pageSize, total },
    };
  }
}
