import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { RequestUser } from "../domain";
import { AuthGuard } from "../auth/auth.guard";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post("pix")
  @UseGuards(AuthGuard)
  createPix(@Req() request: { user: RequestUser }, @Body() body: unknown) {
    return this.payments.createPixPayment(request.user.id, body as Record<string, unknown>);
  }

  @Post("cart-activity")
  @UseGuards(AuthGuard)
  updateCartActivity(@Req() request: { user: RequestUser }, @Body() body: unknown) {
    return this.payments.updateCartActivity(request.user.id, body as Record<string, unknown>);
  }

  @Get()
  @UseGuards(AuthGuard)
  listPayments(@Req() request: { user: RequestUser }) {
    return this.payments.listUserPayments(request.user.id);
  }

  @Get(":id")
  @UseGuards(AuthGuard)
  getPayment(@Req() request: { user: RequestUser }, @Param("id") paymentId: string) {
    return this.payments.getPayment(request.user.id, paymentId);
  }

  @Post("mercado-pago/webhook")
  mercadoPagoWebhook(@Query("id") id: string | undefined, @Query("data.id") dataId: string | undefined, @Body() body: unknown) {
    return this.payments.handleMercadoPagoWebhook(id ?? dataId, body as Record<string, unknown>);
  }
}
