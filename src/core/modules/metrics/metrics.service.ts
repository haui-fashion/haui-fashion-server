import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics
} from 'prom-client';
import { METRICS_HISTOGRAM_BUCKETS_SECONDS } from './metrics.constants';

export type HttpRequestMetricInput = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
};

export type OutboundRequestMetricInput = {
  method: string;
  target: string;
  statusCode?: number;
  durationMs: number;
  errorType?: string;
};

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry = new Registry();

  private readonly httpServerRequestsTotal = new Counter({
    name: 'http_server_requests_total',
    help: 'Total HTTP requests served by the API server',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry]
  });

  private readonly httpServerRequestErrorsTotal = new Counter({
    name: 'http_server_request_errors_total',
    help: 'Total HTTP request errors served by the API server',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry]
  });

  private readonly httpServerRequestDurationSeconds = new Histogram({
    name: 'http_server_request_duration_seconds',
    help: 'HTTP request duration in seconds for the API server',
    labelNames: ['method', 'route', 'status_code'],
    buckets: METRICS_HISTOGRAM_BUCKETS_SECONDS,
    registers: [this.registry]
  });

  private readonly httpOutboundRequestsTotal = new Counter({
    name: 'http_outbound_requests_total',
    help: 'Total outbound HTTP requests made by the API server',
    labelNames: ['method', 'target', 'status_code'],
    registers: [this.registry]
  });

  private readonly httpOutboundRequestErrorsTotal = new Counter({
    name: 'http_outbound_request_errors_total',
    help: 'Total outbound HTTP request errors made by the API server',
    labelNames: ['method', 'target', 'error_type', 'status_code'],
    registers: [this.registry]
  });

  private readonly httpOutboundRequestDurationSeconds = new Histogram({
    name: 'http_outbound_request_duration_seconds',
    help: 'Outbound HTTP request duration in seconds',
    labelNames: ['method', 'target', 'status_code'],
    buckets: METRICS_HISTOGRAM_BUCKETS_SECONDS,
    registers: [this.registry]
  });

  onModuleInit(): void {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'haui_'
    });
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  observeHttpRequest(input: HttpRequestMetricInput): void {
    const method = this.normalizeLabelValue(input.method.toUpperCase());
    const route = this.normalizeLabelValue(input.route);
    const statusCode = this.normalizeStatusCode(input.statusCode);
    const durationSeconds = Math.max(input.durationMs, 0) / 1000;

    this.httpServerRequestsTotal.inc({
      method,
      route,
      status_code: statusCode
    });

    this.httpServerRequestDurationSeconds.observe(
      {
        method,
        route,
        status_code: statusCode
      },
      durationSeconds
    );

    if (input.statusCode >= 400) {
      this.httpServerRequestErrorsTotal.inc({
        method,
        route,
        status_code: statusCode
      });
    }
  }

  observeOutboundRequest(input: OutboundRequestMetricInput): void {
    const method = this.normalizeLabelValue(input.method.toUpperCase());
    const target = this.normalizeLabelValue(input.target);
    const statusCode = this.normalizeStatusCode(input.statusCode);
    const durationSeconds = Math.max(input.durationMs, 0) / 1000;

    this.httpOutboundRequestsTotal.inc({
      method,
      target,
      status_code: statusCode
    });

    this.httpOutboundRequestDurationSeconds.observe(
      {
        method,
        target,
        status_code: statusCode
      },
      durationSeconds
    );

    if ((input.statusCode && input.statusCode >= 400) || input.errorType) {
      this.httpOutboundRequestErrorsTotal.inc({
        method,
        target,
        error_type: this.normalizeLabelValue(
          input.errorType || 'unknown_error'
        ),
        status_code: statusCode
      });
    }
  }

  private normalizeStatusCode(statusCode?: number): string {
    if (!statusCode || statusCode < 100 || statusCode > 599) {
      return 'unknown';
    }

    return String(statusCode);
  }

  private normalizeLabelValue(value: string): string {
    if (!value) {
      return 'unknown';
    }

    return value.replace(/\s+/g, '_').slice(0, 120);
  }
}
