import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";

import { Product } from "./entities/product.entity";
import { ProductSku } from "./entities/product-sku.entity";
import { ProductCategory } from "./entities/product-category.entity";
import { ProductCategoryService } from "./product-category.service";
import { ProductFormDto, SkuFormDto } from "./dto/product-form.dto";
import { AppProductQueryDto, ProductQueryDto } from "./dto/product-query.dto";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductSku)
    private readonly skuRepository: Repository<ProductSku>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepository: Repository<ProductCategory>,
    private readonly categoryService: ProductCategoryService,
    private readonly dataSource: DataSource
  ) {}

  // ==================== B端 ====================

  async pageQuery(query: ProductQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.productRepository.createQueryBuilder("p").where("p.isDeleted = 0");

    if (query.keywords) {
      qb.andWhere("p.name LIKE :kw", { kw: `%${query.keywords}%` });
    }
    if (query.categoryId) {
      qb.andWhere("p.categoryId = :categoryId", { categoryId: query.categoryId });
    }
    if (query.status !== undefined) {
      qb.andWhere("p.status = :status", { status: query.status });
    }

    const [list, total] = await qb
      .orderBy("p.sort", "ASC")
      .addOrderBy("p.createTime", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // 分类名称回填
    const categoryIds = Array.from(new Set(list.map((p) => String(p.categoryId))));
    const categories = categoryIds.length
      ? await this.categoryRepository.find({ where: { id: In(categoryIds) } })
      : [];
    const categoryMap = new Map(categories.map((c) => [String(c.id), c.name]));

    const data = list.map((p) => ({
      ...this.toVo(p),
      categoryName: categoryMap.get(String(p.categoryId)) ?? "",
    }));

    return { data, page: { pageNum, pageSize, total } };
  }

  /**
   * B端：商品表单数据（含SKU列表）
   */
  async getFormData(id: string) {
    const product = await this.getById(id);
    const skus = await this.skuRepository.find({
      where: { productId: id, isDeleted: 0 },
      order: { id: "ASC" },
    });
    return { ...this.toVo(product), skus };
  }

  async create(dto: ProductFormDto): Promise<Product> {
    await this.ensureCategoryExists(dto.categoryId);

    return this.dataSource.transaction(async (manager) => {
      const product = manager.create(Product, {
        ...this.formToEntityFields(dto),
        sales: 0,
        stock: this.sumStock(dto.skus),
        isDeleted: 0,
      });
      await manager.save(product);

      const skus = dto.skus.map((s) =>
        manager.create(ProductSku, {
          productId: product.id,
          name: s.name,
          specs: s.specs ?? null,
          skuCode: s.skuCode ?? null,
          price: s.price,
          originalPrice: s.originalPrice ?? null,
          stock: s.stock,
          status: s.status ?? 1,
          isDeleted: 0,
        })
      );
      await manager.save(skus);

      // SPU 现售价取最低启用SKU价
      product.price = this.minEnabledPrice(dto.skus);
      await manager.save(product);
      return product;
    });
  }

  async update(id: string, dto: ProductFormDto): Promise<Product> {
    const product = await this.getById(id);
    await this.ensureCategoryExists(dto.categoryId);

    return this.dataSource.transaction(async (manager) => {
      Object.assign(product, this.formToEntityFields(dto));
      product.stock = this.sumStock(dto.skus);
      product.price = this.minEnabledPrice(dto.skus);
      await manager.save(product);

      const existingSkus = await manager.find(ProductSku, {
        where: { productId: id, isDeleted: 0 },
      });
      const incomingIds = new Set(dto.skus.filter((s) => s.id).map((s) => String(s.id)));

      // 删除表单中已移除的SKU
      for (const sku of existingSkus) {
        if (!incomingIds.has(String(sku.id))) {
          sku.isDeleted = 1;
          await manager.save(sku);
        }
      }

      // 更新或新增
      for (const s of dto.skus) {
        if (s.id) {
          const existing = existingSkus.find((e) => String(e.id) === String(s.id));
          if (!existing) {
            throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: `SKU不存在：${s.id}` });
          }
          existing.name = s.name;
          existing.specs = s.specs ?? null;
          existing.skuCode = s.skuCode ?? null;
          existing.price = s.price;
          existing.originalPrice = s.originalPrice ?? null;
          existing.stock = s.stock;
          existing.status = s.status ?? 1;
          await manager.save(existing);
        } else {
          const created = manager.create(ProductSku, {
            productId: id,
            name: s.name,
            specs: s.specs ?? null,
            skuCode: s.skuCode ?? null,
            price: s.price,
            originalPrice: s.originalPrice ?? null,
            stock: s.stock,
            status: s.status ?? 1,
            isDeleted: 0,
          });
          await manager.save(created);
        }
      }

      return product;
    });
  }

  async updateStatus(id: string, status: number): Promise<void> {
    await this.getById(id);
    await this.productRepository.update(id, { status });
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Product, id, { isDeleted: 1 });
      await manager.update(ProductSku, { productId: id }, { isDeleted: 1 });
    });
  }

  // ==================== C端 ====================

  async appPage(query: AppProductQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.productRepository
      .createQueryBuilder("p")
      .where("p.isDeleted = 0")
      .andWhere("p.status = 1");

    if (query.keywords) {
      qb.andWhere("p.name LIKE :kw", { kw: `%${query.keywords}%` });
    }
    if (query.categoryId) {
      const categoryIds = await this.categoryService.getSelfAndDescendantIds(query.categoryId);
      qb.andWhere("p.categoryId IN (:...categoryIds)", { categoryIds });
    }
    if (query.tag) {
      qb.andWhere("p.tags LIKE :tag", { tag: `%${query.tag}%` });
    }

    switch (query.sortType) {
      case "sales":
        qb.orderBy("p.sales", "DESC");
        break;
      case "priceAsc":
        qb.orderBy("p.price", "ASC");
        break;
      case "priceDesc":
        qb.orderBy("p.price", "DESC");
        break;
      case "new":
        qb.orderBy("p.createTime", "DESC");
        break;
      default:
        qb.orderBy("p.sort", "ASC").addOrderBy("p.sales", "DESC");
    }

    const [list, total] = await qb
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // C端商品卡片：精简字段
    const data = list.map((p) => ({
      id: p.id,
      name: p.name,
      subTitle: p.subTitle,
      mainImage: p.mainImage,
      tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
      price: p.price,
      originalPrice: p.originalPrice,
      sales: p.sales,
    }));

    return { data, page: { pageNum, pageSize, total } };
  }

  async appDetail(id: string) {
    const product = await this.productRepository.findOne({
      where: { id, isDeleted: 0, status: 1 },
    });
    if (!product) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "商品不存在或已下架" });
    }

    const skus = await this.skuRepository.find({
      where: { productId: id, isDeleted: 0, status: 1 },
      order: { id: "ASC" },
    });

    return {
      ...this.toVo(product),
      tags: product.tags ? product.tags.split(",").filter(Boolean) : [],
      skus: skus.map((s) => ({
        id: s.id,
        name: s.name,
        specs: s.specs,
        price: s.price,
        originalPrice: s.originalPrice,
        stock: s.stock,
      })),
    };
  }

  // ==================== 私有方法 ====================

  private async getById(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!product) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "商品不存在" });
    }
    return product;
  }

  private async ensureCategoryExists(categoryId: string): Promise<void> {
    const count = await this.categoryRepository.count({
      where: { id: categoryId, isDeleted: 0 },
    });
    if (count === 0) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "商品分类不存在" });
    }
  }

  private formToEntityFields(dto: ProductFormDto) {
    return {
      name: dto.name,
      categoryId: dto.categoryId,
      subTitle: dto.subTitle ?? null,
      mainImage: dto.mainImage ?? null,
      album: dto.album ? JSON.stringify(dto.album) : null,
      videoUrl: dto.videoUrl ?? null,
      tags: dto.tags ?? null,
      originalPrice: dto.originalPrice ?? null,
      detail: dto.detail ?? null,
      usageNote: dto.usageNote ?? null,
      status: dto.status ?? 0,
      sort: dto.sort ?? 0,
    };
  }

  private sumStock(skus: SkuFormDto[]): number {
    return skus.filter((s) => (s.status ?? 1) === 1).reduce((sum, s) => sum + s.stock, 0);
  }

  private minEnabledPrice(skus: SkuFormDto[]): number {
    const enabled = skus.filter((s) => (s.status ?? 1) === 1);
    if (enabled.length === 0) return 0;
    return Math.min(...enabled.map((s) => s.price));
  }

  /** 实体转VO：album JSON 字符串转数组 */
  private toVo(product: Product) {
    return {
      ...product,
      album: product.album ? (JSON.parse(product.album) as string[]) : [],
    };
  }
}
