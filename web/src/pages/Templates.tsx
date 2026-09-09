import { useEffect, useState } from "react";
import type { MessageTemplate } from "@rv-pigeon/shared";
import { TemplateEditor } from "../components/TemplateEditor";
import { createTemplate, listTemplates, updateTemplate, TemplateInput } from "../services/templates";
import { listListings } from "../services/listings";
import type { Listing } from "@rv-pigeon/shared";

export default function Templates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [editing, setEditing] = useState<MessageTemplate | "new" | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [t, l] = await Promise.all([listTemplates(), listListings()]);
    setTemplates(t);
    setListings(l);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(input: TemplateInput) {
    if (editing === "new") {
      await createTemplate(input);
    } else if (editing) {
      await updateTemplate(editing.id, input);
    }
    setEditing(null);
    await refresh();
  }

  async function toggleActive(template: MessageTemplate) {
    await updateTemplate(template.id, { active: !template.active });
    await refresh();
  }

  if (loading) return <p>Loading…</p>;

  if (editing) {
    return (
      <div className="page">
        <div className="card">
          <TemplateEditor
            template={editing === "new" ? undefined : editing}
            listings={listings}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Message Templates</h2>
        <button onClick={() => setEditing("new")}>Create new template</button>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Schedule</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  {t.offsetAmount} {t.offsetUnit} {t.offsetDirection} {t.triggerEvent}
                </td>
                <td>
                  <input type="checkbox" checked={t.active} onChange={() => toggleActive(t)} />
                </td>
                <td>
                  <button className="btn-secondary" onClick={() => setEditing(t)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
