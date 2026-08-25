import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from "typeorm";

import {
  AgentStatus,
  DirectSalesStatus,
  DistributionTaskDisplayStatus,
  DistributionTaskScope,
  DistributionTaskStatus,
} from "./distribution.constants";
import { taskDisplayStatus, taskProgress } from "./distribution-task.rules";
import {
  DistributionAppTaskQueryDto,
  DistributionTaskAssigneeQueryDto,
  DistributionTaskFormDto,
  DistributionTaskQueryDto,
} from "./dto/distribution.dto";
import { DistributionTaskAssignee } from "./entities/distribution-task-assignee.entity";
import { DistributionTaskEntity } from "./entities/distribution-task.entity";
import { DistributionAgent } from "./entities/distribution-agent.entity";
import { DistributionDirectSale } from "./entities/distribution-direct-sale.entity";
import { DistributionLevel } from "./entities/distribution-level.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

type ProgressRow = {
  assignmentId: string;
  taskId: string;
  agentId: string;
  agentName: string | null;
  mobile: string | null;
  levelId: string | null;
  agentStatus: number | null;
  salesAmount: string | number;
  orderCount: string | number;
};

@Injectable()
export class DistributionTaskService {
  constructor(
    @InjectRepository(DistributionTaskEntity)
    private readonly taskRepository: Repository<DistributionTaskEntity>,
    @InjectRepository(DistributionTaskAssignee)
    private readonly assigneeRepository: Repository<DistributionTaskAssignee>,
    @InjectRepository(DistributionAgent)
    private readonly agentRepository: Repository<DistributionAgent>,
    @InjectRepository(DistributionLevel)
    private readonly levelRepository: Repository<DistributionLevel>,
    private readonly dataSource: DataSource
  ) {}

  async taskPage(query: DistributionTaskQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.taskRepository.createQueryBuilder("t").where("t.isDeleted = 0");
    if (query.keywords) qb.andWhere("t.name LIKE :kw", { kw: `%${query.keywords}%` });
    if (query.status !== undefined) qb.andWhere("t.status = :status", { status: query.status });
    if (query.metricType)
      qb.andWhere("t.metricType = :metricType", { metricType: query.metricType });
    if (query.startTime)
      qb.andWhere("t.startTime >= :startTime", { startTime: new Date(query.startTime) });
    if (query.endTime) qb.andWhere("t.endTime <= :endTime", { endTime: new Date(query.endTime) });
    this.applyDisplayStatus(qb, query.displayStatus);
    const [tasks, total] = await qb
      .orderBy("t.id", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data: await this.taskVos(tasks), page: { pageNum, pageSize, total } };
  }

  async taskDetail(id: string) {
    const task = await this.findTask(id);
    return (await this.taskVos([task]))[0];
  }

  async createTask(dto: DistributionTaskFormDto, operatorId: string) {
    const values = await this.formValues(dto);
    return this.taskRepository.save(
      this.taskRepository.create({
        ...values,
        status: DistributionTaskStatus.DRAFT,
        createBy: operatorId,
        updateBy: operatorId,
        isDeleted: 0,
      })
    );
  }

  async updateTask(id: string, dto: DistributionTaskFormDto, operatorId: string) {
    const task = await this.findTask(id);
    if (task.status !== DistributionTaskStatus.DRAFT) throw this.userError("只有草稿可以编辑");
    Object.assign(task, await this.formValues(dto), { updateBy: operatorId });
    return this.taskRepository.save(task);
  }

  async removeTask(id: string, operatorId: string) {
    const task = await this.findTask(id);
    if (task.status !== DistributionTaskStatus.DRAFT) throw this.userError("只有草稿可以删除");
    task.isDeleted = 1;
    task.updateBy = operatorId;
    await this.taskRepository.save(task);
  }

