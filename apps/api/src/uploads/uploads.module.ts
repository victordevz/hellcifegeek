import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SupabaseService } from "../supabase/supabase.service";
import { UploadsController } from "./uploads.controller";

@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [SupabaseService],
  exports: [SupabaseService]
})
export class UploadsModule {}
