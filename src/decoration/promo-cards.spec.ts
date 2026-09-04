import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DecorationService } from "./decoration.service";
import { PromoCardsFormDto } from "./dto/decoration.dto";

it("validates four activity links and keeps activity cards separate from content cards", async () => {
  const card = {
    title: "活动",
    imageUrl: "http://localhost:9000/card.png",
    linkUrl: "/pages/product/index",
  };
  const errors = (cards: unknown) => validate(plainToInstance(PromoCardsFormDto, { cards }));
  expect(await errors([])).toHaveLength(0);
  expect(await errors(Array.from({ length: 4 }, () => card))).toHaveLength(0);
  expect((await errors(Array.from({ length: 5 }, () => card))).length).toBeGreaterThan(0);
  for (const linkUrl of [
    "/pages-sub/product/detail/index?id=1",
    "https://example.com/page?q=1",
    "http://localhost:5173/#/pages/product/index",
  ]) {
    expect(await errors([{ ...card, linkUrl }])).toHaveLength(0);
  }
  for (const linkUrl of [
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "//evil.example",
    "/pages/product/index?q=%zz",
    "https://",
    "https://example.com/ foo",
  ]) {
    expect((await errors([{ ...card, linkUrl }])).length).toBeGreaterThan(0);
  }
  for (const invalid of [{ ...card, title: " " }, { ...card, imageUrl: "bad" }, null]) {
    expect((await errors([invalid])).length).toBeGreaterThan(0);
  }
  let row: { cards: (typeof card)[] } | undefined;
  const promoRepo = {
    findOne: async () => row,
    upsert: async (value: typeof row) => {
      row = value;
    },
  };
  const empty = { find: async () => [] };
  const service = new DecorationService(
    empty as never,
    empty as never,
    { findOne: async () => ({ content: "品牌背书" }) } as never,
    { findOne: async () => ({ cards: [{ title: "原首页卡片" }] }) } as never,
    promoRepo as never
  );
  expect(await service.getPromoCards()).toEqual({ cards: [] });
  await service.savePromoCards({ cards: [card] });
  expect(await service.appHome()).toMatchObject({
    cards: [{ title: "原首页卡片" }],
    promoCards: [card],
    brandContent: "品牌背书",
  });
  await service.savePromoCards({ cards: [] });
  expect((await service.appHome()).promoCards).toEqual([]);
});
