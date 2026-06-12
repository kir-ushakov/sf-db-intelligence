/**
 * Minimal Nest host for local development and manual testing of db-intelligence
 * without a separate consumer application. Not published in the npm package.
 *
 * Overview: docs/README.md
 */
import { Module } from '@nestjs/common';
import { DbIntelligenceModule } from '../db-intelligence.module';

@Module({
  imports: [DbIntelligenceModule.forRoot()],
})
export class AppModule {}
