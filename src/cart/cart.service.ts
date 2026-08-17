import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";

import { Cart } from "./entities/cart.entity";
import { CartAddDto } from "./dto/cart-add.dto";
import { CartUpdateDto } from "./dto/cart-update.dto";
import { ProductService } from "@/product/product.service";
import { Product } from "@/product/entities/product.entity";
import { ProductSku } from "@/product/entities/product-sku.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductSku)
    private readonly skuRepository: Repository<ProductSku>,
    private readonly productService: ProductService,
    private readonly dataSource: DataSource
  ) {}

  async list(memberId: string) {
    const rows = await this.cartRepository.find({
      where: { memberId, isDeleted: 0 },
      order: { updateTime: "DESC", id: "DESC" },
    });
    if (rows.length === 0) return [];

    const productIds = Array.from(new Set(rows.map((r) => String(r.productId))));
    const skuIds = Array.from(new Set(rows.map((r) => String(r.skuId))));
    const [products, skus] = await Promise.all([
      this.productRepository.find({ where: { id: In(productIds) } }),
      this.skuRepository.find({ where: { id: In(skuIds) } }),
    ]);
    const productMap = new Map(products.map((p) => [String(p.id), p]));
    const skuMap = new Map(skus.map((s) => [String(s.id), s]));

    return rows.map((row) => {
      const product = productMap.get(String(row.productId));
      const sku = skuMap.get(String(row.skuId));
      const invalid =
        !product ||
        product.isDeleted === 1 ||
        product.status !== 1 ||
        !sku ||
        sku.isDeleted === 1 ||
        sku.status !== 1;
      return {
        id: row.id,
        productId: row.productId,
        skuId: row.skuId,
        quantity: row.quantity,
        checked: row.checked,
        productName: product?.name ?? "",
        productImage: product?.mainImage ?? "",
        skuName: sku?.name ?? "",
        price: sku?.price ?? 0,
        stock: sku?.stock ?? 0,
        invalid,
      };
    });
  }

  async add(memberId: string, dto: CartAddDto) {
    return this.dataSource.transaction(async (manager) => {
      // 锁定 SKU 将同一规格的并发加购串行化，避免唯一索引冲突和数量丢失。
      const { sku, product } = await this.productService.getSkuForOrder(manager, dto.skuId);
      const existing = await manager.findOne(Cart, {
        where: { memberId, skuId: dto.skuId },
        lock: { mode: "pessimistic_write" },
      });
      const nextQty = (existing && existing.isDeleted === 0 ? existing.quantity : 0) + dto.quantity;
      if (nextQty > sku.stock) {
        throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "库存不足" });
      }

      if (existing) {
        existing.productId = product.id;
        existing.quantity = nextQty;
        existing.checked = 1;
        existing.isDeleted = 0;
        return manager.save(existing);
      }

      const created = manager.create(Cart, {
        memberId,
        productId: product.id,
        skuId: sku.id,
        quantity: dto.quantity,
        checked: 1,
        isDeleted: 0,
      });
      return manager.save(created);
    });
  }

  async update(memberId: string, id: string, dto: CartUpdateDto) {
    const row = await this.getOwn(memberId, id);
    if (dto.quantity !== undefined) {
      const sku = await this.skuRepository.findOne({ where: { id: row.skuId, isDeleted: 0 } });
      if (sku && dto.quantity > sku.stock) {
        throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "库存不足" });
      }
      row.quantity = dto.quantity;
    }
    if (dto.checked !== undefined) {
      row.checked = dto.checked;
    }
    return this.cartRepository.save(row);
  }

  async remove(memberId: string, id: string) {
    const row = await this.getOwn(memberId, id);
    await this.cartRepository.delete(row.id);
  }

  async findOwnedByIds(manager: EntityManager, memberId: string, ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return [];
    const rows = await manager
      .createQueryBuilder(Cart, "cart")
      .where("cart.memberId = :memberId", { memberId })
      .andWhere("cart.id IN (:...ids)", { ids: uniqueIds })
      .andWhere("cart.isDeleted = 0")
      .getMany();
    if (rows.length !== uniqueIds.length) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "购物车项不存在" });
    }
    return rows;
  }

  async lockOwnedByIds(manager: EntityManager, memberId: string, ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    const rows = await manager
      .createQueryBuilder(Cart, "cart")
      .setLock("pessimistic_write")
      .where("cart.memberId = :memberId", { memberId })
      .andWhere("cart.id IN (:...ids)", { ids: uniqueIds })
      .andWhere("cart.isDeleted = 0")
      .getMany();
    if (rows.length !== uniqueIds.length) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "购物车项不存在" });
    }
  }

  async removeOwnedByIds(manager: EntityManager, memberId: string, ids: string[]) {
    if (ids.length === 0) return;
    await manager.delete(Cart, { memberId, id: In(ids) });
  }

  private async getOwn(memberId: string, id: string): Promise<Cart> {
    const row = await this.cartRepository.findOne({ where: { id, memberId, isDeleted: 0 } });
    if (!row) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "购物车项不存在" });
    }
    return row;
  }
}
