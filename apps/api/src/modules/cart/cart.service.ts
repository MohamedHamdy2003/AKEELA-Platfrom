import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { formatMoneyCents, moneyCents } from '../../common/money';
import { CustomersService } from '../customers/customers.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CatalogService } from '../catalog/catalog.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartItemAddon } from './entities/cart-item-addon.entity';
import {
  AddCartItemDto,
  UpdateCartItemDto,
  QuoteDto,
  AddonChoiceDto,
} from './cart.dto';
import { CartView, CartItemView, GENERAL_DELIVERY_FEE } from './cart.types';
export function amount(cents: bigint): string {
  if (cents < 0n || cents > 999999999999n)
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'The total exceeds the supported money range.',
    );
  return formatMoneyCents(cents);
}
const EMPTY_CART_VIEW: CartView = {
  cart_id: null,
  rest_id: null,
  rest_title: null,
  rest_image_url_mobile: null,
  items: [],
  items_subtotal: '0.00',
  addons_subtotal: '0.00',
  subtotal: '0.00',
  updated_at: null,
};
@Injectable()
export class CartService {
  constructor(
    private readonly db: DataSource,
    private readonly customers: CustomersService,
    private readonly catalog: CatalogService,
    private readonly restaurants: RestaurantsService,
  ) {}
  // Serializable snapshots plus retry protect absent-cart creation and cross-module reads.
  async transaction<T>(
    userId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.transaction('SERIALIZABLE', async (manager) => {
          await this.customers.lockForCart(userId, manager);
          return work(manager);
        });
      } catch (error) {
        const code = (error as { driverError?: { code?: string } }).driverError
          ?.code;
        if (!['40001', '40P01', '23505'].includes(code ?? '')) throw error;
        if (attempt >= 2)
          throw new ApiError(
            409,
            'CART_CONFLICT',
            'Your cart changed. Please refresh it and try again.',
          );
      }
    }
  }
  private async cart(userId: string, manager: EntityManager, lock = true) {
    const qb = manager
      .getRepository(Cart)
      .createQueryBuilder('c')
      .where('c.customer_id = :userId', { userId });
    if (lock) qb.setLock('pessimistic_write');
    return qb.getOne();
  }
  private async snapshotWithStatus(
    userId: string,
    manager: EntityManager,
    lock = true,
  ) {
    const cart = await this.cart(userId, manager, lock);
    if (!cart)
      return {
        view: { ...EMPTY_CART_VIEW, items: [] },
        status: null,
      };
    const status = await this.restaurants.saleStatus(cart.rest_id, manager);
    const rows = await manager.getRepository(CartItem).find({
      where: { cart_id: cart.cart_id },
      order: { cart_item_id: 'ASC' },
    });
    const rowIds = rows.map((row) => row.cart_item_id);
    const allChoices = rowIds.length
      ? await manager.getRepository(CartItemAddon).find({
          where: { cart_item_id: In(rowIds) },
          order: { addon_id: 'ASC' },
        })
      : [];
    const choicesByItem = new Map<string, CartItemAddon[]>();
    for (const choice of allChoices) {
      const list = choicesByItem.get(choice.cart_item_id);
      if (list) list.push(choice);
      else choicesByItem.set(choice.cart_item_id, [choice]);
    }
    const sales = await this.catalog.saleSelections(
      cart.rest_id,
      rows.map((row) => ({
        prodId: row.prod_id,
        offerId: row.offer_id,
        addonIds: (choicesByItem.get(row.cart_item_id) ?? []).map(
          (a) => a.addon_id,
        ),
      })),
      manager,
    );
    const items: CartItemView[] = [];
    let itemsTotal = 0n;
    let addonsTotal = 0n;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const choices = choicesByItem.get(row.cart_item_id) ?? [];
      const sale = sales[i]!;
      const price = sale.item?.price ?? '0.00';
      const subtotal = moneyCents(price) * BigInt(row.quantity);
      let lineAddons = 0n;
      const addons = choices.map((choice) => {
        const addon = sale.addons.find((a) => a.addon_id === choice.addon_id)!;
        const sum = moneyCents(addon.price) * BigInt(choice.quantity);
        lineAddons += sum;
        return {
          addon_id: choice.addon_id,
          addon_name: addon.name,
          quantity: choice.quantity,
          unit_price: addon.price,
          subtotal: formatMoneyCents(sum),
        };
      });
      itemsTotal += subtotal;
      addonsTotal += lineAddons;
      items.push({
        cart_item_id: row.cart_item_id,
        prod_id: row.prod_id,
        offer_id: row.offer_id,
        item_name: sale.item?.name ?? '',
        item_image_url: sale.item?.image_url ?? null,
        quantity: row.quantity,
        unit_price: price,
        subtotal: formatMoneyCents(subtotal),
        addons,
        line_total: formatMoneyCents(subtotal + lineAddons),
        is_available:
          status.is_available &&
          Boolean(sale.item?.is_available) &&
          sale.addons.every((a) => a.is_available),
      });
    }
    return {
      status,
      view: {
        cart_id: cart.cart_id,
        rest_id: cart.rest_id,
        rest_title: status.profile?.rest_title ?? null,
        rest_image_url_mobile: status.profile?.rest_image_url_mobile ?? null,
        items,
        items_subtotal: formatMoneyCents(itemsTotal),
        addons_subtotal: formatMoneyCents(addonsTotal),
        subtotal: formatMoneyCents(itemsTotal + addonsTotal),
        updated_at: cart.updated_at.toISOString(),
      },
    };
  }
  async snapshot(
    userId: string,
    manager: EntityManager,
    lock = true,
  ): Promise<CartView> {
    return (await this.snapshotWithStatus(userId, manager, lock)).view;
  }
  async get(userId: string) {
    return this.db.transaction('REPEATABLE READ', async (m) => {
      await this.customers.assertExists(userId, m);
      return this.snapshot(userId, m, false);
    });
  }
  private async validateSelection(
    restId: string,
    prodId: string | null,
    offerId: string | null,
    addons: AddonChoiceDto[],
    manager: EntityManager,
  ) {
    if (Boolean(prodId) === Boolean(offerId))
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Choose one product or one offer.',
      );
    if (offerId && addons.length)
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Offers do not support addons.',
      );
    const status = await this.restaurants.saleStatus(restId, manager);
    if (!status.is_available)
      throw new ApiError(409, 'UNAVAILABLE', 'This restaurant is unavailable.');
    const sale = await this.catalog.saleSelection(
      restId,
      prodId,
      offerId,
      addons.map((a) => a.addon_id),
      manager,
    );
    if (!sale.item?.is_available || sale.addons.some((a) => !a.is_available))
      throw new ApiError(
        409,
        'UNAVAILABLE',
        'Some selected items or addons are unavailable.',
      );
  }
  private quantity(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 2147483647)
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Quantity exceeds the supported integer range.',
      );
    return value;
  }
  private async saveAddons(
    item: CartItem,
    addons: AddonChoiceDto[],
    m: EntityManager,
  ) {
    await m
      .getRepository(CartItemAddon)
      .delete({ cart_item_id: item.cart_item_id });
    if (addons.length)
      await m.getRepository(CartItemAddon).save(
        addons.map((a) => ({
          cart_item_id: item.cart_item_id,
          rest_id: item.rest_id,
          prod_id: item.prod_id!,
          addon_id: a.addon_id,
          quantity: this.quantity(a.quantity),
        })),
      );
  }
  private async touch(cart: Cart, m: EntityManager) {
    await m
      .getRepository(Cart)
      .update({ cart_id: cart.cart_id }, { updated_at: new Date() });
  }
  async add(userId: string, input: AddCartItemDto) {
    return this.transaction(userId, async (m) => {
      const addons = input.addons ?? [];
      const prodId = input.prod_id ?? null;
      const offerId = input.offer_id ?? null;
      let cart = await this.cart(userId, m);
      if (cart && cart.rest_id !== input.rest_id) {
        const remaining = await m
          .getRepository(CartItem)
          .countBy({ cart_id: cart.cart_id });
        if (remaining === 0) {
          await m.getRepository(Cart).delete({ cart_id: cart.cart_id });
          cart = null;
        } else {
          throw new ApiError(
            409,
            'CART_RESTAURANT_CONFLICT',
            'Clear your cart before choosing another restaurant.',
          );
        }
      }
      await this.validateSelection(input.rest_id, prodId, offerId, addons, m);
      if (!cart)
        cart = await m
          .getRepository(Cart)
          .save(
            m
              .getRepository(Cart)
              .create({ customer_id: userId, rest_id: input.rest_id }),
          );
      const repo = m.getRepository(CartItem);
      const candidates = await repo.find({
        where: { cart_id: cart.cart_id },
        order: { cart_item_id: 'ASC' },
      });
      const sameItemCandidates = candidates.filter(
        (row) => row.prod_id === prodId && row.offer_id === offerId,
      );
      const candidateAddons = sameItemCandidates.length
        ? await m.getRepository(CartItemAddon).findBy({
            cart_item_id: In(sameItemCandidates.map((r) => r.cart_item_id)),
          })
        : [];
      const existingByItem = new Map<string, CartItemAddon[]>();
      for (const a of candidateAddons) {
        const list = existingByItem.get(a.cart_item_id);
        if (list) list.push(a);
        else existingByItem.set(a.cart_item_id, [a]);
      }
      let matched: CartItem | undefined;
      for (const row of sameItemCandidates) {
        const existing = existingByItem.get(row.cart_item_id) ?? [];
        if (
          existing.length === addons.length &&
          existing.every((a) =>
            addons.some(
              (b) =>
                b.addon_id === a.addon_id &&
                BigInt(a.quantity) * BigInt(input.quantity) ===
                  BigInt(b.quantity) * BigInt(row.quantity),
            ),
          )
        ) {
          matched = row;
          break;
        }
      }
      if (matched) {
        const oldQty = matched.quantity;
        matched.quantity = this.quantity(oldQty + input.quantity);
        await repo.save(matched);
        const combined = addons.map((a) => ({
          ...a,
          quantity: this.quantity(
            Number(
              (BigInt(a.quantity) * BigInt(matched!.quantity)) /
                BigInt(input.quantity),
            ),
          ),
        }));
        await this.saveAddons(matched, combined, m);
      } else {
        const item = await repo.save(
          repo.create({
            cart_id: cart.cart_id,
            rest_id: cart.rest_id,
            prod_id: prodId,
            offer_id: offerId,
            quantity: input.quantity,
          }),
        );
        await this.saveAddons(item, addons, m);
      }
      await this.touch(cart, m);
      const view = await this.snapshot(userId, m);
      amount(moneyCents(view.subtotal));
      return view;
    });
  }
  async update(userId: string, itemId: string, input: UpdateCartItemDto) {
    return this.transaction(userId, async (m) => {
      const cart = await this.cart(userId, m);
      const row = cart
        ? await m
            .getRepository(CartItem)
            .findOneBy({ cart_id: cart.cart_id, cart_item_id: itemId })
        : null;
      if (!cart || !row)
        throw new ApiError(404, 'NOT_FOUND', 'Cart item not found.');
      if (input.quantity === 0) {
        await m.getRepository(CartItem).delete({ cart_item_id: itemId });
        const remaining = await m
          .getRepository(CartItem)
          .countBy({ cart_id: cart.cart_id });
        if (remaining === 0) {
          await m.getRepository(Cart).delete({ cart_id: cart.cart_id });
        } else {
          await this.touch(cart, m);
        }
        return this.snapshot(userId, m);
      }
      const old = await m
        .getRepository(CartItemAddon)
        .findBy({ cart_item_id: itemId });
      if (
        input.quantity !== undefined &&
        input.quantity !== row.quantity &&
        old.length &&
        input.addons === undefined
      )
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'Send the desired total addon quantities when changing item quantity.',
        );
      const addons =
        input.addons ??
        old.map((a) => ({ addon_id: a.addon_id, quantity: a.quantity }));
      await this.validateSelection(
        cart.rest_id,
        row.prod_id,
        row.offer_id,
        addons,
        m,
      );
      if (input.quantity !== undefined) row.quantity = input.quantity;
      await m.getRepository(CartItem).save(row);
      await this.saveAddons(row, addons, m);
      await this.touch(cart, m);
      const view = await this.snapshot(userId, m);
      amount(moneyCents(view.subtotal));
      return view;
    });
  }
  async remove(userId: string, itemId: string) {
    return this.update(userId, itemId, { quantity: 0 });
  }
  async clearInTransaction(userId: string, m: EntityManager) {
    await m.getRepository(Cart).delete({ customer_id: userId });
  }
  async clear(userId: string) {
    return this.transaction(userId, async (m) => {
      await this.clearInTransaction(userId, m);
      return { ...EMPTY_CART_VIEW, items: [] };
    });
  }
  async address(userId: string, input: QuoteDto, m: EntityManager) {
    if (Boolean(input.address_id) === Boolean(input.delivery_address))
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Choose one saved address or one new delivery address.',
      );
    if (input.address_id)
      return this.customers.deliveryAddress(userId, input.address_id, m);
    const a = input.delivery_address!;
    return {
      address_line: a.address_line,
      longitude: Number(a.longitude).toFixed(7),
      latitude: Number(a.latitude).toFixed(7),
    };
  }
  async ready(userId: string, input: QuoteDto, m: EntityManager, lock = true) {
    const { view: cart, status } = await this.snapshotWithStatus(
      userId,
      m,
      lock,
    );
    if (!cart.items.length || !cart.rest_id)
      throw new ApiError(409, 'EMPTY_CART', 'Your cart is empty.');
    if (cart.items.some((i) => !i.is_available))
      throw new ApiError(
        409,
        'UNAVAILABLE',
        'Some cart selections are unavailable. Refresh your cart.',
      );
    if (!status?.profile || !this.catalog.isOpen(status.profile))
      throw new ApiError(409, 'RESTAURANT_CLOSED', 'The restaurant is closed.');
    const address = await this.address(userId, input, m);
    return {
      cart,
      address,
      address_id: input.address_id ?? null,
      delivery_fee: GENERAL_DELIVERY_FEE,
      total_price: amount(
        moneyCents(cart.subtotal) + moneyCents(GENERAL_DELIVERY_FEE),
      ),
    };
  }
  async quote(userId: string, input: QuoteDto) {
    return this.db.transaction('REPEATABLE READ', async (m) => {
      await this.customers.assertExists(userId, m);
      const result = await this.ready(userId, input, m, false);
      return {
        address_id: result.address_id,
        delivery_address: result.address,
        cart: result.cart,
        delivery_fee: result.delivery_fee,
        total_price: result.total_price,
      };
    });
  }
}
