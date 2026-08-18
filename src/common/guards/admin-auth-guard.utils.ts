import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { METADATA } from "../constants/metadata.constant";

export const shouldSkipAdminAuth = (reflector: Reflector, context: ExecutionContext): boolean =>
  [METADATA.PUBLIC, METADATA.MEMBER_API].some((key) =>
    reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()])
  );
