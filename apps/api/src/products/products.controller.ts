import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AuthGuard } from "../auth/auth.guard";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.products.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.products.get(id);
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  create(@Body() body: Record<string, unknown>) {
    return this.products.create(body);
  }

  @Patch(":id")
  @UseGuards(AuthGuard, AdminGuard)
  update(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.products.update(id, body);
  }

  @Patch(":id/recommended")
  @UseGuards(AuthGuard, AdminGuard)
  setRecommended(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.products.setRecommended(id, body.recommended !== false && body.recommended !== "false");
  }

  @Delete(":id")
  @UseGuards(AuthGuard, AdminGuard)
  remove(@Param("id") id: string) {
    return this.products.remove(id);
  }
}