  async publishTask(id: string, operatorId: string) {
    await this.dataSource.transaction(async (manager) => {
      const task = await this.findTask(id, manager, true);
      if (task.status === DistributionTaskStatus.PUBLISHED) return;
      if (task.status !== DistributionTaskStatus.DRAFT) throw this.userError("当前任务不能发布");
      const now = new Date();
      if (task.endTime <= now) throw this.userError("任务结束时间必须晚于当前时间");
      if (task.startTime < now) task.startTime = now;
      const agents = await this.publishAgents(manager, task);
      if (!agents.length) throw this.userError("任务分配名单不能为空");
      await manager.save(
        agents.map((agent) =>
          manager.create(DistributionTaskAssignee, {
            taskId: task.id,
            agentId: agent.id,
            createBy: operatorId,
            updateBy: operatorId,
            isDeleted: 0,
          })
        )
      );
      task.status = DistributionTaskStatus.PUBLISHED;
      task.publishedTime = now;
      task.updateBy = operatorId;
      await manager.save(task);
    });
    return this.taskDetail(id);
  }

  async cancelTask(id: string, operatorId: string) {
    await this.dataSource.transaction(async (manager) => {
      const task = await this.findTask(id, manager, true);
      if (task.status === DistributionTaskStatus.CANCELLED) return;
      if (task.status !== DistributionTaskStatus.PUBLISHED)
        throw this.userError("只有已发布任务可以取消");
      task.status = DistributionTaskStatus.CANCELLED;
      task.cancelledTime = new Date();
      task.updateBy = operatorId;
      await manager.save(task);
    });
    return this.taskDetail(id);
  }

  async assigneePage(taskId: string, query: DistributionTaskAssigneeQueryDto) {
    const task = await this.findTask(taskId);
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    let data = (await this.progressRows([task.id], undefined, query.keywords)).map((row) =>
      this.progressVo(task, row)
    );
    if (query.completed !== undefined)
      data = data.filter((row) => row.completed === Boolean(query.completed));
    const total = data.length;
    data = data.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    return { data, page: { pageNum, pageSize, total } };
  }

  async appTaskPage(memberId: string, query: DistributionAppTaskQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const agent = await this.appAgent(memberId);
    if (!agent) return { data: [], page: { pageNum, pageSize, total: 0 } };
    const qb = this.taskRepository
      .createQueryBuilder("t")
      .innerJoin(
        DistributionTaskAssignee,
        "ta",
        "ta.task_id = t.id AND ta.agent_id = :agentId AND ta.is_deleted = 0",
        { agentId: agent.id }
      )
      .where("t.isDeleted = 0")
      .andWhere("t.status IN (:...statuses)", {
        statuses: [DistributionTaskStatus.PUBLISHED, DistributionTaskStatus.CANCELLED],
      });
    if (query.metricType)
      qb.andWhere("t.metricType = :metricType", { metricType: query.metricType });
    this.applyDisplayStatus(qb, query.displayStatus);
    const tasks = await qb.orderBy("t.id", "DESC").getMany();
    const rows = await this.progressRows(
      tasks.map((task) => task.id),
      agent.id
    );
    const progress = new Map(rows.map((row) => [String(row.taskId), row]));
    let data = tasks.map((task) => ({
      ...this.appTaskBaseVo(task),
      ...this.progressVo(task, progress.get(String(task.id))!),
    }));
    if (query.completed !== undefined)
      data = data.filter((row) => row.completed === Boolean(query.completed));
    const total = data.length;
    data = data.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    return { data, page: { pageNum, pageSize, total } };
  }

  async appTaskDetail(memberId: string, taskId: string) {
    const agent = await this.appAgent(memberId);
    if (!agent) throw this.userError("任务不存在");
    const task = await this.taskRepository.findOne({
      where: {
        id: taskId,
        status: In([DistributionTaskStatus.PUBLISHED, DistributionTaskStatus.CANCELLED]),
        isDeleted: 0,
      },
    });
    if (!task) throw this.userError("任务不存在");
    const rows = await this.progressRows([task.id], agent.id);
    if (!rows.length) throw this.userError("任务不存在");
    return { ...this.appTaskBaseVo(task), ...this.progressVo(task, rows[0]) };
  }

