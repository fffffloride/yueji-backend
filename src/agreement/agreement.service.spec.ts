import { AgreementType } from "./agreement.constants";
import { AgreementService } from "./agreement.service";
import { BusinessException } from "@/common/exceptions/business.exception";

describe("AgreementService", () => {
  const repository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };
  const manager = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((callback) => callback(manager)),
  };
  const service = new AgreementService(repository as any, dataSource as any);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.save.mockImplementation(async (value) => value);
    manager.save.mockImplementation(async (value) => value);
  });

  it("保存草稿不改变已发布内容", async () => {
    const row = {
      type: AgreementType.USER_AGREEMENT,
      draftTitle: "旧草稿",
      draftContent: "旧草稿正文",
      publishedTitle: "线上标题",
      publishedContent: "线上正文",
      isDeleted: 0,
    };
    repository.findOne.mockResolvedValue(row);

    await service.saveDraft(
      AgreementType.USER_AGREEMENT,
      { title: " 新草稿 ", content: " 新草稿正文 " },
      "1"
    );

    expect(row).toMatchObject({
      draftTitle: "新草稿",
      draftContent: "新草稿正文",
      publishedTitle: "线上标题",
      publishedContent: "线上正文",
    });
  });

  it("发布时原子复制当前草稿", async () => {
    const row = {
      type: AgreementType.PRIVACY_POLICY,
      draftTitle: " 隐私政策 ",
      draftContent: " <p>正文</p> ",
      publishedTitle: null,
      publishedContent: null,
      publishTime: null as Date | null,
      updateBy: null as string | null,
      isDeleted: 0,
    };
    manager.findOne.mockResolvedValue(row);

    await service.publish(AgreementType.PRIVACY_POLICY, "2");

    expect(row).toMatchObject({
      publishedTitle: "隐私政策",
      publishedContent: "<p>正文</p>",
      updateBy: "2",
    });
    expect(row.publishTime).toBeInstanceOf(Date);
    expect(manager.save).toHaveBeenCalledWith(row);
  });

  it("拒绝发布空正文", async () => {
    manager.findOne.mockResolvedValue({
      type: AgreementType.USER_AGREEMENT,
      draftTitle: "用户协议",
      draftContent: "   ",
      isDeleted: 0,
    });

    const error = await service
      .publish(AgreementType.USER_AGREEMENT)
      .catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "协议标题和正文不能为空",
    });
    expect(manager.save).not.toHaveBeenCalled();
  });
});
