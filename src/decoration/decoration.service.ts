import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { BannerFormDto, DecorationQueryDto, NoticeFormDto } from "./dto/decoration.dto";
import { DecorationBanner } from "./entities/banner.entity";
import { DecorationBrand } from "./entities/brand.entity";
import { DecorationNotice } from "./entities/decoration-notice.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class DecorationService {
  constructor(
    @InjectRepository(DecorationBanner)
    private readonly bannerRepository: Repository<DecorationBanner>,
    @InjectRepository(DecorationNotice)
    private readonly noticeRepository: Repository<DecorationNotice>,
    @InjectRepository(DecorationBrand)
    private readonly brandRepository: Repository<DecorationBrand>
  ) {}

  bannerPage(query: DecorationQueryDto) {
    return this.page(this.bannerRepository, query, "banner");
  }

  async bannerForm(id: string) {
    return this.find(this.bannerRepository, id, "Banner不存在");
  }

  async createBanner(dto: BannerFormDto) {
    const sort =
      dto.sort ?? ((await this.bannerRepository.maximum("sort", { isDeleted: 0 })) ?? 0) + 1;
    return this.bannerRepository.save(
      this.bannerRepository.create({ ...dto, sort, linkUrl: dto.linkUrl || null, isDeleted: 0 })
    );
  }

  async updateBanner(id: string, dto: BannerFormDto) {
    const row = await this.find(this.bannerRepository, id, "Banner不存在");
    Object.assign(row, dto, { linkUrl: dto.linkUrl || null });
    return this.bannerRepository.save(row);
  }

  async updateBannerStatus(id: string, status: number) {
    const row = await this.find(this.bannerRepository, id, "Banner不存在");
    row.status = status;
    await this.bannerRepository.save(row);
  }

  async removeBanner(id: string) {
    const row = await this.find(this.bannerRepository, id, "Banner不存在");
    row.isDeleted = 1;
    await this.bannerRepository.save(row);
  }

  noticePage(query: DecorationQueryDto) {
    return this.page(this.noticeRepository, query, "notice");
  }

  async noticeForm(id: string) {
    return this.find(this.noticeRepository, id, "公告不存在");
  }

  async createNotice(dto: NoticeFormDto) {
    const sort =
      dto.sort ?? ((await this.noticeRepository.maximum("sort", { isDeleted: 0 })) ?? 0) + 1;
    return this.noticeRepository.save(this.noticeRepository.create({ ...dto, sort, isDeleted: 0 }));
  }

  async updateNotice(id: string, dto: NoticeFormDto) {
    const row = await this.find(this.noticeRepository, id, "公告不存在");
    Object.assign(row, dto);
    return this.noticeRepository.save(row);
  }

  async updateNoticeStatus(id: string, status: number) {
    const row = await this.find(this.noticeRepository, id, "公告不存在");
    row.status = status;
    await this.noticeRepository.save(row);
  }

  async removeNotice(id: string) {
    const row = await this.find(this.noticeRepository, id, "公告不存在");
    row.isDeleted = 1;
    await this.noticeRepository.save(row);
  }

  async getBrand() {
    return (
      (await this.brandRepository.findOne({ where: { id: "1", isDeleted: 0 } })) ?? {
        id: "1",
        content: "",
      }
    );
  }

  async saveBrand(content: string) {
    const current = await this.brandRepository.findOne({ where: { id: "1" } });
    return this.brandRepository.save(
      current
        ? Object.assign(current, { content, isDeleted: 0 })
        : this.brandRepository.create({ id: "1", content, isDeleted: 0 })
    );
  }

  async appHome() {
    const [banners, notices, brand] = await Promise.all([
      this.bannerRepository.find({
        where: { status: 1, isDeleted: 0 },
        order: { sort: "ASC", id: "DESC" },
      }),
      this.noticeRepository.find({
        where: { status: 1, isDeleted: 0 },
        order: { sort: "ASC", id: "DESC" },
      }),
      this.getBrand(),
    ]);
    return { banners, notices, brandContent: brand.content };
  }

  private async page<T extends DecorationBanner | DecorationNotice>(
    repository: Repository<T>,
    query: DecorationQueryDto,
    alias: string
  ) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = repository.createQueryBuilder(alias).where(`${alias}.isDeleted = 0`);
    if (query.status !== undefined)
      qb.andWhere(`${alias}.status = :status`, { status: query.status });
    if (query.keywords && alias === "notice") {
      qb.andWhere(`${alias}.title LIKE :keywords`, { keywords: `%${query.keywords}%` });
    }
    const [data, total] = await qb
      .orderBy(`${alias}.sort`, "ASC")
      .addOrderBy(`${alias}.id`, "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data, page: { pageNum, pageSize, total } };
  }

  private async find<T extends { id: string; isDeleted: number }>(
    repository: Repository<T>,
    id: string,
    message: string
  ): Promise<T> {
    const row = await repository.findOne({ where: { id, isDeleted: 0 } as never });
    if (!row) throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: message });
    return row;
  }
}
