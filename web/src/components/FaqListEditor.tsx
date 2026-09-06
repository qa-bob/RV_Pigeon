import type { Faq } from "@rv-pigeon/shared";

interface Props {
  faqs: Faq[];
  onChange: (faqs: Faq[]) => void;
}

export function FaqListEditor({ faqs, onChange }: Props) {
  function updateFaq(index: number, field: keyof Faq, value: string) {
    onChange(faqs.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }

  function removeFaq(index: number) {
    onChange(faqs.filter((_, i) => i !== index));
  }

  function addFaq() {
    onChange([...faqs, { question: "", answer: "" }]);
  }

  return (
    <div>
      {faqs.map((faq, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            placeholder="Question"
            value={faq.question}
            onChange={(e) => updateFaq(i, "question", e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            placeholder="Answer"
            value={faq.answer}
            onChange={(e) => updateFaq(i, "answer", e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" onClick={() => removeFaq(i)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addFaq}>
        Add FAQ
      </button>
    </div>
  );
}
