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

const MAX_ACTIVE_CART_ITEMS = 100;

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
      // 同时锁定该会员的购物车范围，使不同 SKU 的并发加购也能安全执行数量上限检查。
      const memberRows = await manager.find(Cart, {
        where: { memberId },
        lock: { mode: "pessimistic_write" },
      });
      const existing = memberRows.find((row) => String(row.skuId) === String(dto.skuId));
      const nextQty = (existing && existing.isDeleted === 0 ? existing.quantity : 0) + dto.quantity;
      if (nextQty > sku.stock) {
        throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "库存不足" });
      }

      const activeCount = memberRows.filter((row) => row.isDeleted === 0).length;
      if ((!existing || existing.isDeleted === 1) && activeCount >= MAX_ACTIVE_CART_ITEMS) {
        throw new BusinessException({
          ...ErrorCode.USER_ERROR,
          msg: `购物车最多保留${MAX_ACTIVE_CART_ITEMS}种商品规格`,
        });
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
    const snapshot = await this.getOwn(memberId, id);
    const requiresSellableSku = dto.quantity !== undefined || dto.checked === 1;

    // 失效项仍允许取消选中；使用带归属条件的原子更新，避免保存陈旧实体。
    if (!requiresSellableSku) {
      if (dto.checked === 0) {
        const result = await this.cartRepository.update(
          { id, memberId, isDeleted: 0 },
          { checked: 0 }
        );
        if (result.affected !== 1) this.throwNotFound();
        snapshot.checked = 0;
      }
      return snapshot;
    }

    return this.dataSource.transaction(async (manager) => {
      // 与加购、下单保持 SKU→商品→购物车行的锁顺序。
      const { sku } = await this.productService.getSkuForOrder(manager, snapshot.skuId);
      const row = await manager.findOne(Cart, {
        where: { id, memberId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!row || String(row.skuId) !== String(snapshot.skuId)) this.throwNotFound();

      if (dto.quantity !== undefined) {
        if (dto.quantity > sku.stock) {
          throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "库存不足" });
        }
        row.quantity = dto.quantity;
      }
      if (dto.checked !== undefined) row.checked = dto.checked;
      return manager.save(row);
    });
  }

  async remove(memberId: string, id: string) {
    const result = await this.cartRepository.update(
      { id, memberId, isDeleted: 0 },
      { isDeleted: 1, checked: 0 }
    );
    if (result.affected !== 1) this.throwNotFound();
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

  async lockOwnedByIds(
    manager: EntityManager,
    memberId: string,
    ids: string[],
    expectedLines?: Array<{ skuId: string; quantity: number }>
  ) {
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
    if (expectedLines) {
      const lockedLineMap = new Map(rows.map((row) => [String(row.skuId), row.quantity] as const));
      if (
        rows.length !== expectedLines.length ||
        expectedLines.some((line) => lockedLineMap.get(String(line.skuId)) !== line.quantity)
      ) {
        throw new BusinessException({
          ...ErrorCode.USER_ERROR,
          msg: "购物车状态已变化，请重新确认",
        });
      }
    }
    return rows;
  }

  async removeOwnedByIds(manager: EntityManager, memberId: string, ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return;
    const result = await manager.update(
      Cart,
      { memberId, id: In(uniqueIds), isDeleted: 0 },
      { isDeleted: 1, checked: 0 }
    );
    if (result.affected !== uniqueIds.length) this.throwNotFound();
  }

  private async getOwn(memberId: string, id: string): Promise<Cart> {
    const row = await this.cartRepository.findOne({ where: { id, memberId, isDeleted: 0 } });
    if (!row) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "购物车项不存在" });
    }
    return row;
  }

  private throwNotFound(): never {
    throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "购物车项不存在" });
  }
}
