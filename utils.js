export function calculateReminderInterval(targetGlasses, consumedGlasses) {
    const remainingGlasses = targetGlasses - consumedGlasses;
    if (remainingGlasses <= 0) {
        return 0;
    }

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59);
    const remainingMinutes = Math.max(
        30,
        Math.floor((endOfDay - now) / (1000 * 60))
    );

    const glassSize = 250;
    const remainingWater = remainingGlasses * glassSize;

    const remainingHours = remainingMinutes / 60;
    const optimalRatePerHour = remainingWater / remainingHours;

    let intervalMinutes;

    if (optimalRatePerHour <= 250) {
        intervalMinutes = 120;
    } else if (optimalRatePerHour <= 500) {
        intervalMinutes = 60;
    } else if (optimalRatePerHour <= 750) {
        intervalMinutes = 45;
    } else {
        intervalMinutes = 30;
    }

    if (remainingMinutes < intervalMinutes * remainingGlasses) {
        intervalMinutes = Math.max(30, Math.floor(remainingMinutes / (remainingGlasses + 1)));
    }

    return intervalMinutes;
}
