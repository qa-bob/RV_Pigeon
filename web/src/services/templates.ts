import type { MessageTemplate } from "@rv-pigeon/shared";
import { apiFetch } from "./apiClient";

export type TemplateInput = Omit<
  MessageTemplate,
  "id" | "hostId" | "createdAt" | "updatedAt"
>;

export function listTemplates(): Promise<MessageTemplate[]> {
  return apiFetch("/api/templates");
}

export function createTemplate(input: TemplateInput): Promise<MessageTemplate> {
  return apiFetch("/api/templates", { method: "POST", body: JSON.stringify(input) });
}

export function updateTemplate(
  id: string,
  input: Partial<TemplateInput>,
): Promise<MessageTemplate> {
  return apiFetch(`/api/templates/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