  private async formValues(dto: DistributionTaskFormDto) {
    const name = dto.name.trim();
    if (!name) throw this.userError("任务名称不能为空");
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (startTime >= endTime) throw this.userError("任务开始时间必须早于结束时间");
    const targetAgentIds = [...new Set((dto.targetAgentIds ?? []).map(String))];
    if (dto.assignmentScope === DistributionTaskScope.ALL) {
      if (dto.targetLevelId || targetAgentIds.length)
        throw this.userError("全部代理任务不能指定等级或代理");
    } else if (dto.assignmentScope === DistributionTaskScope.LEVEL) {
      if (!dto.targetLevelId || targetAgentIds.length)
        throw this.userError("指定等级任务必须且只能选择一个等级");
      if (
        !(await this.levelRepository.findOne({
          where: { id: dto.targetLevelId, isDeleted: 0 },
        }))
      )
        throw this.userError("分销等级不存在");
    } else if (dto.assignmentScope === DistributionTaskScope.AGENT) {
      if (dto.targetLevelId || !targetAgentIds.length)
        throw this.userError("指定代理任务必须且只能选择代理");
      const count = await this.agentRepository.count({
        where: {
          id: In(targetAgentIds),
          status: AgentStatus.APPROVED,
          isDeleted: 0,
        },
      });
      if (count !== targetAgentIds.length) throw this.userError("所选代理不存在或未审核");
    }
    return {
      name,
      description: dto.description?.trim() || null,
      metricType: dto.metricType,
      targetValue: dto.targetValue,
      startTime,
      endTime,
      assignmentScope: dto.assignmentScope,
      targetLevelId:
        dto.assignmentScope === DistributionTaskScope.LEVEL ? dto.targetLevelId! : null,
      targetAgentIds: dto.assignmentScope === DistributionTaskScope.AGENT ? targetAgentIds : null,
    };
  }

  private async publishAgents(manager: EntityManager, task: DistributionTaskEntity) {
    if (task.assignmentScope === DistributionTaskScope.ALL) {
      return manager.find(DistributionAgent, {
        where: { status: AgentStatus.APPROVED, isDeleted: 0 },
      });
    }
    if (task.assignmentScope === DistributionTaskScope.LEVEL) {
      return manager.find(DistributionAgent, {
        where: { levelId: task.targetLevelId!, status: AgentStatus.APPROVED, isDeleted: 0 },
      });
    }
    const ids = [...new Set((task.targetAgentIds ?? []).map(String))];
    if (!ids.length) return [];
    const agents = await manager.find(DistributionAgent, {
      where: { id: In(ids), status: AgentStatus.APPROVED, isDeleted: 0 },
    });
    if (agents.length !== ids.length) throw this.userError("所选代理不存在或未审核");
    return agents;
  }

