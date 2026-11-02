export type OdometerReminderVehicle = {
  id: string;
  plateNumber: string;
  remindersEnabled: boolean;
  expenses: Array<{ odometerKm: number | null }>;
  services: Array<{
    id: string;
    servicedAt: Date;
    odometerKm: number | null;
    nextServiceAtKm: number | null;
    odometerNotifiedAt?: Date | null;
  }>;
};

export function latestOdometer(vehicle: OdometerReminderVehicle) {
  const values = [
    ...vehicle.expenses.map((item) => item.odometerKm),
    ...vehicle.services.map((item) => item.odometerKm)
  ].filter((value): value is number => value !== null);

  return values.length > 0 ? Math.max(...values) : null;
}

export function odometerReminderForVehicle(vehicle: OdometerReminderVehicle, thresholdKm: number) {
  if (!vehicle.remindersEnabled) return null;

  const service = [...vehicle.services]
    .sort((a, b) => b.servicedAt.getTime() - a.servicedAt.getTime())[0];
  const currentOdometer = latestOdometer(vehicle);

  if (!service?.nextServiceAtKm || currentOdometer === null) return null;

  const remainingKm = service.nextServiceAtKm - currentOdometer;
  if (remainingKm > thresholdKm) return null;

  return {
    service,
    currentOdometer,
    targetOdometer: service.nextServiceAtKm,
    remainingKm,
    isOverdue: remainingKm <= 0
  };
}
