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
    <div className="stack">
      {faqs.map((faq, i) => (
        <div key={i} className="row">
          <input
            placeholder="Question"
            value={faq.question}
            onChange={(e) => updateFaq(i, "question", e.target.value)}
            style={{ flex: 1, width: "auto" }}
          />
          <input
            placeholder="Answer"
            value={faq.answer}
            onChange={(e) => updateFaq(i, "answer", e.target.value)}
            style={{ flex: 1, width: "auto" }}
          />
          <button type="button" className="btn-secondary" onClick={() => removeFaq(i)}>
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
