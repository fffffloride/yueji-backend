import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DecorationService } from "./decoration.service";
import { HomeCardsFormDto } from "./dto/decoration.dto";

it("validates the card limit and fields, preserves order and supports clearing", async () => {
  const card = {
    title: "品牌起源",
    imageUrl: "http://localhost:9000/card.png",
    content: "<p>介绍</p>",
  };
  const errors = (cards: unknown) => validate(plainToInstance(HomeCardsFormDto, { cards }));
  expect(await errors([])).toHaveLength(0);
  expect(await errors(Array.from({ length: 10 }, () => card))).toHaveLength(0);
  expect((await errors(Array.from({ length: 11 }, () => card))).length).toBeGreaterThan(0);
  for (const invalid of [
    { ...card, title: " " },
    { ...card, imageUrl: "javascript:alert(1)" },
    { ...card, content: "" },
    null,
  ]) {
    expect((await errors([invalid])).length).toBeGreaterThan(0);
  }
  let row: { cards: (typeof card)[] } | undefined;
  const cardsRepository = {
    findOne: async () => row,
    upsert: async (value: typeof row) => {
      row = value;
    },
  };
  const empty = { find: async () => [] };
  const brand = { findOne: async () => ({ content: "原品牌背书" }) };
  const service = new DecorationService(
    empty as never,
    empty as never,
    brand as never,
    cardsRepository as never
  );
  expect(await service.getCards()).toEqual({ cards: [] });
  const cards = [card, { ...card, title: "第二张" }];
  await service.saveCards({ cards });
  expect(await service.appHome()).toMatchObject({ brandContent: "原品牌背书", cards });
  await service.saveCards({ cards: [...cards].reverse() });
  expect((await service.getCards()).cards[0].title).toBe("第二张");
  await service.saveCards({ cards: [] });
  expect((await service.appHome()).cards).toEqual([]);
});
