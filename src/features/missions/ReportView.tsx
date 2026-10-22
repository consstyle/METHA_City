import { parseReport } from './missionView';

/** Informe Markdown pintado con elementos de React (el texto nunca se inyecta como HTML). */
export function ReportView({ markdown }: Readonly<{ markdown: string }>) {
  return (
    <article className="report">
      {parseReport(markdown).map((b, i) => {
        if (b.type === 'list') {
          return (
            <ul key={i}>
              {b.items.map((item, j) => <li key={j}>{item.strong && <strong>{item.strong}: </strong>}{item.text}</li>)}
            </ul>
          );
        }
        if (b.type === 'h1') return <h3 key={i} className="report-h1">{b.text}</h3>;
        if (b.type === 'h2') return <h4 key={i} className="report-h2">{b.text}</h4>;
        if (b.type === 'quote') return <blockquote key={i}>{b.text}</blockquote>;
        if (b.type === 'byline') return <p key={i} className="report-byline">{b.text}</p>;
        return <p key={i}>{b.text}</p>;
      })}
    </article>
  );
}
