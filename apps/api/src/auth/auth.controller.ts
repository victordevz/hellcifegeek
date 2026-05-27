import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { RequestUser } from "../domain";
import { AdminGuard } from "./admin.guard";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: unknown) {
    return this.auth.registerClient(body as Record<string, unknown>);
  }

  @Post("login")
  login(@Body() body: unknown) {
    return this.auth.login(body as Record<string, unknown>);
  }

  @Post("admin/login")
  adminLogin(@Body() body: unknown) {
    return this.auth.login(body as Record<string, unknown>, "admin");
  }

  @Get("admin/users")
  @UseGuards(AuthGuard, AdminGuard)
  adminUsers() {
    return this.auth.listUsers();
  }

  @Patch("admin/users/:id/ban")
  @UseGuards(AuthGuard, AdminGuard)
  adminBanUser(@Req() request: { user: RequestUser }, @Param("id") userId: string, @Body() body: unknown) {
    return this.auth.setUserBanned(request.user.id, userId, body as Record<string, unknown>);
  }

  @Patch("admin/users/:id/partner")
  @UseGuards(AuthGuard, AdminGuard)
  adminPartnerUser(@Req() request: { user: RequestUser }, @Param("id") userId: string, @Body() body: unknown) {
    return this.auth.setUserPartner(request.user.id, userId, body as Record<string, unknown>);
  }

  @Delete("admin/users/:id")
  @UseGuards(AuthGuard, AdminGuard)
  adminDeleteUser(@Req() request: { user: RequestUser }, @Param("id") userId: string) {
    return this.auth.deleteUser(request.user.id, userId);
  }

  @Get("google")
  google(
    @Query("redirect_uri") redirectUri: string | undefined,
    @Query("state") state: string | undefined,
    @Res() response: { redirect: (url: string) => void }
  ) {
    response.redirect(this.auth.googleAuthUrl(redirectUri, state));
  }

  @Post("google/callback")
  googleCallback(@Body() body: unknown) {
    return this.auth.loginWithGoogleCode(body as Record<string, unknown>);
  }

  @Get("coupons/:code")
  coupon(@Param("code") code: string) {
    return this.auth.validateCoupon(code);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: { user: RequestUser }) {
    return this.auth.getProfile(request.user.id);
  }

  @Patch("me")
  @UseGuards(AuthGuard)
  updateMe(@Req() request: { user: RequestUser }, @Body() body: unknown) {
    return this.auth.updateProfile(request.user.id, body as Record<string, unknown>);
  }

  @Post("me/hellpoints/tickets")
  @UseGuards(AuthGuard)
  buyRaffleTicket(@Req() request: { user: RequestUser }) {
    return this.auth.buyRaffleTicket(request.user.id);
  }

  @Get("partner/dashboard")
  @UseGuards(AuthGuard)
  partnerDashboard(
    @Req() request: { user: RequestUser },
    @Query("startDate") startDate: string | undefined,
    @Query("endDate") endDate: string | undefined
  ) {
    return this.auth.getPartnerDashboard(request.user.id, { startDate, endDate });
  }
}
