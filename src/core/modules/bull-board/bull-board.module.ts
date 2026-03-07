import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/bull-board',
      adapter: ExpressAdapter
    })
  ],
  exports: [BullBoardModule]
})
export class AppBullBoardModule {}
