import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AuthGuard } from "../auth/auth.guard";
import { SupabaseService } from "../supabase/supabase.service";

@Controller("uploads")
@UseGuards(AuthGuard, AdminGuard)
export class UploadsController {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  @Get("storage-status")
  storageStatus() {
    return this.supabase.storageStatus();
  }

  @Post("product-image")
  uploadProductImage(@Body() body: Record<string, unknown>) {
    return this.supabase.uploadProductImage(body);
  }
}
