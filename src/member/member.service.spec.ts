import { BusinessException } from "@/common/exceptions/business.exception";
import { MemberService } from "./member.service";

describe("MemberService", () => {
  const memberRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const orderRepository = {};
  const levelRepository = {
    findOne: jest.fn(),
    manager: {},
  };
  const service = new MemberService(
    memberRepository as never,
    orderRepository as never,
    levelRepository as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    levelRepository.findOne.mockResolvedValue(null);
  });

  it("并发首次登录唯一键冲突后回读已创建会员", async () => {
    const concurrent = {
      id: "1",
      openid: "openid-1",
      unionid: null,
      isDeleted: 0,
    };
    memberRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(concurrent);
    memberRepository.save.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });

    await expect(service.findOrCreateByOpenid("openid-1")).resolves.toBe(concurrent);
  });

  it("手机号登录在首次插入时原子写入手机号", async () => {
    memberRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    memberRepository.save.mockImplementation(async (member) => {
      member.id = "1";
      return member;
    });

    const member = await service.findOrCreateByOpenid("openid-1", "unionid-1", "13800000000");

    expect(memberRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        openid: "openid-1",
        unionid: "unionid-1",
        mobile: "13800000000",
      })
    );
    expect(member).toMatchObject({ id: "1", mobile: "13800000000" });
  });

  it("拒绝为已软删 openid 静默创建新会员", async () => {
    memberRepository.findOne.mockResolvedValue({
      id: "1",
      openid: "openid-1",
      isDeleted: 1,
    });

    const error = await service
      .findOrCreateByOpenid("openid-1")
      .catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "会员账号已注销，请联系客服恢复",
    });
    expect(memberRepository.save).not.toHaveBeenCalled();
  });

  it("拒绝把已被其他会员占用的手机号再次绑定", async () => {
    memberRepository.findOne
      .mockResolvedValueOnce({ id: "1", mobile: null, isDeleted: 0 })
      .mockResolvedValueOnce({ id: "2", mobile: "13800000000", isDeleted: 0 });

    const error = await service
      .attachMobile("1", "13800000000")
      .catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "该手机号已绑定其他会员，请联系客服",
    });
    expect(memberRepository.save).not.toHaveBeenCalled();
  });

  it("C端资料响应只包含白名单字段", async () => {
    memberRepository.findOne.mockResolvedValue({
      id: "1",
      openid: "sensitive-openid",
      unionid: "sensitive-unionid",
      nickname: "会员",
      avatar: null,
      mobile: "13800000000",
      gender: 0,
      points: 100,
      totalSpent: 200,
      levelId: "3",
      remark: "内部备注",
      createBy: "9",
      isDeleted: 0,
    });

    const profile = await service.getAppProfile("1");

    expect(profile).toEqual({
      id: "1",
      nickname: "会员",
      avatar: null,
      mobile: "13800000000",
      gender: 0,
      points: 100,
      totalSpent: 200,
      levelId: "3",
    });
    expect(profile).not.toHaveProperty("openid");
    expect(profile).not.toHaveProperty("unionid");
    expect(profile).not.toHaveProperty("remark");
    expect(profile).not.toHaveProperty("isDeleted");
  });
});
