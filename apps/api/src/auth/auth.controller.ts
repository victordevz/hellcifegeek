import { Body, Controller, Get, Inject, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { RequestUser } from "../domain";
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

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: { user: RequestUser }) {
    return request.user;
  }

  @Patch("me")
  @UseGuards(AuthGuard)
  updateMe(@Req() request: { user: RequestUser }, @Body() body: unknown) {
    return this.auth.updateProfile(request.user.id, body as Record<string, unknown>);
  }
}
