import { GEMINI_WORKLOAD } from '@core/modules/gemini/constants/gemini.constants';
import { GoogleGenAI } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GeminiExecutionService } from './gemini-execution.service';

@Injectable()
export class GeminiBatchService {
  private readonly logger = new Logger(GeminiBatchService.name);

  constructor(
    private readonly geminiExecutionService: GeminiExecutionService
  ) {}

  async uploadJsonlFile(
    lines: Record<string, unknown>[],
    displayName: string
  ): Promise<string> {
    const tmpDir = os.tmpdir();
    const fileName = `batch_input_${Date.now()}_${Math.random().toString(36).substring(7)}.jsonl`;
    const filePath = path.join(tmpDir, fileName);

    try {
      this.logger.debug(
        `Writing ${lines.length} lines to temp JSONL file: ${filePath}`
      );
      const writeStream = fs.createWriteStream(filePath, { flags: 'w' });

      for (const req of lines) {
        writeStream.write(JSON.stringify(req) + '\\n');
      }
      writeStream.end();

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      this.logger.debug(`Uploading file to Gemini File API...`);
      const uploadedFile = await this.geminiExecutionService.execute({
        workload: GEMINI_WORKLOAD.batch,
        operation: (client: GoogleGenAI) =>
          client.files.upload({
            file: filePath,
            config: {
              mimeType: 'jsonl',
              displayName
            }
          })
      });

      this.logger.log(`Uploaded file to Gemini: ${uploadedFile.name}`);
      if (!uploadedFile.name) {
        throw new Error('Upload failed: no file name returned from Gemini');
      }
      return uploadedFile.name;
    } finally {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        this.logger.warn(`Failed to cleanup temp file ${filePath}`, err);
      }
    }
  }

  async createGenerationBatchJob(
    model: string,
    fileRef: string,
    displayName: string
  ) {
    this.logger.debug(
      `Creating generation batch job with model: ${model}, file: ${fileRef}`
    );
    const batchJob = await this.geminiExecutionService.execute({
      workload: GEMINI_WORKLOAD.batch,
      operation: (client: GoogleGenAI) =>
        client.batches.create({
          model,
          src: { fileName: fileRef },
          config: { displayName }
        })
    });

    this.logger.log(`Created generation batch job: ${batchJob.name}`);
    return batchJob;
  }

  async createEmbeddingBatchJob(
    model: string,
    fileRef: string,
    displayName: string
  ) {
    this.logger.debug(
      `Creating embedding batch job with model: ${model}, file: ${fileRef}`
    );
    const batchJob = await this.geminiExecutionService.execute({
      workload: GEMINI_WORKLOAD.batch,
      operation: (client: GoogleGenAI) =>
        client.batches.createEmbeddings({
          model,
          src: { fileName: fileRef },
          config: { displayName }
        })
    });

    this.logger.log(`Created embedding batch job: ${batchJob.name}`);
    return batchJob;
  }

  async getBatchJob(name: string) {
    return this.geminiExecutionService.execute({
      workload: GEMINI_WORKLOAD.batch,
      operation: (client: GoogleGenAI) => client.batches.get({ name })
    });
  }

  async downloadResultFile(fileName: string): Promise<string> {
    this.logger.debug(`Downloading batch result file: ${fileName}`);
    const downloadPath = path.join(
      os.tmpdir(),
      `batch_result_${Date.now()}_${Math.random().toString(36).substring(7)}.jsonl`
    );

    try {
      await this.geminiExecutionService.execute({
        workload: GEMINI_WORKLOAD.batch,
        operation: (client: GoogleGenAI) =>
          client.files.download({ file: fileName, downloadPath })
      });
      return fs.readFileSync(downloadPath, 'utf8');
    } finally {
      try {
        if (fs.existsSync(downloadPath)) {
          fs.unlinkSync(downloadPath);
        }
      } catch (err) {
        this.logger.warn(
          `Failed to cleanup downloaded file ${downloadPath}`,
          err
        );
      }
    }
  }

  isTerminalState(state: string | undefined): boolean {
    const terminalStates = [
      'JOB_STATE_SUCCEEDED',
      'JOB_STATE_FAILED',
      'JOB_STATE_CANCELLED',
      'JOB_STATE_EXPIRED'
    ];
    return terminalStates.includes(state || '');
  }
}
