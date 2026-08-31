import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { AgreementType, AGREEMENT_TYPE_LABEL } from "./agreement.constants";
import { AgreementDraftDto } from "./dto/agreement.dto";
import { Agreement } from "./entities/agreement.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class AgreementService {
  constructor(
    @InjectRepository(Agreement)
    private readonly agreementRepository: Repository<Agreement>,
    private readonly dataSource: DataSource
  ) {}

  async list() {
    const rows = await this.agreementRepository.find({
      where: { isDeleted: 0 },
      order: { id: "ASC" },
    });
    return rows.map((row) => ({
      type: row.type,
      typeLabel: AGREEMENT_TYPE_LABEL[row.type],
      draftTitle: row.draftTitle,
      published: Boolean(row.publishedContent),
      publishTime: row.publishTime,
      updateTime: row.updateTime,
    }));
  }

  async form(type: AgreementType) {
    const row = await this.get(type);
    return { type: row.type, title: row.draftTitle, content: row.draftContent };
  }

  async saveDraft(type: AgreementType, dto: AgreementDraftDto, updateBy?: string) {
    const row = await this.get(type);
    const title = dto.title.trim();
    const content = dto.content.trim();
    if (!title || !content) throw this.userError("协议标题和正文不能为空");
    row.draftTitle = title;
    row.draftContent = content;
    row.updateBy = updateBy;
    await this.agreementRepository.save(row);
    return true;
  }

  async publish(type: AgreementType, updateBy?: string) {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(Agreement, {
        where: { type, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!row) throw this.userError("协议不存在");
      if (!row.draftTitle.trim() || !row.draftContent.trim()) {
        throw this.userError("协议标题和正文不能为空");
      }
      row.publishedTitle = row.draftTitle.trim();
      row.publishedContent = row.draftContent.trim();
      row.publishTime = new Date();
      row.updateBy = updateBy;
      await manager.save(row);
      return true;
    });
  }

  async published(type: AgreementType) {
    const row = await this.get(type);
    if (!row.publishedTitle || !row.publishedContent || !row.publishTime) {
      throw this.userError("协议暂未发布");
    }
    return {
      type: row.type,
      title: row.publishedTitle,
      content: row.publishedContent,
      publishTime: row.publishTime,
    };
  }

  private async get(type: AgreementType) {
    const row = await this.agreementRepository.findOne({ where: { type, isDeleted: 0 } });
    if (!row) throw this.userError("协议不存在");
    return row;
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
