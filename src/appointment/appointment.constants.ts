export const AppointmentStatus = {
  BOOKED: 0,
  COMPLETED: 1,
  CANCELLED: 2,
} as const;

export type AppointmentStatusValue = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const ACTIVE_ORDER_APPOINTMENT_STATUSES: AppointmentStatusValue[] = [
  AppointmentStatus.BOOKED,
  AppointmentStatus.COMPLETED,
];

export const AppointmentTab = {
  PENDING_BOOKING: "PENDING_BOOKING",
  PENDING_ARRIVAL: "PENDING_ARRIVAL",
  SERVICE_RECORD: "SERVICE_RECORD",
  CANCELLED: "CANCELLED",
} as const;

export type AppointmentTabValue = (typeof AppointmentTab)[keyof typeof AppointmentTab];

export const AppointmentOperationAction = {
  CREATE: "CREATE",
  RESCHEDULE: "RESCHEDULE",
  CANCEL: "CANCEL",
  COMPLETE: "COMPLETE",
} as const;

export type AppointmentOperationActionValue =
  (typeof AppointmentOperationAction)[keyof typeof AppointmentOperationAction];

export const AppointmentOperatorType = {
  MEMBER: "MEMBER",
  ADMIN: "ADMIN",
  SYSTEM: "SYSTEM",
} as const;

export type AppointmentOperatorTypeValue =
  (typeof AppointmentOperatorType)[keyof typeof AppointmentOperatorType];
