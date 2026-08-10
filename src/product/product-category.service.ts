import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ProductCategory } from "./entities/product-category.entity";
import { Product } from "./entities/product.entity";
import { CategoryFormDto } from "./dto/category-form.dto";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

export interface CategoryTreeNode {
  id: string;
  name: string;
  parentId: string;
  level: number;
  icon?: string | null;
  sort: number;
  status: number;
  children?: CategoryTreeNode[];
}

const MAX_LEVEL = 3;

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepository: Repository<ProductCategory>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) {}

  private async listAll(onlyEnabled = false): Promise<ProductCategory[]> {
    const where: Record<string, unknown> = { isDeleted: 0 };
    if (onlyEnabled) where.status = 1;
    return this.categoryRepository.find({
      where,
      order: { sort: "ASC", id: "ASC" },
    });
  }

  /**
   * 分类树（B端含禁用，C端仅启用）
   */
  async tree(onlyEnabled = false): Promise<CategoryTreeNode[]> {
    const list = await this.listAll(onlyEnabled);
    return this.buildTree(list, "0");
  }

  private buildTree(list: ProductCategory[], parentId: string): CategoryTreeNode[] {
    return list
      .filter((c) => String(c.parentId) === String(parentId))
      .map((c) => {
        const children = this.buildTree(list, c.id);
        const node: CategoryTreeNode = {
          id: c.id,
          name: c.name,
          parentId: String(c.parentId),
          level: c.level,
          icon: c.icon,
          sort: c.sort,
          status: c.status,
        };
        if (children.length > 0) node.children = children;
        return node;
      });
  }

  async getById(id: string): Promise<ProductCategory> {
    const category = await this.categoryRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!category) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "分类不存在" });
    }
    return category;
  }

  async create(dto: CategoryFormDto): Promise<ProductCategory> {
    const parentId = dto.parentId ?? "0";
    let treePath = "0";
    let level = 1;

    if (parentId !== "0") {
      const parent = await this.getById(parentId);
      if (parent.level >= MAX_LEVEL) {
        throw new BusinessException({
          ...ErrorCode.USER_ERROR,
          msg: `最多支持${MAX_LEVEL}级分类`,
        });
      }
      treePath = `${parent.treePath},${parent.id}`;
      level = parent.level + 1;
    }

    const category = this.categoryRepository.create({
      name: dto.name,
      parentId,
      treePath,
      level,
      icon: dto.icon ?? null,
      sort: dto.sort ?? 0,
      status: dto.status ?? 1,
      isDeleted: 0,
    });
    return this.categoryRepository.save(category);
  }

  async update(id: string, dto: CategoryFormDto): Promise<ProductCategory> {
    const category = await this.getById(id);
    const newParentId = dto.parentId ?? "0";

    if (newParentId === id) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "父分类不能是自己" });
    }

    // 父分类变更时重算层级路径（存在子分类时禁止移动，避免整棵子树重算）
    if (newParentId !== String(category.parentId)) {
      const childCount = await this.categoryRepository.count({
        where: { parentId: id, isDeleted: 0 },
      });
      if (childCount > 0) {
        throw new BusinessException({
          ...ErrorCode.USER_ERROR,
          msg: "该分类下存在子分类，不允许变更父级",
        });
      }

      if (newParentId === "0") {
        category.treePath = "0";
        category.level = 1;
      } else {
        const parent = await this.getById(newParentId);
        if (parent.level >= MAX_LEVEL) {
          throw new BusinessException({
            ...ErrorCode.USER_ERROR,
            msg: `最多支持${MAX_LEVEL}级分类`,
          });
        }
        if (parent.treePath.split(",").includes(id)) {
          throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "不能移动到自己的子分类下" });
        }
        category.treePath = `${parent.treePath},${parent.id}`;
        category.level = parent.level + 1;
      }
      category.parentId = newParentId;
    }

    category.name = dto.name;
    if (dto.icon !== undefined) category.icon = dto.icon;
    if (dto.sort !== undefined) category.sort = dto.sort;
    if (dto.status !== undefined) category.status = dto.status;

    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);

    const childCount = await this.categoryRepository.count({
      where: { parentId: id, isDeleted: 0 },
    });
    if (childCount > 0) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "存在子分类，无法删除" });
    }

    const productCount = await this.productRepository.count({
      where: { categoryId: id, isDeleted: 0 },
    });
    if (productCount > 0) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "分类下存在商品，无法删除" });
    }

    await this.categoryRepository.update(id, { isDeleted: 1 });
  }

  /**
   * 获取指定分类及其所有后代分类的ID（C端按分类筛选商品用）
   */
  async getSelfAndDescendantIds(categoryId: string): Promise<string[]> {
    const list = await this.listAll();
    const result: string[] = [categoryId];
    const collect = (parentId: string) => {
      for (const c of list) {
        if (String(c.parentId) === String(parentId)) {
          result.push(c.id);
          collect(c.id);
        }
      }
    };
    collect(categoryId);
    return result;
  }
}
