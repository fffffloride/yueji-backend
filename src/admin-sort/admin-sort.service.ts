import { Injectable } from "@nestjs/common";
import { DataSource, EntityTarget, FindOptionsWhere, Not } from "typeorm";

import { MovePositionDto } from "@/common/dto/move-position.dto";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { moveIdToPosition } from "@/common/utils/position.util";
import { DecorationBanner } from "@/decoration/entities/banner.entity";
import { DecorationNotice } from "@/decoration/entities/decoration-notice.entity";
import { DistributionAgentType } from "@/distribution/entities/agent-type.entity";
import { ProductCategory } from "@/product/entities/product-category.entity";
import { Product } from "@/product/entities/product.entity";
import { ROOT_ROLE_CODE } from "@/common/constants/role.constant";
import { SysDept } from "@/system/dept/entities/sys-dept.entity";
import { SysDictItem } from "@/system/dict/entities/sys-dict-item.entity";
import { SysMenu } from "@/system/menu/entities/sys-menu.entity";
import { SysRole } from "@/system/role/entities/sys-role.entity";

type SortableRow = { id: string; sort: number };
type MoveOptions<T> = {
  where?: FindOptionsWhere<T>;
  scopeField?: keyof T;
  expectedScope?: string;
  label: string;
};

@Injectable()
export class AdminSortService {
  constructor(private readonly dataSource: DataSource) {}

  moveProduct(id: string, dto: MovePositionDto) {
    return this.move(Product, id, dto, { where: { isDeleted: 0 }, label: "商品" });
  }

  moveProductCategory(id: string, dto: MovePositionDto) {
    return this.move(ProductCategory, id, dto, {
      where: { isDeleted: 0 },
      scopeField: "parentId",
      expectedScope: dto.parentId,
      label: "商品分类",
    });
  }

  moveBanner(id: string, dto: MovePositionDto) {
    return this.move(DecorationBanner, id, dto, { where: { isDeleted: 0 }, label: "Banner" });
  }

  moveNotice(id: string, dto: MovePositionDto) {
    return this.move(DecorationNotice, id, dto, { where: { isDeleted: 0 }, label: "公告" });
  }

  moveAgentType(id: string, dto: MovePositionDto) {
    return this.move(DistributionAgentType, id, dto, {
      where: { isDeleted: 0 },
      label: "代理类型",
    });
  }

  moveRole(id: string, dto: MovePositionDto) {
    return this.move(SysRole, id, dto, {
      where: { isDeleted: 0, code: Not(ROOT_ROLE_CODE) },
      label: "角色",
    });
  }

  moveDictItem(dictCode: string, id: string, dto: MovePositionDto) {
    return this.move(SysDictItem, id, dto, {
      scopeField: "dictCode",
      expectedScope: dictCode,
      label: "字典项",
    });
  }

  moveDept(id: string, dto: MovePositionDto) {
    return this.move(SysDept, id, dto, {
      where: { isDeleted: 0 },
      scopeField: "parentId",
      expectedScope: dto.parentId,
      label: "部门",
    });
  }

  moveMenu(id: string, dto: MovePositionDto) {
    return this.move(SysMenu, id, dto, {
      scopeField: "parentId",
      expectedScope: dto.parentId,
      label: "菜单",
    });
  }

  private move<T extends SortableRow>(
    entity: EntityTarget<T>,
    id: string,
    dto: MovePositionDto,
    options: MoveOptions<T>
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(entity);
      const target = await repository.findOne({
        where: { ...(options.where as object), id } as FindOptionsWhere<T>,
        lock: { mode: "pessimistic_write" },
      });
      if (!target) throw this.userError(`${options.label}不存在`);

      const scopeValue = options.scopeField ? String(target[options.scopeField] ?? "0") : undefined;
      if (options.expectedScope !== undefined && String(options.expectedScope) !== scopeValue) {
        throw this.userError(`${options.label}只能在同级内排序`);
      }

      const where = {
        ...(options.where as object),
        ...(options.scopeField ? { [options.scopeField]: target[options.scopeField] } : {}),
      } as FindOptionsWhere<T>;
      const rows = await repository.find({
        where,
        order: { sort: "ASC", id: "ASC" } as never,
        lock: { mode: "pessimistic_write" },
      });

      let orderedIds: string[];
      try {
        orderedIds = moveIdToPosition(
          rows.map((row) => String(row.id)),
          String(id),
          dto.position
        );
      } catch (error) {
        throw this.userError(error instanceof Error ? error.message : "排序失败");
      }

      const rowsById = new Map(rows.map((row) => [String(row.id), row]));
      for (const [index, rowId] of orderedIds.entries()) {
        const position = index + 1;
        if (rowsById.get(rowId)?.sort !== position) {
          await repository.update(rowId, { sort: position } as never);
        }
      }
      return { id, position: dto.position };
    });
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
