export type WebNotificationTone = "danger" | "info" | "success" | "warning";

export type WebNotification = {
  createdAt: string;
  href: string;
  id: string;
  message: string;
  source: "booking" | "order" | "payment" | "repair";
  title: string;
  tone: WebNotificationTone;
};
