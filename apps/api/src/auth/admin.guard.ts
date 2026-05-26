import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { RequestUser } from "../domain";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    return request.user?.role === "admin";
  }
}