  private async taskVos(tasks: DistributionTaskEntity[]) {
    if (!tasks.length) return [];
    // ponytail: 当前页直接聚合全部名单；单页名单达到万级时再增加只读进度投影。
    const rows = await this.progressRows(tasks.map((task) => task.id));
    const groups = new Map<string, ProgressRow[]>();
    for (const row of rows) {
      const key = String(row.taskId);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return tasks.map((task) => {
      const progress = (groups.get(String(task.id)) ?? []).map((row) => this.progressVo(task, row));
      const completedCount = progress.filter((row) => row.completed).length;
      return {
        ...this.taskBaseVo(task),
        totalAssignees: progress.length,
        completedCount,
        incompleteCount: progress.length - completedCount,
      };
    });
  }

  private taskBaseVo(task: DistributionTaskEntity) {
    return { ...task, displayStatus: taskDisplayStatus(task.status, task.startTime, task.endTime) };
  }

  private appTaskBaseVo(task: DistributionTaskEntity) {
    const vo = this.taskBaseVo(task);
    delete vo.targetAgentIds;
    return vo;
  }

  private progressVo(task: DistributionTaskEntity, row: ProgressRow) {
    const salesAmount = Number(row.salesAmount || 0);
    const orderCount = Number(row.orderCount || 0);
    return {
      assignmentId: row.assignmentId,
      agentId: row.agentId,
      agentName: row.agentName,
      mobile: row.mobile,
      levelId: row.levelId,
      agentStatus: row.agentStatus,
      salesAmount,
      orderCount,
      ...taskProgress(task.metricType, task.targetValue, salesAmount, orderCount),
    };
  }

  private async progressRows(taskIds: string[], agentId?: string, keywords?: string) {
    if (!taskIds.length) return [];
    const qb = this.assigneeRepository
      .createQueryBuilder("ta")
      .innerJoin(DistributionTaskEntity, "t", "t.id = ta.task_id AND t.is_deleted = 0")
      .leftJoin(DistributionAgent, "a", "a.id = ta.agent_id")
      .leftJoin(
        DistributionDirectSale,
        "s",
        `s.agent_id = ta.agent_id
         AND s.status = :applied
         AND s.is_deleted = 0
         AND s.applied_time >= t.start_time
         AND s.applied_time <= t.end_time
         AND (t.cancelled_time IS NULL OR s.applied_time < t.cancelled_time)`,
        { applied: DirectSalesStatus.APPLIED }
      )
      .where("ta.is_deleted = 0")
      .andWhere("ta.task_id IN (:...taskIds)", { taskIds });
    if (agentId) qb.andWhere("ta.agent_id = :agentId", { agentId });
    if (keywords)
      qb.andWhere("(a.realName LIKE :kw OR a.mobile LIKE :kw)", { kw: `%${keywords}%` });
    return qb
      .select([
        "ta.id AS assignmentId",
        "ta.task_id AS taskId",
        "ta.agent_id AS agentId",
        "a.realName AS agentName",
        "a.mobile AS mobile",
        "a.levelId AS levelId",
        "a.status AS agentStatus",
        "COALESCE(SUM(s.amount), 0) AS salesAmount",
        "COUNT(s.id) AS orderCount",
      ])
      .groupBy("ta.id")
      .addGroupBy("ta.task_id")
      .addGroupBy("ta.agent_id")
      .addGroupBy("a.realName")
      .addGroupBy("a.mobile")
      .addGroupBy("a.levelId")
      .addGroupBy("a.status")
      .orderBy("ta.id", "DESC")
      .getRawMany<ProgressRow>();
  }

  private applyDisplayStatus(
    qb: SelectQueryBuilder<DistributionTaskEntity>,
    displayStatus?: string
  ) {
    if (!displayStatus) return;
    const now = new Date();
    if (displayStatus === DistributionTaskDisplayStatus.DRAFT)
      qb.andWhere("t.status = :draft", { draft: DistributionTaskStatus.DRAFT });
    if (displayStatus === DistributionTaskDisplayStatus.CANCELLED)
      qb.andWhere("t.status = :cancelled", { cancelled: DistributionTaskStatus.CANCELLED });
    if (displayStatus === DistributionTaskDisplayStatus.NOT_STARTED)
      qb.andWhere("t.status = :published AND t.startTime > :now", {
        published: DistributionTaskStatus.PUBLISHED,
        now,
      });
    if (displayStatus === DistributionTaskDisplayStatus.IN_PROGRESS)
      qb.andWhere("t.status = :published AND t.startTime <= :now AND t.endTime >= :now", {
        published: DistributionTaskStatus.PUBLISHED,
        now,
      });
    if (displayStatus === DistributionTaskDisplayStatus.FINISHED)
      qb.andWhere("t.status = :published AND t.endTime < :now", {
        published: DistributionTaskStatus.PUBLISHED,
        now,
      });
  }

  private async findTask(id: string, manager?: EntityManager, lock = false) {
    const repository = manager?.getRepository(DistributionTaskEntity) ?? this.taskRepository;
    const task = await repository.findOne({
      where: { id, isDeleted: 0 },
      ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
    });
    if (!task) throw this.userError("任务不存在");
    return task;
  }

  private async appAgent(memberId: string) {
    return this.agentRepository.findOne({
      where: {
        memberId,
        status: In([AgentStatus.APPROVED, AgentStatus.DISABLED]),
        isDeleted: 0,
      },
    });
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
