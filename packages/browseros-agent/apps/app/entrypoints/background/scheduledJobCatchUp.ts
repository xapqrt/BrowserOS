import type { ScheduledJob, ScheduledJobRun } from '@/lib/schedules/scheduleTypes'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/** Whether a missed-job pass should fire this schedule (#2646). */
export function shouldCatchUpScheduledJob(
  job: ScheduledJob,
  runs: ScheduledJobRun[],
  now: number,
): boolean {
  if (!job.enabled) return false
  const jobRuns = runs.filter((r) => r.jobId === job.id)
  if (jobRuns.some((r) => r.status === 'running')) return false

  const lastStarted = jobRuns.reduce<number | null>((latest, run) => {
    const t = new Date(run.startedAt).getTime()
    if (!Number.isFinite(t)) return latest
    return latest === null || t > latest ? t : latest
  }, null)

  if (job.scheduleType === 'hourly' || job.scheduleType === 'minutes') {
    if (!job.scheduleInterval) return false
    const intervalMs =
      job.scheduleType === 'hourly'
        ? job.scheduleInterval * 60 * 60 * 1000
        : job.scheduleInterval * 60 * 1000
    const origin = lastStarted ?? new Date(job.createdAt).getTime()
    return now - origin >= intervalMs
  }

  if (lastStarted !== null && now - lastStarted < TWENTY_FOUR_HOURS_MS) {
    return false
  }

  if (job.scheduleType === 'daily' && job.scheduleTime) {
    const [hours, minutes] = job.scheduleTime.split(':').map(Number)
    const scheduledToday = new Date(now)
    scheduledToday.setHours(hours, minutes, 0, 0)
    if (now < scheduledToday.getTime()) return false
  }

  return true
}
