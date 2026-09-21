import { describe, expect, it } from 'bun:test'
import type { ScheduledJob, ScheduledJobRun } from '@/lib/schedules/scheduleTypes'
import { shouldCatchUpScheduledJob } from './scheduledJobCatchUp'

const now = Date.parse('2026-09-21T15:00:00Z')

function job(partial: Partial<ScheduledJob>): ScheduledJob {
  return {
    id: 'job-1',
    name: 't',
    query: 'q',
    enabled: true,
    createdAt: new Date(now - 48 * 3600_000).toISOString(),
    scheduleType: 'hourly',
    ...partial,
  } as ScheduledJob
}

function run(partial: Partial<ScheduledJobRun>): ScheduledJobRun {
  return {
    id: 'r1',
    jobId: 'job-1',
    startedAt: new Date(now - 2 * 3600_000).toISOString(),
    status: 'completed',
    ...partial,
  }
}

describe('shouldCatchUpScheduledJob', () => {
  it('does not skip an hourly job just because it ran in the last 24h', () => {
    expect(
      shouldCatchUpScheduledJob(
        job({ scheduleType: 'hourly', scheduleInterval: 1 }),
        [run({ startedAt: new Date(now - 2 * 3600_000).toISOString() })],
        now,
      ),
    ).toBe(true)
  })

  it('skips an hourly job that already ran within its interval', () => {
    expect(
      shouldCatchUpScheduledJob(
        job({ scheduleType: 'hourly', scheduleInterval: 1 }),
        [run({ startedAt: new Date(now - 10 * 60_000).toISOString() })],
        now,
      ),
    ).toBe(false)
  })

  it('skips a daily job that already ran today', () => {
    expect(
      shouldCatchUpScheduledJob(
        job({ scheduleType: 'daily', scheduleTime: '08:00' }),
        [run({ startedAt: new Date(now - 3 * 3600_000).toISOString() })],
        now,
      ),
    ).toBe(false)
  })

  it('does not catch up when every window is incognito', () => {
    expect(
      shouldCatchUpScheduledJob(
        job({ scheduleType: 'hourly', scheduleInterval: 1 }),
        [],
        now,
        { allWindowsIncognito: true },
      ),
    ).toBe(false)
  })
})
