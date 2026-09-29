# Seasonal streamflow condition

River Pulse adopts the USGS National Water Dashboard / Water Data for the Nation day-of-year streamflow condition convention as the initial seasonal-context calculation.

## Inputs

For a selected gauge and calendar day:

1. Select the latest eligible continuous discharge observation at or before the requested time using River Pulse's explicit time-selection policy.
2. Request USGS Water Data Statistics `observationNormals` for discharge (`00060`), `normal_type=DOY`, for that month-day.
3. Use the historical daily-mean minimum, 10th, 25th, 75th, 90th percentiles, and maximum as thresholds.
4. Require at least 20 historical observations for that day of year before assigning a ranked condition. This implements the National Water Dashboard's rule that sites with less than 20 years of record are not ranked. Gaps can make the available day-of-year sample count smaller than the nominal period of record, so River Pulse enforces the requirement from the returned sample count rather than merely subtracting start/end years.

The Statistics API derives its day-of-year statistics from approved daily values. The current observation may be provisional; its approval state remains attached to the observation separately.

## Categories

| Condition | River Pulse threshold rule |
| --- | --- |
| Not flowing | current discharge = 0 |
| All-time high for this day | current >= historical maximum |
| Much above normal | current > 90th-percentile threshold |
| Above normal | current > 75th and <= 90th-percentile threshold |
| Normal | current >= 25th and <= 75th-percentile threshold |
| Below normal | current >= 10th and < 25th-percentile threshold |
| Much below normal | current < 10th-percentile threshold |
| All-time low for this day | current <= historical minimum |
| Not ranked | current missing, required thresholds missing, or sample count < 20 |

All-time high/low checks are applied before percentile-band checks; `Not flowing` is presented as its own condition.

## Important representation rule

The Statistics API exposes threshold percentiles (including 10, 25, 75, and 90), not the exact percentile rank of an arbitrary current discharge value. River Pulse therefore reports a **percentile band** such as `10th to <25th percentile band` and does not invent a value such as `18th percentile`.

The category is a derived contextual presentation based on an unchanged current discharge observation plus unchanged USGS derived statistics. It is implemented as a visual binding, not written back into either scientific quantity.

For historical browsing, a completed USGS daily mean can be compared with the day-of-year statistics for that historical calendar date. That historical daily mean remains a `derived_statistic`; River Pulse does not relabel it as an observation.

## API status

The USGS Water Data Statistics API is currently a beta service. The adapter is isolated in `river-pulse/adapters/usgs-statistics.js` so API changes do not alter the normalized quantity or presentation contracts.
