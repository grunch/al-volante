import { useState } from 'react';
import type { Presentation } from '../engine.ts';

type DecisionPresentation = Extract<Presentation, { kind: 'decision' }>;

interface DecisionQuestionProps {
  presentation: DecisionPresentation;
  answered: boolean;
  /** Resolves a choice: the next node, or null when the choice ends the scene. */
  resolve: (nodeId: string, choiceId: string) => string | null;
  onAnswer: (choiceIds: string[]) => void;
}

/** Branching scene: each choice either opens the next situation or ends the scene. */
export function DecisionQuestion({ presentation, answered, resolve, onAnswer }: DecisionQuestionProps) {
  const [path, setPath] = useState<Array<{ nodeId: string; choiceId: string }>>([]);
  const [nodeId, setNodeId] = useState(presentation.start);
  const node = presentation.nodes[nodeId];

  const choose = (choiceId: string) => {
    const nextPath = [...path, { nodeId, choiceId }];
    setPath(nextPath);
    const next = resolve(nodeId, choiceId);
    if (next === null) onAnswer(nextPath.map((step) => step.choiceId));
    else setNodeId(next);
  };

  return (
    <div className="question">
      {path.map((step) => {
        const stepNode = presentation.nodes[step.nodeId];
        return (
          <p key={step.nodeId} className="decision__history">
            {stepNode?.text} <strong>→ {stepNode?.choices.find((choice) => choice.id === step.choiceId)?.text}</strong>
          </p>
        );
      })}
      {!answered && node && (
        <>
          <p className="question__prompt">{node.text}</p>
          <div className="decision__choices">
            {node.choices.map((choice) => (
              <button key={choice.id} type="button" className="button button--choice" onClick={() => choose(choice.id)}>
                {choice.text}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
