import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';
import { HttpClientService } from './http-client.service';

@Global()
@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get<number>('httpClient.timeoutMs', 5000),
        maxRedirects: configService.get<number>('httpClient.maxRedirects', 5),
        httpAgent: new http.Agent({
          keepAlive: true,
          maxSockets: configService.get<number>('httpClient.maxSockets', 50)
        }),
        httpsAgent: new https.Agent({
          keepAlive: true,
          maxSockets: configService.get<number>('httpClient.maxSockets', 50)
        })
      })
    })
  ],
  providers: [HttpClientService],
  exports: [HttpClientService]
})
export class HttpClientModule {}
